import fs from 'node:fs';
import { CollectedFile } from './collectFiles.js';

// Mirrors client/src/uploadConfig.ts: files above this size go through the
// chunked upload endpoint instead of a single multipart request.
const CHUNK_THRESHOLD = 90 * 1024 * 1024;
const CHUNK_SIZE = 90 * 1024 * 1024;

export interface UploadOptions {
  title?: string;
  senderName?: string;
  password?: string;
  description?: string;
  ttlMinutes?: number;
}

function baseUrl(): string {
  return (process.env.PSHARE_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function commonFields(opts: UploadOptions, batchId: string, relativePath: string): Record<string, string> {
  const fields: Record<string, string> = { batchId, relativePath };
  if (opts.title) fields.title = opts.title;
  if (opts.senderName) fields.uploaderName = opts.senderName;
  if (opts.password) fields.password = opts.password;
  if (opts.description) fields.description = opts.description;
  if (opts.ttlMinutes) fields.ttl = String(opts.ttlMinutes);
  return fields;
}

async function readJsonOrThrow(res: Response, action: string): Promise<any> {
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${action} failed (${res.status}): ${body?.error || res.statusText}`);
  }
  return body;
}

async function uploadDirect(file: CollectedFile, browserId: string, opts: UploadOptions, batchId: string): Promise<void> {
  const form = new FormData();
  const buffer = fs.readFileSync(file.absPath);
  form.append('file', new Blob([buffer]), file.relativePath.split('/').pop());
  for (const [key, value] of Object.entries(commonFields(opts, batchId, file.relativePath))) {
    form.append(key, value);
  }
  const res = await fetch(`${baseUrl()}/api/storage/upload`, {
    method: 'POST',
    headers: { 'x-browser-id': browserId },
    body: form,
  });
  await readJsonOrThrow(res, `Upload of ${file.relativePath}`);
}

async function uploadChunked(file: CollectedFile, browserId: string, opts: UploadOptions, batchId: string): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startRes = await fetch(`${baseUrl()}/api/storage/chunked/start`, {
    method: 'POST',
    headers: { 'x-browser-id': browserId, 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: file.relativePath.split('/').pop(),
      fileSize: file.size,
      totalChunks,
      ...commonFields(opts, batchId, file.relativePath),
    }),
  });
  const { uploadId } = await readJsonOrThrow(startRes, `Chunked upload start for ${file.relativePath}`);

  const fd = fs.openSync(file.absPath, 'r');
  try {
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * CHUNK_SIZE;
      const length = Math.min(CHUNK_SIZE, file.size - offset);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, offset);

      const form = new FormData();
      form.append('chunk', new Blob([buffer]));
      const chunkRes = await fetch(`${baseUrl()}/api/storage/chunked/${uploadId}/${i}`, {
        method: 'POST',
        headers: { 'x-browser-id': browserId },
        body: form,
      });
      await readJsonOrThrow(chunkRes, `Chunk ${i + 1}/${totalChunks} of ${file.relativePath}`);
    }
  } finally {
    fs.closeSync(fd);
  }

  const completeRes = await fetch(`${baseUrl()}/api/storage/chunked/${uploadId}/complete`, {
    method: 'POST',
  });
  await readJsonOrThrow(completeRes, `Finalizing ${file.relativePath}`);
}

export interface ShareResult {
  shareNumber: number;
  fileCount: number;
  link: string;
}

export async function uploadAndShare(files: CollectedFile[], opts: UploadOptions): Promise<ShareResult> {
  const browserId = crypto.randomUUID();
  const batchId = crypto.randomUUID();

  for (const file of files) {
    if (file.size > CHUNK_THRESHOLD) {
      await uploadChunked(file, browserId, opts, batchId);
    } else {
      await uploadDirect(file, browserId, opts, batchId);
    }
  }

  const shareRes = await fetch(`${baseUrl()}/api/storage/batch/${batchId}/share`, {
    method: 'POST',
    headers: { 'x-browser-id': browserId, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const shareBody = await readJsonOrThrow(shareRes, 'Creating share link');

  return {
    shareNumber: shareBody.shareNumber,
    fileCount: shareBody.fileCount,
    link: `${baseUrl()}/?share=${shareBody.shareNumber}`,
  };
}
