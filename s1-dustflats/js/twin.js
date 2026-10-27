'use strict';
// Wasteland Drift · twin.js: the Twin-Horse, boss of the Rust Yards.
// A double-engined monster car with three lancers on the back. It doesn't charge like the Bull: it drives you down,
// pulls up alongside, and its crew throws thunder-sticks (lances that explode where they land). After a few throws it
// flashes and side-swipes. Its armour faces forward and out; the twin fuel tanks on the back are the soft spot.
// Brake and let it overshoot, then shoot or ram the tanks; or swerve from a swipe so it slams into something hard.
// Fuel Run: the tanks are its only weak spot (a nose ram takes a segment, two while it's dazed or on nitro); its swipe
// warns for TWIN_TELL; the first meeting never turns furious, the second is furious from the start (two lances at once,
// a swipe after two throws) without Wasteland's fire trail or speed-up.
// Classic scripts sharing one global scope, loaded in order by index.html.
const TWIN_TELL = 0.8;

function twinInit(B) { Object.assign(B, { m: 4.2, size: 1.5, state: 'chase', side: 1, crew: 3, flag: true, throws: 0, throwT: 1.4, aimT: 0, slip: 0, rage: STG().meet === 2, stunFor: 1, stuck: false, stuckT: 0, unstick: 0, unDir: 1, trailT: 0, burnT: 0, hitYou: false }); }
function twinPoints(B) { const c = Math.cos(B.a), s = Math.sin(B.a); return [[-34, 'rear'], [0, 'mid'], [32, 'front']].map(([o, part]) => ({ x: B.x + c * o, y: B.y + s * o, r: 26, part })); }
function twinMul(B, src) { return src === 'tank' ? 1 : 0; }   // only rams on the tanks at its back hurt it
const twinHud = B => `THE TWIN-HORSE  ${'⚑'.repeat(B.crew)}${B.state === 'stunned' ? '  STUNNED!' : ''}`;
function twinThrow(B) {   // a lancer stands, aims at where you'll be, and throws: the red ring shows where it lands
  const lead = 0.75, tx = player.x + player.vx * lead + rand(-30, 30), ty = player.y + player.vy * lead + rand(-30, 30);
  const ox = B.x - Math.cos(B.a) * 26 + B.side * -Math.sin(B.a) * 10, oy = B.y - Math.sin(B.a) * 26 + B.side * Math.cos(B.a) * 10;
  bombs.push({ sx: ox, sy: oy, tx, ty, t: 0, T: 0.95, lance: true }); SFX.whoosh();
}
function twinCrash(B, W) {   // it swerved into something hard: stunned, a lancer thrown off, the tanks are yours
  const f = twinPoints(B)[2];
  boom(f.x, f.y, 'KRUNCH!', 1); SFX.clang(); stunBoss(2.4, true); chalAdd('twincrash');
  if (W && !W.gone && !W.rock) { W.hp = 0; destroyWall(W); }
  if (B.crew > 0) { B.crew--; ejectCrew(B, 1); }
  for (let i = 0; i < 2; i++) dropGem(B.x, B.y, -10, 1.4);   // fuel cans spill: the only repairs in a boss fight
  slowT = Math.max(slowT, 0.3); shake = Math.max(shake, 8 * (calmMotion ? 0.3 : 1));   // slow motion, not a burst: the RAM! arrow over its tanks stays clear
  pops.push({ x: B.x, y: B.y + 95, text: 'HIT THE TANKS!', col: '#5be37d', t: 0 });
}
function updateTwin(B, dt) {
  B.t += dt; B.hurtT -= dt;
  const dx = player.x - B.x, dy = player.y - B.y, d = Math.hypot(dx, dy);
  const pv = Math.hypot(player.vx, player.vy), pa = pv > 60 ? Math.atan2(player.vy, player.vx) : player.a, fwX = Math.cos(pa), fwY = Math.sin(pa), rtX = -fwY, rtY = fwX;
  const lon = -(dx * fwX + dy * fwY), lat = -(dx * rtX + dy * rtY);   // where it sits from you: lon > 0 ahead, lat > 0 on your right
  const top = SPEED * 1.17, ahead = o => blocked(B.x + Math.cos(B.a + o) * 160, B.y + Math.sin(B.a + o) * 160, 32);
  let want = Math.atan2(dy, dx), speed = top, turn = 2.5, grip = 3.2;
  if (B.state === 'chase' || B.state === 'alongside') {   // pull up beside you
    if (B.state === 'chase' && Math.abs(lat) > 30) B.side = Math.sign(lat);
    const tLat = B.side * 150, tLon = 0, gapLon = tLon - lon, gapLat = tLat - lat;
    const tx = player.x + fwX * (tLon + pv * 0.25) + rtX * tLat, ty = player.y + fwY * (tLon + pv * 0.25) + rtY * tLat;
    want = Math.abs(gapLon) < 150 && Math.abs(gapLat) < 120 ? pa + clamp(gapLat * 0.012, -0.45, 0.45) : Math.atan2(ty - B.y, tx - B.x);
    speed = clamp(pv + gapLon * 1.8, 140, top * (d > 650 ? 1.3 : 1.08));
    if (d > 200 && ahead(0)) { const l = ahead(-0.7), r = ahead(0.7); want = B.a + (!l && r ? -0.9 : l && !r ? 0.9 : angDiff(B.a, want) < 0 ? -0.9 : 0.9); }
    B.stuckT = Math.hypot(B.vx, B.vy) < 70 ? B.stuckT + dt : 0;
    if (B.stuckT > 0.5) { const l = ahead(-1.3), r = ahead(1.3); B.unDir = !l && r ? -1 : l && !r ? 1 : grand() < 0.5 ? -1 : 1; B.unstick = 0.7; B.stuckT = 0; }
    if (B.unstick > 0) { B.unstick -= dt; want = B.a + B.unDir * 1.5; }
    const along = Math.abs(gapLon) < 120 && Math.abs(gapLat) < 95;
    B.state = along ? 'alongside' : 'chase';
    B.throwT -= dt * (along ? 1 : 0.35);   // it throws mostly from alongside, now and then on the chase
    if (B.throwT <= 0 && B.crew > 0 && d < 560 && !B.aimT) { B.aimT = 0.45; B.throwT = 1.7; }
    if (along && (B.throws >= (B.rage ? 2 : 3) || (B.crew === 0 && B.t > 2.5))) { B.state = 'tell'; B.t = 0; B.throws = 0; SFX.rev(); }
  } else if (B.state === 'tell') {   // flashes and twitches: the swipe is coming
    want = pa - B.side * 0.12 + Math.sin(B.t * 40) * 0.05; speed = pv;
    if (B.t > TWIN_TELL) { B.state = 'swipe'; B.t = 0; B.hitYou = false; SFX.lunge(); }
  } else if (B.state === 'swipe') {   // swerves into you, hard
    want = Math.atan2(player.y + player.vy * 0.12 - B.y, player.x + player.vx * 0.12 - B.x); speed = pv * 1.1 + 140; turn = 3.6; grip = 5;
    if (B.t > 0.6 || B.hitYou) { B.state = 'peel'; B.t = 0; }
  } else if (B.state === 'peel') { want = pa + B.side * 0.5; speed = pv * 0.8; if (B.t > 0.9) { B.state = 'chase'; B.t = 0; } }
  else if (B.state === 'stunned') {
    speed = 0; turn = 0; grip = 5;
    if (cchance() < 0.3) parts.push({ k: 'spark', x: B.x + crand(-40, 40), y: B.y + crand(-30, 30), vx: crand(-80, 80), vy: crand(-120, -20), t: 0, life: 0.4 });
    if (B.t > B.stunFor) { B.state = 'chase'; B.t = 0; B.stuck = false; }
  }
  if (B.aimT > 0) { B.aimT -= dt; if (B.aimT <= 0) { B.aimT = 0; twinThrow(B); B.throws++; if (B.rage && B.crew > 1) twinThrow(B); } }
  drive(B, clamp(angDiff(B.a, want) * 2.5, -1, 1), dt, speed, turn, grip);
  skid(B, false);
  if (d < 900) SFX.rumble();
  // the world: a swipe that ends in something hard is a crash; otherwise it shoulders things aside
  let crashed = null, inFire = false;
  const latSpeed = Math.abs(-Math.sin(B.a) * B.vx + Math.cos(B.a) * B.vy);
  for (const p of twinPoints(B)) {
    const c = { x: p.x, y: p.y, r: p.r };
    for (const W of walls) { if (Math.abs(W.x + W.w / 2 - c.x) > W.w / 2 + 60 || Math.abs(W.y + W.h / 2 - c.y) > W.h / 2 + 60) continue; const h = circleRect(c, W); if (!h) continue; B.x += h.nx * h.pen; B.y += h.ny * h.pen; c.x += h.nx * h.pen; c.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { if ((B.state === 'swipe' || B.state === 'peel') && (-vn > 140 || latSpeed > 160)) crashed = crashed || W; else if (-vn > 260) hitWall(W, 1); B.vx -= 1.2 * vn * h.nx; B.vy -= 1.2 * vn * h.ny; } }
    for (const q of [...posts, ...cranes]) { if (!near(c, q, 80)) continue; const h = circleCircle(c, q); if (!h) continue; B.x += h.nx * h.pen; B.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { if ((B.state === 'swipe' || B.state === 'peel') && -vn > 140) crashed = crashed || { rock: true }; B.vx -= 1.2 * vn * h.nx; B.vy -= 1.2 * vn * h.ny; } }
    for (const b of crates) if (!b.gone && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.r) breakCrate(b);
    for (const b of drums) if (!b.gone && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.r) drumBoom(b);
    for (const f of fires) if (!f.bull && Math.hypot(f.x - c.x, f.y - c.y) < f.r + c.r) inFire = true;
  }
  if (crashed && B.state !== 'stunned') twinCrash(B, crashed.rock ? null : crashed);
  B.burnT -= dt; if (inFire && B.burnT <= 0) { B.burnT = 0.25; damageBoss(4, 'flame', B.x, B.y); }
  const pts = twinPoints(B), bsp = Math.hypot(B.vx, B.vy);
  for (const k of cars) { if (k.dead) continue; for (const p of pts) { const h = circleCircle(k, p); if (!h) continue; if (bsp > 160) wreck(k, 'FLATTENED!', 'trick'); else { k.x += h.nx * h.pen; k.y += h.ny * h.pen; } break; } }
  // and you: its swipe hurts; ram the tanks at the back and they hurt it
  for (const p of pts) {
    const h = player.air ? null : circleCircle(player, p); if (!h) continue;
    const t = player.m + B.m; player.x += h.nx * h.pen * B.m / t; player.y += h.ny * h.pen * B.m / t; B.x -= h.nx * h.pen * player.m / t; B.y -= h.ny * h.pen * player.m / t;
    const youIn = -(player.vx * h.nx + player.vy * h.ny), nose = Math.abs(angDiff(player.a, Math.atan2(p.y - player.y, p.x - player.x))) < 0.8;
    if (player.rampage > 0 && (B.ramCD || 0) <= time) { B.ramCD = time + 1; stunBoss(1.6, false); SFX.clang(); }   // the Juggernaut's rampage dazes it: the tanks still have to be rammed
    if (p.part === 'rear' && nose && youIn > 120 && (B.ramCD || 0) <= time) {   // into the tanks: a segment, two while it's dazed or on nitro
      const n = B.state === 'stunned' || nitroT > 0 ? 2 : 1;
      B.ramCD = time + 0.45; damageBoss(SEG * n, 'tank', p.x, p.y, n > 1 ? 'TANKS x2!' : 'TANKS!', true); SFX.clang();
      for (let i = 0; i < 10; i++) parts.push({ k: 'spark', x: p.x, y: p.y, vx: h.nx * 200 + crand(-220, 220), vy: h.ny * 200 + crand(-220, 220), t: 0, life: 0.3 });
      player.vx += h.nx * 220; player.vy += h.ny * 220;
    } else if (nose && youIn > 120 && (B.ramCD || 0) <= time && B.state !== 'swipe') {   // its armour: a clang, and the first time a tip says where to hit
      B.ramCD = time + 0.45; SFX.clang(); tip('twinarmour', 'ARMOURED · RAM THE TANKS ON ITS BACK');
      for (let i = 0; i < 6; i++) parts.push({ k: 'spark', x: p.x, y: p.y, vx: crand(-200, 200), vy: crand(-200, 200), t: 0, life: 0.25 });
      const rel = (player.vx - B.vx) * h.nx + (player.vy - B.vy) * h.ny; if (rel < 0) { player.vx -= rel * h.nx * 1.3; player.vy -= rel * h.ny * 1.3; }
    } else if (B.state === 'swipe' && !B.hitYou && player.inv <= 0) {
      B.hitYou = true; hurt(14 + 2 * stageIx, false, 'boss'); player.vx += h.nx * 480; player.vy += h.ny * 480; spinHit(player, player.x - h.nx * 10, player.y - h.ny * 10, h.nx * 480 * player.m, h.ny * 480 * player.m, PIT_K);
    } else { const rel = (player.vx - B.vx) * h.nx + (player.vy - B.vy) * h.ny; if (rel < 0) { const j = -1.3 * rel / (1 / player.m + 1 / B.m); player.vx += j * h.nx / player.m; player.vy += j * h.ny / player.m; B.vx -= j * h.nx / B.m; B.vy -= j * h.ny / B.m; } }
    break;
  }
}

// ============ the Twin-Horse drawn: black lacquer, two blowers, gold skulls, the twin tanks on the back ============
function artTwin(g, o) {
  for (const s of [-1, 1]) { artTyre(g, -30, s * 31, 30, 17); artTyre(g, -30, s * 31 + s * 1, 30, 17); }
  for (const s of [-1, 1]) inkRR(g, -24, s * 28 - 3, 40, 6, 3, 'chrome', { box: true, lw: 1.6 });   // side pipes
  inkRR(g, -54, -25, 100, 50, 13, o.rage ? '#3a1416' : '#1d1a1c', { box: true, lw: 3.4 });
  g.strokeStyle = '#c9a227'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-50, -20); g.lineTo(42, -20); g.moveTo(-50, 20); g.lineTo(42, 20); g.stroke();   // gold pinstripes
  inkLine(g, [[-26, -25], [-26, 25]], 1.6); inkLine(g, [[-4, -25], [-4, 25]], 1.4);
  for (const s of [-1, 1]) { inkCircle(g, -40, s * 11, 9, 'orange', { box: true, lw: 2 }); inkCircle(g, -40, s * 11, 4, 'rust', { lw: 1.2, double: false }); }   // the twin fuel tanks: the soft spot
  g.strokeStyle = PAL.yellow; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(-40, 0, 24, Math.PI * 0.55, Math.PI * 1.45); g.stroke(); g.setLineDash([]);
  inkRR(g, -24, -14, 20, 28, 4, 'dark', { lw: 2 }); inkRR(g, -10, -11, 5, 22, 1.5, 'glass', { lw: 1.2, double: false });   // the cockpit
  artHead(g, -15, -5, 4.6, true, true);
  for (const s of [-1, 1]) { inkRR(g, 2, s * 10 - 7, 26, 14, 3, 'chrome', { box: true, lw: 1.8 }); inkRR(g, 26, s * 10 - 5, 8, 10, 2, 'dark', { lw: 1.4, double: false }); for (const yy of [-3, 0, 3]) inkLine(g, [[4, s * 10 + yy], [26, s * 10 + yy]], 0.9); }   // two blowers
  inkRR(g, 40, -22, 8, 44, 3, 'chrome', { box: true, lw: 2.2 });   // the bar
  for (const s of [-1, 1]) { inkEllipse(g, 46, s * 13, 6, 6.5, 0, '#c9a227', { lw: 1.4, double: false }); g.fillStyle = INK; g.beginPath(); g.arc(47, s * 13 - 2, 1.5, 0, TAU); g.arc(47, s * 13 + 2, 1.5, 0, TAU); g.fill(); }   // gold skulls on the bar
}
const TWIN_BOX = [-66, -52, 60, 52];
function drawTwin(B) {
  castShadow(B.x, B.y, B.a, 112, 70, 1.5);
  if (B.state === 'tell' && Math.floor(clock * 16) % 2) {   // the swipe is coming: arrows on the side it'll hit from
    ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.a); ctx.fillStyle = '#e8432f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    for (const x of [-30, 0, 30]) { ctx.beginPath(); ctx.moveTo(x - 9, -B.side * 40); ctx.lineTo(x, -B.side * 58); ctx.lineTo(x + 9, -B.side * 40); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  const sp = sprite(`twin${B.rage ? 1 : 0}`, TWIN_BOX, g => artTwin(g, B)), st = (B.st || 0) * 0.4, lean = (B.roll || 0) * 4;
  ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.a); ctx.scale(bounceScale(B), bounceScale(B));
  if (B.state === 'stunned') ctx.rotate(Math.sin(clock * 30) * 0.05);
  if (B.state !== 'stunned') for (const s of [-1, 1]) artFlame(ctx, -24, s * 28, B.state === 'swipe' ? 26 : 12, 3);
  for (const s of [-1, 1]) liveTyre(30, s * 28, 22, 14, st);
  ctx.save(); ctx.translate(0, lean); blit(sp);
  artDamage(ctx, 1 - B.hp / B.maxHp, 84, 42);
  const seats = [[-46, -14], [-46, 14], [-54, 0]];
  for (let i = 0; i < B.crew; i++) { const [x, y] = seats[i], aiming = B.aimT > 0 && i === 0; artWarBoy(ctx, x, y, aiming ? Math.atan2(player.y - B.y, player.x - B.x) - B.a : (y < 0 ? -1 : 1) * 2.4 + Math.sin(clock * 7 + i * 1.7) * 0.35); }
  if (B.flag) { artFlag(ctx, -52, -20, 'red', 0, true); artFlag(ctx, -52, 20, 'red', 2, true); }
  if (B.hurtT > 0) blitWhite(sp, 0.5);
  ctx.restore(); ctx.restore();
  if (B.state === 'stunned') {   // the tanks glow green under an arrow: this is where to hit
    const tx = B.x - Math.cos(B.a) * 40, ty = B.y - Math.sin(B.a) * 40, bob = Math.sin(clock * 10) * 8;
    ctx.save(); ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 5; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.arc(tx, ty, 28 * (1 + Math.sin(clock * 14) * 0.15), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.translate(tx, ty - 70 + bob); ctx.fillStyle = '#5be37d'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(16, 0); ctx.lineTo(28, 0); ctx.lineTo(0, 26); ctx.lineTo(-28, 0); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeText('RAM!', 0, -32); ctx.fillStyle = '#fff'; ctx.fillText('RAM!', 0, -32); ctx.restore();
  }
  if (B.state === 'stunned') { ctx.save(); ctx.translate(B.x, B.y); ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 84, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - B.t / B.stunFor)); ctx.stroke(); ctx.restore(); }
}
