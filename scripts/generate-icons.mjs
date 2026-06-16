import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const toolbarSource = 'assets/brand/icons/authenticator-2fa-icon.svg';
const storeSource = 'assets/brand/icons/authenticator-2fa-white.png';
const outputDir = 'assets/extension/icons';
const storeOutputDir = 'assets/store/icons';
const sizes = [16, 24, 32, 48, 128];

await mkdir(outputDir, { recursive: true });
await mkdir(storeOutputDir, { recursive: true });

for (const size of sizes) {
  await sharp(toolbarSource, { density: 512 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${outputDir}/icon${size}.png`);
}

await sharp(storeSource).resize(128, 128).png().toFile(`${storeOutputDir}/store-icon128.png`);
await sharp(storeSource).resize(300, 300).png().toFile(`${storeOutputDir}/store-icon300.png`);

console.log(
  `Generated ${sizes.length} extension icons in ${outputDir} and store icons in ${storeOutputDir}`
);
