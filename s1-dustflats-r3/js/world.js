'use strict';
// Wasteland Drift · world.js: the endless wasteland: seeded chunks, trap pockets, the Bull's turf, ground painting, collision.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ the endless wasteland: chunks from a seed, trap pockets on open sand ============
const CH = 800, BGS = 0.75, chunks = new Map();   // ground canvases at 0.75 px per unit: crisp enough for ink lines, light enough for a phone
let walls = [], posts = [], cranes = [], drums = [], crates = [], oils = [], sands = [], balls = [];
const turfR = () => fast ? 2200 : 3200;   // the Bull's turf: this close to the depot the ground is scrapyard, and it comes for you
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash2 = (cx, cy) => { let h = Math.imul(cx, 374761393) + Math.imul(cy, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return (h ^ h >>> 16) >>> 0; };
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function starPath(g, x, y, r, n, inner, rot = 0) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU - Math.PI / 2 + rot, d = i % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.closePath(); }
// pockets: designed in local space around (0,0), turned in 90° steps, dropped in the middle of a chunk
const POCKETS = {
  gates(P) { for (let i = 0; i < 4; i++) { const x = -240 + i * 160, y = (i % 2 ? 1 : -1) * 55; P.post(x, y - 52); P.post(x, y + 52); } },
  utrap(P) { P.wall(-150, -170, 300, 40); P.wall(-170, -170, 40, 250); P.wall(130, -170, 40, 250); },
  alley(P) { P.wall(-230, -115, 460, 36); P.wall(-230, 79, 460, 36); for (const x of [-130, 0, 130]) P.drum(x + P.R() * 30 - 15, P.R() * 60 - 30); },
  runway(P) { P.oil(-140, 0, 105); P.wall(30, -120, 40, 240); },
  wrecker(P) { P.wall(-320, -25, 200, 50); P.wall(120, -25, 200, 50); P.crane(0, -175, 0, 1); },
  boxes(P) { for (let i = 0; i < 7; i++) P.crate(-150 + i * 50, 0); P.crate(-150 + 3 * 50, -50); },
};
// the old highway: each leg follows a broken road from where it starts to its depot gate, meandering in between
function makeRoad(x0, y0, x1, y1) { return { x0, y0, x1, y1, amp: rand(170, 300), wl: rand(2600, 3800), ph: rand(0, TAU) }; }
function roadX(y) {   // the road's centre at this y, or null where no road runs
  for (const D of allDepots()) {
    const r = D.road; if (!r || y < r.y1 + 240 || y > r.y0 + (r.first ? 4000 : 0)) continue;
    const t = clamp((r.y0 - y) / (r.y0 - r.y1), 0, 1), taper = Math.min(1, t * 5, (1 - t) * 5);
    return r.x0 + (r.x1 - r.x0) * t + r.amp * Math.sin((r.y0 - y) / r.wl * TAU + r.ph) * taper;
  }
  return null;
}
function canyon(ch, R) {   // the narrows: cliffs on both sides of a gap a car or two wide. Shove someone into the rock here.
  let cx = ch.x + CH / 2 + (R() - 0.5) * 200, w = 260 + R() * 80, dropL = false, dropR = false;
  const rs = [0, 0.25, 0.5, 0.75, 1].map(f => roadX(ch.y + CH * f)).filter(v => v !== null);   // the road runs through the pass
  if (rs.length) {
    const lo = Math.min(...rs), hi = Math.max(...rs);
    dropL = lo < ch.x + 200 + ROAD_W; dropR = hi > ch.x + CH - 200 - ROAD_W;   // the road hugs an edge: no cliff on that side, or it would sit on the road
    if (!dropL && !dropR) { cx = (lo + hi) / 2; w = Math.max(w, hi - lo + ROAD_W * 2 + 140); }
  }
  w = Math.min(w, CH - 200);
  let lEnd = cx - w / 2, rStart = cx + w / 2;
  if (rs.length) { lEnd = Math.min(lEnd, Math.min(...rs) - ROAD_W - 80); rStart = Math.max(rStart, Math.max(...rs) + ROAD_W + 80); }   // and whichever cliffs stay keep clear of the road all the way down
  if (!dropL && lEnd - ch.x - 30 > 40) ch.walls.push({ x: ch.x + 30, y: ch.y + 34, w: lEnd - ch.x - 30, h: CH - 68, rock: true, side: 'L', hp: Infinity, ch, shakeT: 0 });   // inset: each cliff is a rock mass with rough ends
  if (!dropR && ch.x + CH - 30 - rStart > 40) ch.walls.push({ x: rStart, y: ch.y + 34, w: ch.x + CH - 30 - rStart, h: CH - 68, rock: true, side: 'R', hp: Infinity, ch, shakeT: 0 });
  if (R() < 0.5) ch.drums.push({ x: cx + (R() - 0.5) * (w - 80), y: ch.y + 200 + R() * 400, r: 17, ch });
}
// along the highway, every few seconds something to trick the chasers into: a slalom of rock pillars, red barrel clusters,
// or a wreck gate with one gap. Weave through and the pack behind you piles into it.
function roadPiece(ch, R) {
  const rx = roadX(ch.y + CH / 2);
  if (rx === null || rx < ch.x + 140 || rx > ch.x + CH - 140 || ch.walls.length || ch.pocket || R() > 0.55) return;
  const at = y => roadX(y) ?? rx, kind = R();
  if (kind < 0.45) {   // the slalom: pillars staggered either side of the line, a car's width of road between them
    const n = 5 + Math.floor(R() * 3), y0 = ch.y + 100, dy = (CH - 200) / (n - 1), s0 = R() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) { const y = y0 + i * dy, s = i % 2 ? s0 : -s0; ch.rocks.push({ x: at(y) + s * (48 + R() * 40), y, r: 21 + R() * 7 }); }
  } else if (kind < 0.75) {   // barrels: two red clusters on the road's edges, one further up than the other
    for (const s of [-1, 1]) { const y = ch.y + 200 + R() * 400, x = at(y) + s * (ROAD_W * 0.85 + R() * 30); for (let i = 0; i < 3; i++) ch.drums.push({ x: x + (i - 1) * 28 * s, y: y + (i % 2) * 32, r: 17, ch }); }
  } else {   // a wreck gate: scrap walls across the road, one gap a car or two wide
    const y = ch.y + 340 + R() * 120, cx = at(y), gx = cx + (R() - 0.5) * 110, half = 82;
    ch.walls.push({ x: cx - 300, y: y - 22, w: gx - half - (cx - 300), h: 44, hp: 3, ch, shakeT: 0 });
    ch.walls.push({ x: gx + half, y: y - 22, w: cx + 300 - (gx + half), h: 44, hp: 3, ch, shakeT: 0 });
  }
}
function genChunk(cx, cy) {
  if (demo && demo.layout) return demoChunk(cx, cy);   // a demo road: cut from its layout
  const mx = cx * CH + CH / 2, my = cy * CH + CH / 2, toDepot = Math.min(1e9, ...allDepots().map(D => Math.hypot(mx - D.x, my - D.y))), toFort = Math.min(1e9, ...allDepots().filter(D => D.boss).map(D => Math.hypot(mx - D.x, my - D.y))), scrap = toFort < turfR() + 500;
  const R = seeded(hash2(cx, cy) + (scrap ? 7919 : 0));
  const ch = { cx, cy, x: cx * CH, y: cy * CH, scrap, walls: [], posts: [], rocks: [], cranes: [], drums: [], crates: [], oils: [], sands: [], balls: [], ramps: [], roughs: [], bumps: [] };
  const home = Math.hypot(mx, my) < 700 || toDepot < 750;   // the start and the depot stay open
  const builder = (ox, oy, rot) => {
    const T = (x, y) => rot === 0 ? [ox + x, oy + y] : rot === 1 ? [ox - y, oy + x] : rot === 2 ? [ox - x, oy - y] : [ox + y, oy - x];
    return {
      R,
      wall(x, y, w, h) { const [ax, ay] = T(x, y), [bx, by] = T(x + w, y + h); ch.walls.push({ x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), hp: 3, ch, shakeT: 0 }); },
      post(x, y) { const [px, py] = T(x, y); ch.posts.push({ x: px, y: py, r: 11 }); },
      drum(x, y) { const [px, py] = T(x, y); ch.drums.push({ x: px, y: py, r: 17, ch }); },
      crate(x, y) { const [px, py] = T(x, y); ch.crates.push({ x: px, y: py, r: 21, ch }); },
      oil(x, y, r) { const [px, py] = T(x, y); ch.oils.push({ x: px, y: py, r }); },
      crane(x, y, dx, dy) { const [px, py] = T(x, y), [qx, qy] = T(x + dx, y + dy), d = [qx - px, qy - py]; ch.cranes.push({ x: px, y: py, r: 26 }); ch.balls.push({ px, py, dx: d[0], dy: d[1], L: 175, amp: 0.62, w: rand(1.6, 2.1), ph: R() * TAU, r: 30, x: px, y: py + 175, vx: 0, vy: 0 }); },
    };
  };
  if (home) {}
  else if (scrap) {   // boss ground: open sand with rock pillars, the odd scrap wall and drum. Room to drift, things to bait the Bull into
    const P = builder(0, 0, 0), spots = [];
    const free = (x, y, d) => !spots.some(([a, b, e]) => Math.hypot(a - x, b - y) < Math.max(d, e));
    const at = m => [ch.x + m + R() * (CH - 2 * m), ch.y + m + R() * (CH - 2 * m)];
    for (let i = 0, t = 0; i < 2 && t < 60; t++) { const [x, y] = at(110); if (!free(x, y, 320)) continue; ch.rocks.push({ x, y, r: 30 + R() * 10 }); spots.push([x, y, 320]); i++; }
    if (R() < 0.6) for (let t = 0; t < 40; t++) { const [x, y] = at(140); if (!free(x, y, 300)) continue; const horiz = R() < 0.5, w = horiz ? 170 : 44, h = horiz ? 44 : 170; P.wall(x - w / 2, y - h / 2, w, h); spots.push([x, y, 300]); break; }
    if (R() < 0.5) for (let t = 0; t < 40; t++) { const [x, y] = at(80); if (!free(x, y, 220)) continue; P.drum(x, y); spots.push([x, y, 220]); break; }
    if (R() < 0.25) for (let t = 0; t < 40; t++) { const [x, y] = at(150); if (!free(x, y, 260)) continue; P.oil(x, y, 80 + R() * 25); spots.push([x, y, 260]); break; }
  } else if (sectionAt(my) && genSection(ch, R, sectionAt(my))) {   // a stretch of road with its own character (sections.js)
  } else {
    const RG = REG();
    if (R() < RG.canyon) canyon(ch, R);
    else if (R() < RG.pocket) { const kind = ch.pocket = RG.pockets[Math.floor(R() * RG.pockets.length)]; POCKETS[kind](builder(ch.x + CH / 2 + (R() - 0.5) * 120, ch.y + CH / 2 + (R() - 0.5) * 120, Math.floor(R() * 4))); }
    else {
      if (R() < 0.45) ch.sands.push({ x: ch.x + 200 + R() * 400, y: ch.y + 200 + R() * 400, r: 110 + R() * 40 });
      if (R() < 0.5) builder(0, 0, 0).drum(ch.x + 120 + R() * 560, ch.y + 120 + R() * 560);
      if (R() < RG.oil) builder(0, 0, 0).oil(ch.x + 150 + R() * 500, ch.y + 150 + R() * 500, 80 + R() * 30);
      if (R() < 0.6) { const x = ch.x + 140 + R() * 520, y = ch.y + 140 + R() * 520, r = roadX(y); if (r === null || Math.abs(r - x) > ROAD_W + 90) ch.rocks.push({ x, y, r: 26 + R() * 14 }); }   // a rock pillar out on the sand: something to swing round
    }
    roadPiece(ch, R);
    placeHazards(ch, R);   // ramps, and now and then an outpost
  }
  paintChunk(ch, R);
  return ch;
}
function paintChunk(ch, R) {
  ch.cv = document.createElement('canvas'); ch.cv.width = ch.cv.height = CH * BGS; const g = ch.g = ch.cv.getContext('2d');
  g.setTransform(BGS, 0, 0, BGS, -ch.x * BGS, -ch.y * BGS);
  paintGround(g, ch, R);
  if (ch.paint) ch.paint(g);   // a demo canyon's cliffs
  paintTracks(g, ch);
  paintSections(g, ch);   // ravines
  for (const Rp of ch.roughs) paintRough(g, Rp);
  for (const Rp of ch.bumps) paintBump(g, Rp);
  for (const Rp of ch.ramps) paintRamp(g, Rp);
  for (const S of ch.sands) paintSoftSand(g, S);
  for (const O of ch.oils) paintOil(g, O);
  for (const P of ch.posts) paintPost(g, P);
  for (const W of ch.walls) if (W.building) paintBuilding(g, W); else if (W.rock) paintCliff(g, W, ch);
  for (const P of ch.rocks) if (P.field) continue; else if (P.derrick) paintDerrick(g, P); else if (P.wreck) paintWreck(g, P); else paintMesa(g, P);   // field rocks: painted with the canyon's rock mass
  for (const C of ch.cranes) paintCraneBase(g, C);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function scrapWall(g, B) {   // welded rust plates: a sunlit top edge, seams, rivets, a hatched shadow side and the crash star
  const horiz = B.w >= B.h, L = horiz ? B.w : B.h;
  g.fillStyle = SHADOW; rr(g, B.x + 12, B.y + 16, B.w, B.h, 6); g.fill();
  inkRR(g, B.x, B.y, B.w, B.h, 6, 'rust', { line: false });
  g.save(); rr(g, B.x, B.y, B.w, B.h, 6); g.clip();
  g.fillStyle = '#c8693a'; if (horiz) g.fillRect(B.x, B.y, B.w, B.h * 0.32); else g.fillRect(B.x, B.y, B.w * 0.32, B.h);   // the sunlit edge
  g.fillStyle = DOTS.fine; if (horiz) g.fillRect(B.x, B.y + B.h * 0.58, B.w, B.h); else g.fillRect(B.x + B.w * 0.58, B.y, B.w, B.h);
  g.strokeStyle = 'rgba(36,22,15,.5)'; g.lineWidth = 1; g.beginPath();
  if (horiz) for (let i = -B.h; i < B.w; i += 4.5) { g.moveTo(B.x + i, B.y + B.h); g.lineTo(B.x + i + B.h * 0.5, B.y + B.h * 0.6); } else for (let i = -B.w; i < B.h; i += 4.5) { g.moveTo(B.x + B.w, B.y + i); g.lineTo(B.x + B.w * 0.6, B.y + i + B.w * 0.5); }
  g.stroke();
  g.fillStyle = PAL.rust2; const R2 = seeded(Math.round(B.x * 3 + B.y)); for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(B.x + R2() * B.w, B.y + R2() * B.h, 4 + R2() * 4, 3 + R2() * 3, R2() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); for (let i = 46; i < L; i += 46) { if (horiz) { g.moveTo(B.x + i, B.y); g.lineTo(B.x + i, B.y + B.h); } else { g.moveTo(B.x, B.y + i); g.lineTo(B.x + B.w, B.y + i); } } g.stroke();   // plate seams
  g.restore();
  rr(g, B.x, B.y, B.w, B.h, 6); g.lineWidth = 3.4; g.strokeStyle = INK; g.stroke();
  g.save(); g.translate(0.8, 0.6); g.globalAlpha = 0.35; rr(g, B.x, B.y, B.w, B.h, 6); g.lineWidth = 1; g.stroke(); g.restore();
  const rv = []; for (let i = 10; i < L - 6; i += 23) rv.push(horiz ? [B.x + i, B.y + 7] : [B.x + 7, B.y + i]); rivets(g, rv, 1.8);
}
function crashIcon(g, x, y, r) {
  starPath(g, x, y, r, 8, 0.5); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(x, y, r * 0.35, 0, TAU); g.fill();
}
function spinIcon(g, x, y, r) {
  g.save(); g.strokeStyle = 'rgba(255,244,220,.9)'; g.fillStyle = 'rgba(255,244,220,.9)'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, r * 0.7, 0.3, TAU - 0.9); g.stroke();
  const a = TAU - 0.9, ex = x + Math.cos(a) * r * 0.7, ey = y + Math.sin(a) * r * 0.7;
  g.beginPath(); g.moveTo(ex + 11, ey + 2); g.lineTo(ex - 3, ey - 10); g.lineTo(ex - 6, ey + 8); g.closePath(); g.fill(); g.restore();
}
function snailIcon(g, x, y, r) {
  g.save(); g.fillStyle = 'rgba(255,244,220,.8)'; g.strokeStyle = 'rgba(255,244,220,.8)'; g.lineCap = 'round';
  rr(g, x - r, y + r * 0.15, r * 1.9, r * 0.38, r * 0.19); g.fill();
  g.lineWidth = 3; g.beginPath(); g.moveTo(x + r * 0.7, y + r * 0.2); g.lineTo(x + r * 0.85, y - r * 0.25); g.moveTo(x + r * 0.85, y + r * 0.2); g.lineTo(x + r * 1.05, y - r * 0.2); g.stroke();
  g.beginPath(); g.arc(x - r * 0.1, y - r * 0.15, r * 0.55, 0, TAU); g.fill();
  g.strokeStyle = '#a0602c'; g.lineWidth = 3.5; g.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.32, d = r * 0.45 * (1 - i / 44); g.lineTo(x - r * 0.1 + Math.cos(a) * d, y - r * 0.15 + Math.sin(a) * d); } g.stroke();
  g.restore();
}




let lastCX = null, lastCY = null, chunkQ = [], chunkFrame = -1;   // at most one new chunk painted per drawn frame, unless one is already on screen
function ensureChunks(force) {   // keeps a 5x5 block of chunks round you; new ones are built nearest first, one per tick, so crossing a border never hitches
  const pcx = Math.floor(player.x / CH), pcy = Math.floor(player.y / CH);
  let changed = false;
  if (force || pcx !== lastCX || pcy !== lastCY) {
    lastCX = pcx; lastCY = pcy; chunkQ = [];
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (!chunks.has(`${pcx + dx},${pcy + dy}`)) chunkQ.push([pcx + dx, pcy + dy, dx * dx + dy * dy]);
    chunkQ.sort((a, b) => a[2] - b[2]);
    for (const [k, ch] of chunks) if (Math.abs(ch.cx - pcx) > 3 || Math.abs(ch.cy - pcy) > 3) { chunks.delete(k); changed = true; }
  }
  const make = ([cx, cy]) => { const k = `${cx},${cy}`; if (!chunks.has(k)) { chunks.set(k, genChunk(cx, cy)); changed = true; } };
  for (let i = 0; i < chunkQ.length;) { const q = chunkQ[i]; if (force || inView(q[0] * CH + CH / 2, q[1] * CH + CH / 2, CH / 2 + 150)) { chunkQ.splice(i, 1); make(q); } else i++; }   // anything on screen, now
  if (chunkQ.length && chunkFrame !== frameNo) { make(chunkQ.shift()); chunkFrame = frameNo; }   // then one more a frame, nearest first
  if (changed) rebuildLists();
}
function rebuildLists() {
  walls = []; posts = allDepots().flatMap(D => D.tanks); cranes = []; drums = []; crates = []; oils = []; sands = []; balls = []; ramps = []; roughs = []; bumps = [];
  for (const ch of chunks.values()) { ramps.push(...ch.ramps); roughs.push(...ch.roughs); bumps.push(...ch.bumps); walls.push(...ch.walls); posts.push(...ch.posts, ...ch.rocks); if (ch.cliffs) posts.push(...ch.cliffs); cranes.push(...ch.cranes); drums.push(...ch.drums); crates.push(...ch.crates); oils.push(...ch.oils); sands.push(...ch.sands); balls.push(...ch.balls); }
}
function paintAt(x0, y0, x1, y1, fn) {
  for (const ch of chunks.values()) {
    if (x1 < ch.x || x0 > ch.x + CH || y1 < ch.y || y0 > ch.y + CH) continue;
    ch.g.setTransform(BGS, 0, 0, BGS, -ch.x * BGS, -ch.y * BGS); fn(ch.g); ch.g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
function scorch(x, y, r = crand(50, 66)) {   // an inked, hatched scorch mark
  paintAt(x - r, y - r, x + r, y + r, g => {
    g.fillStyle = 'rgba(36,22,15,.22)'; starPath(g, x, y, r, 9, 0.7, crand(0, 1)); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(36,22,15,.35)'; g.lineWidth = 3; for (let i = -r; i < r; i += 9) { g.beginPath(); g.moveTo(x + i, y - r); g.lineTo(x + i + r, y + r); g.stroke(); } g.restore();
  });
}

// ============ collision ============
function circleRect(c, B) {
  const nx = clamp(c.x, B.x, B.x + B.w), ny = clamp(c.y, B.y, B.y + B.h), dx = c.x - nx, dy = c.y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return null;
  if (d2 > 1e-6) { const d = Math.sqrt(d2); return { nx: dx / d, ny: dy / d, pen: c.r - d }; }
  const l = c.x - B.x, r = B.x + B.w - c.x, t = c.y - B.y, b = B.y + B.h - c.y, m = Math.min(l, r, t, b);
  return m === l ? { nx: -1, ny: 0, pen: l + c.r } : m === r ? { nx: 1, ny: 0, pen: r + c.r } : m === t ? { nx: 0, ny: -1, pen: t + c.r } : { nx: 0, ny: 1, pen: b + c.r };
}
function circleCircle(c, o) { const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy), rs = c.r + o.r; return d >= rs ? null : d > 1e-6 ? { nx: dx / d, ny: dy / d, pen: rs - d } : { nx: 1, ny: 0, pen: rs }; }
const near = (a, b, m) => Math.abs(a.x - b.x) < m && Math.abs(a.y - b.y) < m;
// The player's body in the demo, for rock: three circles down its length that reach its drawn nose, tail and wheels,
// so it meets a wall where you see it meet the wall (the campaign keeps its single circle).
function carHull(c) {
  const A = CAR_ART[c.car] || CAR_ART.interceptor, Sz = CAR * c.size * 0.72, [, ry, , rh] = rearWheel(c.car || 'interceptor', 0), r = (ry + rh / 2) * Sz - 1;
  const f = A.nose * Sz - r, b = A.tail * Sz + r, cs = Math.cos(c.a), sn = Math.sin(c.a);
  return [f, (f + b) / 2, b].map(o => ({ x: c.x + cs * o, y: c.y + sn * o, r, o }));
}
// push a car out of the world; crates break if you hit them fast. Returns the hardest impact speed.
function hitWorld(c) {
  let imp = 0;
  const res = (h, e) => { c.x += h.nx * h.pen; c.y += h.ny * h.pen; const vn = c.vx * h.nx + c.vy * h.ny; if (vn < 0) { const dvx = -(1 + e) * vn * h.nx, dvy = -(1 + e) * vn * h.ny; c.vx += dvx; c.vy += dvy; spinHit(c, c.x - h.nx * c.r, c.y - h.ny * c.r, dvx * (c.m || 1), dvy * (c.m || 1), 0.07); return -vn; } return 0; };
  c.lastWall = null; c.lastPost = null; let wi = 0;
  for (const B of walls) { if (Math.abs(B.x + B.w / 2 - c.x) > B.w / 2 + 40 || Math.abs(B.y + B.h / 2 - c.y) > B.h / 2 + 40) continue; const h = circleRect(c, B); if (h && B.wood && Math.hypot(c.vx, c.vy) > 110) { smashWood(B, c); continue; } if (h) { const v = res(h, 0.3); if (v > wi) { wi = v; c.lastWall = B; } imp = Math.max(imp, v); } }
  if (demo && c === player && !c.air) {   // the demo: your drawn body against rock (a big rock is checked from its edge, not from 80 off its centre)
    for (const p of posts) { if (!near(c, p, p.r + 70)) continue; for (let k = 0; k < 3; k++) { const b = carHull(c)[k], h = circleCircle(b, p); if (h) { imp = Math.max(imp, res(h, 0.35)); c.lastPost = p; } } }
  } else for (const p of posts) { if (!near(c, p, 80)) continue; const h = circleCircle(c, p); if (h) { imp = Math.max(imp, res(h, 0.35)); c.lastPost = p; } }   // the rock it hit, for who led it there
  for (const p of cranes) { if (!near(c, p, 70)) continue; const h = circleCircle(c, p); if (h) imp = Math.max(imp, res(h, 0.3)); }
  for (const b of crates) { if (b.gone || !near(c, b, 50)) continue; const h = circleCircle(c, b); if (!h) continue; if (Math.hypot(c.vx, c.vy) > 90) breakCrate(b); else res(h, 0.2); }
  return imp;
}
const blocked = (x, y, r) => { const c = { x, y, r }; return walls.some(B => circleRect(c, B)) || posts.some(p => circleCircle(c, p)) || cranes.some(p => circleCircle(c, p)) || drums.some(b => !b.gone && circleCircle(c, b)); };
const onRough = c => roughs.some(m => Math.hypot(c.x - m.x, c.y - m.y) < m.r);
const inSand = c => sands.some(m => Math.hypot(c.x - m.x, c.y - m.y) < m.r) || craters.some(m => Math.hypot(c.x - m.x, c.y - m.y) < m.r);
const lineBlocked = (x0, y0, x1, y1) => { for (let i = 1; i < 8; i++) { const t = i / 8; if (walls.some(B => circleRect({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, r: 4 }, B))) return true; } return false; };
