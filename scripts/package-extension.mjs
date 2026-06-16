import { createWriteStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const target = process.argv[2] ?? 'chrome';
const sourceDir = join('dist', target);
const output = createWriteStream(`extension-${target}.tar.gz`);
const files = await listFiles(sourceDir);
const chunks = [];

for (const file of files) {
  const name = relative(sourceDir, file);
  const body = await readFile(file);
  chunks.push(`--- ${name} ---\n`);
  chunks.push(body);
  chunks.push('\n');
}

output.end(gzipSync(Buffer.concat(chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))))));

async function listFiles(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}
