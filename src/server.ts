import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { collectFiles } from './collectFiles.js';
import { uploadAndShare } from './pshareClient.js';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'pshare-share-mcp', version: '1.0.0' });

  server.registerTool(
    'pshare_upload',
    {
      title: 'Upload to Pshare and get a share link',
      description:
        'Uploads one or more files/folders from this machine to Pshare (LAN file sharing) and returns ' +
        'the same share link a user would get by uploading through the UI and clicking "Share".',
      inputSchema: {
        paths: z
          .array(z.string())
          .min(1)
          .describe('Absolute file or folder paths on this machine to upload. Folders are uploaded recursively.'),
        title: z.string().optional().describe('Title shown on the share card'),
        senderName: z.string().optional().describe('Name of the sender shown to recipients'),
        password: z.string().optional().describe('Password required to open the share link'),
        description: z.string().optional().describe('Description shown on the share card'),
        ttlMinutes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Minutes until the share expires; omit for no expiry'),
      },
    },
    async ({ paths, title, senderName, password, description, ttlMinutes }) => {
      try {
        const files = collectFiles(paths);
        const result = await uploadAndShare(files, { title, senderName, password, description, ttlMinutes });

        const lines = [`Uploaded ${result.fileCount} file(s) and created a share link.`, `Link: ${result.link}`];
        if (title) lines.push(`Title: ${title}`);
        if (senderName) lines.push(`Sender: ${senderName}`);
        lines.push(`Password protected: ${password ? 'yes' : 'no'}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Failed to upload/share: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    }
  );

  return server;
}
