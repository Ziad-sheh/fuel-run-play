'use strict';
// Wasteland Drift · bull.js: the boss: the Bull.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ the boss: The Bull ============
// A horned muscle truck that hunts you. Faster than you on a straight, but it turns wide and slides, so keep
// turning and drifting and it can't pin you. When it lines up, it lowers its head (red lane) and charges in a
// straight line. Dodge: if a rock, wall or drum is behind you, it crashes in. Stunned, an armour plate flies off,
// and for a couple of seconds everything you hit it with counts. It only gets hurt by what you make happen:
// crashes you bait, drums you set off, your weapons (which barely scratch the armour unless it's stunned).
// No teleports, no hidden speed-ups: the camera frames you both so it never vanishes.
function bullPoints(B) { const c = Math.cos(B.a), s = Math.sin(B.a); return [[-22, -1], [26, 1]].map(([o, part]) => ({ x: B.x + c * o, y: B.y + s * o, r: 27, part })); }
function bullInit(B) { Object.assign(B, { demo: !!demo, openT: 0, phase: 1, crew: 2, flag: true, m: 5, size: 1.6, plates: 4, state: 'hunt', burnT: 0, trailT: 0, spunOil: new Set(), slip: 0, rage: false, minD: 1e9, oled: false, stunFor: 1, laneLen: 400, stuck: false, stuckT: 0, unstick: 0, unDir: 1 }); }
function bullWeak(B) { const p = bullPoints(B)[0]; return { x: p.x, y: p.y, r: p.r, open: B.state === 'stunned' && B.openT > 0 }; }   // the demo's weak point: the tank on its back, open while it's dazed after a crash
function bullOpen(B, secs) { stunBoss(secs, true); B.openT = secs; B.hitIds = new Set(); }
let bullRamSeq = 0;
const BULL_WIND = 0.8, BULL_WIND2 = 0.8;
const bullWind = B => B.demo ? (B.phase === 2 ? 0.9 : 1.0) : B.second ? BULL_WIND2 : BULL_WIND;   // the demo's wind-up: a full second, 0.9 s once furious; its aim locks for the last 0.3 s
const BULL_DEMO = { open: 3.4, slip: 1.2, refills: 2, charge: 24, rub: 3, rubCD: 1.2 };   // the demo Bull: tank open after a crash (s), and after spinning out on your oil, crashes that spill fuel, what its charge and a hunting bump cost (a bump at most every rubCD s: the charge is the threat to read, not the grind)   // its wind-up before a charge, and before the second meeting's second charge: never under 0.8 s, furious or not
function bullMul(B, src) { return src === 'tank' ? 1 : 0; }   // only rams on its glowing tank hurt it; everything else just knocks it about
const bullHud = B => `THE BULL  ${'■'.repeat(B.plates)}${'□'.repeat(4 - B.plates)}${B.state === 'stunned' ? '  STUNNED!' : ''}`;
function bullCrash(what, W) {   // its charge ended in something hard: stunned, a plate flies off, your window opens
  const B = boss, f = bullPoints(B)[1];
  B.again = false; B.second = false;   // a crash ends a double charge
  boom(f.x + Math.cos(B.a) * 45, f.y + Math.sin(B.a) * 45, 'KRUNCH!', 1); SFX.clang();
  if (B.demo) bullOpen(B, BULL_DEMO.open); else stunBoss((what === 'rock' ? 3.6 : 3.2) - 0.1 * stageIx, true);   // dazed long enough to turn round and ram it (the demo: its tank opens)
  if (B.plates > 0) {
    B.plates--;
    for (let i = 0; i < 4; i++) { const a = B.a + Math.PI + crand(-1.3, 1.3), sp = crand(250, 450); parts.push({ k: 'plate', x: B.x, y: B.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: crand(0, TAU), spin: crand(-12, 12), t: 0, life: 3, size: crand(10, 15) }); }
  }
  if (W && !W.gone && !W.rock) { W.hp = 0; destroyWall(W); }
  ejectCrew(B, 1); if (!B.demo) dropGem(B.x, B.y, -8, 1.2); else if ((B.refills = (B.refills || 0) + 1) <= BULL_DEMO.refills) dropGem(B.x, B.y, -DEMO_BOSS_CAN, 1.2);   // its tank splits on the crash: fuel for the dodge (the demo: its first two crashes)
  slowT = Math.max(slowT, 0.3); shake = Math.max(shake, 8 * (calmMotion ? 0.3 : 1));   // a beat of slow motion; no word over it, the green arrow on its tank says what to do
  pops.push({ x: B.x, y: B.y + 95, text: B.demo ? 'TANK OPEN!' : 'DAZED! RAM IT!', col: '#5be37d', t: 0 });
  if (!B.demo && !B.plates && !B.rage) { B.rage = true; snapFlag(B); SFX.horn(); pops.push({ x: B.x, y: B.y + 125, text: "IT'S FURIOUS!", col: '#e8432f', t: 0 }); }
}
function updateBull(B, dt) {
  B.t += dt; B.hurtT -= dt; B.openT = Math.max(0, (B.openT || 0) - dt);
  if (B.demo && B.phase === 1 && B.hp <= B.maxHp / 2) {   // half health: furious. A missed charge now comes straight back, fully warned
    B.phase = 2; B.rage = true; snapFlag(B); SFX.horn(); recordRunEvent('boss_phase', { kind: 'bull', phase: 2 });
    banner = { text: "IT'S FURIOUS!", sub: 'MISS IT AND IT CHARGES AGAIN', t: 0 }; shake = Math.max(shake, 6 * (calmMotion ? 0.3 : 1));
  }
  const dx = player.x - B.x, dy = player.y - B.y, d = Math.hypot(dx, dy), off = angDiff(B.a, Math.atan2(dy, dx));
  const top = SPEED * (B.rage ? 1.22 : 1.12);   // faster than you in a straight line: you escape by turning, not by running
  let speed = 0, turn = 0, grip = 2, steerTo = off;
  if (B.state === 'hunt') {
    const lead = clamp(d / 600, 0, 0.45);
    let want = Math.atan2(player.y + player.vy * lead - B.y, player.x + player.vx * lead - B.x);
    // while hunting it steers round rocks, walls and drums: it only rams things when it charges
    const ahead = o => blocked(B.x + Math.cos(B.a + o) * 150, B.y + Math.sin(B.a + o) * 150, 30);
    if (d > 170 && ahead(0)) { const l = ahead(-0.7), r = ahead(0.7); want = B.a + (!l && r ? -0.9 : l && !r ? 0.9 : angDiff(B.a, want) < 0 ? -0.9 : 0.9); }
    B.stuckT = Math.hypot(B.vx, B.vy) < 70 ? B.stuckT + dt : 0;   // nose against something it can't push: swing away from it
    if (B.stuckT > 0.5) { const l = ahead(-1.3), r = ahead(1.3); B.unDir = !l && r ? -1 : l && !r ? 1 : grand() < 0.5 ? -1 : 1; B.unstick = 0.7; B.stuckT = 0; }
    if (B.unstick > 0) { B.unstick -= dt; want = B.a + B.unDir * 1.5; }
    steerTo = angDiff(B.a, want); speed = top * (d > 700 ? 1.2 : 1); turn = 2; grip = 2;
    if (B.t > (B.rage ? 1 : 1.4) && d > 150 && d < 520 && Math.abs(off) < 0.35 && !lineBlocked(B.x, B.y, player.x, player.y)) { B.state = 'wind'; B.t = 0; SFX.rev(); }
  } else if (B.state === 'wind') {   // lowers its head and paws the ground; the aim locks just before it goes
    const W = bullWind(B);
    if (B.t < W - (B.demo ? 0.3 : 0.2)) B.aim = Math.atan2(player.y + player.vy * 0.3 - B.y, player.x + player.vx * 0.3 - B.x);
    steerTo = angDiff(B.a, B.aim); speed = top * 0.2; turn = 3.2; grip = 4; B.laneLen = Math.min(720, d + 280);
    if (cchance() < 0.6) parts.push({ k: 'dust', x: B.x - Math.cos(B.a) * 40, y: B.y - Math.sin(B.a) * 40, vx: -Math.cos(B.a) * 120 + crand(-50, 50), vy: -Math.sin(B.a) * 120 + crand(-50, 50), t: 0, life: 0.6, size: crand(10, 16) });
    if (B.t > W) { B.state = 'charge'; B.t = 0; B.minD = d; B.oled = false; B.run = 0; B.vx = Math.cos(B.a) * top; B.vy = Math.sin(B.a) * top; SFX.lunge(); }
  } else if (B.state === 'charge') {   // dead straight, can't stop
    speed = SPEED * (B.rage ? 1.8 : 1.65); turn = 0; grip = 8; B.minD = Math.min(B.minD, d); B.run += Math.hypot(B.vx, B.vy) * dt;
    if (cchance() < 0.6) { const o = crand(-24, 24); parts.push({ k: 'speed', x: B.x - Math.cos(B.a) * 50 - Math.sin(B.a) * o, y: B.y - Math.sin(B.a) * 50 + Math.cos(B.a) * o, a: B.a, len: crand(60, 100), t: 0, life: 0.2 }); }
    if (!B.oled && B.minD < 27 + player.r + 50 && d > B.minD + 60) { B.oled = true; ole(B); }
    if (B.run > B.laneLen || B.t > 1.5) { B.state = 'skid'; B.t = 0; B.again = (B.demo ? B.phase === 2 : STG().meet === 2) && !B.second; B.second = false; }   // missed: in the second meeting it goes again at once
  } else if (B.state === 'skid') {   // missed: brakes too late, a long slide, then it turns back for you
    speed = 0; turn = 0; grip = 1; if (B.t > 0.9) { if (B.again) { B.again = false; B.second = true; B.state = 'wind'; SFX.rev(); } else B.state = 'hunt'; B.t = 0; }
  } else if (B.state === 'stunned') {   // your window
    speed = 0; turn = 0; grip = 5;
    if (cchance() < 0.3) parts.push({ k: 'spark', x: B.x + crand(-40, 40), y: B.y + crand(-40, 40), vx: crand(-80, 80), vy: crand(-120, -20), t: 0, life: 0.4 });
    if (cchance() < 0.15) parts.push({ k: 'puff', x: B.x + crand(-20, 20), y: B.y + crand(-20, 20), vx: crand(-15, 15), vy: crand(-50, -20), t: 0, life: 1, size: crand(10, 15), dark: true });
    if (B.t > B.stunFor) { B.state = 'hunt'; B.t = 0; B.stuck = false; }
  }
  drive(B, clamp(steerTo * 2.5, -1, 1), dt, speed, turn, grip);
  if (B.slip > 0.4 && cchance() < 0.6) parts.push({ k: 'dust', x: B.x - Math.cos(B.a) * 30, y: B.y - Math.sin(B.a) * 30, vx: crand(-30, 30), vy: crand(-30, 30), t: 0, life: 0.8, size: crand(12, 18) });
  if (B.rage && B.state !== 'stunned') { B.trailT -= dt; if (B.trailT <= 0) { B.trailT = 0.12; fires.push({ x: B.x - Math.cos(B.a) * 44, y: B.y - Math.sin(B.a) * 44, r: 32, t: 0, life: 2.2, bull: true }); } }
  skid(B, false);
  if (d < 900) SFX.rumble();
  // the world: hunting it shoulders things aside (and cracks walls); a charge that hits something hard is a crash
  let crashed = null, inFire = false;
  for (const p of bullPoints(B)) {
    const c = { x: p.x, y: p.y, r: p.r };
    for (const W of walls) { if (Math.abs(W.x + W.w / 2 - c.x) > W.w / 2 + 60 || Math.abs(W.y + W.h / 2 - c.y) > W.h / 2 + 60) continue; const h = circleRect(c, W); if (!h) continue; B.x += h.nx * h.pen; B.y += h.ny * h.pen; c.x += h.nx * h.pen; c.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { if (B.state === 'charge' && -vn > 150) crashed = crashed || [W.rock ? 'rock' : 'wall', W]; else if (-vn > 260) hitWall(W, 1); B.vx -= 1.2 * vn * h.nx; B.vy -= 1.2 * vn * h.ny; } }
    for (const q of [...posts, ...cranes]) { if (!near(c, q, 80)) continue; const h = circleCircle(c, q); if (!h) continue; B.x += h.nx * h.pen; B.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { if (B.state === 'charge' && -vn > 150) crashed = crashed || ['rock', null]; B.vx -= 1.2 * vn * h.nx; B.vy -= 1.2 * vn * h.ny; } }
    for (const b of crates) if (!b.gone && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.r) breakCrate(b);
    for (const b of drums) if (!b.gone && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.r) drumBoom(b);
    for (const o of oils) if (B.state === 'charge' && !B.spunOil.has(o) && Math.hypot(o.x - c.x, o.y - c.y) < o.r) { B.spunOil.add(o); B.a += (grand() < 0.5 ? -1 : 1) * 1.4; stunBoss(1.4, false); pops.push({ x: B.x, y: B.y - 70, text: 'SPUN OUT!', col: '#fff', t: 0 }); }
    for (const f of fires) if (!f.bull && Math.hypot(f.x - c.x, f.y - c.y) < f.r + c.r) inFire = true;   // its own rage trail doesn't burn it
  }
  if (crashed && B.state === 'charge') bullCrash(crashed[0], crashed[1]);
  B.burnT -= dt; if (inFire && B.burnT <= 0) { B.burnT = 0.25; damageBoss(4, 'flame', B.x, B.y); }
  // it flattens anything of its own gang still around
  const pts = bullPoints(B), bsp = Math.hypot(B.vx, B.vy);
  for (const k of cars) { if (k.dead) continue; for (const p of pts) { const h = circleCircle(k, p); if (!h) continue; if (bsp > 140) wreck(k, 'GORED!', 'trick'); else { k.x += h.nx * h.pen; k.y += h.ny * h.pen; } break; } }
  // and you: its charge (or a fast hit) gores you; when it's stunned, ram it
  for (const p of pts) {
    const h = player.air ? null : circleCircle(player, p); if (!h) continue;   // h points from the Bull to you (in the air you clear it)
    const t = player.m + B.m; player.x += h.nx * h.pen * B.m / t; player.y += h.ny * h.pen * B.m / t; B.x -= h.nx * h.pen * player.m / t; B.y -= h.ny * h.pen * player.m / t;
    const bullIn = B.vx * h.nx + B.vy * h.ny, youIn = -(player.vx * h.nx + player.vy * h.ny);
    if (player.rampage > 0 && B.state !== 'stunned' && (B.ramCD || 0) <= time) { B.ramCD = time + 1; stunBoss(1.6, false); SFX.clang(); }   // the Juggernaut's rampage dazes it: the window opens, the tank still has to be rammed
    if (B.state === 'stunned') {
      if (youIn > 110 && (B.ramCD || 0) <= time && B.demo) {   // the demo: only the tank counts; forks and nitro make the ram heavier, no cap
        B.ramCD = time + BOSS_RAM.cd; const F = eqFork(), n = bossRamSegs(F);
        const took = p.part === -1 ? bossHit({ n: SEG * n, src: F ? 'fork' : 'tank', x: p.x, y: p.y, id: 'ram' + (++bullRamSeq), word: `TANK HIT x${Math.round(n * 10) / 10}!` }) : (bossBlocked(B, p.x, p.y), 0);
        if (took > 0) { player.vx += h.nx * (BOSS_RAM.kick - 260); player.vy += h.ny * (BOSS_RAM.kick - 260); SFX.clang(); SFX.takedown(); freeze = Math.max(freeze, 0.06); shake = Math.max(shake, 7 * (calmMotion ? 0.3 : 1)); for (let i = 0; i < 10; i++) parts.push({ k: 'spark', x: p.x, y: p.y, vx: h.nx * 200 + crand(-220, 220), vy: h.ny * 200 + crand(-220, 220), t: 0, life: 0.3 }); }
      } else if (youIn > 110 && (B.ramCD || 0) <= time) {   // your window: ram the glowing tank at the back
        B.ramCD = time + 0.45;
        {   // dazed, any ram counts: one segment, two on its glowing tank (and on nitro), and its fuel spills on the first
          const n = capBossSegments((p.part === -1 ? 2 : 1) * (nitroT > 0 ? 2 : 1));   // the tank on nitro would be four: a boss loses at most two to one hit
          if (B.canReady) { B.canReady = false; dropGem(p.x, p.y, -12, 1.4); }
          damageBoss(SEG * n, 'tank', p.x, p.y, p.part === -1 ? `TANK HIT x${n}!` : n > 1 ? `HIT x${n}!` : 'HIT!'); SFX.clang(); SFX.takedown();
          freeze = Math.max(freeze, 0.06); shake = Math.max(shake, 7 * (calmMotion ? 0.3 : 1));
        }
        for (let i = 0; i < 10; i++) parts.push({ k: 'spark', x: p.x, y: p.y, vx: h.nx * 200 + crand(-220, 220), vy: h.ny * 200 + crand(-220, 220), t: 0, life: 0.3 });
      }
      player.vx += h.nx * 260; player.vy += h.ny * 260;
    } else if ((B.state === 'charge' || bullIn > 180) && player.inv <= 0 && !(B.demo && dt <= 0) && !(B.demo && B.state !== 'charge' && (B.rubCD || 0) > time)) {   // a demo Bull held by a card hurts no one; its hunting bumps cost fuel at most every BULL_DEMO.rubCD
      const cost = B.demo ? (B.state === 'charge' ? BULL_DEMO.charge : BULL_DEMO.rub) : B.state === 'charge' ? 12 + 2 * stageIx : 5, n = B.demo ? eqShieldTake(cost, B.x, B.y) : cost;   // a rear shield takes some of it from behind
      if (B.demo && B.state !== 'charge') B.rubCD = time + BULL_DEMO.rubCD;
      if (n > 0) hurt(n, false, 'boss', B); player.vx += h.nx * 520; player.vy += h.ny * 520; player.a += rand(-0.8, 0.8);   // its charge costs 12 fuel on stage 1 (more later) and throws you; a rub costs 5
      if (up.wheels) damageBoss(40 * up.wheels, 'crush', p.x, p.y);
      if (B.state === 'charge') { B.state = 'skid'; B.t = 0; B.again = false; B.second = false; }   // a charge that lands ends a double charge, like one that crashes
    } else { const rel = (player.vx - B.vx) * h.nx + (player.vy - B.vy) * h.ny; if (rel < 0) { const j = -1.3 * rel / (1 / player.m + 1 / B.m); player.vx += j * h.nx / player.m; player.vy += j * h.ny / player.m; B.vx -= j * h.nx / B.m; B.vy -= j * h.ny / B.m; } }
    if (up.ram && B.state !== 'stunned' && Math.abs(angDiff(player.a, Math.atan2(p.y - player.y, p.x - player.x))) < 0.8 && youIn > 80 && (B.ramCD || 0) <= time) { B.ramCD = time + 0.35; damageBoss(40 + 30 * up.ram, 'ram', p.x, p.y); SFX.slice(); }
    break;
  }
}
function drawBull(B) {   // The Bull: a horned monster truck with bolted armour plates
  castShadow(B.x, B.y, B.a, 104, 66, 1.5);
  if (B.state === 'wind' || B.state === 'charge' && B.t < 0.25) {   // the lane it's about to charge down
    const len = B.laneLen;
    ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.a); ctx.globalAlpha = 0.5 + Math.sin(clock * 20) * 0.2;
    ctx.fillStyle = 'rgba(232,67,47,.25)'; ctx.fillRect(60, -32, len, 64);
    ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 4; ctx.setLineDash([22, 14]); ctx.strokeRect(60, -32, len, 64); ctx.setLineDash([]);
    ctx.fillStyle = '#e8432f'; for (let x = 110; x < len + 40; x += 90) { ctx.beginPath(); ctx.moveTo(x, -18); ctx.lineTo(x + 26, 0); ctx.lineTo(x, 18); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const sp = sprite(`bull${B.rage ? 1 : 0}${B.plates}`, BULL_BOX, g => artBull(g, B));
  const sc = bounceScale(B), lean = (B.roll || 0) * 4, st = (B.st || 0) * 0.4;
  ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.a); ctx.scale(sc, sc);
  if (B.state === 'stunned') ctx.rotate(Math.sin(clock * 30) * 0.06);
  if (B.rage) { ctx.fillStyle = Math.floor(clock * 12) % 2 ? PAL.fire2 : PAL.yellow; starPath(ctx, -4, 0, 64, 14, 0.75, clock * 3); ctx.fill(); }
  if (B.state !== 'stunned' && B.state !== 'dead') for (const sy of [-17, 17]) artFlame(ctx, -54, sy, B.state === 'charge' ? 30 : 12, 3);
  for (const sy of [-1, 1]) liveTyre(26, sy * 25, 24, 14, st);
  ctx.save(); ctx.translate(0, lean);
  blit(sp);
  for (const y of [-14, 14]) inkCircle(ctx, 42, y, 3.6, B.rage || B.state === 'wind' ? '#ff2a1a' : PAL.yellow, { lw: 1.4, double: false });   // headlights
  artDamage(ctx, 1 - B.hp / B.maxHp, 80, 40);
  for (let i = 0; i < B.crew; i++) artWarBoy(ctx, -40, i ? 9 : -9, (i ? 1 : -1) * 2.4 + Math.sin(clock * 7 + i * 1.7) * 0.35);
  if (B.flag) { artFlag(ctx, -46, -18, 'dark', 0, true); artFlag(ctx, -46, 18, 'dark', 2, true); }
  if (B.state === 'stunned' && B.stuck) for (const [x, y, a] of [[64, -36, 0.4], [60, 34, -0.3], [52, -26, 1]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); inkRR(ctx, -7, -3, 14, 6, 1, 'rust', { lw: 1.4, double: false }); ctx.restore(); }   // wall debris caught on the horns
  {   // its fuel tank on the back: the weak spot, always shown; it glows green when a crash has opened it to a ram
    const open = B.state === 'stunned', pulse = 1 + Math.sin(clock * (open ? 14 : 5)) * 0.15;
    inkRR(ctx, -60, -12, 14, 24, 4, open ? '#5be37d' : 'orange', { box: true, lw: 2.2 });
    ctx.strokeStyle = open ? '#5be37d' : 'rgba(255,154,60,.9)'; ctx.lineWidth = open ? 5 : 3; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.arc(-53, 0, (open ? 26 : 19) * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (B.hurtT > 0) blitWhite(sp, 0.5);
  ctx.restore(); ctx.restore();
  if (B.state === 'stunned') {   // an arrow on the open tank: this is where to hit
    const tx = B.x - Math.cos(B.a) * 53, ty = B.y - Math.sin(B.a) * 53, bob = Math.sin(clock * 10) * 8;
    ctx.save(); ctx.translate(tx, ty - 70 + bob); ctx.fillStyle = '#5be37d'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(16, 0); ctx.lineTo(28, 0); ctx.lineTo(0, 26); ctx.lineTo(-28, 0); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeText('RAM!', 0, -32); ctx.fillStyle = '#fff'; ctx.fillText('RAM!', 0, -32); ctx.restore();
  }
  if (B.state === 'stunned') {   // stars and a ring showing how long your window lasts
    ctx.save(); ctx.translate(B.x, B.y);
    ctx.strokeStyle = '#5be37d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 80, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - B.t / B.stunFor)); ctx.stroke();
    ctx.fillStyle = PAL.yellow; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const a = clock * 5 + i * TAU / 4; starPath(ctx, Math.cos(a) * 34, -48 + Math.sin(a) * 10, 7, 5, 0.45); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
}
