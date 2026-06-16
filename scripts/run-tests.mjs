import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

await writeFile('.tmp/test/package.json', '{"type":"commonjs"}\n');

for (const file of ['.tmp/test/test/auth/otp.test.js']) {
  await run(file);
}

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], {
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${file} failed with exit code ${code ?? 1}`));
      }
    });
  });
}
