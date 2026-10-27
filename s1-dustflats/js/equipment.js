'use strict';
// Fuel Run · equipment.js: the demo's seven attachments, what each rank does, and how they look on the car.
// None has a button: each works from how you drive. Forks change your nose rams, the gun fires along your nose, the
// shield takes hits from behind, saws cut what rides against your sides, the cannon lobs a shell at a group ahead, the
// flamethrower and the oil work on whoever chases you (or while you drift), and flame lights your own oil. Every number lives in EQ, one row per rank; damage keeps fractions; cooldowns and shots
// move on the game clock, so 30, 60 and 120 frames a second do the same thing. A weapon's wreck is yours.
// Classic scripts sharing one global scope, loaded in order by index.html.

const EQ = {
  forks:  [{ pips: 1, shove: 1.35, arc: 0.8,  guard: 0 },   { pips: 1, shove: 1.7, arc: 0.95, guard: 0 },   { pips: 2, shove: 2.0, arc: 0.95, guard: 0.7 }],   // guard: share of a nose-to-nose hit a landed ram keeps off you
  gun:    [{ range: 420, arc: Math.PI, shots: 4, gap: 0.09, rest: 1.1, dmg: 9, twin: false }, { range: 460, arc: Math.PI, shots: 6, gap: 0.08, rest: 0.85, dmg: 10, twin: false }, { range: 500, arc: Math.PI, shots: 6, gap: 0.08, rest: 0.75, dmg: 12, twin: true }],   // a roof turret: any direction
  shield: [{ cap: 10, recharge: 7, arc: 0.9 }, { cap: 16, recharge: 6, arc: 1.0 }, { cap: 18, recharge: 4, arc: 1.25 }],   // cap: fuel it soaks from behind before it breaks; recharge: seconds after its last hit to come back full
  saws:   [{ dps: 45, reach: 15, len: 46 }, { dps: 70, reach: 18, len: 50 }, { dps: 95, reach: 24, len: 58 }],   // damage a second to a car against the blades (half on armour), how far out and how long the blades reach
  cannon: [{ range: 520, arc: 1.6, speed: 650, dmg: 90, R: 80, reload: 2.6, frag: 0 }, { range: 560, arc: 1.6, speed: 700, dmg: 120, R: 105, reload: 2.2, frag: 0 }, { range: 600, arc: 1.6, speed: 750, dmg: 150, R: 125, reload: 1.7, frag: 160 }],   // frag: shrapnel reach
  flame:  [{ range: 120, arc: 0.5, dps: 40, trail: 0 }, { range: 150, arc: 0.55, dps: 60, trail: 0 }, { range: 180, arc: 0.6, dps: 80, trail: 1.6 }],   // trail: how long the burning trail lies
  oil:    [{ cd: 2.2, r: 50, life: 6, slide: 1.2 }, { cd: 1.8, r: 65, life: 8, slide: 1.4 }, { cd: 1.5, r: 80, life: 10, slide: 1.7 }],   // a slick every cd seconds while chased or drifting
};
const EQ_READY = { forks: true, gun: true, shield: true, saws: true, cannon: true, flame: true, oil: true };
const SHOT_SPEED = 1100;
let eqShotId = 0;

function eqNew() { return { gunCD: 0, burst: 0, gunA: 0, gunFlash: 0, shieldHP: 0, shieldT: 0, shieldHitT: -9, shots: [], drawn: [], fitT: {}, act: {}, canCD: 0.6, canA: 0, canFlash: 0, shells: [], flameOn: false, trailT: 0, oilCD: 0, slicks: [], sawT: 0, sndT: {} }; }
const eqAct = id => { const E = demo && demo.eq; if (E) E.act[id] = (E.act[id] || 0) + 1; };   // it did its job (tests read this)
const eqSnd = (k, gap, fn) => { const E = demo.eq; if ((E.sndT[k] || 0) <= time) { E.sndT[k] = time + gap; fn(); } };
const eqR = id => draftRank(id), eqCfg = id => { const r = eqR(id); return r ? EQ[id][r - 1] : null; };
function eqFitted(id) {   // just fitted or ranked up: the part shows it, a fresh shield is full
  const E = demo.eq; E.fitT[id] = time;
  if (id === 'shield') { E.shieldHP = EQ.shield[eqR('shield') - 1].cap; E.shieldT = 0; }
}
function eqPreview(id, r) {   // the numbers behind a card, in words a player can check
  const C = EQ[id] && EQ[id][r - 1]; if (!C) return '';
  if (id === 'forks') return `+${C.pips} pip a nose ram · shove ×${C.shove}${C.guard ? ` · nose hits −${Math.round(C.guard * 100)}%` : ''}`;
  if (id === 'gun') return `${C.shots}-round bursts${C.twin ? ' ×2' : ''} · range ${C.range} · rest ${C.rest}s`;
  if (id === 'shield') return `soaks ${C.cap} fuel from behind · back in ${C.recharge}s`;
  if (id === 'saws') return `${C.dps} damage a second against your sides · reach ${C.reach}`;
  if (id === 'cannon') return `${C.dmg} damage, ${C.R} wide burst · reload ${C.reload}s${C.frag ? ' · shrapnel' : ''}`;
  if (id === 'flame') return `${C.dps} damage a second · reach ${C.range}${C.trail ? ' · burning trail' : ''}`;
  if (id === 'oil') return `a ${C.r}-wide slick every ${C.cd}s · lasts ${C.life}s`;
  return '';
}
const eqCause = kind => ({ kind: 'weapon', weapon: kind, playerCaused: true, at: time });
function eqHitCar(k, n, src, word, x, y) {   // a weapon hit on a raider: yours, with the fraction kept
  if (!k || k.dead) return; markPlayerCause(k, 'weapon'); damage(k, n, src, word, x, y, true, eqCause(src));
}

// ============ the tick ============
function eqUpdate(dt) {
  const E = demo.eq; E.gunFlash = Math.max(0, E.gunFlash - dt);
  E.canFlash = Math.max(0, E.canFlash - dt);
  eqGun(dt); eqShots(dt); eqShieldTick(dt); eqSaws(dt); eqCannon(dt); eqShells(dt); eqOil(dt); eqFlame(dt); eqBoarders(); eqFires(dt);
}
// ---- machine gun: a roof turret that swivels to the nearest raider on any side and bursts once it's lined up, with a clear line to it ----
const GUN_TURN = 9, GUN_LINED = 0.22;   // how fast the turret swivels (radians a second), and how close to the target it must point to fire
const eqRay = (x, y, a, max) => { for (let d = 12; d <= max; d += 12) { const c = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 3 }; if (walls.some(B => circleRect(c, B)) || posts.some(p => circleCircle(c, p))) return d - 6; } return max; };   // how far a straight line gets before rock
const eqLOS = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 18); for (let i = 1; i < n; i++) { const t = i / n, c = { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, r: 3 }; if (walls.some(B => circleRect(c, B)) || posts.some(p => circleCircle(c, p))) return false; } return true; };
function eqGunTarget(C) {
  let best = null, bd = C.range;
  for (const k of cars) {
    if (k.dead) continue; const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy) - k.r;
    if (d < bd && Math.abs(angDiff(player.a, Math.atan2(dy, dx))) <= C.arc && eqLOS(player.x, player.y, k.x, k.y)) { bd = d; best = k; }   // <=: a turret's arc of pi takes a raider dead astern too
  }
  const B = activeBoss();   // the boss: its weak point when it's open, else its body (the armour rings, so you learn when to shoot)
  if (B) { const W = bossWeak(B), t = W && W.open ? W : B, d = Math.hypot(t.x - player.x, t.y - player.y) - (t.r || 30);
    if (d < bd && Math.abs(angDiff(player.a, Math.atan2(t.y - player.y, t.x - player.x))) <= C.arc && eqLOS(player.x, player.y, t.x, t.y)) best = { x: t.x, y: t.y, vx: B.vx, vy: B.vy, boss: true }; }
  return best;
}
function eqGun(dt) {
  const C = eqCfg('gun'), E = demo.eq; if (!C) return;
  E.gunCD -= dt;
  const k = eqGunTarget(C);
  let aim = player.a;
  if (k) {   // lead the target: a round keeps 0.4 of your car's speed, so aim where it will be relative to that
    const rvx = (k.vx || 0) - player.vx * 0.4, rvy = (k.vy || 0) - player.vy * 0.4; let tx = k.x, ty = k.y;
    for (let i = 0; i < 3; i++) { const t = Math.hypot(tx - player.x, ty - player.y) / SHOT_SPEED; tx = k.x + rvx * t; ty = k.y + rvy * t; }
    aim = Math.atan2(ty - player.y, tx - player.x);
  }
  const turn = angDiff(E.gunA, aim);
  E.gunA += clamp(turn, -GUN_TURN * dt, GUN_TURN * dt);   // the turret swivels toward its target (or back to the nose)
  if (!k || Math.abs(angDiff(E.gunA, aim)) > GUN_LINED) { E.gunCD = Math.max(0, E.gunCD); return; }   // nothing to shoot, or still turning: no shots are banked
  for (let guard = 0; E.gunCD <= 0 && guard < 4; guard++) {   // the cooldown keeps its remainder, so 30 and 120 frames a second fire the same rounds
  if (E.burst <= 0) E.burst = C.shots;
  for (const side of C.twin ? [-1, 1] : [0]) {
    const ox = player.x + Math.cos(player.a) * 6 + Math.cos(E.gunA) * 12 - Math.sin(E.gunA) * side * 5, oy = player.y + Math.sin(player.a) * 6 + Math.sin(E.gunA) * 12 + Math.cos(E.gunA) * side * 5;   // from the turret's barrel
    E.shots.push({ id: ++eqShotId, x: ox, y: oy, vx: Math.cos(E.gunA) * SHOT_SPEED + player.vx * 0.4, vy: Math.sin(E.gunA) * SHOT_SPEED + player.vy * 0.4, t: 0, dmg: C.dmg, src: 'gun', range: C.range + 60 });
  }
  E.burst--; E.gunCD += E.burst > 0 ? C.gap : C.rest; E.gunFlash = 0.05; SFX.gun(); eqAct('gun');
  }
}
function eqShots(dt) {   // each shot sweeps its whole step: the first car, drum or wall on that line takes it
  const E = demo.eq;
  for (const s of E.shots) {
    const x0 = s.x, y0 = s.y, x1 = s.x + s.vx * dt, y1 = s.y + s.vy * dt, L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    let hitT = Infinity, hit = null;
    const circ = (cx, cy, r, what) => { const fx = cx - x0, fy = cy - y0, t = fx * ux + fy * uy, d2 = fx * fx + fy * fy - t * t; if (d2 > r * r) return; const t0 = t - Math.sqrt(r * r - d2); if (t0 >= -r && t0 <= L && t0 < hitT) { hitT = Math.max(0, t0); hit = what; } };
    for (const k of cars) if (!k.dead) circ(k.x, k.y, k.r + 3, { k });
    if (activeBoss()) for (const p of bossPoints()) circ(p.x, p.y, p.r + 2, { boss: true });
    for (const b of drums) if (!b.gone) circ(b.x, b.y, b.r + 2, { drum: b });
    for (const p of posts) if (Math.abs(p.x - x0) < L + 80 && Math.abs(p.y - y0) < L + 80) circ(p.x, p.y, p.r, { wall: true });
    const n = Math.ceil(L / 8); for (let i = 1; i <= n && hitT === Infinity; i++) { const t = L * i / n, c = { x: x0 + ux * t, y: y0 + uy * t, r: 2 }; if (walls.some(B => circleRect(c, B))) { hitT = t; hit = { wall: true }; } }
    if (hit) {
      const hx = x0 + ux * hitT, hy = y0 + uy * hitT; s.dead = true;
      if (hit.k) { eqHitCar(hit.k, s.dmg, s.src, 'SHREDDED!', hx, hy); hit.k.vx += s.vx * 0.012; hit.k.vy += s.vy * 0.012; SFX.ping(); for (let i = 0; i < 3; i++) parts.push({ k: 'spark', x: hx, y: hy, vx: -s.vx * 0.2 + crand(-160, 160), vy: -s.vy * 0.2 + crand(-160, 160), t: 0, life: 0.18 }); }
      else if (hit.boss) { const took = bossHit({ n: s.dmg, src: s.src, x: hx, y: hy, id: 's' + s.id }); parts.push({ k: 'spark', x: hx, y: hy, vx: crand(-160, 160), vy: crand(-160, 160), t: 0, life: 0.18 }); if (took) SFX.ping(); }
      else if (hit.drum) { hit.drum.byYou = true; drumBoom(hit.drum); }
      else parts.push({ k: 'spark', x: hx, y: hy, vx: crand(-120, 120), vy: crand(-120, 120), t: 0, life: 0.15 });
    } else { s.x = x1; s.y = y1; }
    s.t += dt; if (s.t * SHOT_SPEED > s.range) s.dead = true;
  }
  E.shots = E.shots.filter(s => !s.dead);
}
// ---- rear shield ----
function eqShieldTick(dt) {
  const C = eqCfg('shield'), E = demo.eq; if (!C) return;
  if (E.shieldHP < C.cap) { E.shieldT -= dt; if (E.shieldT <= 0) { E.shieldHP = C.cap; SFX.close(); } }
}
function eqShieldTake(n, fromX, fromY) {   // a vehicle hit from (fromX, fromY): what's left for the tank after the shield (behind you only)
  const C = eqCfg('shield'), E = demo && demo.eq; if (!C || !E || E.shieldHP <= 0 || n <= 0) return n;
  if (Math.abs(angDiff(player.a + Math.PI, Math.atan2(fromY - player.y, fromX - player.x))) > C.arc) return n;
  const took = Math.min(n, E.shieldHP); E.shieldHP -= took; E.shieldT = C.recharge; E.shieldHitT = time; eqAct('shield');
  pops.push({ x: player.x, y: player.y + 46, text: E.shieldHP > 0 ? 'BLOCKED!' : 'SHIELD DOWN!', col: '#7fd6ff', t: 0, small: 1 }); SFX.clang();
  for (let i = 0; i < 6; i++) parts.push({ k: 'spark', x: player.x - Math.cos(player.a) * 30, y: player.y - Math.sin(player.a) * 30, vx: crand(-200, 200), vy: crand(-200, 200), t: 0, life: 0.25 });
  return n - took;
}
// ---- forks: one ram event, made heavier ----
function eqFork() { return eqCfg('forks'); }
// ---- the forks' evolution (the lab): a battering ram. A committed hit with your nose sends a short shockwave forward ----
const RAM_WAVE = { reach: 150, arc: 0.62, cd: 1.4, minIn: 200, shove: 380 };   // how far and how wide the wave goes from the nose, its cooldown, the closing speed that counts as committed, its push
const eqRamOn = () => !!(demo && demo.build && demo.build.evolved && demo.build.evolved.forks === 'ram' && eqR('forks'));
function eqRamWave(pIn) {   // after a nose hit (update.js): a wave only for a committed hit, once per cooldown; each car in the drawn wedge, in sight of the nose, is hit once
  const E = demo.eq; if (!eqRamOn() || pIn < RAM_WAVE.minIn) return 0;
  E.ramChances = (E.ramChances || 0) + 1; if ((E.ramCD || 0) > time) return 0;   // a chance: a committed nose hit with the ram fitted (the cooldown may still hold it)
  E.ramCD = time + RAM_WAVE.cd; E.ramWaves = (E.ramWaves || 0) + 1; if (nitroT > 0) E.ramWavesBoosted = (E.ramWavesBoosted || 0) + 1;
  const a = player.a, nx = player.x + Math.cos(a) * player.r, ny = player.y + Math.sin(a) * player.r; let n = 0;
  E.ramFx = { x: nx, y: ny, a, t0: time };
  for (const k of cars) {
    if (k.dead || k.stageBoss) continue;
    const dx = k.x - nx, dy = k.y - ny, d = Math.hypot(dx, dy);
    if (d > RAM_WAVE.reach + k.r * 0.5 || Math.abs(angDiff(a, Math.atan2(dy, dx))) > RAM_WAVE.arc || !eqLOS(nx, ny, k.x, k.y)) continue;
    n++; const u = Math.atan2(dy, dx), f = RAM_WAVE.shove * (1 - d / (RAM_WAVE.reach + 40)) / Math.max(0.5, k.m);
    eqHitCar(k, k.T.light ? k.hp + 1 : PIP, 'ram', 'SHOCKWAVE!', k.x, k.y);
    if (!k.dead) { k.vx += Math.cos(u) * f; k.vy += Math.sin(u) * f; k.stun = Math.max(k.stun, 0.8); k.frag = Math.max(k.frag, 1); }
  }
  E.ramWaveHits = (E.ramWaveHits || 0) + n; eqAct('forks');
  shake = Math.max(shake, 5 * (calmMotion ? 0.3 : 1)); SFX.clang(); pops.push({ x: nx + Math.cos(a) * RAM_WAVE.reach * 0.8, y: ny + Math.sin(a) * RAM_WAVE.reach * 0.8 - 20, text: 'RAM!', col: '#ffd23f', t: 0 });   // the word rides the wave's front, off your car
  return n;
}
function drawRamFx() {   // the wave: the very wedge it hits, with two hazard-striped fronts (the ram's own yellow and black) running out from your nose; no other hit looks like it
  const E = demo && demo.eq, F = E && E.ramFx; if (!F) return; const k = (time - F.t0) / 0.4; if (k > 1 || k < 0) return;
  const arc = (r) => { ctx.beginPath(); ctx.arc(0, 0, r, -RAM_WAVE.arc, RAM_WAVE.arc); ctx.stroke(); };
  ctx.save(); ctx.translate(F.x, F.y); ctx.rotate(F.a);
  ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, RAM_WAVE.reach, -RAM_WAVE.arc, RAM_WAVE.arc); ctx.closePath(); ctx.fill();
  for (const [lag, lw] of [[0, 10], [0.18, 6]]) {
    const q = clamp((k - lag) / (1 - lag), 0, 1), r = RAM_WAVE.reach * (0.3 + 0.7 * q); if (q <= 0) continue;
    ctx.globalAlpha = 1 - q * 0.8; ctx.lineWidth = lw + 4; ctx.strokeStyle = INK; arc(r); ctx.lineWidth = lw; ctx.strokeStyle = PAL.yellow; arc(r);
    ctx.setLineDash([9, 9]); ctx.strokeStyle = PAL.dark; arc(r); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1 - k; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, RAM_WAVE.reach, -RAM_WAVE.arc, RAM_WAVE.arc); ctx.closePath(); ctx.stroke();
  ctx.restore();
}
// ---- side saws: whatever rides against the blades is cut, a little every tick ----
const eqLocal = (x, y) => { const dx = x - player.x, dy = y - player.y, ca = Math.cos(player.a), sa = Math.sin(player.a); return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
const eqOnBlade = (C, x, y, r) => { const [lon, lat] = eqLocal(x, y); return Math.abs(lon) <= C.len / 2 + r * 0.4 && Math.abs(lat) >= player.r * 0.55 && Math.abs(lat) - (player.r + C.reach) <= r; };
function eqSaws(dt) {
  const C = eqCfg('saws'); if (!C) return; let cut = false;
  for (const k of cars) {
    if (k.dead || !eqOnBlade(C, k.x, k.y, k.r)) continue;
    const [, lat] = eqLocal(k.x, k.y), sx = player.x - Math.sin(player.a) * Math.sign(lat) * (player.r + C.reach * 0.5), sy = player.y + Math.cos(player.a) * Math.sign(lat) * (player.r + C.reach * 0.5);
    eqHitCar(k, C.dps * dt * (k.T.armour ? 0.5 : 1), 'saw', 'SAWN!', sx, sy); cut = true;
    if (cchance() < 0.5) parts.push({ k: 'spark', x: sx, y: sy, vx: crand(-220, 220) - player.vx * 0.2, vy: crand(-220, 220) - player.vy * 0.2, t: 0, life: 0.22 });
  }
  const B = activeBoss(), W = B && bossWeak(B);
  if (W && W.open && eqOnBlade(C, W.x, W.y, W.r)) { bossHit({ n: C.dps * dt, src: 'saw', x: W.x, y: W.y }); cut = true; }
  if (cut) { eqAct('saws'); eqSnd('saw', 0.12, () => SFX.grind()); }
}
// ---- heavy cannon: a slow shell at the thickest group ahead or beside you, a burst where it lands; walls stop it and shade the burst ----
function eqCannon(dt) {
  const C = eqCfg('cannon'), E = demo.eq; if (!C) return; E.canCD -= dt;
  let best = null, bs = -1;
  const consider = (x, y, score) => { const d = Math.hypot(x - player.x, y - player.y), a = Math.atan2(y - player.y, x - player.x); if (d > C.range || d < 90 || Math.abs(angDiff(player.a, a)) > C.arc || !eqLOS(player.x, player.y, x, y)) return; const s = score * 1000 - d; if (s > bs) { bs = s; best = { x, y }; } };
  for (const k of cars) if (!k.dead) consider(k.x, k.y, cars.filter(o => !o.dead && Math.hypot(o.x - k.x, o.y - k.y) < C.R).length);
  const B = activeBoss(), W = B && bossWeak(B); if (W && W.open) consider(W.x, W.y, 5);
  const aim = best ? Math.atan2(best.y - player.y, best.x - player.x) : player.a;
  E.canA = player.a + clamp(angDiff(player.a, aim), -C.arc, C.arc);
  if (!best) { E.canCD = Math.max(0, E.canCD); return; }
  if (E.canCD > 0) return;
  const ox = player.x - Math.cos(player.a) * 10, oy = player.y - Math.sin(player.a) * 10, d = Math.hypot(best.x - ox, best.y - oy);
  E.shells.push({ id: ++eqShotId, x: ox, y: oy, vx: Math.cos(E.canA) * C.speed + player.vx * 0.3, vy: Math.sin(E.canA) * C.speed + player.vy * 0.3, t: 0, life: (d + 30) / C.speed, C });
  E.canCD += C.reload; E.canFlash = 0.12; player.vx -= Math.cos(E.canA) * 30; player.vy -= Math.sin(E.canA) * 30; SFX.thud(); shake = Math.max(shake, 2.5 * (calmMotion ? 0.3 : 1)); eqAct('cannon');
}
function eqShells(dt) {
  const E = demo.eq;
  for (const s of E.shells) {
    const x0 = s.x, y0 = s.y; s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
    const hitCar = cars.find(k => !k.dead && Math.hypot(k.x - s.x, k.y - s.y) < k.r + 8), B = activeBoss(), hitBoss = B && bossPoints().some(p => Math.hypot(p.x - s.x, p.y - s.y) < p.r + 6);
    const wall = !eqLOS(x0, y0, s.x, s.y) || blocked(s.x, s.y, 4);
    if (hitCar || hitBoss || wall || s.t >= s.life) { s.dead = true; eqBurst(wall ? x0 : s.x, wall ? y0 : s.y, s, hitCar); }
  }
  E.shells = E.shells.filter(s => !s.dead);
}
function eqBurst(x, y, s, direct) {   // where a shell lands: full damage at the middle, half at the edge, nothing behind a wall
  const C = s.C; smallBoom(x, y, C.R); parts.push({ k: 'ring', x, y, t: 0, life: 0.35, R: C.R }); SFX.crash(); shake = Math.max(shake, 4 * (calmMotion ? 0.3 : 1));
  for (let i = 0; i < 8; i++) { const a = crand(0, TAU), sp = crand(120, 320); parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.25, 0.4), size: crand(8, 13) }); }
  for (const k of cars) {
    if (k.dead) continue; const d = Math.hypot(k.x - x, k.y - y);
    if (k === direct || (d < C.R + k.r && eqLOS(x, y, k.x, k.y))) { eqHitCar(k, k === direct ? C.dmg : C.dmg * (1 - 0.5 * Math.min(1, d / C.R)), 'cannon', 'BLASTED!', x, y); if (!k.dead && d > 1) { const f = 260 * (1 - Math.min(1, d / C.R)) + 80; k.vx += (k.x - x) / d * f; k.vy += (k.y - y) / d * f; k.frag = Math.max(k.frag, 0.7); } }
    else if (C.frag && d < C.frag + k.r && eqLOS(x, y, k.x, k.y)) eqHitCar(k, 20, 'cannon', 'SHRAPNEL!', x, y);
  }
  const B = activeBoss(), W = B && bossWeak(B);
  if (B && W) {   // the burst hurts the boss only by reaching its weak point with a clear line; on the armour alone it rings
    if (Math.hypot(W.x - x, W.y - y) < C.R + W.r && eqLOS(x, y, W.x, W.y)) bossHit({ n: C.dmg, src: 'cannon', x: W.x, y: W.y, id: 'c' + s.id });
    else if (Math.hypot(B.x - x, B.y - y) < C.R + 40 && eqLOS(x, y, B.x, B.y)) bossBlocked(B, B.x, B.y);
  }
  for (const b of drums) if (!b.gone && Math.hypot(b.x - x, b.y - y) < C.R * 0.7 && eqLOS(x, y, b.x, b.y)) { b.byYou = true; b.fuse = b.fuse || 0.1; }
}
// ---- flamethrower: a rear jet at whoever's on your tail, or swept out of a drift; rank 3 leaves a burning trail ----
const eqTailLen = () => -CAR_ART[player.car].tail * CAR * player.size * 0.72;   // centre to the drawn tail, per car
const eqTail = () => { const L = eqTailLen(); return [player.x - Math.cos(player.a) * L, player.y - Math.sin(player.a) * L]; };
function eqFlame(dt) {
  const C = eqCfg('flame'), E = demo.eq; if (!C) { E.flameOn = false; return; }
  const back = player.a + Math.PI, [tx, ty] = eqTail(), reach = eqTailLen() + C.range, v = Math.hypot(player.vx, player.vy), drifting = player.slip > 0.3 && v > 160 && !player.air;
  const behind = (x, y, r, dir = back, arc = C.arc) => Math.hypot(x - player.x, y - player.y) < reach + r && Math.abs(angDiff(dir, Math.atan2(y - player.y, x - player.x))) < arc;   // measured from the car's centre: a raider on your bumper is in the jet too
  const sees = (x, y, r) => { const dx = x - tx, dy = y - ty, l = Math.hypot(dx, dy) || 1, px = -dy / l * r * 0.7, py = dx / l * r * 0.7; return eqLOS(tx, ty, x, y) || eqLOS(tx, ty, x + px, y + py) || eqLOS(tx, ty, x - px, y - py); };   // its middle or an edge in sight of the nozzle: rock stops the jet
  const chaser = cars.filter(k => !k.dead && behind(k.x, k.y, k.r) && sees(k.x, k.y, k.r)).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
  const B = activeBoss(), W = B && bossWeak(B), wIn = W && W.open && behind(W.x, W.y, W.r, back, FLAME_SWING) && sees(W.x, W.y, W.r);   // the jet swings to an open weak point well off your tail
  E.flameOn = !!(chaser || drifting || wIn); if (!E.flameOn) return;
  const lat = -Math.sin(player.a) * player.vx + Math.cos(player.a) * player.vy, fa = chaser ? Math.atan2(chaser.y - player.y, chaser.x - player.x) : wIn ? Math.atan2(W.y - player.y, W.x - player.x) : back - Math.sign(lat || 1) * 0.45;
  E.flameA = fa; eqAct('flame');
  const jet = eqRay(tx, ty, fa, C.range + 30);   // how far the jet gets before rock: the flames stop there
  if (jet < C.range && cchance() < 0.5) parts.push({ k: 'spark', x: tx + Math.cos(fa) * jet, y: ty + Math.sin(fa) * jet, vx: crand(-90, 90), vy: crand(-90, 90), t: 0, life: 0.2 });
  for (let i = 0; i < 2; i++) { const a = fa + crand(-0.25, 0.25), life = crand(0.22, 0.34), sp = Math.min(crand(C.range * 2.2, C.range * 3), jet / life); parts.push({ k: 'fire', x: tx, y: ty, vx: Math.cos(a) * sp + player.vx * 0.5, vy: Math.sin(a) * sp + player.vy * 0.5, t: 0, life, size: crand(7, 12) }); }
  for (const k of cars) if (!k.dead && behind(k.x, k.y, k.r, fa, C.arc * 0.9) && sees(k.x, k.y, k.r)) eqHitCar(k, C.dps * dt, 'flame', 'TOASTED!', k.x, k.y);
  if (wIn) bossHit({ n: C.dps * FLAME_OPEN * dt, src: 'flame', x: W.x, y: W.y });   // the jet into an open weak point: the reward for turning your tail to it
  if (wIn && !E.alight) { E.alight = { dps: C.dps }; pops.push({ x: W.x, y: W.y - 44, text: `${BOSS_KINDS[B.kind].weakName || 'TANK'} ALIGHT!`, col: '#ffb02e', t: 0 }); SFX.flame(); }   // one touch sets it burning: a drive-by is enough
  else if (wIn) E.alight.dps = Math.max(E.alight.dps, C.dps);
  for (const S of E.slicks) if (!S.lit && behind(S.x, S.y, S.r * 0.5, fa, C.arc + 0.3) && eqLOS(tx, ty, S.x, S.y)) eqLight(S);   // your oil goes up
  if (C.trail) { E.trailT -= dt; if (E.trailT <= 0) { E.trailT = 0.15; fires.push({ x: tx, y: ty, r: 30, t: 0, life: C.trail, mine: true, byYou: true, eq: true }); } }
  eqSnd('flame', 0.25, () => SFX.flame());
}
const FLAME_OPEN = 2.5, FIRE_OPEN_DPS = 45, FLAME_SWING = 1.2;   // the jet's damage into an open weak point (x its rate on raiders); your fire under one, a second; how far off your tail (radians) the jet swings to one
function eqBoarders() {   // a war boy on your roof: side saws cut him loose in under half a second, a flamethrower toasts him off in a second
  const b = player.boarders[0]; if (!b) return;
  const how = eqCfg('saws') && b.t > 0.45 ? 'CUT LOOSE!' : eqCfg('flame') && b.t > 0.9 ? 'TOASTED OFF!' : null; if (!how) return;
  throwBoarder(); const p = pops[pops.length - 1]; if (p && p.text === 'SHAKEN OFF!') p.text = how;
}
function eqFires(dt) {   // an open weak point you've set alight burns till it shuts; otherwise your fire under it (lit oil, a flame trail) burns it, one fire at a time
  const B = activeBoss(), W = B && bossWeak(B), E = demo.eq; if (!W || !W.open) { E.alight = null; return; }
  if (E.alight) { bossHit({ n: E.alight.dps * dt, src: 'flame', x: W.x, y: W.y }); if (cchance() < 0.6) parts.push({ k: 'fire', x: W.x + crand(-W.r, W.r) * 0.6, y: W.y + crand(-W.r, W.r) * 0.6, vx: crand(-40, 40), vy: crand(-140, -60), t: 0, life: crand(0.3, 0.5), size: crand(9, 14) }); return; }
  const f = fires.find(f => f.byYou && f.eq && Math.hypot(f.x - W.x, f.y - W.y) < f.r + W.r * 0.5); if (f) bossHit({ n: FIRE_OPEN_DPS * dt, src: 'flame', x: W.x, y: W.y });
}
function eqLight(S) { S.lit = true; fires.push({ x: S.x, y: S.y, r: S.r, t: 0, life: 3, mine: true, byYou: true, eq: true, oil: true }); for (let i = 0; i < 10; i++) parts.push({ k: 'fire', x: S.x + crand(-S.r, S.r) * 0.6, y: S.y + crand(-S.r, S.r) * 0.6, vx: crand(-60, 60), vy: crand(-120, -20), t: 0, life: crand(0.4, 0.8), size: crand(10, 16) }); SFX.crash(); }
// ---- oil: a slick behind you while chased or drifting; raiders spin out in it (yours); a boss barely swerves ----
function eqOil(dt) {
  const C = eqCfg('oil'), E = demo.eq;
  if (C) {
    E.oilCD -= dt; const [tx, ty] = eqTail(), back = player.a + Math.PI, v = Math.hypot(player.vx, player.vy);
    const chased = cars.some(k => !k.dead && !k.flee && Math.hypot(k.x - player.x, k.y - player.y) < 260 && Math.abs(angDiff(back, Math.atan2(k.y - player.y, k.x - player.x))) < 0.9);   // a raider on your tail; a boss gets oil only where you turn hard (a trap you lay)
    if ((chased || (player.slip > 0.3 && v > 160)) && E.oilCD <= 0) { E.slicks.push({ x: tx, y: ty, r: C.r, t: 0, life: C.life, hit: new Set(), seed: Math.floor(rand(1, 999)), slide: C.slide }); E.oilCD = C.cd; eqAct('oil'); eqSnd('oil', 0.3, () => SFX.pop()); }
  }
  for (const S of E.slicks) {
    S.t += dt;
    for (const k of cars) if (!k.dead && !S.hit.has(k) && Math.hypot(k.x - S.x, k.y - S.y) < S.r * 0.85 + k.r * 0.4) { S.hit.add(k); markPlayerCause(k, 'weapon'); if (!k.oiled) { k.oiled = true; draftSalvage(1); } k.slideT = Math.max(k.slideT, S.slide); k.a += rand(0.7, 1.3) * (grand() < 0.5 ? -1 : 1); k.frag = Math.max(k.frag, 1.3); eqHitCar(k, 4, 'oil', 'SPUN OUT!', k.x, k.y);
      // (a spin-out is oil doing its job: a little salvage above, once a raider)
      if ((E.slipWordT || 0) <= time) { E.slipWordT = time + 0.8; pops.push({ x: k.x, y: k.y - 34, text: 'SLIPPED!', col: '#c9b8ff', t: 0, small: 1 }); }   // the control it buys, said where it happens
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; parts.push({ k: 'dust', x: k.x + Math.cos(a) * 14, y: k.y + Math.sin(a) * 14, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, t: 0, life: 0.45, size: 12 }); } }
    const B = activeBoss(); if (B && !S.hit.has(B) && Math.hypot(B.x - S.x, B.y - S.y) < S.r + 30) { S.hit.add(B); if ((B.oilCD || 0) <= time && B.state === 'charge' && B.kind === 'bull' && B.demo) { B.oilCD = time + 8; B.a += (grand() < 0.5 ? -1 : 1) * 1.1; bullOpen(B, BULL_DEMO.slip); pops.push({ x: B.x, y: B.y - 70, text: 'SPUN OUT!', col: '#c9b8ff', t: 0 }); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; parts.push({ k: 'dust', x: B.x + Math.cos(a) * 30, y: B.y + Math.sin(a) * 30, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, t: 0, life: 0.5, size: 16 }); } }   // the Bull charging across your slick spins out: a short opening, once in 8 s
      else if ((B.oilCD || 0) <= time && B.state === 'charge') { B.oilCD = time + 8; const da = (grand() < 0.5 ? -1 : 1) * 0.22; B.a += da; const v = Math.hypot(B.vx, B.vy); B.vx = Math.cos(B.a) * v; B.vy = Math.sin(B.a) * v; pops.push({ x: B.x, y: B.y - 70, text: 'SKID!', col: '#c77dff', t: 0, small: 1 }); } }   // any other boss only swerves, once in a while
  }
  E.slicks = E.slicks.filter(S => S.t < S.life && !S.lit);
  if (E.slicks.length > 30) E.slicks.splice(0, E.slicks.length - 30);
}

// ============ on the car ============
function drawEquip(c, A) {   // in the car's own frame (x toward the nose), at the car's scale; bold enough to read on a phone
  const E = demo.eq, drawn = [];
  const pulse = id => { const t = time - (E.fitT[id] ?? -9); return t < 0.6 ? 1 + 0.3 * Math.sin(t * 18) * (1 - t / 0.6) : 1; };
  const rf = eqR('forks'), rg = eqR('gun'), rs = eqR('shield'), rw = eqR('saws'), rc = eqR('cannon'), rl = eqR('flame'), ro = eqR('oil');
  if (ro) {   // oil: a drum on the rear deck with a drip pipe out the side; a bigger drum; then one each side
    const p = pulse('oil'); ctx.save(); ctx.translate(A.tail + 12, 0); ctx.scale(p, p);
    for (const sy of ro >= 3 ? [-1, 1] : [-1]) { const rr = 5 + ro; inkCircle(ctx, 0, sy * A.half * 0.48, rr, '#2a2433', { lw: 1.6, double: false }); ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-1, sy * A.half * 0.48 - 1, rr * 0.55, 3.6, 5.6); ctx.stroke(); inkRR(ctx, -16, sy * (A.half + 1) - 2, 14, 4, 1.5, PAL.dark, { lw: 1.2, double: false }); }
    ctx.restore(); drawn.push('oil' + ro);
  }
  if (rl) {   // the flamethrower: a rear nozzle, then a pair, then a fuel housing; it glows when it's lit
    const p = pulse('flame'); ctx.save(); ctx.translate(A.tail - 2, 0); ctx.scale(p, p);
    if (rl >= 3) inkRR(ctx, 6, -5, 12, 10, 3, PAL.red, { lw: 1.6, double: false });
    for (const sy of rl >= 2 ? [-5, 5] : [0]) { inkRR(ctx, -14, sy - 3, 16, 6, 2, 'steel', { lw: 1.5, double: false }); ctx.fillStyle = E.flameOn ? (Math.floor(clock * 20) % 2 ? PAL.fire1 : PAL.fire2) : PAL.dark; ctx.beginPath(); ctx.arc(-14, sy, 2.4, 0, TAU); ctx.fill(); }
    ctx.restore(); drawn.push('flame' + rl);
  }
  if (rs) {   // the rear plate: bright blue and whole when ready, grey and cracked when spent, filling back up as it recharges
    const C = EQ.shield[rs - 1], k = E.shieldHP / C.cap, w = A.half * 2 + 6 + 6 * rs, p = pulse('shield');
    ctx.save(); ctx.translate(A.tail - 6, 0); ctx.scale(p, p);
    const plate = (x0, x1, half) => inkPoly(ctx, [[x1, -half], [x0, -half + 5], [x0, half - 5], [x1, half]], k > 0 ? '#7fd6ff' : PAL.gun, { lw: 2.2, double: false });
    plate(-9 - 2 * rs, 0, w / 2);
    if (rs >= 2) for (const sy of [-1, 1]) inkRR(ctx, -4, sy * (w / 2 - 4) - 3, 6, 6, 1.5, 'steel', { lw: 1.3, double: false });   // bolts
    if (rs >= 3) for (const sy of [-1, 1]) inkPoly(ctx, [[0, sy * w / 2], [-6, sy * (w / 2 + 7)], [-14, sy * (w / 2 + 4)], [-9 - 2 * rs, sy * (w / 2 - 5)]], k > 0 ? '#7fd6ff' : PAL.gun, { lw: 1.8, double: false });   // wings: a wider sector
    if (k > 0 && k < 1) { ctx.fillStyle = 'rgba(36,22,15,.45)'; ctx.fillRect(-9 - 2 * rs, -w / 2 + 5, 7 + 2 * rs, (w - 10) * (1 - k)); }   // the empty part, draining away as it refills
    if (k <= 0) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-2, -1); ctx.lineTo(-7, 6); ctx.lineTo(-1, 12); ctx.stroke(); }
    ctx.restore(); drawn.push('shield' + rs);
  }
  if (rf && eqRamOn()) {   // evolved: a battering ram, a steel wedge across the whole nose with studded teeth and hazard bands
    const p = pulse('forks'), half = A.half * 0.62 + 16, len = 26, E = demo.eq, wait = Math.max(0, (E.ramCD || 0) - time), since = time - (E.ramCD || -9);   // ready: the teeth are lit; after a wave the band refills (as the shield does)
    ctx.save(); ctx.translate(A.nose - 4, 0); ctx.scale(p, p);
    inkPoly(ctx, [[0, -half - 5], [len, -half + 3], [len + 16, 0], [len, half - 3], [0, half + 5]], 'chrome', { lw: 2.6, double: false });
    for (let i = 0; i < 5; i++) { const y0 = -half - 2 + i * (half * 2 + 4) / 5; inkPoly(ctx, [[3, y0], [9, y0], [3, y0 + (half * 2 + 4) / 10]], i % 2 ? PAL.dark : PAL.yellow, { lw: 1, double: false }); }   // a hazard band across the plate
    if (wait > 0) { ctx.fillStyle = 'rgba(36,22,15,.6)'; ctx.fillRect(2, -half - 3, 9, (half * 2 + 6) * wait / RAM_WAVE.cd); }   // the empty part, draining away as it refills
    for (const sy of [-0.6, 0, 0.6]) inkPoly(ctx, [[len + 4 - Math.abs(sy) * 10, sy * half - 6], [len + 22 - Math.abs(sy) * 10, sy * half], [len + 4 - Math.abs(sy) * 10, sy * half + 6]], wait > 0 ? PAL.dark : PAL.yellow, { lw: 1.6, double: false });
    if (since >= 0 && since < 0.25) { ctx.globalAlpha = 1 - since / 0.25; starPath(ctx, len + 20, 0, 13 + since * 40, 5, 0.4); ctx.fillStyle = '#fff4dc'; ctx.fill(); ctx.globalAlpha = 1; }   // a glint the moment it is ready again
    ctx.restore(); drawn.push('ram' + rf);
  }
  else if (rf) {   // two prongs; reinforced collars at rank 2; a heavy crossbar at rank 3
    const p = pulse('forks'), len = 16 + 5 * rf, spread = A.half * 0.62 + 2 * rf, w = 3 + rf;
    ctx.save(); ctx.translate(A.nose - 3, 0); ctx.scale(p, p);
    for (const sy of [-1, 1]) inkPoly(ctx, [[0, sy * spread - w], [len, sy * spread - w * 0.5], [len + 9, sy * spread], [len, sy * spread + w * 0.5], [0, sy * spread + w]], 'chrome', { lw: 1.8, double: false });
    if (rf >= 2) for (const sy of [-1, 1]) inkRR(ctx, 1, sy * spread - w - 2, 7, (w + 2) * 2, 2, PAL.orange, { lw: 1.4, double: false });
    if (rf >= 3) inkRR(ctx, 3, -spread - w, 6, (spread + w) * 2, 2, PAL.orange, { lw: 1.8, double: false });
    ctx.restore(); drawn.push('forks' + rf);
  }
  if (rw) {   // side saws: a small blade each side, then two, then one big toothed one; they spin
    const p = pulse('saws'), spin = clock * 22, R = rw >= 3 ? 11 : 6 + rw, xs = rw === 2 ? [-12, 12] : [0];
    for (const sy of [-1, 1]) for (const x of xs) { ctx.save(); ctx.translate(x, sy * (A.half + R * 0.55 + 2)); ctx.scale(p, p); ctx.rotate(spin * sy); starPath(ctx, 0, 0, R, rw >= 3 ? 10 : 7, 0.72); ctx.fillStyle = PAL.chrome; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); inkCircle(ctx, 0, 0, R * 0.32, 'gun', { lw: 1.2, double: false }); ctx.restore(); }
    drawn.push('saws' + rw);
  }
  if (rc) {   // the heavy cannon on the rear roof: a fat barrel that swings onto its target and kicks when it fires
    const p = pulse('cannon'), back = E.canFlash > 0 ? -6 : 0, len = 20 + 4 * rc, w = 7 + rc;
    ctx.save(); ctx.translate(A.tail * 0.38, 0); ctx.rotate(E.canA - c.a); ctx.scale(p, p);
    inkRR(ctx, back, -w / 2, len, w, 3, PAL.gun, { lw: 1.8, double: false }); if (rc >= 2) inkRR(ctx, back + len - 7, -w / 2 - 1.5, 7, w + 3, 2, PAL.dark, { lw: 1.4, double: false });
    inkCircle(ctx, 0, 0, 9 + rc, PAL.rust, { lw: 2, double: false }); if (rc >= 3) for (const sy of [-1, 1]) inkCircle(ctx, -4, sy * 7, 3, 'steel', { lw: 1, double: false });
    if (E.canFlash > 0) { ctx.fillStyle = '#ffd23f'; starPath(ctx, len + back + 8, 0, 12, 7, 0.45); ctx.fill(); }
    ctx.restore(); drawn.push('cannon' + rc);
  }
  if (rg) {   // the roof gun: a yellow turret; one barrel, a longer one, twin barrels; it kicks back when it fires
    const p = pulse('gun'), back = E.gunFlash > 0 ? -4 : 0, len = 22 + 5 * rg;
    ctx.save(); ctx.translate(A.gun[0] + 6, A.gun[1] * 0.3); ctx.rotate(E.gunA - c.a); ctx.scale(p, p);
    for (const sy of rg >= 3 ? [-3.5, 3.5] : [0]) inkRR(ctx, back, sy - 2.6, len, 5.2, 2, PAL.dark, { lw: 1.6, double: false });
    if (rg >= 2) for (const sy of rg >= 3 ? [-3.5, 3.5] : [0]) inkRR(ctx, back + len - 6, sy - 3.4, 6, 6.8, 1.5, 'steel', { lw: 1.2, double: false });   // muzzle brake
    inkCircle(ctx, 0, 0, 8, PAL.yellow, { lw: 2, double: false }); inkCircle(ctx, 0, 0, 3, PAL.dark, { lw: 1.2, double: false });
    if (E.gunFlash > 0) { ctx.fillStyle = '#ffe680'; starPath(ctx, len + back + 7, 0, 9, 6, 0.45); ctx.fill(); }
    ctx.restore(); drawn.push('gun' + rg);
  }
  E.drawn = drawn;
}
const eqDrawn = () => (demo && demo.eq ? demo.eq.drawn.slice().sort() : []);
function drawEqGround() {   // your oil on the ground: a dark slick with a purple sheen
  if (!demo || !demo.eq) return;
  for (const S of demo.eq.slicks) { if (!inView(S.x, S.y, S.r)) continue; ctx.save(); ctx.globalAlpha = Math.min(1, (S.life - S.t) * 1.5); inkPoly(ctx, blob(S.x, S.y, S.r, S.seed), '#1d1726', { lw: 2, double: false }); for (const [col, k] of [['rgba(199,125,255,.55)', 0.7], ['rgba(80,220,255,.45)', 0.5]]) { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(S.x - 6, S.y - 4, S.r * k, 3.6, 5.6); ctx.stroke(); } ctx.restore(); }
}
function drawEqShots() {   // the gun's rounds: short bright streaks; cannon shells: dark balls with a smoke trail
  if (!demo || !demo.eq) return;
  for (const s of demo.eq.shells) { inkCircle(ctx, s.x, s.y, 7, PAL.dark, { lw: 2, double: false }); if (cchance() < 0.6) parts.push({ k: 'puff', x: s.x, y: s.y, vx: crand(-15, 15), vy: crand(-15, 15), t: 0, life: 0.4, size: crand(5, 8) }); }
  ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
  for (const s of demo.eq.shots) { const v = Math.hypot(s.vx, s.vy) || 1; ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx / v * 16, s.y - s.vy / v * 16); }
  ctx.stroke();
}
