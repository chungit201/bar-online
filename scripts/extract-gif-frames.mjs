// Extract animated GIFs into numbered PNG frames under public/characters/<id>/.
//
// Decoding happens once here rather than in the browser, so the game only ever
// loads flat PNGs. sharp reads the GIF in "animated" mode, which composites
// each frame against the previous one — partial-update frames and GIF disposal
// methods are handled for us, which a naive per-page read would get wrong.
//
// Usage: node scripts/extract-gif-frames.mjs [--force]

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const REPO = 'cherry9001/tiktok-live-bar';
const DIR = 'TikTokBridge/assets/gifs';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/${DIR}/`;
const OUT_ROOT = path.join(process.cwd(), 'public', 'characters');
const FORCE = process.argv.includes('--force');

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`${res.statusCode} ${url}`));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function listGifNames() {
  const body = await get(`https://api.github.com/repos/${REPO}/contents/${DIR}`);
  return JSON.parse(body.toString())
    .filter((e) => e.name.endsWith('.gif'))
    .map((e) => e.name.replace(/\.gif$/, ''));
}

async function extract(name) {
  const outDir = path.join(OUT_ROOT, name);
  // A directory alone isn't proof of success — a run that died mid-extract
  // leaves the folder behind with a frame or two in it. Require a real
  // sequence before trusting it.
  const existing = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).length
    : 0;
  if (!FORCE && existing > 1) return { name, skipped: true, frames: existing };
  if (existing > 0) fs.rmSync(outDir, { recursive: true, force: true });

  const buf = await get(`${RAW}${encodeURIComponent(name)}.gif`);
  const meta = await sharp(buf, { animated: true }).metadata();

  const frames = meta.pages ?? 1;
  const width = meta.width;
  const frameH = meta.pageHeight ?? meta.height;

  // In animated mode sharp returns one tall image with the frames stacked
  // vertically. .extract() can't address that (it's clamped to a single page),
  // so slice the raw pixel rows ourselves instead.
  const { data, info } = await sharp(buf, { animated: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowBytes = info.width * info.channels;
  const frameBytes = rowBytes * frameH;

  fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < frames; i++) {
    const slice = data.subarray(i * frameBytes, (i + 1) * frameBytes);
    await sharp(slice, {
      raw: { width: info.width, height: frameH, channels: info.channels },
    })
      .png()
      .toFile(path.join(outDir, `${String(i).padStart(3, '0')}.png`));
  }

  // GIF stores a per-frame delay in ms; average it into a usable fps
  const delays = (meta.delay ?? []).filter((d) => d > 0);
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 100;
  const fps = Math.max(5, Math.min(24, Math.round(1000 / avg)));

  return { name, frames, width, height: frameH, fps };
}

const names = await listGifNames();
console.log(`${names.length} GIFs in repo\n`);

const results = [];
for (const name of names) {
  try {
    const r = await extract(name);
    results.push(r);
    console.log(
      r.skipped
        ? `  skip  ${name} (already extracted)`
        : `  ok    ${name}  ${r.frames} frames  ${r.width}x${r.height}  ~${r.fps}fps`,
    );
  } catch (e) {
    console.error(`  FAIL  ${name}: ${e.message}`);
  }
}

// Emit a ready-to-paste clip table
const fresh = results.filter((r) => !r.skipped);
if (fresh.length) {
  console.log('\n--- DANCE_CLIPS entries ---');
  for (const r of fresh) {
    console.log(
      `  { id: '${r.name}', frames: ${r.frames}, width: ${r.width}, height: ${r.height}, fps: ${r.fps} },`,
    );
  }
}
