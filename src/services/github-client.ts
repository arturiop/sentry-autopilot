import { env } from "../config/env.js";
import { githubContentResponseSchema, repoContextSchema, repoFileSchema } from "../shared/github/github.schemas.js";

export const createGithubClient = () => {
    const baseUrl = env.GITHUB_BASE_URL;
    const token = env.GITHUB_TOKEN;

    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const defaultRef = env.GITHUB_REF ?? "main";

    const makePermalink = (ref: string, path: string, line?: number) => {
        const clean = path.replace(/^\/+/, "");
        const base = `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(ref)}/${clean}`;
        return line ? `${base}#L${line}` : base;
    };

    const request = async <T>(path: string, params?: Record<string, string>) => {
        const url = new URL(`${baseUrl}${path}`);
        if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

        const res = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`GitHub API failed: ${res.status} ${res.statusText} ${body}`);
        }

        return (await res.json()) as T;
    };

    const createPullRequest = async (args: { head: string; base?: string; title: string; body?: string; draft?: boolean }) => {
        const raw = await request<{
            html_url: string;
            number: number;
            title: string;
        }>(`/repos/${owner}/${repo}/pulls`, {
            method: "POST",
            body: JSON.stringify({
                title: args.title,
                head: args.head,
                base: args.base ?? defaultRef,
                body: args.body ?? "",
                draft: args.draft ?? false,
            }),
        });

        return {
            url: raw.html_url,
            number: raw.number,
            title: raw.title,
        };
    };

    const getFile = async (filePath: string, ref = defaultRef) => {
        const clean = filePath.replace(/^\/+/, "");

        const raw = await request<unknown>(`/repos/${owner}/${repo}/contents/${encodeURIComponent(clean).replace(/%2F/g, "/")}`, { ref });

        const data = githubContentResponseSchema.parse(raw);

        if (!data.content || data.encoding !== "base64") {
            throw new Error(`Unexpected GitHub content response for ${clean}`);
        }

        const text = Buffer.from(data.content, "base64").toString("utf8");

        return repoFileSchema.parse({
            path: data.path,
            ref,
            text,
            permalink: makePermalink(ref, data.path),
        });
    };

    const getContext = async (filePath: string, line: number, radius = 12, ref = defaultRef) => {
        const file = await getFile(filePath, ref);
        const lines = file.text.split(/\r?\n/);

        const idx = Math.max(0, Math.min(lines.length - 1, line - 1)); // 1-based -> 0-based
        const start = Math.max(0, idx - radius);
        const end = Math.min(lines.length - 1, idx + radius);

        const context = lines.slice(start, end + 1).map((l: string, i: number) => {
            const n = start + i + 1;
            const mark = n === line ? ">" : " ";
            return `${mark} ${String(n).padStart(4, " ")} | ${l}`;
        });

        return repoContextSchema.parse({
            filePath: file.path,
            ref: file.ref,
            line,
            startLine: start + 1,
            endLine: end + 1,
            context: context.join("\n"),
            permalink: makePermalink(file.ref, file.path, line),
        });
    };

    return { request, getFile, getContext, createPullRequest };
};
