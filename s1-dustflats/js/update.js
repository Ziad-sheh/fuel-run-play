'use strict';
// Wasteland Drift · update.js: camera, weather, input and the per-tick update.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ camera ============
const camF = { w: 0, x: 0, y: 0 };   // how much the camera is framing the Bull (0..1), and where it last saw it
function updateCamera(dt) {   // follow you and look ahead; when the Bull is near, ease out to keep it in frame without pushing you to the edge
  const sp = Math.hypot(player.vx, player.vy), crowd = cars.filter(k => !k.dead && Math.abs(k.x - player.x) < 520 && Math.abs(k.y - player.y) < 620).length;
  const zBase = ZOOM * (1 - 0.16 * clamp((sp - 330) / 170, 0, 1)) * (1 - 0.1 * clamp((crowd - 3) / 4, 0, 1));   // pull back a touch at top speed and when the pack closes in
  const B = boss && !boss.dead ? boss : null;
  if (B && demo && BOSS_KINDS[B.kind].weak) {   // a demo boss: frame both of you between the HUD and the controls, zooming out only as far as needed
    const mx = player.x * 0.55 + B.x * 0.45 + player.vx * 0.15, my = player.y * 0.55 + B.y * 0.45 + player.vy * 0.15 - 12 / view.z, dx = Math.abs(B.x - player.x) * 1.12 + 170, dy = Math.abs(B.y - player.y) * 1.12 + 170;
    const zt = clamp(Math.min((VW - 60) / dx, (VH - 340) / dy), ZOOM * 0.55, zBase);   // the safe area: under the boss bar (~175 px), above the controls (~150 px)
    cam.x += (mx - cam.x) * ease(3, dt); cam.y += (my - cam.y) * ease(3, dt); view.z += (zt - view.z) * ease(2.2, dt); camF.x = B.x; camF.y = B.y; camF.w = 1;
    return;
  }
  if (B) { camF.x = B.x; camF.y = B.y; }
  const d = Math.hypot(camF.x - player.x, camF.y - player.y), near = clamp((1700 - d) / 800, 0, 1);
  camF.w += ((B ? near * near * (3 - 2 * near) : 0) - camF.w) * ease(1.4, dt);   // eases in and out: no snap when it spawns, dies or drops back
  const w = camF.w;
  let ox = player.vx * 0.5, oy = player.vy * 0.5, zt = zBase;   // look well ahead of where you're going
  if (w > 0.001) {
    ox += ((camF.x - player.x) / 2 - ox) * w; oy += ((camF.y - player.y) / 2 - oy) * w;   // lean toward the Bull...
    const lx = Math.max(Math.abs(player.vx * 0.4), 0.25 * VW / 2 / view.z), ly = Math.max(Math.abs(player.vy * 0.4), 0.25 * VH / 2 / view.z);
    ox = clamp(ox, -lx, lx); oy = clamp(oy, -ly, ly);   // ...only a little: you stay near the middle and still see the road
    const fit = Math.min(VW / 2 / (Math.max(Math.abs(ox), Math.abs(camF.x - player.x - ox)) + 150), VH / 2 / (Math.max(Math.abs(oy), Math.abs(camF.y - player.y - oy)) + 210));
    zt += (clamp(fit, ZOOM * 0.66, zBase) - zBase) * w;   // and pull back just enough to fit it, down to a floor
  }
  if (demo && !B && state === 'play') ({ ox, oy, zt } = demoCombatFrame(dt, ox, oy, zt));
  cam.x += (player.x + ox - cam.x) * ease(3.5, dt); cam.y += (player.y + oy - cam.y) * ease(3.5, dt);
  view.z += (zt - view.z) * ease(1.6, dt);
}
// The demo's road fight, framed: while a raider is on you (the nearest one engaging within ~520, kept while it stays
// within 650 so the frame doesn't hop between cars), the camera eases its look-ahead back and leans toward it, pulling
// out a little only if it must, so you, it and the hit stay between the top HUD and the controls with road still ahead.
// The play area comes from the real HUD and buttons, measured now and then.
const camSafeC = { t: -9, top: 0, bottom: 0 };
function camSafe() {
  const now = time;   // game time, so the same run frames the same way every time
  if (now - camSafeC.t > 0.5 || now < camSafeC.t || camSafeC.vh !== VH) {   // measured in play only, and only believed if it looks like a phone HUD (the card screen moves the loadout row)
    camSafeC.t = now; camSafeC.vh = VH; const r = id => $(id) && $(id).offsetParent ? $(id).getBoundingClientRect() : null, tops = ['top', 'trip', 'load'].map(r).filter(Boolean), btns = ['nitroBtn', 'pauseBtn'].map(r).filter(Boolean);
    const top = tops.length ? Math.max(...tops.map(b => b.bottom)) : 0, bottom = btns.length ? Math.min(...btns.map(b => b.top)) : 0, ok = state === 'play' && top > 0 && top < VH * 0.3 && bottom > VH * 0.6 && bottom <= VH;
    camSafeC.top = ok ? top : camSafeC.top || VH * 0.14; camSafeC.bottom = ok ? bottom : camSafeC.bottom || VH - 112;
  }
  return camSafeC;
}
function demoCombatFrame(dt, ox, oy, zt) {
  const near = (k, R) => k && !k.dead && !k.flee && Math.hypot(k.x - player.x, k.y - player.y) < R;
  let T = near(cam.threat, 650) ? cam.threat : null;
  if (!T) T = cars.filter(k => near(k, 520)).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
  cam.threat = T; cam.cw = (cam.cw || 0) + ((T ? 1 : 0) - (cam.cw || 0)) * ease(T ? 2.4 : 0.9, dt); const w = cam.cw;
  if (w < 0.01) return { ox, oy, zt };
  const S = camSafe(), mid = (S.top + S.bottom) / 2 - VH / 2;   // the play area's middle, from the screen's middle (px)
  const tx = T ? T.x - player.x : 0, ty = T ? T.y - player.y : 0;
  let fx = ox * (1 - 0.6 * w) + tx * 0.5 * w, fy = oy * (1 - 0.6 * w) + ty * 0.5 * w;   // less look-ahead, a lean toward the threat
  const halfH = (S.bottom - S.top) / 2 - 46, halfW = VW / 2 - 40;   // you and it, kept inside the area with a margin
  const need = Math.max(Math.abs(ty - fy), Math.abs(fy)) * zt, needX = Math.max(Math.abs(tx - fx), Math.abs(fx)) * zt;
  let z = zt; if (need > halfH) z = zt * halfH / need; if (needX > halfW) z = Math.min(z, zt * halfW / needX);
  z = clamp(z, ZOOM * 0.74, zt);
  return { ox: fx, oy: fy - mid / z * w, zt: zt + (z - zt) * w };   // centred on the play area, not on the screen
}

// ============ weather: dust storms and tumbleweeds on the wind ============
const WIND = { x: 1, y: 0.3 };
const stormHaze = () => state === 'play' || state === 'over' || state === 'pick' ? clamp((player.y - stormY + 250) / 400, 0, 1) : 0;   // 0 clear .. 1 deep in the storm
function updateWeather(dt) {
  if (state === 'play') {
  }
  tumbleT -= dt;
  if (tumbleT <= 0) { tumbleT = rand(2, 5) / (stormHaze() > 0.3 ? 4 : 1); tumbles.push({ x: cam.x - VW / 2 / view.z - 60, y: cam.y + rand(-0.5, 0.5) * VH / view.z, vx: rand(90, 160) * (stormHaze() > 0.3 ? 2 : 1), vy: rand(10, 50), a: 0, r: rand(14, 22), t: 0, bob: rand(0, TAU) }); }
  for (const w of tumbles) {
    w.t += dt; w.x += w.vx * dt; w.y += w.vy * dt + Math.sin(w.t * 6 + w.bob) * 20 * dt; w.a += w.vx / w.r * dt;
    for (const c of [player, ...cars]) if (Math.hypot(c.x - w.x, c.y - w.y) < c.r + w.r) { w.dead = true; for (let i = 0; i < 9; i++) { const a = crand(0, TAU), sp = crand(80, 220); parts.push({ k: 'twig', x: w.x, y: w.y, vx: Math.cos(a) * sp + c.vx * 0.3, vy: Math.sin(a) * sp + c.vy * 0.3, a: crand(0, TAU), spin: crand(-10, 10), t: 0, life: 0.8 }); } break; }
    if (w.t > 20) w.dead = true;
  }
  tumbles = tumbles.filter(w => !w.dead);
}

// ============ input: tap sides (both = nitro) or swipe ============
const touches = new Map();
cv.addEventListener('pointerdown', e => { e.preventDefault(); touches.set(e.pointerId, { x0: e.clientX, x: e.clientX, y: e.clientY, t0: performance.now() }); });
cv.addEventListener('pointermove', e => { const t = touches.get(e.pointerId); if (!t) return; t.x = e.clientX; t.y = e.clientY; const dx = t.x - t.x0; if (Math.abs(dx) > 90) t.x0 = t.x - Math.sign(dx) * 90; });
for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => touches.delete(e.pointerId));
const keys = {};
addEventListener('keydown', e => {
  keys[e.key] = true;
  if (state === 'pick' && '123'.includes(e.key)) { const b = $('cards').children[+e.key - 1]; if (b) choose(b.dataset.k); return; }
  if ((e.key === ' ' || e.key === 'Enter') && (state === 'menu' || state === 'over')) { if (demo) { if (state === 'over') demoRetry(); } else if ($('demoMenu').hidden) start(); } else if (e.key === 'ArrowUp') fireNitro();
});
addEventListener('keyup', e => { keys[e.key] = false; });
addEventListener('blur', () => { touches.clear(); for (const k in keys) keys[k] = false; });
function input() {
  if (keys.ArrowLeft || keys.ArrowRight) return (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  if (!touches.size) return 0;
  if (control === 'tap') {   // the newest touch steers, so a quick flick across never cancels itself out; both thumbs held a moment = nitro
    const list = [...touches.values()], L = list.filter(v => v.x < VW / 2), Rt = list.filter(v => v.x >= VW / 2), newest = list.reduce((a, b) => (b.t0 > a.t0 ? b : a));
    if (L.length && Rt.length) { const held = performance.now() - Math.max(Math.min(...L.map(v => v.t0)), Math.min(...Rt.map(v => v.t0))); if (held > 120) { if (held > 200) fireNitro(); return 0; } }   // both thumbs held: straight, then nitro
    return newest.x < VW / 2 ? -1 : 1;
  }
  const t = [...touches.values()][touches.size - 1], dx = t.x - t.x0;
  return Math.abs(dx) < 6 ? 0 : clamp(dx / 70, -1, 1);
}

// ============ update ============
function carHit(a, b, h) {   // two raiders touching: a crash if they meet hard enough, else a bump
  if ((a.guard && a.guard.of === b) || (b.guard && b.guard.of === a)) { bump(a, b, h); return; }
  if (a.T.light && b.T.light && !playerCause(a) && !playerCause(b)) { bump(a, b, h); return; }   // a pack jostles; it only piles up when you sent one into another   // a guard and its own Rig only ever bump
  const closing = -((a.vx - b.vx) * h.nx + (a.vy - b.vy) * h.ny), weak = a.pincer && b.pincer ? 40 : a.slideT > 0 || b.slideT > 0 ? 30 : a.frag > 0 || b.frag > 0 || a.mode === 'lunge' || b.mode === 'lunge' ? 60 : 130;
  if (closing > weak) {
    const headOn = closing > 380 && Math.abs(angDiff(a.a, b.a)) > 2.3;
    const yours = playerCause(a) || playerCause(b) || attackMissed(a) || attackMissed(b) || (a.pincer && b.pincer);   // you hit one of them, or one committed to you and missed: the pile-up is yours
    if (yours) { carryCause(a, b); carryCause(b, a); blame(a); blame(b); }
    if (a.pincer && b.pincer && state === 'play') { bounty('pincers'); addFury(0.7); gainXP(3 * furyXP()); gold += Math.round(6 * furyGold()); }   // they crushed each other
    for (const k of [a, b]) { if (!k.T.armour && !k.T.elite && yours) wreck(k, headOn ? 'HEAD-ON!' : 'PILE-UP!', 'trick', undefined, resolveWreckCause(k, 'raider', undefined, true)); else if (k.hitCD <= 0) { k.hitCD = 0.4; k.stun = Math.max(k.stun, 0.6); damage(k, yours ? (30 + closing * 0.08) * (k.slideT > 0 ? 3 : 1) : k.maxHp * 0.25, 'trick', undefined, undefined, undefined, !yours); } }
    if (!a.dead && !b.dead) bump(a, b, h);
    return;
  }
  bump(a, b, h);
}
function update(dt) {
  const hdt = runHeld() ? 0 : dt;   // the hazard clock: held while a card is up, so a warning seen under the card is still a full warning after it
  if (state === 'play') { time += dt; hintT = Math.max(0, hintT - dt); }
  const target = state === 'play' ? input() : state === 'menu' ? Math.sin(time * 0.7 + 1) * 0.9 : 0;
  steer += (target - steer) * Math.min(1, dt * 12);
  if (state === 'menu') time += dt;
  ensureChunks();

  // player
  nitroT = Math.max(0, nitroT - dt); player.rampage = Math.max(0, player.rampage - dt); player.ghostT2 = Math.max(0, player.ghostT2 - dt); player.harpT = Math.max(0, player.harpT - dt); hurtFlash = Math.max(0, hurtFlash - dt * 2.5); player.boostT = Math.max(0, player.boostT - dt);
  // slipstream: tuck in behind a car to draft, pull out to slingshot
  let drafting = false; const pv = Math.hypot(player.vx, player.vy);
  if (state === 'play' && pv > 200) { const fx = player.vx / pv, fy = player.vy / pv; for (const k of boss && !boss.dead ? [...cars, boss] : cars) { const rx = k.x - player.x, ry = k.y - player.y, lon = rx * fx + ry * fy, lat = Math.abs(-rx * fy + ry * fx); if (lon > 40 && lon < 230 && lat < 30) { drafting = true; break; } } }
  if (drafting) { player.draftC = (player.draftC || 0) + dt; if (cchance() < 0.6) { const o = crand(-30, 30), fx = player.vx / pv, fy = player.vy / pv; parts.push({ k: 'wind', x: player.x + fx * 70 - fy * o, y: player.y + fy * 70 + fx * o, a: Math.atan2(fy, fx), len: crand(50, 90), t: 0, life: 0.25 }); } }
  else { if ((player.draftC || 0) > 0.7 && state === 'play') { player.boostT = 0.9; player.boostMul = 1.25; SFX.boost(2); } player.draftC = 0; }
  const rx = roadX(player.y), onRoad = rx !== null && Math.abs(player.x - rx) < ROAD_W * 0.9;   // the old highway is faster than the sand
  player.onRoad = onRoad;
  if (state === 'play' && (!ptrail.length || time - ptrail[ptrail.length - 1].t > 0.08)) { ptrail.push({ x: player.x, y: player.y, t: time }); if (ptrail.length > 32) ptrail.shift(); }
  airTick(player, dt);
  const pRough = !player.air && onRough(player), pSand = !player.air && inSand(player), mulTarget = Math.max(nitroT > 0 ? player.boost : player.boostT > 0 ? player.boostMul : 1, drafting ? 1 + 0.12 * clamp(player.draftC / 0.6, 0, 1) : 1);
  player.mul += (mulTarget - player.mul) * ease(mulTarget > player.mul ? 6 : 2.5, dt);
  // drift physics: flick the steering at speed and the back end lets go (weight transfer); a hard held turn at speed loosens it too
  const pvNow = Math.hypot(player.vx, player.vy), speedK = clamp((pvNow - 200) / 220, 0, 1);
  player.flick = Math.max((player.flick || 0) * Math.exp(-2.2 * dt), Math.min(1, Math.abs(steer - (player.prevSteer ?? steer)) / Math.max(dt, 1e-4) / 7));
  player.prevSteer = steer;
  const looseGrip = 1 - 0.55 * player.flick * speedK - 0.18 * Math.abs(steer) * speedK;
  const slideN = nitroT > 0 && player.car === 'interceptor';   // the Interceptor's nitro is a wild powerslide; the others keep their grip
  drive(player, steer, dt, state === 'over' ? 0 : SPEED * player.spd * player.mul * (pSand ? 0.6 : 1) * (onRoad ? 1.15 : 0.9) * (1 - 0.05 * player.boarders.length), TURN * player.turn * (slideN ? 1.25 : 1) * (player.air ? 0.5 : 1), GRIP * player.grip * looseGrip * (pSand ? 0.6 : 1) * (pRough ? 0.68 : 1) * (slideN ? 0.5 : 1) * (player.air ? 0.03 : 1));
  if (pRough && state === 'play') { player.a += rand(-1, 1) * 0.9 * dt; player.vx *= 1 - 0.35 * dt; player.vy *= 1 - 0.35 * dt; if (grand() < 0.3) player.bounce = Math.max(player.bounce || 0, 0.4); }   // rocky ground: the wheel jumps in your hands   // in the air you keep your line
  if (state === 'play' && player.slip > 0.25 && Math.hypot(player.vx, player.vy) > 160) addNitro(0.2 * dt, 'drift');
  const ca = Math.cos(player.a), sa = Math.sin(player.a);
  player.turnRate = dt > 0 ? angDiff(player.prevA ?? player.a, player.a) / dt : 0; player.prevA = player.a;
  // drift boost: hold a drift to charge it (blue, orange, purple sparks), straighten out to fire it
  if (state === 'play' && player.slip > 0.3 && Math.hypot(player.vx, player.vy) > 160) player.driftC += dt * (nitroT > 0 ? 2 : 1);
  else if (player.slip < 0.15) {
    const tier = driftTier();
    if (tier && state === 'play') { player.boostT = 0.5 + 0.2 * tier; player.boostMul = 1 + [0, 0.15, 0.25, 0.35][tier]; SFX.boost(tier); onDriftRelease(tier); }   // letting go fires the DRIFT END weapons
    player.driftC = 0;
  }
  // drifting throws a rooster tail of sand from the rear wheels: cars caught in it go blind for a moment
  const drifting = state === 'play' && player.slip > 0.35 && Math.hypot(player.vx, player.vy) > 160;
  if (drifting) {
    const lat = -Math.sin(player.a) * player.vx + Math.cos(player.a) * player.vy, sprayA = player.a + Math.PI - Math.sign(lat) * 0.65;
    const rx = player.x - ca * 18 * player.size, ry = player.y - sa * 18 * player.size;
    for (let i = 0; i < 2; i++) { const a = sprayA + crand(-0.25, 0.25), sp = crand(240, 420); parts.push({ k: 'spray', x: rx, y: ry, vx: Math.cos(a) * sp + player.vx * 0.3, vy: Math.sin(a) * sp + player.vy * 0.3, t: 0, life: crand(0.35, 0.55), size: crand(6, 10) }); }
    const wide = player.car === 'sandviper';   // the Sandviper throws a wider, longer rooster tail
    for (const k of cars) { const dx = k.x - rx, dy = k.y - ry, dd = Math.hypot(dx, dy); if (dd < (wide ? 340 : 240) && Math.abs(angDiff(sprayA, Math.atan2(dy, dx))) < (wide ? 0.85 : 0.55)) { k.blindT = Math.max(k.blindT || 0, wide ? 1.8 : 1.1); blame(k, 2); } }
  }
  // a boarder on your roof siphons fuel and drags on the car; drift hard (or ram something, or land a jump) to throw him off.
  // He rides at most four seconds and leaves with what he took; shaken off, he drops it back as a can.
  if (player.boarders.length && state === 'play') {
    for (const b of player.boarders) { b.t += dt; b.hitT -= dt; if (b.hitT <= 0) { b.hitT = 1; const took = hurt(SIPHON, true, 'boarder') || 0; b.took = (b.took || 0) + took; if (took >= 0.5) leakFuel(took); } }   // the number is what he really took
    if (player.boarders[0].t > 4) boarderLeaves();
    player.shakeT = player.slip > 0.5 && Math.hypot(player.vx, player.vy) > 160 ? player.shakeT + dt : Math.max(0, player.shakeT - dt);
    if (player.shakeT > 0.35) { player.shakeT = 0; throwBoarder(); }
  }
  // drift combo: drifting builds points, faster close to enemies; chain drifts to raise the multiplier; it banks as XP and gold
  const dc = player.dc; dc.bankT = Math.max(0, dc.bankT - dt);
  if (drifting) {
    if (!dc.on) { dc.on = true; dc.chain = dc.pts > 0 ? Math.min(5, dc.chain + 1) : 1; }
    let near = 1e9; for (const k of cars) near = Math.min(near, Math.hypot(k.x - player.x, k.y - player.y)); if (boss && !boss.dead) near = Math.min(near, Math.hypot(boss.x - player.x, boss.y - player.y) - 30);
    dc.prox = near < 90 ? 3 : near < 160 ? 2 : 1; dc.idle = 0; dc.pts += dt * 60 * dc.prox * (1 + 0.5 * (dc.chain - 1));
  } else if (state === 'play') {
    dc.on = false; dc.idle += dt;
    if (dc.idle > 1.2 && dc.pts > 0) { bounty('combo', Math.round(dc.pts)); addFury(Math.min(0.5, dc.pts / 1500)); const gg = Math.round(Math.floor(dc.pts / 200) * furyGold()); gold += gg; score += Math.round(dc.pts) * fury.lv; dc.bank = ''; dc.bankT = 1; dc.pts = 0; dc.chain = 0; }
  }
  if (driftTier() && cchance() < 0.8) for (const sy of [-1, 1]) parts.push({ k: 'dspark', x: player.x - ca * 18 * player.size - sa * sy * 14 * player.size, y: player.y - sa * 18 * player.size + ca * sy * 14 * player.size, vx: -ca * 120 + crand(-90, 90), vy: -sa * 120 + crand(-90, 90), t: 0, life: 0.22, col: DRIFT_COL[driftTier()] });
  if (player.mul > 1.08 && cchance() < 0.7) parts.push({ k: 'flame', x: player.x - ca * 32 * player.size, y: player.y - sa * 32 * player.size, vx: -ca * 200 + crand(-30, 30), vy: -sa * 200 + crand(-30, 30), t: 0, life: 0.25 });
  if ((player.slip > 0.35 || player.mul > 1.08) && cchance() < 0.6) { const o = crand(-22, 22); parts.push({ k: 'speed', x: player.x - ca * 30 - sa * o, y: player.y - sa * 30 + ca * o, a: Math.atan2(player.vy, player.vx), len: crand(40, 80), t: 0, life: 0.22 }); }
  if (player.slip > 0.45 && cchance() < 0.5) parts.push({ k: 'dust', x: player.x - ca * 18, y: player.y - sa * 18, vx: crand(-20, 20), vy: crand(-20, 20), t: 0, life: 0.7, size: crand(9, 14) * player.size });
  if (nitroT > 0 && player.car === 'interceptor' && player.slip > 0.25 && state === 'play') { player.trailT = (player.trailT || 0) - dt; if (player.trailT <= 0) { player.trailT = 0.08; fires.push({ x: player.x - ca * 26, y: player.y - sa * 26, r: 22, t: 0, life: 1.2, mine: true, nitro: true, byYou: true }); } }   // nitro drift draws fire
  const hurtK = Math.min(1, (player.hits || 0) / 6);   // dents and smoke come from hits; a low tank only sputters
  if (hurtK > 0.4 && cchance() < dt * hurtK * 14) parts.push({ k: 'puff', x: player.x + ca * 16, y: player.y + sa * 16, vx: crand(-20, 20) - player.vx * 0.2, vy: crand(-50, -20) - player.vy * 0.2, t: 0, life: 0.9, size: crand(7, 11), dark: hurtK > 0.7 });
  player.inv = Math.max(0, player.inv - dt); player.contactInv = Math.max(0, (player.contactInv || 0) - dt);
  player.ghostT -= dt; if (player.ghostT <= 0) player.ghost += (player.hp - player.ghost) * ease(4, dt);
  if (player.hp > player.maxHp * 0.9) player.lost = 0;
  if (god && state === 'play' && player.ghostT < -2 && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 25 * dt); player.ghost = Math.max(player.ghost, player.hp); }
  if (!player.air) { const pimp = hitWorld(player); if (pimp > 250 && player.lastWall && player.lastWall.station) hitWall(player.lastWall, 1, true); if (pimp > 210 && player.lastWall && player.lastWall.block && !player.lastWall.gone) { destroyWall(player.lastWall); if (ev) ev.smashed = true; trick('SMASH!', player.x, player.y, 'trick'); } skid(player, pSand); }   // a roadblock goes down if you hit it hard enough
  rampCheck(player); bumpCheck(player);
  // harpoon tether: you're dragged toward the car; drift around and the car gets whipped
  if (tether) {
    tether.t -= dt; const k = tether.k;
    if (tether.t <= 0 || k.dead) tether = null;
    else { const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy) || 1, mine = tether.mine; if (mine) { blame(k, 1.5); markPlayerCause(k, 'ability'); } if (d > 110) { player.vx += dx / d * (mine ? 160 : 650) * dt; player.vy += dy / d * (mine ? 160 : 650) * dt; k.vx -= dx / d * (mine ? 1500 : 1100) * dt; k.vy -= dy / d * (mine ? 1500 : 1100) * dt; k.stun = Math.max(k.stun, 0.2); k.frag = Math.max(k.frag, mine ? 1.2 : 0.6); } }
  }
  if (state === 'play') weapons(dt);
  if (state === 'play' && demo) demoTick(dt);
  if (state === 'play' && depot) {   // the stage: drive to the fortress; near it the boss comes out; the tank drains all the way
    const dd = Math.hypot(depot.x - player.x, depot.y - player.y);
    stageEndCheck(dd);
    if (bullIn) { bullIn.t -= dt; if (bullIn.t <= 0) spawnBoss(...bossEntry(bullIn.ang), bullIn.kind); }
    if (depot.winT && time > depot.winT) { depot.winT = 0; stageCleared(); }
    burnFuel(dt); updateConvoys(); updateStorm(dt); updateRigGuards(dt);
  }
  updateIntro(dt); updateStageCard(dt);
  if (boss) updateBoss(demo && BOSS_KINDS[boss.kind] && BOSS_KINDS[boss.kind].weak ? hdt : dt);   // a demo boss's attack clock waits with the hazards while a card holds play
  if (state === 'play') { updateHazards(hdt); updateGadgets(dt); updateEvents(dt); updateSections(hdt); watchTips(); }
  updateTips(dt);
  if (banner) { banner.t += dt; if (banner.t > bannerEnd(banner)) banner = null; }
  for (const W of walls) if (W.shakeT > 0) W.shakeT -= dt;
  updateWeather(dt);
  updatePersons(dt);
  updateCamera(dt);

  // gang cars: chase where you're going; the ranged ones hang back
  const gangSpeed = SPEED * Math.min(1.24, 1.05 + time / 280);
  const travelA = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a;
  const pSpeed = Math.hypot(player.vx, player.vy), fwdX = Math.cos(travelA), fwdY = Math.sin(travelA), rgtX = -fwdY, rgtY = fwdX;
  let attackers = cars.filter(c => c.mode === 'tell' || c.mode === 'swipe' || c.mode === 'wind' || c.mode === 'lunge').length;
  if (state === 'play') {   // the walls and rocks you pass close by: a pursuer that hits one in the next seconds was led into it
    for (const W of walls) if (Math.abs(W.x + W.w / 2 - player.x) < W.w / 2 + 120 && Math.abs(W.y + W.h / 2 - player.y) < W.h / 2 + 120) lureTouch(W, clamp(player.x, W.x, W.x + W.w), clamp(player.y, W.y, W.y + W.h), 100);
    for (const q of posts) if (Math.abs(q.x - player.x) < 200 && Math.abs(q.y - player.y) < 200) lureTouch(q, q.x, q.y, q.r + 100);
  }
  // attack turns: the pack rides in formation round you and takes turns. One attack at a time at one or two stars, two at three
  // or four, three at five, with a breath between them. Every attack is announced (a flash and a red lane) before it lands.
  const maxAttackers = heat.lv <= 1 ? 1 : heat.lv <= 3 ? 2 : 3;
  if (state === 'play' && heat.lv >= 4 && time > boxCD && attackers === 0) {   // four stars and up: a box-in, one on each side and one ahead or behind, all at once
    const held = cars.filter(c => !c.dead && !c.flee && !c.guard && c.mode === 'hold' && !c.T.keep && !c.T.elite);
    const L = held.find(c => c.slot === 'L1' || c.slot === 'L2'), R = held.find(c => c.slot === 'R1' || c.slot === 'R2'), E = held.find(c => c.rear || c.front);
    if (L && R && E) {
      boxCD = time + 14; nextAttackT = time + 2.6; attackers += 3; SFX.horn();
      for (const c of [L, R]) { c.mode = 'tell'; c.modeT = -0.4; c.pincer = true; }
      if (E.rear) { E.mode = 'wind'; E.modeT = -0.2; E.aimA = Math.atan2(player.y - E.y, player.x - E.x); } else { E.mode = 'tell'; E.modeT = -0.4; }
      pops.push({ x: player.x, y: player.y - 70, text: 'BOXED IN!', col: '#ff5a46', t: 0 });
    }
  }
  for (const k of cars) {
    if (k.dead) continue;
    k.age += dt; k.stun = Math.max(0, k.stun - dt); k.frag = Math.max(0, k.frag - dt); k.slideT = Math.max(0, k.slideT - dt); k.hitCD -= dt; k.bumpCD -= dt; k.hurtT -= dt; k.burnT -= dt; k.blindT = Math.max(0, (k.blindT || 0) - dt); k.reloadT = Math.max(0, (k.reloadT || 0) - dt);
    const d = Math.hypot(player.x - k.x, player.y - k.y), lead = clamp(d / 600, 0, 0.6) * k.lead;
    noteAttack(k, !k.flee && (ATTACK_MODES.has(k.mode) || !!k.pincer));   // committed to you? and the moment that ends without landing: a dodge
    if (k.flee) { if (d > 450 && !inView(k.x, k.y, 160)) { k.dead = true; continue; } }
    else if (d > 1800 && state === 'play' && !k.T.convoy && !k.T.elite && !(demo && demo.proto)) { spawnCar(k.type, k); continue; }   // (the lab's crowd is a fixed budget: never re-sent)
    let want = Math.atan2(player.y + player.vy * lead - k.y, player.x + player.vx * lead - k.x);
    if (k.T.keep && d < k.T.keep && !(k.reloadT > 0)) want = Math.atan2(k.y - player.y, k.x - player.x) + 1.1;   // orbit at range (not while it reloads)
    // ride alongside: pull up beside you, match your speed, flash, then swipe in. Some ram trucks sit behind and rear-end you.
    let mSpeed = 1, mGrip = 1, speedAbs = null;
    if (k.flee) { const out = Math.sign((k.x - player.x) * rgtX + (k.y - player.y) * rgtY) || k.side; want = travelA + out * 0.5; speedAbs = Math.max(120, pSpeed * 0.6); }
    else if (k.guard) {   // a guard holds its flank of the War Rig: rides there, never attacks
      const R = k.guard.of;
      if (R.dead) k.flee = true;
      else { const [fx, fy] = rigFlank(R, k.guard.side), gd = Math.hypot(fx - k.x, fy - k.y); want = gd > 30 ? Math.atan2(fy - k.y, fx - k.x) : R.a; speedAbs = Math.hypot(R.vx, R.vy) + clamp(gd * 2.2, 0, 260); mGrip = 2; }
    }
    else if (k.T.light) {   // light fodder: the pack homes on you with a little lead and keeps a body apart from its own kind (no mode machinery)
      let sx = 0, sy = 0; for (const o of cars) { if (o === k || o.dead || !o.T.light) continue; const dx = k.x - o.x, dy = k.y - o.y, dd = dx * dx + dy * dy; if (dd < 2600 && dd > 0.01) { const w = 1 / Math.sqrt(dd); sx += dx * w; sy += dy * w; } }
      const ld = d < 240 ? 0 : lead, tx = player.x + player.vx * ld - k.x, ty = player.y + player.vy * ld - k.y, tl = Math.hypot(tx, ty) || 1; want = Math.atan2(ty / tl + sy * 0.7, tx / tl + sx * 0.7);   // close in, straight at you: no leading a car that turns on the spot
    }
    else if (k.blindT > 0 && state === 'play') {   // can't see: wanders and slows, any attack in progress is called off
      want = k.a + Math.sin(time * 2.3 + k.ph) * 0.7; speedAbs = Math.max(150, pSpeed * 0.7);
      if (k.mode === 'tell' || k.mode === 'swipe' || k.mode === 'wind' || k.mode === 'lunge' || k.mode === 'brake') { k.mode = 'flank'; k.modeT = 0; }
    }
    else if (!k.T.keep && state === 'play' && k.slideT <= 0 && k.stun <= 0) {
      k.modeT += dt;
      const lungeSp = gangSpeed * k.T.speed * 1.35, top = gangSpeed * k.T.speed;
      const rx = k.x - player.x, ry = k.y - player.y, lon = rx * fwdX + ry * fwdY, lat = rx * rgtX + ry * rgtY;
      if (k.mode === 'oncoming') {   // a war party coming head-on: straight at you, no swerving; once past you it turns and joins the pack
        want = Math.atan2(player.y - k.y, player.x - k.x); speedAbs = gangSpeed * k.T.speed * 1.15; mGrip = 2.2;
        if ((player.x - k.x) * Math.cos(k.a) + (player.y - k.y) * Math.sin(k.a) < -40 || k.modeT > 5) { k.mode = 'flank'; k.modeT = 0; }   // past you means you're behind its nose, whichever way you're facing
      } else if (k.mode === 'convoy') {   // the tanker makes for the depot and doesn't stop for you
        want = demo ? encConvoyWant(k) : depot ? Math.atan2(depot.y - k.y, depot.x - k.x) : k.a; speedAbs = SPEED * (demo ? ENC_CONVOY.speed : 0.8); mGrip = 3;
        if (k.escort && d < 300) { k.mode = 'flank'; k.modeT = 0; }   // a demo escort rides with its tanker till you close in
      } else if (k.mode === 'parked') {   // a roadblock guard sits across the road until you're close, then comes for you
        speedAbs = 0; want = k.a; if (d < 250) { k.mode = 'flank'; k.modeT = 0; }
      } else if (k.chaser) {   // a chaser hunts you down: faster than you on a straight, sloppier in the turns. Out-turn it and it hits what you dodged
        const chaseTop = gangSpeed * k.T.speed * 1.1 * (d > 900 ? 1.25 : 1);
        if (k.mode !== 'chase' && k.mode !== 'ram' && k.mode !== 'peel') { k.mode = 'chase'; k.modeT = 0; }
        if (k.mode === 'chase') {   // aims where you'll be; a cutter aims far ahead to meet you head-on
          const ld = clamp(d / 650, 0, 0.6) * (k.cut ? 1.6 : 0.5 + k.lead), ax = player.x + player.vx * ld + rgtX * k.lane, ay = player.y + player.vy * ld + rgtY * k.lane;
          want = Math.atan2(ay - k.y, ax - k.x); speedAbs = chaseTop; mGrip = 0.8;
          if (d < 130 && time > (k.ramCD || 0) && attackers < maxAttackers) { k.mode = 'ram'; k.modeT = 0; k.hitYou = false; attackers++; SFX.lunge(); }
        } else if (k.mode === 'ram') {   // commits: dead at you
          want = Math.atan2(player.y + player.vy * 0.08 - k.y, player.x + player.vx * 0.08 - k.x); speedAbs = Math.max(chaseTop, pSpeed * 1.2 + 80); mGrip = 1.5;
          if (k.modeT > 0.6 || k.hitYou) { k.mode = 'peel'; k.modeT = 0; k.ramCD = time + rand(0.9, 1.8); }
        } else {   // peels off after a hit or a miss, then comes again
          want = travelA + k.side * 0.55; speedAbs = pSpeed * 0.92;
          if (k.modeT > 0.5) { k.mode = 'chase'; k.modeT = 0; if (grand() < 0.3) k.lane = rand(-70, 70); }
        }
      } else {
        if (!k.slot && grand() < dt * 2) { k.slot = freeSlot(k.type); if (k.slot) setSlot(k); }
        if (k.mode === 'flank' || k.mode === 'hold') {
          const sLat = k.side * k.slotLat, gapLon = k.slotLon - lon, gapLat = sLat - lat;
          const tx = player.x + fwdX * (k.slotLon + pSpeed * 0.3) + rgtX * sLat, ty = player.y + fwdY * (k.slotLon + pSpeed * 0.3) + rgtY * sLat;
          want = Math.abs(gapLon) < 120 && Math.abs(gapLat) < 120 ? travelA + clamp(gapLat * 0.012, -0.45, 0.45) : Math.atan2(ty - k.y, tx - k.x);
          speedAbs = clamp(pSpeed + gapLon * 1.8, 120, top * (gapLon > 300 ? 1.75 : 1.3));   // they close in fast, then ride beside you
          for (const o of cars) { if (o === k || o.dead) continue; const ox = o.x - k.x, oy = o.y - k.y, ol = ox * Math.cos(k.a) + oy * Math.sin(k.a); if (ol > 0 && ol < 90 && Math.abs(-ox * Math.sin(k.a) + oy * Math.cos(k.a)) < 34) { speedAbs = Math.min(speedAbs, Math.hypot(o.vx, o.vy) * 0.95); break; } }   // don't rear-end your own
          const inSlot = Math.abs(gapLon) < 80 && Math.abs(gapLat) < 55, inReach = d < 300 && pSpeed > 120;
          k.readyT = inReach ? (k.readyT || 0) + dt : 0;   // close enough to strike: waiting for its turn
          if (k.mode === 'flank' && inSlot) { k.mode = 'hold'; k.modeT = 0; }
          else if (k.mode === 'hold' && (Math.abs(gapLon) > 150 || Math.abs(gapLat) > 110) && k.modeT > 0.6) { k.mode = 'flank'; k.modeT = 0; }
          else if (inReach && k.readyT > k.wait && attackers < maxAttackers && time > nextAttackT) {   // its turn: a car within reach strikes, from wherever it is
            attackers++; k.modeT = 0; SFX.rev(); nextAttackT = time + rand(0.6, 1.2) * (heat.lv >= 4 ? 0.7 : 1);
            const mate = !k.rear && !k.front && !k.T.vault && time > pincerCD && attackers < maxAttackers ? cars.find(o => {   // someone on your other side, near their slot
              if (o === k || o.dead || o.flee || o.guard || o.T.vault || o.T.keep || (o.mode !== 'hold' && o.mode !== 'flank')) return false;
              const ox = o.x - player.x, oy = o.y - player.y, olon = ox * fwdX + oy * fwdY, olat = (ox * rgtX + oy * rgtY) * -k.side;
              return olat > 40 && olat < 230 && Math.abs(olon - lon) < 170;
            }) : null;
            if (mate && grand() < 0.75) {   // a pincer: two of them squeeze you from both sides at once; slip out and they meet
              for (const c of [k, mate]) { c.mode = 'tell'; c.modeT = -0.3; c.pincer = true; c.side = c === k ? k.side : -k.side; } attackers++; pincerCD = time + 6;
              pops.push({ x: player.x, y: player.y - 60, text: 'PINCER!', col: '#ff5a46', t: 0 }); SFX.rev();
            }
            else if (k.T.vault && k.crew > 0) { k.mode = 'pole'; k.poleSide = -k.side; }   // a pole-cat leans its pole over you
            else if (k.rear || (lon < -70 && Math.abs(lat) < 100)) { k.mode = 'wind'; k.aimA = Math.atan2(player.y - k.y, player.x - k.x); } else k.mode = 'tell';   // behind you it charges; beside you it swipes
          }
        } else if (k.mode === 'tell') {   // flashes and twitches: the swipe is coming
          want = travelA - k.side * 0.12 + Math.sin(k.modeT * 40) * 0.05; speedAbs = pSpeed;
          if (k.modeT > (k.pincer ? 0.8 : (k.kind === 'ram' ? 0.65 : 0.55) + (heat.lv <= 2 ? 0.15 : 0))) { k.mode = k.front ? 'brake' : 'swipe'; k.modeT = 0; k.hitYou = false; SFX.lunge(); }
        } else if (k.mode === 'swipe') {   // swerves into you
          want = Math.atan2(player.y + player.vy * 0.12 - k.y, player.x + player.vx * 0.12 - k.x); speedAbs = pSpeed * 1.1 + 70; mGrip = 1.7;
          if (k.modeT > 0.5 || k.hitYou) { k.mode = 'peel'; k.modeT = 0; }
        } else if (k.mode === 'brake') {   // a blocker ahead stamps on the brakes: swerve round it or ram it
          want = travelA; speedAbs = pSpeed * 0.45; mGrip = 3;
          if (k.modeT > 0.7) { k.mode = 'peel'; k.modeT = 0; }
        } else if (k.mode === 'pole') {   // the pole sways over to you, then its rider lets go and lands on your roof
          want = travelA + clamp((k.side * k.slotLat - lat) * 0.012, -0.45, 0.45); speedAbs = pSpeed + clamp(-lon * 1.5, -120, 120);
          if (k.modeT > 0.8) {
            if (d < 200 && k.crew > 0 && !player.boarders.length && !player.air && state === 'play') { k.crew--; k.hitYou = true; player.boarders.push({ t: 0, ph: rand(0, TAU), hitT: 0.6, took: 0 }); pops.push({ x: player.x, y: player.y - 50, text: 'BOARDED!', col: '#ff5a46', t: 0 }); SFX.whoosh(); hint('HE\'S STEALING FUEL · DRIFT HARD TO SHAKE HIM OFF', 4.2); }
            k.mode = 'peel'; k.modeT = 0; k.wait = rand(4, 6);
          }
        } else if (k.mode === 'peel') {   // pulls away and drops back, then lines up again
          want = travelA + k.side * 0.45; speedAbs = pSpeed * 0.85;
          if (k.modeT > 0.8) { k.mode = 'flank'; k.modeT = 0; k.wait = rand(0.3, 0.9); k.pincer = false; }
          if (k.front) want = travelA + Math.sin(time * 3 + k.ph) * 0.3;   // a blocker weaves instead of peeling off
        } else if (k.mode === 'wind') {   // a ram truck behind you revs up...
          if (k.modeT < k.T.wind - 0.2) { const lt = d / lungeSp * 0.8; k.aimA = Math.atan2(player.y + player.vy * lt - k.y, player.x + player.vx * lt - k.x); }
          k.a += clamp(angDiff(k.a, k.aimA), -6 * dt, 6 * dt); want = k.a; speedAbs = pSpeed * 0.75; mGrip = 2;
          if (cchance() < 0.5) parts.push({ k: 'dust', x: k.x - Math.cos(k.a) * 20, y: k.y - Math.sin(k.a) * 20, vx: crand(-40, 40) - Math.cos(k.a) * 60, vy: crand(-40, 40) - Math.sin(k.a) * 60, t: 0, life: 0.5, size: crand(7, 11) });
          if (k.modeT >= k.T.wind) { k.mode = 'lunge'; k.modeT = 0; k.a = k.aimA; k.vx = Math.cos(k.a) * lungeSp * 0.8; k.vy = Math.sin(k.a) * lungeSp * 0.8; k.minD = d; k.oled = false; k.hitYou = false; SFX.lunge(); }
        } else if (k.mode === 'lunge') {   // ...and rams you from behind
          want = k.a; speedAbs = Math.max(lungeSp, pSpeed * 1.35); mGrip = 2.5; k.minD = Math.min(k.minD, d);
          if (cchance() < 0.5) { const o = crand(-14, 14); parts.push({ k: 'speed', x: k.x - Math.cos(k.a) * 26 - Math.sin(k.a) * o, y: k.y - Math.sin(k.a) * 26 + Math.cos(k.a) * o, a: k.a, len: crand(40, 70), t: 0, life: 0.2 }); }
          if (!k.oled && !k.hitYou && k.modeT > 0.1 && k.minD < k.r + player.r + 45 && d > k.minD + 50) { k.oled = true; k.close = false; ole(k); }
          if (k.modeT >= k.T.lunge) { k.mode = 'recover'; k.modeT = 0; }
        } else {
          mSpeed = 0.6;
          if (k.modeT > 1) { k.mode = 'flank'; k.modeT = 0; k.wait = rand(0.7, 1.8); }
        }
      }
    }
    if (k.stun > 0 || k.slideT > 0) want = k.a;
    let s = clamp(angDiff(k.a, want) * 3, -1, 1), dodging = false;
    const look = (k.chaser ? 55 + Math.hypot(k.vx, k.vy) * 0.16 : 60 + Math.hypot(k.vx, k.vy) * 0.25) * k.skill * k.size, ahead = o => blocked(k.x + Math.cos(k.a + o) * look, k.y + Math.sin(k.a + o) * look, 18);   // chasers have eyes only for you
    if (k.stun <= 0 && k.slideT <= 0 && k.mode !== 'lunge' && k.mode !== 'wind' && k.mode !== 'swipe' && k.mode !== 'ram' && k.mode !== 'oncoming' && ahead(0)) { const l = ahead(-0.6), r = ahead(0.6); s = !l && r ? -1 : l && !r ? 1 : s < 0 ? -1 : 1; dodging = true; }
    if (k.slideT > 0 || k.mode === 'lunge' || k.mode === 'wind') s = 0;
    airTick(k, dt);
    const soft = !k.air && inSand(k), oil = !k.air && oils.find(o => Math.hypot(k.x - o.x, k.y - o.y) < o.r), rub = rubble.find(r => Math.hypot(k.x - r.x, k.y - r.y) < r.r);
    if (oil && !k.spun.has(oil) && state === 'play') {   // oil: no steering for 1.5 s, slides straight, wrecks on any hit
      k.spun.add(oil); k.slideT = 1.5; k.a += rand(0.6, 1.2) * (grand() < 0.5 ? -1 : 1);
    }
    if (rub && !k.T.armour && grand() < dt * 3) { k.a += rand(-0.6, 0.6); k.frag = Math.max(k.frag, 0.5); }
    const slow = (soft ? 0.6 : 1) * (rub ? 0.6 : 1) * (k.stun > 0 ? 0.65 : 1) * (k.T.keep && d < k.T.keep * 0.8 ? 0.7 : 1) * (k.reloadT > 0 ? 0.45 : 1);
    const spd = (speedAbs !== null ? speedAbs : (state === 'over' ? 0.6 : 1) * gangSpeed * k.T.speed * (d > 950 && k.mode !== 'lunge' ? 1.3 : 1) * mSpeed) * (dodging ? 0.82 : 1);
    drive(k, s, dt, spd * slow, k.T.turn, k.T.grip * (soft || rub ? 0.6 : 1) * (k.slideT > 0 ? 0.12 : mGrip) * (k.air ? 0.03 : 1));
    if (Math.abs(k.w || 0) > 2.5) { k.slideT = Math.max(k.slideT, 0.3); k.frag = Math.max(k.frag, 0.6); }   // spinning: no control
    rampCheck(k); bumpCheck(k);
    if (!k.air && onRough(k)) { k.a += rand(-1, 1) * 1.2 * dt; k.vx *= 1 - 0.4 * dt; k.vy *= 1 - 0.4 * dt; }
    if (state === 'play' && !k.flee && !(k.blindT > 0) && !runHeld() && !k.T.light) updateGangWeapons(k, dt, d);   // not under a card
    const imp = k.air ? 0 : hitWorld(k), fragile = k.frag > 0 || k.slideT > 0 || k.mode === 'lunge' || k.mode === 'ram', hunting = !k.flee && d < 700;
    if (imp > 150 && k.age > 1) { if (k.crew) ejectCrew(k, 1); if (grand() < 0.5) snapFlag(k); }
    if (imp > (k.slideT > 0 ? 40 : fragile ? 100 : hunting ? 150 : 190) && k.age > 1) {
      if (!k.T.armour && !k.T.elite && (k.T.light ? k.blameT > time || playerCause(k) || skimmed(k) : fragile || hunting || k.blameT > time)) wreck(k, crashWord(k), 'trick', undefined, resolveWreckCause(k, 'wall', k.lastWall || k.lastPost));   // (a scrap bike wrecks on rock only when you sent it there)
      else if (k.T.light) { if (k.hitCD <= 0) { k.hitCD = 0.5; k.stun = Math.max(k.stun, 0.6); } }   // its own bump: it bounces off, dazed, and comes again
      else if (!k.T.armour && !k.T.elite) { if (k.hitCD <= 0) { k.hitCD = 0.5; k.stun = Math.max(k.stun, 1); k.slideT = Math.max(k.slideT, 0.3); damage(k, k.maxHp * 0.35, 'trick', undefined, undefined, undefined, true); } }   // its own mistake: dented and dazed
      else if (k.T.elite && k.hitCD <= 0 && imp > 120) { k.hitCD = 0.6; k.stun = 2.2; blame(k); if (k.mode === 'lunge') { damage(k, PIP, 'trick', undefined, k.x, k.y, true); dropGem(k.x, k.y, -10); SFX.clang(); pops.push({ x: k.x, y: k.y - 60, text: 'CRASHED! HIT IT NOW', col: '#5be37d', t: 0, small: 1 }); } if (k.lastWall) hitWall(k.lastWall, 1); }   // a boss that charges into the scenery: dazed (open to any hit), one segment, and it spills fuel
      else if (k.hitCD <= 0) { k.hitCD = 0.4; const big = k.kind === 'ram' && imp > 130; damage(k, (22 + imp * 0.1 + (big ? 35 : 0)) * (k.slideT > 0 ? 3 : 1) * (k.frag > 0 ? 1.5 : 1), 'trick', 'KRUNCH!'); if (big) { k.stun = 1.5; SFX.clang(); if (k.lastWall) hitWall(k.lastWall, 1); } }
    }
    for (const b of drums) if (!b.gone && circleCircle(k, b)) { if (playerCause(k)) b.byYou = true; drumBoom(b); }   // a raider you sent into a drum: its blast is yours
    if (k.burnT <= 0 && !k.T.elite) for (const f of fires) if (Math.hypot(k.x - f.x, k.y - f.y) < f.r + k.r * 0.5) { if (f.geyser && !k.T.armour) { wreck(k, 'ERUPTED!', 'trick', undefined, resolveWreckCause(k, 'geyser', f.lureKey)); break; } k.burnT = 0.25; damage(k, f.nitro ? 14 : f.mine ? 6 + 3 * up.flame : 10, f.mine && !f.nitro ? 'flame' : 'trick', 'TOASTED!', undefined, undefined, undefined, resolveWreckCause(k, f.geyser ? 'geyser' : f.mine || f.nitro ? 'ability' : 'fire', f.lureKey, f.byYou || (f.chain !== undefined && k.cause && k.cause.chainId === f.chain))); break; }   // a geyser's pool takes raiders outright
    if (k.hp < k.maxHp * 0.5 && cchance() < dt * 5) parts.push({ k: 'puff', x: k.x, y: k.y, vx: crand(-20, 20), vy: crand(-50, -20), t: 0, life: 0.8, size: crand(6, 10), dark: k.hp < k.maxHp * 0.25 });
    for (const st of strips) if (!st.hit.has(k)) {
      const c = Math.cos(st.a), sn = Math.sin(st.a), dx = k.x - st.x, dy = k.y - st.y, u = clamp(dx * c + dy * sn, -st.len / 2, st.len / 2);
      if (Math.hypot(dx - u * c, dy - u * sn) < k.r + 6) { st.hit.add(k); k.slideT = Math.max(k.slideT, 1.2); k.a += rand(-1, 1); damage(k, st.dmg, 'caltrops', 'POP!'); }
    }
    for (const B of balls) if (Math.hypot(k.x - B.x, k.y - B.y) < B.r + k.r) { if (Math.hypot(B.vx, B.vy) > 150) { if (k.T.elite) damage(k, PIP, 'trick'); else if (k.T.armour) damage(k, 150, 'trick', 'SMASH!'); else wreck(k, 'SMASH!', 'trick', undefined, resolveWreckCause(k, 'ball', B)); } }
    skid(k, soft);
  }
  for (const b of drums) {
    if (b.gone) continue;
    if (b.fuse > 0) { b.fuse -= hdt; if (b.fuse <= 0) drumBoom(b); }
    else if (circleCircle(player, b) && Math.hypot(player.vx, player.vy) > 120) { b.fuse = 0.35; b.byYou = true; SFX.clang(); }   // your hit lights it: it blows behind you, on whoever is chasing
    else { const h = circleCircle(player, b); if (h) { player.x += h.nx * h.pen; player.y += h.ny * h.pen; } }
    lureTouch(b, b.x, b.y, b.r + 70);   // skim it and the one behind you may not
  }
  // wrecking balls swing on their cranes
  for (const B of balls) {
    const ang = B.amp * Math.sin((time - (B.held || 0)) * B.w + B.ph), L = Math.hypot(B.dx, B.dy) || 1, ux = B.dx / L, uy = B.dy / L; if (hdt === 0) B.held = (B.held || 0) + dt;   // the swing stands still under a card
    const nx = B.px + (ux * Math.cos(ang) - uy * Math.sin(ang)) * B.L, ny = B.py + (uy * Math.cos(ang) + ux * Math.sin(ang)) * B.L;
    B.vx = (nx - B.x) / Math.max(dt, 1e-4); B.vy = (ny - B.y) / Math.max(dt, 1e-4); B.x = nx; B.y = ny;
    lureTouch(B, B.px, B.py, B.L + B.r + 70, B.L - B.r - 70);   // its swing path is the warning: cross it while the ball is away, and the one behind you meets it
    if (Math.hypot(player.x - B.x, player.y - B.y) < B.r + player.r && Math.hypot(B.vx, B.vy) > 150 && player.inv <= 0) { hurt(8, false, 'ball'); player.vx += B.vx * 0.8; player.vy += B.vy * 0.8; }
    if (boss && !boss.dead && (B.cd || 0) < time && bossPoints().some(p => Math.hypot(p.x - B.x, p.y - B.y) < p.r + B.r)) { B.cd = time + 1; damageBoss(boss.maxHp * 0.06, 'trick', B.x, B.y, 'SMASH!'); boom(B.x, B.y, 'SMASH!', 0.8); if (boss && !boss.dead) stunBoss(1.4, false); }
  }
  // harpoons and bombs in flight
  for (const h of harpoons) {
    h.t += hdt; h.x += h.vx * hdt; h.y += h.vy * hdt;
    if (h.mine) {   // your harpoon: hook a car (then drift to swing it), or yank the Bull off its charge
      for (const k of cars) if (!k.dead && Math.hypot(h.x - k.x, h.y - k.y) < k.r + 10) { h.dead = true; tether = { k, t: 3, mine: true }; k.frag = 1.5; markPlayerCause(k, 'ability'); pops.push({ x: k.x, y: k.y - 44, text: 'HOOKED!', col: '#7fd6ff', t: 0 }); SFX.clang(); break; }
      if (!h.dead && boss && !boss.dead && bossPoints().some(p => Math.hypot(h.x - p.x, h.y - p.y) < p.r + 10)) { h.dead = true; damageBoss(boss.maxHp * 0.03, 'trick', h.x, h.y); if (boss.state === 'charge' || boss.state === 'wind') { stunBoss(1, false); pops.push({ x: boss.x, y: boss.y - 70, text: 'YANKED!', col: '#7fd6ff', t: 0 }); } SFX.clang(); }
      if (!h.dead && (h.t > 0.5 || blocked(h.x, h.y, 3))) h.dead = true;
    }
    else if (Math.hypot(h.x - player.x, h.y - player.y) < player.r + 8 && state === 'play') { h.dead = true; if (!h.owner.dead) { tether = { k: h.owner, t: 1.2 }; hurt(5, true, 'impact'); pops.push({ x: player.x, y: player.y - 44, text: 'HOOKED!', col: '#2fa6a6', t: 0 }); SFX.twang(); } }
    else if (h.t > 0.6 || blocked(h.x, h.y, 3)) h.dead = true;
  }
  harpoons = harpoons.filter(h => !h.dead);
  for (const b of bombs) {
    b.t += hdt;
    if (b.t >= b.T) { b.dead = true; fires.push({ x: b.tx, y: b.ty, r: b.lance || b.shell ? 55 : 70, t: 0, life: b.shell ? 1 : b.lance ? 1.6 : 3 }); smallBoom(b.tx, b.ty, 90); if ((b.lance || b.shell) && Math.hypot(player.x - b.tx, player.y - b.ty) < 78) hurt(b.dmg || 10, false, b.src || (b.shell || b.lance ? 'boss' : 'impact')); }   // thunder-sticks and shells hit hard where they land
  }
  bombs = bombs.filter(b => !b.dead);
  for (const f of fires) { f.t += dt; if (cchance() < (f.mine ? 0.12 : 0.5)) parts.push({ k: f.mine ? 'ember' : 'fire', x: f.x + crand(-f.r, f.r) * 0.7, y: f.y + crand(-f.r, f.r) * 0.7, vx: crand(-15, 15), vy: crand(-50, -15), t: 0, life: crand(0.3, 0.6), size: crand(8, 14) }); }
  fires = fires.filter(f => f.t < f.life);
  player.burnT -= dt; if (player.burnT <= 0 && fires.some(f => !f.mine && Math.hypot(player.x - f.x, player.y - f.y) < f.r)) { player.burnT = 0.5; hurt(2.5, true, 'fire'); }
  for (const st of strips) st.t += dt; strips = strips.filter(s => s.t < s.life);
  for (const r of rubble) r.t += dt; rubble = rubble.filter(r => r.t < r.life);
  // car vs car: a fragile car goes up on a lighter hit; armour shrugs off a little more
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j]; if (a.dead || b.dead || a.air || b.air) continue;
    const h = circleCircle(a, b); if (h) carHit(a, b, h);
  }
  // tail whip: while you drift, your back end swings out and hits like a hammer (a contact point at the rear of the car)
  const whipping = state === 'play' && !player.air && player.slip > 0.35 && Math.hypot(player.vx, player.vy) > 160;
  if (whipping) {
    const latV = -Math.sin(player.a) * player.vx + Math.cos(player.a) * player.vy, out = Math.sign(latV) || 1;   // the tail kicks out the way you're sliding
    const rear = { x: player.x - Math.cos(player.a) * 22 * player.size - Math.sin(player.a) * out * 12, y: player.y - Math.sin(player.a) * 22 * player.size + Math.cos(player.a) * out * 12, r: 20 * player.size };
    for (const k of cars) {
      if (k.dead || (k.whipCD || 0) > time) continue;
      const h = circleCircle(k, rear); if (!h) continue;   // h points from your rear to the car
      k.x += h.nx * h.pen; k.y += h.ny * h.pen; whipCar(k, h.nx, h.ny, rear.x + h.nx * rear.r, rear.y + h.ny * rear.r);
    }
  }
  // you vs gang cars: side-on = shove, nose-first with spikes = shred, them ramming you = it hurts (and crushes them if you're a monster)
  for (const k of cars) {
    if (k.dead) continue;
    const d = Math.hypot(k.x - player.x, k.y - player.y), h = player.ghostT2 > 0 || player.air || k.air ? null : circleCircle(k, player);   // overdrive: you ghost through them
    if (h && player.rampage > 0 && state === 'play' && !k.stageBoss) { blame(k); wreck(k, 'FLATTENED!', 'trick', undefined, resolveWreckCause(k, 'ability', undefined, true)); continue; }   // rampage: any raider you touch is wrecked; a stage boss keeps its rules (below)
    if (h) {
      k.touched = true; const tm = k.m + player.m; k.x += h.nx * h.pen * player.m / tm; k.y += h.ny * h.pen * player.m / tm; player.x -= h.nx * h.pen * k.m / tm; player.y -= h.ny * h.pen * k.m / tm;
      const cx = player.x + h.nx * player.r, cy = player.y + h.ny * player.r, vt = Math.abs((k.vx - player.vx) * -h.ny + (k.vy - player.vy) * h.nx);
      if (vt > 60 && state === 'play') {   // trading paint: sparks along the seam
        parts.push({ k: 'spark', x: cx, y: cy, vx: -(k.vx + player.vx) * 0.15 + crand(-120, 120), vy: -(k.vy + player.vy) * 0.15 + crand(-120, 120), t: 0, life: 0.25 }); SFX.grind();
        k.grindT = (k.grindT || 0) - dt; if (k.grindT <= 0) { k.grindT = 0.3; blame(k, 1.5); if (!k.stageBoss) damage(k, 4, 'trick', undefined, undefined, undefined, true); }   // paint, not armour: a boss only loses segments to accepted hits
      }
      if (k.bumpCD <= 0 && state === 'play') {
        const lunged = k.mode === 'lunge';   // judged before the reset below: a lunge that lands is an attack (the campaign keeps its old reading; see docs/fuel-demo/progress.md)
        k.bumpCD = 0.35; k.hitYou = true; if (k.mode === 'lunge' || k.mode === 'wind') { k.mode = 'recover'; k.modeT = 0; }
        // the hit, by one rule you can see: your nose is your weapon; their attacks, landed on your side or back, leak fuel
        const pInR = player.vx * h.nx + player.vy * h.ny, kInR = -(k.vx * h.nx + k.vy * h.ny), closing = pInR + kInR;
        const pIn = Math.max(0, pInR), kIn = Math.max(0, kInR), share = pIn / (pIn + kIn + 1e-6);
        const fork = demo ? eqFork() : null, toK = Math.atan2(k.y - player.y, k.x - player.x), nose = Math.abs(angDiff(player.a, toK)) < (fork ? fork.arc : 0.8), back = Math.abs(angDiff(player.a + Math.PI, toK)) < 0.9, flank = !nose && !back;   // where on your car it landed
        const fromP = Math.abs(angDiff(k.a, Math.atan2(player.y - k.y, player.x - k.x))), itsNose = fromP < 0.8, itsSide = fromP >= 0.8 && fromP <= 2.35;   // and where on theirs
        const attack = (k.T.light && !nose) || (demo && lunged) || k.mode === 'swipe' || k.mode === 'lunge' || k.mode === 'ram' || k.mode === 'brake' || k.mode === 'oncoming' || k.pincer || (k.T.elite && kIn > 160);
        const ramK = 1, src = 'trick', hubK = 1;
        k.hitVX = h.nx; k.hitVY = h.ny; k.hitT = time + 0.4;   // a wreck flies along the hit
        const knock = f => { k.vx += h.nx * f; k.vy += h.ny * f; k.stun = Math.max(k.stun, 0.7); k.frag = Math.max(k.frag, 1.1); spinHit(k, cx, cy, h.nx * f * k.m, h.ny * f * k.m, PIT_K * 1.5); player.vx -= h.nx * pIn * 0.2 * k.m / player.m; player.vy -= h.ny * pIn * 0.2 * k.m / player.m; };
        const pSide = -(player.x - k.x) * Math.sin(k.a) + (player.y - k.y) * Math.cos(k.a) < 0 ? -1 : 1, guarded = k.stageBoss && k.type === 'rig' && itsSide && !rigSideOpen(k, pSide);   // which of its sides you're on, and whether a guard holds it
        const bossRule = k.stageBoss ? (k.type === 'rig' ? (itsSide && !guarded) || k.stun > 0 : true) : true;   // the War Rig's nose is armoured: its open sides, or anywhere while it's dazed
        if (player.rampage > 0) {   // the Juggernaut's rampage on a stage boss: one capped hit a second, where the boss allows it
          if ((k.bossHitCD || 0) <= time) { k.bossHitCD = time + 1; if (bossRule) hitRaider(k, 2, 'RAMPAGE', cx, cy); else clangOn(k, guarded); knock(300); }
          continue;
        }
        if (nitroT > 0 && pIn > 60) {   // on nitro you're a missile: three hits
          if (bossRule) hitRaider(k, 3, 'NITRO RAM', cx, cy); else clangOn(k, guarded);
          knock(420); SFX.slice(); if (closing > 200) freeze = Math.max(freeze, 0.04);
        }
        else if (whipping && (k.whipCD || 0) <= time && !(k.T.light && !back)) { if (bossRule) whipCar(k, h.nx, h.ny, cx, cy); else { clangOn(k, guarded); knock(200); } }   // drifting sideways into them: your tail hits for two (a scrap bike only counts as whipped at your tail: a drift doesn't shield your sides)
        else if (nose && (k.T.light ? pIn > 60 && share >= 0.2 : pIn > 110 && share >= 0.35)) {   // your ram: one hit, two into their side (light fodder breaks on a lighter touch)
          if (bossRule) hitRaider(k, (itsSide ? 2 : 1) + (fork ? fork.pips : 0), itsSide ? 'SIDE HIT' : 'HIT', cx, cy); else clangOn(k, guarded);   // forks: the same ram, more pips
          if (fork) eqAct('forks');
          knock((pIn * 1.4 + 160) * (fork ? fork.shove : 1)); shoves++; SFX.shove(); if (pIn > 220 && k.crew) ejectCrew(k, 1);
          if (closing > 200 && !k.dead) { freeze = Math.max(freeze, 0.03); shake = Math.max(shake, 3 * (calmMotion ? 0.3 : 1)); }
          if (attack && itsNose && kIn > 120) hurt(k.T.leak * 0.5 * (fork ? 1 - fork.guard : 1), false, k.stageBoss ? 'boss' : 'impact');   // nose to nose with one that was attacking: you both feel it
        }
        else if (attack && kIn > 60) {   // it got you: the leak (a rear shield takes some of it)
          const n = demo ? eqShieldTake(k.T.leak, k.x, k.y) : k.T.leak; if (n > 0) hurt(n, false, k.stageBoss ? 'boss' : 'impact');
          const kb = 150 * Math.min(2, player.m / k.m); k.vx += h.nx * kb; k.vy += h.ny * kb; k.stun = 0.8;
          player.vx -= h.nx * kIn * 0.5 * k.m / player.m; player.vy -= h.ny * kIn * 0.5 * k.m / player.m;   // a heavy rammer shoves you
          spinHit(player, cx, cy, -h.nx * kIn * 0.5 * k.m, -h.ny * kIn * 0.5 * k.m, PIT_K * (k.mode === 'ram' ? 0.95 : 0.6));
        }
        else { const rel = (k.vx - player.vx) * h.nx + (k.vy - player.vy) * h.ny; if (rel < 0) { const j = -1.4 * rel / (1 / k.m + 1 / player.m); k.vx += j * h.nx / k.m; k.vy += j * h.ny / k.m; player.vx -= j * h.nx / player.m; player.vy -= j * h.ny / player.m; } }   // jostling: a bump, nobody hurt
        if (fork && demo.proto && nose && !k.stageBoss) eqRamWave(pIn);   // whichever branch took it (boosting or not): a committed nose hit sends the evolved ram's wave (its own rules: commitment, wedge, cover, cooldown)
      }
    } else if (d < k.r + player.r + 26) k.close = true;
    if (d > 110) { if (k.close && !k.touched && state === 'play') { SFX.close(); addNitro(0.1, 'near-miss'); addFury(0.18); if (window.onNearMiss) onNearMiss(k); } k.close = k.touched = false; }
  }
  cars = cars.filter(k => !k.dead);
  drums = drums.filter(b => !b.gone); crates = crates.filter(b => !b.gone);

  // gems and gold: scatter, then fly to you
  const magnet = demo ? DEMO_REACH : 260 + 20 * up.wheels;   // the demo: you drive to what you wrecked (the boss's haul still finds you)
  for (const g of gems) {
    g.t += dt;
    const dx = player.x - g.x, dy = player.y - g.y, d = Math.hypot(dx, dy);
    // loot only comes to you from close by: drive through the wreckage or leave it behind
    if ((d < magnet && g.t > 0.3 || (!demo || g.boss) && g.t > 0.5 && d < 1000) && state === 'play') { const s = 300 + Math.max(0, magnet - d) * 6 + g.t * 260; g.vx += (dx / d * s - g.vx) * ease(10, dt); g.vy += (dy / d * s - g.vy) * ease(10, dt); }   // it's yours: it flies to you (your tricks often happen behind you)
    else { g.vx *= Math.exp(-4 * dt); g.vy *= Math.exp(-4 * dt); }
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (d < player.r + 10 && state === 'play') { g.got = true; if (g.v === 0) { gold += Math.round(furyGold()); SFX.coin(); } else if (g.v < 0) { gainFuel(-g.v); SFX.can(); } else { SFX.gem(); gainXP(g.v * furyXP()); } }   // a fuel can: its fuel goes straight into the tank
    if (d > 2600 || (demo && !g.boss && g.t > DEMO_CAN_LIFE)) g.got = true;   // the demo: a can lies there DEMO_CAN_LIFE seconds, blinking at the end
  }
  gems = gems.filter(g => !g.got);

  for (const p of parts) { p.t += dt; if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-3 * dt); p.vy *= Math.exp(-3 * dt); } if (p.spin) p.a += p.spin * dt; }
  parts = parts.filter(p => p.t < p.life);
  const cap = save.lowfx ? 420 : 900; if (parts.length > cap) parts.splice(0, parts.length - cap);   // light effects keep fewer particles
  for (const p of pops) p.t += dt;
  pops = pops.filter(p => p.t < 1.1);
  if (pops.length > 60) pops.splice(0, pops.length - 60);

  if (state === 'play') {
    updateFury(dt);
    spawnT -= dt;
    const S = STG(), pr = stageProgress(), cap = Math.round(S.cap[0] + (S.cap[1] - S.cap[0]) * pr), capNow = stageBoss || boss || bullIn ? 0 : cap;   // the pack grows as you go down the road
    if (!(demo && demo.layout)) heat.lv = Math.min(stageIx < 3 ? 3 : 4, 1 + Math.floor(pr * 3.2));   // and so do the attacks: one at a time early, more near the end
    for (const I of incoming) { I.t -= dt; if (I.t <= 0) landCar(I); }
    incoming = incoming.filter(I => I.t > 0);
    if (demo && demo.layout) encTick(dt);   // a demo road: its beats bring a fixed set of raiders
    else if (spawnT <= 0 && cars.length + incoming.length < capNow) { spawnCar(); spawnT = Math.max(0.5, 1.2 - time / 200); }
    pickTick();
  }
}
