import { createGithubClient } from "@/services/github-client";
import { createSentryClient } from "@/services/sentry-client";
import z from "zod";
import { MCPServer, text, widget } from "mcp-use/server";

const client = createSentryClient();
const gh = createGithubClient();

type DiagnoseResult = {
    issue: {
        id: string;
        shortId?: string;
        title?: string;
        culprit?: string | null;
        permalink?: string | null;
    };
    location: {
        path: string;
        line: number | null;
        permalink?: string | null;
    };
    context?: string | null;
    filePreview?: string | null;
    // helpful debugging info when GH lookup fails
    triedPaths?: string[];
    error?: string;
};

function normalizePath(p: string) {
    return (p || "")
        .replace(/^\/+/, "")
        .replace(/^webpack:\/\//, "")
        .replace(/^webpack:\/\/\//, "")
        .replace(/^app:\/\//, "")
        .replace(/^app:\/\/\//, "")
        .replace(/^~\//, "")
        .replace(/^\.\//, "");
}

function buildPathCandidates(rawPath: string): string[] {
    const p = normalizePath(rawPath);
    if (!p) return [];

    const candidates = [
        p,
        p.startsWith("src/") ? p : `src/${p}`,
        `apps/web/${p.startsWith("src/") ? p : `src/${p}`}`,
        `apps/frontend/${p.startsWith("src/") ? p : `src/${p}`}`,
        `frontend/${p.startsWith("src/") ? p : `src/${p}`}`,
        `client/${p.startsWith("src/") ? p : `src/${p}`}`,
        `packages/web/${p.startsWith("src/") ? p : `src/${p}`}`,
    ];

    return Array.from(new Set(candidates));
}

function formatSentryFrameContext(frame: any): string | null {
    const pre = Array.isArray(frame?.pre_context) ? frame.pre_context.join("\n") : "";
    const line = typeof frame?.context_line === "string" ? frame.context_line : "";
    const post = Array.isArray(frame?.post_context) ? frame.post_context.join("\n") : "";
    const combined = [pre, line, post].filter(Boolean).join("\n");
    return combined || null;
}

function pickBestFrame(event: any): { path: string; line: number | null; sentryContext: string | null } {
    const entries = event?.entries ?? [];

    for (const entry of entries) {
        if (entry.type !== "exception") continue;

        const values = (entry.data?.values ?? []) as Array<any>;
        for (const ex of values) {
            const frames = ex?.stacktrace?.frames ?? [];
            if (!frames.length) continue;

            const inApp = frames.filter((f: any) => f?.in_app && (f?.filename || f?.abs_path));
            const candidates = inApp.length ? inApp : frames;

            // Prefer the last relevant frame
            for (let i = candidates.length - 1; i >= 0; i--) {
                const f = candidates[i];
                const p = normalizePath(f?.filename || f?.abs_path || "");
                const ln = typeof f?.lineno === "number" ? f.lineno : null;
                if (p) {
                    return { path: p, line: ln, sentryContext: formatSentryFrameContext(f) };
                }
            }
        }
    }

    return { path: "", line: null, sentryContext: null };
}

async function tryGetFileWithCandidates(
    rawPath: string,
    ref?: string
): Promise<{ ok: true; path: string; file: any; tried: string[] } | { ok: false; tried: string[]; lastError?: string }> {
    const candidates = buildPathCandidates(rawPath);
    const tried: string[] = [];
    let lastError: string | undefined;

    for (const p of candidates) {
        tried.push(p);
        try {
            const file = await gh.getFile(p, ref);
            return { ok: true, path: p, file, tried };
        } catch (e: any) {
            const msg = e?.message ? String(e.message) : String(e);
            lastError = msg;
            // Only continue on 404-style failures; otherwise bubble up.
            if (!msg.includes("404") && !msg.includes("Not Found")) {
                throw e;
            }
        }
    }

    return { ok: false, tried, lastError };
}

async function diagnoseIssue(issueId: string, radius: number, ref?: string): Promise<DiagnoseResult> {
    const issue = await client.getIssue({ issueId });
    const events = await client.listIssueEvents({ issueId, limit: 1 });
    const event = events?.[0];

    // best-effort from issue metadata
    let path = normalizePath((issue.metadata as any)?.filename || (issue.metadata as any)?.file || "");
    let line: number | null = null;
    let sentryContext: string | null = null;

    // prefer event stacktrace
    if (event) {
        const picked = pickBestFrame(event);
        if (picked.path) path = picked.path;
        if (picked.line != null) line = picked.line;
        if (picked.sentryContext) sentryContext = picked.sentryContext;
    }

    if (!path) {
        return {
            issue: { id: issue.id, shortId: issue.shortId, title: issue.title, culprit: issue.culprit, permalink: issue.permalink },
            location: { path: "", line: null },
            error: "No file path found in issue/event.",
        };
    }

    // If we can't resolve the file in GitHub, still return Sentry context if available.
    const fileRes = await tryGetFileWithCandidates(path, ref);
    if (!fileRes.ok) {
        return {
            issue: { id: issue.id, shortId: issue.shortId, title: issue.title, culprit: issue.culprit, permalink: issue.permalink },
            location: { path, line: line ?? null, permalink: null },
            context: sentryContext,
            triedPaths: fileRes.tried,
            error: `GitHub file not found for extracted path. ${fileRes.lastError ?? ""}`.trim(),
        };
    }

    // If no line, return a small file preview (still useful)
    if (line == null) {
        return {
            issue: { id: issue.id, shortId: issue.shortId, title: issue.title, culprit: issue.culprit, permalink: issue.permalink },
            location: { path: fileRes.path, line: null, permalink: null },
            filePreview: fileRes.file.text.slice(0, 2000),
        };
    }

    // Fetch code context around the exact line
    const ctx = await gh.getContext(fileRes.path, line, radius, ref);

    return {
        issue: { id: issue.id, shortId: issue.shortId, title: issue.title, culprit: issue.culprit, permalink: issue.permalink },
        location: { path: ctx.filePath, line: ctx.line, permalink: ctx.permalink },
        context: ctx.context,
    };
}

export const registerDiagnoseTools = (server: MCPServer) => {
    server.tool(
        {
            name: "diagnose-sentry-error",
            description: "Fetch Sentry issue + latest event, extract file/line, fetch GitHub code context.",
            schema: z.object({
                issueId: z.string(),
                radius: z.number().int().positive().max(200).optional().default(12),
                ref: z.string().optional(),
            }),
        },
        async ({ issueId, radius, ref }) => {
            try {
                const result = await diagnoseIssue(issueId, radius, ref);
                return text(JSON.stringify(result, null, 2));
            } catch (e: any) {
                return text(`diagnose-sentry-error failed: ${e?.message ?? String(e)}`);
            }
        }
    );

    server.tool(
        {
            name: "propose-fix",
            description: "Generate a minimal safe patch diff for a Sentry issue (no writes). Renders diff in widget; do not spam chat.",
            schema: z.object({
                issueId: z.string(),
                radius: z.number().int().positive().max(200).optional().default(80),
                ref: z.string().optional(),
            }),
            widget: {
                name: "patch-viewer",
                invoking: "Drafting fix...",
                invoked: "Fix ready",
            },
        },
        async ({ issueId, radius, ref }) => {
            const diag = await diagnoseIssue(issueId, radius, ref);

            if (!diag.location.path) {
                // Widget can still show the error nicely
                return widget({
                    props: {
                        issueId,
                        filePath: "",
                        summary: "Unable to propose fix",
                        diff: "",
                        error: diag.error ?? "No file path found.",
                        triedPaths: diag.triedPaths ?? [],
                    },
                    output: text("⚠️ Fix not generated (see widget)."),
                });
            }

            const filePath = diag.location.path;

            // v1 hardcoded patch for your specific crash pattern
            // Later: generate from diag.context / filePreview and the true failing line.
            const summary = "Guard against missing window.userAnalytics before calling track().";

            const diff = [
                `diff --git a/${filePath} b/${filePath}`,
                `--- a/${filePath}`,
                `+++ b/${filePath}`,
                `@@`,
                `-            (window as any).userAnalytics.track("logo_clicked", { time: Date.now() });`,
                `+            const ua = (window as any).userAnalytics;`,
                `+            if (ua?.track) ua.track("logo_clicked", { time: Date.now() });`,
            ].join("\n");

            return widget({
                props: {
                    issueId,
                    filePath,
                    summary,
                    diff,
                    // optional: pass diagnose details for UI
                    location: diag.location,
                    context: diag.context ?? null,
                    filePreview: diag.filePreview ?? null,
                },
                output: text("Fix shown in widget."),
            });
        }
    );

    server.tool(
        {
            name: "apply-fix",
            description: "MOCK apply: verifies the patch can be applied and returns updated content preview. No branch, no commit, no GitHub writes.",
            schema: z.object({
                issueId: z.string(),
                filePath: z.string(),
                baseRef: z.string().optional().default("main"),
                branchName: z.string().optional(), // kept for UX, not used
                commitMessage: z.string().optional().default("Fix Sentry issue"), // kept for UX, not used
                before: z.string(),
                after: z.string(),
                strategy: z.enum(["exact", "regex"]).optional().default("regex"),
            }),
        },
        async ({ issueId, filePath, baseRef, branchName, commitMessage, before, after, strategy }) => {
            const file = await gh.getFile(filePath, baseRef);

            let updated: string | null = null;
            let matchInfo: any = null;

            if (strategy === "exact") {
                const occurrences = file.text.split(before).length - 1;
                if (occurrences === 0) {
                    return text(`MOCK apply failed: 'before' snippet not found in ${filePath}`);
                }
                if (occurrences > 1) {
                    return text(`MOCK apply failed: 'before' matched ${occurrences} times in ${filePath} (make it more specific).`);
                }

                updated = file.text.replace(before, after);
                matchInfo = { strategy: "exact", occurrences };
            }

            if (strategy === "regex") {
                // Robust pattern for your case: (window as any).userAnalytics.track("logo_clicked", { time: Date.now() });
                const re = /(\(window as any\)\.userAnalytics)\.track\(\s*["']logo_clicked["']\s*,\s*\{\s*time:\s*Date\.now\(\)\s*\}\s*\)\s*;?/g;

                const matches = file.text.match(re)?.length ?? 0;
                if (matches === 0) {
                    return text(`MOCK apply failed: regex did not match in ${filePath}`);
                }
                if (matches > 1) {
                    return text(`MOCK apply failed: regex matched ${matches} times in ${filePath}`);
                }

                // NOTE: in regex mode we ignore before/after strings and apply a known safe replacement
                const replacement = `const ua = (window as any).userAnalytics;\n` + `            if (ua?.track) ua.track("logo_clicked", { time: Date.now() });`;

                updated = file.text.replace(re, replacement);
                matchInfo = { strategy: "regex", matches };
            }

            if (!updated) {
                return text(`MOCK apply failed: could not produce updated content for ${filePath}`);
            }

            const anchorAfter = strategy === "exact" ? after : `const ua = (window as any).userAnalytics;`;

            const idx = file.text.indexOf(strategy === "exact" ? before : "userAnalytics.track");
            const beforePreview = idx >= 0 ? file.text.slice(Math.max(0, idx - 400), Math.min(file.text.length, idx + 400)) : file.text.slice(0, 800);

            const idx2 = updated.indexOf(anchorAfter);
            const afterPreview = idx2 >= 0 ? updated.slice(Math.max(0, idx2 - 400), Math.min(updated.length, idx2 + 400)) : updated.slice(0, 800);

            return text(
                JSON.stringify(
                    {
                        ok: true,
                        mode: "mock",
                        matchInfo,
                        issueId,
                        filePath,
                        baseRef,
                        branchName: branchName ?? `fix/sentry-${issueId}-MOCK`,
                        commitMessage,
                        note: "No GitHub write performed. This only validates and previews the change.",
                        preview: {
                            before: beforePreview,
                            after: afterPreview,
                        },
                    },
                    null,
                    2
                )
            );
        }
    );

    server.tool(
        {
            name: "open-pr",
            description: "Open a GitHub PR from a branch.",
            schema: z.object({
                title: z.string(),
                body: z.string().optional().default(""),
                head: z.string(),
                base: z.string().optional().default("main"),
            }),
        },
        async ({ title, body, head, base }) => {
            const pr = await gh.createPullRequest({ title, body, head, base });
            return text(JSON.stringify({ ok: true, prUrl: pr.url, number: pr.number }, null, 2));
        }
    );
};
