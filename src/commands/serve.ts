import type { BrainEngine } from '../core/engine.ts';
import { startMcpServer } from '../mcp/server.ts';

export async function runServe(engine: BrainEngine) {
  const watchDir = process.env.GBRAIN_WATCH_DIR || undefined;
  if (watchDir) {
    console.error(`[gbrain] file-watcher enabled on ${watchDir}`);
  }
  console.error('Starting GBrain MCP server (stdio)...');
  await startMcpServer(engine, { watchDir });
}
