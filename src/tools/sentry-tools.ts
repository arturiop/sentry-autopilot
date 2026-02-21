import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";
import { createSentryClient } from "../services/sentry-client";

const client = createSentryClient();

function toNum(v: any) {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

function formatIssueSummary(it: any) {
    const shortId = it.shortId ?? it.short_id ?? it.id;

    const title = (it.title ?? "").trim();
    const shortTitle = title.length > 80 ? title.slice(0, 77) + "…" : title;

    const rawFile = it.metadata?.filename ?? "";
    // make it more readable: remove leading slashes and keep it short
    const file = String(rawFile).replace(/^\/+/, "");

    // Example: "OFFICE-1 — Cannot read properties of undefined (reading 'track') — src/components/.../Navigation.tsx"
    if (file) return `${shortId} — ${shortTitle} — ${file}`;
    return `${shortId} — ${shortTitle}`;
}

export const registerSentryTools = (server: MCPServer) => {
    server.tool(
        {
            name: "list-sentry-errors",
            description: "Get unresolved Sentry issues from a project within a timeframe. IMPORTANT: Do not summarize, list, or repeat issues in chat.",
            schema: z.object({
                hoursAgo: z.number().default(2),
                limit: z.number().default(20),
            }),
            widget: {
                name: "issues-list",
                invoking: "Loading Sentry issues...",
                invoked: "Issues loaded",
            },
        },
        async ({ hoursAgo, limit }) => {
            const issues = await client.listIssues({ hoursAgo, limit });

            const rows = issues.map((it: any) => ({
                id: String(it.id),
                shortId: it.shortId ?? "",
                firstSeen: it.firstSeen ?? null,
                lastSeen: it.lastSeen ?? null,
                eventCount: toNum(it.eventCount),
                summary: formatIssueSummary(it),
                permalink: it.permalink ?? null,
                // optional extras if you want badges
                level: it.level ?? null,
                status: it.status ?? null,
            }));

            return widget({
                props: { hoursAgo, limit, count: rows.length, issues: rows },
                message: `Loaded ${rows.length} issues from last ${hoursAgo}h.`,
            });
        }
    );

    server.tool(
        {
            name: "get-sentry-error",
            description: "Get detailed Sentry issue data by ID.",
            schema: z.object({
                issueId: z.string().describe("Sentry issue ID"),
            }),
        },
        async ({ issueId }) => {
            console.log("here2");
            const issue = await client.getIssue({ issueId });

            return text(JSON.stringify(issue, null, 2));
        }
    );
};
