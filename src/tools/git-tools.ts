import { MCPServer, text } from "mcp-use/server";
import { z } from "zod";
import { createGithubClient } from "@/services/github-client"; // <-- change if your path/name differs

const client = createGithubClient();

export const registerGithubTools = (server: MCPServer) => {
  server.tool(
    {
      name: "repo-get-file",
      description: "Fetch a file from GitHub repo by path (and optional ref).",
      schema: z.object({
        path: z.string().describe("Repo-relative path, e.g. src/components/X.tsx"),
        ref: z.string().optional().describe("Branch/tag/sha (default from env)"),
      }),
    },
    async ({ path, ref }) => {
      const cleanPath = path.replace(/^\/+/, "");
      const file = await client.getFile(cleanPath, ref);
      return text(JSON.stringify(file, null, 2));
    }
  );

  server.tool(
    {
      name: "repo-get-context",
      description: "Fetch code context around a specific line in a GitHub file.",
      schema: z.object({
        path: z.string().describe("Repo-relative path, e.g. src/components/X.tsx"),
        line: z.number().int().positive().describe("1-based line number"),
        radius: z.number().int().positive().max(200).default(12).describe("Lines above/below"),
        ref: z.string().optional().describe("Branch/tag/sha (default from env)"),
      }),
    },
    async ({ path, line, radius, ref }) => {
      const cleanPath = path.replace(/^\/+/, "");
      const ctx = await client.getContext(cleanPath, line, radius, ref);
      return text(JSON.stringify(ctx, null, 2));
    }
  );
};