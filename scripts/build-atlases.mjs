// Pack each clip's PNG frames into a single atlas image.
//
// Why: one texture per clip instead of one per frame turns 650 texture binds
// into 33, and lets every dancer sharing a clip be drawn by a single
// InstancedMesh. The frame a given instance shows is picked in the shader by
// offsetting UVs into this grid.
//
// The grid layout is derived (not stored) so the renderer can compute the same
// cols/rows from the frame count alone — see atlasGrid() in dances.ts.
//
// Usage: node scripts/build-atlases.mjs

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public', 'characters');

function atlasGrid(frames) {
  const cols = Math.ceil(Math.sqrt(frames));
  const rows = Math.ceil(frames / cols);
  return { cols, rows };
}

const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'NpcAvatars')
  .map((d) => d.name)
  .sort();

let totalBefore = 0;
let totalAfter = 0;

for (const id of dirs) {
  const dir = path.join(ROOT, id);
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.png$/.test(f))
    .sort();

  if (files.length === 0) continue;

  const meta = await sharp(path.join(dir, files[0])).metadata();
  const fw = meta.width;
  const fh = meta.height;
  const { cols, rows } = atlasGrid(files.length);

  const composite = files.map((f, i) => ({
    input: path.join(dir, f),
    left: (i % cols) * fw,
    top: Math.floor(i / cols) * fh,
  }));

  const outPath = path.join(dir, 'atlas.png');
  await sharp({
    create: {
      width: cols * fw,
      height: rows * fh,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const before = files.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
  const after = fs.statSync(outPath).size;
  totalBefore += before;
  totalAfter += after;

  console.log(
    `  ${id.padEnd(22)} ${String(files.length).padStart(3)} frames  ` +
      `${cols}x${rows} grid  ${cols * fw}x${rows * fh}px  ` +
      `${(after / 1024).toFixed(0)}KB`,
  );
}

console.log(
  `\n${dirs.length} atlases · frames ${(totalBefore / 1048576).toFixed(1)}MB ` +
    `→ atlases ${(totalAfter / 1048576).toFixed(1)}MB`,
);
