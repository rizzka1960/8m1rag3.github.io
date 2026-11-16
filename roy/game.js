/* Рой / Swarm — game logic and rendering. */
(function () {
'use strict';
const t = I18N.t;
const MW = 400, MH = 720;              // canonical map space (portrait)
const MAXLEN = 1350, SPEED = 90, TOWER_R = 86, BEE_W = 13;
const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
let X = ctx;                           // current draw context (swapped for icons)
let WM = { a: 1, e: 0, f: 0 };         // world -> device matrix (uniform scale)
let reduce = false;
try { reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
const STRICT = !!window.__ROY_STRICT;

const FAC = {
  p: { c: '#ffbf3c', hi: '#ffe08a', d: '#6e440c' },
  e: { c: '#ff5f4f', hi: '#ffc0b6', d: '#5e1914' },
  h: { c: '#b27dff', hi: '#e2ceff', d: '#35205f' },
  n: { c: '#b9ad9f', hi: '#f3e9dc', d: '#40372f' }
};
const FONT = '"Russo One","Arial Black",Impact,sans-serif';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const k = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0;
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
function rng(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let q = Math.imul(a ^ a >>> 15, 1 | a);
    q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q;
    return ((q ^ q >>> 14) >>> 0) / 4294967296;
  };
}
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ---------------------------------------------------------------- save
let save = { v: 2, unlocked: 1, stars: {}, sound: true, seen: {}, adCount: 0, sendPct: 50 };
const SEND_STEPS = [50, 75, 100];
// Bees a player hive sends with the chosen share; 100% empties the hive.
const sendCount = c => Math.min(c, Math.max(1, Math.floor(c * save.sendPct / 100)));
function persist() { try { Platform.save(save); } catch (e) {} }
function mergeSave(o) {
  if (!o || typeof o !== 'object') return;
  if (Number(o.unlocked) > 0) save.unlocked = Math.max(1, Math.floor(Number(o.unlocked)));
  if (o.stars && typeof o.stars === 'object') save.stars = o.stars;
  if (typeof o.sound === 'boolean') save.sound = o.sound;
  if (o.seen && typeof o.seen === 'object') save.seen = o.seen;
  if (Number(o.adCount) >= 0) save.adCount = Number(o.adCount) | 0;
  if (SEND_STEPS.includes(o.sendPct)) save.sendPct = o.sendPct;
}

// ---------------------------------------------------------------- layout
let LAY = { rot: false, sx: 1, sy: 1, W: MW, H: MH };
let dpr = 1, vw = 1, vh = 1, scale = 1, offX = 0, offY = 0;
function toMap(p, L) { const x = p.x / L.sx, y = p.y / L.sy; return L.rot ? { x: y, y: MH - x } : { x: x, y: y }; }
function fromMap(m, L) { return L.rot ? { x: (MH - m.y) * L.sx, y: m.x * L.sy } : { x: m.x * L.sx, y: m.y * L.sy }; }
function windDir(m) { const dx = m.bx - m.ax, dy = m.by - m.ay, L = Math.hypot(dx, dy) || 1; m.dx = dx / L; m.dy = dy / L; m.len = L; }
function mapEntities(hives, mods, fn) {
  for (const h of hives) fn(h, 'x', 'y');
  for (const m of mods) {
    if ('x' in m) fn(m, 'x', 'y');
    if ('ax' in m) { fn(m, 'ax', 'ay'); fn(m, 'bx', 'by'); }
    if (m.kind === 'wind') windDir(m);
  }
}
function remapAll(L0, L1) {
  if (!G) return;
  const f = (o, kx, ky) => { const m = fromMap(toMap({ x: o[kx], y: o[ky] }, L0), L1); o[kx] = m.x; o[ky] = m.y; };
  mapEntities(G.hives, G.mods, f);
  for (const s of G.swarms) {
    const fr = s.total > 0 ? s.d / s.total : 0;
    for (const p of s.pts) f(p, 'x', 'y');
    f(s, 'x', 'y');
    for (const p of s.trail) f(p, 'x', 'y');
    s.cum = cumOf(s.pts); s.total = s.cum[s.cum.length - 1]; s.d = fr * s.total; s.seg = 0;
    while (s.seg < s.pts.length - 2 && s.cum[s.seg + 1] <= s.d) s.seg++;
  }
  for (const p of parts) if (p.on) f(p, 'x', 'y');
  for (const fl of floats) f(fl, 'x', 'y');
  G.stings.length = 0;
  drag = null;
}
function layout() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  vw = Math.max(1, window.innerWidth || 1); vh = Math.max(1, window.innerHeight || 1);
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  let top = 8, bottom = vh - 8, left = 8, right = vw - 8;
  const hudEl = $('hud'), dk = $('dock');
  if (!hudEl.classList.contains('hide')) top = Math.max(top, hudEl.getBoundingClientRect().bottom + 2);
  if (!dk.classList.contains('hide')) {
    const r = dk.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) { if (r.left > vw * 0.5 && r.height > r.width) right = Math.min(right, r.left - 6); else bottom = Math.min(bottom, r.top - 6); }
  }
  const aw = Math.max(60, right - left), ah = Math.max(60, bottom - top);
  const rot = aw > ah;
  const bw = rot ? MH : MW, bh = rot ? MW : MH;
  const A = aw / ah, B = bw / bh;
  let sx = 1, sy = 1;
  if (A > B) sx = Math.min(A / B, 1.4); else sy = Math.min(B / A, 1.4);
  const L = { rot: rot, sx: sx, sy: sy, W: bw * sx, H: bh * sy };
  if (L.rot !== LAY.rot || Math.abs(L.sx - LAY.sx) > 1e-3 || Math.abs(L.sy - LAY.sy) > 1e-3) remapAll(LAY, L);
  LAY = L;
  scale = Math.min(aw / L.W, ah / L.H);
  offX = left + (aw - L.W * scale) / 2;
  offY = top + (ah - L.H * scale) / 2;
  buildBackground();
  buildSprites();
}

// ---------------------------------------------------------------- level generation
const FEAT = { add10: 1, mul2: 1, add25: 2, sub10: 2, div2: 3, switch: 4, dandelion: 5, rocks: 5, wasp: 6, queen: 6, wind: 7, fort: 7, portal: 8, puddle: 9, tower: 9, hornets: 10, mul3: 10, sub20: 10 };
const AB_UNLOCK = { honey: 3, boost: 6, smoke: 9 };
const AB_CD = { honey: 20, boost: 24, smoke: 28 };
const INTRO_OF = { add10: 'flower', add25: 'flower', mul2: 'flower', mul3: 'x3', sub10: 'spider', sub20: 'spider', div2: 'div', switch: 'switch', dandelion: 'dandelion', rocks: 'rocks', wasp: 'wasp', queen: 'queen', wind: 'wind', fort: 'fort', portal: 'portal', puddle: 'puddle', tower: 'tower', hornets: 'hornets' };
const INTRO_ORDER = ['flower', 'spider', 'div', 'ab_honey', 'switch', 'dandelion', 'rocks', 'wasp', 'queen', 'ab_boost', 'wind', 'fort', 'portal', 'puddle', 'tower', 'ab_smoke', 'hornets', 'x3'];

function rocksClear(a, b, mods, pad) {
  for (const m of mods) if (m.kind === 'rock' && segDist(m.x, m.y, a.x, a.y, b.x, b.y) < m.r + pad) return false;
  return true;
}
function connected(hives, mods) {
  const seen = new Set([hives[0].id]); const q = [hives[0]];
  while (q.length) {
    const a = q.pop();
    for (const b of hives) { if (seen.has(b.id)) continue; if (rocksClear(a, b, mods, 6)) { seen.add(b.id); q.push(b); } }
  }
  return seen.size === hives.length;
}
function genLevel(n) {
  for (let at = 0; at < 25; at++) { const L = tryGen(n, at, false); if (L) return L; }
  return tryGen(n, 99, true) || tryGen(n, 100, true);
}
function tryGen(n, attempt, noRocks) {
  const R = rng(n * 7919 + attempt * 104729 + 17);
  const rr = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(a + R() * (b - a + 1)), chance = p => R() < p;
  const wpick = items => { let s = 0; for (const it of items) s += it[1]; let r = R() * s; for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; } return items[0][0]; };
  const use = new Set();
  for (const k in FEAT) { const u = FEAT[k]; if (u > n) continue; if (u === n || u <= 2 || chance(n <= 10 ? 0.5 : 0.6)) use.add(k); }
  if (noRocks) use.delete('rocks');
  const hiveN = Math.min(11, 6 + Math.floor((n - 1) / 2));
  const wasps = n <= 4 ? 1 : n <= 9 ? 2 : Math.min(3, 2 + Math.floor((n - 10) / 6));
  const horns = use.has('hornets') ? (n < 16 ? 1 : 2) : 0;
  const hives = [];
  const okH = (x, y, r) => hives.every(h => Math.hypot(h.x - x, h.y - y) >= h.r + r + 46);
  const addH = (owner, x, y, r, count, type) => {
    const h = { id: hives.length, owner: owner, x: x, y: y, r: r, count: Math.max(0, Math.round(count)), type: type || 'normal', cap: r >= 29 ? 150 : 99, grow: 0, pulse: 0, flip: 0, flipFrom: null, smoke: 0, towerT: 0 };
    hives.push(h); return h;
  };
  // EASE scales enemy starting hives: two easing passes, 0.8 then 0.85 (32% fewer bees than the original tuning).
  const EASE = 0.8 * 0.85;
  const eStart = Math.round((12 + n * 1.6) * EASE);
  const pStart = n <= 5 ? Math.max(22, eStart + 3) : Math.round(20 + Math.min(10, n * 0.5));
  addH('p', rr(110, 290), rr(625, 662), 31, pStart);
  const placeTop = (owner, i, xa, xb) => {
    for (let k = 0; k < 300; k++) {
      const r = i === 0 ? 30 : rr(24, 29), x = rr(xa, xb), y = rr(60, 200 + i * 45);
      if (okH(x, y, r)) { addH(owner, x, y, r, (owner === 'h' ? eStart + 4 : eStart - (i ? 3 : 0)) + R() * 4); return; }
    }
  };
  for (let i = 0; i < wasps; i++) placeTop('e', i, 50, horns ? 230 : 350);
  for (let i = 0; i < horns; i++) placeTop('h', i, 170, 350);
  // fairness: the player gets an extra starting hive against 2+ enemy hives
  const extraP = (wasps + horns >= 2 ? 1 : 0) + (wasps + horns >= 4 ? 1 : 0);
  for (let i = 0; i < extraP; i++) {
    for (let k = 0; k < 300; k++) {
      const r = rr(25, 29), x = rr(50, 350), y = rr(540, 665);
      if (okH(x, y, r)) { addH('p', x, y, r, Math.round(pStart * 0.6)); break; }
    }
  }
  let tries = 0;
  while (hives.length < hiveN && tries < 3000) {
    tries++;
    const r = rr(22, 32), x = rr(45, 355), y = rr(110, 600);
    if (okH(x, y, r)) addH('n', x, y, r, rr(4, 13) + n * 1.1 + (r - 22) * 0.5);
  }
  if (hives.length < 6) return null;
  const present = new Set();
  if (horns) present.add('hornets');
  const plainNeutral = () => hives.filter(h => h.owner === 'n' && h.type === 'normal');
  for (const ty of ['queen', 'fort', 'tower']) {
    if (!use.has(ty)) continue;
    const k = FEAT[ty] === n ? 1 : ri(1, 2);
    for (let i = 0; i < k; i++) {
      const c = plainNeutral(); if (!c.length) break;
      const h = c[Math.floor(R() * c.length)]; h.type = ty; if (ty !== 'queen') h.count += 5; present.add(ty);
    }
  }
  if (n >= 12 && chance(0.5)) {
    const opts = [['queen', 1], ['fort', 1], ['tower', 1]].filter(x => use.has(x[0]));
    const es = hives.filter(h => h.owner === 'e' && h.type === 'normal');
    if (opts.length && es.length) { const ty = wpick(opts); es[0].type = ty; present.add(ty); }
  }

  const mods = [];
  const shapeDist = (m, x, y) => {
    if (m.kind === 'wind') return segDist(x, y, m.ax, m.ay, m.bx, m.by) - m.w / 2;
    if (m.kind === 'wasp') return segDist(x, y, m.ax, m.ay, m.bx, m.by) - m.r;
    return Math.hypot(m.x - x, m.y - y) - m.r;
  };
  const okM = (x, y, r, pad) => x > r + 4 && x < MW - r - 4 && y > r + 30 && y < MH - r - 6 &&
    hives.every(h => Math.hypot(h.x - x, h.y - y) >= h.r + r + pad) && mods.every(m => shapeDist(m, x, y) >= r + 10);
  const between = (r, pad) => {
    for (let k = 0; k < 400; k++) {
      const a = hives[Math.floor(R() * hives.length)], b = hives[Math.floor(R() * hives.length)];
      if (a === b) continue;
      const q = rr(0.3, 0.7), L = Math.hypot(b.x - a.x, b.y - a.y) || 1, off = rr(-55, 55);
      const x = a.x + (b.x - a.x) * q + (b.y - a.y) / L * off, y = a.y + (b.y - a.y) * q - (b.x - a.x) / L * off;
      if (okM(x, y, r, pad)) return { x: x, y: y, a: a, b: b };
    }
    return null;
  };
  if (use.has('rocks')) {
    const k = ri(2, 4);
    for (let i = 0; i < k; i++) {
      for (let tr = 0; tr < 30; tr++) {
        const r = rr(20, 30), p = between(r, 18);
        if (!p) break;
        const poly = []; for (let j = 0; j < 8; j++) poly.push(0.78 + R() * 0.3);
        mods.push({ kind: 'rock', x: p.x, y: p.y, r: r, poly: poly, rot: R() * 6.28 });
        if (connected(hives, mods)) { present.add('rocks'); break; }
        mods.pop();
      }
    }
  }
  // flowers
  const fl = [['add10', 3], ['add25', 2], ['mul2', 2.2], ['mul3', 0.8]].filter(x => use.has(x[0]));
  const fTypes = fl.filter(x => FEAT[x[0]] === n).map(x => x[0]);
  const fN = n <= 2 ? ri(3, 4) : ri(3, 5);
  while (fTypes.length < fN) fTypes.push(wpick(fl));
  for (const k of fTypes) {
    const p = between(22, 14); if (!p) continue;
    const def = { add10: ['add', 10], add25: ['add', 25], mul2: ['mul', 2], mul3: ['mul', 3] }[k];
    mods.push({ kind: 'flower', op: def[0], v: def[1], x: p.x, y: p.y, r: 22, bloom: 0, rot: R() * 6.28 });
    present.add(k);
  }
  // spiders
  const sp = [['sub10', 3], ['div2', 1.6], ['sub20', 1.4]].filter(x => use.has(x[0]));
  if (sp.length) {
    const sTypes = sp.filter(x => FEAT[x[0]] === n).map(x => x[0]);
    const sN = Math.min(6, Math.max(1, Math.floor(n / 2)));
    while (sTypes.length < sN) sTypes.push(wpick(sp));
    for (const k of sTypes) {
      const p = between(24, 14); if (!p) continue;
      const def = { sub10: ['sub', 10], div2: ['div', 2], sub20: ['sub', 20] }[k];
      mods.push({ kind: 'spider', op: def[0], v: def[1], x: p.x, y: p.y, r: 24, bloom: 0, rot: R() * 6.28 });
      present.add(k);
    }
  }
  if (use.has('switch')) {
    const k = FEAT.switch === n ? 1 : ri(1, 2);
    for (let i = 0; i < k; i++) { const p = between(24, 16); if (p) { mods.push({ kind: 'switch', x: p.x, y: p.y, r: 24, ph: R() * 3, period: 3, bloom: 0 }); present.add('switch'); } }
  }
  if (use.has('dandelion')) {
    const k = ri(1, 2);
    for (let i = 0; i < k; i++) { const p = between(20, 14); if (p) { mods.push({ kind: 'dandelion', x: p.x, y: p.y, r: 20, v: 15 + ri(0, 3) * 5, alive: true, regrow: 0, bloom: 0 }); present.add('dandelion'); } }
  }
  if (use.has('wasp')) {
    const k = n >= 14 ? 2 : 1;
    for (let i = 0; i < k; i++) {
      for (let tr = 0; tr < 60; tr++) {
        const p = between(18, 30); if (!p) break;
        const ang = Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) + Math.PI / 2 + rr(-0.4, 0.4), half = rr(45, 65);
        const ax = p.x - Math.cos(ang) * half, ay = p.y - Math.sin(ang) * half, bx = p.x + Math.cos(ang) * half, by = p.y + Math.sin(ang) * half;
        if (okM(ax, ay, 18, 16) && okM(bx, by, 18, 16)) {
          mods.push({ kind: 'wasp', ax: ax, ay: ay, bx: bx, by: by, x: p.x, y: p.y, r: 18, v: 15, spd: rr(0.5, 0.8), ph: R() * 6.28, bloom: 0 });
          present.add('wasp'); break;
        }
      }
    }
  }
  if (use.has('wind')) {
    for (let tr = 0; tr < 60; tr++) {
      const p = between(28, 20); if (!p) break;
      let ang = Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) + rr(-0.3, 0.3); if (chance(0.5)) ang += Math.PI;
      const half = 80, ax = p.x - Math.cos(ang) * half, ay = p.y - Math.sin(ang) * half, bx = p.x + Math.cos(ang) * half, by = p.y + Math.sin(ang) * half;
      let ok = true;
      for (let s = 0; s <= 6 && ok; s++) { const x = ax + (bx - ax) * s / 6, y = ay + (by - ay) * s / 6; if (!okM(x, y, 26, 6)) ok = false; }
      if (ok) { const w = { kind: 'wind', ax: ax, ay: ay, bx: bx, by: by, w: 56 }; windDir(w); mods.push(w); present.add('wind'); break; }
    }
  }
  if (use.has('portal')) {
    let A = null, B = null;
    for (let tr = 0; tr < 200 && !A; tr++) { const x = rr(50, 350), y = rr(420, 590); if (okM(x, y, 22, 20)) A = { x: x, y: y }; }
    if (A) for (let tr = 0; tr < 200 && !B; tr++) { const x = rr(50, 350), y = rr(110, 330); if (okM(x, y, 22, 20) && Math.hypot(x - A.x, y - A.y) > 240) B = { x: x, y: y }; }
    if (A && B) {
      const pa = { kind: 'portal', x: A.x, y: A.y, r: 22, other: null }, pb = { kind: 'portal', x: B.x, y: B.y, r: 22, other: pa };
      pa.other = pb; mods.push(pa, pb); present.add('portal');
    }
  }
  if (use.has('puddle')) {
    const k = ri(1, 2);
    for (let i = 0; i < k; i++) { const p = between(30, 12); if (p) { const blob = []; for (let j = 0; j < 9; j++) blob.push(0.82 + R() * 0.22); mods.push({ kind: 'puddle', x: p.x, y: p.y, r: 30, blob: blob }); present.add('puddle'); } }
  }
  if (!connected(hives, mods)) return null;
  return {
    n: n, hives: hives, mods: mods, present: present, horns: horns,
    par: Math.round((45 + hives.length * 7 + (wasps + horns) * 12 + n * 1.5) * 1.2 * 1.15),
    enemyGrow: 0.85 * 0.9 * Math.min(1.3, 1 + 0.02 * (n - 1)), aiSpeed: 1.2 * 1.1 * Math.max(0.45, 1 - (n - 1) * 0.04)
  };
}

// ---------------------------------------------------------------- game state
let state = 'boot', prevState = 'menu';
let G = null, drag = null, clock = 0, lastAdAt = 0;
let introQueue = [];
const freeze = { api: false, ad: false };
const frozen = () => freeze.api || freeze.ad;

function makeGame(n) {
  const L = genLevel(n);
  mapEntities(L.hives, L.mods, (o, kx, ky) => { const p = fromMap({ x: o[kx], y: o[ky] }, LAY); o[kx] = p.x; o[ky] = p.y; });
  return {
    n: n, hives: L.hives, mods: L.mods, swarms: [], present: L.present, par: L.par, enemyGrow: L.enemyGrow, aiSpeed: L.aiSpeed,
    factions: L.horns ? ['e', 'h'] : ['e'], time: 0, lostHive: false, lastLost: null, aiT: { e: 5.2, h: 6.4 }, boostT: 0,
    cd: { honey: 0, boost: 0, smoke: 0 }, armed: null, usedContinue: false, x2Used: false, sentAny: false, sentT: -1,
    ended: null, endT: 0, shake: 0, stings: []
  };
}

// ---------------------------------------------------------------- particles & floats (pooled)
const PMAX = reduce ? 120 : 320;
const parts = [];
for (let i = 0; i < PMAX; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 2, grav: 0 });
let pIdx = 0;
function burst(x, y, color, n, sp, size, grav) {
  if (reduce) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const p = parts[pIdx]; pIdx = (pIdx + 1) % PMAX;
    const a = Math.random() * 6.283, v = sp * (0.3 + Math.random() * 0.7);
    p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.life = 0; p.max = 0.45 + Math.random() * 0.5;
    p.color = color; p.size = (size || 2.4) * (0.6 + Math.random() * 0.7); p.grav = grav || 0;
  }
}
const floats = [];
function floatText(x, y, text, color, size) { if (floats.length > 28) floats.shift(); floats.push({ x: x, y: y, text: text, color: color, size: size || 15, life: 0, max: 1.25 }); }

// ---------------------------------------------------------------- paths
function cumOf(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + (pts[i].j ? 0 : Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)));
  return c;
}
function smoothPiece(pc) {
  let p = [pc[0]];
  for (let i = 1; i < pc.length - 1; i++) { const l = p[p.length - 1]; if (Math.hypot(pc[i].x - l.x, pc[i].y - l.y) >= 12) p.push(pc[i]); }
  if (pc.length > 1) p.push(pc[pc.length - 1]);
  for (let it = 0; it < 2 && p.length > 2; it++) {
    const np = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      np.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    np.push(p[p.length - 1]); p = np;
  }
  return p;
}
function buildPath(raw) {
  const pieces = [[]];
  for (const p of raw) { if (p.j && pieces[pieces.length - 1].length) pieces.push([]); pieces[pieces.length - 1].push({ x: p.x, y: p.y }); }
  const out = [];
  pieces.forEach((pc, k) => { smoothPiece(pc).forEach((p, i) => out.push({ x: p.x, y: p.y, j: k > 0 && i === 0 })); });
  if (out.length === 1) out.push({ x: out[0].x + 0.01, y: out[0].y, j: false });
  return out;
}

// ---------------------------------------------------------------- modifiers
const isCountMod = m => m.kind === 'flower' || m.kind === 'spider' || m.kind === 'switch' || m.kind === 'dandelion' || m.kind === 'wasp';
const gtime = () => G ? G.time : clock;
function switchOp(m, time) { return Math.floor((time + m.ph) / m.period) % 2 === 0 ? { op: 'mul', v: 2 } : { op: 'div', v: 2 }; }
function waspPos(m, time) { const k = (Math.sin(time * m.spd + m.ph) + 1) / 2; return { x: m.ax + (m.bx - m.ax) * k, y: m.ay + (m.by - m.ay) * k }; }
function modOp(m, time) {
  if (m.kind === 'flower' || m.kind === 'spider') return { op: m.op, v: m.v };
  if (m.kind === 'switch') return switchOp(m, time);
  if (m.kind === 'dandelion') return { op: 'add', v: m.v };
  return { op: 'sub', v: m.v };
}
function applyOp(c, o) {
  if (o.op === 'add') return c + o.v;
  if (o.op === 'mul') return c * o.v;
  if (o.op === 'sub') return c - o.v;
  if (o.op === 'div') return Math.floor(c / o.v);
  return c;
}
const opLabel = o => (o.op === 'add' ? '+' : o.op === 'mul' ? '×' : o.op === 'sub' ? '−' : '÷') + o.v;
function zoneFactor(x, y, dx, dy) {
  let f = 1;
  for (const m of G.mods) {
    if (m.kind === 'wind') { if (segDist(x, y, m.ax, m.ay, m.bx, m.by) < m.w / 2) f *= clamp(1 + 0.8 * (dx * m.dx + dy * m.dy), 0.55, 1.8); }
    else if (m.kind === 'puddle') { if (Math.hypot(x - m.x, y - m.y) < m.r) f *= 0.45; }
  }
  return f;
}
// Simulate a path: returns predicted count, the modifiers hit (with good/bad) and flight time.
function predict(pts, count, owner) {
  const used = new Map(); let c = count, tt = 0;
  const t0 = G.time, boostLeft = owner === 'p' ? G.boostT : 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (b.j) continue;
    const L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 0.01) continue;
    const dx = (b.x - a.x) / L, dy = (b.y - a.y) / L, n = Math.ceil(L / 6);
    for (let s = 1; s <= n; s++) {
      const x = a.x + dx * L * s / n, y = a.y + dy * L * s / n;
      tt += (L / n) / (SPEED * zoneFactor(x, y, dx, dy) * (tt < boostLeft ? 2 : 1));
      for (const m of G.mods) {
        if (!isCountMod(m) || used.has(m)) continue;
        if (m.kind === 'dandelion' && !m.alive) continue;
        let mx = m.x, my = m.y;
        if (m.kind === 'wasp') { const p = waspPos(m, t0 + tt); mx = p.x; my = p.y; }
        if (Math.hypot(x - mx, y - my) < m.r + 4) {
          const before = c; c = Math.min(999, applyOp(c, modOp(m, t0 + tt)));
          used.set(m, c >= before);
          if (c <= 0) return { c: 0, used: used, tt: tt };
        }
      }
    }
  }
  return { c: c, used: used, tt: tt };
}

// ---------------------------------------------------------------- swarms
function makeSwarm(owner, count, raw, target) {
  const pts = buildPath(raw), cum = cumOf(pts);
  return { owner: owner, count: count, pts: pts, cum: cum, total: cum[cum.length - 1], d: 0, seg: 0, x: pts[0].x, y: pts[0].y, hx: 1, hy: 0,
    used: new Set(), target: target, trail: [], trailT: 0, dead: false, bees: [] };
}
const swarmRad = s => Math.min(26, 6 + Math.sqrt(Math.max(1, s.count)) * 1.6);
function portalFx(a, b) {
  burst(a.x, a.y, '#5fe0d0', 14, 90, 2.4); burst(b.x, b.y, '#ff8be8', 14, 90, 2.4); Sfx.play('portal');
}
function hitMod(s, m) {
  const before = s.count, o = modOp(m, G.time);
  s.count = Math.min(999, applyOp(s.count, o));
  m.bloom = 1;
  const good = s.count >= before;
  floatText(m.x, m.y - m.r - 10, opLabel(o), good ? '#c8f2b0' : '#ff8a7a', 18);
  burst(m.x, m.y, good ? '#bff0a6' : '#ff5f4f', good ? 10 : 8, 70, 2.2);
  Sfx.play(good ? 'good' : 'bad');
  if (m.kind === 'dandelion') { m.alive = false; m.regrow = 25; burst(m.x, m.y, '#fffaf0', 18, 60, 1.6, -20); }
  if (s.count <= 0) { s.count = 0; s.dead = true; floatText(s.x, s.y - 18, t('died'), '#ff8a7a', 13); burst(s.x, s.y, FAC[s.owner].c, 12, 60, 1.8); }
}
function arrive(s) {
  const h = s.target; h.pulse = 1;
  if (h.owner === s.owner) { h.count += s.count; burst(h.x, h.y, FAC[s.owner].hi, 6, 50, 2); return; }
  const mult = h.type === 'fort' ? 1 / 1.5 : 1;
  h.count -= Math.floor(s.count * mult);
  if (h.count < 0) {
    const prev = h.owner;
    h.count = Math.max(1, Math.round(-h.count / mult));
    h.owner = s.owner; h.flip = 1; h.flipFrom = prev; h.grow = 0; h.smoke = 0;
    burst(h.x, h.y, FAC[s.owner].c, 34, 150, 3); burst(h.x, h.y, '#fff3d6', 10, 90, 2);
    if (prev === 'p') { G.lostHive = true; G.lastLost = h; floatText(h.x, h.y - h.r - 14, t('lost'), '#ff8a7a', 15); Sfx.play('lostHive'); G.shake = Math.max(G.shake, 0.6); }
    if (s.owner === 'p') { floatText(h.x, h.y - h.r - 14, '+' + t('captured'), FAC.p.hi, 16); Sfx.play('capture'); G.shake = Math.max(G.shake, 0.45); }
  } else {
    burst(h.x, h.y, FAC[s.owner].c, 7, 70, 2);
    if (s.owner === 'p' || h.owner === 'p') Sfx.play('fight');
  }
}

// ---------------------------------------------------------------- AI
function aiTick(f) {
  const mine = G.hives.filter(h => h.owner === f && h.count >= 10 && h.smoke <= 0);
  if (!mine.length) return;
  mine.sort((a, b) => (b.count + rnd(0, 10)) - (a.count + rnd(0, 10)));
  const src = mine[0], send = Math.floor(src.count / 2);
  let best = null, bs = Infinity;
  for (const h of G.hives) {
    if (h.owner === f || !rocksClear(src, h, G.mods, 2)) continue;
    let sc = h.count * (h.type === 'fort' ? 1.5 : 1) + dist(src, h) * 0.05 + rnd(0, 6);
    if (h.owner === 'p') sc -= 3;
    if (h.type !== 'normal') sc -= 3;
    if (sc < bs) { bs = sc; best = h; }
  }
  if (!best) return;
  const need = best.count * (best.type === 'fort' ? 1.5 : 1);
  const routes = [[{ x: src.x, y: src.y }, { x: best.x, y: best.y }]];
  if (G.n >= 3 || Math.random() < 0.4) {
    const direct = dist(src, best);
    for (const m of G.mods) {
      if (m.kind !== 'flower' && !(m.kind === 'dandelion' && m.alive)) continue;
      if (dist(src, m) + dist(m, best) > direct * 1.7) continue;
      if (!rocksClear(src, m, G.mods, 2) || !rocksClear(m, best, G.mods, 2)) continue;
      routes.push([{ x: src.x, y: src.y }, { x: m.x, y: m.y }, { x: best.x, y: best.y }]);
    }
  }
  const smart = Math.min(1, 0.25 + G.n * 0.07);
  let route = routes[0], val = -Infinity, cnt = send;
  for (const r of routes) {
    const pr = predict(buildPath(r), send, f);
    const v = pr.c - pr.tt * 0.6 + (Math.random() > smart ? rnd(-20, 20) : 0);
    if (v > val) { val = v; route = r; cnt = pr.c; }
  }
  // not enough alone: recruit helper hives for a coordinated strike (breaks capped stalemates)
  const helpers = [];
  if (cnt < need * 0.85) {
    let sum = cnt;
    const cand = mine.filter(h => h !== src && rocksClear(h, best, G.mods, 2)).sort((a, b) => dist(a, best) - dist(b, best));
    for (const h of cand) {
      if (sum >= need * 0.95 || helpers.length >= 3) break;
      const hs = Math.floor(h.count / 2);
      const pr = predict(buildPath([{ x: h.x, y: h.y }, { x: best.x, y: best.y }]), hs, f);
      if (pr.c > 0) { helpers.push(h); sum += pr.c; }
    }
    const capped = src.count >= src.cap * 0.95;
    if (sum < need * 0.9 && !(capped && Math.random() < 0.5) && Math.random() < 0.8) return;
    if (sum < need * 0.9 && !capped) helpers.length = 0;
  }
  src.count -= send; src.pulse = 0.5;
  G.swarms.push(makeSwarm(f, send, route, best));
  for (const h of helpers) {
    const hs = Math.floor(h.count / 2); h.count -= hs; h.pulse = 0.5;
    G.swarms.push(makeSwarm(f, hs, [{ x: h.x, y: h.y }, { x: best.x, y: best.y }], best));
  }
}

// ---------------------------------------------------------------- abilities
function useAbility(k) {
  if (state !== 'play' || !G || G.ended || frozen()) return;
  if (G.n < AB_UNLOCK[k]) return;
  if (G.cd[k] > 0) { Sfx.play('bad'); return; }
  Sfx.play('click');
  if (k === 'boost') {
    G.boostT = 4; G.cd.boost = AB_CD.boost; G.armed = null; Sfx.play('ability');
    for (const s of G.swarms) if (s.owner === 'p') burst(s.x, s.y, '#ffe08a', 8, 80, 2);
    return;
  }
  G.armed = G.armed === k ? null : k;
  if (G.armed) toast(k === 'honey' ? t('pick_own') : t('pick_enemy'));
}
function applyArmed(h) {
  const k = G.armed; G.armed = null;
  if (!h) return;
  if (k === 'honey' && h.owner === 'p') {
    h.count += 15; h.pulse = 1; G.cd.honey = AB_CD.honey;
    floatText(h.x, h.y - h.r - 12, '+15', FAC.p.hi, 18); burst(h.x, h.y, '#f5a623', 18, 90, 2.6, 60); Sfx.play('ability');
  } else if (k === 'smoke' && (h.owner === 'e' || h.owner === 'h')) {
    h.smoke = 5; G.cd.smoke = AB_CD.smoke; burst(h.x, h.y, '#cfc6bc', 20, 70, 4, -30); Sfx.play('ability');
  } else Sfx.play('bad');
}

// ---------------------------------------------------------------- update
function update(dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 2.5);
  G.boostT = Math.max(0, G.boostT - dt);
  for (const k in G.cd) G.cd[k] = Math.max(0, G.cd[k] - dt);
  for (const h of G.hives) {
    h.pulse = Math.max(0, h.pulse - dt * 3);
    h.flip = Math.max(0, h.flip - dt * 2);
    h.smoke = Math.max(0, h.smoke - dt);
    if (h.owner !== 'n' && h.smoke <= 0 && h.count < h.cap) {
      const rate = 1.25 * (h.r / 28) * (h.type === 'queen' ? 2 : 1) * (h.owner === 'p' ? 1 : G.enemyGrow);
      h.grow += dt * rate;
      while (h.grow >= 1) { h.grow -= 1; if (h.count < h.cap) h.count++; }
    }
  }
  for (const m of G.mods) {
    if (m.bloom) m.bloom = Math.max(0, m.bloom - dt * 2);
    if (m.kind === 'wasp') { const p = waspPos(m, G.time); m.x = p.x; m.y = p.y; }
    else if (m.kind === 'dandelion' && !m.alive) { m.regrow -= dt; if (m.regrow <= 0) { m.alive = true; m.bloom = 1; } }
  }
  // swarms
  for (const s of G.swarms) {
    if (s.dead) continue;
    const boost = s.owner === 'p' && G.boostT > 0 ? 2 : 1;
    s.d += SPEED * zoneFactor(s.x, s.y, s.hx, s.hy) * boost * dt;
    if (s.d >= s.total) { arrive(s); s.dead = true; continue; }
    while (s.seg < s.pts.length - 2 && s.cum[s.seg + 1] <= s.d) {
      s.seg++;
      if (s.pts[s.seg].j) { portalFx(s.pts[s.seg - 1], s.pts[s.seg]); s.trail.length = 0; }
    }
    const a = s.pts[s.seg], b = s.pts[s.seg + 1], sl = s.cum[s.seg + 1] - s.cum[s.seg];
    const k = sl > 0 ? clamp((s.d - s.cum[s.seg]) / sl, 0, 1) : 1;
    s.x = a.x + (b.x - a.x) * k; s.y = a.y + (b.y - a.y) * k;
    if (sl > 0) { s.hx = (b.x - a.x) / sl; s.hy = (b.y - a.y) / sl; }
    s.trailT += dt;
    if (s.trailT > 0.04) { s.trailT = 0; s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 9) s.trail.shift(); }
    for (const m of G.mods) {
      if (!isCountMod(m) || s.used.has(m)) continue;
      if (m.kind === 'dandelion' && !m.alive) continue;
      if (Math.hypot(m.x - s.x, m.y - s.y) < m.r + 4) { s.used.add(m); hitMod(s, m); if (s.dead) break; }
    }
    const want = Math.min(36, Math.max(1, s.count));
    while (s.bees.length < want) s.bees.push({ a: Math.random() * 6.283, r: Math.sqrt(Math.random()), w: 1.2 + Math.random() * 2.4, ph: Math.random() * 6.283, sz: 0.8 + Math.random() * 0.3 });
    if (s.bees.length > want) s.bees.length = want;
  }
  // mid-air fights
  const S = G.swarms;
  for (let i = 0; i < S.length; i++) {
    const a = S[i]; if (a.dead) continue;
    for (let j = i + 1; j < S.length; j++) {
      const b = S[j]; if (b.dead || b.owner === a.owner) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < (swarmRad(a) + swarmRad(b)) * 0.5 + 4) {
        const m = Math.min(a.count, b.count);
        a.count -= m; b.count -= m;
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        burst(x, y, '#fff3d6', 16, 100, 2); floatText(x, y - 18, '−' + m, '#fff3d6', 14);
        if (a.owner === 'p' || b.owner === 'p') Sfx.play('fight');
        if (a.count <= 0) a.dead = true;
        if (b.count <= 0) b.dead = true;
        if (a.dead) break;
      }
    }
  }
  // towers
  for (const h of G.hives) {
    if (h.type !== 'tower' || h.owner === 'n') continue;
    h.towerT -= dt; if (h.towerT > 0) continue;
    let best = null, bd = TOWER_R;
    for (const s of S) { if (s.dead || s.owner === h.owner) continue; const d = Math.hypot(s.x - h.x, s.y - h.y); if (d < bd) { bd = d; best = s; } }
    if (best) {
      best.count -= 1; h.towerT = 0.4;
      G.stings.push({ x1: h.x, y1: h.y - h.r * 0.9, x2: best.x, y2: best.y, life: 0.16 });
      if (best.owner === 'p' || h.owner === 'p') Sfx.play('sting');
      if (best.count <= 0) { best.dead = true; burst(best.x, best.y, FAC[best.owner].c, 10, 60, 1.8); }
    } else h.towerT = 0.1;
  }
  G.swarms = S.filter(s => !s.dead);
  for (const st of G.stings) st.life -= dt;
  G.stings = G.stings.filter(st => st.life > 0);
  // AI
  if (!G.ended) {
    for (const f of G.factions) { G.aiT[f] -= dt; if (G.aiT[f] <= 0) { aiTick(f); G.aiT[f] = rnd(2, 4) * G.aiSpeed * (f === 'h' ? 1.15 : 1); } }
    const alive = o => G.hives.some(h => h.owner === o) || G.swarms.some(s => s.owner === o);
    if (!alive('p')) { G.ended = 'lose'; G.endT = 1.0; drag = null; G.armed = null; }
    else if (!alive('e') && !alive('h')) { G.ended = 'win'; G.endT = 1.0; drag = null; G.armed = null; }
  } else {
    G.endT -= dt;
    if (G.endT <= 0 && state === 'play') finishLevel(G.ended);
  }
  // tutorial tip fade
  if (tipOn && ((G.sentT >= 0 && G.time - G.sentT > 4) || G.time > 14)) hideTip();
}
function updEffects(dt) {
  for (const p of parts) {
    if (!p.on) continue;
    p.life += dt; if (p.life >= p.max) { p.on = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + p.grav * dt;
  }
  for (const f of floats) { f.life += dt; f.y -= 22 * dt; }
  while (floats.length && floats[0].life >= floats[0].max) floats.shift();
  for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life >= floats[i].max) floats.splice(i, 1);
}

// ---------------------------------------------------------------- input
function toWorld(e) { return { x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale }; }
function hiveAt(p, pad) {
  let best = null, bd = Infinity;
  for (const h of G.hives) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d < h.r + pad && d < bd) { bd = d; best = h; } }
  return best;
}
function rawFor(d, src, end) {
  const r = [{ x: src.h.x, y: src.h.y }];
  for (let i = src.idx + 1; i < d.pts.length; i++) r.push(d.pts[i]);
  if (d.portal) r.push({ x: d.portal.to.x, y: d.portal.to.y, j: true });
  r.push({ x: end.x, y: end.y });
  return r;
}
function canPlay() { return state === 'play' && G && !G.ended && !frozen(); }
cv.addEventListener('pointerdown', e => {
  Sfx.unlock();
  if (!canPlay()) return;
  e.preventDefault();
  const p = toWorld(e);
  if (G.armed) { applyArmed(hiveAt(p, 14)); return; }
  if (drag) return;
  const h = hiveAt(p, 14);
  if (!h || h.owner !== 'p') return;
  drag = { id: e.pointerId, sources: [{ h: h, idx: 0 }], pts: [{ x: h.x, y: h.y }], len: 0, cur: p, hover: h, portal: null,
    blockedNow: false, endBlocked: false, tooLong: false, pred: null, predT: -1 };
  h.pulse = 0.5;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
function dragMove(p) {
  drag.cur = p;
  const last = drag.pts[drag.pts.length - 1];
  if (!drag.portal) {
    const d = dist(last, p);
    if (d >= 6) {
      if (!rocksClear(last, p, G.mods, 1)) drag.blockedNow = true;
      else if (drag.len + d > MAXLEN) drag.tooLong = true;
      else {
        drag.blockedNow = false; drag.tooLong = false;
        let pt = null;
        for (const m of G.mods) if (m.kind === 'portal' && segDist(m.x, m.y, last.x, last.y, p.x, p.y) < m.r) { pt = m; break; }
        if (pt) { drag.len += dist(last, pt); drag.pts.push({ x: pt.x, y: pt.y }); drag.portal = { from: pt, to: pt.other }; Sfx.play('portal'); burst(pt.x, pt.y, '#5fe0d0', 10, 70, 2); }
        else { drag.pts.push({ x: p.x, y: p.y }); drag.len += d; }
      }
    }
  }
  const h = hiveAt(p, 6);
  drag.hover = h;
  if (!drag.portal && h && h.owner === 'p' && h.count >= 2 && !drag.sources.some(s => s.h === h)) { drag.sources.push({ h: h, idx: drag.pts.length - 1 }); h.pulse = 0.6; }
}
function dragTarget() {
  const h = drag.hover;
  if (!h) return null;
  if (drag.sources.every(s => s.h === h)) return null;
  return h;
}
function updatePreview() {
  const tg = dragTarget();
  const end = tg ? { x: tg.x, y: tg.y } : drag.cur;
  const from = drag.portal ? drag.portal.to : drag.pts[drag.pts.length - 1];
  drag.endBlocked = !rocksClear(from, end, G.mods, 1);
  let total = 0; const used = new Map();
  for (const s of drag.sources) {
    if (s.h === tg || s.h.owner !== 'p') continue;
    const n = sendCount(s.h.count); if (n < 1) continue;
    const pr = predict(buildPath(rawFor(drag, s, end)), n, 'p');
    total += pr.c; pr.used.forEach((v, m) => used.set(m, v));
  }
  const dmg = tg && tg.owner !== 'p' ? Math.floor(total * (tg.type === 'fort' ? 1 / 1.5 : 1)) : 0;
  drag.pred = { c: total, used: used, tg: tg, capture: !!tg && tg.owner !== 'p' && dmg > tg.count };
  drag.totalLen = drag.len + dist(from, end);
  drag.predT = clock;
}
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  e.preventDefault();
  if (!canPlay()) { drag = null; return; }
  let evs = null;
  try { evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null; } catch (err) { evs = null; }
  if (!evs || !evs.length) evs = [e];
  for (const ev of evs) dragMove(toWorld(ev));
  if (clock - drag.predT > 0.03) updatePreview();
});
function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (cancel || !canPlay()) return;
  const p = toWorld(e);
  const tg = hiveAt(p, 10);
  if (!tg) return;
  const srcs = d.sources.filter(s => s.h !== tg && s.h.owner === 'p' && s.h.count >= 2);
  if (!srcs.length) return;
  const end = { x: tg.x, y: tg.y }, from = d.portal ? d.portal.to : d.pts[d.pts.length - 1];
  if (!rocksClear(from, end, G.mods, 1)) { toast(t('blocked')); Sfx.play('bad'); return; }
  if (d.len + dist(from, end) > MAXLEN * 1.1) { toast(t('too_long')); Sfx.play('bad'); return; }
  for (const s of srcs) {
    const n = sendCount(s.h.count); if (n < 1) continue;
    s.h.count -= n; s.h.pulse = 0.6;
    G.swarms.push(makeSwarm('p', n, rawFor(d, s, end), tg));
  }
  Sfx.play('send');
  if (!G.sentAny) { G.sentAny = true; G.sentT = G.time; }
}
cv.addEventListener('pointerup', e => endDrag(e, false));
cv.addEventListener('pointercancel', e => endDrag(e, true));
cv.addEventListener('lostpointercapture', e => { if (drag && e.pointerId === drag.id) drag = null; });

// ---------------------------------------------------------------- rendering: background
const bg = document.createElement('canvas'), bgx = bg.getContext('2d');
function buildBackground() {
  bg.width = cv.width; bg.height = cv.height;
  const b = bgx; b.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = b.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#150f27'); g.addColorStop(0.42, '#2a1630'); g.addColorStop(0.78, '#4b2418'); g.addColorStop(1, '#24130d');
  b.fillStyle = g; b.fillRect(0, 0, vw, vh);
  const sun = b.createRadialGradient(vw * 0.68, vh * 0.8, 10, vw * 0.68, vh * 0.8, Math.max(vw, vh) * 0.6);
  sun.addColorStop(0, 'rgba(255,150,70,0.35)'); sun.addColorStop(0.4, 'rgba(255,110,60,0.12)'); sun.addColorStop(1, 'rgba(255,110,60,0)');
  b.fillStyle = sun; b.fillRect(0, 0, vw, vh);
  const R = rng(4242);
  // distant hills
  const hill = (base, amp, col, freq) => {
    b.fillStyle = col; b.beginPath(); b.moveTo(0, vh);
    for (let x = 0; x <= vw + 20; x += 20) b.lineTo(x, base + Math.sin(x * freq + amp) * amp * 0.6 + Math.sin(x * freq * 2.7) * amp * 0.25);
    b.lineTo(vw, vh); b.closePath(); b.fill();
  };
  hill(vh * 0.62, 26, 'rgba(40,20,40,0.55)', 0.006);
  hill(vh * 0.74, 22, 'rgba(30,16,22,0.6)', 0.009);
  // blurred flower silhouettes
  const canBlur = 'filter' in b;
  const cols = ['#ff9fc4', '#ffd36e', '#9fd08a', '#b27dff', '#ff8a5c'];
  const nF = Math.min(70, Math.round(vw * vh / 16000));
  for (let i = 0; i < nF; i++) {
    const x = R() * vw, y = vh * (0.25 + R() * 0.8), s = 8 + R() * 26 * (y / vh), col = cols[Math.floor(R() * cols.length)];
    if (canBlur) b.filter = 'blur(' + (2 + R() * 4).toFixed(1) + 'px)';
    b.globalAlpha = 0.08 + R() * 0.14; b.fillStyle = col;
    for (let k = 0; k < 5; k++) { const a = k * 1.2566 + R(); b.beginPath(); b.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.45, s * 0.3, a, 0, 6.283); b.fill(); }
    b.fillStyle = '#ffe08a'; b.beginPath(); b.arc(x, y, s * 0.28, 0, 6.283); b.fill();
  }
  if (canBlur) b.filter = 'none';
  b.globalAlpha = 1;
  // grass silhouettes
  b.strokeStyle = 'rgba(14,8,10,0.75)'; b.lineCap = 'round';
  for (let x = -10; x < vw + 10; x += 5 + R() * 6) {
    const h = 14 + R() * 40; b.lineWidth = 2 + R() * 2.5;
    b.beginPath(); b.moveTo(x, vh + 2); b.quadraticCurveTo(x + (R() - 0.5) * 10, vh - h * 0.6, x + (R() - 0.5) * 18, vh - h); b.stroke();
  }
  // play field panel
  const px = offX - 10, py = offY - 10, pw = LAY.W * scale + 20, ph = LAY.H * scale + 20, rad = 26;
  b.save();
  b.beginPath(); roundRect(b, px, py, pw, ph, rad);
  b.fillStyle = 'rgba(255,214,150,0.045)'; b.fill();
  b.clip();
  const hr = Math.max(14, 20 * scale), hw = Math.sqrt(3) * hr;
  b.strokeStyle = 'rgba(255,191,60,0.05)'; b.lineWidth = 1;
  for (let row = 0, y = py; y < py + ph + hr; row++, y = py + row * hr * 1.5)
    for (let x = px + ((row & 1) ? hw / 2 : 0); x < px + pw + hw; x += hw) { hexPath(b, x, y, hr); b.stroke(); }
  b.restore();
  b.beginPath(); roundRect(b, px, py, pw, ph, rad); b.strokeStyle = 'rgba(255,191,60,0.10)'; b.lineWidth = 1.5; b.stroke();
  const v = b.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.4, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  b.fillStyle = v; b.fillRect(0, 0, vw, vh);
}
function roundRect(c, x, y, w, h, r) {
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function hexPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
  c.closePath();
}
// pollen (screen space)
const pollen = [];
for (let i = 0; i < (reduce ? 10 : 34); i++) pollen.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, v: 0.006 + Math.random() * 0.012, ph: Math.random() * 6.28 });
function updPollen(dt) { for (const p of pollen) { p.y -= p.v * dt; p.x += Math.sin(clock * 0.5 + p.ph) * 0.0006; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); } } }

// ---------------------------------------------------------------- rendering: sprites
const SPR = { p: [], e: [], h: [] };
let sprS = 0;
function drawBug(c, fac, wing) {
  c.save(); c.translate(16, 16);
  if (fac === 'h') c.scale(1.08, 1.08);
  c.fillStyle = 'rgba(232,242,255,0.72)';
  const wl = wing ? 9 : 6.5, ww = wing ? 4.6 : 3;
  c.beginPath(); c.ellipse(-1, -5, wl, ww, wing ? -0.6 : -0.25, 0, 6.283); c.fill();
  c.beginPath(); c.ellipse(-1, 5, wl, ww, wing ? 0.6 : 0.25, 0, 6.283); c.fill();
  if (fac === 'p') {
    c.fillStyle = '#ffc23d'; c.beginPath(); c.ellipse(-1, 0, 10, 7, 0, 0, 6.283); c.fill();
    c.save(); c.clip(); c.fillStyle = '#22160c'; c.fillRect(-6, -8, 3, 16); c.fillRect(0, -8, 3, 16); c.restore();
    c.fillStyle = '#22160c'; c.beginPath(); c.arc(10, 0, 4.4, 0, 6.283); c.fill();
    c.beginPath(); c.moveTo(-10.5, -1.5); c.lineTo(-15, 0); c.lineTo(-10.5, 1.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(-2, -3.5, 4, 1.5, 0, 0, 6.283); c.fill();
  } else {
    const body = fac === 'e' ? '#ff5a3c' : '#a873ff', dark = fac === 'e' ? '#2a0d08' : '#1b0f2e';
    c.fillStyle = body; c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(-8, -7, -1, -4.5); c.quadraticCurveTo(1.5, 0, -1, 4.5); c.quadraticCurveTo(-8, 7, -15, 0); c.fill();
    c.save(); c.clip(); c.fillStyle = dark; c.fillRect(-11.5, -8, 2.2, 16); c.fillRect(-7, -8, 2.2, 16); c.fillRect(-3, -8, 2, 16); c.restore();
    c.fillStyle = dark; c.beginPath(); c.ellipse(4, 0, 4.6, 4, 0, 0, 6.283); c.fill();
    c.fillStyle = body; c.beginPath(); c.arc(10.5, 0, 3.6, 0, 6.283); c.fill();
    c.strokeStyle = dark; c.lineWidth = 1; c.beginPath(); c.moveTo(13, -1.5); c.lineTo(16, -4.5); c.moveTo(13, 1.5); c.lineTo(16, 4.5); c.stroke();
  }
  c.restore();
}
function buildSprites() {
  const S = Math.max(10, Math.min(96, Math.round(BEE_W * 1.25 * scale * dpr)));
  if (S === sprS) return;
  sprS = S;
  for (const f of ['p', 'e', 'h']) {
    SPR[f] = [];
    for (let w = 0; w < 2; w++) {
      const c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'); x.scale(S / 32, S / 32); drawBug(x, f, w); SPR[f].push(c);
    }
  }
}
function setWorld() { X.setTransform(WM.a, 0, 0, WM.a, WM.e, WM.f); }
function drawSprite(fac, wing, wx, wy, ang, size) {
  const spr = SPR[fac][wing]; if (!spr) return;
  const S = spr.width, m = WM.a * size / S * (32 / 26), c = Math.cos(ang) * m, s = Math.sin(ang) * m;
  X.setTransform(c, s, -s, c, WM.e + wx * WM.a, WM.f + wy * WM.a);
  X.drawImage(spr, -S / 2, -S / 2);
}

// ---------------------------------------------------------------- rendering: entities
function text(str, x, y, size, color, outline) {
  X.font = size + 'px ' + FONT; X.textAlign = 'center'; X.textBaseline = 'middle';
  if (outline) { X.lineWidth = Math.max(2, size * 0.24); X.strokeStyle = outline; X.lineJoin = 'round'; X.strokeText(str, x, y); }
  X.fillStyle = color; X.fillText(str, x, y);
}
function crown(x, y, s) {
  X.fillStyle = '#ffd36e'; X.strokeStyle = '#6e440c'; X.lineWidth = 1.5;
  X.beginPath(); X.moveTo(x - s, y + s * 0.5); X.lineTo(x - s, y - s * 0.4); X.lineTo(x - s * 0.5, y + s * 0.05); X.lineTo(x, y - s * 0.7);
  X.lineTo(x + s * 0.5, y + s * 0.05); X.lineTo(x + s, y - s * 0.4); X.lineTo(x + s, y + s * 0.5); X.closePath(); X.fill(); X.stroke();
  X.fillStyle = '#ff5f4f'; X.beginPath(); X.arc(x, y + s * 0.15, s * 0.16, 0, 6.283); X.fill();
}
function drawHive(h) {
  let F = FAC[h.owner];
  let sx = 1;
  if (h.flip > 0) { sx = Math.max(0.05, Math.abs(Math.cos(h.flip * Math.PI))); if (h.flip > 0.5 && h.flipFrom) F = FAC[h.flipFrom]; }
  const pul = h.pulse > 0 ? Math.sin(h.pulse * Math.PI) * 0.12 : 0, r = h.r, tm = clock;
  if (h.type === 'tower' && h.owner !== 'n') {
    X.save(); X.setLineDash([3, 7]); X.lineDashOffset = -tm * 6; X.strokeStyle = F.c; X.globalAlpha = 0.22; X.lineWidth = 1.5;
    X.beginPath(); X.arc(h.x, h.y, TOWER_R, 0, 6.283); X.stroke(); X.restore();
  }
  X.save(); X.translate(h.x, h.y); X.scale(sx * (1 + pul), 1 + pul);
  X.fillStyle = 'rgba(0,0,0,0.3)'; X.beginPath(); X.ellipse(0, r * 0.92, r * 0.9, r * 0.28, 0, 0, 6.283); X.fill();
  if (h.owner !== 'n') { X.globalAlpha = 0.14 + 0.28 * h.pulse; X.fillStyle = F.c; hexPath(X, 0, 0, r * 1.3); X.fill(); X.globalAlpha = 1; }
  hexPath(X, 0, 0, r); X.fillStyle = F.d; X.fill();
  // honey level
  X.save(); hexPath(X, 0, 0, r - 2.5); X.clip();
  const lvl = clamp(h.count / h.cap, 0, 1), top = r - 2 * r * lvl;
  const hg = X.createLinearGradient(0, top, 0, r);
  if (h.owner === 'n') { hg.addColorStop(0, 'rgba(230,200,150,0.55)'); hg.addColorStop(1, 'rgba(150,110,60,0.55)'); }
  else { hg.addColorStop(0, 'rgba(255,214,110,0.95)'); hg.addColorStop(1, 'rgba(196,110,20,0.95)'); }
  X.fillStyle = hg; X.beginPath(); X.moveTo(-r, r);
  for (let x = -r; x <= r; x += r / 4) X.lineTo(x, top + Math.sin(tm * 3 + x * 0.3 + h.id) * 1.6);
  X.lineTo(r, r); X.closePath(); X.fill();
  X.strokeStyle = 'rgba(0,0,0,0.18)'; X.lineWidth = 1;
  const cr = r * 0.3;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; hexPath(X, Math.cos(a) * cr * 1.75, Math.sin(a) * cr * 1.75, cr); X.stroke(); }
  hexPath(X, 0, 0, cr); X.stroke();
  X.restore();
  hexPath(X, 0, 0, r); X.lineWidth = 4; X.strokeStyle = F.c; X.stroke();
  if (h.type === 'fort') {
    X.setLineDash([7, 4]); hexPath(X, 0, 0, r + 5); X.lineWidth = 3.5; X.strokeStyle = '#fff3d6'; X.globalAlpha = 0.7; X.stroke(); X.setLineDash([]); X.globalAlpha = 1;
    X.fillStyle = '#e8d8b8';
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; hexPath(X, Math.cos(a) * (r + 5), Math.sin(a) * (r + 5), 4.5); X.fill(); }
  } else if (h.type === 'queen') {
    crown(0, -r - 9, 9);
  } else if (h.type === 'tower') {
    X.fillStyle = F.c; X.strokeStyle = '#1e130d'; X.lineWidth = 1.5;
    X.beginPath(); X.moveTo(-7, -r + 2); X.lineTo(-5, -r - 10); X.lineTo(5, -r - 10); X.lineTo(7, -r + 2); X.closePath(); X.fill(); X.stroke();
    X.beginPath(); X.moveTo(-2.5, -r - 10); X.lineTo(0, -r - 19); X.lineTo(2.5, -r - 10); X.closePath(); X.fillStyle = '#1e130d'; X.fill();
  }
  if (h.owner !== 'n' && h.count < h.cap && h.smoke <= 0) {
    X.globalAlpha = 0.55; X.strokeStyle = F.hi; X.lineWidth = 2;
    X.beginPath(); X.arc(0, 0, r + (h.type === 'fort' ? 11 : 6), -Math.PI / 2, -Math.PI / 2 + 6.283 * h.grow); X.stroke(); X.globalAlpha = 1;
  }
  const big = h.count >= 100;
  text(String(h.count), 0, 1, Math.round(r * (big ? 0.66 : 0.8)), h.owner === 'n' ? '#fff3d6' : F.hi, 'rgba(20,10,6,0.75)');
  if (h.smoke > 0) {
    X.globalAlpha = Math.min(1, h.smoke) * 0.75; X.fillStyle = '#cfc6bc';
    for (let i = 0; i < 5; i++) { const a = tm * 0.8 + i * 1.256; X.beginPath(); X.arc(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.5 - 4, r * 0.38, 0, 6.283); X.fill(); }
    X.globalAlpha = 1;
  }
  X.restore();
}
function drawMod(m) {
  const tm = clock;
  switch (m.kind) {
    case 'flower': {
      const tier = m.op === 'mul' ? (m.v >= 3 ? 2 : 1) : 0;
      const pc = tier === 0 ? '#9fd08a' : tier === 1 ? '#ffd36e' : '#ff8fc8';
      const cc = tier === 0 ? '#2f5a33' : tier === 1 ? '#7a420e' : '#6e1a4c';
      const sc = 1 + 0.3 * Math.sin((m.bloom || 0) * Math.PI);
      X.save(); X.translate(m.x, m.y);
      X.globalAlpha = 0.16; X.fillStyle = pc; X.beginPath(); X.arc(0, 0, m.r * 1.35, 0, 6.283); X.fill(); X.globalAlpha = 1;
      X.save(); X.rotate((m.rot || 0) + (reduce ? 0 : Math.sin(tm * 1.1 + (m.rot || 0)) * 0.12)); X.scale(sc, sc);
      const np = tier === 2 ? 8 : 6;
      X.fillStyle = pc; X.strokeStyle = 'rgba(0,0,0,0.22)'; X.lineWidth = 1;
      for (let i = 0; i < np; i++) { X.rotate(6.283 / np); X.beginPath(); X.ellipse(0, -m.r * 0.64, m.r * 0.33, m.r * 0.5, 0, 0, 6.283); X.fill(); X.stroke(); }
      X.restore();
      X.beginPath(); X.arc(0, 0, m.r * 0.6, 0, 6.283); X.fillStyle = cc; X.fill();
      X.lineWidth = 2; X.strokeStyle = 'rgba(255,243,214,0.55)'; X.stroke();
      text(opLabel(m), 0, 1, m.v >= 10 ? 15 : 17, '#fff3d6', 'rgba(0,0,0,0.5)');
      X.restore(); break;
    }
    case 'spider': {
      X.save(); X.translate(m.x, m.y);
      X.beginPath(); X.arc(0, 0, m.r, 0, 6.283); X.fillStyle = 'rgba(20,11,19,0.92)'; X.fill();
      X.strokeStyle = 'rgba(255,90,70,0.3)'; X.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const a = (m.rot || 0) + i * Math.PI / 4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * m.r, Math.sin(a) * m.r); X.stroke(); }
      for (let k = 1; k <= 2; k++) { X.beginPath(); for (let i = 0; i <= 8; i++) { const a = (m.rot || 0) + i * Math.PI / 4, rr = m.r * k / 3; if (i) X.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else X.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } X.stroke(); }
      X.setLineDash([5, 4]); X.lineDashOffset = reduce ? 0 : -tm * 8; X.lineWidth = 2.2; X.strokeStyle = '#ff4d40';
      X.globalAlpha = 0.8 + 0.2 * (m.bloom || 0); X.beginPath(); X.arc(0, 0, m.r, 0, 6.283); X.stroke(); X.setLineDash([]); X.globalAlpha = 1;
      const sy = -m.r * 0.55 + Math.sin(tm * 2 + (m.rot || 0)) * 2;
      X.strokeStyle = '#ff4d40'; X.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { const dx = 2 + i * 1.3; X.beginPath(); X.moveTo(-1, sy); X.lineTo(-dx - 2, sy - 3 + i * 2); X.moveTo(1, sy); X.lineTo(dx + 2, sy - 3 + i * 2); X.stroke(); }
      X.fillStyle = '#ff4d40'; X.beginPath(); X.arc(0, sy, 2.8, 0, 6.283); X.fill();
      text(opLabel(m), 0, 5, 16, '#ff8a7a', 'rgba(20,11,19,0.95)');
      X.restore(); break;
    }
    case 'switch': {
      const o = switchOp(m, gtime()), good = o.op === 'mul';
      const ph = ((gtime() + m.ph) % m.period) / m.period, left = 1 - ph;
      const col = good ? '#9fd08a' : '#ff5f4f';
      X.save(); X.translate(m.x, m.y);
      const sc = 1 + 0.2 * Math.sin((m.bloom || 0) * Math.PI); X.scale(sc, sc);
      hexPath(X, 0, 0, m.r); X.fillStyle = good ? '#24402a' : '#3e1512'; X.fill();
      X.lineWidth = 2; X.strokeStyle = 'rgba(255,243,214,0.35)'; X.stroke();
      X.lineWidth = 4; X.strokeStyle = col; X.globalAlpha = left < 0.2 ? 0.5 + 0.5 * Math.sin(tm * 30) : 1;
      X.beginPath(); X.arc(0, 0, m.r + 5, -Math.PI / 2, -Math.PI / 2 + 6.283 * left); X.stroke(); X.globalAlpha = 1;
      text(opLabel(o), 0, 1, 17, '#fff3d6', 'rgba(0,0,0,0.6)');
      X.restore(); break;
    }
    case 'dandelion': {
      X.save(); X.translate(m.x, m.y);
      X.strokeStyle = '#7fae6a'; X.lineWidth = 2; X.beginPath(); X.moveTo(0, m.r * 0.4); X.quadraticCurveTo(3, m.r, 0, m.r * 1.35); X.stroke();
      if (m.alive) {
        const sc = 1 + 0.2 * Math.sin((m.bloom || 0) * Math.PI); X.scale(sc, sc);
        X.globalAlpha = 0.2; X.fillStyle = '#ffffff'; X.beginPath(); X.arc(0, 0, m.r * 1.1, 0, 6.283); X.fill(); X.globalAlpha = 1;
        X.strokeStyle = 'rgba(255,255,250,0.85)'; X.lineWidth = 1; X.fillStyle = '#fffaf0';
        for (let i = 0; i < 18; i++) {
          const a = i * 0.349 + Math.sin(tm + i) * 0.03, x2 = Math.cos(a) * m.r, y2 = Math.sin(a) * m.r;
          X.beginPath(); X.moveTo(0, 0); X.lineTo(x2, y2); X.stroke(); X.beginPath(); X.arc(x2, y2, 1.6, 0, 6.283); X.fill();
        }
        X.beginPath(); X.arc(0, 0, m.r * 0.5, 0, 6.283); X.fillStyle = '#7a6a3a'; X.fill();
        text(opLabel({ op: 'add', v: m.v }), 0, 1, 14, '#fffaf0', 'rgba(0,0,0,0.6)');
      } else {
        X.globalAlpha = 0.5; X.strokeStyle = '#fffaf0'; X.lineWidth = 2;
        X.beginPath(); X.arc(0, 0, m.r * 0.55, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - m.regrow / 25)); X.stroke();
        X.fillStyle = '#9fd08a'; X.beginPath(); X.arc(0, 0, 3.5, 0, 6.283); X.fill(); X.globalAlpha = 1;
      }
      X.restore(); break;
    }
    case 'wasp': {
      X.save(); X.setLineDash([4, 6]); X.strokeStyle = 'rgba(255,95,79,0.35)'; X.lineWidth = 2;
      X.beginPath(); X.moveTo(m.ax, m.ay); X.lineTo(m.bx, m.by); X.stroke(); X.setLineDash([]);
      X.globalAlpha = 0.18 + 0.12 * Math.sin(tm * 5); X.fillStyle = '#ff5f4f'; X.beginPath(); X.arc(m.x, m.y, m.r + 4, 0, 6.283); X.fill(); X.globalAlpha = 1;
      X.restore();
      const dir = Math.cos(gtime() * m.spd + m.ph) >= 0 ? 0 : Math.PI;
      const ang = Math.atan2(m.by - m.ay, m.bx - m.ax) + dir;
      drawSprite('e', ((tm * 30) | 0) & 1, m.x, m.y, ang, 34);
      setWorld();
      text('−' + m.v, m.x, m.y - m.r - 10, 15, '#ff8a7a', 'rgba(20,11,19,0.9)');
      break;
    }
    case 'wind': {
      const ang = Math.atan2(m.dy, m.dx);
      X.save(); X.translate((m.ax + m.bx) / 2, (m.ay + m.by) / 2); X.rotate(ang);
      const L = m.len, w = m.w;
      X.beginPath(); roundRect(X, -L / 2 - w / 2, -w / 2, L + w, w, w / 2);
      X.fillStyle = 'rgba(191,230,255,0.10)'; X.fill(); X.strokeStyle = 'rgba(191,230,255,0.28)'; X.lineWidth = 1.5; X.setLineDash([6, 6]); X.stroke(); X.setLineDash([]);
      X.save(); X.clip();
      X.strokeStyle = 'rgba(220,242,255,0.6)'; X.lineWidth = 3; X.lineCap = 'round'; X.lineJoin = 'round';
      const sp = 34, off = (tm * 46) % sp;
      for (let x = -L / 2 - w / 2 - sp + off; x < L / 2 + w / 2; x += sp)
        for (const yy of [-w * 0.22, w * 0.22]) { X.beginPath(); X.moveTo(x - 6, yy - 7); X.lineTo(x + 2, yy); X.lineTo(x - 6, yy + 7); X.stroke(); }
      X.restore(); X.restore(); break;
    }
    case 'portal': {
      X.save(); X.translate(m.x, m.y);
      const g = X.createRadialGradient(0, 0, 2, 0, 0, m.r + 6);
      g.addColorStop(0, '#0b1a22'); g.addColorStop(0.7, 'rgba(60,200,190,0.35)'); g.addColorStop(1, 'rgba(95,224,208,0)');
      X.fillStyle = g; X.beginPath(); X.arc(0, 0, m.r + 6, 0, 6.283); X.fill();
      X.lineWidth = 2.5; X.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        X.strokeStyle = i === 1 ? '#ff8be8' : '#5fe0d0';
        const rr = m.r * (0.45 + i * 0.25), a0 = tm * (1.5 + i * 0.6) * (i % 2 ? -1 : 1);
        X.beginPath(); X.arc(0, 0, rr, a0, a0 + 4.2); X.stroke();
      }
      X.restore(); break;
    }
    case 'puddle': {
      X.save(); X.translate(m.x, m.y);
      X.beginPath();
      const n = m.blob.length;
      for (let i = 0; i <= n; i++) {
        const k = i % n, a = k / n * 6.283, rr = m.r * m.blob[k] * (1 + Math.sin(tm * 1.5 + k) * 0.02);
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.8;
        if (i) X.lineTo(x, y); else X.moveTo(x, y);
      }
      X.closePath();
      const g = X.createRadialGradient(-m.r * 0.3, -m.r * 0.3, 2, 0, 0, m.r);
      g.addColorStop(0, '#f7c35a'); g.addColorStop(1, '#a8600c');
      X.fillStyle = g; X.globalAlpha = 0.85; X.fill(); X.globalAlpha = 1;
      X.strokeStyle = 'rgba(80,40,6,0.6)'; X.lineWidth = 1.5; X.stroke();
      X.fillStyle = 'rgba(255,255,255,0.35)'; X.beginPath(); X.ellipse(-m.r * 0.35, -m.r * 0.3, m.r * 0.25, m.r * 0.1, -0.4, 0, 6.283); X.fill();
      X.strokeStyle = 'rgba(80,40,6,0.55)'; X.lineWidth = 2;
      for (let i = -1; i <= 1; i += 2) { X.beginPath(); for (let x = -12; x <= 12; x += 3) X.lineTo(x, i * 5 + Math.sin(x * 0.6 + tm * 3) * 1.6); X.stroke(); }
      X.restore(); break;
    }
    case 'rock': {
      X.save(); X.translate(m.x, m.y); X.rotate(m.rot || 0);
      X.fillStyle = 'rgba(0,0,0,0.3)'; X.beginPath(); X.ellipse(2, m.r * 0.5, m.r, m.r * 0.45, 0, 0, 6.283); X.fill();
      X.beginPath();
      m.poly.forEach((k, i) => { const a = i / m.poly.length * 6.283, x = Math.cos(a) * m.r * k, y = Math.sin(a) * m.r * k; if (i) X.lineTo(x, y); else X.moveTo(x, y); });
      X.closePath();
      const g = X.createLinearGradient(-m.r, -m.r, m.r, m.r); g.addColorStop(0, '#8a7c70'); g.addColorStop(1, '#3d342e');
      X.fillStyle = g; X.fill(); X.strokeStyle = '#2a231f'; X.lineWidth = 2; X.stroke();
      X.strokeStyle = 'rgba(255,255,255,0.18)'; X.lineWidth = 1.5;
      X.beginPath(); X.moveTo(-m.r * 0.4, -m.r * 0.2); X.lineTo(m.r * 0.1, -m.r * 0.45); X.lineTo(m.r * 0.3, 0); X.stroke();
      X.restore(); break;
    }
  }
}
function drawSwarm(s) {
  const F = FAC[s.owner], rad = swarmRad(s), tm = clock;
  for (let i = 0; i < s.trail.length; i++) {
    const p = s.trail[i], k = (i + 1) / s.trail.length;
    X.globalAlpha = 0.05 + 0.08 * k; X.fillStyle = F.c; X.beginPath(); X.arc(p.x, p.y, rad * 0.75 * k, 0, 6.283); X.fill();
  }
  X.globalAlpha = 0.16; X.fillStyle = F.c; X.beginPath(); X.arc(s.x, s.y, rad + 6, 0, 6.283); X.fill(); X.globalAlpha = 1;
  const ha = Math.atan2(s.hy, s.hx), sz = s.owner === 'h' ? 1.2 : s.owner === 'e' ? 1.05 : 1;
  const sp = reduce ? 0.4 : 1;
  for (let i = 0; i < s.bees.length; i++) {
    const b = s.bees[i], a = b.a + tm * b.w * 0.8 * sp;
    const x = s.x + Math.cos(a) * rad * b.r + Math.sin(tm * b.w * 4 + b.ph) * 1.6 * sp;
    const y = s.y + Math.sin(a) * rad * b.r * 0.85 + Math.cos(tm * b.w * 5 + b.ph) * 1.6 * sp;
    drawSprite(s.owner, ((tm * 26 + b.ph * 3) | 0) & 1, x, y, ha + Math.sin(tm * 5 + b.ph) * 0.35, BEE_W * b.sz * sz);
  }
  setWorld();
  if (s.owner === 'p' && G.boostT > 0) { X.strokeStyle = 'rgba(255,224,138,0.6)'; X.lineWidth = 2; X.beginPath(); X.arc(s.x, s.y, rad + 8, 0, 6.283); X.stroke(); }
  const str = String(s.count);
  X.font = '14px ' + FONT; const w = X.measureText(str).width + 12, y = s.y - rad - 12;
  X.fillStyle = 'rgba(20,10,8,0.6)'; X.beginPath(); roundRect(X, s.x - w / 2, y - 10, w, 20, 10); X.fill();
  text(str, s.x, y + 1, 14, F.hi);
}
function polyline(pts) { X.beginPath(); X.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) X.lineTo(pts[i].x, pts[i].y); }
function drawDrag() {
  if (!drag) return;
  if (!drag.pred || clock - drag.predT > 0.1) updatePreview();
  const tm = clock, pts = drag.pts, pr = drag.pred;
  const bad = drag.blockedNow || drag.endBlocked || drag.tooLong || (drag.totalLen || 0) > MAXLEN * 1.1;
  const col = bad ? '#ff5f4f' : '#ffcf5a';
  const tg = pr ? pr.tg : null;
  const end = tg ? { x: tg.x, y: tg.y } : drag.cur;
  X.save(); X.lineCap = 'round'; X.lineJoin = 'round';
  const full = drag.portal ? pts : pts.concat([end]);
  X.strokeStyle = 'rgba(255,191,60,0.16)'; X.lineWidth = 12; polyline(full); X.stroke();
  X.setLineDash([0.1, 10]); X.lineDashOffset = -tm * 30; X.lineWidth = 5.5; X.strokeStyle = col; polyline(full); X.stroke();
  if (drag.portal) {
    X.strokeStyle = 'rgba(95,224,208,0.85)'; polyline([drag.portal.to, end]); X.stroke();
    X.setLineDash([]); X.lineWidth = 3; X.strokeStyle = '#5fe0d0'; X.globalAlpha = 0.6 + 0.4 * Math.sin(tm * 8);
    X.beginPath(); X.arc(drag.portal.to.x, drag.portal.to.y, drag.portal.to.r + 6, 0, 6.283); X.stroke(); X.globalAlpha = 1;
  }
  X.setLineDash([]);
  if (drag.blockedNow) { X.strokeStyle = 'rgba(255,95,79,0.8)'; X.lineWidth = 2; X.setLineDash([4, 4]); polyline([pts[pts.length - 1], drag.cur]); X.stroke(); X.setLineDash([]); }
  for (const s of drag.sources) { X.strokeStyle = FAC.p.hi; X.lineWidth = 2.5; X.globalAlpha = 0.9; hexPath(X, s.h.x, s.h.y, s.h.r + 9); X.stroke(); }
  X.globalAlpha = 1;
  if (tg) { X.strokeStyle = tg.owner === 'p' ? FAC.p.hi : '#fff3d6'; X.lineWidth = 3; X.globalAlpha = 0.6 + 0.4 * Math.sin(tm * 10); hexPath(X, tg.x, tg.y, tg.r + 12); X.stroke(); X.globalAlpha = 1; }
  if (pr) pr.used.forEach((good, m) => { X.strokeStyle = good ? '#bff0a6' : '#ff5f4f'; X.lineWidth = 2.5; X.globalAlpha = 0.85; X.beginPath(); X.arc(m.x, m.y, m.r + 7, 0, 6.283); X.stroke(); });
  X.globalAlpha = 1;
  // length ring near finger
  const frac = clamp(1 - drag.len / MAXLEN, 0, 1), cur = drag.cur;
  X.strokeStyle = 'rgba(0,0,0,0.4)'; X.lineWidth = 4; X.beginPath(); X.arc(cur.x, cur.y, 14, 0, 6.283); X.stroke();
  X.strokeStyle = bad ? '#ff5f4f' : frac < 0.25 ? '#ffb05a' : '#9fd08a';
  X.beginPath(); X.arc(cur.x, cur.y, 14, -Math.PI / 2, -Math.PI / 2 + 6.283 * frac); X.stroke();
  // predicted count label
  if (pr) {
    const label = drag.tooLong ? t('too_long') : (drag.blockedNow || drag.endBlocked) ? t('blocked') : '→ ' + pr.c;
    const off = 56 / scale;
    let ly = cur.y - off; if (ly < 16) ly = cur.y + off;
    X.font = '17px ' + FONT; const w = X.measureText(label).width + 20;
    const lx = clamp(cur.x, w / 2 + 2, LAY.W - w / 2 - 2);
    X.fillStyle = bad ? 'rgba(80,16,12,0.85)' : pr.capture ? 'rgba(30,70,30,0.9)' : 'rgba(30,18,10,0.85)';
    X.beginPath(); roundRect(X, lx - w / 2, ly - 15, w, 30, 15); X.fill();
    X.strokeStyle = bad ? '#ff5f4f' : pr.capture ? '#9fd08a' : 'rgba(255,191,60,0.5)'; X.lineWidth = 1.5; X.stroke();
    text(label, lx, ly + 1, 17, bad ? '#ffb3a8' : pr.capture ? '#d8ffc6' : FAC.p.hi);
  }
  X.restore();
}
function render() {
  X = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  // pollen
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ffe9a8';
  for (const p of pollen) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(clock * 2 + p.ph); ctx.beginPath(); ctx.arc(p.x * vw, p.y * vh, p.s, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (!G) return;
  let shx = 0, shy = 0;
  if (G.shake > 0 && !reduce) { shx = (Math.random() - 0.5) * G.shake * 8; shy = (Math.random() - 0.5) * G.shake * 8; }
  WM = { a: dpr * scale, e: dpr * (offX + shx), f: dpr * (offY + shy) };
  setWorld();
  for (const m of G.mods) if (m.kind === 'wind' || m.kind === 'puddle' || m.kind === 'portal') drawMod(m);
  for (const m of G.mods) if (m.kind === 'rock') drawMod(m);
  for (const m of G.mods) if (m.kind === 'flower' || m.kind === 'spider' || m.kind === 'switch' || m.kind === 'dandelion') drawMod(m);
  // planned routes of swarms in flight
  X.save(); X.lineWidth = 1.5; X.setLineDash([3, 7]);
  for (const s of G.swarms) {
    X.strokeStyle = s.owner === 'p' ? 'rgba(255,191,60,0.28)' : s.owner === 'h' ? 'rgba(178,125,255,0.25)' : 'rgba(255,95,79,0.25)';
    X.beginPath(); X.moveTo(s.x, s.y);
    for (let i = s.seg + 1; i < s.pts.length; i++) { if (s.pts[i].j) X.moveTo(s.pts[i].x, s.pts[i].y); else X.lineTo(s.pts[i].x, s.pts[i].y); }
    X.stroke();
  }
  X.restore();
  for (const h of G.hives) drawHive(h);
  if (G.armed && state === 'play') {
    for (const h of G.hives) {
      const ok = G.armed === 'honey' ? h.owner === 'p' : (h.owner === 'e' || h.owner === 'h');
      if (!ok) continue;
      X.strokeStyle = G.armed === 'honey' ? '#ffe08a' : '#e0d8cf'; X.lineWidth = 3; X.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 8);
      hexPath(X, h.x, h.y, h.r + 12); X.stroke();
    }
    X.globalAlpha = 1;
  }
  for (const m of G.mods) if (m.kind === 'wasp') drawMod(m);
  drawDrag();
  for (const s of G.swarms) drawSwarm(s);
  X.lineCap = 'round';
  for (const st of G.stings) { X.strokeStyle = 'rgba(255,240,180,' + (st.life / 0.16) + ')'; X.lineWidth = 2; X.beginPath(); X.moveTo(st.x1, st.y1); X.lineTo(st.x2, st.y2); X.stroke(); }
  for (const p of parts) {
    if (!p.on) continue;
    X.globalAlpha = 1 - p.life / p.max; X.fillStyle = p.color;
    X.beginPath(); X.arc(p.x, p.y, p.size, 0, 6.283); X.fill();
  }
  for (const f of floats) { X.globalAlpha = clamp(1.4 - 1.4 * f.life / f.max, 0, 1); text(f.text, f.x, f.y, f.size, f.color, 'rgba(0,0,0,0.65)'); }
  X.globalAlpha = 1;
}

// ---------------------------------------------------------------- icons
function fakeFor(id) {
  const base = { x: 0, y: 0, bloom: 0, rot: 0.3 };
  const hive = type => ({ hive: { id: 1, owner: 'p', x: 0, y: 6, r: 30, count: 42, cap: 99, type: type, grow: 0.6, pulse: 0, flip: 0, smoke: 0 } });
  switch (id) {
    case 'flower': return { mod: Object.assign({}, base, { kind: 'flower', op: 'mul', v: 2, r: 30 }) };
    case 'x3': return { mod: Object.assign({}, base, { kind: 'flower', op: 'mul', v: 3, r: 30 }) };
    case 'flower_add': return { mod: Object.assign({}, base, { kind: 'flower', op: 'add', v: 10, r: 30 }) };
    case 'spider': return { mod: Object.assign({}, base, { kind: 'spider', op: 'sub', v: 10, r: 34 }) };
    case 'div': return { mod: Object.assign({}, base, { kind: 'spider', op: 'div', v: 2, r: 34 }) };
    case 'switch': return { mod: Object.assign({}, base, { kind: 'switch', r: 30, ph: 0.4, period: 3 }) };
    case 'dandelion': return { mod: Object.assign({}, base, { kind: 'dandelion', r: 28, v: 20, alive: true, regrow: 0, y: -6 }) };
    case 'rocks': return { mod: Object.assign({}, base, { kind: 'rock', r: 34, poly: [1, 0.85, 0.95, 0.8, 1.02, 0.88, 0.95, 0.82] }) };
    case 'wasp': return { mod: Object.assign({}, base, { kind: 'wasp', ax: -36, ay: 14, bx: 36, by: 14, y: 14, r: 18, v: 15, spd: 1, ph: 0 }) };
    case 'wind': { const w = { kind: 'wind', ax: -30, ay: 0, bx: 30, by: 0, w: 44 }; windDir(w); return { mod: w }; }
    case 'portal': return { mod: Object.assign({}, base, { kind: 'portal', r: 34 }) };
    case 'puddle': return { mod: Object.assign({}, base, { kind: 'puddle', r: 40, blob: [1, 0.9, 1.02, 0.86, 0.98, 0.9, 1, 0.88, 0.95] }) };
    case 'queen': case 'fort': case 'tower': return hive(id);
    case 'hive': return hive('normal');
    default: return {};
  }
}
function drawIcon(cvs, id) {
  const c = cvs.getContext('2d'), S = cvs.width;
  const pX = X, pWM = WM;
  try {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    X = c; WM = { a: S / 78, e: S / 2, f: S / 2 }; setWorld();
    const o = fakeFor(id);
    if (o.hive) drawHive(o.hive);
    else if (o.mod) drawMod(o.mod);
    else if (id === 'hornets') { drawSprite('h', 0, -12, -6, -0.3, 40); drawSprite('e', 1, 18, 16, 0.4, 30); }
  } finally { X = pX; WM = pWM; }
}

// ---------------------------------------------------------------- UI
const SCREENS = { menu: 'sMenu', levels: 'sLevels', paused: 'sPause', win: 'sWin', lose: 'sLose', intro: 'sIntro', help: 'sHelp', about: 'sAbout' };
const IN_GAME = { play: 1, paused: 1, win: 1, lose: 1, intro: 1 };
function setState(s) {
  if (state !== s && SCREENS[state]) prevState = state;
  state = s;
  for (const k in SCREENS) $(SCREENS[k]).classList.toggle('show', k === s);
  const inGame = !!IN_GAME[s] && !!G;
  $('hud').classList.toggle('hide', !inGame);
  $('dock').classList.toggle('hide', !inGame);
  $('abbar').classList.toggle('hide', !(inGame && G.n >= AB_UNLOCK.honey));
  if (inGame) {
    for (const k in AB_UNLOCK) $('ab_' + k).classList.toggle('hide', G.n < AB_UNLOCK[k]);
  }
  if (s !== 'play') { drag = null; if (G) G.armed = null; }
  updX2();
  syncGameplay();
  layout();
}
function syncGameplay() {
  if (state === 'play' && G && !G.ended && !frozen()) Platform.gameplayStart(); else Platform.gameplayStop();
}
let toastTm = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTm); toastTm = setTimeout(() => el.classList.remove('show'), 1500);
}
let tipOn = false;
// The tip keeps its space in the dock for the whole level so the map never re-flows mid-level.
function showTip(txt) { tipOn = true; const el = $('tip'); el.textContent = txt; el.classList.remove('fade', 'hide'); }
function hideTip() { if (!tipOn) return; tipOn = false; $('tip').classList.add('fade'); }
function updX2() {
  const show = state === 'play' && G && !G.ended && !G.x2Used && !G.sentAny && G.time < 12 && !frozen();
  $('bX2').classList.toggle('hide', !show);
}
let hudT = 0;
function updHud(dt) {
  if (!G || !IN_GAME[state]) return;
  hudT -= dt; if (hudT > 0) return; hudT = 0.15;
  let p = 0, e = 0, h = 0;
  for (const x of G.hives) { if (x.owner === 'p') p += x.count; else if (x.owner === 'e') e += x.count; else if (x.owner === 'h') h += x.count; }
  for (const s of G.swarms) { if (s.owner === 'p') p += s.count; else if (s.owner === 'e') e += s.count; else h += s.count; }
  const tot = Math.max(1, p + e + h);
  $('barP').style.width = (p / tot * 100).toFixed(1) + '%';
  $('barH').style.width = (h / tot * 100).toFixed(1) + '%';
  $('barE').style.width = (e / tot * 100).toFixed(1) + '%';
  const tEl = $('hTime');
  tEl.textContent = fmtTime(G.time) + ' / ' + fmtTime(G.par);
  tEl.classList.toggle('over', G.time > G.par);
  for (const k in AB_CD) {
    const b = $('ab_' + k), cdv = G.cd[k];
    b.style.setProperty('--p', cdv > 0 ? (1 - cdv / AB_CD[k]).toFixed(3) : '1');
    b.classList.toggle('cool', cdv > 0);
    b.classList.toggle('armed', G.armed === k);
  }
  updX2();
}
function starSvg(on, fill, stroke) {
  return '<svg viewBox="0 0 24 24"><path d="M12 2.2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.4l-6.2 3.7 1.6-7L2 9.4l7.1-.6z" fill="' + (on ? fill : 'rgba(0,0,0,.28)') + '" stroke="' + (on ? stroke : 'rgba(255,255,255,.12)') + '" stroke-width="1.3" stroke-linejoin="round"/></svg>';
}
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="40%" fill="currentColor"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
function buildLevels() {
  const g = $('lvGrid'); g.innerHTML = '';
  const N = Math.max(32, Math.ceil((save.unlocked + 9) / 4) * 4);
  let total = 0;
  for (let i = 1; i <= N; i++) {
    const locked = i > save.unlocked, st = save.stars[i] | 0; total += st;
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'cell' + (locked ? ' locked' : '') + (i === save.unlocked ? ' cur' : '');
    b.innerHTML = '<span class="hx"><span class="num">' + (locked ? LOCK_SVG : i) + '</span>' +
      (locked ? '' : '<span class="st">' + [0, 1, 2].map(k => starSvg(k < st, '#1e130d', '#1e130d')).join('') + '</span>') + '</span>';
    if (!locked) b.addEventListener('click', () => { Sfx.play('click'); goLevel(i); });
    g.appendChild(b);
  }
  $('lvStars').textContent = '★ ' + total;
}
function helpItem(icon, title, desc) {
  const d = document.createElement('div'); d.className = 'hitem';
  d.appendChild(icon);
  const b = document.createElement('div');
  const h = document.createElement('h3'); h.textContent = title;
  const p = document.createElement('p'); p.textContent = desc;
  b.appendChild(h); b.appendChild(p); d.appendChild(b);
  return d;
}
function iconCanvas(id) { const c = document.createElement('canvas'); c.width = c.height = 104; drawIcon(c, id); return c; }
function svgIcon(html) { const d = document.createElement('div'); d.className = 'sv'; d.innerHTML = html; return d; }
function abSvg(k) { const s = $('ab_' + k).querySelector('svg'); return s ? s.outerHTML : ''; }
let helpBuilt = false;
function buildHelp() {
  if (helpBuilt) return; helpBuilt = true;
  const body = $('helpBody'), sec = txt => { const h = document.createElement('div'); h.className = 'hsec'; h.textContent = txt; body.appendChild(h); };
  body.appendChild(helpItem(iconCanvas('hive'), t('h_goal_t'), t('h_goal_d')));
  body.appendChild(helpItem(svgIcon('<svg viewBox="0 0 24 24" fill="none" stroke="#ffcf5a" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 4.2"><path d="M4 20c4-2 2-8 7-10s6-6 9-6"/></svg>'), t('h_drag_t'), t('h_drag_d')));
  body.appendChild(helpItem(svgIcon(starSvg(true, '#ffbf3c', '#7a4c0e')), t('h_stars_t'), t('h_stars_d')));
  sec(t('h_mods_t'));
  const mp = document.createElement('p'); mp.style.cssText = 'margin:2px 4px 6px;opacity:.85;line-height:1.35'; mp.textContent = t('h_mods_d'); body.appendChild(mp);
  for (const id of ['flower', 'x3', 'spider', 'div', 'switch', 'dandelion', 'wasp', 'wind', 'portal', 'puddle', 'rocks'])
    body.appendChild(helpItem(iconCanvas(id), t('f_' + id + '_t'), t('f_' + id + '_d')));
  sec(t('h_hives_t'));
  for (const id of ['queen', 'fort', 'tower', 'hornets']) body.appendChild(helpItem(iconCanvas(id), t('f_' + id + '_t'), t('f_' + id + '_d')));
  sec(t('ab_honey') + ' · ' + t('ab_boost') + ' · ' + t('ab_smoke'));
  for (const k of ['honey', 'boost', 'smoke']) body.appendChild(helpItem(svgIcon(abSvg(k)), t('f_ab_' + k + '_t') + ' (' + t('level', { n: AB_UNLOCK[k] }) + ')', t('f_ab_' + k + '_d')));
}
function updMenu() {
  $('mLvl').textContent = t('level', { n: save.unlocked });
  const snd = t('sound') + ': ' + (save.sound ? t('on') : t('off'));
  $('mSound').textContent = snd; $('pSound').textContent = snd;
}
function toggleSound() {
  save.sound = !save.sound; Sfx.setMuted(!save.sound); persist(); updMenu();
  if (save.sound) { Sfx.unlock(); Sfx.play('click'); }
}
function showIntro() {
  const id = introQueue.shift();
  const isAb = id.indexOf('ab_') === 0;
  $('iIcon').classList.toggle('hide', isAb);
  $('iSvg').classList.toggle('hide', !isAb);
  if (isAb) $('iSvg').innerHTML = abSvg(id.slice(3)); else drawIcon($('iIcon'), id);
  $('iTitle').textContent = t('f_' + id + '_t');
  $('iText').textContent = t('f_' + id + '_d');
  $('iOk').dataset.id = id;
  setState('intro');
}
function computeIntros() {
  const ids = new Set();
  G.present.forEach(k => { if (INTRO_OF[k]) ids.add(INTRO_OF[k]); });
  for (const k in AB_UNLOCK) if (G.n >= AB_UNLOCK[k]) ids.add('ab_' + k);
  return INTRO_ORDER.filter(id => ids.has(id) && !save.seen[id]);
}
function startLevel(n) {
  G = makeGame(n);
  drag = null;
  for (const p of parts) p.on = false;
  floats.length = 0;
  $('hLevel').textContent = t('level', { n: n });
  tipOn = false; $('tip').classList.add('hide');
  if (n <= 3) showTip(t('tut' + n));
  introQueue = computeIntros();
  if (introQueue.length) showIntro(); else setState('play');
}
let transitioning = false;
function goLevel(n) {
  if (transitioning) return;
  transitioning = true;
  const c = $('curtain'); c.classList.add('on');
  setTimeout(() => { try { startLevel(n); } finally { c.classList.remove('on'); transitioning = false; } }, 230);
}
function finishLevel(res) {
  if (res === 'win') {
    const stars = 1 + (G.time <= G.par ? 1 : 0) + (!G.lostHive ? 1 : 0);
    save.stars[G.n] = Math.max(save.stars[G.n] | 0, stars);
    save.unlocked = Math.max(save.unlocked, G.n + 1);
    save.adCount = (save.adCount | 0) + 1;
    persist(); updMenu();
    const ws = $('wStars');
    ws.innerHTML = [0, 1, 2].map(k => starSvg(k < stars, '#ffbf3c', '#7a4c0e')).join('');
    const items = [[t('star_win'), true], [t('star_time', { t: fmtTime(G.par) }), G.time <= G.par], [t('star_safe'), !G.lostHive]];
    $('wList').innerHTML = items.map(it => '<li class="' + (it[1] ? 'ok' : '') + '">' + it[0] + '</li>').join('');
    $('wTime').textContent = t('time_is', { t: fmtTime(G.time) });
    setState('win');
    Sfx.play('win');
    const svgs = ws.querySelectorAll('svg');
    for (let i = 0; i < svgs.length; i++) setTimeout(() => { svgs[i].classList.add('on'); if (i < stars) Sfx.play('star'); }, 350 + i * 260);
  } else {
    persist();
    $('lCont').classList.toggle('hide', !!(G.usedContinue || !G.lastLost));
    setState('lose');
    Sfx.play('lose');
  }
}
function pauseGame() { if (state === 'play' && G && !G.ended) setState('paused'); }
async function runAd(fn) {
  freeze.ad = true; Sfx.hold('ad'); syncGameplay(); updX2();
  let r = false;
  try { r = await fn(); } catch (e) { r = false; }
  freeze.ad = false; Sfx.release('ad'); syncGameplay(); updX2();
  return r;
}
async function nextLevel() {
  const n = G.n + 1;
  const now = (performance && performance.now()) || Date.now();
  if ((save.adCount | 0) >= 3 && now - lastAdAt >= 60000) {
    save.adCount = 0; persist();
    await runAd(() => Platform.showInterstitial());
    lastAdAt = (performance && performance.now()) || Date.now();
  }
  goLevel(n);
}
function updSend() {
  $('bSendPct').textContent = save.sendPct + '%';
  $('bSend').setAttribute('aria-label', t('send') + ': ' + save.sendPct + '%');
}
function bindUI() {
  const on = (id, fn) => $(id).addEventListener('click', e => { e.preventDefault(); Sfx.unlock(); Sfx.play('click'); fn(e); });
  on('mPlay', () => goLevel(save.unlocked));
  on('mLevels', () => { buildLevels(); setState('levels'); });
  on('mHow', () => { buildHelp(); setState('help'); });
  on('mAbout', () => setState('about'));
  on('mSound', toggleSound);
  on('lvBack', () => setState(prevState === 'paused' ? 'paused' : prevState === 'win' || prevState === 'lose' ? prevState : 'menu'));
  on('hBack', () => setState(prevState === 'paused' ? 'paused' : 'menu'));
  on('aBack', () => setState('menu'));
  on('aLic', () => { const el = $('licText'); el.classList.toggle('hide'); });
  on('bPause', pauseGame);
  on('pResume', () => setState('play'));
  on('pRestart', () => goLevel(G.n));
  on('pLevels', () => { buildLevels(); setState('levels'); });
  on('pHow', () => { buildHelp(); setState('help'); });
  on('pSound', toggleSound);
  on('wNext', nextLevel);
  on('wRetry', () => goLevel(G.n));
  on('wLevels', () => { buildLevels(); setState('levels'); });
  on('lRetry', () => goLevel(G.n));
  on('lLevels', () => { buildLevels(); setState('levels'); });
  on('lCont', async () => {
    if (!G || G.usedContinue || !G.lastLost) return;
    G.usedContinue = true;
    $('lCont').classList.add('hide');
    const ok = await runAd(() => Platform.showRewarded());
    if (!ok) return;
    const h = G.lastLost;
    if (h.owner !== 'p') { h.flipFrom = h.owner; h.flip = 1; h.owner = 'p'; }
    h.count = 30; h.grow = 0; h.smoke = 0; h.pulse = 1;
    burst(h.x, h.y, FAC.p.c, 30, 140, 3);
    G.ended = null; G.endT = 0;
    setState('play');
  });
  on('bX2', async () => {
    if (!G || G.x2Used) return;
    G.x2Used = true; updX2();
    const ok = await runAd(() => Platform.showRewarded());
    if (!ok || !G) return;
    for (const h of G.hives) if (h.owner === 'p') { h.count *= 2; h.pulse = 1; floatText(h.x, h.y - h.r - 12, '×2', FAC.p.hi, 18); burst(h.x, h.y, FAC.p.c, 20, 110, 2.6); }
    Sfx.play('capture');
  });
  on('iOk', () => {
    const id = $('iOk').dataset.id; if (id) { save.seen[id] = 1; persist(); }
    if (introQueue.length) showIntro(); else setState('play');
  });
  for (const k of ['honey', 'boost', 'smoke']) $('ab_' + k).addEventListener('click', e => { e.preventDefault(); Sfx.unlock(); useAbility(k); });
  on('bSend', () => {
    save.sendPct = SEND_STEPS[(SEND_STEPS.indexOf(save.sendPct) + 1) % SEND_STEPS.length];
    persist(); updSend();
  });

  document.addEventListener('pointerdown', () => Sfx.unlock(), true);
  document.addEventListener('touchmove', e => { if (!(e.target && e.target.closest && e.target.closest('.scroll'))) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => { if (!(e.target && e.target.closest && e.target.closest('#licText'))) e.preventDefault(); });
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state === 'play') pauseGame();
      else if (state === 'paused') setState('play');
      else if (state === 'help' || state === 'levels' || state === 'about') $(state === 'help' ? 'hBack' : state === 'levels' ? 'lvBack' : 'aBack').click();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Sfx.hold('hidden'); pauseGame(); } else Sfx.release('hidden');
  });
  window.addEventListener('blur', () => { Sfx.hold('blur'); pauseGame(); });
  window.addEventListener('focus', () => Sfx.release('blur'));
  window.addEventListener('pagehide', () => Sfx.hold('hidden'));
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); layout(); rzT = setTimeout(layout, 150); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  Platform.onAdOpen = () => { freeze.ad = true; Sfx.hold('ad'); syncGameplay(); };
  Platform.onAdClose = () => { /* released by runAd */ };
  Platform.onApiPause = () => { freeze.api = true; Sfx.hold('api'); drag = null; syncGameplay(); };
  Platform.onApiResume = () => { freeze.api = false; Sfx.release('api'); syncGameplay(); };
}

// ---------------------------------------------------------------- main loop
let lastT = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  try {
    if (!frozen()) {
      clock += dt;
      if (G && state === 'play') update(dt);
      updEffects(dt);
      updPollen(dt);
    }
    render();
    updHud(dt);
  } catch (err) {
    if (STRICT) throw err;
  }
  requestAnimationFrame(frame);
}

async function boot() {
  try { await Platform.init(); } catch (e) {}
  I18N.setLang(Platform.lang);
  try { document.documentElement.lang = I18N.lang; document.title = I18N.title(); } catch (e) {}
  I18N.apply();
  try { mergeSave(await Platform.load()); } catch (e) {}
  Sfx.setMuted(!save.sound);
  $('licText').textContent = window.FONT_LICENSE || '';
  bindUI();
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([Promise.all([document.fonts.load('20px "Russo One"'), document.fonts.load('16px Rubik')]), new Promise(r => setTimeout(r, 1500))]);
    }
  } catch (e) {}
  lastAdAt = (performance && performance.now()) || 0;
  layout();
  G = makeGame(Math.min(save.unlocked, 60));
  updSend();
  updMenu();
  setState('menu');
  lastT = (performance && performance.now()) || 0;
  requestAnimationFrame(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => Platform.ready()));
}

// Debug / test hook (read-only helpers used by the headless harness).
window.__roy = {
  get G() { return G; }, get state() { return state; }, get save() { return save; },
  get view() { return { scale: scale, offX: offX, offY: offY, LAY: LAY }; },
  startLevel: startLevel, setState: setState, nextLevel: nextLevel, layout: layout, useAbility: useAbility
};
boot();
})();
