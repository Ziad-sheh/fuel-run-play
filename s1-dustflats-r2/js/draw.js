'use strict';
// Wasteland Drift · draw.js: everything drawn on the canvas.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ drawing ============
function toScreen(x, y) { return [view.ax + (x - cam.x) * view.z, view.ay + (y - cam.y) * view.z]; }
const inView = (x, y, m) => Math.abs(x - cam.x) < VW / 2 / view.z + m && Math.abs(y - cam.y) < VH / 2 / view.z + m;
function bounceScale(c) { const b = c.bounce || 0; return 1 + Math.sin(b * 22) * 0.07 * b; }
function drawPlayer(c) {
  const id = c.car || 'interceptor', A = CAR_ART[id], o = { lv: level, ram: up.ram, rocket: up.rocket, flame: up.flame, caltrops: up.caltrops, wheels: up.wheels, lance: up.lance, oil: up.oil, mortar: up.mortar, emp: up.emp, plough: arm.plough, shield: arm.shield, hubs: arm.hubs };
  const sp = sprite(carArtKey(id, o), carBox(id, o), g => artCarBody(g, id, o));
  const Sz = CAR * c.size * 0.72 * bounceScale(c), lean = (c.roll || 0) * 3.4, st = (c.st || 0) * 0.45, dmg = c === player ? Math.min(1, (c.hits || 0) / 6) : 1 - c.hp / c.maxHp, [fx, fy, fw, fh] = frontWheel(id, o.wheels), [, ry, , rh] = rearWheel(id, o.wheels);
  const hgt = airH(c);   // in the air: the shadow falls further away and the car looks closer
  castShadow(c.x, c.y, c.a, (A.nose - A.tail + 4) * Sz, (2 * ry + rh) * Sz, 1 + hgt / 10);
  if (state === 'play' || state === 'pick') { ctx.save(); ctx.strokeStyle = 'rgba(255,244,220,.75)'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -clock * 18; ctx.beginPath(); ctx.ellipse(c.x, c.y + 4, 46 * c.size, 38 * c.size, 0, 0, TAU); ctx.stroke(); ctx.restore(); }   // a cream ring under you: you're never lost in the pack
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.scale(Sz * (1 + hgt / 110), Sz * (1 + hgt / 110));
  if (c.inv > 0 && !c.rampage && Math.floor(c.inv * 14) % 2) ctx.globalAlpha = 0.5;
  if (c.ghostT2 > 0) ctx.globalAlpha = 0.7;   // overdrive: half there
  if (c.rampage > 0) { ctx.fillStyle = Math.floor(clock * 14) % 2 ? 'rgba(255,122,26,.35)' : 'rgba(255,210,63,.35)'; starPath(ctx, 0, 0, (A.nose - A.tail) * 0.75, 12, 0.72, clock * 4); ctx.fill(); }   // rampage aura
  if (c.mul > 1.08) for (const [px, py] of A.pipes) artFlame(ctx, px - 2, py, 22 + (c.mul - 1) * 80, 3.6);   // nitro and boosts
  else if (Math.hypot(c.vx, c.vy) > 150 && Math.floor(clock * 30) % 2) for (const [px, py] of A.pipes) artFlame(ctx, px, py, 9, 2.2);
  for (const sy of [-1, 1]) liveTyre(fx, sy * fy, fw, fh, st, o.lv >= 10 || o.hubs);   // front wheels steer
  ctx.save(); ctx.translate(0, lean);   // the body leans out of the slide
  blit(sp);
  if (up.flame) { ctx.fillStyle = Math.floor(clock * 20) % 2 ? PAL.fire1 : PAL.fire2; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(A.nose + 6, sy * (A.half - 3), 2.8, 0, TAU); ctx.fill(); } }   // pilot lights
  artDamage(ctx, dmg, (A.nose - A.tail) * 0.8, A.half * 1.8);
  artFlag(ctx, A.flag[0], A.flag[1], A.flag[2], 0, true);
  if (demo && demo.eq && c === player) drawEquip(c, A);   // the demo's attachments, on the car at their rank
  if (id === 'harpooner') {   // the whaling gun on the bed swings to where it fired
    ctx.save(); ctx.translate(-18, 0); ctx.rotate(c.harpT > 0 ? c.harpA - c.a : Math.sin(clock * 0.8) * 0.15);
    inkRR(ctx, -4, -3, 30, 6, 2, 'gun', { lw: 1.6, double: false }); if (!(c.harpT > 0)) inkPoly(ctx, [[26, -5], [35, 0], [26, 5]], 'chrome', { lw: 1.3, double: false }); inkCircle(ctx, 0, 0, 5, 'steel', { lw: 1.4, double: false });
    ctx.restore();
  }
  if (c.boarders && c.boarders.length) { const [c0, c1] = A.cab, cx = (c0 + c1) / 2; c.boarders.forEach((b, i) => { const [ox, oy] = [[0, -7], [6, 7], [-8, 0]][i]; artWarBoy(ctx, cx + ox, oy, (oy < 0 ? -1 : 1) * 1.2 + Math.sin(b.t * 14 + b.ph) * 0.9); }); }   // war boys on your roof, hammering
  if (arm.cannon) {   // the cannon on the roof: a heavy barrel that swings onto what's in front of you
    ctx.save(); ctx.translate(A.gun[0], A.gun[1]); ctx.rotate(cannonA - c.a);
    const blen = 24 + arm.cannon * 3, back = cannonFlash > 0 ? -4 : 0;
    inkRR(ctx, back, -4.5, blen, 9, 2.5, 'dark', { lw: 1.8, double: false }); inkRR(ctx, back + blen - 6, -5.5, 7, 11, 2, 'gun', { lw: 1.4, double: false });
    if (cannonFlash > 0) { ctx.fillStyle = PAL.fire1; starPath(ctx, blen + 9, 0, 13, 7, 0.45); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
    inkCircle(ctx, 0, 0, 9, 'steel', { lw: 2, double: false }); rivets(ctx, [[-5, -5], [5, -5], [-5, 5], [5, 5]], 1.1);
    ctx.restore();
  }
  if (up.gun) {   // the turret and your gunner
    ctx.save(); ctx.translate(A.gun[0], A.gun[1]); ctx.rotate(turretA - c.a);
    const L = up.gun, n = L >= 5 ? 3 : L >= 3 ? 2 : 1, blen = 18 + L * 1.6;
    for (let i = 0; i < n; i++) { const y = n === 1 ? 0 : n === 2 ? (i ? 3 : -3) : (i - 1) * 3.6; inkRR(ctx, 0, y - 1.6, blen, 3.2, 1, 'dark', { lw: 1.5, double: false }); }
    if (gunFlash > 0) { ctx.fillStyle = PAL.fire1; starPath(ctx, blen + 4, 0, 8, 5, 0.4); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
    inkCircle(ctx, 0, 0, 6.5, 'yellow', { lw: 1.6, double: false });
    artHead(ctx, -7, 0, 3.8, false);
    ctx.restore();
  }
  ctx.restore(); ctx.restore();
}
function drawGang(c) {
  if (c.T.elite) { ctx.save(); ctx.setLineDash([12, 9]); ctx.lineDashOffset = clock * 20; ctx.strokeStyle = 'rgba(232,67,47,.8)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 2.1, 0, TAU); ctx.stroke(); ctx.restore(); }   // a guardian: a red ring under it
  const A = GANG_ART[c.type], sp = sprite('g_' + c.type, A.box, A.draw);
  const Sz = CAR * c.size * A.k * bounceScale(c), lean = (c.roll || 0) * 3, st = (c.st || 0) * 0.45, dmg = 1 - c.hp / c.maxHp;
  const hgt = airH(c);
  castShadow(c.x, c.y, c.a, (A.box[2] - A.box[0] - 10) * Sz, (A.box[3] - A.box[1] - 12) * Sz, 1 + hgt / 10);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.scale(Sz * (1 + hgt / 110), Sz * (1 + hgt / 110));
  if (c.frag > 0 || c.slideT > 0) ctx.rotate(Math.sin(clock * 40) * 0.08);
  if (Math.hypot(c.vx, c.vy) > 200 && Math.floor(clock * 30 + c.ph * 7) % 2) for (const sy of A.rear[1] > 9 ? [-A.rear[1] * 0.6, A.rear[1] * 0.6] : [0]) artFlame(ctx, A.rear[0] - 2, sy, 8, 2);
  for (const [fx, fy, fw, fh] of A.front) for (const sy of [-1, 1]) liveTyre(fx, sy * fy, fw, fh, st);
  ctx.save(); ctx.translate(0, lean);
  blit(sp);
  if (c.type === 'tanker') {   // the fuel tanker: a big tank on its bed, striped so you can't miss it
    inkRR(ctx, -38, -15, 46, 30, 13, '#e8a23a', { box: true, lw: 2.4 }); ctx.fillStyle = INK; for (const x of [-30, -16, -2]) ctx.fillRect(x, -15, 4, 30); inkCircle(ctx, -15, 0, 4.5, 'red', { lw: 1.4, double: false });
  }
  if (c.kind === 'harpoon') {   // the swivel gun swings onto you when it aims; the cable runs back to its drum
    const ga = c.aimT > 0 ? c.aimA - c.a : 0;
    inkLine(ctx, [[-3, 0], [8, 3], [20, 0]], 1.4, PAL.bone);
    ctx.save(); ctx.translate(20, 0); ctx.rotate(ga);
    inkRR(ctx, -3, -3, 28, 6, 2, 'gun', { lw: 1.8, double: false }); inkPoly(ctx, [[24, -6.5], [36, 0], [24, 6.5], [27, 0]], 'chrome', { lw: 1.6, double: false }); inkCircle(ctx, 0, 0, 5, 'steel', { lw: 1.6, double: false });
    ctx.restore();
  }
  if (A.fuses) { ctx.fillStyle = Math.floor(clock * 12 + c.ph * 5) % 2 ? PAL.fire1 : PAL.fire2; for (const s of [-1, 1]) for (const bx of [-12, -1, 10]) { ctx.beginPath(); ctx.arc(bx + 4, s * 23, 1.9, 0, TAU); ctx.fill(); } }   // the bombs' lit fuses
  artDamage(ctx, dmg, A.box[2] - A.box[0] - 14, A.box[3] - A.box[1] - 20);
  if (A.pole && c.crew > 0) {   // the pole sways behind; when it attacks it swings over to you with its rider on top
    const swing = c.mode === 'pole' ? clamp(c.modeT / 0.8, 0, 1) : 0, base = Math.PI + Math.sin(clock * 3 + c.ph) * 0.25, toYou = Math.atan2(player.y - c.y, player.x - c.x) - c.a;
    const pa = base + angDiff(base, toYou) * swing, L = 56 + swing * 30, ex = -6 + Math.cos(pa) * L, ey = Math.sin(pa) * L;
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-6 + Math.cos(pa) * L * 0.5 + Math.sin(clock * 6) * 4, Math.sin(pa) * L * 0.5, ex, ey); ctx.stroke();
    ctx.strokeStyle = ROLE.board; ctx.lineWidth = 1.8; ctx.stroke();
    artWarBoy(ctx, ex, ey, pa + Math.PI / 2 + Math.sin(clock * 9) * 0.4);
  }
  for (let i = 0; i < Math.min(c.crew, A.crew.length); i++) { const [x, y] = A.crew[i], side = y < 0 ? -1 : y > 0 ? 1 : 1; artWarBoy(ctx, x, y, side * 2.3 + Math.sin(clock * 6 + c.ph + i * 1.7) * 0.35); }
  if (c.flag) artFlag(ctx, A.flag[0], A.flag[1], A.flagCol, c.ph, A.skull);
  if (c.front && (c.mode === 'tell' || c.mode === 'brake')) for (const sy of [-1, 1]) inkCircle(ctx, A.rear[0], sy * A.rear[1], 4, '#ff2a1a', { lw: 1.5, double: false });   // brake lights
  if ((c.mode === 'wind' || c.mode === 'tell') && !c.front && Math.floor(clock * 16) % 2) for (const sy of [-1, 1]) inkCircle(ctx, A.nose[0], sy * A.nose[1], 4.5, '#ff2a1a', { lw: 1.5, double: false });
  if (c.blindT > 0) { ctx.strokeStyle = 'rgba(236,201,147,.9)'; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(0, 0, 28 + i * 7, clock * 6 + i * 3, clock * 6 + i * 3 + 2.2); ctx.stroke(); } }   // can't see
  if (c.hurtT > 0) blitWhite(sp, 0.75);
  ctx.restore(); ctx.restore();
}
function drawWalls() {
  for (const W of walls) {
    if (W.rock || !inView(W.x + W.w / 2, W.y + W.h / 2, Math.max(W.w, W.h))) continue;
    ctx.save(); if (W.shakeT > 0) ctx.translate(fxr(-1, 1) * W.shakeT * 10, fxr(-1, 1) * W.shakeT * 10);
    if (W.station) drawStation(W); else if (W.wood) drawWood(W); else scrapWall(ctx, W);
    if (W.hp < 3) {   // cracks
      const cx = W.x + W.w / 2, cy = W.y + W.h / 2; ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (let i = 0; i < (W.hp <= 1 ? 4 : 2); i++) { const a = i * 1.7 + W.x * 0.01; let x = cx, y = cy; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { const t = a + (j % 2 ? 0.6 : -0.6); x += Math.cos(t) * 10; y += Math.sin(t) * 10; ctx.lineTo(clamp(x, W.x + 2, W.x + W.w - 2), clamp(y, W.y + 2, W.y + W.h - 2)); } ctx.stroke(); }
    }
    ctx.restore();
  }
}
function drawPersons() {
  for (const p of persons) {
    if (!inView(p.x, p.y, 60)) continue;
    ctx.globalAlpha = clamp((p.life - p.t) * 2, 0, 1);
    ctx.fillStyle = 'rgba(90,30,40,.25)'; ctx.beginPath(); ctx.ellipse(p.x + 6 + p.h * 0.3, p.y + 8 + p.h * 0.4, 9, 5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y - p.h * 0.6); const sc = 1.7 * (1 + p.h / 200); ctx.scale(sc, sc);
    const skin = '#f1ece4', run = p.state === 'run';
    if (p.state === 'fly') ctx.rotate(p.a); else if (run) ctx.rotate(p.dir + Math.PI / 2);
    const sw = run ? Math.sin(p.t * 22) * 4 : 0, splay = p.state === 'fly' ? 1 : 0;
    ctx.strokeStyle = skin; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(-4 - splay * 2, 9 + sw); ctx.moveTo(2, 2); ctx.lineTo(4 + splay * 2, 9 - sw); ctx.stroke();   // legs
    ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-7 - splay, -6 + splay * 4 - sw); ctx.moveTo(2, -3); ctx.lineTo(7 + splay, -6 + splay * 4 + sw); ctx.stroke();   // arms
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#3b2a20'; rr(ctx, -3.5, -4, 7, 8, 2.5); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    artHead(ctx, 0, -7, 3.6, p.driver);
    if (p.state === 'dazed') { ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { const a = p.st * 6 + i * TAU / 3; starPath(ctx, Math.cos(a) * 7, -9 + Math.sin(a) * 3, 2.4, 5, 0.45); ctx.fill(); } }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
function drawTumbles() {
  for (const w of tumbles) {
    if (!inView(w.x, w.y, 40)) continue;
    ctx.fillStyle = 'rgba(90,30,40,.22)'; ctx.beginPath(); ctx.ellipse(w.x + 12, w.y + 15, w.r, w.r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a); ctx.strokeStyle = '#9a6a35'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc((i * 3 % 5 - 2) * 2, (i * 7 % 5 - 2) * 2, w.r * (0.55 + 0.08 * i), i, i + 4); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, w.r, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
function drawPips(c) {   // a row of pips over the car: one per hit it can still take; a hit knocks one out with a flash
  const n = Math.max(1, Math.round(c.maxHp / PIP)), left = pipsOf(c), w = 13, gap = 3, tot = n * w + (n - 1) * gap, x0 = c.x - tot / 2, y = c.y - 34 * c.size - 16;
  ctx.fillStyle = INK; ctx.fillRect(x0 - 3, y - 3, tot + 6, 14);
  for (let i = 0; i < n; i++) { ctx.fillStyle = i < left ? (c.hurtT > 0 ? '#fff' : n - left > 0 ? '#ffd23f' : '#5be37d') : '#5a4636'; ctx.fillRect(x0 + i * (w + gap), y, w, 8); }
}
function drawBossSpot(c) {   // a stage boss's weak spot, marked on the car: the War Rig's sides; the Bombardier anywhere you can catch it
  const pulse = 0.6 + 0.4 * Math.sin(clock * 8);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.globalAlpha = pulse;
  if (c.type === 'rig') { ctx.strokeStyle = INK; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.fillStyle = c.stun > 0 ? '#5be37d' : rigSideOpen(c, s) ? '#ffd23f' : '#8a8f96'; ctx.beginPath(); ctx.moveTo(-26, s * 62); ctx.lineTo(0, s * 44); ctx.lineTo(26, s * 62); ctx.closePath(); ctx.fill(); ctx.stroke(); } }   // arrows pointing in at its flanks
  else { const open = c.reloadT > 0; ctx.strokeStyle = open ? '#5be37d' : '#ffd23f'; ctx.lineWidth = open ? 8 : 5; ctx.setLineDash(open ? [] : [12, 8]); ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }   // green and solid while it reloads: ram it now
  ctx.restore();
}
function carBar(x, y, hp, max, w) {
  const f = clamp(hp / max, 0, 1);
  ctx.fillStyle = INK; ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 8);
  ctx.fillStyle = f > 0.5 ? '#5be37d' : f > 0.25 ? '#ffd23f' : '#ff4a4f'; ctx.fillRect(x - w / 2, y, w * f, 4);
}
function drawDepot() { if (demo && demo.layout) { drawDemoWorld(); return; } for (const D of allDepots()) if (inView(D.x, D.y, 420)) drawOneDepot(D); }
function drawOneDepot(D) {   // the fuel depot: a ring of rusty tanks round a packed-earth yard, a gate on the south side
  ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(D.x + 12, D.y + 16, 252, 0, TAU); ctx.fill();
  inkCircle(ctx, D.x, D.y, 250, '#c99060', { lw: 4 }); ctx.fillStyle = DOTS.sand; ctx.beginPath(); ctx.arc(D.x, D.y, 250, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(36,22,15,.25)'; ctx.lineWidth = 7; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(D.x, D.y, 150, 0.4, 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(D.x, D.y, 120, 3.6, 5.4); ctx.stroke(); ctx.setLineDash([]);   // tracks worn into the yard
  ctx.save(); ctx.font = `70px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,244,220,.7)'; ctx.fillText('FUEL', D.x, D.y); ctx.restore();
  for (const t of D.tanks) {
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(t.x + 14, t.y + 20, t.r, 0, TAU); ctx.fill();
    inkCircle(ctx, t.x, t.y, t.r, 'rust', { box: true, lw: 3.4 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; for (const k of [0.72, 0.45]) { ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, TAU); ctx.stroke(); }
    const rv = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; rv.push([t.x + Math.cos(a) * t.r * 0.86, t.y + Math.sin(a) * t.r * 0.86]); } rivets(ctx, rv, 1.4);
    ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.moveTo(t.x, t.y - 11); ctx.bezierCurveTo(t.x + 7, t.y - 4, t.x + 9, t.y + 3, t.x, t.y + 9); ctx.bezierCurveTo(t.x - 9, t.y + 3, t.x - 7, t.y - 4, t.x - 3, t.y - 7); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
  }
  const gy = D.y + 250;
  for (const sx of [-70, 70]) { inkCircle(ctx, D.x + sx, gy, 12, 'gun', { lw: 2.6, double: false }); artFlag(ctx, D.x + sx, gy, D.open ? '#5be37d' : 'red', sx, true); }
  if (!D.open) { ctx.save(); ctx.translate(D.x - 60, gy); ctx.fillStyle = '#fff'; ctx.fillRect(0, -5, 120, 10); ctx.fillStyle = PAL.red; for (let x = 0; x < 120; x += 24) ctx.fillRect(x, -5, 12, 10); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.strokeRect(0, -5, 120, 10); ctx.restore(); }
}
function updateStormFx(dt) {
  const bottom = cam.y + VH / 2 / view.z, left = cam.x - VW / 2 / view.z - 220, right = cam.x + VW / 2 / view.z + 220;
  if (stormY - bottom < 500) {   // wind streaks racing ahead of the front
    if (fxRand() < 0.5) parts.push({ k: 'gust', x: fxr(left, right), y: stormY - fxr(40, 700), vx: fxr(-30, 30), vy: -fxr(320, 460), t: 0, life: fxr(0.4, 0.7), len: fxr(40, 90), curl: fxr(-1, 1) });   // wind streaks racing ahead
  }
}
function drawStormWall() {
  if (!(state === 'play' || state === 'over' || state === 'pick')) return;
  const left = cam.x - VW / 2 / view.z - 80, right = cam.x + VW / 2 / view.z + 80, bot = cam.y + VH / 2 / view.z + 80;
  if (stormY - 140 > bot) return;
  ctx.fillStyle = REG().stormBody; ctx.fillRect(left, stormY + 60, right - left, Math.max(0, bot - stormY - 60));   // the body of the storm
  ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = DOTS.fine; ctx.fillRect(left, stormY + 60, right - left, Math.max(0, bot - stormY - 60)); ctx.restore();
  for (const [front, speed, dy] of [[false, 18, -6], [true, 40, 30]]) {   // billows rolling with the wind, the back layer slower
    const sb = stormBand(front), off = ((clock * speed) % STORM_TW + STORM_TW) % STORM_TW, y = stormY + dy + Math.sin(clock * 0.9 + (front ? 1.3 : 0)) * 7;
    for (let x = Math.floor((left - off) / STORM_TW) * STORM_TW + off; x < right + 60; x += STORM_TW) ctx.drawImage(sb.c, x + sb.x0, y + sb.y0, sb.w, sb.h);
  }
  if (Math.sin(clock * 5.1) > 0.94) {   // lightning inside the wall lights the dust up
    const x = left + ((Math.floor(clock * 2) * 0.618) % 1) * (right - left), y = stormY + 150;
    const gl = ctx.createRadialGradient(x, y, 0, x, y, 260); gl.addColorStop(0, 'rgba(255,250,225,.55)'); gl.addColorStop(1, 'rgba(255,250,225,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 260, y - 260, 520, 520);
    let bx = x, by = y - 40; ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); for (let i = 0; i < 6; i++) { bx += fxr(-28, 28); by += 40; ctx.lineTo(bx, by); } ctx.stroke();
  }
}
function drawWorldBits() {
  for (const k of cars) if (k.mode === 'tell' && !k.front) {   // a car about to swipe at you: a red dashed line toward you
    const ex = k.x + (player.x - k.x) * 0.75, ey = k.y + (player.y - k.y) * 0.75, a = Math.atan2(player.y - k.y, player.x - k.x);
    ctx.save(); ctx.globalAlpha = 0.78 + 0.2 * Math.sin(clock * 22); ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);   // a solid, thick red line: it's coming
    ctx.fillStyle = '#e8432f'; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14); ctx.lineTo(ex - Math.sin(a) * 9, ey + Math.cos(a) * 9); ctx.lineTo(ex + Math.sin(a) * 9, ey - Math.cos(a) * 9); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (const k of cars) if (k.mode === 'tell' && k.front) {   // a blocker about to stamp on the brakes: its brake lights blaze
    ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(clock * 24); ctx.fillStyle = '#ff2a1a'; ctx.beginPath(); ctx.arc(k.x - Math.cos(k.a) * 26 * k.size, k.y - Math.sin(k.a) * 26 * k.size, 26, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const k of cars) if (k.aimT > 0 && !k.dead) {   // a harpoon taking aim: a red sight line on you
    ctx.save(); ctx.globalAlpha = 0.4 + 0.5 * (1 - k.aimT / 0.8); ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(player.x, player.y); ctx.stroke(); ctx.restore();
  }
  for (const k of cars) if (k.mode === 'wind') {   // the lane a winding-up car is about to lunge down
    const len = 600 * k.T.lunge, w = 15 * k.size * CAR, f = k.modeT / k.T.wind;
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.aimA); ctx.globalAlpha = 0.35 + 0.45 * f;
    ctx.fillStyle = 'rgba(232,67,47,.22)'; ctx.fillRect(24, -w, len * Math.min(1, f * 1.5), w * 2);
    ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 3; ctx.setLineDash([16, 10]); ctx.strokeRect(24, -w, len, w * 2); ctx.setLineDash([]);
    ctx.restore();
  }
  for (const r of rubble) { if (!inView(r.x, r.y, 60)) continue; ctx.globalAlpha = clamp(r.life - r.t, 0, 1); ctx.fillStyle = '#a8693a'; for (let i = 0; i < 7; i++) { const a = i * 0.9 + r.x, d = r.r * 0.6 * ((i * 37) % 10) / 10; ctx.save(); ctx.translate(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d); ctx.rotate(a); ctx.fillRect(-7, -3, 14, 6); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(-7, -3, 14, 6); ctx.restore(); } ctx.globalAlpha = 1; }
  for (const f of fires) { if (!inView(f.x, f.y, 90)) continue; const fade = clamp((f.life - f.t) * 2, 0, 1);
    if (f.mine) {   // your fire, safe for you: loose flame tongues inside a dashed white ring (shape, not just colour, says it's yours)
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = '#ffb02e';
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + (f.x + f.y) * 0.01, d = f.r * 0.45, h = f.r * (0.5 + 0.25 * Math.sin(clock * 9 + i * 2)); ctx.beginPath(); ctx.ellipse(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - h * 0.3, h * 0.32, h * 0.6, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,248,230,.8)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    } else {   // hostile fire: a solid burning star with a red spiked edge
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = '#ff7a1a'; starPath(ctx, f.x, f.y, f.r, 10, 0.8, clock * 2); ctx.fill(); ctx.fillStyle = DOTS.fire; ctx.fill();
      ctx.strokeStyle = '#c4231a'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.globalAlpha = 1; }
  for (const st of strips) { ctx.save(); ctx.globalAlpha = clamp(st.life - st.t, 0, 1); ctx.translate(st.x, st.y); ctx.rotate(st.a); ctx.fillStyle = '#5c626a'; rr(ctx, -st.len / 2, -5, st.len, 10, 3); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#d6dde3'; for (let x = -st.len / 2 + 6; x < st.len / 2; x += 11) { ctx.beginPath(); ctx.moveTo(x - 4, -4); ctx.lineTo(x, -12); ctx.lineTo(x + 4, -4); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, 4); ctx.lineTo(x, 12); ctx.lineTo(x + 4, 4); ctx.fill(); } ctx.restore(); }
  for (const b of bombs) { if (b.t < 0) continue; const k = b.t / b.T; if (demo && b.src) { drawDemoMark(b, k); continue; } ctx.save(); ctx.globalAlpha = 0.5 + k * 0.4; ctx.strokeStyle = '#e8432f'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(b.tx, b.ty, 70 * (1.3 - k * 0.3), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(b.tx - 14, b.ty); ctx.lineTo(b.tx + 14, b.ty); ctx.moveTo(b.tx, b.ty - 14); ctx.lineTo(b.tx, b.ty + 14); ctx.stroke(); ctx.restore(); }
}
function drawProps() {
  for (const b of drums) {   // a fuel drum: red lid, a rim, two bungs, the flame says it blows
    if (!inView(b.x, b.y, 60)) continue;
    ctx.save(); ctx.setLineDash([7, 6]); ctx.lineDashOffset = -clock * 12; ctx.strokeStyle = 'rgba(255,154,60,.8)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(b.x, b.y, 48, 0, TAU); ctx.stroke(); ctx.restore();   // orange ring: this blows up
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(b.x + 9, b.y + 12, b.r, 0, TAU); ctx.fill();
    inkCircle(ctx, b.x, b.y, b.r, b.fuse > 0 && Math.floor(clock * 20) % 2 ? '#fff' : 'red', { box: true, lw: 2.8 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.78, 0, TAU); ctx.stroke();
    inkCircle(ctx, b.x - b.r * 0.42, b.y - b.r * 0.38, 2.4, 'steel', { lw: 1, double: false });
    ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.moveTo(b.x, b.y - 10); ctx.bezierCurveTo(b.x + 7, b.y - 3, b.x + 8, b.y + 4, b.x, b.y + 9); ctx.bezierCurveTo(b.x - 8, b.y + 4, b.x - 6, b.y - 3, b.x - 2, b.y - 6); ctx.bezierCurveTo(b.x - 2, b.y - 1, b.x + 1, b.y, b.x, b.y - 10); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
  }
  for (const b of crates) {   // a wooden crate: three planks, a cross brace, nails
    if (!inView(b.x, b.y, 40)) continue;
    ctx.fillStyle = SHADOW; ctx.fillRect(b.x - 12, b.y - 6, 40, 40);
    inkRR(ctx, b.x - 20, b.y - 20, 40, 40, 3, '#c98a4a', { box: true, lw: 2.8 });
    ctx.strokeStyle = 'rgba(36,22,15,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (const y of [-7, 7]) { ctx.moveTo(b.x - 20, b.y + y); ctx.lineTo(b.x + 20, b.y + y); } ctx.stroke();
    inkLine(ctx, [[b.x - 15, b.y - 15], [b.x + 15, b.y + 15]], 4, '#7a4a22'); inkLine(ctx, [[b.x + 15, b.y - 15], [b.x - 15, b.y + 15]], 4, '#7a4a22');
    rivets(ctx, [[b.x - 16, b.y - 16], [b.x + 16, b.y - 16], [b.x - 16, b.y + 16], [b.x + 16, b.y + 16]], 1.3);
  }
}
function drawBalls() {   // the wrecking ball: a chain from the turntable, a hatched steel ball with a glint
  for (const B of balls) {
    if (!inView(B.x, B.y, 80) && !inView(B.px, B.py, 80)) continue;
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.setLineDash([7, 4]); ctx.beginPath(); ctx.moveTo(B.px, B.py); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(B.x + 14, B.y + 19, B.r, 0, TAU); ctx.fill();
    inkCircle(ctx, B.x, B.y, B.r, '#4a4f57', { box: true, lw: 3.4 });
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(B.x - 6, B.y - 6, B.r * 0.6, 3.5, 4.6); ctx.stroke();
    inkCircle(ctx, B.px, B.py, 10, 'yellow', { lw: 2.6, double: false });
  }
}
const GEM_COL = { 1: '#5fd4ff', 2: '#5be37d', 4: '#c77dff', 12: '#ffd23f' };
function drawGems() {
  for (const g of gems) {
    if (!inView(g.x, g.y, 30)) continue;
    if (demo && !g.boss && g.t > DEMO_CAN_LIFE - 3 && Math.floor(clock * 8) % 2) continue;   // about to go: it blinks
    ctx.save(); ctx.translate(g.x, g.y - 4 - Math.sin(clock * 4 + g.y) * 2);
    if (g.v === 0) {   // gold coin
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, 7 * Math.abs(Math.cos(clock * 5 + g.x)) + 1.5, 7, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    } else if (g.v < 0) {   // a fuel can: a red jerrycan with a spout, a little bigger for the heavy cars' cans
      const s = g.v <= -12 ? 1.25 : 1; ctx.rotate(Math.sin(clock * 3 + g.x) * 0.25); ctx.scale(s, s);
      inkRR(ctx, -6, -8, 12, 16, 2, '#d8432f', { lw: 1.8, double: false });
      ctx.fillStyle = INK; ctx.fillRect(2, -11, 3, 4); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, 8); ctx.moveTo(6, -8); ctx.lineTo(-6, 8); ctx.stroke();
    } else {
      const s = (g.v >= 12 ? 13 : g.v >= 4 ? 10 : 7) * (1 + Math.sin(clock * 6 + g.x) * 0.08);
      ctx.fillStyle = GEM_COL[g.v] || '#5fd4ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.75, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.75, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.3, -s * 0.1); ctx.lineTo(-s * 0.2, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
function drawShots() {
  ctx.lineCap = 'round';
  drawEqShots(); drawRamFx();
  for (const b of bullets) { ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke(); ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 3; ctx.stroke(); }
  for (const m of rockets) {
    if (m.t < 0) continue;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
    if (!m.shell) { ctx.fillStyle = '#ff9a1f'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-16 - fxr(0, 8), 0); ctx.lineTo(-8, 3); ctx.fill(); }
    if (m.shell) { ctx.strokeStyle = 'rgba(255,230,120,.85)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-6, 0); ctx.stroke(); inkCircle(ctx, 0, 0, 7, 'dark', { lw: 1.8, double: false }); } else { inkRR(ctx, -9, -3.5, 16, 7, 3, 'rust', { lw: 1.6, double: false }); ctx.fillStyle = PAL.yellow; ctx.fillRect(-3, -3.5, 3, 7); }   // a cannon shell with its tracer
    ctx.restore();
  }
  for (const h of harpoons) { const k = h.owner; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(h.x, h.y); ctx.stroke(); ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(Math.atan2(h.vy, h.vx)); ctx.fillStyle = '#dfe6ec'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (tether) { const k = tether.k; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.quadraticCurveTo((k.x + player.x) / 2 + 10, (k.y + player.y) / 2 + 10, player.x, player.y); ctx.stroke(); ctx.strokeStyle = '#c9b8a0'; ctx.lineWidth = 2; ctx.stroke(); }
  for (const b of bombs) {   // in flight: a fused bomb, a thunder-stick, or a mortar shell, with its shadow on the ground
    if (b.t < 0) continue;
    const k = b.t / b.T, x = b.sx + (b.tx - b.sx) * k, y = b.sy + (b.ty - b.sy) * k, hgt = Math.sin(k * Math.PI) * (b.shell ? 200 : 120);
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(x + 6, y + 8, 7, 0, TAU); ctx.fill();
    if (b.lance) { const a = Math.atan2(b.ty - b.sy, b.tx - b.sx) + (k - 0.5) * 0.8; ctx.save(); ctx.translate(x, y - hgt); ctx.rotate(a); inkLine(ctx, [[-20, 0], [12, 0]], 3, PAL.steel); inkPoly(ctx, [[12, -4], [22, 0], [12, 4]], 'orange', { lw: 1.2, double: false }); inkCircle(ctx, 10, 0, 3.4, 'red', { lw: 1, double: false }); ctx.restore(); }
    else { inkCircle(ctx, x, y - hgt, b.shell ? 8 : 9, b.shell ? 'gun' : INK, { lw: 1.4, double: false }); ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.arc(x + 5, y - hgt - 8, 3, 0, TAU); ctx.fill(); }
  }
  for (const k of cars) if (k.aimT > 0) { ctx.save(); ctx.strokeStyle = '#2fa6a6'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.globalAlpha = 0.5 + (0.8 - k.aimT); ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x + Math.cos(k.aimA) * 450, k.y + Math.sin(k.aimA) * 450); ctx.stroke(); ctx.restore(); }
}
function drawFlameRing() {
  if (!up.flame) return;
  const R = (120 + 20 * up.flame) * (evo('flame') ? 1.5 : 1);
  ctx.save(); ctx.globalAlpha = (evo('flame') ? 0.1 : 0.16) + Math.sin(clock * 9) * 0.04; ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(player.x, player.y, R, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -clock * 80; ctx.stroke(); ctx.restore();
}
function drawParts() {
  for (const p of parts) {
    if (p.t < 0) continue;   // not started yet (a delayed ring or burst)
    const k = p.t / p.life;
    if (p.k === 'spray') { ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = '#ecc993'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k * 1.6), 0, TAU); ctx.fill(); }
    else if (p.k === 'gust') { ctx.globalAlpha = Math.sin(k * Math.PI) * 0.4; ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + p.curl * 14, p.y + p.len * 0.5, p.x, p.y + p.len); ctx.stroke(); }
    else if (p.k === 'wind') { ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * p.len, p.y - Math.sin(p.a) * p.len); ctx.stroke(); }
    else if (p.k === 'carpart') {
      ctx.save(); ctx.globalAlpha = clamp((p.life - p.t) * 2, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
      if (p.sub === 'bumper') { ctx.fillStyle = '#9aa4ae'; rr(ctx, -12, -2.5, 24, 5, 2); ctx.fill(); ctx.stroke(); }
      else if (p.sub === 'door') { ctx.fillStyle = p.col; rr(ctx, -8, -6, 16, 12, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3b2a20'; ctx.fillRect(-5, -4, 10, 4); }
      else { ctx.fillStyle = '#dfe6ec'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(8, 0); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    else if (p.k === 'flag') { ctx.save(); ctx.globalAlpha = clamp((p.life - p.t) * 2, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, 0); ctx.stroke(); ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-30, -4); ctx.lineTo(-29, 4); ctx.lineTo(-17, 6); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore(); }
    else if (p.k === 'plate') { ctx.save(); ctx.globalAlpha = clamp((p.life - p.t) * 2, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = '#8d969e'; ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7); ctx.restore(); }
    else if (p.k === 'twig') { ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.strokeStyle = '#9a6a35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, 0); ctx.lineTo(3, -4); ctx.stroke(); ctx.restore(); }
    else if (p.k === 'dspark') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke(); }
    else if (p.k === 'ember') { ctx.globalAlpha = (1 - k) * 0.85; ctx.fillStyle = k < 0.4 ? '#ffd23f' : '#ff7a1a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, TAU); ctx.fill(); }
    else if (p.k === 'flame') { ctx.globalAlpha = 1 - k; ctx.fillStyle = k < 0.4 ? '#fff3b0' : '#ff9a1f'; ctx.beginPath(); ctx.arc(p.x, p.y, 7 * (1 - k) + 2, 0, TAU); ctx.fill(); }
    else if (p.k === 'speed') { ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * p.len, p.y - Math.sin(p.a) * p.len); ctx.stroke(); }
    else if (p.k === 'dust') { ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = '#f3d6a4'; ctx.strokeStyle = 'rgba(120,60,20,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k), 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (p.k === 'spark') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); }
    else if (p.k === 'fire') { ctx.globalAlpha = Math.min(1, (1 - k) * 1.6); ctx.fillStyle = k < 0.3 ? '#fff3a0' : k < 0.6 ? '#ff9a1f' : '#e8432f'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (p.k === 'debris') { ctx.save(); ctx.globalAlpha = clamp((1 - k) * 2.5, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1); ctx.restore(); }
    else if (p.k === 'wheel') { ctx.save(); ctx.globalAlpha = clamp((1 - k) * 2.5, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(p.size, p.size); ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#c9b8a0'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.k === 'flash') { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff8d0'; starPath(ctx, p.x, p.y, p.R, 12, 0.6); ctx.fill(); }
    else if (p.k === 'ring') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.emp ? '#7fe7ff' : INK; ctx.lineWidth = 8 * (1 - k) + 2; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + k * (p.R || 170), 0, TAU); ctx.stroke(); }
    else if (p.k === 'puff') { ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = p.dark ? '#5a4a40' : '#e8dcc6'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k), 0, TAU); ctx.fill(); ctx.globalAlpha *= 0.4; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
    else if (p.k === 'fireball') drawFireball(p, k);
    ctx.globalAlpha = 1;
  }
  for (const p of parts) if (p.k === 'burst') {   // comic burst: jagged star, halftone fill, lettered word
    const k = p.t / p.life, s = (k < 0.18 ? 0.3 + k * 5 : 1.2 - (k - 0.18) * 0.25) * (p.big || 1);
    ctx.save(); ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1; ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.scale(s, s);
    starPath(ctx, 0, 0, 62, 13, 0.62); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.fillStyle = DOTS.fire; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    starPath(ctx, 0, 0, 42, 11, 0.66, 0.2); ctx.fillStyle = '#ff7a1a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.font = `${p.word.length > 6 ? 24 : 32}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText(p.word, 0, 2); ctx.fillStyle = '#fff'; ctx.fillText(p.word, 0, 2);
    ctx.restore();
  }
  for (const c of cars) if (!c.dead && !c.T.elite) drawPips(c);   // every raider: its hits left, always shown
  for (const c of cars) if (c.stageBoss && !c.dead) drawBossSpot(c);
  for (const p of [...pops.filter(q => !q.hurt), ...pops.filter(q => q.hurt)]) {   // what a hit cost you sits on top
    const k = p.t / 1.1, sz = p.small ? (p.small === 1 ? 20 : 28) * (k < 0.12 ? 1 + (0.12 - k) * 5 : 1) : 26;
    ctx.font = `${sz}px ${FONT}`; const half = ctx.measureText(p.text).width / 2 * view.z + 8, [sx] = toScreen(p.x, p.y), px = p.x + (clamp(sx, half, VW - half) - sx) / view.z;   // never off the edge of the screen
    ctx.save(); ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1; ctx.translate(px, p.y - k * 40);
    ctx.font = `${sz}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(p.text, 0, 0); ctx.fillStyle = p.col; ctx.fillText(p.text, 0, 0); ctx.restore();
  }
}
function edgeArrow(x, y, col, size = 1) {
  const [sx, sy] = toScreen(x, y); if (sx > 0 && sx < VW && sy > 0 && sy < VH) return;
  const ex = clamp(sx, 24, VW - 24), ey = clamp(sy, 150, VH - (tipNow ? 205 : 130)), a = Math.atan2(sy - view.ay, sx - view.ax);   // above the tip box while it shows
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.scale(size, size); ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-9, -11); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function depotPointer() {   // where the depot is, when it's off-screen; never over a banner or near a ravine you have to line up for
  if (!depot || banner || allDepots().some(D => (D.ravines || []).some(V => Math.abs(player.y - V.y1) < 1500 && player.y > V.y0))) return;
  const [sx, sy] = toScreen(depot.x, depot.y); if (sx > 20 && sx < VW - 20 && sy > 20 && sy < VH - 20) return;
  const ex = clamp(sx, 40, VW - 40), ey = clamp(sy, 280, VH - (tipNow ? 205 : 190)), a = Math.atan2(sy - view.ay, sx - view.ax);
  ctx.save(); ctx.translate(ex, ey); ctx.globalAlpha = 0.6;   // a quiet guide, not a target
  ctx.save(); ctx.rotate(a); ctx.fillStyle = depot.open ? '#5be37d' : '#e8432f'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(8, -13); ctx.lineTo(8, 13); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = CREAM; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(depot.boss ? '\u2620\uFE0F' : '⛽', 0, 1);   // a skull marks the fortress
  ctx.restore();
}
function warnMarker(I) {   // a gang car is about to roll in here: a red arrow at the screen edge, pointing in at you
  const [sx, sy] = toScreen(I.x, I.y), ex = clamp(sx, 26, VW - 26), ey = clamp(sy, 150, VH - (tipNow ? 205 : 190)), k = 1 - I.t / 1.5, elite = GANG[I.type].elite;
  const [px, py] = toScreen(player.x, player.y), a = Math.atan2(py - ey, px - ex);
  ctx.save(); ctx.translate(ex, ey); ctx.globalAlpha = 0.4 + k * 0.5;
  ctx.save(); ctx.rotate(a); ctx.fillStyle = elite ? '#e8432f' : '#e9c48a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-6, -17); ctx.lineTo(0, 0); ctx.lineTo(-6, 17); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();   // dust-coloured: someone's coming (red only for a guardian)
  ctx.fillStyle = GANG[I.type].col; ctx.beginPath(); ctx.arc(-10 * Math.cos(a), -10 * Math.sin(a), 8, 0, TAU); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}
function bullMarker() {   // where the Bull will burst in: a big pulsing horned warning at the screen edge
  const fwd = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a, [x, y] = edgePoint(fwd + bullIn.ang, 0);
  const [sx, sy] = toScreen(x, y), ex = clamp(sx, 46, VW - 46), ey = clamp(sy, 190, VH - 210), k = 1 - bullIn.t / 1.4, s = (1 + Math.sin(clock * 16) * 0.12) * (1 + k * 0.3);
  ctx.save(); ctx.translate(ex, ey); ctx.scale(s, s); ctx.strokeStyle = INK;
  ctx.fillStyle = '#f3d6a4'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + clock * 2.5; ctx.beginPath(); ctx.arc(Math.cos(a) * 27, Math.sin(a) * 27, 11, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#f3e6cc'; ctx.lineWidth = 3;
  for (const h of [-1, 1]) { ctx.beginPath(); ctx.moveTo(h * 10, -14); ctx.quadraticCurveTo(h * 34, -18, h * 30, -42); ctx.quadraticCurveTo(h * 22, -24, h * 4, -20); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#e8432f'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeText('!!', 0, 3); ctx.fillStyle = '#fff'; ctx.fillText('!!', 0, 3);
  ctx.restore();
}
function drawOverlay() {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const say = (t, x, y, size, col) => { ctx.font = `${size}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); };
  const dc = player && player.dc;
  if (false && dc && dc.pts > 0 && (state === 'play' || state === 'pick')) {   // (retired) the drift combo counter: drifting now adds to the score quietly
    const mul = (dc.on ? dc.prox : 1) * (1 + 0.5 * (dc.chain - 1)), y = VH - 190;
    say(`DRIFT x${mul.toFixed(1).replace('.0', '')}`, VW / 2, y, 26, dc.on ? DRIFT_COL[Math.min(3, dc.prox)] : '#ffd23f');
    say(String(Math.round(dc.pts)), VW / 2, y + 24, 18, CREAM);
    if (!dc.on) { ctx.fillStyle = INK; ctx.fillRect(VW / 2 - 40, y + 40, 80, 6); ctx.fillStyle = '#ffd23f'; ctx.fillRect(VW / 2 - 40, y + 40, 80 * (1 - dc.idle / 1.2), 6); }
  } else if (false && dc && dc.bankT > 0 && dc.bank) { ctx.globalAlpha = Math.min(1, dc.bankT * 2); say(dc.bank, VW / 2, VH - 190 - (1 - dc.bankT) * 20, 22, '#ffd23f'); ctx.globalAlpha = 1; }   // banked
  if (state === 'play' && hintT > 0) {
    ctx.globalAlpha = Math.min(1, hintT) * 0.95;
    if (control === 'tap') { say('◀ HOLD', VW * 0.25, VH * 0.66, 26, CREAM); say('HOLD ▶', VW * 0.75, VH * 0.66, 26, CREAM); } else say('◀  SLIDE YOUR THUMB  ▶', VW / 2, VH * 0.66, 26, CREAM);
    if (demo) { say('YOUR TANK DRAINS · WRECKS REFILL IT', VW / 2, VH * 0.72, 19, '#ffd23f'); say('YOUR WEAPONS FIRE BY THEMSELVES', VW / 2, VH * 0.76, 16, '#ffd23f'); }
    else { say('YOUR TANK DRAINS · WRECK RAIDERS FOR FUEL', VW / 2, VH * 0.72, 19, '#ffd23f'); say('HIT THEM WITH YOUR NOSE', VW / 2, VH * 0.76, 16, '#ffd23f'); }
    ctx.globalAlpha = 1;
  }
  if (banner) {
    if (!drawOverlay.hb || drawOverlay.vh !== VH) { const r = $('top').getBoundingClientRect(); if (r.height) { drawOverlay.hb = r.bottom; drawOverlay.vh = VH; } }
    const below = (boss && !boss.dead) || bullIn || cars.some(k => k.T.elite && !k.dead), target = (drawOverlay.hb || VH * 0.15) + 44 + (below ? 66 : 0);
    banner.y = banner.y === undefined ? target : banner.y + (target - banner.y) * 0.25;   // under the HUD, and under the boss bar whenever there is one
    const end = bannerEnd(banner), k = banner.t, s = (k < 0.25 ? 0.4 + k * 2.4 : 1) * 0.8, a = k > end - 0.5 ? (end - k) * 2 : 1;
    ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(VW / 2, banner.y); ctx.rotate(-0.04); ctx.scale(s, s);
    ctx.fillStyle = banner.text.startsWith('REGION') ? '#5be37d' : banner.text.startsWith('DUST') ? '#c8823a' : '#e8432f'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-VW * 0.46, -34); ctx.lineTo(VW * 0.46, -44); ctx.lineTo(VW * 0.44, 38); ctx.lineTo(-VW * 0.44, 44); ctx.closePath(); ctx.fill(); ctx.stroke();
    say(banner.text, 0, 2, Math.min(40, VW / banner.text.length * 1.6), '#fff');
    if (banner.sub) say(banner.sub, 0, 76, Math.min(19, VW / banner.sub.length * 2.1), '#ffd23f');   // how to beat it
  }
  ctx.restore();
}

let clock = 0, frameNo = 0;
function drawWorld() {
  for (const ch of chunks.values()) if (inView(ch.x + CH / 2, ch.y + CH / 2, CH / 2 + 2)) ctx.drawImage(ch.cv, ch.x, ch.y, CH + 1, CH + 1);
  drawDepot();
  drawHazardsLow();
  drawWalls();
  drawWorldBits();
  drawFlameRing();
  drawGems();
  drawProps();
  drawTumbles();
  drawArsenalGround();
  drawGadgets();
  drawSectionsLow();
  for (const k of cars) drawGang(k);
  if (demo) for (const k of cars) if (k.type === 'tanker' && !k.dead && inView(k.x, k.y, 80)) {   // the demo's convoy tanker: a fuel tank on its back and a FUEL tag, so it reads as the prize, not another ram truck
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.a); inkRR(ctx, -46, -15, 44, 30, 13, '#e8a23a', { lw: 2.6 }); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-40, -10, 32, 5); ctx.restore();
    ctx.save(); ctx.translate(k.x, k.y - 92); const p = 1 + 0.06 * Math.sin(clock * 6); ctx.scale(p, p); inkRR(ctx, -30, -14, 60, 28, 8, '#e8a23a', { lw: 2.4 }); ctx.fillStyle = INK; ctx.font = `18px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('FUEL', 0, 7); ctx.restore();
  }
  drawPersons();
  drawPlayer(player);
  drawArsenalAir();
  drawBoss();
  drawBalls();
  drawShots();
  drawParts();
  drawHazardsHigh();
  drawSectionsHigh();
  drawStormWall();
}
function drawAtmosphere(dt) {
  if (state === 'play' || state === 'over' || state === 'pick') {   // as the storm nears, the light dims from behind
    const near = clamp(1 - (stormY - player.y - 200) / 900, 0, 1);
    if (near > 0) { const gd = ctx.createLinearGradient(0, VH, 0, VH * 0.35); gd.addColorStop(0, `rgba(90,48,26,${0.42 * near})`); gd.addColorStop(1, 'rgba(90,48,26,0)'); ctx.fillStyle = gd; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = `rgba(60,30,20,${0.1 * near})`; ctx.fillRect(0, 0, VW, VH); }
  }
  // inside the storm: thick haze with a small clear pocket around you
  const sk = stormHaze();
  if (sk > 0) {
    const k = sk, [px, py] = toScreen(player.x, player.y), m = Math.min(VW, VH), pocket = 0.24 - 0.08 * clamp((player.y - stormY) / 600, 0, 1);
    const g = ctx.createRadialGradient(px, py, m * pocket, px, py, m * (pocket + 0.36)); g.addColorStop(0, 'rgba(214,150,80,0)'); g.addColorStop(1, `rgba(214,150,80,${0.88 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = `rgba(255,230,190,${0.45 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 40; i++) { const x = ((i * 137 + clock * 900) % (VW + 200)) - 100, y = (i * 61.7 + clock * 120) % VH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 50, y + 15); ctx.stroke(); }
  }
  drawGrade();
}
function render(dt) {
  clock += dt; frameNo++;
  shake *= Math.exp(-11 * dt);
  view.ax = VW / 2 + fxr(-1, 1) * shake; view.ay = VH / 2 + fxr(-1, 1) * shake;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#e9b872'; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(view.ax, view.ay); ctx.scale(view.z, view.z); ctx.translate(-cam.x, -cam.y);
  drawWorld();
  if (devOverlay) drawDevOverlay();
  ctx.restore();
  drawAtmosphere(dt);
  if (hurtFlash > 0) { const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.75); g.addColorStop(0, 'rgba(232,67,47,0)'); g.addColorStop(1, `rgba(232,67,47,${0.55 * hurtFlash})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
  if (state === 'play' || state === 'pick') {
    for (const k of cars) if ((k.T.elite || k.T.convoy) && !k.dead && !inView(k.x, k.y, 0)) edgeArrow(k.x, k.y, k.T.convoy ? '#e8a23a' : '#e8432f', 2);   // a guardian or the convoy's tanker off screen: a big arrow   // a guardian off screen: a big red arrow
    if (false) for (const k of cars.filter(k => !k.dead && !k.flee && !k.T.elite && !inView(k.x, k.y, 0)).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, 3)) edgeArrow(k.x, k.y, k.T.col, (k.T.armour ? 1.2 : 1) * (k.mode === 'wind' || k.mode === 'lunge' || k.mode === 'ram' ? 1.4 : 1));   // only the three nearest: the ones about to matter
    for (const I of incoming) warnMarker(I);
    if (bullIn) bullMarker();
    if (boss) edgeArrow(boss.x, boss.y, '#e8432f', 2);
    depotPointer();
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;   // banners and hints always draw from a clean slate, whatever was drawn before
  drawOverlay();
}
