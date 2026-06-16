import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const toolbarSource = 'assets/icons/authenticator-2fa-icon.svg';
const storeSource = 'assets/icons/authenticator-2fa-white.png';
const outputDir = 'public/icons';
const sizes = [16, 24, 32, 48, 128];

await mkdir(outputDir, { recursive: true });

for (const size of sizes) {
  await sharp(toolbarSource, { density: 512 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${outputDir}/icon${size}.png`);
}

await sharp(storeSource).resize(128, 128).png().toFile(`${outputDir}/store-icon128.png`);

console.log(`Generated ${sizes.length} extension icons and 1 store icon in ${outputDir}`);
