import { rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await rm('artifacts', { recursive: true, force: true });
await rm('extension.zip', { force: true });
await rm('.tmp', { recursive: true, force: true });
