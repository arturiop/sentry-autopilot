import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim()).optional().default("");

const envSchema = z.object({
  MCP_URL: z.preprocess(emptyToUndefined, z.string().trim().url()).optional().default("http://localhost:3000"),
  SENTRY_BASE_URL: z.preprocess(emptyToUndefined, z.string().trim().url()).default("https://sentry.io/api/0"),
  SENTRY_AUTH_TOKEN: optionalTrimmedString,
  SENTRY_ORG_SLUG: optionalTrimmedString,
  SENTRY_PROJECT_SLUG: optionalTrimmedString,
  GITHUB_BASE_URL: z.preprocess(emptyToUndefined, z.string().trim().url()).optional(),
  GITHUB_TOKEN: optionalTrimmedString,
  GITHUB_OWNER: optionalTrimmedString,
  GITHUB_REPO: optionalTrimmedString,
  GITHUB_REF: optionalTrimmedString,
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment variables");
}

export const env = {
  ...parsedEnv.data,
};
