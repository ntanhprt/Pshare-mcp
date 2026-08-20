import fs from 'node:fs';
import path from 'node:path';

export interface CollectedFile {
  absPath: string;
  /** Name shown in Pshare — bare filename for a solo file, `folderName/sub/path` for files inside a folder. */
  relativePath: string;
  size: number;
}

function walkDir(dir: string, folderName: string, baseDir: string, out: CollectedFile[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(abs, folderName, baseDir, out);
    } else if (entry.isFile()) {
      const relFromBase = path.relative(baseDir, abs).split(path.sep).join('/');
      out.push({ absPath: abs, relativePath: `${folderName}/${relFromBase}`, size: fs.statSync(abs).size });
    }
  }
}

/** Resolves a mix of file and folder paths into a flat list of files ready to upload. */
export function collectFiles(inputPaths: string[]): CollectedFile[] {
  const out: CollectedFile[] = [];
  for (const rawPath of inputPaths) {
    const absPath = path.resolve(rawPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Path not found: ${rawPath}`);
    }
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      walkDir(absPath, path.basename(absPath), absPath, out);
    } else if (stat.isFile()) {
      out.push({ absPath, relativePath: path.basename(absPath), size: stat.size });
    }
  }
  if (out.length === 0) {
    throw new Error('No files found in the given paths');
  }
  return out;
}
