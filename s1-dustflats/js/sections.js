'use strict';
// Wasteland Drift · sections.js: the road changes every 20-30 seconds. Each stretch has its own look and its own places
// to trick the chasers into, and a sign warns you what's coming:
//   CANYON PASS: cliffs both sides, rocks falling on the road.   RUINED TOWN: buildings, alleys, burnt-out cars.
//   OIL FIELD: derricks, slicks, fire geysers.                   DUNE SEA: ridges and ramps everywhere.
//   SCRAPYARD: scrap walls and wrecking balls over the road.     BROKEN BRIDGE: a ravine to jump off the ramp, or a
//   narrow bridge to find. Anything that falls in, chasers included, is gone.
// Classic scripts sharing one global scope, loaded in order by index.html.

const SECTIONS = {
  canyon: { name: 'CANYON PASS',   sub: 'DODGE THE ROCKS · LURE THEM UNDER' },
  town:   { name: 'RUINED TOWN',   sub: 'CUT CORNERS · THEY HIT THE WALLS' },
  oil:    { name: 'OIL FIELD',     sub: 'GEYSERS ERUPT · LEAD THEM IN' },
  dunes:  { name: 'DUNE SEA',      sub: 'RIDGES AND RAMPS · LAND ON THEM' },
  scrap:  { name: 'SCRAPYARD',     sub: 'TIME THE BALLS · LET THEM GET HIT' },
  bridge: { name: 'BROKEN BRIDGE', sub: 'HIT THE RAMP, OR FIND THE BRIDGE' },
};
const SECTION_POOL = { flats: ['canyon', 'dunes', 'town', 'bridge', 'oil', 'scrap'], yards: ['scrap', 'town', 'oil', 'bridge', 'canyon', 'dunes'], salt: ['dunes', 'canyon', 'bridge', 'town', 'oil', 'scrap'] };
let rocksFalling = [], geysers = [], hazT = 0, curSection = null;
function resetSections() { rocksFalling = []; geysers = []; hazT = 2; curSection = null; }
const SET_KINDS = { canyon: ['canyon'], town: ['town'], scrap: ['scrap'], oil: ['oil'], dunes: ['dunes'], bridge: ['bridge'], mix: ['canyon', 'town', 'scrap', 'oil', 'dunes', 'bridge'] };   // the stretches each stage's idea is built from
function planSections(D, y0) {   // the stage's road: open to start, then its idea in a few stretches of 4.5-6.5 km with a breather between, open again near the fortress
  D.sections = []; D.ravines = []; D.signs = [];
  const kinds = SET_KINDS[STG().set]; if (!kinds) return;   // open desert, the convoy road and the storm have no stretches
  const want = STG().set === 'mix' ? 4 : 3, end = D.y + 3400, pool = shuffle([...kinds]);   // the last stage mixes them all
  let y = y0 - 5000, i = 0;
  while (y - 4000 > end && D.sections.length < want) {
    const kind = pool[i++ % pool.length], len = kind === 'bridge' ? 3200 : rand(4500, 6500), y1 = Math.max(end, y - len), S = { kind, y0: y, y1 };
    D.sections.push(S);
    const rx = roadX(y + 500) ?? D.x; D.signs.push({ x: rx + ROAD_W + 80, y: y + 500, text: SECTIONS[kind].name });
    if (kind === 'bridge') { const ry = (y + y1) / 2, cx = roadX(ry) ?? D.x, bx = cx + (grand() < 0.5 ? -1 : 1) * rand(130, 180); D.ravines.push({ x0: cx - 950, x1: cx + 950, y0: ry - 90, y1: ry + 90, bx0: bx - 48, bx1: bx + 48, cx }); }
    y = y1 - rand(1000, 1800);   // a short breather of open road
  }
}
function sectionAt(y) { for (const D of allDepots()) if (D.sections) for (const S of D.sections) if (y <= S.y0 && y >= S.y1) return S; return null; }
function inRavine(c) { for (const D of allDepots()) for (const V of D.ravines || []) if (c.x > V.x0 && c.x < V.x1 && c.y > V.y0 && c.y < V.y1 && !(c.x > V.bx0 && c.x < V.bx1)) return V; return null; }

// ============ building a chunk of a stretch (from genChunk) ============
function genSection(ch, R, S) {
  const my = ch.y + CH / 2, rx = roadX(my); if (rx === null || rx < ch.x - 200 || rx > ch.x + CH + 200) return false;
  const at = y => roadX(y) ?? rx;
  if (S.kind === 'canyon') { canyon(ch, R); if (R() < 0.35) ch.drums.push({ x: at(my) + (R() - 0.5) * 120, y: ch.y + 150 + R() * 500, r: 17, ch }); }
  else if (S.kind === 'town') {   // blocks of ruined buildings either side, alleys between them, a burnt-out car now and then
    for (const s of [-1, 1]) for (let y = ch.y + 10 + R() * 40; y < ch.y + CH - 80;) {
      const h = 100 + R() * 120, w = 120 + R() * 130, x0 = at(y + h / 2) + s * (ROAD_W + 46 + R() * 50), x = s > 0 ? x0 : x0 - w;
      if (R() < 0.85) ch.walls.push({ x, y, w, h, hp: Infinity, rock: true, building: true, ch, shakeT: 0, seed: Math.floor(R() * 999) });
      const x2 = s > 0 ? x + w + 60 + R() * 50 : x - 60 - R() * 50, w2 = 140 + R() * 160; if (R() < 0.8) ch.walls.push({ x: s > 0 ? x2 : x2 - w2, y: y + R() * 30, w: w2, h: h * (0.8 + R() * 0.4), hp: Infinity, rock: true, building: true, ch, shakeT: 0, seed: Math.floor(R() * 999) });   // a second row behind: the street is the way through
      y += h + 70 + R() * 90;
    }
    if (R() < 0.6) { const y = ch.y + 150 + R() * 500; ch.rocks.push({ x: at(y) + (R() - 0.5) * 90, y, r: 22, wreck: true, a: R() * TAU }); }
    if (R() < 0.45) { const y = ch.y + 200 + R() * 400, x = at(y) + (R() < 0.5 ? -1 : 1) * (ROAD_W + 20); for (let i = 0; i < 2; i++) ch.drums.push({ x: x + i * 30, y: y + i * 12, r: 17, ch }); }
  }
  else if (S.kind === 'oil') {   // derricks by the road, slicks on it, barrels; the geysers come in updateSections
    for (let i = 0; i < 2; i++) { const s = R() < 0.5 ? -1 : 1, y = ch.y + 120 + R() * 560; ch.rocks.push({ x: at(y) + s * (ROAD_W + 110 + R() * 170), y, r: 26, derrick: true }); }
    for (let i = 0; i < 2; i++) { const y = ch.y + 120 + R() * 560; ch.oils.push({ x: at(y) + (R() - 0.5) * 200, y, r: 58 + R() * 28 }); }
    if (R() < 0.55) { const y = ch.y + 200 + R() * 400, x = at(y) + (R() < 0.5 ? -1 : 1) * (ROAD_W + 60); for (let i = 0; i < 3; i++) ch.drums.push({ x: x + (i - 1) * 28, y: y + (i % 2) * 30, r: 17, ch }); }
  }
  else if (S.kind === 'dunes') {   // ridge after ridge across the road, ramps, soft sand on the sides
    for (let y = ch.y + 60 + R() * 60; y < ch.y + CH - 60; y += 130 + R() * 100) ch.bumps.push({ x: at(y) + (R() - 0.5) * 100, y, rx: 120 + R() * 50, ry: 22, a: (R() - 0.5) * 0.3 });
    if (R() < 0.75) { const y = ch.y + 200 + R() * 400; ch.ramps.push({ x: at(y) + (R() - 0.5) * 60, y, a: -Math.PI / 2 + (R() - 0.5) * 0.3, w: 92, L: 100 }); }
    for (const s of [-1, 1]) if (R() < 0.5) ch.sands.push({ x: at(my) + s * (ROAD_W + 180 + R() * 120), y: ch.y + 200 + R() * 400, r: 110 + R() * 40 });
  }
  else if (S.kind === 'scrap') {   // scrap walls lining the road, a crane swinging its ball over it
    for (const s of [-1, 1]) for (let y = ch.y + 40 + R() * 80; y < ch.y + CH - 120; y += 220 + R() * 160) { const h = 130 + R() * 90, x = at(y) + s * (ROAD_W + 70 + R() * 60); ch.walls.push({ x: s > 0 ? x : x - 44, y, w: 44, h, hp: 3, ch, shakeT: 0 }); const xo = at(y) + s * (ROAD_W + 300 + R() * 120); ch.walls.push({ x: s > 0 ? xo : xo - 200, y: y + 40, w: 200, h: 44, hp: 3, ch, shakeT: 0 }); }   // an outer fence of scrap
    if (R() < 0.7) { const y = ch.y + 250 + R() * 300, s = R() < 0.5 ? -1 : 1, px = at(y) + s * (ROAD_W + 175), py = y; ch.cranes.push({ x: px, y: py, r: 26 }); ch.balls.push({ px, py, dx: -s, dy: 0, L: 175, amp: 0.62, w: rand(1.6, 2.1), ph: R() * TAU, r: 30, x: px, y: py + 175, vx: 0, vy: 0 }); }
  }
  else if (S.kind === 'bridge') {   // the ramp up to the ravine's edge, dead on the road; the ravine itself is painted from the leg's plan
    for (const D of allDepots()) for (const V of D.ravines || []) { const y = V.y1 + 75; if (y > ch.y && y < ch.y + CH && V.cx > ch.x && V.cx < ch.x + CH) ch.ramps.push({ x: V.cx, y, a: -Math.PI / 2, w: 170, L: 100, kick: true }); }
  }
  return true;
}

// ============ while you drive it ============
function updateSections(dt) {
  if (state !== 'play' || !depot) return;
  curSection = sectionAt(player.y);
  for (const S of depot.sections || []) if (!S.told && player.y > S.y0 && player.y - S.y0 < 1600) { S.told = true; if (!banner) { banner = { text: SECTIONS[S.kind].name + ' AHEAD', t: 0, short: true }; hint(SECTIONS[S.kind].sub); } }   // the sign, a little before it starts
  const S = curSection;
  hazT -= dt;
  if (S && hazT <= 0 && !boss) {
    if (S.kind === 'canyon') { hazT = rand(2, 3); rocksFalling.push({ x: player.x + player.vx * 0.95 + rand(-100, 100), y: player.y + player.vy * 0.95 + rand(-100, 100), t: 0, T: 1.1 }); }   // a rock coming down where you'll be
    else if (S.kind === 'oil') { hazT = rand(1.1, 1.8); const y = player.y + player.vy * 1.05 + rand(-80, 80), r = roadX(y); geysers.push({ x: (r ?? player.x) + (r === null ? player.vx * 1.05 : 0) + rand(-140, 140), y, t: 0, T: 1 }); }   // the ground glows, then fire
  }
  for (const F of rocksFalling) {
    F.t += dt; if (F.t < F.T) { lureTouch(F, F.x, F.y, 70); continue; } F.gone = true;   // its shadow is the warning: pass under it and the one behind you doesn't
    boom(F.x, F.y, null, 0.8); SFX.thud(); shake = Math.max(shake, 4 * (calmMotion ? 0.3 : 1));
    for (const k of cars) if (!k.dead && Math.hypot(k.x - F.x, k.y - F.y) < 46 + k.r) { const C = resolveWreckCause(k, 'rock', F); if (k.T.armour || k.T.elite) damage(k, k.maxHp * 0.3, 'trick', 'ROCKFALL!', undefined, undefined, undefined, C); else wreck(k, 'ROCKFALL!', 'trick', undefined, C); }
    if (Math.hypot(player.x - F.x, player.y - F.y) < 46 + player.r && !player.air) hurt(10, false, 'rock');
    const ch = chunks.get(`${Math.floor(F.x / CH)},${Math.floor(F.y / CH)}`);   // and it stays there: one more rock to swing round
    if (ch && !F.temp && !blocked(F.x, F.y, 30)) { const P = { x: F.x, y: F.y, r: 22, fallen: true }; ch.rocks.push(P); paintAt(F.x - 40, F.y - 40, F.x + 40, F.y + 40, g => paintMesa(g, P)); rebuildLists(); }
  }
  rocksFalling = rocksFalling.filter(F => !F.gone);
  for (const G of geysers) {
    G.t += dt; if (G.t < G.T || G.fired) { if (!G.fired) lureTouch(G, G.x, G.y, 70); if (G.t > G.T + 1.4) G.gone = true; continue; }   // the glow is the warning
    G.fired = true; fires.push({ x: G.x, y: G.y, r: 58, t: 0, life: 3, geyser: true, lureKey: G }); SFX.flame(); SFX.pop();   // its pool burns on: lead them through it
    for (let i = 0; i < 10; i++) parts.push({ k: 'fire', x: G.x + crand(-14, 14), y: G.y + crand(-14, 14), vx: crand(-60, 60), vy: crand(-200, -80), t: 0, life: crand(0.4, 0.7), size: crand(9, 15) });
    for (const k of cars) if (!k.dead && Math.hypot(k.x - G.x, k.y - G.y) < 58 + k.r) { const C = resolveWreckCause(k, 'geyser', G); if (k.T.armour || k.T.elite) damage(k, 70, 'trick', 'ERUPTED!', undefined, undefined, undefined, C); else wreck(k, 'ERUPTED!', 'trick', undefined, C); }   // the raiders on it go up, as under a rock
    if (Math.hypot(player.x - G.x, player.y - G.y) < 50 + player.r && !player.air) hurt(8, false, 'geyser');
  }
  geysers = geysers.filter(G => !G.gone);
  // the ravine: cars on the ground that drive in are gone; you climb back out at the near edge, hurt
  for (const D of allDepots()) for (const R of D.ravines || []) if (player.x > R.x0 && player.x < R.x1 && player.y > R.y0 - 200 && player.y < R.y1 + 200) lureTouch(R, player.x, player.y, 1);   // over or beside the gap: the one on your tail follows you into it
  for (const k of cars) if (!k.dead && !k.air && inRavine(k)) wreck(k, 'INTO THE ABYSS!', 'trick', undefined, resolveWreckCause(k, 'ravine', inRavine(k)));
  const V = !player.air && inRavine(player);
  if (V) {
    hurt(10, false, 'fall'); player.falls = (player.falls || 0) + 1;
    const ry = V.y1 + 560; player.x = V.cx; player.y = ry; player.vx = 0; player.vy = -SPEED * 0.9; player.a = -Math.PI / 2; player.inv = 1.5;   // back down the road, lined up on the ramp and already rolling: hold straight and you clear it
    stormY = Math.max(stormY, player.y + 900);   // and the storm gives you room for it
    pops.push({ x: player.x, y: player.y - 60, text: 'FELL IN!', col: '#ff5a46', t: 0 });
    for (let i = 0; i < 12; i++) parts.push({ k: 'dust', x: player.x + crand(-30, 30), y: player.y - 40, vx: crand(-60, 60), vy: crand(-60, 20), t: 0, life: 0.8, size: crand(12, 18) });
  }
}

// ============ drawing ============
function paintBuilding(g, W) {   // a ruined concrete block seen from above: a roof with a broken corner, rubble, dark window holes on the lit side
  const R2 = seeded(W.seed || 7), x = W.x, y = W.y, w = W.w, h = W.h;
  g.fillStyle = SHADOW; g.fillRect(x + 14, y + 18, w, h);
  const bite = 18 + R2() * 30, corner = Math.floor(R2() * 4), pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const c = pts[corner], nx = corner === 1 || corner === 2 ? -1 : 1, ny = corner >= 2 ? -1 : 1;
  pts.splice(corner, 1, [c[0] + nx * bite, c[1]], [c[0] + nx * bite * 0.5, c[1] + ny * bite * 0.6], [c[0], c[1] + ny * bite]);   // the broken corner
  inkPoly(g, pts, '#b9ad9c', { box: [x, y, w, h], lw: 3.2 });
  g.save(); pPoly(g, pts); g.clip();
  g.fillStyle = '#d6cbb8'; g.fillRect(x + 6, y + 6, w - 12, h * 0.18);   // the parapet catching the sun
  g.strokeStyle = 'rgba(36,22,15,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { let px = x + R2() * w, py = y + R2() * h; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (R2() - 0.5) * 30; py += 10 + R2() * 14; g.lineTo(px, py); } g.stroke(); }
  g.fillStyle = 'rgba(36,22,15,.55)'; for (let i = 10; i < w - 14; i += 26) if (R2() < 0.7) g.fillRect(x + i, y + h - 14, 12, 8);
  g.restore();
  for (let i = 0; i < 5; i++) paintBoulder(g, c[0] + nx * R2() * bite * 1.4, c[1] + ny * R2() * bite * 1.4, 4 + R2() * 4, R2);   // the rubble that fell out
}
function paintDerrick(g, P) {   // an oil derrick: a steel lattice tower from above, its pump head, a black puddle
  g.fillStyle = 'rgba(30,20,40,.35)'; g.beginPath(); g.ellipse(P.x + 8, P.y + 14, P.r * 1.5, P.r * 1.1, 0.3, 0, TAU); g.fill();
  const s = P.r; inkRR(g, P.x - s, P.y - s, 2 * s, 2 * s, 3, 'steel', { box: true, lw: 2.6 });
  inkLine(g, [[P.x - s, P.y - s], [P.x + s, P.y + s]], 1.8); inkLine(g, [[P.x + s, P.y - s], [P.x - s, P.y + s]], 1.8);
  inkRR(g, P.x - s * 0.45, P.y - s * 0.45, s * 0.9, s * 0.9, 2, 'dark', { lw: 1.6, double: false });
  inkRR(g, P.x + s * 0.2, P.y - s * 1.6, s * 0.5, s * 1.3, 2, 'yellow', { lw: 1.6, double: false });   // the pump arm
}
function paintWreck(g, P) {   // a burnt-out car shell on the road
  g.save(); g.translate(P.x, P.y); g.rotate(P.a || 0);
  g.fillStyle = SHADOW; g.fillRect(-22, -10, 52, 30);
  inkRR(g, -26, -16, 52, 32, 7, '#4a3a33', { box: true, lw: 2.8 });
  g.fillStyle = 'rgba(255,122,26,.35)'; g.fillRect(-12, -10, 18, 20);
  inkRR(g, -8, -11, 16, 22, 3, 'dark', { lw: 1.4, double: false });
  for (const [x, y] of [[-18, -18], [14, -18], [-18, 18], [14, 18]]) inkCircle(g, x, y, 4.5, '#24160f', { lw: 1, double: false });
  g.restore();
}
function paintRavine(g, V) {   // the ravine: a black drop with crumbling lips, and the narrow bridge across it
  g.fillStyle = '#1d140f'; g.fillRect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0);
  const R2 = seeded(Math.round(V.x0 + V.y0));
  for (const [ey, d] of [[V.y0, 1], [V.y1, -1]]) {   // the lips: rock edges, lit on the far side
    g.fillStyle = PAL.rock; g.beginPath(); g.moveTo(V.x0, ey); for (let x = V.x0; x <= V.x1; x += 30) g.lineTo(x, ey + d * (6 + R2() * 14)); g.lineTo(V.x1, ey); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  }
  g.fillStyle = 'rgba(255,90,60,.12)'; g.fillRect(V.x0, V.y0 + 30, V.x1 - V.x0, V.y1 - V.y0 - 60);   // a glow far below
  const bw = V.bx1 - V.bx0;   // the bridge: planks on two beams
  inkRR(g, V.bx0, V.y0 - 20, bw, V.y1 - V.y0 + 40, 3, '#a8693a', { box: true, lw: 2.8 });
  g.strokeStyle = 'rgba(36,22,15,.55)'; g.lineWidth = 1.4; g.beginPath(); for (let y = V.y0 - 14; y < V.y1 + 20; y += 13) { g.moveTo(V.bx0, y); g.lineTo(V.bx1, y); } g.stroke();
  for (const x of [V.bx0 + 4, V.bx1 - 4]) inkLine(g, [[x, V.y0 - 20], [x, V.y1 + 20]], 3, PAL.steel);
}
function paintSections(g, ch) {   // called from paintChunk: any ravine that crosses this chunk
  for (const D of allDepots()) for (const V of D.ravines || []) if (V.x1 > ch.x && V.x0 < ch.x + CH && V.y1 + 30 > ch.y && V.y0 - 30 < ch.y + CH) paintRavine(g, V);
}
function drawSectionsLow() {   // falling rocks' shadows, glowing geysers, the signs at each stretch
  for (const F of rocksFalling) {
    if (!inView(F.x, F.y, 60)) continue; const k = F.t / F.T;
    ctx.save(); ctx.globalAlpha = 0.35 + 0.5 * k; ctx.fillStyle = 'rgba(36,22,15,.45)'; ctx.beginPath(); ctx.ellipse(F.x, F.y, 10 + 34 * k, 7 + 24 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(F.x, F.y, 50, 0, TAU); ctx.stroke(); ctx.restore();
  }
  for (const G of geysers) {
    if (G.fired || !inView(G.x, G.y, 60)) continue; const k = G.t / G.T;
    ctx.save(); ctx.globalAlpha = 0.4 + 0.5 * k; ctx.fillStyle = '#ff7a1a'; starPath(ctx, G.x, G.y, 16 + 22 * k, 7, 0.45, clock * 3); ctx.fill();
    ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(G.x, G.y, 58, 0, TAU); ctx.stroke(); ctx.restore();
    if (cchance() < 0.3) parts.push({ k: 'puff', x: G.x + crand(-10, 10), y: G.y, vx: crand(-10, 10), vy: crand(-50, -20), t: 0, life: 0.7, size: crand(8, 12), dark: true });
  }
  for (const D of allDepots()) for (const S of D.signs || []) {   // a board on a post at the roadside
    if (!inView(S.x, S.y, 120)) continue;
    ctx.save(); ctx.translate(S.x, S.y); ctx.fillStyle = SHADOW; ctx.fillRect(-60, 6, 128, 34);
    inkRR(ctx, -4, 0, 8, 46, 2, 'rust', { lw: 2, double: false });
    inkRR(ctx, -66, -34, 132, 38, 4, '#e3b072', { box: true, lw: 3 });
    ctx.font = `17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(S.text, 0, -14);
    ctx.restore();
  }
}
function drawSectionsHigh() {   // the rock in the air, right before it lands
  for (const F of rocksFalling) { if (!inView(F.x, F.y, 80)) continue; const k = F.t / F.T; if (k < 0.55) continue; const h = (1 - k) * 380; inkCircle(ctx, F.x, F.y - h, 22, 'rock', { lw: 2.6 }); }
}
