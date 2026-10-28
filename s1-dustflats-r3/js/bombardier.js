'use strict';
// Fuel Run · bombardier.js: the demo's Bombardier, a mortar truck in the Red Canyon quarry.
// Its rhythm: drive to a firing spot (one in each of the quarry's three pockets, never a jump), mark targets where you're
// heading (each mark locks the moment it appears and shows its red circle for a full 1.2 s), fire, then sit reloading
// with its magazine open for 2.8 s: the opening, for guns and for anyone who can get round to its back. Then it moves on.
// At half health it turns furious: it alternates the aimed volley with a wall of shells across your path that always
// leaves one gap the biggest car fits, and it changes spots after every reload. Its hits go through boss_rules.js:
// only the open magazine counts. Shells leave short fires; nothing else in the quarry attacks you.
// Classic scripts sharing one global scope, loaded in order by index.html.

const BOMB_DEMO = { open: 2.8, markT: 1.2, wallT: 1.4, gap: 0.45, shell: 12, rub: 6, speed: 0.82 };   // seconds the magazine stays open, each mark's warning, the wall's warning, time between marks, fuel a shell costs, a rub, its speed (× yours)
function bombInit(B) {
  Object.assign(B, { type: 'bombard', kind: 'bomber2', T: GANG.bombard, size: 1.8, r: 30, m: 4, crew: 2, flag: true, ph: rand(0, 2), state: 'mark', t: 0, openT: 0, phase: 1, pi: B.pi ?? 1,
    marks: [], volleys: 0, slip: 0, lost: 0, front: false, mode: 'boss', frag: 0, slideT: 0, hitIds: new Set(), mortarA: 0 });
}
function bombPoints(B) { const c = Math.cos(B.a), s = Math.sin(B.a); return [[24, 1, 28], [-24, -1, 30]].map(([o, part, r]) => ({ x: B.x + c * o, y: B.y + s * o, r, part })); }
function bombWeak(B) { const p = bombPoints(B)[1]; return { x: p.x, y: p.y, r: p.r, open: B.state === 'reload' && B.openT > 0 }; }   // the magazine on its bed
const bombHud = B => B.state === 'reload' ? 'MAGAZINE OPEN: HIT IT!' : B.state === 'move' ? 'ON THE MOVE' : !B.laid ? 'TAKING AIM: KEEP MOVING' : B.prep ? 'RELOAD NEXT: GET CLOSE' : B.phase === 2 ? 'FURIOUS · FIND THE GAP' : 'DODGE THE SHELLS';   // what it is doing now (prep: its last shell is away, the magazine opens next)   // what it is doing now
const bombLead = (B, secs = BOMB_DEMO.markT, cap = 420) => {   // where you'll be when the shell lands if you keep doing what you're doing: your speed and your turn carried forward (a steady circle is easy to read); never more than `cap` off, so the mark stays near the screen
  const v = Math.hypot(player.vx, player.vy); let x = player.x, y = player.y, a = v > 30 ? Math.atan2(player.vy, player.vx) : player.a; const om = B ? clamp(B.om || 0, -4, 4) : 0;
  for (let t = 0; t < secs; t += 0.05) { a += om * 0.05; x += Math.cos(a) * v * 0.05; y += Math.sin(a) * v * 0.05; }
  const d = Math.hypot(x - player.x, y - player.y); if (d > cap) { x = player.x + (x - player.x) * cap / d; y = player.y + (y - player.y) * cap / d; }
  return [x, y, a];
};
function bombQuarryClamp(x, y) { const A = demo.layout.arena, dx = x - A.x, dy = y - A.y, d = Math.hypot(dx, dy), m = A.R - 70; return d > m ? [A.x + dx / d * m, A.y + dy / d * m] : [x, y]; }
function bombMark(B, x, y, T, delay = 0) {   // a shell: its target locked now, its red circle up for T seconds
  [x, y] = bombQuarryClamp(x, y);
  bombs.push({ sx: B.x, sy: B.y, tx: x, ty: y, t: -delay, T, shell: true, src: 'boss', dmg: BOMB_DEMO.shell }); B.mortarA = Math.atan2(y - B.y, x - B.x);
  return [x, y];
}
function bombLaneDemo(B) {   // phase 1's other volley: a line of shells across where you're heading, a second or so ahead, with one gap: steer for it or turn away (circling no longer dodges everything)
  const [lx, ly, la] = bombLead(B, BOMB_DEMO.wallT * 0.65, 360), d = Math.hypot(lx - player.x, ly - player.y);   // across the path you're on (curving with you), a little short of where you'll be
  const hx = d > 1 ? Math.cos(la) : Math.cos(player.a), hy = d > 1 ? Math.sin(la) : Math.sin(player.a), push = Math.max(0, 180 - d);
  const cx = lx + hx * push, cy = ly + hy * push, nx = -hy, ny = hx, gapAt = clamp(Math.round(rand(-1, 1)), -1, 1), at = {};
  for (let i = -4; i <= 4; i++) { if (Math.abs(i - gapAt) <= 1) continue; at[i] = bombMark(B, cx + nx * i * 90, cy + ny * i * 90, BOMB_DEMO.wallT); }
  const a = at[gapAt - 2], b = at[gapAt + 2]; SFX.whoosh();   // the shells either side of the gap, after the quarry wall has pulled any inward
  return { T: BOMB_DEMO.wallT, gap: Math.hypot(b[0] - a[0], b[1] - a[1]) - 2 * 78, gx: (a[0] + b[0]) / 2, gy: (a[1] + b[1]) / 2 };
}
function bombWallDemo(B) {   // nine shells in a line across your path, three slots left out near you: the gap
  const toP = Math.atan2(player.y - B.y, player.x - B.x), nx = -Math.sin(toP), ny = Math.cos(toP), [cx, cy] = bombLead(B), gapAt = clamp(Math.round(rand(-1, 1)), -1, 1);
  let left = -1e9, right = 1e9;
  for (let i = -4; i <= 4; i++) { if (Math.abs(i - gapAt) <= 1) continue; const o = i * 90; bombMark(B, cx + nx * o, cy + ny * o, BOMB_DEMO.wallT); if (i < gapAt) left = Math.max(left, o); else right = Math.min(right, o); }
  SFX.whoosh(); return { T: BOMB_DEMO.wallT, gap: right - left - 2 * 78, gx: gapAt * 90 };
}
function bombRelocate(B, nearYou) {   // to another pocket, round the middle through the inner ring: the one nearest you (to get you in its sights) or farthest (after a reload)
  const A = demo.layout.arena, from = A.spots[B.pi], dist = i => Math.hypot(A.spots[i].x - player.x, A.spots[i].y - player.y);
  const others = A.spots.map((S, i) => i).filter(i => i !== B.pi).sort((a, b) => nearYou ? dist(a) - dist(b) : dist(b) - dist(a));
  B.pi = others[0]; B.via = { x: (from.inner.x + A.spots[B.pi].inner.x) / 2, y: (from.inner.y + A.spots[B.pi].inner.y) / 2 };
  const mid = Math.hypot(B.via.x - A.x, B.via.y - A.y); if (mid < 200) { const a = Math.atan2(B.via.y - A.y, B.via.x - A.x) || 0; B.via = { x: A.x + Math.cos(a) * 245, y: A.y + Math.sin(a) * 245 }; }
  B.state = 'move'; B.t = 0; B.unseenT = 0;
}
function updateBombardier(B, dt) {
  B.t += dt; B.hurtT -= dt; B.openT = Math.max(0, B.openT - dt);
  if (dt > 0) { const turn = angDiff(B.pa ?? player.a, player.a) / dt; B.om = (B.om || 0) + (turn - (B.om || 0)) * Math.min(1, dt * 4); B.pa = player.a; }   // how fast you're turning, smoothed
  const A = demo.layout.arena, d = Math.hypot(player.x - B.x, player.y - B.y);
  if (B.phase === 1 && B.hp <= B.maxHp / 2) { B.phase = 2; snapFlag(B); SFX.horn(); recordRunEvent('boss_phase', { kind: 'bombardier', phase: 2 }); banner = { text: "IT'S FURIOUS!", sub: 'SHELL WALLS: FIND THE GAP', t: 0 }; shake = Math.max(shake, 6 * (calmMotion ? 0.3 : 1)); }
  let speed = 0, steerTo = 0;
  if (B.state === 'move') {   // to the next spot, round the middle through the inner ring if the way's blocked
    const S = A.spots[B.pi], tgt = B.via && Math.hypot(B.via.x - B.x, B.via.y - B.y) > 60 ? B.via : S; if (tgt === S) B.via = null;
    steerTo = angDiff(B.a, Math.atan2(tgt.y - B.y, tgt.x - B.x)); speed = SPEED * BOMB_DEMO.speed * (Math.hypot(S.x - B.x, S.y - B.y) < 160 ? 0.5 : 1);
    if (Math.hypot(S.x - B.x, S.y - B.y) < 50 || B.t > 9) { B.state = 'mark'; B.t = 0; B.marks = []; }
  } else if (B.state === 'mark') {   // turn the mortar on you and lay the marks; only once it's in view, so you see every one
    steerTo = angDiff(B.a, Math.atan2(player.y - B.y, player.x - B.x)) * 0.5;
    if (!B.laid && !inView(B.x, B.y, -30)) { B.unseenT = (B.unseenT || 0) + dt; if (B.unseenT > 1.2) { bombRelocate(B, true); return; } }   // out of your view: it never fires unseen; it drives to the pocket nearest you instead
    else if (!B.laid && dt > 0 && inView(B.x, B.y, -30)) {   // dt 0: a card holds play, and it starts nothing
      B.laid = true; B.volleys++; const wall = B.phase === 2 && B.volleys % 2 === 0, lane = B.phase === 1 && B.volleys % 2 === 0;
      if (wall) { bombWallDemo(B); B.fireEnd = B.t + BOMB_DEMO.wallT + 0.3; B.prep = true; }
      else if (lane) { bombLaneDemo(B); B.fireEnd = B.t + BOMB_DEMO.wallT + 0.3; B.prep = true; }
      else { const n = B.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) B.marks.push(B.t + i * BOMB_DEMO.gap); B.fireEnd = B.t + (n - 1) * BOMB_DEMO.gap + BOMB_DEMO.markT + 0.3; }
    }
    while (dt > 0 && B.marks.length && B.t >= B.marks[0]) { B.marks.shift(); if (!B.marks.length) B.prep = true; const [x, y] = bombLead(B); bombMark(B, x + rand(-30, 30), y + rand(-30, 30), BOMB_DEMO.markT); SFX.whoosh(); }   // each mark aims where you're going, then stays
    if (dt > 0 && B.laid && B.t >= B.fireEnd) { if ((B.refills = (B.refills || 0) + 1) <= 2) { const W = bombWeak(B); dropGem(W.x, W.y, -DEMO_BOSS_CAN, 1.2); }   // its first two reloads spill fuel by its magazine
      B.state = 'reload'; B.t = 0; B.laid = false; B.prep = false; B.openT = BOMB_DEMO.open; B.hitIds = new Set(); recordRunEvent('boss_window', { kind: 'bomber2', secs: BOMB_DEMO.open }); pops.push({ x: B.x, y: B.y - 70, text: 'RELOADING!', col: '#5be37d', t: 0 }); }
  } else if (B.state === 'reload') {   // sits still, magazine open
    if (B.openT <= 0) bombRelocate(B, false);   // then moves to another pocket: the one farther from you (furious: never the same one twice)
  }
  drive(B, clamp(steerTo * 2.5, -1, 1), dt, speed, 2.2, 4);
  // the world: rocks and walls stop it
  for (const p of bombPoints(B)) {
    const c = { x: p.x, y: p.y, r: p.r };
    for (const q of posts) { if (!near(c, q, 140)) continue; const h = circleCircle(c, q); if (!h) continue; B.x += h.nx * h.pen; B.y += h.ny * h.pen; const vn = B.vx * h.nx + B.vy * h.ny; if (vn < 0) { B.vx -= 1.2 * vn * h.nx; B.vy -= 1.2 * vn * h.ny; } }
  }
  // you: rammed while it reloads, the magazine takes it; anywhere else the armour rings; it rubs you if it drives into you
  for (const p of bombPoints(B)) {
    const h = player.air ? null : circleCircle(player, p); if (!h) continue;
    const t = player.m + B.m; player.x += h.nx * h.pen * B.m / t; player.y += h.ny * h.pen * B.m / t; B.x -= h.nx * h.pen * player.m / t; B.y -= h.ny * h.pen * player.m / t;
    const youIn = -(player.vx * h.nx + player.vy * h.ny), itIn = B.vx * h.nx + B.vy * h.ny;
    if (dt <= 0) { /* held: it only keeps its shape */ }
    else if (youIn > 110 && (B.ramCD || 0) <= time) {
      B.ramCD = time + BOSS_RAM.cd; const F = eqFork(), n = bossRamSegs(F);
      const took = p.part === -1 ? bossHit({ n: SEG * n, src: F ? 'fork' : 'tank', x: p.x, y: p.y, id: 'bram' + (++bullRamSeq), word: `MAGAZINE HIT x${Math.round(n * 10) / 10}!` }) : (bossBlocked(B, p.x, p.y), 0);
      if (took > 0) { SFX.clang(); SFX.takedown(); freeze = Math.max(freeze, 0.06); shake = Math.max(shake, 7 * (calmMotion ? 0.3 : 1)); }
      player.vx += h.nx * (took > 0 ? BOSS_RAM.kick : 220); player.vy += h.ny * (took > 0 ? BOSS_RAM.kick : 220);
    } else if (itIn > 120 && player.inv <= 0) { const n = eqShieldTake(BOMB_DEMO.rub, B.x, B.y); if (n > 0) hurt(n, false, 'boss'); player.vx += h.nx * 300; player.vy += h.ny * 300; }
    break;
  }
  if (d < 900) SFX.rumble();
}
function drawBombardier(B) {
  drawGang(B);
  const c = Math.cos(B.a), s = Math.sin(B.a), mx = B.x - c * 20, my = B.y - s * 20;
  ctx.save(); ctx.translate(mx, my); ctx.rotate(B.mortarA); inkRR(ctx, -6, -9, 34, 18, 5, PAL.gun, { lw: 2.4, double: false }); inkCircle(ctx, 28, 0, 7, PAL.dark, { lw: 2, double: false }); ctx.restore();   // the mortar on its bed
  const W = bombWeak(B);
  if (W.open) {   // the magazine: a green ring and an arrow, flashing faster as the reload ends
    ctx.save(); ctx.strokeStyle = B.openT < 0.8 && Math.floor(clock * 10) % 2 ? '#ffd23f' : '#5be37d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W.x, W.y, W.r + 12, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#5be37d'; ctx.beginPath(); ctx.moveTo(W.x, W.y - W.r - 22); ctx.lineTo(W.x - 12, W.y - W.r - 42); ctx.lineTo(W.x + 12, W.y - W.r - 42); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  } else if (B.prep && B.state === 'mark') { inkRR(ctx, W.x - 12, W.y - 10, 24, 20, 4, Math.floor(clock * 6) % 2 ? '#ffb02e' : PAL.steel, { lw: 2, double: false }); ctx.save(); ctx.strokeStyle = 'rgba(255,176,46,.8)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(W.x, W.y, W.r + 12, 0, TAU); ctx.stroke(); ctx.restore(); }   // about to open: the lid flashes amber in a dashed ring
  else inkRR(ctx, W.x - 12, W.y - 10, 24, 20, 4, PAL.steel, { lw: 2, double: false });   // shut: a steel lid
}
BOSS_KINDS.bomber2 = { name: 'THE BOMBARDIER', loose: 'THE BOMBARDIER!', hp: 1, noStun: true, weakName: 'MAGAZINE', weak: B => bombWeak(B), demoHud: B => bombHud(B), init: B => bombInit(B), update: (B, dt) => updateBombardier(B, dt), draw: B => drawBombardier(B), points: B => bombPoints(B), mul: () => 1, hud: B => bombHud(B) };
