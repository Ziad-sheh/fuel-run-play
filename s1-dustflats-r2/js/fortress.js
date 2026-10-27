'use strict';
// Wasteland Drift · fortress.js: the Road Fortress, boss of the Salt Wastes.
// An eight-wheeled war machine, slower than you, that never stops: it flattens walls, wrecks whatever it rolls over and
// hurts you badly if you touch it. Two turrets do the fighting: a cannon up front fires down a red line, a mortar at the
// back lobs shells at red rings. Every so often its ramp drops gang cars. The hull shrugs off your weapons: knock out both
// turrets (weapons, a drum blown up beside them, a rampaging Juggernaut) and the engine in the middle is exposed.
// Fuel Run: rams don't hurt the hull. Drums knock its guns out (a drum going off within FORT_REACH of a gun, lit by you or
// rolled over by it); with both guns down the engine in the middle of its side is bare, and every ram there takes a
// segment and spills a can. Only its plough hurts to touch (FORT_PLOUGH). Its ramp drops raiders in the second meeting only,
// and its arena always has drums on the way.
// Classic scripts sharing one global scope, loaded in order by index.html.
const FORT_REACH = 160, FORT_PLOUGH = 20;

let shells = [];   // the cannon's rounds in flight
function fortInit(B) {
  const th = B.maxHp * 0.24;
  shells = [];
  Object.assign(B, { m: 14, size: 2.8, state: 'roll', crew: 0, flag: true, slip: 0, launchT: 9, jamT: 0, hitCD: 0, rage: false, ramp: STG().meet === 2, drumT: 0,
    turrets: [{ lx: 32, kind: 'cannon', hp: th, max: th, cd: 2.6, tell: 0, aim: 0, a: 0, dead: false }, { lx: -40, kind: 'mortar', hp: th, max: th, cd: 3.8, a: 0, dead: false }] });
}
const fortCore = B => B.turrets.every(T => T.dead);
function turretPos(B, T) { return [B.x + Math.cos(B.a) * T.lx, B.y + Math.sin(B.a) * T.lx]; }
function fortPoints(B) {   // what your weapons can hit: the turrets first, then the engine, then the hull
  const c = Math.cos(B.a), s = Math.sin(B.a), pts = [];
  const alive = B.turrets.filter(T => !T.dead).sort((p, q) => { const [px, py] = turretPos(B, p), [qx, qy] = turretPos(B, q); return Math.hypot(px - player.x, py - player.y) - Math.hypot(qx - player.x, qy - player.y); });
  for (const T of alive) { const [x, y] = turretPos(B, T); pts.push({ x, y, r: 24, part: 'turret' }); }
  pts.push({ x: B.x - c * 4, y: B.y - s * 4, r: 30, part: 'core' });
  for (const o of [-66, 66]) pts.push({ x: B.x + c * o, y: B.y + s * o, r: 38, part: 'hull' });
  return pts;
}
const hullCircles = B => { const c = Math.cos(B.a), s = Math.sin(B.a); return [-62, 0, 62].map(o => ({ x: B.x + c * o, y: B.y + s * o, r: 46 })); };
function fortDamage(B, n, src) { return fortCore(B) && src === 'tank' ? n : 0; }   // only your rams on the bare engine count
function gunDown(B, T) {   // a gun goes up: cans spill; the second one bares the engine (slow motion, so the engine's arrow stays clear)
  if (T.dead) return; T.dead = true; const [tx, ty] = turretPos(B, T);
  boom(tx, ty, null, 1.3); for (let i = 0; i < 2; i++) dropGem(tx, ty, -10, 1.4); SFX.clang();
  if (fortCore(B)) { recordRunEvent('boss_window', { kind: 'fortress' }); slowT = Math.max(slowT, 0.4); shake = Math.max(shake, 9 * (calmMotion ? 0.3 : 1)); SFX.level(); }
  else bigMoment(tx, ty, T.kind === 'cannon' ? 'CANNON DOWN!' : 'MORTAR DOWN!', 1.1, 0.8);
}
function fortDrum(b) {   // a drum going off beside a gun knocks it out
  const B = boss; if (!B || B.dead || B.kind !== 'fortress') return;
  for (const T of B.turrets) { if (T.dead) continue; const [tx, ty] = turretPos(B, T); if (Math.hypot(tx - b.x, ty - b.y) < FORT_REACH) gunDown(B, T); }
}
function fortRam(B, n) {   // your nose into the bare engine: a segment (two on nitro), and a can
  if (!fortCore(B)) { SFX.clang(); return; }
  damageBoss(SEG * Math.min(2, n), 'tank', B.x, B.y, n > 1 ? 'ENGINE x2!' : 'ENGINE!', true); dropGem(B.x, B.y, -8, 1.2);
}
function fortPlough() { hurt(FORT_PLOUGH, false, 'boss'); chalFail('plough'); }   // its plough: the one part that hurts to touch
function fortArenaDrums(B, dt) {   // drums on its way: four near you as it rolls in, then one more off screen whenever fewer than three are near it
  const add = (x, y) => { const ch = chunks.get(`${Math.floor(x / CH)},${Math.floor(y / CH)}`); if (!ch) return false; ch.drums.push({ x, y, r: 17, ch }); for (let i = 0; i < 6; i++) parts.push({ k: 'dust', x: x + crand(-14, 14), y: y + crand(-14, 14), vx: crand(-40, 40), vy: crand(-40, 40), t: 0, life: 0.6, size: crand(10, 14) }); return true; };
  if (!B.drumsSet) {
    B.drumsSet = true; let n = 0; const placed = [];   // the ones placed this batch aren't in the lists yet
    for (let t = 0; t < 60 && n < 4; t++) { const a = rand(0, TAU), r = rand(250, 420), x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r; if (Math.hypot(x - B.x, y - B.y) < 350 || blocked(x, y, 40) || [...drums, ...placed].some(d => Math.hypot(d.x - x, d.y - y) < 120)) continue; if (add(x, y)) { n++; placed.push({ x, y }); } }
    rebuildLists(); return;
  }
  B.drumT -= dt; if (B.drumT > 0) return; B.drumT = 1;   // by the clock, not the frame
  if (drums.filter(d => !d.gone && Math.hypot(d.x - B.x, d.y - B.y) < 1200).length >= 3) return;
  for (let t = 0; t < 20; t++) {
    const a = rand(0, TAU), r = rand(450, 800), x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r;
    if (Math.hypot(x - B.x, y - B.y) < 400 || blocked(x, y, 40) || inView(x, y, 30)) continue;   // off screen, so it never pops into view
    if (add(x, y)) { rebuildLists(); return; }
  }
}
const fortHud = B => fortCore(B) ? 'RAM THE ENGINE!' : `GUNS ${B.turrets.map(T => T.dead ? '✕' : '▣').join(' ')} · DRUMS!`;   // for the boss bar
function updateFortress(B, dt) {
  B.t += dt; B.hurtT -= dt; B.jamT = Math.max(0, B.jamT - dt); B.hitCD -= dt;
  fortArenaDrums(B, dt);
  const dx = player.x - B.x, dy = player.y - B.y, d = Math.hypot(dx, dy);
  // it rolls to cut you off, never quite as fast as you, but it never stops
  const want = Math.atan2(player.y + player.vy * 0.9 - B.y, player.x + player.vx * 0.9 - B.x);
  const speed = SPEED * (B.rage ? 0.86 : 0.76) * (d > 900 ? 1.4 : 1);
  drive(B, clamp(angDiff(B.a, want) * 2, -1, 1), dt, speed, 1.05, 7);
  if (d < 1100) SFX.rumble();
  if (cchance() < 0.5) parts.push({ k: 'dust', x: B.x - Math.cos(B.a) * 90 + crand(-30, 30), y: B.y - Math.sin(B.a) * 90 + crand(-30, 30), vx: crand(-30, 30), vy: crand(-30, 30), t: 0, life: 0.9, size: crand(14, 22) });
  // the turrets
  const jam = B.jamT > 0;
  for (const T of B.turrets) {
    if (T.dead) continue;
    const [tx, ty] = turretPos(B, T); T.a += clamp(angDiff(T.a, Math.atan2(player.y - ty, player.x - tx)), -2.4 * dt, 2.4 * dt);
    if (jam) continue;
    T.cd -= dt;
    if (T.kind === 'cannon') {
      if (T.tell > 0) { T.tell -= dt; if (T.tell <= 0) { const v = 1150; shells.push({ x: tx, y: ty, vx: Math.cos(T.aim) * v, vy: Math.sin(T.aim) * v, t: 0 }); SFX.wreck(1); parts.push({ k: 'flash', x: tx + Math.cos(T.aim) * 40, y: ty + Math.sin(T.aim) * 40, t: 0, life: 0.1, R: 40 }); T.cd = B.rage ? 2.2 : 3.2; } }
      else if (T.cd <= 0 && d < 950) { T.tell = 0.85; T.aim = Math.atan2(player.y + player.vy * 0.45 - ty, player.x + player.vx * 0.45 - tx); SFX.rev(); }   // locks on: a red line, then it fires down it
    } else if (T.cd <= 0 && d < 1000) {   // a volley of three shells at red rings round where you're going
      for (let i = 0; i < 3; i++) bombs.push({ sx: tx, sy: ty, tx: player.x + player.vx * 1.1 + rand(-90, 90), ty: player.y + player.vy * 1.1 + rand(-90, 90), t: -i * 0.18, T: 1.25, shell: true });
      SFX.launch(); T.cd = B.rage ? 2.8 : 4;
    }
  }
  // its ramp drops gang cars now and then
  B.launchT -= dt;
  if (B.ramp && B.launchT <= 0) {
    B.launchT = B.rage ? 8 : 11;
    for (let i = 0; i < 2; i++) { landCar({ x: B.x, y: B.y, type: 'buggy', t: 0 }); const k = cars[cars.length - 1], ra = B.a + Math.PI + (i ? 0.35 : -0.35); k.x = B.x + Math.cos(ra) * 120; k.y = B.y + Math.sin(ra) * 120; k.a = ra; k.vx = Math.cos(ra) * 260; k.vy = Math.sin(ra) * 260; k.age = 0; }
    pops.push({ x: B.x - Math.cos(B.a) * 110, y: B.y - Math.sin(B.a) * 110 - 40, text: 'RAMP DOWN!', col: '#ffd23f', t: 0 });
  }
  // the cannon's rounds
  for (const S of shells) {
    S.t += dt; S.x += S.vx * dt; S.y += S.vy * dt;
    if (Math.hypot(S.x - player.x, S.y - player.y) < player.r + 12 && state === 'play') { S.dead = true; smallBoom(S.x, S.y, 80); hurt(16, false, 'boss'); const l = Math.hypot(S.vx, S.vy); player.vx += S.vx / l * 380; player.vy += S.vy / l * 380; }
    else if (S.t > 1.3 || blocked(S.x, S.y, 6)) { S.dead = true; smallBoom(S.x, S.y, 80); }
    else for (const k of cars) if (!k.dead && Math.hypot(S.x - k.x, S.y - k.y) < k.r + 8) { S.dead = true; wreck(k, 'BLAM!'); break; }
  }
  shells = shells.filter(S => !S.dead);
  // it rolls over the world: walls fold, drums blow, gang cars are flattened; rock pushes it aside
  for (const c of hullCircles(B)) {
    for (const W of walls) { if (Math.abs(W.x + W.w / 2 - c.x) > W.w / 2 + 70 || Math.abs(W.y + W.h / 2 - c.y) > W.h / 2 + 70) continue; const h = circleRect(c, W); if (!h) continue; if (!W.rock && !W.gone) { W.hp = 0; destroyWall(W); continue; } B.x += h.nx * h.pen; B.y += h.ny * h.pen; c.x += h.nx * h.pen; c.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { B.vx -= vn * h.nx; B.vy -= vn * h.ny; } }
    for (const q of [...posts, ...cranes]) { if (!near(c, q, 90)) continue; const h = circleCircle(c, q); if (!h) continue; B.x += h.nx * h.pen; B.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { B.vx -= vn * h.nx; B.vy -= vn * h.ny; } }
    for (const b of crates) if (!b.gone && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.r) breakCrate(b);
    for (const b of drums) if (!b.gone && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.r) drumBoom(b);
    for (const k of cars) if (!k.dead && k.age > 0.6 && Math.hypot(k.x - c.x, k.y - c.y) < c.r + k.r) wreck(k, 'FLATTENED!', 'trick');
    const h = player.air ? null : circleCircle(player, c);
    if (h) {   // touching it: the plough at the front hurts, your nose into the bare engine is a hit, the rest just bumps
      const t = player.m + B.m; player.x += h.nx * h.pen * B.m / t; player.y += h.ny * h.pen * B.m / t;
      const off = (c.x - B.x) * Math.cos(B.a) + (c.y - B.y) * Math.sin(B.a), youIn = -(player.vx * h.nx + player.vy * h.ny), nose = Math.abs(angDiff(player.a, Math.atan2(c.y - player.y, c.x - player.x))) < 0.8;
      const ahead = Math.abs(angDiff(B.a, Math.atan2(player.y - B.y, player.x - B.x))) < 0.55;   // you're in front of it, where the plough is
      if (off > 30 && ahead && B.hitCD <= 0 && player.inv <= 0) { B.hitCD = 2; fortPlough(); player.vx += h.nx * 520; player.vy += h.ny * 520; }
      else if (Math.abs(off) <= 30 && nose && youIn > 120 && (B.ramCD || 0) <= time) { B.ramCD = time + 0.45; fortRam(B, nitroT > 0 ? 2 : 1); player.vx += h.nx * 260; player.vy += h.ny * 260; }
      else { const rel = player.vx * h.nx + player.vy * h.ny; if (rel < 0) { player.vx -= 1.6 * rel * h.nx; player.vy -= 1.6 * rel * h.ny; } }
    }
  }
}

// ============ the Road Fortress drawn: an armoured hull on eight wheels, an engine in the middle, a ramp at the back ============
function artFortress(g, o) {
  for (const x of [-66, -34, 30, 62]) for (const s of [-1, 1]) artTyre(g, x, s * 44, 30, 18);
  inkRR(g, -96, -40, 186, 80, 10, 'steel', { box: true, lw: 3.6 });   // the hull
  for (let x = -80; x <= 76; x += 26) inkLine(g, [[x, -40], [x, 40]], 1.6);
  const rv = []; for (let x = -88; x < 84; x += 11) rv.push([x, -35], [x, 35]); rivets(g, rv, 1.3);
  fillOnly(g, () => { g.beginPath(); g.ellipse(-60, 18, 14, 7, 0.3, 0, TAU); g.moveTo(52, -18); g.ellipse(44, -18, 10, 5, -0.2, 0, TAU); }, 'rust', 0.85);
  inkRR(g, -112, -26, 18, 52, 3, 'rust2', { box: true, lw: 2.4 });   // the ramp
  g.strokeStyle = 'rgba(36,22,15,.6)'; g.lineWidth = 1.2; g.beginPath(); for (let y = -22; y < 24; y += 6) { g.moveTo(-110, y); g.lineTo(-96, y); } g.stroke();
  inkRR(g, -22, -24, 36, 48, 6, 'dark', { box: true, lw: 2.6 });   // the engine bay
  for (const s of [-1, 1]) { inkRR(g, 4, s * 28 - 4, 14, 8, 3, 'chrome', { lw: 1.4, double: false }); inkCircle(g, 12, s * 28, 2.6, INK, { line: false }); }   // smokestacks
  inkPoly(g, [[90, -34], [108, -20], [108, 20], [90, 34]], 'chrome', { box: [90, -34, 18, 68], lw: 2.8 });   // the plough
  g.fillStyle = '#fff'; for (let y = -26; y < 26; y += 6.5) { g.beginPath(); g.moveTo(96, y); g.lineTo(101, y + 3.25); g.lineTo(96, y + 6.5); g.fill(); }
  inkEllipse(g, 82, 0, 9, 10, 0, 'bone', { lw: 1.6, double: false }); g.fillStyle = INK; g.beginPath(); g.arc(84, -3, 2.3, 0, TAU); g.arc(84, 3, 2.3, 0, TAU); g.fill();   // the figurehead
}
const FORT_BOX = [-120, -64, 116, 64];
function drawFortress(B) {
  castShadow(B.x, B.y, B.a, 210, 104, 2.2);
  for (const T of B.turrets) if (!T.dead && T.kind === 'cannon' && T.tell > 0) {   // the cannon's line: get off it
    const [tx, ty] = turretPos(B, T); ctx.save(); ctx.translate(tx, ty); ctx.rotate(T.aim); ctx.globalAlpha = 0.45 + Math.sin(clock * 24) * 0.25;
    ctx.fillStyle = 'rgba(232,67,47,.22)'; ctx.fillRect(30, -18, 1100, 36); ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 4; ctx.setLineDash([22, 12]); ctx.strokeRect(30, -18, 1100, 36); ctx.setLineDash([]); ctx.restore();
  }
  const sp = sprite('fortress', FORT_BOX, g => artFortress(g, B));
  ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.a);
  for (const s of [-1, 1]) artFlame(ctx, -96, s * 30, B.rage ? 26 : 14, 4);
  blit(sp);
  const core = fortCore(B);
  if (core) { const p = 1 + Math.sin(clock * 10) * 0.12; ctx.fillStyle = PAL.fire2; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(-4, 0, 16 * p, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(-4, 0, 30 * p, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }   // the engine, bare
  for (const T of B.turrets) {
    ctx.save(); ctx.translate(T.lx, 0);
    if (T.dead) { inkCircle(ctx, 0, 0, 15, 'dark', { lw: 2, double: false }); ctx.fillStyle = PAL.fire2; if (Math.floor(clock * 8 + T.lx) % 2) { ctx.beginPath(); ctx.arc(rand(-4, 4), rand(-4, 4), 5, 0, TAU); ctx.fill(); } ctx.restore(); continue; }
    ctx.rotate(T.a - B.a);
    if (T.kind === 'cannon') inkRR(ctx, 0, -4.5, 46, 9, 2, 'gun', { box: true, lw: 2 }); else inkRR(ctx, -2, -9, 26, 18, 6, 'gun', { box: true, lw: 2 });
    inkCircle(ctx, 0, 0, 19, 'rust', { box: true, lw: 2.6 }); rivets(ctx, [[-10, -10], [10, -10], [-10, 10], [10, 10]], 1.5);
    if (B.jamT > 0) { ctx.strokeStyle = '#7fd6ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 24, clock * 8, clock * 8 + 2); ctx.stroke(); }
    if (T.hp < T.max) { ctx.rotate(-(T.a - B.a)); ctx.fillStyle = INK; ctx.fillRect(-18, -32, 36, 6); ctx.fillStyle = '#ff6f3c'; ctx.fillRect(-17, -31, 34 * Math.max(0, T.hp / T.max), 4); }
    ctx.restore();
  }
  if (B.hurtT > 0) blitWhite(sp, 0.35);
  ctx.restore();
  for (const S of shells) { ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(Math.atan2(S.vy, S.vx)); inkRR(ctx, -12, -5, 24, 10, 5, 'gun', { lw: 1.6, double: false }); ctx.fillStyle = PAL.fire2; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-28, 0); ctx.lineTo(-12, 4); ctx.fill(); ctx.restore(); }
  if (fortCore(B)) {   // the bare engine glows green under an arrow: ram it from the side
    const bob = Math.sin(clock * 10) * 8;
    ctx.save(); ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 6; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(B.x, B.y, 46 * (1 + Math.sin(clock * 12) * 0.12), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.translate(B.x, B.y - 110 + bob); ctx.fillStyle = '#5be37d'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(16, 0); ctx.lineTo(28, 0); ctx.lineTo(0, 26); ctx.lineTo(-28, 0); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeText('RAM!', 0, -32); ctx.fillStyle = '#fff'; ctx.fillText('RAM!', 0, -32); ctx.restore();
  }
  const live = B.turrets.filter(T => !T.dead);   // a drum glows green while a gun is in reach of it: light it now
  for (const d of drums) { if (d.gone || !live.some(T => { const [tx, ty] = turretPos(B, T); return Math.hypot(tx - d.x, ty - d.y) < FORT_REACH + 60; })) continue; ctx.save(); ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 12 + Math.sin(clock * 16) * 4, 0, TAU); ctx.stroke(); ctx.restore(); }
}
