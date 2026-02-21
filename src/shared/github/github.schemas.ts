import { z } from "zod";

export const repoFileSchema = z.object({
  path: z.string(),
  ref: z.string(),
  text: z.string(),
  permalink: z.string().optional(),
});
export type RepoFile = z.infer<typeof repoFileSchema>;

export const repoContextSchema = z.object({
  filePath: z.string(),
  ref: z.string(),
  line: z.number().int().positive(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  context: z.string(),
  permalink: z.string().optional(),
});
export type RepoContext = z.infer<typeof repoContextSchema>;

// optional: validate GitHub contents response
export const githubContentResponseSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
  encoding: z.string().optional(),
});
export type GithubContentResponse = z.infer<typeof githubContentResponseSchema>;