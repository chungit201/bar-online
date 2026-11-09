// Post-process a generated plate: key out the backdrop, bleed the edges, crop.
//
// The backdrop colour is *sampled from the corners* rather than hard-coded.
// Image models never return the exact hex you asked for — a request for pure
// #FF00FF came back as roughly (194,40,126) — so a fixed threshold silently
// misses most of the background.
//
// Usage: node scripts/key-backdrop.mjs <file.png> [tolerance]

import sharp from 'sharp';
import { bleedAlpha } from './bleed-alpha.mjs';

const file = process.argv[2];
const TOL = Number(process.argv[3] ?? 70);

if (!file) {
  console.error('usage: node scripts/key-backdrop.mjs <file.png> [tolerance]');
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const at = (x, y) => {
  const o = (y * W + x) * C;
  return [data[o], data[o + 1], data[o + 2]];
};

// Median of the four corners resists one corner happening to hold artwork
const corners = [at(4, 4), at(W - 5, 4), at(4, H - 5), at(W - 5, H - 5)];
const key = [0, 1, 2].map((i) => {
  const vals = corners.map((c) => c[i]).sort((a, b) => a - b);
  return (vals[1] + vals[2]) / 2;
});
console.log(`backdrop sampled as rgb(${key.map((v) => v.toFixed(0)).join(', ')})`);

let cleared = 0;
for (let i = 0; i < W * H; i++) {
  const o = i * C;
  const d = Math.hypot(data[o] - key[0], data[o + 1] - key[1], data[o + 2] - key[2]);
  if (d < TOL) {
    data[o + 3] = 0;
    cleared++;
  }
}
console.log(`keyed ${((cleared / (W * H)) * 100).toFixed(1)}% transparent (tolerance ${TOL})`);

await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(file);

// Bleed before cropping so edge pixels have real neighbours to sample
await bleedAlpha(file, 8);

// --- crop to the artwork, ignoring stray specks ----------------------------
const second = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const col = new Int32Array(W);
const row = new Int32Array(H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (second.data[(y * W + x) * C + 3] > 128) {
      col[x]++;
      row[y]++;
    }
  }
}
// Require a run of real pixels so a few survivors don't widen the crop
const MIN = 12;
const first = (arr) => arr.findIndex((v) => v >= MIN);
const last = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] >= MIN) return i;
  return -1;
};

const x0 = Math.max(0, first(col) - 4);
const x1 = Math.min(W - 1, last(col) + 4);
const y0 = Math.max(0, first(row) - 4);
const y1 = Math.min(H - 1, last(row) + 4);
const cw = x1 - x0 + 1;
const ch = y1 - y0 + 1;

const cropped = await sharp(file).extract({ left: x0, top: y0, width: cw, height: ch }).png().toBuffer();
await sharp(cropped).toFile(file);

console.log(`cropped to ${cw}x${ch}  aspect ${(cw / ch).toFixed(4)}`);
