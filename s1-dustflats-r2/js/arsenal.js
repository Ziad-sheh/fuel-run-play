'use strict';
// Wasteland Drift · arsenal.js: every weapon fires from something you do with the car, so your build changes how you
// drive instead of driving for you. The moves: AIM (your nose), DRIFT (while you slide), DRIFT END (when you let go),
// RAM, WEIGHT, SIDE (cars beside you), AIR (landing a jump), TAKEDOWN, NEAR MISS. The gun, rockets in flight and the
// flamethrower live in combat.js; the six newer weapons and the six evolutions live here, with the event hooks.
// Classic scripts sharing one global scope, loaded in order by index.html.

let slicks = [], drones = [], myShells = [], myLances = [], zaps = [], buzz = [];
const AT = { oil: 0, lance: 1, emp: 0 };
function resetArsenal() { slicks = []; drones = []; myShells = []; myLances = []; zaps = []; buzz = []; Object.assign(AT, { oil: 0, lance: 1, emp: 0 }); }
const evo = k => !!(up.evo && up.evo[k]);
function hitBossNear(x, y, R, n, src) { if (!boss || boss.dead) return; const p = bossPoints().find(p => Math.hypot(p.x - x, p.y - y) < R + p.r); if (p) damageBoss(n, src, p.x, p.y); }
function sideSaws() {   // where the blades are, in the world
  const L = up.saw, ca = Math.cos(player.a), sa = Math.sin(player.a), off = (40 + 5 * L) * player.size, r = 17 + 3 * L;   // out on arms: they reach the cars riding beside you
  return [-1, 1].map(s => ({ x: player.x - sa * off * s + ca * 4, y: player.y + ca * off * s + sa * 4, r }));
}
function zap(x0, y0, x1, y1) { zaps.push({ x0, y0, x1, y1, t: 0, life: 0.22, seed: Math.floor(rand(1, 999)) }); }
const carsNear = (x, y, R, skip) => cars.filter(k => !k.dead && !(skip && skip.has(k)) && Math.hypot(k.x - x, k.y - y) < R).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
function lightning(from, R, n, dmg, hit = new Set()) {   // a bolt that jumps car to car
  let src = from, count = 0;
  while (count < n) { const o = carsNear(src.x, src.y, R, hit)[0]; if (!o) break; hit.add(o); zap(src.x, src.y, o.x, o.y); o.stun = Math.max(o.stun, 0.7); damage(o, dmg, 'emp', 'ZAPPED!', o.x, o.y); src = o; count++; }
  return count;
}

// ============ the moves ============
// DRIFT END: you let go of a drift with a blue, orange or purple charge (tier 1-3)
function onDriftRelease(tier) {
  if (state !== 'play' || !tier) return;
  const ca = Math.cos(player.a), sa = Math.sin(player.a);
  if (up.rocket) {   // 1/2/3 rockets for the tier, one more at levels 2 and 4; they hunt cars ahead
    const L = up.rocket, n = tier + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0);
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, a = player.a + side * 1.3; rockets.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, a: player.a + side * (0.25 + 0.12 * Math.floor(i / 2)), sp: 200, t: -i * 0.08, dmg: (50 + 15 * L) * (L >= 5 ? 1.25 : 1), R: 100 + (L >= 3 ? 30 : 0) }); }
    SFX.launch();
  }
  if (up.caltrops) {   // a spike strip across your line, longer for a bigger drift
    const L = up.caltrops; strips.push({ x: player.x - ca * 40, y: player.y - sa * 40, a: player.a + Math.PI / 2, len: 100 + 30 * tier + (L >= 2 ? 40 : 0) + (L >= 3 ? 40 : 0), t: 0, life: 8, hit: new Set(), dmg: L >= 5 ? 34 : L >= 4 ? 24 : 16 });
  }
  if (evo('saw')) {   // Buzzsaw Storm: blades fly out of both sides and come back
    for (let i = 0; i < 1 + tier; i++) for (const s of [-1, 1]) buzz.push({ x: player.x, y: player.y, a: player.a + s * Math.PI / 2 + rand(-0.5, 0.5), t: -i * 0.06, hit: new Set() });
  }
  if (evo('rocket') && tier >= 2) {   // Doomsday Barrage: a missile at every car in sight
    let n = 0; for (const k of cars) { if (k.dead || n >= 6 || !inView(k.x, k.y, 0)) continue; const a = Math.atan2(k.y - player.y, k.x - player.x); rockets.push({ x: player.x, y: player.y, a: a + rand(-0.4, 0.4), sp: 220, t: -n * 0.06, dmg: 90, R: 130 }); n++; }
    if (n) SFX.launch();
  }
}
// AIR: you landed a jump (T = seconds in the air)
function onLanding(T) {
  if (!up.mortar || T < 0.25 || state !== 'play') return;
  const L = up.mortar, n = (T >= 0.6 ? 2 : 1) + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0), targets = carsNear(player.x, player.y, 750);
  if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < 850) targets.unshift(boss);
  if (!targets.length) return;
  for (let i = 0; i < n; i++) { const T2 = targets[i % targets.length]; myShells.push({ sx: player.x, sy: player.y, tx: T2.x + T2.vx * 0.9 + (i >= targets.length ? rand(-60, 60) : 0), ty: T2.y + T2.vy * 0.9 + (i >= targets.length ? rand(-60, 60) : 0), t: -i * 0.12, T: 0.9, R: 90 + (L >= 2 ? 25 : 0), dmg: 50 + 20 * L }); }
  SFX.launch();
}
// TAKEDOWN: every takedown sends the drones out on a bombing run (and with the Hornet Swarm they grow guns and hunt)
function onTakedown(k, src, driving) {
  if (!up.drone || state !== 'play') return;
  for (const D of drones) { if (D.sortie) continue; const T = carsNear(k.x, k.y, 480, new Set([k]))[0]; if (T) { D.sortie = T; D.sT = 0; } }
  if (evo('gun')) for (const D of drones) D.hunt = 3.5;
}
// a solid ram on a boss counts like a takedown for the drones: they go in on the boss
function onBossHit() { if (up.drone && boss && !boss.dead) for (const D of drones) if (!D.sortie) { D.sortie = boss; D.sT = 0; } }
// NEAR MISS: you dodged a car by a hair (a close pass, or an OLÉ against a lunge or the Bull's charge)
function onNearMiss(k) {
  if (state !== 'play' || !k || k.dead) return;
  if (k === boss) {   // the Bull's charge missed you: the coil shocks it
    if (!up.emp || time < AT.emp) return; AT.emp = time + 0.6;
    zap(player.x, player.y, k.x, k.y); SFX.clang(); damageBoss((22 + 9 * up.emp) * 2, 'emp', k.x, k.y); stunBoss(0.8, false); return;
  }
  if (evo('emp')) { if (lightning(player, 380, 8, 45)) SFX.clang(); }   // Thunderdome: lightning through the pack
  if (!up.emp || time < AT.emp) return;
  const L = up.emp; AT.emp = time + 0.6;
  parts.push({ k: 'ring', x: k.x, y: k.y, t: 0, life: 0.3, R: L >= 4 ? 160 : 110, emp: true }); SFX.clang();
  const hit = new Set([k]), dmg = 22 + 9 * L;
  zap(player.x, player.y, k.x, k.y); k.stun = Math.max(k.stun, 1.2); k.slideT = Math.max(k.slideT, 0.4); damage(k, dmg * (L >= 3 ? 1.3 : 1), 'emp', 'ZAPPED!', k.x, k.y);
  if (L >= 2) for (const o of carsNear(k.x, k.y, L >= 4 ? 160 : 110, hit)) { hit.add(o); zap(k.x, k.y, o.x, o.y); o.stun = Math.max(o.stun, 0.9); damage(o, dmg * 0.6, 'emp', 'ZAPPED!', o.x, o.y); }
  if (L >= 5) lightning(k, 220, 2, dmg * 0.6, hit);
}

// ============ every tick ============
function arsenal(dt) {
  const pv = Math.hypot(player.vx, player.vy), ca = Math.cos(player.a), sa = Math.sin(player.a);
  const sliding = player.slip > 0.3 && pv > 160 && !player.air;
  // oil drops (DRIFT): oil sprays from your tail while you slide; chasers that hit it spin out (on fire, with the Inferno Trail)
  const tailgater = arm.oiler && cars.some(k => !k.dead && Math.hypot(k.x - player.x, k.y - player.y) < 240 && Math.abs(angDiff(player.a + Math.PI, Math.atan2(k.y - player.y, k.x - player.x))) < 0.55);
  if (up.oil && (sliding || (tailgater && pv > 150))) {   // drift to spray it, or it drops itself when someone sits on your tail
    const L = up.oil; AT.oil -= dt * (sliding ? 1 : 0.55);
    if (AT.oil <= 0) {
      AT.oil = L >= 3 ? 0.24 : 0.32; const x = player.x - ca * 40, y = player.y - sa * 40, r = 30 + (L >= 2 ? 10 : 0) + (L >= 4 ? 8 : 0), life = L >= 5 ? 12 : 6;
      slicks.push({ x, y, r, t: 0, life, hit: new Set(), seed: Math.floor(rand(1, 999)) });
      if (evo('flame')) fires.push({ x, y, r: r * 0.9, t: 0, life: life * 0.6, mine: true });
    }
  }
  for (const S of slicks) { S.t += dt; for (const k of cars) if (!k.dead && !S.hit.has(k) && Math.hypot(k.x - S.x, k.y - S.y) < S.r * 0.85 + k.r * 0.4) { S.hit.add(k); blame(k); k.slideT = Math.max(k.slideT, 1.3); k.a += rand(0.7, 1.3) * (grand() < 0.5 ? -1 : 1); k.frag = Math.max(k.frag, 1.3); damage(k, 6, 'oil', undefined, undefined, undefined, true); } }
  slicks = slicks.filter(S => S.t < S.life);
  if (slicks.length > 60) slicks.splice(0, slicks.length - 60);
  // side saws (SIDE): grind cars beside you, harder the faster you pass them
  if (up.saw) {
    const L = up.saw;
    for (const B of sideSaws()) {
      for (const k of cars) if (!k.dead && Math.hypot(k.x - B.x, k.y - B.y) < B.r + k.r) {
        const rel = Math.hypot(k.vx - player.vx, k.vy - player.vy), tick = ([0, 70, 100, 140][arm.saws] || 40) * dt * (0.8 + rel / 400);   // about a second of contact shreds a buggy
        blame(k); damage(k, tick * (k.T.armour && arm.saws < 3 ? 0.5 : 1), 'saw', 'SAWN!', B.x, B.y, true); k.frag = Math.max(k.frag, 0.5); k.vx += (k.x - B.x) * 2 * dt; k.vy += (k.y - B.y) * 2 * dt;
        if (cchance() < 0.5) parts.push({ k: 'spark', x: B.x, y: B.y, vx: crand(-220, 220) + player.vx * 0.5, vy: crand(-220, 220) + player.vy * 0.5, t: 0, life: 0.2 });
        if (grand() < 0.15) SFX.grind();
      }
      hitBossNear(B.x, B.y, B.r, (6 + 5 * L) * dt * 4 * 0.6, 'saw');
    }
  }
  for (const Z of buzz) {
    Z.t += dt; if (Z.t < 0) { Z.x = player.x; Z.y = player.y; continue; }
    const out = Z.t < 0.45, sp = 760;
    if (out) { Z.x += Math.cos(Z.a) * sp * dt; Z.y += Math.sin(Z.a) * sp * dt; } else { const dx = player.x - Z.x, dy = player.y - Z.y, d = Math.hypot(dx, dy) || 1; Z.x += dx / d * sp * 1.2 * dt; Z.y += dy / d * sp * 1.2 * dt; if (d < 30) Z.dead = true; }
    for (const k of cars) if (!k.dead && !Z.hit.has(k) && Math.hypot(k.x - Z.x, k.y - Z.y) < k.r + 18) { Z.hit.add(k); damage(k, 90, 'saw', 'BUZZED!', Z.x, Z.y); }
    if (Z.t > 1.6) Z.dead = true;
  }
  buzz = buzz.filter(Z => !Z.dead);
  // mortar shells (fired on landing) and drone bombs
  for (const M of myShells) {
    M.t += dt; if (M.t < M.T) continue; M.dead = true; smallBoom(M.tx, M.ty, M.R); if (!M.drone) fires.push({ x: M.tx, y: M.ty, r: M.R * 0.5, t: 0, life: 1.2, mine: true });
    for (const k of cars) { if (k.dead) continue; const d = Math.hypot(k.x - M.tx, k.y - M.ty); if (d < M.R) { damage(k, M.dmg * (1 - d / M.R * 0.5), M.drone ? 'drone' : 'mortar', 'BOOM!', M.tx, M.ty); if (!k.dead) { k.vx += (k.x - M.tx) / (d || 1) * 220; k.vy += (k.y - M.ty) / (d || 1) * 220; k.frag = Math.max(k.frag, 0.8); } } }
    hitBossNear(M.tx, M.ty, M.R * 0.6, M.dmg, M.drone ? 'drone' : 'mortar');
    for (const b of drums) if (!b.gone && Math.hypot(b.x - M.tx, b.y - M.ty) < M.R * 0.6) b.fuse = b.fuse || 0.1;
  }
  myShells = myShells.filter(M => !M.dead);
  // bomb drones (TAKEDOWN): they circle you; each takedown sends them to bomb the next car, which can set off the next
  if (up.drone) {
    const L = up.drone, want = 1 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0);
    while (drones.length < want) drones.push({ x: player.x, y: player.y, ph: drones.length * TAU / want, sortie: null, sT: 0, hunt: 0, fire: 0 });
    for (const [i, D] of drones.entries()) {
      D.ph += dt * 2.4; let gx = player.x + Math.cos(D.ph + i * TAU / want) * 72, gy = player.y + Math.sin(D.ph + i * TAU / want) * 72, k = 8;
      if (D.sortie && (D.sortie.dead || D.sT > 1.2)) D.sortie = null;
      if (D.sortie) {   // a bombing run
        const T = D.sortie; D.sT += dt; gx = T.x; gy = T.y; k = 7;
        if (Math.hypot(T.x - D.x, T.y - D.y) < 46) { myShells.push({ sx: D.x, sy: D.y, tx: T.x + T.vx * 0.3, ty: T.y + T.vy * 0.3, t: 0, T: 0.3, R: 60 + (L >= 2 ? 15 : 0) + (L >= 4 ? 15 : 0), dmg: 34 + 10 * L, drone: true }); D.sortie = null; }
      } else if (D.hunt > 0) {   // Hornet Swarm: guns out for a few seconds after a takedown
        D.hunt -= dt; const T = carsNear(D.x, D.y, 420)[i % 2] || carsNear(D.x, D.y, 420)[0];
        if (T) { gx = T.x + Math.cos(D.ph * 1.7) * 60; gy = T.y + Math.sin(D.ph * 1.7) * 60; k = 5; D.fire -= dt; if (D.fire <= 0) { D.fire = 0.16; const a = Math.atan2(T.y - D.y, T.x - D.x); bullets.push({ x: D.x, y: D.y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, t: 0, dmg: 13, src: 'drone' }); } }
      }
      D.x += (gx - D.x) * ease(k, dt); D.y += (gy - D.y) * ease(k, dt);
    }
  } else drones = [];
  for (const Z of zaps) Z.t += dt; zaps = zaps.filter(Z => Z.t < Z.life);
  // thunder-sticks (SIDE): lances lobbed at cars riding beside you, exploding where they land
  if (up.lance) {
    const L = up.lance; AT.lance -= dt;
    if (AT.lance <= 0) {
      const rgtX = -sa, rgtY = ca, side = s => cars.filter(k => { if (k.dead) return false; const rx = k.x - player.x, ry = k.y - player.y, lon = rx * ca + ry * sa, lat = (rx * rgtX + ry * rgtY) * s; return lat > 30 && lat < 260 && Math.abs(lon) < 160; }).sort((p, q) => Math.hypot(p.x - player.x, p.y - player.y) - Math.hypot(q.x - player.x, q.y - player.y));
      const L1 = side(-1), R1 = side(1), sides = L >= 3 ? [L1, R1] : [L1.length >= R1.length ? L1 : R1], per = L >= 5 ? 2 : 1;
      let thrown = 0;
      for (const list of sides) for (const k of list.slice(0, per)) { myLances.push({ sx: player.x, sy: player.y, tx: k.x + k.vx * 0.4, ty: k.y + k.vy * 0.4, t: 0, T: 0.4, R: 70 + (L >= 2 ? 18 : 0), dmg: 50 + 14 * L }); thrown++; }
      if (!thrown && boss && !boss.dead) for (const q of bossPoints()) { const rx = q.x - player.x, ry = q.y - player.y, lon = rx * ca + ry * sa, lat = Math.abs(rx * rgtX + ry * rgtY); if (lat > 30 && lat < 300 && Math.abs(lon) < 200) { myLances.push({ sx: player.x, sy: player.y, tx: q.x + boss.vx * 0.4, ty: q.y + boss.vy * 0.4, t: 0, T: 0.4, R: 70 + (L >= 2 ? 18 : 0), dmg: 50 + 14 * L }); thrown++; break; } }   // a boss riding beside you gets one too
      AT.lance = thrown ? (L >= 4 ? 2 : 2.6) : 0.3; if (thrown) SFX.whoosh();
    }
  }
  for (const M of myLances) {
    M.t += dt; if (M.t < M.T) continue; M.dead = true; smallBoom(M.tx, M.ty, M.R);
    for (const k of cars) { if (k.dead) continue; const d = Math.hypot(k.x - M.tx, k.y - M.ty); if (d < M.R) damage(k, M.dmg * (1 - d / M.R * 0.4), 'lance', 'BLAM!', M.tx, M.ty); }
    hitBossNear(M.tx, M.ty, M.R * 0.6, M.dmg, 'lance');
  }
  myLances = myLances.filter(M => !M.dead);
}

// ============ drawing the arsenal ============
function drawArsenalGround() {   // slicks and the rings where your shells will land
  drawEqGround();   // the demo's oil
  for (const S of slicks) {
    if (!inView(S.x, S.y, S.r)) continue;
    ctx.save(); ctx.globalAlpha = Math.min(1, (S.life - S.t) * 1.5);
    const pts = blob(S.x, S.y, S.r, S.seed); inkPoly(ctx, pts, '#1d1726', { lw: 2, double: false });
    for (const [col, k] of [['rgba(199,125,255,.5)', 0.7], ['rgba(80,220,255,.45)', 0.5]]) { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(S.x - 6, S.y - 4, S.r * k, 3.6, 5.6); ctx.stroke(); }
    ctx.restore();
  }
  for (const M of myShells) if (!M.drone && M.t > -0.05) { const k = clamp(M.t / M.T, 0, 1); ctx.save(); ctx.globalAlpha = 0.35 + k * 0.4; ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(M.tx, M.ty, M.R * (1.2 - k * 0.2), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
}
function drawArsenalAir() {   // saws, drones, shells and lances in flight, lightning
  if (up.saw && state !== 'menu') for (const B of sideSaws()) { ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(clock * 26); ink(ctx, () => starPath(ctx, 0, 0, B.r, 10, 0.72), 'chrome', { lw: 1.6, double: false }); inkCircle(ctx, 0, 0, B.r * 0.35, 'gun', { lw: 1.2, double: false }); ctx.restore(); }
  for (const Z of buzz) { ctx.save(); ctx.translate(Z.x, Z.y); ctx.rotate(clock * 30); ink(ctx, () => starPath(ctx, 0, 0, 18, 10, 0.7), 'chrome', { lw: 1.8, double: false }); ctx.restore(); }
  for (const D of drones) {
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(D.x + 14, D.y + 20, 9, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(D.x, D.y - 10);
    for (const [ox, oy] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { ctx.strokeStyle = 'rgba(36,22,15,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(ox, oy, 6, 2, clock * 40 + ox, 0, TAU); ctx.stroke(); }
    inkLine(ctx, [[-9, -9], [9, 9]], 2); inkLine(ctx, [[9, -9], [-9, 9]], 2);
    inkRR(ctx, -5, -4, 10, 8, 2, evo('gun') ? 'yellow' : '#7fd6ff', { lw: 1.4, double: false });
    ctx.restore();
  }
  for (const M of myShells) { if (M.t < 0) continue; const k = clamp(M.t / M.T, 0, 1), x = M.sx + (M.tx - M.sx) * k, y = M.sy + (M.ty - M.sy) * k, h = Math.sin(k * Math.PI) * (M.drone ? 10 : 150); inkCircle(ctx, x, y - h, M.drone ? 4.5 : 6.5, 'dark', { lw: 1.2, double: false }); }
  for (const M of myLances) { const k = clamp(M.t / M.T, 0, 1), x = M.sx + (M.tx - M.sx) * k, y = M.sy + (M.ty - M.sy) * k, h = Math.sin(k * Math.PI) * 60, a = Math.atan2(M.ty - M.sy, M.tx - M.sx); ctx.save(); ctx.translate(x, y - h); ctx.rotate(a); inkLine(ctx, [[-18, 0], [10, 0]], 3, PAL.steel); inkPoly(ctx, [[10, -4], [20, 0], [10, 4]], 'orange', { lw: 1.2, double: false }); ctx.restore(); }
  for (const Z of zaps) {   // a jagged blue-white bolt
    const R2 = seeded(Z.seed + Math.floor(Z.t * 30)), n = 6; ctx.save(); ctx.globalAlpha = 1 - Z.t / Z.life; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(Z.x0, Z.y0); for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(Z.x0 + (Z.x1 - Z.x0) * t + (R2() - 0.5) * 30, Z.y0 + (Z.y1 - Z.y0) * t + (R2() - 0.5) * 30); } ctx.lineTo(Z.x1, Z.y1);
    ctx.strokeStyle = '#7fe7ff'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
  }
}
