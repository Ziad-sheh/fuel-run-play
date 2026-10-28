'use strict';
// Fuel Run · sprint1.js: the Sprint 1 Dust Flats variants (throwaway test builds), opened by URL:
//   ?variant=road     mostly continuous road with escalating waves, then The Bull in the closed final clearing
//   ?variant=hybrid   the same road, plus short LOCKED clearings (closed by wreck barricades, rocks to ram raiders into)
// Both share one set of rules (all numbers in sprint1_tuning.js):
//   fuel  a steady drain; every wreck you cause refills instantly (it flies to the car: nothing to collect), a ram wreck
//         about 3x a gun wreck; fuel a hit leaked comes back if you wreck something within ~3 s (WON BACK).
//   crack then ram  gun hits CRACK and stagger a raider; ramming a cracked one is a TAKEDOWN: a big refill, a crunch,
//         and a chain bonus for takedowns in a row. Shield trucks only break to rams (guns deflect); flankers are fast
//         side-runners the turret handles (rams glance off them unless cracked). A shield truck stays shielded all its
//         life: only rams (and rocks or pile-ups a ram started) wear it down.
// Everything here runs only in a variant run (s1On()): the existing demo, lab and campaign never reach it. It works by
// wrapping a few existing functions (each wrapper hands straight back to the original outside a variant run).
// Per-run numbers: window.S1_METRICS (and the result screen); every finished run: window.S1_HISTORY.
// Classic scripts sharing one global scope, loaded in order by index.html (after proto.js, before ui.js).

const S1T = SPRINT1_TUNING, S1Q = new URLSearchParams(location.search);
const S1_VARIANTS = { road: 's1road', hybrid: 's1hybrid' };
const S1_BOT = S1Q.get('bot') === '1', S1_SPEED = clamp(Math.round(+S1Q.get('speed') || 1), 1, 16), S1_SKILL = S1Q.get('skill') !== null ? clamp(+S1Q.get('skill'), 0, 1) : 1;
const S1_GUN_SRC = { gun: 1, cannon: 1, rocket: 1 };
const S1_YOU = '#b8ff2a';   // the player's glow: a neon lime no raider wears
const s1PeakCap = () => S1T.spawn.peakCap ?? 10;   // hard ceiling on raiders in view (road and clearings)
let S1 = null, S1_LAST = null, S1_NAP = null;   // this run's state; the last death (for the time to retry); noAutoPause as it was before a bot run
window.S1_METRICS = null; window.S1_HISTORY = [];
const s1On = () => !!(S1 && demo && demo.L && demo.L.s1);

// ============ the two variants, as hidden demo levels (Dust Flats' look and The Bull), and the two new raiders ============
for (const [v, id] of Object.entries(S1_VARIANTS)) {
  DEMO_LEVELS[id] = Object.assign({}, DEMO_LEVELS.flats, { id, s1: v, n: 'S1', segs: S1T.bull.segs, other: v === 'road' ? 's1hybrid' : 's1road',
    name: v === 'road' ? 'DUST FLATS · ROAD' : 'DUST FLATS · HYBRID', idea: 'GUNS CRACK · RAM THE CRACKED ONES' });
  ENC[id] = ENC.flats;
}
GANG.s1flank = Object.assign({}, GANG.polecat, { name: 'Flanker', art: 'polecat', vault: false, chase: 0, speed: GANG.polecat.speed * S1T.enemy.flank.speedK, col: '#36c8d8' });
GANG.s1shield = Object.assign({}, GANG.ram, { name: 'Shield truck', art: 'ram', col: '#4f8fe8' });
CREW.s1flank = []; CREW.s1shield = CREW.ram; DRIVER.s1flank = DRIVER.polecat; DRIVER.s1shield = DRIVER.ram;
GANG_ART.s1flank = GANG_ART.polecat; GANG_ART.s1shield = GANG_ART.ram;

// ============ a run ============
function s1NewState(v) {
  return { variant: v, chain: { n: 0, t: -99 }, leaks: [], flyers: [], lastHit: null, clr: null, ended: false, flashT: 0, waveIx: -1, spawnCD: 1.5, seen: {}, glanceT: -9, deflectT: -9,
    bot: { stuck: 0, esc: 0, dir: 1, lazy: false, lazyT: 0, dodge: 0, ddir: 1 },
    m: { variant: v, seed: null, bot: S1_BOT, speed: S1_SPEED, outcome: 'running', deathCause: null, runSeconds: 0, bullAtSecs: null, peakOnScreen: 0, onScreenNow: 0,
      secsAt12Plus: 0, onScreenTimeline: [],   // visible enemies (centre inside the 390x844 view), every 5 s: [run second, count]
      // fuel actually gained (what the tank took, capped by its size), by cause; ram share = ram-side / (ram-side + gun-side)
      fuelFromRams: 0, fuelFromRamCrashes: 0, fuelFromTakedowns: 0, fuelFromBossRams: 0, fuelFromGuns: 0, fuelFromGunCrashes: 0, fuelWonBack: 0, fuelOther: 0, fuelEarned: 0, ramSharePct: null,
      takedowns: 0, takedownsPerMin: 0, maxChain: 0, wrecks: { ram: 0, ramCrash: 0, takedown: 0, gun: 0, gunCrash: 0, ambient: 0 }, hitsTaken: 0, offscreenHits: 0, offscreenDeaths: 0,
      timeToRetrySecs: null, clearings: [], tuningOverrides: S1T.overrides || {}, done: false } };
}
function s1Begin() {   // after demoStart: the fixed loadout instead of the opening card, the steady drain, the card
  const b = demo.build, items = Object.assign({}, S1T.loadout);
  b.offer = null; $('pick').hidden = true; $('pickReroll').hidden = true; state = 'play';
  b.items = items; b.order = Object.keys(items); b.choices = DRAFT_MAX; for (const id of b.order) eqFitted(id);
  demoStage.drain = S1T.fuel.drain; heat.lv = 1;
  S1.m.seed = demo.seed; renderUps(); updateHUD(); showStageCard(stageIx);
  $('scNum').textContent = `SPRINT 1 · ${S1.variant === 'road' ? 'ROAD' : 'HYBRID'} VARIANT`; $('scIdea').textContent = 'GUNS CRACK · RAM THE CRACKED ONES';
  s1Publish();
}
function s1End(won) {   // once a run: the outcome and the final numbers
  if (!S1 || S1.ended) return; S1.ended = true; const m = S1.m;
  m.outcome = won ? 'clear' : 'death'; m.runSeconds = Math.round(time * 10) / 10;
  if (!won) {
    const H = S1.lastHit, fatalHit = H && time - H.t < 0.05 && runState && runState.lastLossSource !== 'drain';
    m.deathCause = fatalHit ? `hit (${H.source}${H.by ? ' · ' + H.by : ''})` : `out of fuel (drain${H ? `, last hit ${(time - H.t).toFixed(1)} s before by ${H.by || H.source}` : ''})`;
    if (fatalHit && H.visible === false) m.offscreenDeaths = 1;
    m.diedEarly = time < S1T.targets.earlyDeathSecs;
    S1_LAST = { deathAt: performance.now(), m, level: demo.level };
  } else S1_LAST = null;
  m.done = true; s1Publish(); window.S1_HISTORY.push(m);
}
function s1Publish() {   // window.S1_METRICS: the live numbers (rounded)
  const m = S1.m, r1 = v => Math.round(v * 10) / 10;
  if (!m.done) m.runSeconds = r1(time);
  const ram = m.fuelFromRams + m.fuelFromRamCrashes + m.fuelFromTakedowns + m.fuelFromBossRams, all = ram + m.fuelFromGuns + m.fuelFromGunCrashes;
  m.ramSharePct = all > 0 ? Math.round(ram / all * 100) : null;
  m.takedownsPerMin = time > 1 ? Math.round(m.takedowns / (time / 60) * 100) / 100 : 0;
  for (const k of ['fuelFromRams', 'fuelFromRamCrashes', 'fuelFromTakedowns', 'fuelFromBossRams', 'fuelFromGuns', 'fuelFromGunCrashes', 'fuelWonBack', 'fuelOther', 'fuelEarned', 'secsAt12Plus']) m[k] = r1(m[k]);
  m.fuelNow = player ? r1(player.hp) : null;
  window.S1_METRICS = m;
}

// ============ the layout: the road, (hybrid) its clearings, The Bull's clearing ============
function s1Build() {
  const v = S1.variant, R = demo.rLayout, rr = (a, b) => a + R() * (b - a), len = S1T.road.len[v], C = S1T.clearings;
  const L = { lv: demo.level, v: 0, s1: v, len, y0: 300, rocks: [], walls: [], drums: [], sands: [], crates: [], beats: [], cache: null, arena: null, clearings: [] };
  L.road = { x0: 0, y0: 300, x1: 0, y1: 300 - len, amp: rr(S1T.road.amp[0], S1T.road.amp[1]), wl: rr(S1T.road.wl[0], S1T.road.wl[1]), ph: R() * TAU, first: true };
  const at = p => { const y = 300 - len * p; return [roadAt(L.road, y), y]; };
  if (v === 'hybrid') for (let i = 0; i < C.count; i++) { const [x, y] = at(C.at[i]); L.clearings.push({ i, p: C.at[i], x, y, R: C.R, state: 'open', bars: [], t: 0, left: 0, spawnCD: 0 }); }
  const inClear = (x, y, m) => L.clearings.some(Q => Math.hypot(x - Q.x, y - Q.y) < Q.R + m);
  const clear = (x, y, r) => !L.rocks.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 90);
  // the flats: mesas along both sides at a distance, never on the road, never in a clearing
  for (let d = 500, s = 1; d < len * 0.95; d += rr(650, 1050), s = -s) { const [rx, y] = at(d / len), x = rx + s * rr(ROAD_W + 260, 760), r = rr(34, 60); if (!inClear(x, y, 200) && clear(x, y, r)) L.rocks.push({ x, y, r }); }
  // outcrops right beside the road now and then: something to shove a raider into on the move
  for (let d = 2500; d < len * 0.93; d += rr(2300, 3400)) { const [rx, y] = at(d / len), side = R() < 0.5 ? -1 : 1, x = rx + side * rr(ROAD_W + 90, ROAD_W + 150), r = rr(36, 46); if (!inClear(x, y, 160) && clear(x, y, r - 60)) L.rocks.push({ x, y, r }); }
  for (let i = 0; i < len / 1000; i++) { const p = rr(0.02, 0.95), [rx, y] = at(p), x = rx + (R() < 0.5 ? -1 : 1) * rr(ROAD_W + 300, 1400); if (!inClear(x, y, 150)) L.sands.push({ x, y, r: rr(90, 150) }); }
  // the clearings: a rim of rock round each, open where the road comes in and goes out (the barricades fill those gaps
  // while it's locked), and rocks inside to ram raiders into, off the road's line
  for (const Q of L.clearings) {
    const yi = Q.y + Q.R, yo = Q.y - Q.R, ain = Math.atan2(yi - Q.y, roadAt(L.road, yi) - Q.x), aout = Math.atan2(yo - Q.y, roadAt(L.road, yo) - Q.x);
    const Rb = Q.R + 62, n = Math.ceil(TAU * Rb / 100), gh = Math.asin(C.gap / Rb);
    for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Q.x + Math.cos(a) * Rb, y = Q.y + Math.sin(a) * Rb;
      if (Math.abs(angDiff(a, ain)) < gh || Math.abs(angDiff(a, aout)) < gh) Q.bars.push({ x, y, r: 64, s1bar: true, ph: R() * TAU });
      else L.rocks.push({ x, y, r: 70, rim: true }); }
    for (const sd of [-1, 1]) for (let d = Rb + 105; d < Rb + C.wing; d += 105) L.rocks.push({ x: Q.x + sd * d, y: Q.y + rr(-12, 12), r: 70, rim: true });   // rock walls out to both sides: the way on is through it, not round it
    const rot = R() * TAU; for (let j = 0; j < C.rocks; j++) { const a = rot + j * TAU / C.rocks, d = rr(250, 430); let x = Q.x + Math.cos(a) * d, y = Q.y + Math.sin(a) * d; const rx = roadAt(L.road, y); if (Math.abs(x - rx) < 150) x = rx + (x < rx ? -1 : 1) * 150; L.rocks.push({ x, y, r: rr(44, 56), anchor: true }); }
  }
  // The Bull's clearing: a walled bowl at the road's end, its gate on the road (as Dust Flats has it)
  const Ar = ENC.flats.arenaR, gy = 300 - len, A = L.arena = { x: 0, y: gy - Ar - 40, R: Ar, gateY: gy, sealed: false, gate: [], anchors: [] };
  const Rb = Ar + 40, n = Math.ceil(TAU * Rb / 105), gapHalf = Math.asin(190 / Rb);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; if (Math.abs(angDiff(a, Math.PI / 2)) < gapHalf) continue; L.rocks.push({ x: A.x + Math.cos(a) * Rb, y: A.y + Math.sin(a) * Rb, r: 70, rim: true }); }
  for (const a of [Math.PI / 2 - gapHalf * 0.66, Math.PI / 2, Math.PI / 2 + gapHalf * 0.66]) A.gate.push({ x: A.x + Math.cos(a) * Rb, y: A.y + Math.sin(a) * Rb, r: 70, rim: true });
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3, q = { x: A.x + Math.cos(a) * 300, y: A.y + Math.sin(a) * 300, r: 52, anchor: true }; L.rocks.push(q); A.anchors.push(q); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55, d = Ar - 90; L.crates.push({ x: A.x + Math.cos(a) * d, y: A.y + Math.sin(a) * d, r: 21 }); }
  for (const q of L.rocks) q.lay = true;
  return L;
}

// ============ the tick (instead of the demo's beats) ============
function s1Tick(dt) {
  const L = demo.layout, A = L.arena, p = encProgress();
  s1Flyers(dt);
  for (const k of cars) if (!k.dead && !k.flee && k.evTag >= 1000 && k.s1clr === undefined && Math.hypot(k.x - player.x, k.y - player.y) > 2600 && !inView(k.x, k.y, 200)) k.flee = true;   // lost for good (the road's raiders are normally brought back ahead first: s1Recycle)
  if (!A.sealed) { const below = player.y > A.gateY + 120 && Math.abs(player.x - A.x) > 140; depot.x = A.x; depot.y = below ? A.gateY + 160 : A.y; }   // the road's goal: line up under the gate, then into the bowl
  const m = S1.m; m.onScreenNow = S1.vis = s1Visible(); m.peakOnScreen = Math.max(m.peakOnScreen, m.onScreenNow);
  if (m.onScreenNow >= 12) m.secsAt12Plus += dt;
  if (time >= (S1.tlT ?? 0)) { S1.tlT = Math.floor(time / 5) * 5 + 5; m.onScreenTimeline.push([Math.round(time), m.onScreenNow]); }
  S1.flashT = Math.max(0, S1.flashT - dt);
  // a cracked raider wobbles while it's staggered; a flanker jinks out of your nose's way
  const F = S1T.enemy.flank, pv = Math.hypot(player.vx, player.vy);
  for (const k of cars) {
    if (k.dead) continue;
    if (k.s1crackT > time && k.stun > 0) k.a += Math.sin(time * 34 + k.ph * 9) * 2.2 * dt;
    if (s1Cracked(k) && time >= (k.s1smokeT || 0) && inView(k.x, k.y, 80)) {   // cracked shows on the car: it smokes and throws sparks
      k.s1smokeT = time + 0.08;
      parts.push({ k: 'puff', dark: true, x: k.x + crand(-10, 10), y: k.y + crand(-10, 10), vx: k.vx * 0.3 + crand(-30, 30), vy: k.vy * 0.3 + crand(-60, -20), t: 0, life: crand(0.5, 0.8), size: crand(8, 13) });
      if (grand() < 0.6) parts.push({ k: 'spark', x: k.x + crand(-14, 14), y: k.y + crand(-14, 14), vx: crand(-200, 200), vy: crand(-200, 200), t: 0, life: 0.22 });
    }
    if (k.s1flank && !(k.s1crackT > time) && (k.s1dodgeT || 0) < time && pv > 160) {
      const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy), off = angDiff(player.a, Math.atan2(dy, dx));
      if (d < F.dodgeR && Math.abs(off) < 0.5) { const s = off > 0 ? 1 : -1, nx = -Math.sin(player.a) * s, ny = Math.cos(player.a) * s; k.vx += nx * F.dodgeKick; k.vy += ny * F.dodgeKick; k.s1dodgeT = time + F.dodgeCD; }
    }
  }
  if ((S1.pubT = (S1.pubT || 0) - dt) <= 0) { S1.pubT = 0.25; s1Publish(); }
  if (stageBoss) { if (m.bullAtSecs === null) m.bullAtSecs = Math.round(time * 10) / 10; return; }
  s1IdleThreat(dt);
  if (S1.clr) { s1ClearingTick(dt); return; }
  const Q = L.clearings.find(Q => Q.state === 'open' && Math.hypot(player.x - Q.x, player.y - Q.y) < Q.R - S1T.clearings.lockDepth);
  if (Q) { s1Lock(Q); return; }
  for (const P of L.clearings) if (P.state === 'open' && player.y < P.y - P.R - 300) { P.state = 'done'; S1.m.clearings.push({ i: P.i + 1, skipped: true }); }   // got past one without locking it (shouldn't happen: logged so it shows)
  s1Director(dt, p);
}
const s1Pick = mix => { const ks = Object.keys(mix), tot = ks.reduce((a, k) => a + mix[k], 0); let r = grand() * tot; for (const k of ks) { r -= mix[k]; if (r <= 0) return k; } return ks[0]; };
// enemies you can see: alive, not running off, centre inside the view (390x844 on a phone)
const s1Visible = () => cars.filter(k => !k.dead && !k.flee && !k.stageBoss && inView(k.x, k.y, 0)).length;

// when the player stops steering: nearby raiders stop flanking and come in for a hit, so sitting still gets you wrecked
function s1IdleThreat(dt) {
  const raw = !!(typeof touches !== 'undefined' && touches && touches.size) || !!(keys && (keys.ArrowLeft || keys.ArrowRight || keys.KeyA || keys.KeyD || keys.a || keys.d));
  const bot = !!(typeof S1_BOT !== 'undefined' && S1_BOT);
  if (raw || bot) {
    S1.idleT = 0; S1.idle = false;
    if (S1._gunSave !== undefined) { up.gun = S1._gunSave; delete S1._gunSave; }
    return;
  }
  S1.idleT = (S1.idleT || 0) + dt;
  S1.idle = S1.idleT >= 0.6;
  if (S1.idle) {
    if (S1._gunSave === undefined) S1._gunSave = up.gun; up.gun = 0;   // mute auto-turret so idle isn't self-refueling
  } else if (S1._gunSave !== undefined) { up.gun = S1._gunSave; delete S1._gunSave; }
  if (!S1.idle || state !== 'play') return;
  // open the attack gate and shove the nearest flankers into a tell/wind
  if (typeof nextAttackT !== 'undefined') nextAttackT = Math.min(nextAttackT, time);
  let attackers = cars.filter(c => !c.dead && (c.mode === 'tell' || c.mode === 'swipe' || c.mode === 'wind' || c.mode === 'lunge' || c.mode === 'ram')).length;
  const maxA = Math.max(heat.lv <= 1 ? 1 : heat.lv <= 3 ? 2 : 3, 2);
  const near = cars.filter(k => !k.dead && !k.flee && !k.stageBoss && !k.T.keep && !k.guard && (k.mode === 'flank' || k.mode === 'hold' || k.mode === 'peel' || k.mode === 'recover' || !k.mode) && Math.hypot(k.x - player.x, k.y - player.y) < 460)
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  const pv = Math.hypot(player.vx, player.vy), fa = pv > 40 ? Math.atan2(player.vy, player.vx) : player.a, fx = Math.cos(fa), fy = Math.sin(fa);
  for (const k of near) {
    if (attackers >= maxA) break;
    if (time < (k.s1forceAt || 0)) continue;
    k.s1forceAt = time + 0.45; k.wait = 0; k.readyT = 99; k.modeT = 0; k.pincer = false;
    const lon = (k.x - player.x) * fx + (k.y - player.y) * fy;
    if (k.T.light) {
      const a = Math.atan2(player.y - k.y, player.x - k.x); k.vx += Math.cos(a) * 280; k.vy += Math.sin(a) * 280; k.a = a;
      continue;
    }
    if (lon < -50 || k.rear) { k.mode = 'wind'; k.aimA = Math.atan2(player.y - k.y, player.x - k.x); }
    else { k.mode = 'tell'; }
    attackers++;
  }
  // proximity sap: nearby raiders steadily leak the idle tank (~3–5 /s on top of drain) so death lands near 20 s
  if (state === 'play' && player.hp > 0) {
    const n = cars.filter(k => !k.dead && !k.flee && !k.stageBoss && Math.hypot(k.x - player.x, k.y - player.y) < 340).length;
    if (n > 0) {
      const rate = 2.8 + Math.min(5, n) * 0.55;   // ~3.3–5.5 fuel/s; plus the normal 1/s drain ≈ 20 s from full
      const took = -changeFuel(-rate * dt, 'impact');
      if (took > 0) { S1.m.hitsTaken += 0; player.ghostT = Math.max(player.ghostT || 0, 0.15); }
      if (player.hp <= 0) { player.hp = 0; outCause = 'WRECKED!'; if (runState) runState.lastLossSource = 'impact'; gameOver(false); }
    }
  }
}
function s1Director(dt, p) {   // the road: keep the current wave's count of raiders IN VIEW, spawning just off the top and sides so they come on screen
  const W = S1T.spawn.waves; let wi = 0; for (let i = 0; i < W.length; i++) if (time >= W[i].t) wi = i;
  const w = W[wi]; heat.lv = time > 5 ? Math.max(w.heat, S1T.enemy.minHeat ?? 2) : w.heat;   // after the opening seconds at least minHeat attack at once: idle play gets punished
  if (wi !== S1.waveIx) { if (S1.waveIx >= 0) banner = { text: `WAVE ${wi + 1}`, short: true, t: 0 }; S1.waveIx = wi; }
  s1Recycle(dt, p);
  S1.spawnCD -= dt; if (S1.spawnCD > 0) return;
  const active = cars.filter(k => !k.dead && !k.flee && !k.stageBoss).length;
  const cap = s1PeakCap(), want = Math.min(w.n, cap);
  if (S1.vis >= cap || S1.vis + incoming.length * 0.5 >= want || active + incoming.length >= S1T.spawn.cap) return;   // (a raider about to land counts half: it isn't in view yet)
  const type = s1Pick(w.mix), from = p > 0.975 ? pick(['L', 'R', 'behind']) : type === 's1flank' ? pick(['L', 'R']) : s1Pick(S1T.spawn.from);   // (by the Bull's gate: nothing from ahead, inside its bowl)
  const pt = encSpawnPoint(from); if (!pt) return;
  const n = type === 'scrap' ? Math.min(Math.floor(want - S1.vis - incoming.length), S1T.spawn.bikePack[0] + Math.floor(grand() * (S1T.spawn.bikePack[1] - S1T.spawn.bikePack[0] + 1))) : 1;   // a bike pack never takes the view past the cap
  for (let i = 0; i < Math.max(1, n); i++) incoming.push({ x: pt[0] + (i ? rand(-50, 50) : 0), y: pt[1] + (i ? rand(-50, 50) : 0), type, t: S1T.spawn.warn + i * 0.05, ahead: from !== 'behind', evTag: 1000 });
  S1.spawnCD = S1T.spawn.gap;
}
function s1Recycle(dt, p) {   // a road raider left behind out of sight comes round again: put back just off the top or a side, still hurt or cracked
  const hh = VH / 2 / view.z, v = Math.hypot(player.vx, player.vy), fx = v > 60 ? player.vx / v : Math.cos(player.a), fy = v > 60 ? player.vy / v : Math.sin(player.a);
  S1.recycleCD = (S1.recycleCD || 0) - dt;
  for (const k of cars) {
    if (k.dead || k.flee || k.stageBoss || k.s1clr !== undefined || !(k.evTag >= 1000)) continue;
    if (inView(k.x, k.y, 60)) { k.s1outT = 0; continue; }
    k.s1outT = (k.s1outT || 0) + dt;
    if (k.s1outT < S1T.spawn.recycleSecs || S1.recycleCD > 0 || S1.vis >= s1PeakCap() || (k.x - player.x) * fx + (k.y - player.y) * fy > -hh * 0.5) continue;
    const pt = encSpawnPoint(p > 0.975 ? pick(['L', 'R']) : pick(['ahead', 'ahead', 'L', 'R'])); if (!pt) continue;
    const a = Math.atan2(player.y - pt[1], player.x - pt[0]); Object.assign(k, { x: pt[0], y: pt[1], a, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, pL: null, pR: null, mode: 'flank', modeT: 0, s1outT: 0 });
    S1.recycleCD = 0.12; S1.m.recycled = (S1.m.recycled || 0) + 1;
  }
}
// ============ hybrid: a locked clearing ============
function s1Lock(Q) {
  Q.state = 'locked'; Q.t = 0; S1.clr = Q; const Wv = S1T.clearings.waves[Math.min(Q.i, S1T.clearings.waves.length - 1)]; Q.spawnCD = 0.4; Q.t0 = time;
  for (const k of cars) { if (k.dead || k.flee) continue; if (Math.hypot(k.x - Q.x, k.y - Q.y) < Q.R) { k.s1clr = Q.i; k.evTag = 1500 + Q.i; } else k.flee = true; }   // who's in with you is part of the fight; the rest are shut out
  incoming = [];
  depot.tanks = Q.bars; rebuildLists();   // the barricades: solid while it's locked
  for (const b of Q.bars) for (let i = 0; i < 4; i++) parts.push({ k: 'dust', x: b.x + crand(-40, 40), y: b.y + crand(-40, 40), vx: crand(-80, 80), vy: crand(-80, 80), t: 0, life: crand(0.6, 1.1), size: crand(16, 26) });
  SFX.clang(); SFX.horn(); shake = Math.max(shake, 6 * (calmMotion ? 0.3 : 1));
  banner = { text: 'LOCKED IN!', sub: 'WRECK THE WAVE TO OPEN THE ROAD', t: 0 };
}
function s1ClearingTick(dt) {
  const Q = S1.clr, Wv = S1T.clearings.waves[Math.min(Q.i, S1T.clearings.waves.length - 1)]; Q.t += dt; heat.lv = Math.max(Wv.heat, S1T.enemy.minHeat ?? 2);
  const C = S1T.clearings, alive = cars.filter(k => !k.dead && !k.flee && k.s1clr === Q.i), inc = incoming.filter(I => I.s1clr === Q.i).length, mine = alive.length + inc;
  const seen = alive.filter(k => inView(k.x, k.y, 0)).length;   // the quota is what you can SEE (centre inside the view); off-screen and landing ones don't fill it
  Q.spawnCD -= dt;
  const spawning = Q.t < Math.max(Wv.spawnSecs, C.minSecs - 4);   // (keeps coming at least until shortly before minSecs, so the floor isn't an empty wait)
  const atOnce = Math.min(Wv.atOnce, s1PeakCap()), aliveCap = Math.floor(atOnce * C.aliveK);   // (the hard view cap wins over the wave's quota)
  if (spawning && Q.spawnCD <= 0 && seen < atOnce && mine < aliveCap) {   // ...with a ceiling on everything alive or landing
    const type = s1Pick(Wv.mix), n = type === 'scrap' ? Math.max(1, Math.min(3, atOnce - seen, s1PeakCap() - seen, aliveCap - mine)) : 1, pt = s1ClearingPoint(Q);   // a bike batch never overshoots either cap
    if (pt) for (let i = 0; i < n; i++) incoming.push({ x: pt[0] + (i ? rand(-40, 40) : 0), y: pt[1] + (i ? rand(-40, 40) : 0), type, t: 0.8 + i * 0.05, ahead: true, fixed: true, evTag: 1500 + Q.i, s1clr: Q.i });
    Q.spawnCD = Wv.gap;
  }
  Q.left = mine; Q.hold = spawning ? Math.max(0, Wv.spawnSecs - Q.t) : 0;
  if ((Q.t >= C.minSecs && !spawning && mine === 0) || Q.t >= C.maxSecs) s1Unlock(Q, !spawning && mine === 0);   // never opens before minSecs; always by maxSecs
}
function s1ClearingPoint(Q) {   // inside the clearing, 300-650 from you, out of sight if it can be
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 30; i++) {
    const a = grand() * TAU, d = Q.R * (0.1 + grand() * 0.78), x = Q.x + Math.cos(a) * d, y = Q.y + Math.sin(a) * d;
    const dp = Math.hypot(x - player.x, y - player.y); if (blocked(x, y, 34) || dp < 300 || dp > 650) continue;   // close by, so they're on you (and on screen) in a moment
    if (pass === 0 && inView(x, y, 30)) continue;
    return [x, y];
  }
  return null;
}
function s1Unlock(Q, cleared) {
  Q.state = 'done'; S1.clr = null; depot.tanks = []; rebuildLists();
  for (const k of cars) if (k.s1clr === Q.i && !k.dead) k.flee = true;
  for (const b of Q.bars) { for (let i = 0; i < 6; i++) { const a = crand(0, TAU), sp = crand(150, 380); parts.push({ k: 'debris', x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: crand(0, TAU), spin: crand(-14, 14), t: 0, life: crand(0.8, 1.4), size: crand(6, 11), col: cpick(['#a5532e', '#5c626a', '#7a3a22']) }); } parts.push({ k: 'flash', x: b.x, y: b.y, t: 0, life: 0.1, R: 70 }); }
  SFX.crate(); SFX.level();
  banner = { text: cleared ? 'ROAD OPEN!' : 'THEY SCATTER · ROAD OPEN', short: true, t: 0 };
  S1.m.clearings.push({ i: Q.i + 1, startSecs: Math.round(Q.t0 * 10) / 10, secs: Math.round(Q.t * 10) / 10, cleared });
}

// ============ fuel: wrecks refill instantly, takedowns burst, a hit can be won back ============
const S1_BUCKET = { ram: 'fuelFromRams', ramCrash: 'fuelFromRamCrashes', takedown: 'fuelFromTakedowns', bossram: 'fuelFromBossRams', gun: 'fuelFromGuns', gunCrash: 'fuelFromGunCrashes', won: 'fuelWonBack' };
function s1Refill(x, y, n, bucket) {   // the fuel goes in now (the metrics count what the tank really took); blobs fly from the wreck to the car to show it
  if (n <= 0) return 0;
  if (S1.idle) return 0;   // stopped steering: no free top-ups from the auto-turret or pile-ups
  const got = changeFuel(n, 's1_' + bucket); player.ghost = Math.max(player.ghost, player.hp);
  const m = S1.m; m[S1_BUCKET[bucket] || 'fuelOther'] += got; m.fuelEarned += n;
  const blobs = Math.min(14, 2 + Math.round(n / 3));
  for (let i = 0; i < blobs; i++) { const a = crand(0, TAU), sp = crand(120, 260); S1.flyers.push({ x: x + crand(-10, 10), y: y + crand(-10, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: -i * 0.02, gold: bucket === 'won' || bucket === 'takedown' }); }
  $('hp').classList.remove('gain'); void $('hp').offsetWidth; $('hp').classList.add('gain');
  return got;
}
function s1Flyers(dt) {   // they spray out, then home onto the car
  const T = S1T.fuel.flyerSecs;
  for (const f of S1.flyers) { f.t += dt; if (f.t < 0) continue; const k = clamp(f.t / T, 0, 1), dx = player.x - f.x, dy = player.y - f.y, d = Math.hypot(dx, dy) || 1, s = 300 + 1600 * k;
    f.vx += (dx / d * s - f.vx) * ease(4 + 16 * k, dt); f.vy += (dy / d * s - f.vy) * ease(4 + 16 * k, dt); f.x += f.vx * dt; f.y += f.vy * dt; if (d < 16 || f.t > T * 1.6) f.dead = true; }
  S1.flyers = S1.flyers.filter(f => !f.dead);
  S1.leaks = S1.leaks.filter(l => !l.used && time - l.t <= S1T.fuel.winBackSecs);
}
// A wreck you caused, by how it happened: takedown (a ram on a cracked raider) · ram (your car's own hit: nose, side, tail,
// nitro) · gun (a round) · ramCrash / gunCrash (into rock, a wall, a drum or another raider, started by your ram or your gun).
const S1_DIRECT = { ram: 1, ability: 1, weapon: 1 };
function s1WreckKind(k, src, word, cause) {
  if (k.s1td) return 'takedown';
  if (S1_GUN_SRC[src]) return 'gun';
  const how = (cause && cause.kind) || WORD_KIND[word] || 'ram';
  if (S1_DIRECT[how]) return how === 'weapon' ? 'gun' : 'ram';
  return k.cause && k.cause.kind === 'weapon' ? 'gunCrash' : 'ramCrash';
}
function s1OnWreck(k, src, word, cause, credited = true) {   // the refill: takedown burst, ram (or ram-started crash) 3x, gun (or gun-started crash) 1x; a wreck nobody caused ('ambient') refills like a gun-started crash
  const F = S1T.fuel, K = F.typeK[k.type] ?? 1, m = S1.m; let kind = credited || k.s1td ? s1WreckKind(k, src, word, cause) : 'ambient', n;
  if (k.s1td) {
    const C = S1T.chain; S1.chain.n = time - S1.chain.t <= C.window ? S1.chain.n + 1 : 1; S1.chain.t = time; m.maxChain = Math.max(m.maxChain, S1.chain.n);
    const mult = Math.min(C.max, 1 + C.step * (S1.chain.n - 1)); n = F.takedownBurst * K * mult; m.takedowns++;
    s1Crunch(k, S1.chain.n, mult);
  } else n = F.gunWreck * K * (kind === 'gun' || kind === 'gunCrash' || kind === 'ambient' ? 1 : F.ramMult) * (kind === 'ramCrash' || kind === 'gunCrash' || kind === 'ambient' ? F.crashK : 1);
  m.wrecks[kind]++;
  s1Refill(k.x, k.y, n, kind);
  if (n >= 0.95) pops.push({ x: k.x, y: k.y - 58, text: `+${Math.round(n)}`, col: kind === 'takedown' ? '#ffd23f' : '#5be37d', t: 0, small: kind === 'gun' || kind === 'gunCrash' ? 2 : 1 });
  const back = kind === 'ambient' ? [] : S1.leaks.filter(l => !l.used && time - l.t <= F.winBackSecs); if (back.length) {   // (won back only by a wreck you caused)   // the leak you just took, won back
    let sum = 0; for (const l of back) { l.used = true; sum += l.n; } sum *= F.winBackFrac;
    if (sum >= 0.5) { s1Refill(k.x, k.y, sum, 'won'); pops.push({ x: player.x, y: player.y - 92, text: `WON BACK +${Math.round(sum)}!`, col: '#ffd23f', t: 0 }); parts.push({ k: 'ring', x: player.x, y: player.y, t: 0, life: 0.4, R: 120 }); SFX.coin(); }
  }
}
function s1Crunch(k, n, mult) {   // a takedown lands: shake, a white flash, a hit-pause, the word, the chain
  shake = Math.max(shake, 10 * (calmMotion ? 0.3 : 1)); freeze = Math.max(freeze, 0.07); S1.flashT = 0.16;
  parts.push({ k: 'flash', x: k.x, y: k.y, t: 0, life: 0.12, R: 130 }); parts.push({ k: 'ring', x: k.x, y: k.y, t: 0, life: 0.35, R: 150 });
  for (let i = 0; i < 14; i++) { const a = crand(0, TAU), sp = crand(250, 520); parts.push({ k: 'spark', x: k.x, y: k.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.3 }); }
  parts.push({ k: 'burst', x: k.x, y: k.y - 90, t: 0, life: 0.75, word: n > 1 ? `CHAIN x${n}!` : 'TAKEDOWN!', big: n > 1 ? 1 + Math.min(0.5, (mult - 1) * 0.4) : 0.95, rot: crand(-0.2, 0.2) });
  SFX.takedown(); SFX.clang();
}

// ============ crack then ram ============
const s1Cracked = k => k.s1crackT > time;
function s1Crack(k) {   // a gun hit: cracked (renewed every hit) and staggered (at most once per staggerCD)
  const C = S1T.crack, fresh = !s1Cracked(k); k.s1crackT = time + C.secs;
  if (fresh || time > (k.s1stagT || 0)) { k.stun = Math.max(k.stun, C.stagger); k.s1stagT = time + C.staggerCD; for (let i = 0; i < 5; i++) parts.push({ k: 'spark', x: k.x + crand(-12, 12), y: k.y + crand(-12, 12), vx: crand(-220, 220), vy: crand(-220, 220), t: 0, life: 0.25 }); }
  if (fresh && !S1.seen.crack) { S1.seen.crack = true; pops.push({ x: k.x, y: k.y - 64, text: 'CRACKED! RAM IT!', col: '#ffd23f', t: 0, small: 1 }); }
}
function s1Takedown(k) {   // a ram on a cracked raider: wrecked outright, a takedown
  k.s1td = true; blame(k); markPlayerCause(k, 'ram'); if (runState) runState.totals.rams++; recordRunEvent('ram_hit', { car: k.type, takedown: true });
  wreck(k, 'TAKEDOWN!', 'trick', true, { kind: 'ram', playerCaused: true, at: time });
}

// ============ the wrappers (each hands straight back outside a variant run) ============
const s1Wrap = (name, fn) => { const keep = window[name]; window[name] = function () { return fn.call(this, keep, arguments); }; };
s1Wrap('encBuild', (keep, a) => s1On() ? s1Build() : keep.apply(null, a));
s1Wrap('encTick', (keep, a) => s1On() ? s1Tick(a[0]) : keep.apply(null, a));
s1Wrap('demoStart', (keep, a) => {
  const L = DEMO_LEVELS[a[0]];
  if (S1_LAST && S1_LAST.level === a[0] && S1_LAST.m.timeToRetrySecs === null) S1_LAST.m.timeToRetrySecs = Math.round((performance.now() - S1_LAST.deathAt) / 100) / 10;   // a retry: the same variant again, timed from the fatal moment (real seconds); switching variants isn't one
  S1_LAST = null; S1 = L && L.s1 ? s1NewState(L.s1) : null; s1AutoPause();
  const r = keep.apply(null, a);
  if (S1) s1Begin();
  return r;
});
s1Wrap('landCar', (keep, a) => {
  const r = keep.apply(null, a); if (!s1On()) return r;
  const I = a[0], k = cars[cars.length - 1]; if (!k || k.stageBoss || k.T.elite || k.T.convoy) return r;
  const pips = S1T.enemy.pips[k.type]; if (pips) k.hp = k.maxHp = pips * PIP;
  if (I.s1clr !== undefined) k.s1clr = I.s1clr;
  if (k.type === 's1shield') { k.s1shield = true; if (!S1.seen.shield) { S1.seen.shield = true; pops.push({ x: player.x, y: player.y - 100, text: 'SHIELD TRUCK · ONLY RAMS HURT IT', col: '#7fb6ff', t: 0, small: 1 }); } }
  if (k.type === 's1flank') { const F = S1T.enemy.flank; k.s1flank = true; k.slot = 'FLANK'; k.slotLon = rand(-40, 60); k.slotLat = rand(F.slotLat[0], F.slotLat[1]); k.side = grand() < 0.5 ? -1 : 1; k.rear = k.front = false; if (!S1.seen.flank) { S1.seen.flank = true; pops.push({ x: player.x, y: player.y - 100, text: 'FLANKERS · LET THE TURRET WORK', col: '#7fe8f0', t: 0, small: 1 }); } }
  return r;
});
s1Wrap('wreck', (keep, a) => {
  const k = a[0]; if (!s1On() || !k || k.dead) return keep.apply(null, a);
  const c0 = runState ? runState.totals.credited : 0, playing = state === 'play'; S1.inWreck = true;
  try { keep.apply(null, a); } finally { S1.inWreck = false; }
  if (playing && k.dead && !k.s1refilled) {
    const credited = !!(runState && runState.totals.credited > c0);
    // idle: only YOUR wrecks refill (ambient pile-ups were keeping an idle tank topped up past 60s)
    if (!credited && S1.idle) { k.s1refilled = true; }
    else { k.s1refilled = true; s1OnWreck(k, a[2] || 'trick', a[1], a[4], credited); }
  }   // EVERY wreck refills when you're playing; credit picks the kind
});
s1Wrap('dropGem', (keep, a) => {   // no pickups in a variant run: a can becomes an instant refill, coins and gems don't drop
  if (!s1On()) return keep.apply(null, a);
  const [x, y, v] = a; if (v < 0 && !S1.inWreck && state === 'play') s1Refill(x, y, -v, 'other');
});
s1Wrap('hitRaider', (keep, a) => {
  const [k] = a; if (!s1On() || !k || k.dead || k.stageBoss) return keep.apply(null, a);
  if (k.s1shield) {   // rams are the only way through: each one dents it (the shield stays up for good)
    k.s1ramT = time; k.stun = Math.max(k.stun, 0.5); SFX.clang();
    for (let i = 0; i < 8; i++) parts.push({ k: 'spark', x: k.x + crand(-20, 20), y: k.y + crand(-20, 20), vx: crand(-300, 300), vy: crand(-300, 300), t: 0, life: 0.3 });
    return keep.apply(null, a);
  }
  if (s1Cracked(k)) { s1Takedown(k); return; }
  if (k.s1flank) {   // too quick to pin: the ram glances off (crack it first)
    k.vx += (k.x - player.x) * 2; k.vy += (k.y - player.y) * 2;
    if (time - S1.glanceT > 0.8) { S1.glanceT = time; pops.push({ x: k.x, y: k.y - 50, text: 'GLANCED OFF', col: '#7fe8f0', t: 0, small: 1 }); }
    return;
  }
  return keep.apply(null, a);
});
s1Wrap('eqHitCar', (keep, a) => {
  const [k, n, src] = a; if (!s1On() || !k || k.dead || k.stageBoss || !S1_GUN_SRC[src]) return keep.apply(null, a);
  if (k.s1shield) {   // rounds bounce off the shield
    k.s1deflT = time; parts.push({ k: 'spark', x: a[4] ?? k.x, y: a[5] ?? k.y, vx: crand(-260, 260), vy: crand(-260, 260), t: 0, life: 0.2 });
    if (time - S1.deflectT > 1.2) { S1.deflectT = time; pops.push({ x: k.x, y: k.y - 56, text: 'DEFLECTED · RAM IT', col: '#7fb6ff', t: 0, small: 1 }); }
    return;
  }
  s1Crack(k);
  return keep.call(null, k, n * S1T.crack.gunDmgK, src, a[3], a[4], a[5]);
});
s1Wrap('hurt', (keep, a) => {   // a landed hit: who did it (passed in by the caller) and whether it was in view, kept before the original runs, since it may end the run
  if (!s1On()) return keep.apply(null, a);
  const [, soft, source, by] = a, hp0 = player.hp, prev = S1.lastHit;
  if (!soft) {
    a[0] *= S1T.enemy.hitK ?? 2;   // Sprint 1: raider hits bite from the first second (no soft start; earlyHit is ignored)
    if (S1.idle) { a[0] *= 2.0; if (player.inv > 0.08) player.inv = 0.08; if (player.contactInv > 0.08) player.contactInv = 0.08; }   // idle: harder hits, short i-frames
  }
  if (!soft) S1.lastHit = { t: time, source: source || 'impact', by: by ? by.name || (by.T && by.T.name) || (by.kind === 'bull' || by === boss ? 'The Bull' : by.type) : null, visible: by ? inView(by.x, by.y, -6) : null };
  const took = keep.apply(null, a);
  if (!soft) { if (player.hp < hp0) { S1.leaks.push({ t: time, n: hp0 - player.hp, used: false }); S1.m.hitsTaken++; if (S1.lastHit.visible === false) S1.m.offscreenHits++; else if (S1.lastHit.visible === null) S1.m.unattributedHits = (S1.m.unattributedHits || 0) + 1; } else S1.lastHit = prev; }
  return took;
});

s1Wrap('carHit', (keep, a) => {   // two raiders meeting hard: in a crowd this would wreck pairs outright all day, so here it dents (pileupPips) instead
  if (!s1On()) return keep.apply(null, a);
  const [p, q, h] = a;
  if (p.T.light && q.T.light && !playerCause(p) && !playerCause(q)) { bump(p, q, h); return; }
  const closing = -((p.vx - q.vx) * h.nx + (p.vy - q.vy) * h.ny), weak = p.slideT > 0 || q.slideT > 0 ? 30 : p.frag > 0 || q.frag > 0 || p.mode === 'lunge' || q.mode === 'lunge' ? 60 : 130;
  if (closing > weak) {
    const yours = playerCause(p) || playerCause(q) || attackMissed(p) || attackMissed(q);
    if (yours) { carryCause(p, q); carryCause(q, p); blame(p); blame(q); }
    for (const k of [p, q]) if (k.hitCD <= 0) { k.hitCD = 0.5; k.stun = Math.max(k.stun, 0.6); damage(k, yours ? PIP * S1T.enemy.pileupPips : k.maxHp * 0.25, 'trick', yours ? 'PILE-UP!' : undefined, undefined, undefined, !yours, yours ? resolveWreckCause(k, 'raider', undefined, true) : undefined); }
  }
  if (!p.dead && !q.dead) bump(p, q, h);
});
s1Wrap('burnFuel', (keep, a) => {   // one steady drain, all run (road, clearings, The Bull's arena)
  if (!s1On()) return keep.apply(null, a);
  const dt = a[0];
  if (state !== 'play' || runHeld() || god || (runState && runState.outcome !== 'active')) return;
  changeFuel(-S1T.fuel.drain * dt, 'drain');
  if (player.hp < player.maxHp * 0.25) { fuelLowT -= dt; if (fuelLowT <= 0) { fuelLowT = 1.2; SFX.ping(); } tip('lowfuel', 'LOW FUEL · WRECK RAIDERS TO REFILL'); }
  if (player.hp <= 0) { player.hp = 0; outCause = 'OUT OF FUEL!'; if (runState) runState.lastLossSource = 'drain'; gameOver(); }
});
s1Wrap('tip', (keep, a) => {   // the campaign's lesson about cans doesn't hold here
  if (s1On() && a[0] === 'fuel') return keep.call(null, 's1fuel', 'WRECKS REFILL YOU · GUNS CRACK · RAM THE CRACKED ONES', ...Array.prototype.slice.call(a, 2));
  return keep.apply(null, a);
});
s1Wrap('bossHit', (keep, a) => {   // a tank ram on The Bull refills too
  const took = keep.apply(null, a), h = a[0];
  if (s1On() && took > 0 && h && (h.src === 'tank' || h.src === 'fork')) { s1Refill(player.x, player.y - 20, S1T.bull.ramRefill, 'bossram'); }
  return took;
});
s1Wrap('demoResults', (keep, a) => {
  const r = keep.apply(null, a); if (!s1On()) return r;
  s1End(!!a[0]); const m = S1.m, f = v => Math.round(v);
  const rows = [['Variant', `${m.variant.toUpperCase()} · ${m.outcome === 'clear' ? 'CLEAR' : 'DEATH'}`], ['Bull at · peak', `${m.bullAtSecs === null ? '—' : fmt(m.bullAtSecs)} · ${m.peakOnScreen} seen · ${Math.round(m.secsAt12Plus)}s 12+`],
    ['Fuel ram/gun/TD', `${f(m.fuelFromRams + m.fuelFromRamCrashes + m.fuelFromBossRams)} / ${f(m.fuelFromGuns + m.fuelFromGunCrashes)} / ${f(m.fuelFromTakedowns)}`], ['Ram share', `${m.ramSharePct === null ? '—' : m.ramSharePct + '%'} · won back ${f(m.fuelWonBack)}`],
    ['Takedowns', `${m.takedowns} · ${m.takedownsPerMin}/min · x${m.maxChain}`]];
  if (m.outcome === 'death') rows.push(['Death', `${m.deathCause}${m.offscreenDeaths ? ' · OFF SCREEN' : ''}`]);
  if (m.clearings.length) rows.push(['Clearings', m.clearings.map(c => `${Math.round(c.secs)}s`).join(' · ')]);
  $('dStats').innerHTML += rows.map(([x, y]) => `<span>${x}</span><span>${y}</span>`).join('');
  $('dLine').textContent = 'Sprint 1 test build · full numbers in window.S1_METRICS';
  return r;
});
s1Wrap('drawDemoWorld', (keep, a) => { const r = keep.apply(null, a); if (s1On()) s1DrawGround(); return r; });
s1Wrap('render', (keep, a) => { const r = keep.apply(null, a); if (s1On() && (state === 'play' || state === 'over' || state === 'cleared')) s1DrawOver(); return r; });
s1Wrap('renderDemoMenu', (keep, a) => {   // the variants stay off the demo's menu (reached only by URL)
  const r = keep.apply(null, a); for (const b of document.querySelectorAll('#dLevels .dlevel')) if (DEMO_LEVELS[b.dataset.level] && DEMO_LEVELS[b.dataset.level].s1) b.remove(); return r;
});

// ============ drawing (placeholder art) ============
function s1DrawGround() {   // on the ground layer: each clearing's floor and edge, its way in, and its barricades while it's locked
  const L = demo.layout;
  for (const Q of L.clearings) {
    if (!inView(Q.x, Q.y, Q.R + 150)) continue;
    const Rb = Q.R + 62;
    ctx.save(); const g = ctx.createRadialGradient(Q.x, Q.y, 80, Q.x, Q.y, Q.R + 30); g.addColorStop(0, 'rgba(120,70,40,.28)'); g.addColorStop(1, 'rgba(120,70,40,.08)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Q.x, Q.y, Q.R + 30, 0, TAU); ctx.fill();
    const locked = Q.state === 'locked';   // the edge: a bold ring just inside the rock (hazard red while it's shut)
    ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(Q.x, Q.y, Q.R - 4, 0, TAU); ctx.stroke();
    ctx.lineWidth = 8; ctx.setLineDash([34, 22]); ctx.lineDashOffset = locked ? -clock * 60 : 0; ctx.strokeStyle = locked ? (Math.floor(clock * 4) % 2 ? '#e8432f' : '#ffd23f') : Q.state === 'done' ? 'rgba(255,244,220,.5)' : '#ff9a3c'; ctx.beginPath(); ctx.arc(Q.x, Q.y, Q.R - 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (Q.state === 'open') { ctx.font = `46px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = INK; const ty = Q.y + Q.R - 140; ctx.strokeText('LOCKED CLEARING', Q.x, ty); ctx.fillStyle = '#ff9a3c'; ctx.fillText('LOCKED CLEARING', Q.x, ty); }
    if (locked) for (const b of Q.bars) {   // a heap of wrecks: two crushed car bodies, a tyre, hazard stripes
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ph); ctx.scale(1.3, 1.3);
      inkRR(ctx, -48, -24, 70, 34, 6, '#7a3a22', { lw: 2.6 }); ctx.rotate(0.7); inkRR(ctx, -20, -10, 66, 30, 6, '#5c626a', { lw: 2.6 }); inkCircle(ctx, -30, 22, 13, '#24160f', { lw: 2, double: false });
      ctx.rotate(-0.7); for (let i = 0; i < 4; i++) { ctx.fillStyle = (i + Math.floor(clock * 3)) % 2 ? '#ffd23f' : '#e8432f'; ctx.fillRect(-40 + i * 16, -8, 16, 12); } ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(-40, -8, 64, 12);
      ctx.restore();
    }
    ctx.restore();
  }
}
function s1DrawOver() {   // over the world: you (a neon glow), cracked raiders, shield badges, flankers' chevrons, fuel in flight; then the screen cues
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.translate(view.ax, view.ay); ctx.scale(view.z, view.z); ctx.translate(-cam.x, -cam.y);
  if (player && !player.dead) {   // YOU: a pulsing lime glow and a thick lime outline round your footprint (no raider is this colour)
    const s = player.size || 1, pulse = 1 + Math.sin(clock * 5) * 0.06, rx = 44 * s * pulse, ry = 30 * s * pulse;
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.a);
    ctx.globalAlpha = 0.22 + Math.sin(clock * 5) * 0.06; ctx.fillStyle = S1_YOU; ctx.beginPath(); ctx.ellipse(0, 0, rx + 14, ry + 14, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = S1_YOU; ctx.stroke();
    ctx.restore();
  }
  for (const k of cars) {
    if (k.dead || !inView(k.x, k.y, 60)) continue;
    const R = k.r * (k.size || 1) * 1.55 + 6;
    if (s1Cracked(k)) {   // CRACKED: smoke and sparks off the car (s1Tick), small crack lines on the body, and RAM! over it
      ctx.save(); ctx.translate(k.x, k.y);
      ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = k.ph * 7 + i * 2.1; ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a + 0.3) * R * 0.35, Math.sin(a + 0.3) * R * 0.35); ctx.lineTo(Math.cos(a - 0.1) * R * 0.55, Math.sin(a - 0.1) * R * 0.55); } ctx.stroke();
      ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText('RAM!', 0, -R - 10); ctx.fillStyle = '#ffd23f'; ctx.fillText('RAM!', 0, -R - 10);
      ctx.restore();
    }
    if (k.s1shield) {   // SHIELD: a small badge above the truck; it flashes white when rounds bounce off, red when rammed
      const hit = time - (k.s1deflT || -9) < 0.12, rammed = time - (k.s1ramT || -9) < 0.25; ctx.save();
      ctx.translate(k.x, k.y - R - 14); ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(11, -10); ctx.lineTo(11, 2); ctx.quadraticCurveTo(11, 10, 0, 14); ctx.quadraticCurveTo(-11, 10, -11, 2); ctx.closePath(); ctx.fillStyle = hit ? '#fff' : rammed ? '#ff8a6a' : '#2f6fd0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    }
    if (k.s1flank) {   // FLANKER: small chevrons on its sides
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.a); ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-10, s * (R - 2)); ctx.lineTo(0, s * (R + 6)); ctx.lineTo(10, s * (R - 2)); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#36c8d8'; ctx.stroke(); }
      ctx.restore();
    }
  }
  for (const f of S1.flyers) { if (f.t < 0) continue; ctx.fillStyle = f.gold ? '#ffd23f' : '#5be37d'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 6.5, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the screen: the takedown flash, the chain, a leak you can still win back, the clearing's count, the variant tag
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (S1.flashT > 0) { ctx.fillStyle = `rgba(255,250,235,${S1.flashT * 2.2})`; ctx.fillRect(0, 0, VW, VH); }
  ctx.textAlign = 'center'; ctx.font = `26px ${FONT}`; ctx.lineJoin = 'round';
  const ink = (txt, x, y, col) => { ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); };
  const C = S1.chain, cl = S1T.chain.window - (time - C.t);
  if (C.n >= 1 && cl > 0 && state === 'play') { const y = 158; ink(C.n > 1 ? `CHAIN x${C.n}` : 'TAKEDOWN · CHAIN IT', VW / 2, y, C.n > 1 ? '#ffd23f' : '#fff4dc'); ctx.fillStyle = INK; ctx.fillRect(VW / 2 - 62, y + 8, 124, 9); ctx.fillStyle = '#ffd23f'; ctx.fillRect(VW / 2 - 60, y + 10, 120 * cl / S1T.chain.window, 5); }
  const lk = S1.leaks.filter(l => !l.used && time - l.t <= S1T.fuel.winBackSecs);
  if (lk.length && state === 'play') { const [sx, sy] = toScreen(player.x, player.y), left = S1T.fuel.winBackSecs - (time - Math.min(...lk.map(l => l.t))), n = Math.round(lk.reduce((s, l) => s + l.n, 0) * S1T.fuel.winBackFrac);
    ctx.font = `19px ${FONT}`; ink(`WRECK ONE · WIN BACK ${n}`, sx, sy + 62, Math.floor(clock * 6) % 2 ? '#ff5a46' : '#fff4dc'); ctx.fillStyle = INK; ctx.fillRect(sx - 42, sy + 68, 84, 7); ctx.fillStyle = '#ff5a46'; ctx.fillRect(sx - 40, sy + 70, 80 * clamp(left / S1T.fuel.winBackSecs, 0, 1), 3); }
  if (S1.clr && state === 'play') { const Q = S1.clr, mine = cars.filter(k => !k.dead && !k.flee && k.s1clr === Q.i).length + incoming.filter(I => I.s1clr === Q.i).length; ctx.font = `20px ${FONT}`; ink(Q.hold > 0 ? `CLEARING ${Q.i + 1} · HOLD ON ${Math.ceil(Q.hold)}s` : `CLEARING ${Q.i + 1} · ${mine} LEFT`, VW / 2, 190, '#ff9a3c'); }
  if (state === 'play') for (const k of cars.filter(k => !k.dead && !k.flee && !k.stageBoss && !inView(k.x, k.y, 0) && Math.hypot(k.x - player.x, k.y - player.y) < 900).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, 5))
    edgeArrow(k.x, k.y, k.s1shield ? '#4f8fe8' : k.s1flank ? '#36c8d8' : s1Cracked(k) ? '#ffd23f' : '#e8432f', ATTACK_MODES.has(k.mode) || k.mode === 'wind' || k.mode === 'tell' ? 1.3 : 0.85);   // threats just off screen: an arrow at the edge, bigger when it's attacking
  ctx.textAlign = 'left'; ctx.font = `13px ${FONT}`; ink(`S1 ${S1.variant.toUpperCase()}${S1_BOT ? ' · BOT' : ''}${S1_SPEED > 1 ? ' x' + S1_SPEED : ''}`, 8, VH - 8, '#fff4dc');
  ctx.restore();
}

// ============ the autopilot (&bot=1): drives the road, rams cracked raiders first, fights The Bull ============
// A bot knows every position; its run is a smoke test and a rough tuning read, not a human's result.
function s1Bot() {
  if (!s1On() || state !== 'play') { keys.ArrowLeft = keys.ArrowRight = false; return; }
  const B = S1.bot, pa = player.a, px = player.x, py = player.y, v = Math.hypot(player.vx, player.vy), L = demo.layout, A = L.arena, dt = 1 / 60;   // called once per update pair (1/60 s)
  B.stuck = v < 80 ? B.stuck + dt : 0; if (B.stuck > 0.5) { B.esc = 0.6; B.dir = grand() < 0.5 ? -1 : 1; B.stuck = 0; }
  B.lazyT -= dt; if (B.lazyT <= 0) { B.lazyT = 1.5; B.lazy = grand() > S1_SKILL; }
  let want, ramming = false;
  if (boss && !boss.dead) want = s1BotBoss();
  else {
    const Q = S1.clr, ty = py - 450;
    const N = !Q && L.clearings.find(P => P.state === 'open' && py > P.y && py - P.y < P.R + 1600);   // a clearing coming up: make for its way in (the road's mouth), not the raiders
    if (Q) { const a = Math.atan2(py - Q.y, px - Q.x) + 0.6; want = Math.atan2(Q.y + Math.sin(a) * Q.R * 0.45 - py, Q.x + Math.cos(a) * Q.R * 0.45 - px); }
    else if (N) { const yi = N.y + N.R + 120, gx = py > yi + 40 ? roadAt(L.road, yi) : N.x, gy = py > yi + 40 ? yi : N.y; want = Math.atan2(gy - py, gx - px); }
    else if (py < A.gateY + 500 || A.sealed) want = Math.atan2(A.y - py, A.x - px);
    else want = Math.atan2(ty - py, roadAt(L.road, ty) - px);
    const goal = want;
    if (!B.lazy && !N) {
      const rel = k => { const dx = k.x - px, dy = k.y - py; return { k, d: Math.hypot(dx, dy), a: angDiff(pa, Math.atan2(dy, dx)), lon: dx * Math.cos(pa) + dy * Math.sin(pa), lat: -dx * Math.sin(pa) + dy * Math.cos(pa) }; };
      const near = (k) => Q ? true : Math.abs(k.x - roadAt(L.road, k.y)) < 520 && Math.abs(angDiff(goal, Math.atan2(k.y - py, k.x - px))) < 1.6;
      const foes = cars.filter(k => !k.dead && !k.flee && !k.stageBoss && near(k)).map(rel);
      const tgt = foes.filter(f => s1Cracked(f.k) && f.d < 460 && Math.abs(f.a) < 1.4).sort((p, q) => p.d - q.d)[0]
        || foes.filter(f => f.k.s1shield && f.d < 380 && Math.abs(f.a) < 1.0).sort((p, q) => p.d - q.d)[0]
        || foes.filter(f => !f.k.s1flank && f.d < 300 && Math.abs(f.a) < 0.8).sort((p, q) => p.d - q.d)[0];
      if (tgt) { want = Math.atan2(tgt.k.y + tgt.k.vy * 0.22 - py, tgt.k.x + tgt.k.vx * 0.22 - px); ramming = true; }
      const side = foes.find(f => f.d < 150 && Math.abs(f.lon) < 70 && (f.k.mode === 'tell' || f.k.mode === 'swipe'));
      if (side && !ramming) want = pa + Math.sign(side.lat) * 0.9;
      const lunger = foes.find(f => (f.k.mode === 'wind' || f.k.mode === 'lunge') && f.d < 320 && f.lon < 0);
      if (lunger && lunger.k.mode === 'lunge' && B.dodge <= 0) { B.dodge = 0.45; B.ddir = lunger.lat > 0 ? -1 : 1; }
    }
    if (B.dodge > 0) { B.dodge -= dt; want = pa + B.ddir * 1.2; }
  }
  const probe = o => blocked(px + Math.cos(pa + o) * 120, py + Math.sin(pa + o) * 120, 26);
  if (!ramming && probe(0) && !(boss && bossWeak(boss) && bossWeak(boss).open)) want = pa + (probe(-0.7) && !probe(0.7) ? 1 : -1);
  if (boss && !boss.dead) { const w = DQA_avoid(want, pa); if (w !== null) want = w; }
  let d = angDiff(pa, want); if (B.esc > 0) { B.esc -= dt; d = B.dir; }
  keys.ArrowLeft = d < -0.08; keys.ArrowRight = d > 0.08;
}
function s1BotBoss() {   // The Bull: off its line toward a rock when it winds up or charges, ram the open tank, circle otherwise
  const B = boss, W = bossWeak(B), pa = player.a, px = player.x, py = player.y;
  const toW = W ? Math.atan2(W.y - py, W.x - px) : 0, dW = W ? Math.hypot(W.x - px, W.y - py) : 1e9, toB = Math.atan2(B.y - py, B.x - px), dB = Math.hypot(B.x - px, B.y - py);
  if (W && W.open) { if (nitro >= 1 && dW < 260 && Math.abs(angDiff(pa, toW)) < 0.3) fireNitro(); return toW; }
  if (B.state === 'wind' || B.state === 'charge') {
    const aim = B.state === 'wind' ? (B.aim ?? B.a) : Math.atan2(B.vy, B.vx), side = angDiff(aim, Math.atan2(py - B.y, px - B.x)) > 0 ? 1 : -1; let want = aim + side * Math.PI / 2;
    let bx = null, bd = 420; for (const q of posts) { const dd = Math.hypot(q.x - px, q.y - py); if (dd < bd) { bd = dd; bx = q; } }
    if (bx && B.state === 'wind' && bd > 90) want = Math.atan2(bx.y - py, bx.x - px) + side * 0.6;
    return want;
  }
  return dB > 430 ? toB : toB + Math.PI / 2 * (angDiff(B.a, Math.atan2(py - B.y, px - B.x)) > 0 ? 1 : -1);
}
function DQA_avoid(want, pa) {   // steer round shells about to land (as tools/demo_qa.js does)
  let ax = 0, ay = 0, any = false; const v = Math.hypot(player.vx, player.vy);
  for (const b of bombs) { if (b.t < 0) continue; const left = b.T - b.t; if (left > 1.4) continue; const fx = player.x + player.vx * Math.min(left, 0.8), fy = player.y + player.vy * Math.min(left, 0.8), d = Math.hypot(fx - b.tx, fy - b.ty), r = 78 + player.r; if (d > r + 70) continue; const w = (r + 70 - d) / (r + 70); ax += (fx - b.tx) / (d || 1) * w; ay += (fy - b.ty) / (d || 1) * w; any = true; }
  if (!any) return null;
  const fx = v > 60 ? player.vx / v : Math.cos(pa), fy = v > 60 ? player.vy / v : Math.sin(pa);
  return Math.atan2(fy * 0.5 + ay * 1.6, fx * 0.5 + ax * 1.6);
}

// ============ the entry: ?variant=road | hybrid (called by ui.js once the loop exists) ============
function s1AutoPause() {   // a bot run must not pause itself in a hidden tab; anything else gets the page's own setting back
  if (!S1_NAP) S1_NAP = { v: window.noAutoPause };   // the page's own setting, kept once
  window.noAutoPause = S1 && S1_BOT ? true : S1_NAP.v;
}
function s1Paved(x, y) {   // inside a clearing (or The Bull's) you drive as on the road: same speed, so the same grip and drift
  if (!s1On()) return false; const L = demo.layout;
  return L.clearings.some(Q => Math.hypot(x - Q.x, y - Q.y) < Q.R + 40) || Math.hypot(x - L.arena.x, y - L.arena.y) < L.arena.R + 40;
}
function s1Boot() {
  for (const f of ['demoOpen', 'demoExit']) s1Wrap(f, (keep, a) => { S1 = null; s1AutoPause(); return keep.apply(null, a); });   // leaving a variant run
  s1Wrap('gameOver', (keep, a) => { const r = keep.apply(null, a); if (s1On() && runState && runState.outcome === 'lost') s1End(false); return r; });   // (ui.js defines it, after this file)
  s1Wrap('advanceFrame', (keep, a) => {   // &speed=N: N update pairs a frame (one drawn); &bot=1: the autopilot steers before each pair
    if (!s1On()) return keep.apply(null, a);
    const dt = a[0];
    for (let i = 1; i < S1_SPEED && state === 'play'; i++) {
      if (freeze > 0) { freeze -= dt; continue; }
      const sdt = slowT > 0 ? dt * 0.35 : dt; slowT = Math.max(0, slowT - dt);
      if (S1_BOT) s1Bot(); update(sdt / 2); update(sdt / 2);
    }
    if (S1_BOT) s1Bot();
    const r = keep.apply(null, a); if (S1_BOT) keys.ArrowLeft = keys.ArrowRight = false; return r;
  });
  const v = S1Q.get('variant'); if (!S1_VARIANTS[v]) return;
  demoOpen(); demoStart(S1_VARIANTS[v], S1Q.get('seed') !== null ? +S1Q.get('seed') : undefined);
}
