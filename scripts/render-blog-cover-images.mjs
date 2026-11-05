#!/usr/bin/env node
// Renders the featured (cover) images for The Parallel Report blog articles.
//
//   node scripts/render-blog-cover-images.mjs            # every article below
//   node scripts/render-blog-cover-images.mjs <slug>…    # just these
//
// Writes public/images/blog/<slug>.jpg (1600×900, served by Vercel from
// cardpop.com.au/images/blog/…). Each cover is drawn in headless Chromium from
// the brand kit — Syne ExtraBold headline, brand red on charcoal, the CardPop
// card-holder mark — with an illustration made of CSS: generic fanned cards,
// generic graded slabs (no grading-company branding) and number-free charts.
// No third-party card art or logos are used, and no prices appear on a cover:
// a figure baked into an image can't be corrected when the article is.
//
// To give a new article a cover: add an entry to COVERS, run the script, then
// point blog_articles.featured_image_url at https://cardpop.com.au/images/blog/<slug>.jpg
// (a migration, or the article editor's image field).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public/images/blog');
const W = 1600;
const H = 900;

// Card palettes: [foil A, foil B, foil C, frame]
const P = {
  fire:     ['#FF7A18', '#E0261B', '#FFD25A', '#E8C14A'],
  fireDark: ['#3B0B0B', '#E0261B', '#FF9F1C', '#1E1E1E'],
  night:    ['#0B0B14', '#2A2A3A', '#F5C542', '#151520'],
  rose:     ['#FF9EC7', '#FF5FA2', '#FFE3F0', '#F2F2F2'],
  ice:      ['#9FE7FF', '#4FB6E8', '#E9FBFF', '#EDEFF2'],
  leaf:     ['#9BE15D', '#2FA84F', '#E4FFC2', '#EDEFF2'],
  prism:    ['#FFB3E6', '#9AD8FF', '#FFF3A6', '#F4F4F6'],
  water:    ['#5AB8F0', '#1F6FB2', '#CFF1FF', '#E8C14A'],
  grass:    ['#7ED957', '#2E8B3E', '#E6FFB8', '#E8C14A'],
  gold:     ['#F7D774', '#B8860B', '#FFF4C8', '#D9D9DE'],
  royal:    ['#7B3FA0', '#F2C14E', '#2A0F3A', '#D9D9DE'],
  red:      ['#CE1126', '#5A0610', '#FF6B6B', '#E6E8EB'],
  silver:   ['#E6E9EE', '#9AA3AD', '#FFFFFF', '#C4CED4'],
  sea:      ['#E23B2E', '#F2C14E', '#1D2C4A', '#E8E2D0'],
  maroon:   ['#7A1E3A', '#F2B705', '#2B0A14', '#E6E8EB'],
  teal:     ['#1E1E1E', '#CE1126', '#F2F2F2', '#E6E8EB'],
};

// The articles. `headline` is the short form set on the image (the full title
// stays on the page); `\n` forces a line break.
export const COVERS = [
  {
    slug: 'vault-the-great-chase-edition-1-melbourne-card-collectible-show-cardpop-australia-review',
    kicker: 'Event Review',
    headline: 'Vault: The\nGreat Chase',
    sub: 'Edition 1 · Melbourne card & collectible show',
    art: { type: 'event', cards: [P.red, P.gold, P.fire, P.silver, P.royal] },
  },
  {
    slug: 'modern-charizard-chase-cards-ranked-by-price',
    kicker: 'Card Spotlight',
    headline: 'Five modern\nCharizard chases,\nranked',
    sub: 'From the most attainable to the true grail',
    art: { type: 'ranked', cards: [P.fireDark, P.fire, P.fireDark, P.fire, P.fireDark], labels: ['CHARIZARD', 'CHARIZARD', 'CHARIZARD', 'CHARIZARD', 'CHARIZARD'] },
  },
  {
    slug: 'prismatic-evolutions-sir-price-check',
    kicker: 'Card Spotlight',
    headline: 'Prismatic\nEvolutions SIRs',
    sub: 'Umbreon ex against the other three',
    art: { type: 'hero', cards: [P.night, P.prism, P.rose, P.ice], labels: ['UMBREON ex', 'SIR', 'SIR', 'SIR'] },
  },
  {
    slug: 'evolving-skies-eeveelution-alt-arts-price-guide',
    kicker: 'Card Spotlight',
    headline: 'Evolving Skies\nEeveelution\nalt arts',
    sub: 'Umbreon, Sylveon, Glaceon and Leafeon',
    art: { type: 'fan', cards: [P.leaf, P.ice, P.rose, P.night], labels: ['LEAFEON', 'GLACEON', 'SYLVEON', 'UMBREON'] },
  },
  {
    slug: 'base-set-big-three-price-check-australia',
    kicker: 'Card Spotlight',
    headline: 'Base Set\nBig Three',
    sub: 'Charizard, Blastoise and Venusaur in Australia',
    art: { type: 'fan', vintage: true, cards: [P.grass, P.water, P.fire], labels: ['VENUSAUR', 'BLASTOISE', 'CHARIZARD'] },
  },
  {
    slug: 'one-piece-alt-art-price-check-2026',
    kicker: 'Card Spotlight',
    headline: 'One Piece TCG,\nafter the rush',
    sub: 'Where alt art prices settled',
    art: { type: 'chart', lines: [[0.15, 0.1, 0.25, 0.62, 0.7, 0.68, 0.7, 0.69]], cards: [P.sea, P.maroon, P.sea], labels: ['ALT ART', 'ALT ART', 'ALT ART'] },
  },
  {
    slug: 'raw-vs-psa-10-price-gap-nba-rookies',
    kicker: 'Grading Guide',
    headline: 'Raw vs\nGem Mint 10',
    sub: 'The price gap on NBA Prizm rookies',
    art: { type: 'versus', cards: [P.silver, P.silver], labels: ['RAW', 'GEM MT 10'] },
  },
  {
    slug: 'nrl-rookie-cards-price-check-2026',
    kicker: 'Australia Focus',
    headline: 'NRL rookie\ncards',
    sub: 'What 31 days of tracking turned up',
    art: { type: 'stat', stat: '31', statLabel: 'days tracked', cards: [P.maroon, P.teal, P.gold], labels: ['ROOKIE', 'ROOKIE', 'ROOKIE'] },
  },
  {
    slug: 'afl-rookie-cards-price-check-2026',
    kicker: 'Australia Focus',
    headline: 'AFL rookie\ncards',
    sub: 'Pricing honestly from a thin market',
    art: { type: 'stat', stat: '42', statLabel: 'listings to go on', cards: [P.red, P.gold, P.teal], labels: ['ROOKIE', 'ROOKIE', 'ROOKIE'] },
  },
  {
    slug: 'pokemon-alt-art-price-check-2026',
    kicker: 'Card Spotlight',
    headline: 'Pokémon alt art\nprices split\nfive ways',
    sub: '29 days of tracked prices',
    art: {
      type: 'chart',
      lines: [
        [0.5, 0.52, 0.58, 0.66, 0.74, 0.8, 0.86, 0.92],
        [0.5, 0.51, 0.55, 0.57, 0.6, 0.63, 0.64, 0.66],
        [0.5, 0.5, 0.49, 0.5, 0.5, 0.49, 0.5, 0.5],
        [0.5, 0.48, 0.45, 0.42, 0.4, 0.37, 0.35, 0.33],
        [0.5, 0.46, 0.4, 0.33, 0.27, 0.22, 0.18, 0.14],
      ],
      cards: [P.prism, P.night, P.rose],
      labels: ['ALT ART', 'ALT ART', 'ALT ART'],
    },
  },
  {
    slug: 'charizard-price-guide-australia-2026',
    kicker: 'Price Guide',
    headline: 'The Charizard\nprice guide',
    sub: 'Australia, card by card',
    art: { type: 'tags', cards: [P.fire, P.fireDark, P.fire, P.fireDark], labels: ['CHARIZARD', 'CHARIZARD', 'CHARIZARD', 'CHARIZARD'] },
  },
  {
    slug: 'why-philadelphia-76ers-could-land-lebron-james-2026',
    kicker: 'News',
    headline: 'Philadelphia,\nthe dark horse\nfor LeBron',
    sub: 'And why it might be the best basketball fit',
    art: { type: 'court', cards: [P.red, P.gold], labels: ['LEBRON', 'PHILADELPHIA'] },
  },
  {
    slug: 'best-lebron-james-cards-to-buy-in-2026-cardpop-investment-report',
    kicker: 'Investment Report',
    headline: 'Best LeBron\nJames cards\nto buy in 2026',
    sub: 'The CardPop investment report',
    art: { type: 'slabs', cards: [P.royal, P.gold, P.red], labels: ['LEBRON JAMES', 'LEBRON JAMES', 'LEBRON JAMES'] },
  },
];

// ── building blocks ─────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function card(pal, { label = '', x = 0, y = 0, r = 0, s = 1, z = 1, vintage = false, rank = null } = {}) {
  const [a, b, c, frame] = pal;
  const border = vintage ? '#F3D34A' : frame;
  return `
  <div class="card" style="left:${x}px;top:${y}px;transform:rotate(${r}deg) scale(${s});z-index:${z};--a:${a};--b:${b};--c:${c};--f:${border}">
    <div class="card-in">
      <div class="nm"><span>${esc(label)}</span><i></i></div>
      <div class="art"><div class="holo"></div><div class="orb"></div></div>
      <div class="txt"><b></b><b></b><b style="width:55%"></b></div>
    </div>
    ${rank != null ? `<div class="rank">${rank}</div>` : ''}
  </div>`;
}

function slab(pal, { label = '', x = 0, y = 0, r = 0, s = 1, z = 1 } = {}) {
  return `
  <div class="slab" style="left:${x}px;top:${y}px;transform:rotate(${r}deg) scale(${s});z-index:${z}">
    <div class="lbl"><div><b>${esc(label)}</b><span>CARDPOP SAMPLE · DISPLAY ONLY</span></div><div class="gr"><small>GEM MT</small>10</div></div>
    <div class="well">${card(pal, { x: 0, y: 0 }).replace('class="card"', 'class="card in-slab"')}</div>
  </div>`;
}

function chart(lines, { x, y, w, h }) {
  const colors = ['#CE1126', '#F5F7FA', '#C4CED4', '#FF7A7A', '#8A94A0'];
  const paths = lines.map((pts, i) => {
    const d = pts.map((v, j) => `${(j / (pts.length - 1)) * (w - 60) + 30},${h - 30 - v * (h - 60)}`).join(' ');
    const last = d.split(' ').pop().split(',');
    return `<polyline points="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${i === 0 ? 7 : 5}" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="9" fill="${colors[i % colors.length]}"/>`;
  }).join('');
  const grid = [0.25, 0.5, 0.75].map((g) => `<line x1="30" x2="${w - 30}" y1="${30 + g * (h - 60)}" y2="${30 + g * (h - 60)}" stroke="rgba(255,255,255,.09)" stroke-width="2"/>`).join('');
  return `<div class="panel" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><svg width="${w}" height="${h}">${grid}${paths}</svg></div>`;
}

function artFor({ art }) {
  const { type, cards = [], labels = [], vintage } = art;
  const L = (i) => labels[i] ?? '';
  switch (type) {
    case 'fan': {
      const n = cards.length;
      const spread = n === 3 ? 16 : 12;
      return cards.map((c, i) => {
        const t = i - (n - 1) / 2;
        return card(c, { label: L(i), x: 250 + t * 135, y: 150 + Math.abs(t) * 34, r: t * spread, z: 10 + i, vintage });
      }).join('');
    }
    case 'hero':
      return [
        card(cards[1], { label: L(1), x: 115, y: 210, r: -16, s: 0.86, z: 2 }),
        card(cards[2], { label: L(2), x: 470, y: 200, r: 14, s: 0.86, z: 2 }),
        card(cards[3], { label: L(3), x: 300, y: 330, r: 3, s: 0.8, z: 3 }),
        card(cards[0], { label: L(0), x: 290, y: 95, r: -2, s: 1.12, z: 9 }),
      ].join('');
    case 'ranked':
      return cards.map((c, i) => card(c, { label: L(i), x: 40 + i * 120, y: 330 - i * 52, r: -6 + i * 3, s: 0.62 + i * 0.09, z: 10 + i, rank: 5 - i })).join('');
    case 'tags':
      return cards.map((c, i) => card(c, { label: L(i), x: 30 + i * 150, y: 175 + (i % 2) * 70, r: -9 + i * 6, s: 0.78, z: 10 + i })).join('')
        + [0, 1, 2, 3].map((i) => `<div class="tag" style="left:${120 + i * 150}px;top:${(i % 2 ? 165 : 100)}px;transform:rotate(${-12 + i * 7}deg)"><span>$</span></div>`).join('');
    case 'chart':
      return chart(art.lines, { x: 40, y: 360, w: 650, h: 380 })
        + cards.map((c, i) => card(c, { label: L(i), x: 120 + i * 175, y: 40 + (i === 1 ? -20 : 20), r: -10 + i * 10, s: 0.72, z: 1 + i })).join('');
    case 'stat':
      return cards.map((c, i) => card(c, { label: L(i), x: 320 + i * 120, y: 90 + i * 40, r: -8 + i * 9, s: 0.84, z: 1 + i })).join('')
        + `<div class="stat"><b>${esc(art.stat)}</b><span>${esc(art.statLabel)}</span></div>`;
    case 'versus':
      return card(cards[0], { label: L(0), x: 90, y: 200, r: -8, s: 0.92, z: 2 })
        + slab(cards[1], { label: 'NBA PRIZM ROOKIE', x: 400, y: 90, r: 6, s: 0.98, z: 3 })
        + `<div class="vs">VS</div>`;
    case 'slabs':
      return [
        slab(cards[0], { label: L(0), x: 60, y: 170, r: -12, s: 0.86, z: 1 }),
        slab(cards[2], { label: L(2), x: 470, y: 170, r: 12, s: 0.86, z: 1 }),
        slab(cards[1], { label: L(1), x: 265, y: 70, r: 0, s: 1, z: 5 }),
      ].join('');
    case 'court':
      return `<div class="court"><div class="ring"></div><div class="key"></div><div class="arc"></div></div>`
        + card(cards[0], { label: L(0), x: 170, y: 150, r: -10, s: 0.95, z: 3 })
        + card(cards[1], { label: L(1), x: 430, y: 200, r: 9, s: 0.9, z: 2 })
        + `<div class="q">?</div>`;
    case 'event':
      return `<div class="booth"><div class="banner">CARD SHOW</div><div class="table"></div></div>`
        + cards.map((c, i) => card(c, { label: '', x: 40 + i * 130, y: 360 - (i % 2) * 26, r: -8 + i * 4, s: 0.56, z: 5 + i })).join('')
        + `<div class="pin">MELBOURNE</div>`;
    default:
      return '';
  }
}

const LOGO = `<svg viewBox="0 0 56 68" fill="none" width="46" height="56"><rect x="17" y="0.5" width="22" height="11" rx="4" stroke="#CE1126" stroke-width="2.5"/><rect x="20.5" y="3" width="15" height="5" rx="2" fill="#CE1126" opacity="0.22"/><rect x="1.5" y="9" width="53" height="58" rx="6" stroke="#CE1126" stroke-width="2.5"/><rect x="8" y="17" width="40" height="43" rx="4" stroke="#CE1126" stroke-width="2"/><rect x="14" y="23" width="28" height="31" rx="2.5" stroke="#CE1126" stroke-width="1.5" opacity="0.6"/></svg>`;

function html(cover, fontUrl) {
  const lines = cover.headline.split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  const size = lines.length >= 3 || longest > 13 ? 84 : 100;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Syne; src: url('${fontUrl}') format('woff2'); font-weight: 400 800; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width:${W}px; height:${H}px; overflow:hidden; font-family: 'Helvetica Neue', Inter, Arial, sans-serif; color:#F5F7FA;
    background: radial-gradient(900px 700px at 78% 48%, rgba(206,17,38,.42), rgba(206,17,38,0) 65%),
                radial-gradient(700px 500px at 0% 100%, rgba(196,206,212,.08), transparent 70%),
                linear-gradient(135deg, #111827 0%, #1F2937 55%, #151b26 100%); position:relative; }
  .grid { position:absolute; inset:0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 64px 64px; mask-image: linear-gradient(90deg, #000 0%, transparent 70%); }
  .stripe { position:absolute; left:0; top:0; bottom:0; width:14px; background:#CE1126; }
  .left { position:absolute; left:96px; top:84px; bottom:76px; width:760px; display:flex; flex-direction:column; z-index:50; }
  .brand { display:flex; align-items:center; gap:16px; }
  .brand .wm { font-family:Syne; font-weight:800; font-size:40px; letter-spacing:.01em; }
  .brand .wm em { font-style:normal; color:#CE1126; }
  .brand .tr { color:#C4CED4; font-size:15px; letter-spacing:.32em; text-transform:uppercase; font-weight:700; margin-left:10px; padding-left:18px; border-left:2px solid rgba(196,206,212,.3); }
  .kicker { margin-top:auto; align-self:flex-start; background:#CE1126; color:#fff; font-weight:800; font-size:22px; letter-spacing:.2em; text-transform:uppercase; padding:12px 22px 11px; border-radius:6px; }
  h1 { font-family:Syne; font-weight:800; font-size:${size}px; line-height:1.0; letter-spacing:-.015em; margin-top:30px; white-space:nowrap; width:max-content; max-width:none; }
  .sub { margin-top:28px; font-size:31px; line-height:1.3; color:#C4CED4; font-weight:500; max-width:700px; }
  .foot { margin-top:auto; padding-top:34px; display:flex; gap:14px; align-items:center; color:#8A96A3; font-size:21px; letter-spacing:.06em; }
  .foot b { color:#F5F7FA; font-weight:700; }
  .foot i { width:7px; height:7px; border-radius:50%; background:#CE1126; display:inline-block; }
  .art-wrap { position:absolute; left:860px; top:40px; width:720px; height:820px; }
  .card { position:absolute; width:300px; height:418px; border-radius:16px; padding:12px; transform-origin:center;
    background: linear-gradient(140deg, color-mix(in srgb, var(--f) 100%, #fff 25%), var(--f) 45%, color-mix(in srgb, var(--f) 80%, #000 30%));
    box-shadow: 0 30px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.12) inset; }
  .card-in { width:100%; height:100%; border-radius:9px; overflow:hidden; display:flex; flex-direction:column;
    background: linear-gradient(160deg, color-mix(in srgb, var(--a) 70%, #fff 30%), var(--b)); }
  .nm { height:40px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; font-family:Syne; font-weight:800; font-size:16px; letter-spacing:.06em; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.5); background:rgba(0,0,0,.22); }
  .nm i { width:22px; height:22px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #fff, var(--c) 55%, var(--b)); box-shadow:0 0 0 2px rgba(255,255,255,.5); }
  .art { position:relative; margin:10px 10px 0; height:220px; border-radius:6px; overflow:hidden; border:3px solid rgba(255,255,255,.55);
    background: radial-gradient(circle at 50% 60%, var(--c), var(--a) 45%, var(--b) 100%); }
  .holo { position:absolute; inset:-40%; background: conic-gradient(from 30deg, rgba(255,255,255,0), rgba(255,255,255,.55), rgba(255,0,140,.25), rgba(0,220,255,.25), rgba(255,255,120,.35), rgba(255,255,255,0)); mix-blend-mode: overlay; transform: rotate(18deg); }
  .orb { position:absolute; left:50%; top:54%; width:150px; height:150px; margin:-75px; border-radius:50%;
    background: radial-gradient(circle at 38% 34%, rgba(255,255,255,.95), var(--c) 30%, var(--a) 62%, rgba(0,0,0,.35)); box-shadow: 0 0 60px 10px color-mix(in srgb, var(--c) 70%, transparent); }
  .txt { flex:1; margin:12px 14px 14px; display:flex; flex-direction:column; gap:10px; justify-content:center; }
  .txt b { display:block; height:10px; border-radius:5px; background:rgba(0,0,0,.22); }
  .rank { position:absolute; top:-26px; left:-26px; width:74px; height:74px; border-radius:50%; background:#CE1126; color:#fff; font-family:Syne; font-weight:800; font-size:40px; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 25px rgba(0,0,0,.5), 0 0 0 5px #F5F7FA; }
  .slab { position:absolute; width:340px; height:540px; border-radius:18px; padding:14px; transform-origin:center;
    background: linear-gradient(135deg, rgba(255,255,255,.34), rgba(255,255,255,.10) 40%, rgba(255,255,255,.24));
    box-shadow: 0 35px 70px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.45), inset 0 0 0 9px rgba(255,255,255,.08); }
  .slab .lbl { height:84px; border-radius:8px; background: linear-gradient(180deg, #F7F7F9, #E3E6EA); border-top:6px solid #CE1126; display:flex; justify-content:space-between; align-items:center; padding:0 16px; color:#1F2937; }
  .slab .lbl b { display:block; font-family:Syne; font-weight:800; font-size:18px; letter-spacing:.03em; }
  .slab .lbl span { display:block; font-size:10px; letter-spacing:.14em; color:#6B7280; margin-top:6px; font-weight:700; }
  .slab .gr { font-family:Syne; font-weight:800; font-size:40px; color:#CE1126; text-align:center; line-height:.9; }
  .slab .gr small { display:block; font-size:11px; letter-spacing:.14em; color:#1F2937; }
  .slab .well { position:relative; margin-top:14px; height:414px; border-radius:8px; background:rgba(10,14,22,.5); display:flex; justify-content:center; align-items:center; }
  .card.in-slab { position:relative; left:0 !important; top:0 !important; width:282px; height:392px; box-shadow:0 6px 16px rgba(0,0,0,.4); }
  .card.in-slab .art { height:200px; }
  .panel { position:absolute; border-radius:22px; background: linear-gradient(160deg, rgba(31,41,55,.92), rgba(17,24,39,.92)); box-shadow: 0 30px 60px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.08); z-index:20; }
  .stat { position:absolute; left:40px; top:470px; z-index:30; width:330px; height:250px; border-radius:22px; background:#F5F7FA; color:#1F2937; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 30px 60px rgba(0,0,0,.5); border-bottom:10px solid #CE1126; }
  .stat b { font-family:Syne; font-weight:800; font-size:140px; line-height:.95; color:#CE1126; }
  .stat span { font-size:24px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; margin-top:8px; }
  .tag { position:absolute; z-index:40; width:96px; height:58px; background:#F5F7FA; border-radius:8px 30px 30px 8px; display:flex; align-items:center; padding-left:18px; box-shadow:0 12px 24px rgba(0,0,0,.45); }
  .tag::after { content:''; position:absolute; right:14px; top:50%; width:14px; height:14px; margin-top:-7px; border-radius:50%; background:#1F2937; }
  .tag span { font-family:Syne; font-weight:800; font-size:32px; color:#CE1126; }
  .vs { position:absolute; left:330px; top:620px; z-index:40; width:120px; height:120px; border-radius:50%; background:#CE1126; color:#fff; font-family:Syne; font-weight:800; font-size:46px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 8px #F5F7FA, 0 20px 40px rgba(0,0,0,.5); }
  .court { position:absolute; inset:60px 0 40px 0; border-radius:30px; background: linear-gradient(160deg, #c98a4b, #a86a33); opacity:.22; overflow:hidden; }
  .court .key { position:absolute; left:50%; bottom:0; width:260px; height:330px; margin-left:-130px; border:6px solid #fff; border-bottom:0; }
  .court .ring { position:absolute; left:50%; bottom:300px; width:220px; height:220px; margin-left:-110px; border:6px solid #fff; border-radius:50%; }
  .court .arc { position:absolute; left:50%; bottom:-380px; width:760px; height:760px; margin-left:-380px; border:6px solid #fff; border-radius:50%; }
  .q { position:absolute; left:500px; top:80px; z-index:40; width:130px; height:130px; border-radius:50%; background:#CE1126; color:#fff; font-family:Syne; font-weight:800; font-size:84px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 8px #F5F7FA, 0 20px 40px rgba(0,0,0,.5); }
  .booth { position:absolute; left:20px; top:70px; width:680px; height:640px; }
  .booth .banner { position:absolute; left:40px; right:40px; top:0; height:150px; border-radius:14px; background:#CE1126; color:#fff; font-family:Syne; font-weight:800; font-size:50px; letter-spacing:.06em; white-space:nowrap; display:flex; align-items:center; justify-content:center; box-shadow:0 25px 50px rgba(0,0,0,.45); }
  .booth .banner::before, .booth .banner::after { content:''; position:absolute; top:150px; width:10px; height:200px; background:#C4CED4; }
  .booth .banner::before { left:40px; } .booth .banner::after { right:40px; }
  .booth .table { position:absolute; left:0; right:0; top:470px; height:170px; border-radius:12px; background: linear-gradient(180deg, #2b3646, #1a2230); box-shadow: inset 0 6px 0 rgba(255,255,255,.08), 0 25px 50px rgba(0,0,0,.5); }
  .pin { position:absolute; right:20px; top:250px; z-index:40; background:#F5F7FA; color:#1F2937; font-weight:800; font-size:22px; letter-spacing:.18em; padding:14px 22px; border-radius:40px; box-shadow:0 15px 30px rgba(0,0,0,.45); border-left:10px solid #CE1126; }
  </style></head><body>
  <div class="grid"></div><div class="stripe"></div>
  <div class="left">
    <div class="brand">${LOGO}<div class="wm">Card<em>Pop</em></div><div class="tr">The Parallel Report</div></div>
    <div class="kicker">${esc(cover.kicker)}</div>
    <h1>${lines.map(esc).join('<br>')}</h1>
    <div class="sub">${esc(cover.sub)}</div>
    <div class="foot"><i></i><b>cardpop.com.au</b><span>· Australia's trading card marketplace</span></div>
  </div>
  <div class="art-wrap">${artFor(cover)}</div>
  </body></html>`;
}

async function main() {
  const only = process.argv.slice(2);
  const covers = only.length ? COVERS.filter((c) => only.includes(c.slug)) : COVERS;
  if (only.length && covers.length !== only.length) {
    throw new Error(`Unknown slug(s): ${only.filter((s) => !COVERS.some((c) => c.slug === s)).join(', ')}`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const font = await readFile(path.join(ROOT, 'public/fonts/syne-latin-var.woff2'));
  const fontUrl = `data:font/woff2;base64,${font.toString('base64')}`;
  // CHROMIUM_PATH lets a machine with a different Playwright build point at its own browser.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const cover of covers) {
    await page.setContent(html(cover, fontUrl), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Shrink the headline until it clears the artwork column and the column fits.
    await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const col = document.querySelector('.left');
      let size = parseFloat(getComputedStyle(h1).fontSize);
      while (size > 48 && (h1.scrollWidth > 730 || col.scrollHeight > col.clientHeight + 1)) {
        size -= 2;
        h1.style.fontSize = `${size}px`;
      }
    });
    const png = await page.screenshot({ type: 'png' });
    const out = path.join(OUT_DIR, `${cover.slug}.jpg`);
    await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
    console.log('wrote', path.relative(ROOT, out));
  }
  await browser.close();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
