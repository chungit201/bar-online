// Measure where the character actually sits inside each clip's PNG canvas.
//
// The sprites come from a grab-bag of GIFs with wildly different amounts of
// transparent padding. Sizing the plane by the canvas height therefore makes
// the *canvas* 1.7 units tall, not the character — so a tightly cropped dancer
// towers over a loosely cropped one standing right next to them.
//
// This prints a `trim` box per clip, as fractions of the canvas, measured as
// the union of the opaque pixels across every frame (the union, so a dancer
// who throws their arms up mid-loop doesn't make the sprite pulse in size).
//
// Usage: node scripts/measure-sprite-trim.mjs
// Paste the output into DANCE_CLIPS in src/components/avatar/dances.ts.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public', 'characters');
// Matches the sprite material's alphaTest: anything below this is never drawn,
// so it must not count toward the bounds either.
const ALPHA_CUTOFF = Math.round(0.25 * 255);

async function frameBounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] <= ALPHA_CUTOFF) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  return bottom < 0 ? null : { top, bottom, left, right, width, height };
}

const round = (n) => Math.round(n * 1000) / 1000;

const clips = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const id of clips) {
  const dir = path.join(ROOT, id);
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));

  if (!files.length) continue;

  let box = null;
  for (const file of files) {
    const b = await frameBounds(file);
    if (!b) continue;
    box = box
      ? {
          ...b,
          top: Math.min(box.top, b.top),
          bottom: Math.max(box.bottom, b.bottom),
          left: Math.min(box.left, b.left),
          right: Math.max(box.right, b.right),
        }
      : b;
  }
  if (!box) continue;

  // +1 because the bounds are inclusive pixel indices
  const trim = {
    top: round(box.top / box.height),
    bottom: round((box.bottom + 1) / box.height),
    left: round(box.left / box.width),
    right: round((box.right + 1) / box.width),
  };
  const fill = round(trim.bottom - trim.top);
  console.log(
    `${id.padEnd(22)} fill=${String(fill).padEnd(6)} ` +
      `trim: { top: ${trim.top}, bottom: ${trim.bottom}, left: ${trim.left}, right: ${trim.right} },`,
  );
}
