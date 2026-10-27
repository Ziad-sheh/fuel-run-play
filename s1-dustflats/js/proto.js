'use strict';
// Fuel Run · proto.js: the PROTOTYPE LAB. Short experiments beside the two-stage demo, never mixed into its stages:
//   LAB A (road-linked): two broad fight areas joined by a short connector that splits round a rock island; the
//     narrow west lane holds a fuel cache, the wide east lane carries the road.
//   LAB B (open arena): one open area of about the same usable ground, with the same cache and the same anchors.
//   Both: the same car, fuel rules, fixed loadout (front forks + swivel gun, rank 1, no cards), enemy types, spawn and
//   reward budget and pressure schedule, so the comparison is about the ground, not the build. 100 s, then a result.
//   LAB RAM: A's ground and crowd, front forks only; wreck enough with your nose and the forks evolve into a battering
//     ram (a prototype unlock).
//   LAB STRESS: 1.5x the peak crowd for five minutes, invulnerable, every current effect: for frame timing only.
// Spawn decisions draw from the run's own stream (demo.rProto), apart from moment-to-moment randomness. A run keeps a
// report (proto report below) that the result screen can save.
// Classic scripts sharing one global scope, loaded in order by index.html (after encounters.js).

const PROTO_CAP = 100, PROTO_STRESS_CAP = 300;
// Which build a report came from: a build script stamps window.FR_BUILD (commit, uncommitted game edits, when);
// on the dev server the page reads the working tree's commit (uncommitted edits can't be seen from here).
window.FR_BUILD = window.FR_BUILD || null;
if (!window.FR_BUILD) (async () => { try { const h = (await (await fetch('../.git/HEAD', { cache: 'no-store' })).text()).trim(), ref = h.startsWith('ref: ') ? h.slice(5) : null;
  const rev = ref ? (await (await fetch('../.git/' + ref, { cache: 'no-store' })).text()).trim() : h; if (/^[0-9a-f]{40}$/.test(rev)) window.FR_BUILD = { rev: rev.slice(0, 7), branch: ref ? ref.replace('refs/heads/', '') : '(detached)', dirty: 'unknown (dev server)', source: 'local working tree' }; showBuildId(); } catch (e) {} })();
function showBuildId() {   // "build <rev>" on the demo menu and the results, so testers can see which build they're on; nothing when unstamped
  const B = window.FR_BUILD, rev = B && typeof B.rev === 'string' ? B.rev.trim() : '', txt = rev ? `build ${rev}${B.dirty === true ? ' (edited)' : ''}` : '';
  for (const id of ['dBuildId', 'dOverBuildId']) { const el = $(id); if (el) { el.textContent = txt; el.hidden = !txt; } }
}
const PROTO_LEVELS = {
  protoA:      { lab: 'A', name: 'LAB A · ROAD-LINKED', layout: 'road', other: 'protoB', idea: 'TWO FIGHT AREAS · A SPLIT ROAD BETWEEN' },
  protoB:      { lab: 'B', name: 'LAB B · OPEN ARENA', layout: 'open', other: 'protoA', idea: 'ONE BIG OPEN AREA' },
  protoRam:    { lab: 'RAM', name: 'LAB · RAM EVOLUTION', layout: 'road', other: 'protoA', evolve: true, idea: 'WRECK 40 · YOUR FORKS EVOLVE' },
  protoStress: { lab: 'STRESS', name: 'LAB · STRESS 1.5×', layout: 'open', other: 'protoB', stress: 1.5, idea: 'INVULNERABLE · FRAME TIMING ONLY' },
};
for (const [id, P] of Object.entries(PROTO_LEVELS)) {
  DEMO_LEVELS[id] = Object.assign({ id, proto: true, stage: 0, n: P.lab, segs: 15, boss: null, card: null, bossName: '' }, P);
  ENC[id] = { proto: P.layout, maxActive: 99 };
}
// The pressure: from second s, aim for this many light bikes and raiders on the field (the director fills toward it,
// a pack at a time, within the budget). A short recovery at 58 s. The same for A and B.
const PROTO_SCHED = [[0, 0, 0], [4, 6, 0], [16, 10, 0], [30, 14, 1], [44, 20, 2], [58, 6, 0], [66, 26, 2], [78, 32, 3], [94, 0, 0]];
const PROTO_BUDGET = { light: 220, raider: 7 };   // enough for a competent driver to keep the schedule full, finite for anyone else
const PROTO_RAIDERS = ['buggy', 'ram', 'harpoon', 'buggy', 'polecat', 'ram', 'harpoon'];   // in this order, in both layouts
const PROTO_NITRO = { boosting: 0, bike: 0.2 };   // the lab's nitro refill: nothing while a boost is burning (it refills after; at 1 the boost paid for the next one and ran 60-77 s of 100), and what one scrap bike pays (a raider pays 0.2)
const PROTO_RAM_NEED = 40;   // LAB RAM: wrecks you cause (forks only there, so they all come from your driving) that earn the evolution

// ============ the ground ============
function protoBuild() {
  const P = PROTO_LEVELS[demo.level];
  const L = { lv: demo.level, proto: P.layout, y0: 300, len: 3000, rocks: [], walls: [], drums: [], sands: [], crates: [], beats: [], cache: null, zones: [],
    arena: { x: 0, y: -1e7, R: 1, gateY: -1e7, sealed: false, gate: [], anchors: [] }, start: { x: 0, y: 180 } };
  const ring = (cx, cy, R, gaps) => { const Rb = R + 62, n = Math.ceil(TAU * Rb / 100); for (let i = 0; i < n; i++) { const a = i / n * TAU, x = cx + Math.cos(a) * Rb, y = cy + Math.sin(a) * Rb; if (gaps.some(g => g(x, y))) continue; L.rocks.push({ x, y, r: 70, rim: true }); } };
  const anchors = (cx, cy, d, rot, n) => { for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; L.rocks.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 50, anchor: true }); } };
  if (P.layout === 'road') {   // two fight areas (radius 760), a 1100-long connector between them, split by an island
    const S1 = { x: 0, y: -330, R: 760 }, S2 = { x: 0, y: -2950, R: 760 }, C = { x0: -330, x1: 350, y0: S1.y - S1.R + 40, y1: S2.y + S2.R - 40, isl: [-110, 50] };
    L.zones = [{ k: 'disc', x: S1.x, y: S1.y, R: S1.R }, { k: 'disc', x: S2.x, y: S2.y, R: S2.R }, { k: 'box', x0: C.x0, x1: C.x1, y0: C.y1, y1: C.y0 }];
    const inC = (x, y) => x > C.x0 - 40 && x < C.x1 + 40 && y < C.y0 + 120 && y > C.y1 - 120;   // where the rings open onto the connector
    ring(S1.x, S1.y, S1.R, [inC]); ring(S2.x, S2.y, S2.R, [inC]);
    for (let y = C.y0 + 60; y > C.y1 - 60; y -= 90) for (const x of [C.x0 - 62, C.x1 + 62]) L.rocks.push({ x, y, r: 70, rim: true });   // the connector's walls
    for (let y = C.y0 - 170; y > C.y1 + 170; y -= 80) L.rocks.push({ x: (C.isl[0] + C.isl[1]) / 2, y, r: (C.isl[1] - C.isl[0]) / 2 + 6, island: true });   // the island: the route splits, then rejoins
    anchors(S1.x, S1.y, 380, 0.4, 3); anchors(S2.x, S2.y, 380, 1.2, 3);
    L.cache = { x: (C.x0 + C.isl[0]) / 2, y: (C.y0 + C.y1) / 2, r: 40, taken: false, side: -1 };   // the narrow lane's prize
    L.road = { x0: 200, y0: 300, x1: 200, y1: S2.y - S2.R - 200, amp: 0, wl: 1000, ph: 0, first: true };   // the road takes the wide lane
    L.goal = { x: S2.x, y: S2.y };
  } else {   // one open area of about the same usable ground (pi x 1160^2 ~ 2 x pi x 760^2 + the connector's lanes)
    const B = { x: 0, y: -860, R: 1160 };
    L.zones = [{ k: 'disc', x: B.x, y: B.y, R: B.R }];
    ring(B.x, B.y, B.R, []);
    anchors(B.x, B.y, 620, 0.2, 6);
    L.cache = { x: -500, y: -1650, r: 40, taken: false, side: -1 };   // as far from the start as A's
    L.road = null; L.goal = null;
  }
  for (const q of L.rocks) q.lay = true;
  return L;
}
const protoInside = (L, x, y, m = 0) => L.zones.some(Z => Z.k === 'disc' ? Math.hypot(x - Z.x, y - Z.y) < Z.R - m : x > Z.x0 + m && x < Z.x1 - m && y > Z.y0 + m && y < Z.y1 - m);
function protoDepot(L) {   // the demo's "depot" (trip bar, road painting): a lab has no arena and no boss
  demo.enc = { i: 0, st: 'wait', t: 0, q: [], tag: 2000, credit0: 0, spawned: 0, per: {} };
  depot = { x: 0, y: -1e7, open: true, bossDone: true, msgT: 0, len: 3000, tanks: [], sections: [], ravines: [], signs: [], road: L.road, boss: null };
}

// ============ a run ============
function protoBegin() {   // called by demoStart instead of the opening draft: the fixed loadout, the start, the report
  const id = demo.level, P = PROTO_LEVELS[id], b = demo.build, L = demo.layout;
  const items = P.stress ? { forks: 3, gun: 3, cannon: 3, flame: 3 } : P.evolve ? { forks: 1 } : { forks: 1, gun: 1 };   // RAM: forks only, so ramming is how you fight (it is not part of the A/B comparison)
  b.items = Object.assign({}, items); b.order = Object.keys(items); b.choices = DRAFT_MAX; b.offer = null; b.opening = false; b.evolved = P.stress ? { forks: 'ram' } : {};
  for (const id2 of b.order) eqFitted(id2);
  player.x = L.start.x; player.y = L.start.y; player.a = -Math.PI / 2; player.vx = 0; player.vy = -120; cam.x = player.x; cam.y = player.y; ensureChunks(true); rebuildLists();
  god = !!P.stress; state = 'play'; $('pick').hidden = true; renderUps(); updateHUD(); hintT = 0;
  demo.rProto = seeded(demo.seed ^ 0x9A0B1C2D);
  demo.proto = { id, t: 0, cap: P.stress ? PROTO_STRESS_CAP : PROTO_CAP, k: P.stress || 1, left: P.stress ? { light: 1e9, raider: 1e9 } : Object.assign({}, PROTO_BUDGET), spawned: {}, packs: 0, relaxed: 0, skipped: 0, rIdx: 0, spawnCD: 0, rCD: 0,
    nitroOn: 0, stall: { trail: [], ep: null, secs: { bodies: 0, terrain: 0, open: 0 }, done: [], list: [] }, ramKills: 0, evolvedAt: null, peak: { light: 0, raider: 0 }, cacheAt: null, ended: false, mem0: protoMem(), inS2: null, routeLane: null };
  protoPerfReset();
  pops.push({ x: player.x, y: player.y - 80, text: `${P.name} · ${P.stress ? 'STRESS' : 'SURVIVE ' + PROTO_CAP + ' s'}`, col: '#ffd23f', t: 0 });
}
const protoProgress = () => demo && demo.proto ? clamp(demo.proto.t / demo.proto.cap, 0, 1) : 0;
function protoTarget(t) { let row = PROTO_SCHED[0]; for (const r of PROTO_SCHED) if (t >= r[0]) row = r; return row; }
function protoTick(dt) {
  const P = demo.proto, L = demo.layout; if (!P || P.ended || state !== 'play') return;
  P.t += dt; if (nitroT > 0) P.nitroOn += dt;
  // the cache: drive into it for fuel and salvage, once a run (as on the demo's roads)
  const K = L.cache; if (K && !K.taken && Math.hypot(player.x - K.x, player.y - K.y) < K.r + player.r) { K.taken = true; P.cacheAt = Math.round(P.t * 10) / 10; const got = changeFuel(ENC_CACHE.fuel, 'cache'); draftSalvage(ENC_CACHE.salvage); SFX.can(); pops.push({ x: player.x, y: player.y - 60, text: `CACHE! +${Math.round(got)} FUEL`, col: '#5be37d', t: 0 }); }
  if (L.goal && P.inS2 === null && Math.hypot(player.x - L.goal.x, player.y - L.goal.y) < 760) P.inS2 = Math.round(P.t * 10) / 10;
  if (L.proto === 'road' && P.routeLane === null && player.y < -1500 && player.y > -1800) P.routeLane = player.x < -110 ? 'narrow (cache)' : player.x > 50 ? 'wide (road)' : 'island';
  protoStall(P, dt);
  // the director: fill toward the schedule's target, a pack at a time, from the run's own stream
  const [, tl0, tr0] = P.k > 1 ? [0, P.t > 4 ? 32 : 0, P.t > 4 ? 3 : 0] : protoTarget(P.t), tl = Math.round(tl0 * P.k), tr = Math.round(tr0 * P.k);
  const live = cars.filter(k => !k.dead && !k.flee), nl = live.filter(k => k.T.light).length + incoming.filter(I => GANG[I.type].light).length, nr = live.filter(k => !k.T.light).length + incoming.filter(I => !GANG[I.type].light).length;
  P.peak.light = Math.max(P.peak.light, nl); P.peak.raider = Math.max(P.peak.raider, nr);
  P.spawnCD -= dt; P.rCD -= dt;
  if (P.spawnCD <= 0 && nl < tl && P.left.light > 0) {
    const R = demo.rProto, n = Math.min(tl - nl, P.left.light, P.k > 1 ? 10 : 3 + Math.floor(R() * 4)), pt = protoSpawnPoint(R);   // (stress: bigger packs, quicker, so the density holds against a full loadout)
    if (pt) { let made = 0; for (let i = 0; i < n * 3 && made < n; i++) { const a = R() * TAU, d = 18 + R() * 46, x = pt[0] + Math.cos(a) * d, y = pt[1] + Math.sin(a) * d; if (!protoInside(L, x, y, 40) || blocked(x, y, 16) || Math.hypot(x - player.x, y - player.y) < 420) continue; incoming.push({ x, y, type: 'scrap', t: 0.05 + made * 0.02, ahead: true, fixed: true, evTag: 2000 }); made++; }
      P.left.light -= made; P.spawned.scrap = (P.spawned.scrap || 0) + made; if (made) P.packs++; }
    else P.skipped++;
    P.spawnCD = P.k > 1 ? 0.2 : 0.9;
  }
  if (P.rCD <= 0 && nr < tr && P.left.raider > 0) {   // (spawns land almost at once where they were placed, off screen: no delay to drive onto them)
    const R = demo.rProto, pt = protoSpawnPoint(R), type = PROTO_RAIDERS[P.rIdx % PROTO_RAIDERS.length];
    if (pt) { incoming.push({ x: pt[0], y: pt[1], type, t: 0.05, ahead: true, fixed: true, evTag: 2000 }); P.left.raider--; P.rIdx++; P.spawned[type] = (P.spawned[type] || 0) + 1; } else P.skipped++;
    P.rCD = P.k > 1 ? 0.8 : 2.5;
  }
  if (demo.L.evolve && !P.evolvedAt) { P.ramKills = runState.totals.credited; if (P.ramKills >= PROTO_RAM_NEED && draftCalm()) protoOfferRam(); }
  if (P.t >= P.cap) protoEnd();
}
// Stalls, by what the car actually did: under 30 units of movement over the last 0.6 s of play (after the first 2 s).
// Each stalled moment is classed by what holds it: 'bodies' (two or more cars touching), 'terrain' (touching rock, with
// at most one car), or 'open' (nothing in the way: circling on the spot, braking, no input). Only the first two count as
// stalled time; 'open' is reported apart. An episode ends once the car has moved 60 in the window again; its length is
// the recovery time.
function protoStall(P, dt) {
  const S = P.stall; S.trail.push([P.t, player.x, player.y]); while (S.trail.length && P.t - S.trail[0][0] > 0.6) S.trail.shift();
  const [, x0, y0] = S.trail[0], moved = Math.hypot(player.x - x0, player.y - y0), hull = carHull(player);   // the body rock and cars actually meet (three circles nose to tail), not the centre circle
  const touching = cars.filter(k => !k.dead && hull.some(b => Math.hypot(k.x - b.x, k.y - b.y) < k.r + b.r + 6)).length, rock = hull.some(b => blocked(b.x, b.y, b.r + 4));
  const cls = touching >= 2 ? 'bodies' : rock ? 'terrain' : 'open';
  if (S.ep) { S.secs[cls] += dt; S.ep.len += dt; if (moved > 60) { S.done.push(S.ep.len); if (S.list.length < 30) S.list.push({ t: Math.round(S.ep.t * 10) / 10, cls: S.ep.cls, recover: Math.round(S.ep.len * 10) / 10, x: Math.round(S.ep.x), y: Math.round(S.ep.y) }); S.ep = null; } }
  else if (P.t > 2 && S.trail.length > 10 && P.t - S.trail[0][0] > 0.55 && moved < 30) { S.ep = { t: P.t, cls, len: 0, x: player.x, y: player.y }; S.secs[cls] += dt; }
}
function protoBikeBurst(k) {   // bike wrecks say nothing one by one; three or more within 0.6 s of each other show one count that grows (x3 BIKES, x4 ...)
  const P = demo.proto, B = P.burst && time - P.burst.t < 0.6 && time >= P.burst.t ? P.burst : (P.burst = { n: 0, t: time, x: k.x, y: k.y, pop: null });
  B.n++; B.t = time; B.x += (k.x - B.x) / B.n; B.y += (k.y - B.y) / B.n; if (B.n < 3) return;
  if (!B.pop || !pops.includes(B.pop)) pops.push(B.pop = { x: B.x, y: B.y - 40, text: '', col: '#ffd23f', t: 0, small: 2 });
  const y = Math.hypot(B.x - player.x, B.y - player.y) < 120 ? Math.min(B.y, player.y) - 110 : B.y - 40;   // never on your car or over the fuel you just lost
  B.pop.text = `x${B.n} BIKES`; B.pop.x = B.x; B.pop.y = y; B.pop.t = Math.min(B.pop.t, 0.25);
}
function protoSpawnPoint(R) {   // a clear spot inside the play area, 520-760 from you, out of sight if it can be (never closer than 450)
  const L = demo.layout;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 18; i++) {
    const a = R() * TAU, d = 520 + R() * 240, x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
    if (!protoInside(L, x, y, 60) || blocked(x, y, 30)) continue;
    if (pass === 0 && inView(x, y, 40)) continue;
    if (pass === 1) demo.proto.relaxed++;
    return [x, y];
  }
  return null;
}
function protoEnd() {   // the time is up and you're still running: the experiment's result
  const P = demo.proto; if (P.ended) return;
  lockRunWin(); state = 'cleared'; touches.clear(); keys.ArrowLeft = keys.ArrowRight = false; SFX.level(); music('stinger', 'victory');
  demoResults(true);
}
// LAB RAM: enough wrecks with your nose and the forks evolve (a prototype unlock, not the planned rank-5 + support rule)
function protoOfferRam() {
  state = 'pick'; touches.clear(); for (const k in keys) keys[k] = false;
  $('pickTitle').textContent = 'EVOLUTION!'; $('pickLoad').innerHTML = ''; $('pickReroll').hidden = true;
  $('cards').innerHTML = `<button class="card new" data-k="evo"><div class="ic">${eqIcon('forks')}</div><div><h3>BATTERING RAM<em>EVOLUTION</em></h3><p><i class="trig">PROTOTYPE UNLOCK · ${PROTO_RAM_NEED} WRECKS</i>Your front forks become a battering ram. Hit something hard with your nose and a shockwave goes forward: it wrecks scrap bikes and knocks raiders back.</p></div></button>`;
  $('pick').hidden = false;
}
function protoTakeRam() {
  const P = demo.proto, b = demo.build; b.evolved = Object.assign({}, b.evolved, { forks: 'ram' }); P.evolvedAt = Math.round(P.t * 10) / 10;
  eqFitted('forks'); $('pick').hidden = true; $('pickTitle').textContent = 'LEVEL UP!'; state = 'play'; touches.clear(); for (const k in keys) keys[k] = false;
  demo.graceT = 0.8; player.inv = Math.max(player.inv, 0.8); renderUps();
  pops.push({ x: player.x, y: player.y - 70, text: 'BATTERING RAM!', col: '#ffd23f', t: 0 }); SFX.level();
}

// ============ the report ============
function protoMem() { const m = performance && performance.memory; return m ? Math.round(m.usedJSHeapSize / 1048576 * 10) / 10 : null; }
let protoPerf = null, protoUpd = 0;
function protoPerfReset() { protoPerf = { last: 0, iv: [], cpu: [], upd: [] }; window.protoFrame = protoFrameSample; }
function protoFrameSample(now, cpuMs) {   // every real frame of a lab run: the interval since the last, and the time spent updating and drawing
  const F = protoPerf; if (!F || !demo || !demo.proto || state !== 'play') { if (F) F.last = 0; return; }
  if (F.last) { F.iv.push(now - F.last); F.cpu.push(cpuMs); F.upd.push(protoUpd); if (F.iv.length > 30000) { F.iv.splice(0, 10000); F.cpu.splice(0, 10000); F.upd.splice(0, 10000); } }
  F.last = now;
}
const protoQ = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 100) / 100; };
function protoReport(won) {
  const P = demo.proto, T = runState ? runState.totals : { gain: {}, loss: {} }, ev = runState ? runState.events : [], F = protoPerf || { iv: [], cpu: [], upd: [] }, r1 = v => Math.round(v * 10) / 10;
  const kills = {}, ambient = {}, byCause = {}; for (const [key, n] of Object.entries(T.wreckTally || {})) { const [who, car, kind] = key.split(':'), o = who === 'yours' ? kills : ambient; o[car] = (o[car] || 0) + n; if (who === 'yours') byCause[kind] = (byCause[kind] || 0) + n; }
  const harness = !!window.noAutoPause, med = protoQ(F.iv, 0.5);
  return {
    build: window.FR_BUILD || 'unknown', configuration: P.id, policy: P.policy || 'player input', layout: demo.layout.proto, name: demo.L.name, seed: demo.seed, car: player.car, loadout: Object.assign({}, demo.build.items), evolved: Object.assign({}, demo.build.evolved || {}),
    viewport: `${VW}x${VH}`, dpr: DPR, runtime: window.Capacitor ? `capacitor-${window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : '?'}` : 'browser', userAgent: navigator.userAgent,
    conditions: harness ? 'test harness (muted, no auto-pause): simulation results, not real-time measurements' : 'normal runtime page',
    outcome: won ? 'survived' : (outCause || 'lost'), activePlay: r1(P.t), cap: P.cap,
    spawned: P.spawned, budgetLeft: P.left, packs: P.packs, peakOnField: P.peak, spawnRelaxed: P.relaxed, spawnSkipped: P.skipped,
    kills, ambientWrecks: ambient, damageBySource: Object.fromEntries(Object.entries(dmgBy || {}).map(([k, v]) => [k, Math.round(v)])),
    fuel: { gain: Object.fromEntries(Object.entries(T.gain).map(([k, v]) => [k, r1(v)])), loss: Object.fromEntries(Object.entries(T.loss).map(([k, v]) => [k, r1(v)])), end: r1(player.hp) },
    weaponActivations: Object.assign({}, demo.eq.act), ramHits: T.rams || 0, ramWaves: demo.eq.ramWaves || 0, ramWavesBoosted: demo.eq.ramWavesBoosted || 0, ramChances: demo.eq.ramChances || 0, ramWaveHits: demo.eq.ramWaveHits || 0,
    nitro: { fired: T.nitroFired || 0, activeSeconds: r1(P.nitroOn), gainBySource: Object.fromEntries(Object.entries(T.nitroGain || {}).map(([k, v]) => [k, Math.round(v * 100) / 100])), gainWhileBoosting: Math.round((T.nitroGainBoosting || 0) * 100) / 100, tuning: { ...PROTO_NITRO } },
    wrecksByCause: byCause, unlockWrecks: P.ramKills, evolvedAt: P.evolvedAt,
    cache: P.cacheAt, reachedSecondArea: P.inS2, routeLane: P.routeLane,
    stuck: { definition: 'a stall: under 30 units moved in the last 0.6 s of play (after 2 s), measured from position, not speed; bodies = two or more cars touching the car body, terrain = body against rock with at most one car, open = slow with nothing in the way (circling on the spot, braking, no input); seconds = bodies + terrain (held in place by something); recovery = time until the car has moved 60 in 0.6 s again', seconds: r1(P.stall.secs.bodies + P.stall.secs.terrain), slowInOpen: r1(P.stall.secs.open), bySeconds: Object.fromEntries(Object.entries(P.stall.secs).map(([k, v]) => [k, r1(v)])), episodes: P.stall.done.length + (P.stall.ep ? 1 : 0), longestRecovery: r1(Math.max(0, ...P.stall.done, P.stall.ep ? P.stall.ep.len : 0)), openAtEnd: !!P.stall.ep, list: P.stall.list },
    frames: F.iv.length ? { samples: F.iv.length, intervalMs: { p50: med, p95: protoQ(F.iv, 0.95), p99: protoQ(F.iv, 0.99) }, over33ms: F.iv.filter(v => v > 33.3).length, refreshHzEstimate: med ? Math.round(1000 / med) : null,
      cpuMs: { p50: protoQ(F.cpu, 0.5), p95: protoQ(F.cpu, 0.95), p99: protoQ(F.cpu, 0.99) }, updateMs: { p50: protoQ(F.upd, 0.5), p99: protoQ(F.upd, 0.99) }, note: 'cpu = update + draw calls in the page; GPU raster time is not included' }
      : 'unavailable (no real frames: simulated run)',
    memoryMB: { start: P.mem0, end: protoMem(), note: P.mem0 === null ? 'unavailable in this browser' : 'JS heap (Chrome only)' },
  };
}
function protoResults(won) {
  banner = null; $('hud').hidden = true; const P = demo.proto; P.ended = true; const R = window.protoLastReport = protoReport(won);
  $('dOverTitle').textContent = won ? 'SURVIVED!' : outCause || 'WRECKED!'; $('dOverTitle').style.color = won ? '#5be37d' : '#e8432f';
  const k = R.kills, raid = Object.entries(k).filter(([t]) => t !== 'scrap').reduce((n, [, v]) => n + v, 0), rs = Object.entries(P.spawned).filter(([t]) => t !== 'scrap').reduce((n, [, v]) => n + v, 0);
  const rows = [['Experiment', demo.L.name], ['Time', fmt(P.t)], ['Scrap bikes wrecked', `${k.scrap || 0} / ${P.spawned.scrap || 0}`], ['Raiders wrecked', `${raid} / ${rs}`], ['Fuel left', `${Math.floor(fuelLeft() * 100)}%`], ['Stalled', `${R.stuck.seconds} s (${R.stuck.bySeconds.terrain} rock, ${R.stuck.bySeconds.bodies} pinned)`]];
  if (demo.L.evolve) rows.push(['Ram', P.evolvedAt ? `evolved at ${fmt(P.evolvedAt)}` : `${P.ramKills} / ${PROTO_RAM_NEED} wrecks`]);
  $('dStats').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  $('dLine').textContent = 'A lab experiment, not a level. Try the other layout and compare how the driving felt.';
  $('dOther').textContent = `${DEMO_LEVELS[demo.L.other].name} ▶`; $('dReport').hidden = false; showBuildId(); $('demoOver').hidden = false;
}
function protoSaveReport() {   // a JSON file of the last lab run (and the clipboard, where downloads don't work)
  const R = window.protoLastReport; if (!R) return; const txt = JSON.stringify(R, null, 2);
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `fuelrun-lab-${R.configuration}-${R.seed}.json`; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
  try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {}
  console.log('[lab report]', txt);
}
$('dReport').addEventListener('click', protoSaveReport);

// ============ the lab's corner of the demo menu ============
function renderLabMenu() {
  $('dLab').innerHTML = `<div class="dlabhead ink">PROTOTYPE LAB · EXPERIMENTS</div><div class="dlabrow">${Object.entries(PROTO_LEVELS).map(([id, P]) => `<button class="btn alt small" data-lab="${id}" title="${P.idea}">${P.lab === 'A' || P.lab === 'B' ? 'LAB ' + P.lab : P.lab}</button>`).join('')}</div>`;
}
$('dLab').addEventListener('click', e => { const b = e.target.closest('[data-lab]'); if (b) { audio(); demoStart(b.dataset.lab); } });
function protoOpenFromLink(v) { const id = { a: 'protoA', b: 'protoB', ram: 'protoRam', stress: 'protoStress' }[String(v).toLowerCase()]; if (id) demoStart(id); }
