// Bleed opaque colour outward into fully transparent pixels.
//
// Chroma-keying leaves the backdrop colour sitting in the RGB channels of
// pixels whose alpha is now 0. Bilinear filtering and mipmapping ignore alpha
// when averaging, so that hidden colour bleeds back out as a coloured halo
// around the sprite. Dilating the edge colour outwards kills the halo.
//
// Usage: node scripts/bleed-alpha.mjs <file.png> [iterations]

import sharp from 'sharp';

export async function bleedAlpha(file, iterations = 6) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const known = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) known[i] = data[i * channels + 3] > 0 ? 1 : 0;

  for (let pass = 0; pass < iterations; pass++) {
    const added = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (known[i]) continue;

        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = ny * width + nx;
            if (!known[j]) continue;
            const o = j * channels;
            r += data[o];
            g += data[o + 1];
            b += data[o + 2];
            n++;
          }
        }
        if (n === 0) continue;
        added.push([i, (r / n) | 0, (g / n) | 0, (b / n) | 0]);
      }
    }

    if (added.length === 0) break;
    // Applied after the sweep so a pass never reads its own output
    for (const [i, r, g, b] of added) {
      const o = i * channels;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      known[i] = 1;
    }
  }

  await sharp(data, { raw: { width, height, channels } }).png().toFile(file);
  return { width, height };
}

if (process.argv[1]?.endsWith('bleed-alpha.mjs')) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/bleed-alpha.mjs <file.png> [iterations]');
    process.exit(1);
  }
  const iters = Number(process.argv[3] ?? 6);
  const r = await bleedAlpha(file, iters);
  console.log(`bled ${file} (${r.width}x${r.height}, ${iters} passes)`);
}
