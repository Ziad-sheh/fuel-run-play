'use strict';
// Fuel Run · cars.js: car physics, game state, legs and depots, gang spawning, damage and explosions.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ cars ============
function drive(c, steer, dt, speed, turn, grip) {
  const sp = Math.hypot(c.vx, c.vy);
  c.a += (c.w || 0) * dt; c.w = (c.w || 0) * Math.exp(-(c === player ? 5 : 3) * dt);   // spin from hits dies away as the tyres bite
  c.a += steer * turn * Math.min(1, 0.3 + sp / 160) * dt;
  const fx = Math.cos(c.a), fy = Math.sin(c.a), k = ease(grip, dt);
  c.vx += (fx * speed - c.vx) * k; c.vy += (fy * speed - c.vy) * k;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.slip = sp > 80 ? Math.abs(angDiff(Math.atan2(c.vy, c.vx), c.a)) : 0;
  c.st = steer;   // for drawing: front wheels turn, the body leans out of the slide, hits make it bounce
  const lat = -Math.sin(c.a) * c.vx + Math.cos(c.a) * c.vy;
  c.roll = (c.roll || 0) + (clamp(lat / 260, -1, 1) - (c.roll || 0)) * ease(8, dt);
  c.bounce = Math.max(0, (c.bounce || 0) - dt * 3);
}
function skid(c, soft) {
  if (c.T && c.T.light) return;   // scrap bikes leave no marks: a pack of them would bury the ground in scribble
  const oily = c.slideT > 0, on = c.slip > 0.22 || soft || oily, ca = Math.cos(c.a), sa = Math.sin(c.a), s = c.size || 1;
  const L = [c.x - ca * 15 * s - sa * 10 * s, c.y - sa * 15 * s + ca * 10 * s], R = [c.x - ca * 15 * s + sa * 10 * s, c.y - sa * 15 * s - ca * 10 * s];
  if (on && c.pL) {
    const pL = c.pL, pR = c.pR;
    paintAt(Math.min(pL[0], L[0], pR[0], R[0]) - 4, Math.min(pL[1], L[1], pR[1], R[1]) - 4, Math.max(pL[0], L[0], pR[0], R[0]) + 4, Math.max(pL[1], L[1], pR[1], R[1]) + 4, g => {
      g.strokeStyle = oily ? 'rgba(30,20,40,.55)' : soft ? 'rgba(130,70,25,.45)' : 'rgba(80,45,20,.3)'; g.lineWidth = (oily ? 7 : 5) * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(...pL); g.lineTo(...L); g.moveTo(...pR); g.lineTo(...R); g.stroke();
    });
  }
  c.pL = on ? L : null; c.pR = on ? R : null;
}

// ============ game state ============
let state = 'menu', player, cars = [], parts = [], pops = [], gems = [], bullets = [], rockets = [], harpoons = [], bombs = [], fires = [], strips = [], rubble = [];
let boss = null, bossN = 0, nextBossAt = 0, banner = null, tether = null, slowT = 0, incoming = [], bullIn = null;
const bannerEnd = b => b.short ? 1.3 : b.sub ? 3.8 : 2.8;   // how long a banner stays up: a quick title for anything coming at you, longer when there's a line to read
let leg = 1, depot = null, stormY = 0, pastDepots = [];
const allDepots = () => depot ? [depot, ...pastDepots] : pastDepots;
let persons = [], storm = null, nextStorm = 0, tumbles = [], tumbleT = 0;
let lastFreezeT = -9, lastBikeSfx = -9, hurtTotal = 0, nextAttackT = 0, boxCD = 0, pincerCD = 0, depotBonus = 0, crashes = 0, selfCrashes = 0, lastTD = -9, tdBeat = -9, shoves = 0, time = 0, spawnT = 0, shake = 0, steer = 0, freeze = 0, hintT = 0, hurtFlash = 0, gold = 0;
let nitro = 0, nitroT = 0, xp = 0, level = 1, pendingLv = 0, gunT = 0, rocketT = 0, flameT = 0, trailT = 0, caltT = 0, gunFlash = 0, turretA = 0;
let up = {}, dmgBy = {}, killsBy = {};
const cam = { x: 0, y: 0 }, view = { ax: 0, ay: 0, z: 1 };
const S = () => fast ? 0.375 : 1;
const DRIFT_COL = ['', '#5fd4ff', '#ff9a1f', '#c77dff'];
const driftTier = () => player.driftC >= 2 ? 3 : player.driftC >= 1.2 ? 2 : player.driftC >= 0.6 ? 1 : 0;   // test: compress the schedule so the boss comes at 0:45

function applySize() { const st = carStats(player.car); player.size = st.size * (1 + 0.13 * up.wheels); player.r = 18 * st.size * (1 + 0.03 * up.wheels); player.m = st.m + 0.25 * up.wheels; }   // looks bigger and heavier, handles the same
function newGame() {
  region = STG().area; applyRegion(); tintStage();   // the stage's area: its colours, its ground, its gangs; then the stage's own shade
  const st = carStats(save.car);   // the car you picked in the garage, with its upgrades
  player = { boarders: [], shakeT: 0, car: save.car, leakK: st.leakK, spd: st.spd, grip: st.grip, turn: st.turn, nitroRate: st.nitroRate, boost: st.boost, rampage: 0, ghostT2: 0, harpT: 0,
             x: 0, y: 300, a: -Math.PI / 2, vx: 0, vy: -150, r: 18, size: 1, inv: 0, slip: 0, mul: 1, hp: st.hp, maxHp: st.hp, ghost: st.hp, ghostT: 0, burnT: 0, m: 1.2, driftC: 0, boostT: 0, boostMul: 1, dc: { pts: 0, chain: 0, idle: 0, on: false, prox: 1, bank: '', bankT: 0 } };
  cars = []; parts = []; pops = []; gems = []; bullets = []; rockets = []; harpoons = []; bombs = []; fires = []; strips = []; rubble = [];
  boss = null; bossN = 0; nextBossAt = 120 * S(); banner = null; tether = null; incoming = []; bullIn = null; camF.w = 0; slowT = 0; view.z = ZOOM; persons = []; storm = null; nextStorm = 70 * S(); tumbles = []; tumbleT = 1;
  banked = 0; nextAttackT = 2; boxCD = 0; pincerCD = 0; crashes = 0; selfCrashes = 0; lastTD = -9; tdBeat = -9; shoves = 0; time = 0; spawnT = 1.5; shake = 0; steer = 0; freeze = 0; hintT = stageIx === 0 && !save.stars[0] ? 6 : 0; hurtFlash = 0; gold = 0;
  nitro = 0.5; nitroT = 0; xp = 0; level = 1; pendingLv = 0; pickAt = pickBy = 0; fury = { lv: 1, fill: 0, idle: 0, best: 1 }; score = 0; tricks = 0; chain = { n: 0, t: -9, best: 0 }; ptrail = []; lastWordT = -9; lastFreezeT = -9; gunT = 0; rocketT = 1; flameT = 0; trailT = 0; caltT = 0; gunFlash = 0;   // timers on the run clock start fresh every run
  up = { gun: 0, rocket: 0, flame: 0, ram: 0, wheels: 0, caltrops: 0, oil: 0, saw: 0, mortar: 0, drone: 0, emp: 0, lance: 0, evo: {} }; applyArmoury(); resetArsenal(); resetHazards(); resetGadgets(); resetEvents(); resetSections(); dmgBy = {}; killsBy = {};
  resetRunState(); shells = []; eventT = 1e9; boxT = 1e9; twisterT = 1e9; wormT = 1e9; stageBoss = null; introT = 0; wrecks = 0; outCause = ''; fuelLowT = 0; $('intro').hidden = true; hideStageCard(); chalReset();   // Fuel Run: no road events, gadget crates, twisters or sandworm (and no train lines: startLeg); a fresh stage
  applySize(); cam.x = player.x; cam.y = player.y;
  renderUps(); hudCache = {}; $('boss').hidden = true;
  leg = 1; depot = null; pastDepots = []; startLeg(false);
  chunks.clear(); ensureChunks(true);
}
// each leg: a fuel depot up ahead (north), a dust storm rolling in behind you. The Bull guards the last stretch.
function startLeg(announce) {
  if (demo && ENC[demo.level]) { encDepot(); stormY = player.y + 1e7; heat = { lv: 1, n: 0 }; rebuildLists(); return; }   // a demo road is laid out whole (encounters.js)
  const len = legLen();
  if (depot) { pastDepots.unshift(depot); pastDepots.length = Math.min(pastDepots.length, 2); }
  depot = { x: player.x + rand(-600, 600), y: player.y - len, open: true, bossDone: false, msgT: 0, len, tanks: [] };
  depot.road = makeRoad(player.x, player.y, depot.x, depot.y + 250); depot.road.first = leg === 1;   // the highway runs to its gate
  depot.boss = legBoss();   // a fuel stop (ambush at the gate) or the region's fortress (its boss)
  planSections(depot, player.y);   // the stretches of road on the way: canyon, town, oil field, dunes, scrapyard, a broken bridge
  if (REG().id === 'yards' && !FUEL_RUN) { depot.tracks = []; for (let y = player.y - 2600; y > depot.y + 1600; y -= rand(4200, 6200)) depot.tracks.push(Math.round(y)); }   // rail lines across the Yards
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.78; depot.tanks.push({ x: depot.x + Math.cos(a) * 205, y: depot.y + Math.sin(a) * 205, r: 34 }); }
  stormY = player.y + (stormOn() ? STORM_BACK : 1e7); rebuildLists();   // the storm only rolls on its own stage; elsewhere the fuel gauge is the clock
  heat = { lv: 1, n: 0 };   // the pack grows with your progress down the road (update.js)
}
// gangs come from behind you or from the side, never from the cone ahead, just past the edge of the screen
const offScreen = () => Math.hypot(VW, VH) / 2 / view.z + 140;
function edgePoint(a, pad = 110) {   // just past the screen edge, in direction a from the middle of the view
  const hw = VW / 2 / view.z, hh = VH / 2 / view.z, t = Math.min(hw / (Math.abs(Math.cos(a)) || 1e-6), hh / (Math.abs(Math.sin(a)) || 1e-6)) + pad;
  return [cam.x + Math.cos(a) * t, cam.y + Math.sin(a) * t];
}
function spawnPoint() {
  const fwd = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a;
  for (let i = 0; i < 40; i++) {
    const [x, y] = edgePoint(fwd + Math.PI + rand(-1.92, 1.92), rand(90, 200));
    if (!blocked(x, y, 40) && !(state === 'play' && y > stormY - 180)) return [x, y];   // never inside (or right in front of) the storm
  }
  return null;
}
// riding slots around you (forward / lateral offsets): one car per slot, so they don't pile into each other
const SLOTS = { L1: [10, -82], L2: [-95, -88], R1: [10, 82], R2: [-95, 88], REAR: [-125, 0], FRONT: [160, 0] };
function setSlot(k) {   // no free slot: hang back and wait for one
  const S2 = SLOTS[k.slot] || [-260, (grand() < 0.5 ? -1 : 1) * 60];
  k.slotLon = S2[0]; k.side = Math.sign(S2[1]) || 1; k.slotLat = Math.abs(S2[1]); k.rear = k.slot === 'REAR'; k.front = k.slot === 'FRONT';
}
function freeSlot(type) {
  const taken = new Set(cars.filter(c => !c.dead && !c.flee).map(c => c.slot)), want = [];
  if (type === 'ram' && grand() < 0.4) want.push('REAR');
  if (type === 'buggy' && grand() < 0.3) want.push('FRONT');
  want.push(...shuffle(['L1', 'R1', 'L2', 'R2']), 'REAR', 'FRONT');
  return want.find(k => !taken.has(k)) || null;
}
function spawnCar(type = pickType(), recycle) {
  const p = spawnPoint(); if (!p) return;
  const [x, y] = p, h = Math.atan2(player.y - y, player.x - x);
  if (recycle) { Object.assign(recycle, { x, y, a: h, vx: Math.cos(h) * 150, vy: Math.sin(h) * 150, pL: null, pR: null, mode: 'flank', modeT: 0 }); return; }
  incoming.push({ x, y, type, t: 1.5 });   // a dust plume and a pulsing marker warn you first
}
function landCar(I) {
  let x = I.x, y = I.y;
  const fwd = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a;
  if (!I.ahead && Math.abs(angDiff(fwd, Math.atan2(y - player.y, x - player.x))) < 1.1) { const p = spawnPoint(); if (p) [x, y] = p; }   // you turned toward it: bring it in from behind instead (events mean it)
  if (inView(x, y, 60) && !I.guardOf && !I.fixed) [x, y] = edgePoint(Math.atan2(y - cam.y, x - cam.x));   // a guard lands beside its Rig
  const T = GANG[I.type], h = Math.atan2(player.y - y, player.x - x), hp = I.stageBoss ? STG().segs * PIP : T.hp;   // honest pips: a buggy is always two hits; a stage boss has the stage's segments
  cars.push({ stageBoss: !!I.stageBoss, ambush: !!I.ambush, type: I.type, kind: T.art || I.type, T, x, y, a: h, vx: Math.cos(h) * 250, vy: Math.sin(h) * 250, r: T.r, size: T.scale, m: T.m, hp, maxHp: hp, slip: 0, ph: rand(0, 2), skill: rand(0.6, 1.2), lead: rand(0.15, 0.6),
              stun: 0, age: 0, close: false, touched: false, frag: 0, hitCD: 0, bumpCD: 0, hurtT: 0, slideT: 0, burnT: 0, spun: new Set(), cool: rand(2, 4), aimT: 0, aimA: 0,
              mode: 'flank', modeT: 0, wait: rand(0.4, 1.2), side: grand() < 0.5 ? -1 : 1, slotLat: rand(72, 92), slotLon: rand(-40, 30), rear: false, minD: 1e9, oled: false, hitYou: false, w: 0, crew: CREW[I.type].length, flag: true, lost: 0 });
  if (I.soft) { const k = cars[cars.length - 1]; k.hp = k.maxHp = Math.max(PIP, Math.round(k.maxHp / 2 / PIP) * PIP); }   // the demo's opening raider: one pip, so a first attachment can finish it and show what it does
  const nk = cars[cars.length - 1]; nk.slot = freeSlot(nk.type); setSlot(nk);
  if (T.elite) { nk.slot = T.art === 'ram' ? 'REAR' : null; setSlot(nk); nk.wait = 0.4; announceGuardian(nk); }
  if (I.mode) { nk.mode = I.mode; if (I.mode === 'oncoming' || I.mode === 'parked') nk.a = Math.atan2(player.y - nk.y, player.x - nk.x); if (I.mode === 'parked') nk.vx = nk.vy = 0; }
  nk.evTag = I.evTag || 0;
  if (I.mode === 'convoy' && I.a !== undefined) { nk.a = I.a; nk.vx = Math.cos(I.a) * SPEED * ENC_CONVOY.speed; nk.vy = Math.sin(I.a) * SPEED * ENC_CONVOY.speed; nk.escort = !!I.escort; if (!I.escort) nk.hp = nk.maxHp = ENC_CONVOY.hp; }   // the demo's convoy: already rolling up the road
  if (I.guardOf) { nk.guard = { of: I.guardOf, side: I.guardSide }; I.guardOf.guards[I.guardSide < 0 ? 'l' : 'r'] = nk; }   // a War Rig's guard
  nk.chaser = grand() < (T.chase || 0); nk.lane = rand(-60, 60); nk.cut = nk.chaser && grand() < 0.22; if (nk.chaser) nk.mode = 'chase';   // most of the pack hunts you head-on; a few cut ahead to meet you
}
// credit: your hits mark a car for a few seconds; if it wrecks meanwhile (on a rock, a barrel, another car), that's your takedown
let ptrail = [];   // where you've been in the last couple of seconds: a chaser that hits something you just slipped past was SKIMMED
const skimmed = k => ptrail.some(p => time - p.t < 2.2 && Math.hypot(p.x - k.x, p.y - k.y) < 150);
const crashWord = k => k.mode === 'lunge' || k.mode === 'swipe' || (k.mode === 'ram' && k.modeT > 0.15) ? 'BULLSEYE!' : k.blameT > time ? (k.slideT > 0 ? 'SPUN OUT!' : 'SHUNTED!') : skimmed(k) ? 'SKIM!' : 'WIPEOUT!';
const hitScale = () => (1 + time / 400) * (1 + 0.15 * region) * (leg <= 2 ? 0.9 : 1);   // gang hits land harder as the run and the regions go on; the first two legs are a little kinder
function blame(k, secs = 3) { if (k && !k.dead) { k.blameT = Math.max(k.blameT || 0, time + secs); if (secs >= 3) k.touchT = time; } }   // the full 3 s means you did it: a hit, a gadget, a weapon (lures pass less)
// heavier cars move less and keep more of their momentum (h points from b to a)
const PIT_K = 0.17;
function spinHit(c, px, py, jx, jy, k) {   // an off-centre hit twists a car: lever along its length x the push across it
  const fx = Math.cos(c.a), fy = Math.sin(c.a), s = (px - c.x) * fx + (py - c.y) * fy, jl = fx * jy - fy * jx, L = 48 * CAR * (c.size || 1);
  c.w = clamp((c.w || 0) + k * s * jl / ((c.m || 1) * L * L / 12), -9, 9);
}
function bump(a, b, h, e = 0.35) {
  const t = a.m + b.m; a.x += h.nx * h.pen * b.m / t; a.y += h.ny * h.pen * b.m / t; b.x -= h.nx * h.pen * a.m / t; b.y -= h.ny * h.pen * a.m / t;
  const rel = (a.vx - b.vx) * h.nx + (a.vy - b.vy) * h.ny;
  if (rel < 0) { const j = -(1 + e) * rel / (1 / a.m + 1 / b.m); a.vx += j * h.nx / a.m; a.vy += j * h.ny / a.m; b.vx -= j * h.nx / b.m; b.vy -= j * h.ny / b.m; const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2; spinHit(a, px, py, j * h.nx, j * h.ny, PIT_K); spinHit(b, px, py, -j * h.nx, -j * h.ny, PIT_K); }
}
// war boys: where they ride on each car (car-local, before the car's scale)
const CREW = { scrap: [], buggy: [[-14, 0]], ram: [[-20, -6], [-20, 6]], harpoon: [[-5, 3]], bomber: [[-16, 0]], polecat: [[-6, 0], [-16, 0]] };
const DRIVER = { buggy: [-1, 0], ram: [-1, -4], harpoon: [5, -4], bomber: [5, -4], polecat: [4, 0] };
CREW.rig = CREW.ram; CREW.bombard = CREW.bomber; CREW.tanker = CREW.ram; DRIVER.rig = DRIVER.ram; DRIVER.bombard = DRIVER.bomber; DRIVER.tanker = DRIVER.ram;
function ejectCrew(c, n, driver) {   // they fly off, tumble, bounce, sit up dazed, then run for it
  const total = Math.min(n, c.crew || 0) + (driver ? 1 : 0);
  for (let i = 0; i < total; i++) {
    const isDriver = driver && i === total - 1, a = rand(0, TAU), sp = rand(120, 260);
    persons.push({ x: c.x + rand(-8, 8), y: c.y + rand(-8, 8), vx: c.vx * 0.5 + Math.cos(a) * sp, vy: c.vy * 0.5 + Math.sin(a) * sp, h: 8, vh: rand(280, 420), a: rand(0, TAU), spin: rand(-14, 14), t: 0, life: 2.6, state: 'fly', driver: isDriver, bounced: false });
  }
  if (!driver) c.crew = Math.max(0, (c.crew || 0) - n);
  if (persons.length > 60) persons.splice(0, persons.length - 60);
}
function snapFlag(c) {   // the flag pole snaps and tumbles away
  if (!c.flag) return; c.flag = false;
  const a = crand(0, TAU), sp = crand(150, 300); parts.push({ k: 'flag', x: c.x, y: c.y, vx: Math.cos(a) * sp + c.vx * 0.3, vy: Math.sin(a) * sp + c.vy * 0.3, a: crand(0, TAU), spin: crand(-10, 10), t: 0, life: 2.5, col: c.T ? c.T.col : '#24160f' });
}
function loosePart(c, col) {   // a bumper, door or spike breaks off and lies in the sand
  const a = crand(0, TAU), sp = crand(140, 300);
  parts.push({ k: 'carpart', sub: cpick(['bumper', 'door', 'spike']), col, x: c.x, y: c.y, vx: Math.cos(a) * sp + c.vx * 0.3, vy: Math.sin(a) * sp + c.vy * 0.3, a: crand(0, TAU), spin: crand(-12, 12), t: 0, life: 3.5 });
}
function updatePersons(dt) {
  for (const p of persons) {
    p.t += dt;
    if (p.state === 'fly') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-0.8 * dt); p.vy *= Math.exp(-0.8 * dt); p.vh -= 900 * dt; p.h += p.vh * dt; p.a += p.spin * dt;
      if (p.h <= 0) { p.h = 0; if (!p.bounced && p.vh < -150) { p.bounced = true; p.vh = -p.vh * 0.35; p.vx *= 0.5; p.vy *= 0.5; parts.push({ k: 'dust', x: p.x, y: p.y, vx: 0, vy: 0, t: 0, life: 0.5, size: 10 }); } else { p.state = 'dazed'; p.st = 0; } }
    } else if (p.state === 'dazed') { p.st += dt; if (p.st > 1.1) { p.state = 'run'; p.dir = Math.atan2(p.y - player.y, p.x - player.x) + rand(-0.7, 0.7); } }
    else { p.x += Math.cos(p.dir) * 95 * dt; p.y += Math.sin(p.dir) * 95 * dt; }
  }
  persons = persons.filter(p => p.t < p.life);
}
function bigMoment(x, y, word, big = 1.7, life = 1.15) {   // a big moment: the burst grows above the spot (never on top of your car or the boss), holds a beat, and time slows a touch
  parts = parts.filter(q => q.k !== 'burst');   // one word on screen at a time
  parts.push({ k: 'burst', x, y: y - 70 - 50 * big, t: 0, life, word, big, rot: crand(-0.3, 0.3) });   // the bigger the word, the higher it sits
  lastWordT = time + life - 0.8;   // trick words wait until it's gone
  slowT = Math.max(slowT, 0.25);
}
function whipCar(k, nx, ny, cx, cy) {   // a drift hit: your tail swings in like a hammer. It spins them, throws them and hurts: a buggy rarely survives one
  k.whipCD = time + 0.5; k.bumpCD = 0.35; blame(k); markPlayerCause(k, 'ability');
  const sp = Math.hypot(player.vx, player.vy), f = (260 + player.slip * 380 + Math.abs(player.turnRate || 0) * 40) * Math.pow(player.m / k.m, 0.6);
  k.vx += nx * f; k.vy += ny * f; spinHit(k, cx, cy, nx * f * k.m, ny * f * k.m, PIT_K * 2);
  k.stun = 0.9; k.frag = 1.4; k.slideT = Math.max(k.slideT, 0.6);
  player.vx -= nx * f * 0.15 * k.m / player.m; player.vy -= ny * f * 0.15 * k.m / player.m;
  for (let i = 0; i < 8; i++) parts.push({ k: 'spark', x: cx, y: cy, vx: nx * 260 + crand(-200, 200), vy: ny * 260 + crand(-200, 200), t: 0, life: 0.25 });
  SFX.shove(); addNitro(0.1, 'whip'); addFury(0.12); player.dc.pts += 80; if (k.crew) ejectCrew(k, 1);
  hitRaider(k, 2, 'TAIL WHIP', cx, cy);   // drifting into them: your tail hits for two
}
function ole(k) {   // a lunge that just missed: slow-mo and a cheer (and it counts as a near miss)
  slowT = 0.35; addNitro(0.15, 'ole'); addFury(0.3); SFX.ole(); if (k) onNearMiss(k); if (player.dc) player.dc.pts += 60;
  pops.push({ x: player.x, y: player.y - 50, text: 'OLÉ!', col: '#ffd23f', t: 0 }); parts.push({ k: 'ring', x: player.x, y: player.y, t: 0, life: 0.35, R: 90 });
}

// ============ damage, explosions ============
function damage(k, n, src, word, fx, fy, quiet, cause) {   // cause: what this damage is, for the wreck it may end in (see run_rules.js)
  if (k.dead || n <= 0 || state !== 'play') return;
  if (src !== 'trick') blame(k, 2);
  dmgBy[src] = (dmgBy[src] || 0) + Math.min(k.hp, n); k.hp -= n; k.hurtT = 0.09; k.bounce = 1;
  while (k.hp > 0 && (k.lost || 0) < Math.floor((1 - k.hp / k.maxHp) * 3)) { k.lost = (k.lost || 0) + 1; loosePart(k, k.T.col); }
  if (k.hp <= 0) wreck(k, word, src, undefined, cause);
}
function blast(x, y, R, force, byYou) {   // byYou: the drums it lights carry the player's cause on
  for (const c of cars) {
    if (c.dead) continue;
    const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy), m = 1 / Math.sqrt(c.m);
    if (d > 1 && d < R) { const f = (force * (1 - d / R) + 160) * m; c.vx += dx / d * f; c.vy += dy / d * f; c.a += rand(-1.2, 1.2) * m; c.frag = Math.max(c.frag, 0.7); c.stun = Math.max(c.stun, 0.5); }
  }
  for (const b of drums) if (!b.gone && Math.hypot(b.x - x, b.y - y) < R * 0.55) { b.fuse = b.fuse || rand(0.08, 0.2); if (byYou) b.byYou = true; }
}
const BOOM_WORDS = ['BOOM!', 'KRAK!', 'WHAM!', 'BLAM!', 'KABLOOEY!', 'POW!'];
function boom(x, y, word, big = 1, byYou) {   // compact: a small fireball, sparks, smoke that trails off, a light thump
  scorch(x, y, 32 * big);
  parts.push({ k: 'flash', x, y, t: 0, life: 0.09, R: 60 * big });
  parts.push({ k: 'fireball', x, y, t: 0, life: 0.6, R: 30 * big, seed: Math.floor(crand(1, 999)) });
  for (let i = 0; i < (big < 1 ? 1 : 3); i++) { const a = crand(0, TAU), sp = crand(80, 200) * big; parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.2, 0.35), size: crand(5, 8) * big }); }
  for (let i = 0; i < (big < 1 ? 3 : 6); i++) { const a = crand(0, TAU), sp = crand(200, 420); parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.15, 0.3) }); }
  for (let i = 0; i < (big < 1 ? 1 : 3); i++) parts.push({ k: 'puff', x: x + crand(-8, 8), y: y + crand(-8, 8), vx: crand(-20, 20), vy: crand(-40, -10), t: 0, life: crand(0.9, 1.4), size: crand(10, 16) * big, dark: true });
  if (word) parts.push({ k: 'burst', x, y, t: 0, life: 0.7, word, big: 0.8 * big, rot: crand(-0.3, 0.3) });
  SFX.wreck(big);
  blast(x, y, 120 * big, 240 * big, byYou);
}
function smallBoom(x, y, R) {   // a rocket hit
  scorch(x, y, 26);
  for (const W of walls) if (W.station && !W.gone && circleRect({ x, y, r: (R || 60) * 0.7 }, W)) hitWall(W, 2);   // a hit near the gas station sets it off
  parts.push({ k: 'flash', x, y, t: 0, life: 0.08, R: 50 });
  parts.push({ k: 'fireball', x, y, t: 0, life: 0.42, R: 19, seed: Math.floor(crand(1, 999)) });
  for (let i = 0; i < 2; i++) { const a = crand(0, TAU), sp = crand(60, 200); parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.2, 0.32), size: crand(5, 8) }); }
  SFX.pop();
}
// a destroyed car blows apart: debris and wheels fly and fade, nothing stays on the ground but the scorch.
// Only your takedowns pay: a car you hit, shoved, spun or lured (it was hunting you near a hazard) drops loot and builds Fury.
// One that crashed on its own just burns. A driving takedown (your car did it, not a weapon) pays the most and gets the big beat.
const DRIVE_SRC = { trick: 1, ram: 1, crush: 1 }, ARM_SRC = { saw: 1, cannon: 1, flame: 1, oil: 1 };
const lured = k => !k.flee && Math.hypot(k.x - player.x, k.y - player.y) < 600;   // hunting you when a hazard got it
function wreck(k, word, src = 'trick', credit, cause) {   // cause: the resolved cause of this wreck; without one it's resolved here from the word's kind and the player's marks
  if (k.dead) return; k.dead = true;
  ejectCrew(k, k.crew, true); snapFlag(k);
  if (tether && tether.k === k) tether = null;
  const s = k.size, hl = Math.hypot(k.hitVX || 0, k.hitVY || 0) || 1, hx = (k.hitVX || 0) / hl, hy = (k.hitVY || 0) / hl, push = k.hitT > time ? 260 : 0;   // the wreck flies along the hit that did it
  for (let i = 0; i < 3 * s; i++) { const a = crand(0, TAU), sp = crand(200, 480); parts.push({ k: 'debris', x: k.x, y: k.y, vx: Math.cos(a) * sp + k.vx * 0.3 + hx * push, vy: Math.sin(a) * sp + k.vy * 0.3 + hy * push, a: crand(0, TAU), spin: crand(-16, 16), t: 0, life: crand(0.8, 1.4), size: crand(5, 10) * s, col: cpick([k.T.col, '#5c626a', k.T.col, '#a5532e']) }); }
  for (let i = 0; i < 1; i++) { const a = crand(0, TAU), sp = crand(260, 460); parts.push({ k: 'wheel', x: k.x, y: k.y, vx: Math.cos(a) * sp + hx * push * 1.4, vy: Math.sin(a) * sp + hy * push * 1.4, a: 0, spin: crand(-20, 20), t: 0, life: 1.4, size: s }); }
  if (state !== 'play') { boom(k.x, k.y, null, 0.9); return; }
  if (k.hp > 0) { dmgBy[src] = (dmgBy[src] || 0) + k.hp; k.hp = 0; }
  const C = cause && cause.playerCaused !== undefined ? cause : resolveWreckCause(k, cause && cause.kind || WORD_KIND[word] || (src !== 'trick' ? 'ability' : 'ambient'), cause && cause.lureKey, credit || src !== 'trick');
  if (cause && cause.detail === undefined && k.cause) C.detail = k.cause.detail;
  const yours = C.playerCaused;
  recordRunEvent('wreck', { car: k.type, kind: C.kind, credited: yours, word });
  if (runState) { const W = runState.totals.wreckTally || (runState.totals.wreckTally = {}), key = `${yours ? 'yours' : 'ambient'}:${k.type}:${C.kind}`; W[key] = (W[key] || 0) + 1; }   // every wreck counted (the event list keeps only the latest 600)
  if (!yours && !k.stageBoss) { selfCrashes++; if (runState) runState.totals.ambient++; boom(k.x, k.y, null, k.T.armour ? 1 : 0.8); return; }   // died to nothing you did: no fuel, no count (a stage boss always ends its stage)
  const driving = !!DRIVE_SRC[src], bike = k.T.light && demo && demo.proto;   // a scrap bike in the lab is one of a crowd: a small pop, no word, no hit-pause (a burst of them gets one count)
  boom(k.x, k.y, null, bike ? 0.45 : k.T.armour || k.T.elite ? 1.1 : 0.7, yours);   // a wreck that was yours lights drums as yours
  if (k.T.elite) { guardianDown(k); return; }   // a stage boss down
  const why = !word || word === 'WIPEOUT!' || word === 'SKIM!' ? (k.touchT !== undefined && time - k.touchT < 3 ? 'WRECKED!' : 'SMASHED!') : word === 'KRUNCH!' ? 'SMASHED!' : word;   // one word for why it died: you wrecked it, or it smashed into something
  if (bike) protoBikeBurst(k); else pops.push({ x: k.x, y: k.y - 34, text: why, col: '#fff4dc', t: 0, small: 1 });
  if (demo) draftSalvage(k.T.gem || 1);   // salvage toward the next pick: only from wrecks that were yours
  killsBy[src] = (killsBy[src] || 0) + 1; crashes++; wrecks++; if (runState) { runState.totals.wrecks++; runState.totals.credited++; }
  chalAdd(C.kind === 'ram' && C.detail === 'side' ? 'side' : C.kind); if (k.type === 'tanker') chalAdd('tanker');   // the stage's challenge reads the cause, not the word
  if (k.evTag && ev && ev.id === k.evTag) ev.kills++;
  if (k.type === 'tanker' && demo) { boom(k.x, k.y, null, 1.6); bigMoment(k.x, k.y, 'TANKER DOWN!', 1.4, 1); fires.push({ x: k.x, y: k.y, r: 120, t: 0, life: 3.5, chain: C.chainId, mine: true, byYou: true }); draftSalvage(ENC_CACHE.salvage - 1); addNitro(1, 'tanker'); }   // the demo's convoy pays like the cache: its can, salvage, a full nitro; its fire is yours
  else if (k.type === 'tanker') { boom(k.x, k.y, null, 1.6); bigMoment(k.x, k.y, 'TANKER DOWN!', 1.4, 1); fires.push({ x: k.x, y: k.y, r: 120, t: 0, life: 3.5, chain: C.chainId }); for (let i = 0; i < 3; i++) dropGem(k.x, k.y, -12, 1.6); addNitro(1, 'tanker'); }   // the convoy's prize: fuel to repair you and a full tank of nitro
  if (driving && bike) { if (Math.abs(time - lastBikeSfx) > 0.12) { lastBikeSfx = time; SFX.takedown(); } }
  else if (driving) { SFX.takedown(); if (time - lastFreezeT > 0.15) { lastFreezeT = time; freeze = Math.max(freeze, 0.06); shake = Math.max(shake, 6 * (calmMotion ? 0.3 : 1)); } }   // a hit-pause: the takedown lands
  const v = k.T.gem, drops = v <= 2 ? Array(v).fill(1) : [v];
  for (let i = 0; i < k.T.gold; i++) dropGem(k.x, k.y, 0);
  if (k.T.fuel) dropGem(k.x, k.y, -k.T.fuel, 0.8);   // a raider you wrecked spills its fuel: the can flies to you
  addNitro(k.T.light ? PROTO_NITRO.bike : 0.2, k.T.light ? 'wreck-light' : 'wreck-raider'); lastTD = time;
  if (window.onTakedown) onTakedown(k, src, driving);
}
function dropGem(x, y, v, spd = 1) { const a = rand(0, TAU), sp = rand(80, 220) * spd; gems.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v, t: 0 }); }   // v = 0 is a gold coin, v < 0 a fuel can that repairs -v
function drumBoom(b) {
  if (b.gone) return; b.gone = true;
  if (b.ch) b.ch.drums = b.ch.drums.filter(x => x !== b);
  for (const c of cars) if (!c.dead && Math.hypot(c.x - b.x, c.y - b.y) < 115) { if (b.byYou) { blame(c, 1); markPlayerCause(c, 'drum'); } damage(c, c.T.elite ? PIP : 120, 'trick', 'KABOOM!', undefined, undefined, undefined, resolveWreckCause(c, 'drum', b, b.byYou)); }   // three hits on a raider, one on a boss
  if (boss && !boss.dead && bossPoints().some(p => Math.hypot(p.x - b.x, p.y - b.y) < 120)) { damageBoss(boss.maxHp * 0.05, 'trick', b.x, b.y, 'BOOM!'); if (boss && !boss.dead && boss.state !== 'stunned') stunBoss(1.3, false); }
  boom(b.x, b.y, null, 1.15, b.byYou);
  fires.push({ x: b.x, y: b.y, r: 60, t: 0, life: 2.2, byYou: b.byYou });
  for (const W of walls) if (circleRect({ x: b.x, y: b.y, r: 95 }, W)) hitWall(W, 1, b.byYou);
  fortDrum(b);   // beside the Road Fortress's guns, it knocks them out
  if (Math.hypot(player.x - b.x, player.y - b.y) < 80) hurt(8, false, 'drum');
}
function hitWall(W, n, byYou) {   // scrap walls take 3 hits, then crumble into rubble; byYou: your ram or your drum did it
  if (!W || W.gone || W.rock) return; if (byYou) W.byYou = true;
  W.hp -= n; W.shakeT = 0.3;
  for (let i = 0; i < 5; i++) parts.push({ k: 'debris', x: W.x + W.w / 2 + crand(-0.4, 0.4) * W.w, y: W.y + W.h / 2 + crand(-0.4, 0.4) * W.h, vx: crand(-200, 200), vy: crand(-200, 200), a: crand(0, TAU), spin: crand(-12, 12), t: 0, life: crand(0.6, 1), size: crand(4, 8), col: cpick(['#a5532e', '#c8693a', '#7a3a22']) });
  if (W.hp <= 0) destroyWall(W);
}
function destroyWall(W) {
  if (W.station && !W.gone) { W.gone = true; if (W.ch) W.ch.walls = W.ch.walls.filter(x => x !== W); walls = walls.filter(x => x !== W); stationBoom(W); return; }
  W.gone = true; if (W.ch) W.ch.walls = W.ch.walls.filter(x => x !== W); walls = walls.filter(x => x !== W);
  const cx = W.x + W.w / 2, cy = W.y + W.h / 2, Rr = Math.max(W.w, W.h) / 2;
  for (let i = 0; i < 16; i++) { const a = crand(0, TAU), sp = crand(150, 420); parts.push({ k: 'debris', x: cx + crand(-0.4, 0.4) * W.w, y: cy + crand(-0.4, 0.4) * W.h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: crand(0, TAU), spin: crand(-14, 14), t: 0, life: crand(0.9, 1.6), size: crand(7, 13), col: cpick(['#a5532e', '#c8693a', '#7a3a22', '#5c626a']) }); }
  for (let i = 0; i < 8; i++) { const a = crand(0, TAU), sp = crand(30, 120); parts.push({ k: 'dust', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.8, 1.3), size: crand(14, 22) }); }
  rubble.push({ x: cx, y: cy, r: Rr * 0.8 + 20, t: 0, life: 3 });
  SFX.crate(); SFX.clang();
}
function breakCrate(b) {
  if (b.gone) return; b.gone = true;
  if (b.ch) b.ch.crates = b.ch.crates.filter(x => x !== b);
  rubble.push({ x: b.x, y: b.y, r: 55, t: 0, life: 2 });
  for (let i = 0; i < 9; i++) { const a = crand(0, TAU), s = crand(120, 320); parts.push({ k: 'debris', x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, a: crand(0, TAU), spin: crand(-14, 14), t: 0, life: crand(0.8, 1.6), size: crand(5, 9), col: cpick(['#c98a4a', '#a8693a', '#e0a865']) }); }
  SFX.crate();
}
function throwBoarder() {   // one war boy off your roof, flung clear
  const b = player.boarders.pop(); if (!b) return; const a = player.a + (grand() < 0.5 ? -1 : 1) * Math.PI / 2;
  persons.push({ x: player.x, y: player.y, vx: player.vx * 0.5 + Math.cos(a) * 260, vy: player.vy * 0.5 + Math.sin(a) * 260, h: 14, vh: 320, a: rand(0, TAU), spin: rand(-14, 14), t: 0, life: 5, state: 'fly', driver: false, bounced: false });
  pops.push({ x: player.x, y: player.y - 50, text: 'SHAKEN OFF!', col: '#5be37d', t: 0 }); addNitro(0.1, 'boarder'); addFury(0.2); if (player.dc) player.dc.pts += 40; bounty('boarders');
  if (b.took > 0) dropGem(player.x, player.y, -Math.round(b.took), 0.6);   // the fuel he siphoned comes back as a can
  if (tipNow && tipNow.id === '_hint') tipT = Math.min(tipT, 0.4);
}
function boarderLeaves() {   // he rode long enough: he jumps clear with your fuel
  const b = player.boarders.shift(); if (!b) return; const a = player.a + (grand() < 0.5 ? -1 : 1) * Math.PI / 2;
  persons.push({ x: player.x, y: player.y, vx: player.vx * 0.5 + Math.cos(a) * 200, vy: player.vy * 0.5 + Math.sin(a) * 200, h: 14, vh: 260, a: rand(0, TAU), spin: rand(-8, 8), t: 0, life: 5, state: 'fly', driver: false, bounced: false });
  pops.push({ x: player.x, y: player.y - 70, text: `HE GOT AWAY WITH ${Math.round(b.took)} FUEL`, col: '#ff5a46', t: 0, small: 1 });
}
function hurt(n, soft, source) {   // source: what took it (impact, boss, drum, fire, storm, boarder, fall, ball, geyser, rock); the ledger keeps them apart
  if (state !== 'play' || runHeld() || (runState && runState.outcome !== 'active')) return;   // nothing lands under a card, and nothing after the win
  source = source || (soft ? 'drain' : 'impact');
  const cd = demo && demo.L.proto && source === 'impact' ? 'contactInv' : 'inv';   // the lab: bumps share their own cooldown, so a bump never swallows a shell or a fire
  if (!soft) { if (player[cd] > 0 || player.inv > 0.45) return; player[cd] = 0.45; if (player.boarders.length) throwBoarder(); shake = Math.max(shake, Math.min(11, 5 + n * 0.25) * (calmMotion ? 0.3 : 1)); SFX.hit(); blast(player.x, player.y, 150, 260); }
  n *= (player.leakK || 1) * (soft ? 1 : STG().hit || 1);   // armour: hits leak less; late stages hit harder (steady drains cost what they show)
  const took = -changeFuel(-n, source); hurtTotal += took; player.ghostT = 0.5;
  if (!soft && took >= 1) { leakFuel(took); recordRunEvent('fuel_loss', { source, n: Math.round(took) }); }   // the red number: what the hit really cost
  if (runState) runState.lastLossSource = source;
  if (!soft) { player.hits = (player.hits || 0) + 1; while ((player.lost || 0) < Math.min(4, Math.floor(player.hits / 2))) { player.lost = (player.lost || 0) + 1; loosePart(player, '#cfd8dc'); } hurtFlash = Math.max(hurtFlash, 1); player.bounce = 1; }   // hits dent the car and knock parts off; a low tank only sputters
  if (!soft && player.dc && player.dc.pts > 0) { player.dc.pts = 0; player.dc.chain = 0; }
  if (player.hp <= 0) { if (god) { player.hp = 1; } else { player.hp = 0; outCause = soft ? 'OUT OF FUEL!' : 'WRECKED!'; gameOver(false); } }
  return took;
}
