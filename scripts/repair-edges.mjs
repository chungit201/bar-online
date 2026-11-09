// Recolour a feathered alpha edge from the solid interior only.
//
// Feathering widens the visible band to include pixels that were previously
// hidden. If the chroma key left any backdrop colour sitting in those pixels,
// softening the alpha drags it into view as a coloured rim.
//
// Fix: for every partially transparent pixel, throw away its RGB and rebuild
// it from nearby *fully opaque* neighbours. Contaminated pixels can't feed
// each other because only solid pixels are ever read.
//
// Usage: node scripts/repair-edges.mjs <file.png> [radius]

import sharp from 'sharp';

const file = process.argv[2];
const R = Number(process.argv[3] ?? 3);

if (!file) {
  console.error('usage: node scripts/repair-edges.mjs <file.png> [radius]');
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const SOLID = 248;
const isSoft = (a) => a > 8 && a < SOLID;

// Snapshot so the sweep never reads a pixel it has already rewritten
const src = Buffer.from(data);
let repaired = 0;
let orphaned = 0;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * C;
    if (!isSoft(src[o + 3])) continue;

    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const p = (ny * W + nx) * C;
        if (src[p + 3] < SOLID) continue;
        // Weight nearer neighbours more so thin features keep their colour
        const wgt = 1 / (1 + dx * dx + dy * dy);
        r += src[p] * wgt;
        g += src[p + 1] * wgt;
        b += src[p + 2] * wgt;
        n += wgt;
      }
    }

    if (n === 0) {
      orphaned++;
      continue;
    }
    data[o] = Math.round(r / n);
    data[o + 1] = Math.round(g / n);
    data[o + 2] = Math.round(b / n);
    repaired++;
  }
}

await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(file);
console.log(
  `${file}  repaired ${repaired} edge px` +
    (orphaned ? `, ${orphaned} had no solid neighbour within ${R}px` : ''),
);
