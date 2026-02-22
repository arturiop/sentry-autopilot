import { MCPServer } from "mcp-use/server";
import { env } from "@/config/env";
import { registerTools } from "./tools/index.js";

const server = new MCPServer({
    name: "sentry-autopilot",
    title: "Sentry Autopilot",
    version: "1.0.0",
    host: "0.0.0.0",
});

registerTools(server);

server.listen().then(() => console.log("Sentry Autopilot running"));
