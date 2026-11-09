// Generate an ornate nameplate frame with Gemini, then key out the background.
//
// Gemini returns opaque images, so the prompt asks for a flat magenta backdrop
// (#FF00FF never occurs in a gold/emerald plaque) which we turn transparent
// afterwards. Without that step the plaque shows up as a solid rectangle in
// the 3D scene.
//
// Usage: node scripts/gen-nameplate.mjs

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import sharp from 'sharp';

const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = path.join(process.cwd(), 'public', 'ui');
const OUT = () => path.join(OUT_DIR, `nameplate-${VARIANT}.png`);

const BACKDROP = `The entire background must be flat pure magenta #FF00FF, completely uniform,
with no gradient, no vignette and no shadow touching it.`;

const VARIANTS = {
  royal: `A single ornate fantasy game UI nameplate banner, centred, viewed straight on.
Horizontal plaque roughly 3:1 wide. A polished dark emerald-green stone panel in the
middle with a smooth empty centre and no text or letters anywhere.
Around it a symmetrical golden filigree frame with laurel leaves sweeping out to the
left and right, and small faceted green gemstones set at the top centre and at both ends.
Clean vector game-art style, crisp edges, soft inner glow, no drop shadow. ${BACKDROP}`,

  neon: `A single futuristic neon nightclub UI nameplate, centred, viewed straight on.
Horizontal plate roughly 3.5:1 wide. A smooth dark glossy charcoal panel in the middle,
completely empty with no text or letters anywhere.
Framed by a thin glowing cyan and warm amber neon tube outline with clipped corners,
small glowing nodes at both ends, and a faint light bloom around the tubes.
Use no pink, magenta or violet anywhere in the artwork.
Sleek minimal synthwave style, crisp edges, no drop shadow. ${BACKDROP}`,

  chrome: `A single sleek modern game UI nameplate, centred, viewed straight on.
Horizontal plate roughly 3.5:1 wide. A smooth matte black glass panel in the middle,
completely empty with no text or letters anywhere.
Framed by a slim brushed-gold metal bezel with angular cut corners and two thin
amber accent lines running along the top and bottom edges.
Premium minimal style, crisp edges, subtle specular highlight, no drop shadow. ${BACKDROP}`,
};

const VARIANT = process.argv[2] ?? 'royal';
const PROMPT = VARIANTS[VARIANT];
if (!PROMPT) {
  console.error(`unknown variant "${VARIANT}" — pick one of: ${Object.keys(VARIANTS).join(', ')}`);
  process.exit(1);
}

function readKey() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env not found');
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('GEMINI_API_KEY='));
  if (!line) throw new Error('GEMINI_API_KEY not found in .env');
  return line.slice('GEMINI_API_KEY='.length).trim();
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const key = readKey();
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

console.log(`requesting ${MODEL} ...`);
const res = await post(url, { contents: [{ parts: [{ text: PROMPT }] }] });

if (res.status !== 200) {
  console.error(`HTTP ${res.status}`);
  console.error(res.body.slice(0, 600));
  process.exit(1);
}

const json = JSON.parse(res.body);
const parts = json.candidates?.[0]?.content?.parts ?? [];
const img = parts.find((p) => p.inlineData?.data);

if (!img) {
  console.error('no image in response:');
  console.error(JSON.stringify(json).slice(0, 600));
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const raw = Buffer.from(img.inlineData.data, 'base64');

// --- key out the magenta backdrop ------------------------------------------
const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = info.width * info.height;
let cleared = 0;

for (let i = 0; i < px; i++) {
  const o = i * info.channels;
  const r = data[o];
  const g = data[o + 1];
  const b = data[o + 2];
  // Magenta is high red + high blue + low green; the plaque's gold and green
  // never satisfy all three at once.
  if (r > 140 && b > 140 && g < 110) {
    data[o + 3] = 0;
    cleared++;
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png()
  .toFile(OUT());

console.log(
  `saved ${OUT()}  ${info.width}x${info.height}  ` +
    `${((cleared / px) * 100).toFixed(1)}% keyed transparent`,
);
