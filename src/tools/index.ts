import type { MCPServer } from "mcp-use/server";
import { registerSentryTools } from "./sentry-tools";
import { registerGithubTools } from "./git-tools";
import { registerDiagnoseTools } from "./diagnose-tools";

export const registerTools = (server: MCPServer) => {
  registerSentryTools(server);
  registerGithubTools(server);
  registerDiagnoseTools(server)
};
