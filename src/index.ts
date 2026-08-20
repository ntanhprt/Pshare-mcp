#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { createServer } from './server.js';

const useHttp = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http';

if (useHttp) {
  const host = process.env.PSHARE_MCP_HOST || '0.0.0.0';
  const port = parseInt(process.env.PSHARE_MCP_PORT || '7317', 10);
  const allowedHosts = process.env.PSHARE_MCP_ALLOWED_HOSTS
    ? process.env.PSHARE_MCP_ALLOWED_HOSTS.split(',').map((h) => h.trim())
    : undefined;

  const app = createMcpExpressApp({ host, allowedHosts });

  app.post('/mcp', async (req: any, res: any) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, host, () => {
    console.log(`[pshare-share-mcp] HTTP transport listening on http://${host}:${port}/mcp`);
    console.log(`[pshare-share-mcp] Forwarding uploads to ${process.env.PSHARE_BASE_URL || 'http://localhost:5173'}`);
  });
} else {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('[pshare-share-mcp] stdio transport ready');
  });
}
