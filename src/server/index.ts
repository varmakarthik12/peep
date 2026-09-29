import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PeepConfig } from "../config/schema.js";
import { createProvider } from "../providers/index.js";
import { createTarget } from "../targets/index.js";
import { CoordinateMapper, DisplayMetrics } from "../core/coordinate-mapper.js";
import { registerTools } from "./tools.js";
import { logger } from "../utils/logger.js";

export async function startMcpServer(config: PeepConfig): Promise<void> {
  logger.info(`Starting Peep Token-Shield MCP Server...`);

  const server = new McpServer({
    name: "peep",
    version: "0.1.0",
  });

  const provider = createProvider(config.provider);
  const target = createTarget(config.target, config.logs);

  try {
    await target.init();
  } catch (err) {
    logger.warn(`Target initialization warning: ${err instanceof Error ? err.message : String(err)}`);
  }

  let metrics: DisplayMetrics;
  try {
    metrics = await target.getDisplayMetrics();
  } catch {
    metrics = { width: 1080, height: 2400, rotation: 0 };
    logger.warn("Using default display metrics (1080x2400) until device connects.");
  }
  const mapper = new CoordinateMapper(metrics, config.perception.coordinateScale);

  registerTools(server, target, provider, mapper);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.shield(`Peep MCP Server running on stdio transport. Token shield active.`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down Peep server...");
    await target.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
