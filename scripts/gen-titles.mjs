// Generate title banners ("Đại Bàng", "Chủ Tịch", ...) shown above a gifter's name.
//
// Gemini draws the empty ornate frame; the Vietnamese title is typeset here with
// sharp, because image models mangle diacritics. Each frame asks for a flat
// backdrop that key-backdrop.mjs then samples and keys out.
//
// Usage: node scripts/gen-titles.mjs [slug ...]   (no args = every title)

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import sharp from 'sharp';
import { bleedAlpha } from './bleed-alpha.mjs';

const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = path.join(process.cwd(), 'public', 'ui', 'titles');

const MAGENTA = 'flat pure magenta #FF00FF';
const GREEN = 'flat pure green #00FF00';
const backdrop = (c) =>
  `The entire background must be ${c}, completely uniform, with no gradient, no vignette and no shadow touching it.`;

const BASE = `A single ornate fantasy mobile-game title banner, centred, viewed straight on.
Horizontal plaque roughly 3:1 wide. The centre panel is smooth and completely empty,
with no text, letters, numbers or symbols anywhere on it.
Clean polished game-art style, crisp edges, soft inner glow, no drop shadow.`;

const TITLES = [
  {
    slug: 'dai-bang',
    name: 'Đại Bàng',
    text: '#fff6dc',
    bg: MAGENTA,
    style: `A polished dark emerald-green marble panel. Around it a symmetrical golden
filigree frame with laurel leaves sweeping out left and right, and faceted green
emerald gemstones at the top centre, bottom centre and both ends.`,
  },
  {
    slug: 'ong-chua',
    name: 'Ông Chúa',
    text: '#ffe9a8',
    bg: GREEN,
    style: `A deep royal purple velvet panel. A heavy gold frame with a jewelled golden
crown rising from the top centre, small rubies along the border and curled gold
scrollwork at both ends.`,
  },
  {
    slug: 'chu-bao-ve',
    name: 'Chú Bảo Vệ',
    text: '#e8f3ff',
    bg: MAGENTA,
    style: `A dark navy-blue brushed steel panel. A thick silver metal frame with rivets,
a golden five-point security star badge at the top centre and angular armour-plate
wings at both ends.`,
  },
  {
    slug: 'chu-tich',
    name: 'Chủ Tịch',
    text: '#fff3c4',
    bg: GREEN,
    style: `The grandest, most luxurious tier. A glossy crimson-red lacquer panel. A massive
radiant gold frame with a large diamond-studded imperial crown at the top centre,
golden dragon wings spreading wide on both sides, sparkling white diamonds along the
border and golden light rays behind the crown.`,
  },
  {
    slug: 'pho-chu-tich-1',
    name: 'Phó Chủ Tịch',
    text: '#eaf4ff',
    bg: MAGENTA,
    style: `A rich sapphire-blue crystal panel. An ornate gold and silver frame with a
smaller golden crown at the top centre, golden eagle wings at both ends and blue
sapphire gemstones set along the border.`,
  },
  {
    slug: 'pho-chu-tich-2',
    name: 'Phó Chủ Tịch',
    text: '#f0e6ff',
    bg: GREEN,
    style: `A rich royal-violet amethyst crystal panel. An ornate rose-gold and silver frame
with a smaller silver crown at the top centre, silver phoenix wings at both ends and
violet amethyst gemstones set along the border.`,
  },
  {
    slug: 'dai-gia',
    name: 'Đại Gia',
    text: '#fff3c4',
    bg: MAGENTA,
    style: `A glossy black onyx panel. A thick shiny solid-gold frame with stacked gold coins
and gold bars at both ends and a large gold dollar-sign medallion at the top centre.`,
  },
  {
    slug: 'thieu-gia',
    name: 'Thiếu Gia',
    text: '#e6f6ff',
    bg: MAGENTA,
    style: `A sleek midnight-blue leather panel. A slim polished silver frame with a silver
bow-tie emblem at the top centre and small silver diamond studs at both ends.`,
  },
  {
    slug: 'tieu-thu',
    name: 'Tiểu Thư',
    // Pale panel, so dark lettering on a light outline
    textTop: '#b0306a',
    text: '#6e1240',
    stroke: '#ffffff',
    bg: GREEN,
    style: `A soft pastel-pink satin panel. A delicate rose-gold frame with white pearls along
the border, a pink silk bow at the top centre and small pink roses at both ends.`,
  },
  {
    slug: 'nu-hoang',
    name: 'Nữ Hoàng',
    text: '#fff0f6',
    bg: GREEN,
    style: `A deep magenta-pink velvet panel. An elegant gold frame with a tall slender
jewelled tiara at the top centre, pink diamonds along the border and gold swirls at
both ends.`,
  },
  {
    slug: 'hoang-tu',
    name: 'Hoàng Tử',
    // Oval panel: the scan finds the inscribed box, which reads small
    textScale: 1.4,
    text: '#e8f1ff',
    bg: MAGENTA,
    style: `A royal cobalt-blue velvet panel. A gold frame with a small gold prince crown at
the top centre and crossed silver swords behind both ends.`,
  },
  {
    slug: 'cong-chua',
    name: 'Công Chúa',
    textTop: '#8a3fb8',
    text: '#4a1670',
    stroke: '#ffffff',
    bg: GREEN,
    style: `A lilac lavender panel with faint sparkles. A white-gold frame with a small
diamond princess tiara at the top centre and pastel butterfly wings at both ends.`,
  },
  {
    slug: 'trum-bar',
    name: 'Trùm Bar',
    text: '#fff6dc',
    bg: MAGENTA,
    style: `A dark smoky charcoal panel. A heavy gold frame with a golden cocktail glass at
the top centre and two golden champagne bottles at both ends.`,
  },
  {
    slug: 'dan-choi',
    name: 'Dân Chơi',
    text: '#e9fbff',
    bg: MAGENTA,
    style: `A glossy black panel. A chrome frame lit by glowing cyan and orange neon edges,
a mirrored disco ball at the top centre and small sunglasses emblems at both ends.`,
  },
  {
    slug: 'vua-nhay',
    name: 'Vua Nhảy',
    text: '#fff6dc',
    bg: MAGENTA,
    style: `A deep blue panel with a faint music equaliser pattern. A gold frame with a gold
crown wearing headphones at the top centre and golden music notes at both ends.`,
  },
  {
    slug: 'than-tai',
    name: 'Thần Tài',
    text: '#fff3c4',
    bg: GREEN,
    style: `A lucky crimson-red lacquer panel. A gold frame in Asian style with a gold ingot
at the top centre, red-and-gold lucky coins with square holes at both ends and small
gold clouds along the border.`,
  },
  {
    slug: 'dai-ca',
    name: 'Đại Ca',
    text: '#fff6dc',
    bg: MAGENTA,
    style: `A dark brushed gunmetal panel. A bold dark-gold frame with a fierce golden tiger
head at the top centre and heavy gold chain links at both ends.`,
  },
  {
    slug: 'chien-than',
    name: 'Chiến Thần',
    text: '#fff3c4',
    bg: GREEN,
    style: `A dark crimson battle-worn steel panel. A bronze and gold frame with a spartan
war helmet at the top centre, crossed golden spears behind it and flames at both ends.`,
  },
  {
    slug: 'sat-thu-tim',
    name: 'Sát Thủ Tim',
    text: '#fff0f6',
    bg: GREEN,
    style: `A deep ruby-red panel. A rose-gold frame with a large glossy red heart pierced by
a golden arrow at the top centre and small red hearts at both ends.`,
  },
  {
    slug: 'cao-thu',
    name: 'Cao Thủ',
    text: '#eafff4',
    bg: MAGENTA,
    style: `A dark jade-green panel. A gold frame in martial-arts style with a golden dragon
coiled at the top centre and gold cloud scrolls at both ends.`,
  },
  {
    slug: 'ba-chu',
    name: 'Bá Chủ',
    text: '#fff6dc',
    bg: MAGENTA,
    style: `A dark obsidian panel with faint gold veins. A massive angular black-and-gold
frame with sharp spikes, a gold horned crown at the top centre and dark wings at both ends.`,
  },
  {
    slug: 'hiep-si',
    name: 'Hiệp Sĩ',
    text: '#eef4ff',
    bg: MAGENTA,
    style: `A steel-blue panel. A polished silver plate-armour frame with a knight helmet and
blue plume at the top centre and silver kite shields at both ends.`,
  },
  {
    slug: 'thanh-quay',
    name: 'Thánh Quẩy',
    textScale: 1.3,
    text: '#fffbe6',
    bg: MAGENTA,
    style: `A vivid electric-blue panel with confetti sparkles. A shiny gold frame with a
golden halo and glowing light burst at the top centre and party poppers with golden
streamers at both ends.`,
  },
];

function readKey() {
  const text = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const m = text.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m);
  if (!m) throw new Error('GEMINI_API_KEY not found in .env');
  return m[1].replace(/^["']|["']$/g, '');
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
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Key out the backdrop by flood-filling from the border. A global colour match
 * (key-backdrop.mjs) also punched holes in panels whose shading drifted near
 * the backdrop colour; only pixels connected to the edge are background.
 */
async function keyAndCrop(rawFile, outFile, bg) {
  const { data, info } = await sharp(rawFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => (y * W + x) * 4;
  // Judged by hue dominance rather than distance to one sampled colour: the
  // model paints the "flat" backdrop as a vignetted gradient, so a fixed key
  // either misses the light centre or eats into dark panels.
  const near =
    bg === GREEN
      ? (o) => data[o + 1] > data[o] + 12 && data[o + 1] > data[o + 2] + 12
      : (o) => data[o] > data[o + 1] + 40 && data[o + 2] > data[o + 1] + 40;

  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) stack.push(0, y, W - 1, y);
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue;
    seen[y * W + x] = 1;
    const o = px(x, y);
    if (!near(o)) continue;
    data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // Anti-aliased edge pixels are a blend of artwork and backdrop, too weakly
  // tinted for `near` but still a visible coloured halo. Peel them off the
  // silhouette with a looser spill test, a couple of pixels deep.
  const spill =
    bg === GREEN
      ? (o) => data[o + 1] > Math.max(data[o], data[o + 2]) + 4
      : (o) => (data[o] + data[o + 2]) / 2 > data[o + 1] + 25;
  for (let pass = 0; pass < 3; pass++) {
    const peel = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const o = px(x, y);
        if (data[o + 3] === 0 || !spill(o)) continue;
        if ([px(x + 1, y), px(x - 1, y), px(x, y + 1), px(x, y - 1)].some((n) => data[n + 3] === 0)) peel.push(o);
      }
    for (const o of peel) data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
  }

  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .trim({ threshold: 0 })
    .toFile(outFile);
  await bleedAlpha(outFile, 8);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Find the empty centre panel: grow a region from the image centre through
 * pixels that shade smoothly into each other. The gold frame is a hard colour
 * break, so growth stops there. Crowns and wings make the panel sit off the
 * image centre, which is why the image centre itself can't be used.
 */
async function findPanel(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x, y) => (y * W + x) * 4;
  const diff = (a, b) =>
    Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);

  // Walk from (x, y) in direction (dx, dy) until a sharp colour break or
  // transparency — the inner edge of the frame.
  const walk = (x, y, dx, dy) => {
    const step = 3;
    let px = x;
    let py = y;
    for (;;) {
      const nx = px + dx * step;
      const ny = py + dy * step;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return px;
      const a = at(px, py);
      const b = at(nx, ny);
      if (data[b + 3] < 200 || diff(a, b) > 70) return dx ? px : py;
      px = nx;
      py = ny;
    }
  };
  const median = (v) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];

  // Several parallel scan lines, then the median, so one sparkle or a gem
  // sitting on a single line can't move the result
  const cx0 = Math.floor(W / 2);
  const cy0 = Math.floor(H / 2);
  const rows = [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12].map((f) => Math.floor(cy0 + f * H));
  const cols = [-0.2, -0.13, -0.07, 0, 0.07, 0.13, 0.2].map((f) => Math.floor(cx0 + f * W));
  const left = median(rows.map((y) => walk(cx0, y, -1, 0)));
  const right = median(rows.map((y) => walk(cx0, y, 1, 0)));
  const top = median(cols.map((x) => walk(x, cy0, 0, -1)));
  const bottom = median(cols.map((x) => walk(x, cy0, 0, 1)));

  return { cx: (left + right) / 2, cy: (top + bottom) / 2, w: right - left, h: bottom - top };
}

/** Render the title on its own, cropped tight to the actual glyphs */
async function renderName(t, size) {
  const pad = size;
  const cw = Math.ceil(size * t.name.length * 0.75 + pad * 2);
  const ch = Math.ceil(size * 2 + pad * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.textTop ?? '#ffffff'}"/>
      <stop offset="1" stop-color="${t.text}"/>
    </linearGradient>
  </defs>
  <text x="${cw / 2}" y="${ch / 2 + size * 0.35}" text-anchor="middle"
    font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="${size}"
    fill="url(#g)" stroke="${t.stroke ?? '#1a0f00'}" stroke-width="${Math.max(2, size * 0.07)}"
    paint-order="stroke" letter-spacing="1">${esc(t.name)}</text>
</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).png().trim({ threshold: 0 }).toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height };
}

/** Typeset the title in the middle of the panel, sized to fit inside it */
async function stampName(file, t) {
  const panel = await findPanel(file);
  // Measure once, then scale so the glyphs fill ~78% of the width or ~40% of the height
  const probe = await renderName(t, 100);
  const scale = Math.min((panel.w * 0.78) / probe.w, (panel.h * 0.4) / probe.h) * (t.textScale ?? 1);
  const label = await renderName(t, Math.round(100 * scale));
  const left = Math.round(panel.cx - label.w / 2);
  const top = Math.round(panel.cy - label.h / 2);
  const out = await sharp(file).composite([{ input: label.buf, left, top }]).png().toBuffer();
  fs.writeFileSync(file, out);
  return { panel, left, top, w: label.w, h: label.h };
}

const key = readKey();
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
const args = process.argv.slice(2);
// --restamp re-keys and re-letters the saved raw frames without calling Gemini
const restamp = args.includes('--restamp');
const wanted = args.filter((a) => !a.startsWith('--'));
const list = wanted.length ? TITLES.filter((t) => wanted.includes(t.slug)) : TITLES;
const RAW_DIR = path.join(process.cwd(), 'scripts', '.titles-raw');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

for (const t of list) {
  const raw = path.join(RAW_DIR, `${t.slug}.png`);
  const file = path.join(OUT_DIR, `${t.slug}.png`);
  if (restamp) {
    await keyAndCrop(raw, file, t.bg);
    const r = await stampName(file, t);
    if (process.env.DEBUG) console.log(t.slug, JSON.stringify(r.panel));
    console.log(`restamped ${file}`);
    continue;
  }
  const prompt = `${BASE}\n${t.style}\n${backdrop(t.bg)}`;
  process.stdout.write(`${t.slug}: requesting ... `);
  const res = await post(url, { contents: [{ parts: [{ text: prompt }] }] });
  if (res.status !== 200) {
    console.log(`HTTP ${res.status} ${res.body.slice(0, 300)}`);
    continue;
  }
  const img = JSON.parse(res.body).candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) {
    console.log('no image in response');
    continue;
  }
  fs.writeFileSync(raw, Buffer.from(img.inlineData.data, 'base64'));
  await keyAndCrop(raw, file, t.bg);
  await stampName(file, t);
  console.log(`saved ${file}`);
}
