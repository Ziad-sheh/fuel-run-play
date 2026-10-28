'use strict';
// Wasteland Drift · hazards.js: ramps and air time, outposts (a gas station that blows sky-high, tin shacks, fences),
// and the moving hazards: twisters (Flats and Salt), the freight train (Rust Yards), the sandworm (Salt Wastes).
// Classic scripts sharing one global scope, loaded in order by index.html.

let ramps = [], roughs = [], bumps = [], twisters = [], worm = null, trains = [], craters = [], twisterT = 22, wormT = 16;
function resetHazards() { twisters = []; worm = null; trains = []; craters = []; twisterT = 22; wormT = 16; }

// ============ placing them (called while a chunk is generated) ============
const HZ = { flats: { ramp: 0.22, outpost: 0.08, rough: 0.18, bump: 0.2 }, yards: { ramp: 0.14, outpost: 0.12, rough: 0.25, bump: 0.08 }, salt: { ramp: 0.2, outpost: 0.05, rough: 0.3, bump: 0.15 } };
function placeHazards(ch, R) {
  const H = HZ[REG().id], mx = ch.x + CH / 2, my = ch.y + CH / 2, rx = roadX(my);
  if (rx !== null && Math.abs(rx - mx) < CH / 2 - 120 && R() < H.ramp * 0.8) {   // a broken overpass on the highway: hit it head on and fly
    const y = ch.y + 200 + R() * 400, x = roadX(y), x2 = roadX(y - 60) ?? x; if (!blockedNear(ch, x, y, 150) && !ch.drums.some(b => Math.hypot(b.x - x, b.y - y) < 160)) ch.ramps.push({ x, y, a: Math.atan2(-60, x2 - x), w: 96, L: 100 });
  } else if (R() < H.ramp) {
    const a = -Math.PI / 2 + (R() - 0.5) * 1.2, x = ch.x + 160 + R() * 480, y = ch.y + 160 + R() * 480;
    if (!blockedNear(ch, x, y, 140)) ch.ramps.push({ x, y, a, w: 80, L: 96 });
  }
  if (R() < H.outpost && !ch.walls.length) placeOutpost(ch, ch.x + 240 + R() * 320, ch.y + 260 + R() * 260, R);
  if (R() < H.rough) { const x = ch.x + 150 + R() * 500, y = ch.y + 150 + R() * 500; if (!blockedNear(ch, x, y, 120)) ch.roughs.push({ x, y, r: 90 + R() * 50, seed: Math.floor(R() * 999) }); }   // rocky ground: you lose grip
  if (R() < H.bump) for (let i = 0, n = 2 + Math.floor(R() * 2), y0 = ch.y + 200 + R() * 300, x0 = ch.x + 150 + R() * 400; i < n; i++) ch.bumps.push({ x: x0 + (R() - 0.5) * 60, y: y0 - i * 110, rx: 70 + R() * 20, ry: 22, a: (R() - 0.5) * 0.4 });   // a run of dune bumps: hop them at speed
}
function placeOutpost(ch, cx, cy, R) {   // a gas station with a shack or two and a fence line
  ch.walls.push({ x: cx - 75, y: cy - 45, w: 150, h: 90, hp: 2, station: true, ch, shakeT: 0 });
  for (const s of [-1, 1]) if (R() < 0.8) ch.walls.push({ x: cx + s * 150 - 22, y: cy + (R() - 0.5) * 100 - 22, w: 44, h: 44, hp: 1, wood: true, shack: true, ch, shakeT: 0 });
  const n = 4 + Math.floor(R() * 3), fy = cy + 135;
  for (let i = 0; i < n; i++) ch.walls.push({ x: cx - n * 31 + i * 62, y: fy, w: 54, h: 12, hp: 1, wood: true, ch, shakeT: 0 });
}

// ============ breakables ============
function smashWood(W, c) {   // fences and shacks just give way, in a burst of splinters
  W.gone = true; if (W.ch) W.ch.walls = W.ch.walls.filter(x => x !== W); walls = walls.filter(x => x !== W);
  const cx = W.x + W.w / 2, cy = W.y + W.h / 2;
  for (let i = 0; i < (W.shack ? 14 : 8); i++) { const a = crand(0, TAU), sp = crand(120, 380); parts.push({ k: 'debris', x: cx + crand(-0.4, 0.4) * W.w, y: cy + crand(-0.4, 0.4) * W.h, vx: Math.cos(a) * sp + (c ? c.vx * 0.4 : 0), vy: Math.sin(a) * sp + (c ? c.vy * 0.4 : 0), a: crand(0, TAU), spin: crand(-14, 14), t: 0, life: crand(0.7, 1.2), size: crand(5, 10), col: cpick(W.shack ? ['#8d969e', '#a9532c', '#c98a4a'] : ['#c98a4a', '#a8743a', '#7a4a22']) }); }
  SFX.crate(); if (c) { c.vx *= 0.86; c.vy *= 0.86; }
}
function stationBoom(W) {   // the gas station goes up: a fireball, a burning lot, everything near it wrecked
  const x = W.x + W.w / 2, y = W.y + W.h / 2; if (state === 'play') { bounty('stations'); addFury(0.5); }
  boom(x, y, null, 1.6, W.byYou); for (let i = 0; i < 3; i++) parts.push({ k: 'fireball', x: x + crand(-50, 50), y: y + crand(-30, 30), t: -i * 0.12, life: 0.8, R: 46, seed: Math.floor(crand(1, 999)) });
  bigMoment(x, y, 'KA-BOOM!', 1.5, 1);
  fires.push({ x, y, r: 150, t: 0, life: 4.5 });
  for (const k of cars) {   // everything near it goes up; a stage boss in the blast loses two segments, no more
    if (k.dead) continue; const d = Math.hypot(k.x - x, k.y - y); if (W.byYou && d < 330) markPlayerCause(k, 'drum'); const C = resolveWreckCause(k, 'drum', W, W.byYou);
    if (k.stageBoss) { if (d < 330) damage(k, capBossSegments(2) * PIP, 'trick', 'KA-BOOM!', undefined, undefined, undefined, C); }
    else if (d < 210) wreck(k, 'KA-BOOM!', 'trick', undefined, C); else if (d < 330) damage(k, 70, 'trick', 'KA-BOOM!', undefined, undefined, undefined, C);
  }
  if (Math.hypot(player.x - x, player.y - y) < 170) hurt(18, false, 'drum');
  if (boss && !boss.dead && Math.hypot(boss.x - x, boss.y - y) < 280) { damageBoss(boss.maxHp * 0.12, 'trick', boss.x, boss.y, 'KA-BOOM!', true); stunBoss(1.6, false); }
  blast(x, y, 330, 560, W.byYou);
  for (const b of drums) if (!b.gone && Math.hypot(b.x - x, b.y - y) < 260) { b.fuse = b.fuse || rand(0.1, 0.4); if (W.byYou) b.byYou = true; }
}

// ============ ramps and air time ============
const airH = c => c.air ? 4 * c.air.H * (c.air.t / c.air.T) * (1 - c.air.t / c.air.T) : 0;
function rampCheck(c) {   // roll up a ramp fast enough, going its way, and you take off
  if (c.air) return;
  const sp = Math.hypot(c.vx, c.vy); if (sp < 230) return;
  for (const R of ramps) {
    const dx = c.x - R.x, dy = c.y - R.y, ca = Math.cos(R.a), sa = Math.sin(R.a), lon = dx * ca + dy * sa, lat = -dx * sa + dy * ca;
    if (Math.abs(lat) > R.w / 2 || lon < -R.L / 2 || lon > R.L / 2 || Math.abs(angDiff(R.a, Math.atan2(c.vy, c.vx))) > 1) continue;
    const v = R.kick ? Math.max(sp, 440) : sp;
    if (R.kick) { c.vx = Math.cos(R.a) * v; c.vy = Math.sin(R.a) * v; }   // a kicker at a ravine throws you straight over it: hit it and you clear it
    const T = clamp(v / 560, 0.5, 1.25) * (c === player && nitroT > 0 ? 1.2 : 1) * (R.kick ? 1.3 : 1); c.air = { t: 0, T, H: 55 * T + 20 };
    if (c === player) SFX.whoosh();
    return;
  }
}
function bumpCheck(c) {   // a dune bump at speed: a little hop
  if (c.air || Math.hypot(c.vx, c.vy) < 280) return;
  for (const B of bumps) { const dx = c.x - B.x, dy = c.y - B.y, ca = Math.cos(B.a), sa = Math.sin(B.a), u = (dx * ca + dy * sa) / B.rx, v = (-dx * sa + dy * ca) / B.ry; if (u * u + v * v < 1 && !(c.bumped === B)) { c.bumped = B; c.air = { t: 0, T: 0.3, H: 16 }; return; } }
  c.bumped = null;
}
function airTick(c, dt) { if (!c.air) return; c.air.t += dt; if (c.air.t >= c.air.T) { const T = c.air.T; c.air = null; landing(c, T); } }
function landing(c, T) {   // touchdown: dust, a thud; land on a car and it's flat
  for (let i = 0; i < 10; i++) { const a = crand(0, TAU), sp = crand(60, 200); parts.push({ k: 'dust', x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.5, 0.8), size: crand(10, 16) }); }
  SFX.thud(); c.bounce = 1;
  if (c === player) {
    if (player.boarders.length && T > 0.5) throwBoarder();   // a hard landing bucks one off
    for (const k of cars) if (!k.dead && !k.T.elite && Math.hypot(k.x - player.x, k.y - player.y) < player.r + k.r + 40) { blame(k); wreck(k, 'STOMPED!', 'trick', undefined, resolveWreckCause(k, 'stomp', undefined, true)); gainXP(2); }   // a landing's shockwave flattens what's close
    if (T > 0.45) bounty('air');
    onLanding(T);   // the AIR weapons fire on touchdown
    if (T > 0.6) { pops.push({ x: player.x, y: player.y - 50, text: T > 1 ? 'BIG AIR!' : 'AIR TIME!', col: '#7fd6ff', t: 0 }); player.dc.pts += 70 * T; addNitro(0.15 * T, 'air'); addFury(0.25 * T); }
  } else if (blocked(c.x, c.y, c.r * 0.8)) wreck(c, 'SPLAT!');
}

// ============ twisters ============
function updateTwisters(dt) {
  const id = REG().id;
  twisterT -= dt;
  if (twisterT <= 0 && id !== 'yards' && !boss && state === 'play') {
    twisterT = rand(26, 44); const side = grand() < 0.5 ? -1 : 1, [x, y] = edgePoint(player.a + side * Math.PI / 2 + rand(-0.5, 0.2), 180);
    const tx = player.x + player.vx * 2.2, ty = player.y + player.vy * 2.2, d = Math.hypot(tx - x, ty - y) || 1, v = rand(110, 150);
    twisters.push({ x, y, vx: (tx - x) / d * v, vy: (ty - y) / d * v, t: 0, life: 20, r: 62, ph: rand(0, TAU) });
  }
  for (const W of twisters) {
    W.t += dt; W.x += (W.vx + Math.sin(W.t * 0.8 + W.ph) * 50) * dt; W.y += (W.vy + Math.cos(W.t * 0.6 + W.ph) * 50) * dt;
    if (cchance() < 0.7) { const a = crand(0, TAU); parts.push({ k: 'dust', x: W.x + Math.cos(a) * W.r, y: W.y + Math.sin(a) * W.r, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, t: 0, life: 0.6, size: crand(8, 13) }); }
    for (const c of [player, ...cars]) {
      if (c.dead || c.air) continue; const dx = c.x - W.x, dy = c.y - W.y, d = Math.hypot(dx, dy) || 1;
      if (d < W.r) {   // caught: lifted, spun and flung
        c.air = { t: 0, T: 0.85, H: 70 }; c.vx += -dy / d * 420 + dx / d * 220; c.vy += dx / d * 420 + dy / d * 220; c.w = (c.w || 0) + (grand() < 0.5 ? -9 : 9);
        if (c === player) { hurt(8, true); pops.push({ x: c.x, y: c.y - 50, text: 'TWISTED!', col: '#f2e4c8', t: 0 }); } else { c.slideT = Math.max(c.slideT, 1.2); if (lured(c)) blame(c, 2); damage(c, 30, 'trick', 'TWISTED!'); }
      } else if (d < W.r * 2.4) { const f = (1 - d / (W.r * 2.4)) * 300 * dt; c.vx -= dx / d * f; c.vy -= dy / d * f; }   // the pull
    }
  }
  twisters = twisters.filter(W => W.t < W.life);
}

// ============ the freight train (Rust Yards) ============
function trackYs() { const out = []; for (const D of allDepots()) if (D.tracks) out.push(...D.tracks); return out; }
function updateTrains(dt) {
  if (REG().id !== 'yards') return;
  for (const y of trackYs()) if (!trains.some(T => T.y === y)) trains.push({ y, st: 'idle', t: 0, cd: 0, dir: 1, x: 0 });
  for (const T of trains) {
    T.t += dt; T.cd -= dt;
    const dy = player.y - T.y;
    if (T.st === 'idle' && T.cd <= 0 && dy > 120 && dy < 1100 && state === 'play' && !boss) { T.st = 'warn'; T.t = 0; T.dir = grand() < 0.5 ? -1 : 1; SFX.horn(); pops.push({ x: player.x, y: T.y - 40, text: 'TRAIN!', col: '#ff5a46', t: 0 }); }
    else if (T.st === 'warn' && T.t > 1.9) { T.st = 'pass'; T.t = 0; T.x = player.x - T.dir * 1500; SFX.horn(); }
    else if (T.st === 'pass') {
      T.x += T.dir * 1050 * dt; const head = T.x, tail = T.x - T.dir * 780, x0 = Math.min(head, tail), x1 = Math.max(head, tail);
      for (const k of cars) if (!k.dead && Math.abs(k.y - T.y) < 34 + k.r && k.x > x0 - k.r && k.x < x1 + k.r) wreck(k, 'TRAIN!', 'trick', lured(k));
      if (Math.abs(player.y - T.y) < 34 + player.r && player.x > x0 - player.r && player.x < x1 + player.r && !player.air && player.inv <= 0) { hurt(34 * (1 + 0.12 * region)); player.vy += Math.sign(player.y - T.y || 1) * 650; player.vx += T.dir * 300; player.inv = 1; }
      if ((T.dir > 0 && tail > player.x + 1600) || (T.dir < 0 && tail < player.x - 1600)) { T.st = 'idle'; T.cd = rand(6, 10); }
    }
  }
}

// ============ the sandworm (Salt Wastes) ============
function updateWorm(dt) {
  if (REG().id !== 'salt') return;
  if (!worm) {
    wormT -= dt;
    if (wormT <= 0 && !boss && state === 'play') {
      wormT = rand(14, 22); const tx = player.x + player.vx * 1.9 + rand(-60, 60), ty = player.y + player.vy * 1.9 + rand(-60, 60), a = rand(0, TAU);
      worm = { st: 'run', t: 0, x0: tx + Math.cos(a) * 720, y0: ty + Math.sin(a) * 720, tx, ty, r: 125 };
    }
    return;
  }
  const W = worm; W.t += dt;
  if (W.st === 'run' && W.t > 1.2) { W.st = 'tell'; W.t = 0; SFX.rumble(); }
  else if (W.st === 'tell' && W.t > 1) {
    W.st = 'bite'; W.t = 0; SFX.wreck(1.4); SFX.horn();
    for (const k of cars) if (!k.dead && Math.hypot(k.x - W.tx, k.y - W.ty) < W.r) wreck(k, 'CHOMP!', 'trick', lured(k));
    const d = Math.hypot(player.x - W.tx, player.y - W.ty);
    if (d < W.r && !player.air) { hurt(30 * (1 + 0.12 * region)); const nx = (player.x - W.tx) / (d || 1), ny = (player.y - W.ty) / (d || 1); player.vx += nx * 620; player.vy += ny * 620; player.air = { t: 0, T: 0.6, H: 60 }; }
    if (boss && !boss.dead && Math.hypot(boss.x - W.tx, boss.y - W.ty) < W.r + 30) damageBoss(boss.maxHp * 0.1, 'trick', boss.x, boss.y, 'CHOMP!', true);
    for (let i = 0; i < 26; i++) { const a = crand(0, TAU), sp = crand(150, 420); parts.push({ k: 'dust', x: W.tx + Math.cos(a) * W.r * 0.6, y: W.ty + Math.sin(a) * W.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.7, 1.2), size: crand(14, 24) }); }
  }
  else if (W.st === 'bite' && W.t > 0.8) { W.st = 'sink'; W.t = 0; craters.push({ x: W.tx, y: W.ty, r: W.r * 0.9, t: 0, life: 10 }); }
  else if (W.st === 'sink' && W.t > 0.8) worm = null;
  for (const C of craters) C.t += dt; craters = craters.filter(C => C.t < C.life);
}

function updateHazards(dt) { updateTwisters(dt); updateTrains(dt); updateWorm(dt); }

// ============ drawing ============
function paintRamp(g, R) {   // planks up to a lip, side rails, a chevron that says which way to hit it, a long shadow off the high end
  g.save(); g.translate(R.x, R.y); g.rotate(R.a);
  g.fillStyle = SHADOW; g.beginPath(); g.moveTo(R.L / 2, -R.w / 2); g.lineTo(R.L / 2 + 34, -R.w / 2 + 22); g.lineTo(R.L / 2 + 34, R.w / 2 + 22); g.lineTo(R.L / 2, R.w / 2); g.closePath(); g.fill();
  inkRR(g, -R.L / 2, -R.w / 2, R.L, R.w, 4, '#c98a4a', { box: [-R.L / 2, -R.w / 2, R.L, R.w], lw: 3 });
  g.strokeStyle = 'rgba(36,22,15,.5)'; g.lineWidth = 1.2; g.beginPath(); for (let x = -R.L / 2 + 10; x < R.L / 2; x += 11) { g.moveTo(x, -R.w / 2); g.lineTo(x, R.w / 2); } g.stroke();
  fillOnly(g, () => rr(g, R.L / 2 - 12, -R.w / 2, 12, R.w, 2), '#e3b072');   // the lit lip
  for (const s of [-1, 1]) inkRR(g, -R.L / 2, s * (R.w / 2 - 3) - 3, R.L, 6, 2, 'steel', { lw: 1.6, double: false });
  g.fillStyle = '#5fd4ff'; g.strokeStyle = INK; g.lineWidth = 2.4; for (const x of [-26, 0, 26]) { g.beginPath(); g.moveTo(x - 11, -19); g.lineTo(x + 11, 0); g.lineTo(x - 11, 19); g.lineTo(x - 3, 0); g.closePath(); g.fill(); g.stroke(); }   // bright arrows: jump this way
  g.restore();
}
function paintRough(g, P) {   // rocky ground: a darker patch thick with inked stones
  const R2 = seeded(P.seed);
  g.save(); g.globalAlpha = 0.35; g.fillStyle = PAL.sand2; pPoly(g, blob(P.x, P.y, P.r, P.seed)); g.fill(); g.restore();
  for (let i = 0; i < 26; i++) { const a = R2() * TAU, d = Math.sqrt(R2()) * P.r * 0.9, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d, r = 3 + R2() * 6; g.fillStyle = SHADOW; g.beginPath(); g.arc(x + r * 0.4, y + r * 0.6, r, 0, TAU); g.fill(); inkPoly(g, [[x - r, y], [x - r * 0.3, y - r], [x + r, y - r * 0.4], [x + r * 0.6, y + r * 0.8], [x - r * 0.5, y + r * 0.7]], 'rock', { lw: 1.1, double: false }); }
}
function paintBump(g, B) {   // a low dune ridge: a sunlit crest, a shadowed lee
  g.save(); g.translate(B.x, B.y); g.rotate(B.a);
  g.fillStyle = 'rgba(80,30,40,.16)'; g.beginPath(); g.ellipse(6, 8, B.rx, B.ry, 0, 0, TAU); g.fill();
  g.fillStyle = '#efc489'; g.beginPath(); g.ellipse(0, 0, B.rx, B.ry, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(36,22,15,.45)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, B.rx, B.ry, 0, 0.15, Math.PI - 0.15); g.stroke();
  g.strokeStyle = 'rgba(255,244,220,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -3, B.rx * 0.8, B.ry * 0.5, 0, Math.PI + 0.3, TAU - 0.3); g.stroke();
  g.restore();
}
function paintTracks(g, ch) {   // the railway across the Yards: a gravel bed, sleepers, two rails
  for (const y of trackYs()) {
    if (y < ch.y - 40 || y > ch.y + CH + 40) continue;
    g.fillStyle = 'rgba(90,80,75,.55)'; g.fillRect(ch.x, y - 30, CH, 60); g.fillStyle = DOTS.fine; g.fillRect(ch.x, y - 30, CH, 60);
    g.fillStyle = '#5a3a25'; for (let x = Math.floor(ch.x / 26) * 26; x < ch.x + CH; x += 26) g.fillRect(x, y - 22, 9, 44);
    for (const s of [-1, 1]) { g.fillStyle = PAL.steel; g.fillRect(ch.x, y + s * 14 - 3, CH, 6); g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(ch.x, y + s * 14 - 3); g.lineTo(ch.x + CH, y + s * 14 - 3); g.moveTo(ch.x, y + s * 14 + 3); g.lineTo(ch.x + CH, y + s * 14 + 3); g.stroke(); }
  }
}
function drawStation(W) {   // a gas station: canopy over the pumps, the kiosk, a sign; the flame says it blows
  const x = W.x, y = W.y, w = W.w, h = W.h;
  ctx.save(); ctx.setLineDash([9, 7]); ctx.lineDashOffset = -clock * 12; ctx.strokeStyle = 'rgba(255,154,60,.8)'; ctx.lineWidth = 4; rr(ctx, x - 34, y - 34, w + 68, h + 68, 30); ctx.stroke(); ctx.restore();   // orange ring: this blows up
  ctx.fillStyle = SHADOW; ctx.fillRect(x + 16, y + 22, w, h);
  inkRR(ctx, x + w * 0.62, y + 8, w * 0.34, h - 16, 3, '#e9dcc0', { box: true, lw: 2.6 });   // the kiosk
  inkRR(ctx, x + w * 0.66, y + 14, w * 0.12, 10, 1, 'glass', { lw: 1.2, double: false });
  for (const py of [y + 26, y + h - 26]) inkRR(ctx, x + 22, py - 8, 16, 16, 2, 'red', { lw: 1.6, double: false });   // pumps
  ctx.save(); ctx.globalAlpha = 0.93; inkRR(ctx, x, y, w * 0.6, h, 4, 'rust', { box: true, lw: 3 }); ctx.restore();   // the canopy
  ctx.strokeStyle = 'rgba(255,244,220,.55)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 10; i < w * 0.6; i += 18) { ctx.moveTo(x + i, y + 4); ctx.lineTo(x + i, y + h - 4); } ctx.stroke();
  inkCircle(ctx, x + w * 0.3, y + h / 2, 17, 'yellow', { lw: 2.4 });
  ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + h / 2 - 11); ctx.bezierCurveTo(x + w * 0.3 + 7, y + h / 2 - 4, x + w * 0.3 + 9, y + h / 2 + 3, x + w * 0.3, y + h / 2 + 9); ctx.bezierCurveTo(x + w * 0.3 - 9, y + h / 2 + 3, x + w * 0.3 - 7, y + h / 2 - 4, x + w * 0.3 - 3, y + h / 2 - 7); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
  ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('GAS', x + w * 0.79, y + h / 2 + 10); ctx.fillStyle = PAL.yellow; ctx.fillText('GAS', x + w * 0.79, y + h / 2 + 10);
  if (W.hp < 2) inkLine(ctx, [[x + 20, y + 10], [x + 40, y + 30], [x + 34, y + 50]], 2);
}
function drawWood(W) {
  if (W.shack) {   // a tin shack: corrugated roof, rust
    ctx.fillStyle = SHADOW; ctx.fillRect(W.x + 9, W.y + 13, W.w, W.h);
    inkRR(ctx, W.x, W.y, W.w, W.h, 2, '#8d969e', { box: true, lw: 2.4 });
    ctx.strokeStyle = 'rgba(36,22,15,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 5; i < W.w; i += 6) { ctx.moveTo(W.x + i, W.y + 2); ctx.lineTo(W.x + i, W.y + W.h - 2); } ctx.stroke();
    fillOnly(ctx, () => { ctx.beginPath(); ctx.ellipse(W.x + W.w * 0.3, W.y + W.h * 0.6, 7, 5, 0.4, 0, TAU); }, 'rust', 0.8);
  } else {   // a fence: posts and planks
    ctx.fillStyle = SHADOW; ctx.fillRect(W.x + 6, W.y + 9, W.w, W.h);
    inkRR(ctx, W.x, W.y + 2, W.w, W.h - 4, 2, '#c98a4a', { lw: 1.8, double: false });
    for (const px of [W.x + 3, W.x + W.w - 6]) inkRR(ctx, px, W.y - 1, 5, W.h + 2, 1, '#7a4a22', { lw: 1.4, double: false });
  }
}
function drawHazardsLow() {   // on the ground: craters, the worm's ripple and cracking ground, the train's warning glow
  for (const C of craters) { if (!inView(C.x, C.y, C.r)) continue; ctx.save(); ctx.globalAlpha = Math.min(1, (C.life - C.t) * 0.6); inkCircle(ctx, C.x, C.y, C.r, '#d8c6a6', { lw: 2, double: false }); ctx.strokeStyle = 'rgba(36,22,15,.35)'; ctx.lineWidth = 2; for (let r = C.r * 0.3; r < C.r; r += 18) { ctx.beginPath(); ctx.arc(C.x, C.y, r, 0, TAU); ctx.stroke(); } ctx.restore(); }
  const W = worm;
  if (W) {
    if (W.st === 'run') { const k = clamp(W.t / 1.2, 0, 1), x = W.x0 + (W.tx - W.x0) * k, y = W.y0 + (W.ty - W.y0) * k; ctx.strokeStyle = 'rgba(36,22,15,.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const t = k * i / 12, px = W.x0 + (W.tx - W.x0) * t, py = W.y0 + (W.ty - W.y0) * t, n = Math.sin(i * 1.7 + clock * 9) * 12; ctx.lineTo(px - (W.ty - W.y0) / 720 * n, py + (W.tx - W.x0) / 720 * n); } ctx.stroke(); for (let i = 0; i < 3; i++) parts.push({ k: 'dust', x: x + crand(-14, 14), y: y + crand(-14, 14), vx: crand(-60, 60), vy: crand(-60, 60), t: 0, life: 0.5, size: crand(8, 13) }); }
    if (W.st === 'tell' || W.st === 'run') { const k = W.st === 'tell' ? W.t : 0; ctx.save(); ctx.globalAlpha = 0.4 + k * 0.5; ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(W.tx, W.ty, W.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = INK; ctx.lineWidth = 2; const R2 = seeded(Math.round(W.tx)); for (let i = 0; i < 8 * k + 2; i++) { const a = R2() * TAU; let px = W.tx, py = W.ty; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += Math.cos(a + (R2() - 0.5)) * W.r * 0.25; py += Math.sin(a + (R2() - 0.5)) * W.r * 0.25; ctx.lineTo(px, py); } ctx.stroke(); } ctx.restore(); }
  }
  for (const T of trains) if (T.st === 'warn' && Math.floor(clock * 6) % 2) { const left = cam.x - VW / 2 / view.z - 50, right = cam.x + VW / 2 / view.z + 50; ctx.fillStyle = 'rgba(232,67,47,.28)'; ctx.fillRect(left, T.y - 34, right - left, 68); }
  for (const y of trackYs()) { const rx = roadX(y); if (rx === null || !inView(rx, y, 120)) continue; for (const s of [-1, 1]) { const x = rx + s * (ROAD_W + 26); inkRR(ctx, x - 4, y - 70, 8, 34, 2, 'steel', { lw: 1.6, double: false }); const warn = trains.some(T => T.y === y && T.st !== 'idle'); for (const dx of [-7, 7]) inkCircle(ctx, x + dx, y - 74, 5.5, warn && Math.floor(clock * 6 + (dx > 0 ? 1 : 0)) % 2 ? '#ff2a1a' : '#4a2220', { lw: 1.4, double: false }); } }
}
function drawHazardsHigh() {   // above the cars: twisters, the worm's maw, the train
  for (const W of twisters) {
    if (!inView(W.x, W.y, 220)) continue;
    const a = Math.min(1, W.t * 1.5, (W.life - W.t) * 0.8);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(W.x + 26, W.y + 34, W.r * 1.1, W.r * 0.7, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) {   // stacked rings of dust, wider toward the top, each spinning
      const k = i / 5, r = W.r * (0.55 + k * 1.1), y = W.y - k * 90, sp = clock * (7 - i * 0.6);
      ctx.fillStyle = i % 2 ? 'rgba(214,170,110,.55)' : 'rgba(236,201,147,.5)'; ctx.beginPath(); ctx.ellipse(W.x + Math.sin(clock * 2 + i) * 8 * k, y, r, r * 0.38, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(36,22,15,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(W.x + Math.sin(clock * 2 + i) * 8 * k, y, r, r * 0.38, 0, sp, sp + 2.4); ctx.stroke();
    }
    for (let i = 0; i < 5; i++) { const t = clock * 3 + i * 1.3, r = W.r * (0.6 + (i % 3) * 0.3); ctx.fillStyle = INK; ctx.fillRect(W.x + Math.cos(t) * r - 2, W.y - 20 - i * 14 + Math.sin(t) * r * 0.35, 5, 3); }   // debris caught in it
    ctx.restore();
  }
  const W = worm;
  if (W && (W.st === 'bite' || W.st === 'sink')) {   // the maw: rings of teeth round a dark throat
    const k = W.st === 'bite' ? Math.min(1, W.t / 0.18) : 1 - W.t / 0.8, r = W.r * (0.4 + 0.6 * k);
    ctx.save(); ctx.globalAlpha = Math.max(0, k);
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(W.tx + 18, W.ty + 24, r * 1.05, 0, TAU); ctx.fill();
    inkCircle(ctx, W.tx, W.ty, r, '#b49a78', { box: true, lw: 3.4 });
    inkCircle(ctx, W.tx, W.ty, r * 0.62, '#2a1414', { lw: 2.4, double: false });
    for (const [rr2, n] of [[r * 0.92, 18], [r * 0.66, 14]]) for (let i = 0; i < n; i++) { const a = i / n * TAU + clock * 0.5; ctx.save(); ctx.translate(W.tx + Math.cos(a) * rr2, W.ty + Math.sin(a) * rr2); ctx.rotate(a + Math.PI); inkPoly(ctx, [[-4, -5], [12, 0], [-4, 5]], 'bone', { lw: 1, double: false }); ctx.restore(); }
    ctx.restore();
  }
  for (const T of trains) {
    if (T.st !== 'pass') continue;
    for (let i = 0; i < 6; i++) {   // the locomotive, then five wagons
      const x = T.x - T.dir * (i * 132 + (i ? 20 : 0)); if (!inView(x, T.y, 160)) continue;
      ctx.save(); ctx.translate(x, T.y); ctx.scale(T.dir, 1);
      ctx.fillStyle = SHADOW; ctx.fillRect(-56, -16, 124, 52);
      if (i === 0) { inkRR(ctx, -60, -28, 122, 56, 6, '#2c2a2c', { box: true, lw: 3.2 }); inkRR(ctx, -48, -18, 40, 36, 3, 'red', { lw: 2 }); inkCircle(ctx, 20, 0, 9, 'dark', { lw: 2 }); inkPoly(ctx, [[62, -26], [80, -10], [80, 10], [62, 26]], 'chrome', { lw: 2.4 }); if (cchance() < 0.6) parts.push({ k: 'puff', x: x + T.dir * 20, y: T.y, vx: -T.dir * 120 + crand(-30, 30), vy: crand(-40, -10), t: 0, life: 1, size: crand(10, 16), dark: true }); }
      else if (i % 2) { inkRR(ctx, -60, -26, 120, 52, 20, 'chrome', { box: true, lw: 3 }); for (let px = -40; px <= 40; px += 20) inkLine(ctx, [[px, -25], [px, 25]], 1.4); }   // a tanker
      else { inkRR(ctx, -60, -27, 120, 54, 4, 'rust', { box: true, lw: 3 }); inkLine(ctx, [[-60, 0], [60, 0]], 1.6); }   // a boxcar
      ctx.restore();
    }
  }
}
