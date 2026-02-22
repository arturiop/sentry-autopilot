import type { MCPServer } from "mcp-use/server";
import { registerSentryTools } from "./sentry-tools.js";
import { registerGithubTools } from "./git-tools.js";
import { registerDiagnoseTools } from "./diagnose-tools.js";

export const registerTools = (server: MCPServer) => {
  registerSentryTools(server);
  registerGithubTools(server);
  registerDiagnoseTools(server)
};
