#!/usr/bin/env node
// Renders the studio product images for the CardPop Magnetic Metal Slab Case
// (35pt, one shop product per colour — SKU family CP-METAL-SLAB-35PT).
//
//   node scripts/render-metal-slab-images.mjs
//
// Writes public/images/shop/metal-slab-case/<colour>/<sku>_<view>.jpg (served by
// Vercel from cardpop.com.au/images/…) plus one shared colour line-up. The
// views are CSS/3D studio renders drawn in headless Chromium, so they can be
// regenerated in any colour without a photo shoot. The graded slab shown inside
// is a generic display sample (no grading-company branding) and is labelled as
// not included. Swap in real photographs once stock lands by uploading them in
// Admin → Products.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export const METAL_SLAB_COLOURS = [
  { name: 'Black',  code: 'BLK', hex: '#1C1D20' },
  { name: 'Silver', code: 'SLV', hex: '#C4C8CE' },
  { name: 'Gold',   code: 'GLD', hex: '#C9A24A' },
  { name: 'Red',    code: 'RED', hex: '#B3182A' },
  { name: 'Blue',   code: 'BLU', hex: '#1F4FA8' },
  { name: 'Orange', code: 'ORG', hex: '#E0701F' },
  { name: 'Purple', code: 'PUR', hex: '#6B3FA0' },
  { name: 'Green',  code: 'GRN', hex: '#2F8A4C' },
];

const OUT = path.resolve('public/images/shop/metal-slab-case');
const SIZE = 1200;

// ── colour helpers ──────────────────────────────────────────────────────────
const hexToRgb = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16));
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const light = (h, t) => mix(h, '#ffffff', t);
const dark = (h, t) => mix(h, '#000000', t);

// Aluminium face: a brushed linear sweep with a hot specular band.
function metal(hex) {
  return `linear-gradient(135deg, ${light(hex, 0.38)} 0%, ${hex} 22%, ${dark(hex, 0.28)} 46%, ${light(hex, 0.52)} 58%, ${hex} 72%, ${dark(hex, 0.35)} 100%)`;
}
function metalEdge(hex) {
  return `linear-gradient(90deg, ${dark(hex, 0.45)} 0%, ${hex} 35%, ${light(hex, 0.3)} 55%, ${dark(hex, 0.3)} 100%)`;
}

// ── the case (front face) ───────────────────────────────────────────────────
// 440 × 700 px ≈ the outer footprint of a standard graded slab case.
const W = 440, H = 700, T = 34; // width, height, thickness

function cardArt() {
  return `
  <div class="card">
    <div class="card-in">
      <div class="card-top"><span>Ember Drake</span><span>120</span></div>
      <div class="art"><div class="sun"></div><div class="ridge r1"></div><div class="ridge r2"></div><div class="foil"></div></div>
      <div class="lines"><i></i><i style="width:70%"></i><i style="width:84%"></i><i style="width:56%"></i></div>
    </div>
  </div>`;
}

function slab() {
  return `
  <div class="slab">
    <div class="label">
      <div class="lab-l"><b>2026 EMBER DRAKE</b><span>HOLO · #001 · DISPLAY SAMPLE</span></div>
      <div class="lab-r"><b>10</b><span>GEM MT</span></div>
      <div class="barcode"></div>
    </div>
    <div class="well">${cardArt()}</div>
  </div>`;
}

function caseFace(hex, { magnets = true, glass = true } = {}) {
  return `
  <div class="face" style="background:${metal(hex)}">
    <div class="brush"></div>
    <div class="bevel"></div>
    ${magnets ? '<i class="mag m1"></i><i class="mag m2"></i><i class="mag m3"></i><i class="mag m4"></i>' : ''}
    <div class="window">${slab()}${glass ? '<div class="glass"></div>' : ''}</div>
  </div>`;
}

// A 3D box: front face plus right/left/top edges so angled shots show depth.
function caseBox(hex, transform, extra = '') {
  return `
  <div class="box" style="transform:${transform};${extra}">
    ${caseFace(hex)}
    <div class="edge right" style="background:${metalEdge(hex)}"><div class="seam"></div></div>
    <div class="edge left" style="background:${metalEdge(hex)}"><div class="seam"></div></div>
    <div class="edge top" style="background:${metalEdge(hex)}"><div class="seam h"></div></div>
    <div class="edge bottom" style="background:${metalEdge(hex)}"><div class="seam h"></div></div>
  </div>`;
}

const css = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${SIZE}px;height:${SIZE}px;overflow:hidden;font-family:'Helvetica Neue',Arial,sans-serif}
.stage{position:relative;width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center;perspective:2200px}
.studio{background:radial-gradient(ellipse 80% 65% at 50% 38%,#ffffff 0%,#f1f2f4 45%,#d9dbdf 100%)}
.charcoal{background:radial-gradient(ellipse 85% 70% at 50% 35%,#4a4c52 0%,#2b2c30 55%,#17181a 100%)}
.floor{position:absolute;left:50%;bottom:150px;width:620px;height:70px;transform:translateX(-50%);
  background:radial-gradient(ellipse at center,rgba(0,0,0,.34) 0%,rgba(0,0,0,.12) 45%,rgba(0,0,0,0) 72%);filter:blur(6px)}
.charcoal .floor{background:radial-gradient(ellipse at center,rgba(0,0,0,.7) 0%,rgba(0,0,0,.25) 45%,rgba(0,0,0,0) 72%)}
.box{position:relative;width:${W}px;height:${H}px;transform-style:preserve-3d}
.face{position:absolute;inset:0;border-radius:26px;transform:translateZ(${T / 2}px);overflow:hidden;
  box-shadow:inset 0 2px 1px rgba(255,255,255,.55),inset 0 -2px 2px rgba(0,0,0,.35)}
.brush{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.6) 0 1px,rgba(0,0,0,.25) 1px 2px,rgba(255,255,255,.1) 2px 4px)}
.bevel{position:absolute;inset:6px;border-radius:21px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),inset 0 0 0 2px rgba(0,0,0,.18)}
.mag{position:absolute;width:16px;height:16px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#f4f4f4 0%,#9a9da3 40%,#4d5056 100%);box-shadow:0 1px 1px rgba(0,0,0,.5),inset 0 0 0 1px rgba(0,0,0,.25)}
.m1{left:13px;top:13px}.m2{right:13px;top:13px}.m3{left:13px;bottom:13px}.m4{right:13px;bottom:13px}
.window{position:absolute;left:34px;top:34px;right:34px;bottom:34px;border-radius:12px;overflow:hidden;
  background:#e9eef2;box-shadow:inset 0 3px 8px rgba(0,0,0,.45),0 0 0 2px rgba(0,0,0,.25)}
.slab{position:absolute;inset:8px;border-radius:9px;background:linear-gradient(160deg,#f8fbfd,#dfe6eb);
  box-shadow:inset 0 0 0 3px rgba(255,255,255,.9),inset 0 0 0 5px rgba(150,165,175,.35)}
.label{position:absolute;left:16px;right:16px;top:16px;height:92px;border-radius:5px;background:#fbfbf8;
  box-shadow:0 0 0 2px #2c2d31 inset;padding:12px 14px;color:#1d1e21}
.lab-l b{display:block;font-size:17px;letter-spacing:.5px}
.lab-l span{display:block;font-size:11px;letter-spacing:1px;margin-top:5px;color:#555}
.lab-r{position:absolute;right:14px;top:10px;text-align:center}
.lab-r b{display:block;font-size:40px;line-height:40px}
.lab-r span{font-size:10px;letter-spacing:1.5px}
.barcode{position:absolute;left:14px;bottom:10px;width:150px;height:18px;
  background:repeating-linear-gradient(90deg,#1d1e21 0 2px,transparent 2px 4px,#1d1e21 4px 5px,transparent 5px 8px)}
.well{position:absolute;left:28px;right:28px;top:126px;bottom:24px;border-radius:6px;
  background:linear-gradient(180deg,#d4dce2,#eef2f5);box-shadow:inset 0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
.card{width:252px;height:352px;border-radius:12px;padding:10px;background:linear-gradient(145deg,#f3d26b,#c99a2e 45%,#f6dc7e 70%,#b8871f);box-shadow:0 3px 8px rgba(0,0,0,.35)}
.card-in{width:100%;height:100%;border-radius:6px;background:#f6efe1;padding:8px;display:flex;flex-direction:column;gap:8px}
.card-top{display:flex;justify-content:space-between;font-weight:700;font-size:15px;color:#3b2a14}
.art{position:relative;height:178px;border-radius:4px;overflow:hidden;
  background:linear-gradient(180deg,#2b1555 0%,#a8326b 48%,#f29a46 78%,#ffd27a 100%);box-shadow:0 0 0 2px #b9902f}
.sun{position:absolute;left:50%;top:58%;width:110px;height:110px;margin-left:-55px;border-radius:50%;
  background:radial-gradient(circle,#fff6c8 0%,#ffcf5a 45%,rgba(255,140,60,0) 72%)}
.ridge{position:absolute;bottom:0;width:0;height:0;border-style:solid}
.r1{left:-20px;border-width:0 120px 90px 120px;border-color:transparent transparent #3a1846 transparent}
.r2{right:-30px;border-width:0 140px 110px 140px;border-color:transparent transparent #24102f transparent}
.foil{position:absolute;inset:0;mix-blend-mode:screen;opacity:.55;
  background:linear-gradient(115deg,rgba(255,0,140,0) 20%,rgba(120,255,240,.55) 35%,rgba(255,255,140,.5) 45%,rgba(255,0,200,0) 60%)}
.lines{display:flex;flex-direction:column;gap:9px;padding:6px 4px}
.lines i{display:block;height:9px;width:100%;border-radius:4px;background:#d8ccb4}
.glass{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(118deg,rgba(255,255,255,0) 18%,rgba(255,255,255,.55) 24%,rgba(255,255,255,.08) 34%,rgba(255,255,255,0) 52%,rgba(255,255,255,.22) 62%,rgba(255,255,255,0) 70%)}
.edge{position:absolute;overflow:hidden}
.edge.right{width:${T}px;height:${H - 30}px;top:15px;right:${-T / 2}px;transform:rotateY(90deg)}
.edge.left{width:${T}px;height:${H - 30}px;top:15px;left:${-T / 2}px;transform:rotateY(-90deg)}
.edge.top{height:${T}px;width:${W - 30}px;left:15px;top:${-T / 2}px;transform:rotateX(90deg)}
.edge.bottom{height:${T}px;width:${W - 30}px;left:15px;bottom:${-T / 2}px;transform:rotateX(-90deg)}
.seam{position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:rgba(0,0,0,.55);box-shadow:1px 0 0 rgba(255,255,255,.25)}
.seam.h{left:0;right:0;top:50%;bottom:auto;width:auto;height:2px;margin:-1px 0 0}
.badge{position:absolute;left:60px;top:56px;font-weight:800;font-size:22px;letter-spacing:3px;color:#2b2c30;text-transform:uppercase}
.badge small{display:block;font-weight:500;font-size:15px;letter-spacing:1.5px;margin-top:8px;color:#6b6d72;text-transform:none}
.charcoal .badge{color:#f2f2f2}.charcoal .badge small{color:#b9bbc0}
.tag{position:absolute;right:60px;top:60px;padding:10px 18px;border-radius:999px;background:#CE1126;color:#fff;font-weight:700;font-size:17px;letter-spacing:1px}
.note{position:absolute;left:0;right:0;bottom:56px;text-align:center;font-size:15px;color:#77797e;letter-spacing:.5px}
.charcoal .note{color:#9a9ca1}
.call{position:absolute;font-size:18px;font-weight:700;color:#2b2c30}
.call span{display:block;font-weight:500;font-size:14px;color:#6b6d72;margin-top:4px;max-width:250px}
.call:before{content:'';position:absolute;top:10px;width:70px;height:2px;background:#CE1126}
.call.l{text-align:right}.call.l:before{right:-86px}
.call.r:before{left:-86px}
`;

const page = (bg, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="stage ${bg}">${inner}</div></body></html>`;

// ── scenes ──────────────────────────────────────────────────────────────────
const scenes = {
  // 1. Hero: front-on, slight turn, studio sweep.
  front: (c) => page('studio', `
    <div class="badge">Magnetic Metal Slab Case<small>${c.name} · 35pt · fits standard graded slabs</small></div>
    <div class="tag">PRE-ORDER</div>
    <div class="floor"></div>
    ${caseBox(c.hex, 'translateY(-10px) rotateY(-14deg) rotateX(4deg) scale(1.08)')}
    <div class="note">Display sample shown · graded card and slab not included</div>`),

  // 2. Three-quarter angle: shows the frame depth and the magnetic seam.
  angle: (c) => page('studio', `
    <div class="badge">Metal frame · magnetic lock<small>Two-piece aluminium shell that closes with a click</small></div>
    <div class="floor" style="width:700px"></div>
    ${caseBox(c.hex, 'translateY(-10px) rotateY(-42deg) rotateX(10deg) rotateZ(-2deg) scale(1.05)')}
    <div class="note">Display sample shown · graded card and slab not included</div>`),

  // 3. Feature callouts on a front-on case.
  features: (c) => page('studio', `
    <div class="floor"></div>
    <div class="call l" style="left:70px;top:300px">Tempered glass window<span>Clear, scratch-resistant face over your slab</span></div>
    <div class="call l" style="left:70px;top:640px">Magnetic closure<span>Multi-point magnets hold both halves shut</span></div>
    <div class="call r" style="right:70px;top:230px">Aluminium metal frame<span>Rigid aluminium shell guards the slab's edges</span></div>
    <div class="call r" style="right:70px;top:720px">Stackable<span>Flat front and back so cases stack neatly</span></div>
    ${caseBox(c.hex, 'scale(0.98)')}
    <div class="note">${c.name} · fits standard 35pt graded slabs (PSA, BGS, CGC)</div>`),

  // 4. Stacked on a charcoal surface, lifestyle mood.
  stack: (c) => page('charcoal', `
    <div class="badge">Built to stack<small>Keep a run of slabs tidy on the shelf</small></div>
    <div class="floor" style="width:820px;bottom:170px"></div>
    <div style="position:relative;width:${W}px;height:${H}px;transform-style:preserve-3d;transform:rotateX(62deg) rotateZ(-28deg) translateY(40px) scale(1.05)">
      ${[0, 1, 2].map((i) => `<div style="position:absolute;inset:0;transform-style:preserve-3d;transform:translateZ(${i * (T + 4)}px) rotateZ(${(i - 1) * 1.5}deg)">${caseBox(c.hex, 'none')}</div>`).join('')}
    </div>
    <div class="note">Three ${c.name.toLowerCase()} cases shown · sold individually</div>`),
};

const lineup = () => page('studio', `
  <div class="badge">Magnetic Metal Slab Case<small>Eight colours · 35pt</small></div>
  <div class="floor" style="width:1100px;bottom:420px"></div>
  <div style="position:relative;width:1100px;height:560px;transform:translateY(-30px)">
    ${METAL_SLAB_COLOURS.map((c, i) => `<div style="position:absolute;left:${i * 122}px;top:0;transform-style:preserve-3d;transform:scale(0.62) rotateY(-24deg);transform-origin:top left">${caseBox(c.hex, 'none')}</div>`).join('')}
  </div>
  <div class="note" style="bottom:200px;font-size:20px;color:#2b2c30;font-weight:700;letter-spacing:2px">${METAL_SLAB_COLOURS.map((c) => c.name.toUpperCase()).join(' · ')}</div>
  <div class="note">Display samples shown · graded card and slab not included</div>`);

export const metalSlabSku = (c) => `CP-METAL-SLAB-35PT-${c.code}`;
export const metalSlabImagePath = (c, view) => `/images/shop/metal-slab-case/${c.name.toLowerCase()}/${metalSlabSku(c).toLowerCase()}_${view}.jpg`;
export const METAL_SLAB_LINEUP_PATH = '/images/shop/metal-slab-case/cp-metal-slab-35pt_colours.jpg';
export const METAL_SLAB_VIEWS = ['front', 'angle', 'features', 'stack'];

async function shoot(browser, html, file) {
  const p = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'load' });
  const png = await p.screenshot({ type: 'png' });
  await p.close();
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
}

async function main() {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const c of METAL_SLAB_COLOURS) {
      for (const view of METAL_SLAB_VIEWS) {
        const file = path.join('public', metalSlabImagePath(c, view));
        await shoot(browser, scenes[view](c), file);
        console.log('wrote', file);
      }
    }
    await shoot(browser, lineup(), path.join('public', METAL_SLAB_LINEUP_PATH));
    console.log('wrote', METAL_SLAB_LINEUP_PATH);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
