// Soften a hard-keyed alpha channel so sprite edges stop aliasing.
//
// Threshold keying produces purely binary alpha — every pixel is 0 or 255 —
// which shows up as jagged stair-stepping once the sprite is drawn at an angle
// or small on screen. Blurring *only* the alpha channel gives back the ~1px
// transition that antialiasing needs.
//
// Must run after bleed-alpha: the blur pulls previously-invisible pixels into
// view, so their RGB has to already hold plate colour rather than backdrop.
//
// Usage: node scripts/feather-alpha.mjs <file.png> [sigma]

import sharp from 'sharp';

const file = process.argv[2];
const SIGMA = Number(process.argv[3] ?? 0.8);

if (!file) {
  console.error('usage: node scripts/feather-alpha.mjs <file.png> [sigma]');
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const px = W * H;

const softBefore = countSoft(data, C, px);

// Pull the alpha channel out on its own, blur it, put it back
const alpha = Buffer.alloc(px);
for (let i = 0; i < px; i++) alpha[i] = data[i * C + 3];

// toColourspace('b-w') is required: blur() on a 1-channel raw buffer returns
// THREE channels, and indexing it as if it were one silently walks the rows
// out of alignment — which shows up as horizontal banding, not as an error.
const blurred = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
  .blur(SIGMA)
  .toColourspace('b-w')
  .raw()
  .toBuffer({ resolveWithObject: true });

if (blurred.info.channels !== 1 || blurred.data.length !== px) {
  throw new Error(
    `expected ${px} bytes in 1 channel, got ${blurred.data.length} in ${blurred.info.channels}`,
  );
}

for (let i = 0; i < px; i++) data[i * C + 3] = blurred.data[i];

await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(file);

const softAfter = countSoft(data, C, px);
console.log(
  `${file}  sigma ${SIGMA}  soft-edge ${((softBefore / px) * 100).toFixed(2)}% ` +
    `-> ${((softAfter / px) * 100).toFixed(2)}%`,
);

function countSoft(buf, channels, count) {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const a = buf[i * channels + 3];
    if (a > 8 && a < 248) n++;
  }
  return n;
}
