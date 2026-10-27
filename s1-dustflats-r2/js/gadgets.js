'use strict';
// Wasteland Drift · gadgets.js: five gadgets you pick up from crates on the road and fire with the button on the left.
// One slot, one shot each, and every one is a way to make them crash: oil, spikes, a mine, a harpoon, a shockwave.
// The crate shows what's inside, so grabbing one (or leaving it) is your call.
// Classic scripts sharing one global scope, loaded in order by index.html.

const MINE_SVG = '<svg viewBox="0 0 32 32"><circle cx="16" cy="17" r="11" fill="#3a2a22" stroke="#24160f" stroke-width="2"/><path d="M16 2v6M5 7l4 4M27 7l-4 4M2 18h5M25 18h5" stroke="#24160f" stroke-width="3"/><circle cx="16" cy="17" r="4" fill="#e8432f" stroke="#24160f" stroke-width="1.5"/></svg>';
const HOOK_SVG = '<svg viewBox="0 0 32 32"><path d="M4 28 L22 10" stroke="#8d969e" stroke-width="3.5"/><path d="M20 4 L29 3 L28 12 L24 9 L19 14 L17 12 L22 7 Z" fill="#dfe6ec" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/><path d="M4 28 C8 22 3 18 7 14" fill="none" stroke="#24160f" stroke-width="1.6" stroke-dasharray="2 2"/></svg>';
const GADGETS = {
  oil:     { name: 'OIL',       icon: () => ICON.oil,      say: 'OIL: TAP TO SPILL IT BEHIND YOU · CHASERS SPIN OUT' },
  spikes:  { name: 'SPIKES',    icon: () => ICON.caltrops, say: 'SPIKES: TAP TO DROP A STRIP BEHIND YOU · THEIR TYRES BLOW' },
  mine:    { name: 'MINE',      icon: () => MINE_SVG,      say: 'MINE: TAP TO DROP IT · IT BLOWS WHEN THEY ROLL OVER IT' },
  harpoon: { name: 'HARPOON',   icon: () => HOOK_SVG,      say: 'HARPOON: TAP TO HOOK THE CAR AHEAD · DRIFT TO SWING IT INTO ROCKS' },
  shock:   { name: 'SHOCKWAVE', icon: () => ICON.emp,      say: 'SHOCKWAVE: TAP TO BLAST EVERY CAR AWAY · THEY HIT WHATEVER IS BEHIND THEM' },
};
const GADGET_IMG = {};   // the icons as images, for drawing them on the crates
for (const [k, G] of Object.entries(GADGETS)) { const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(G.icon().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); GADGET_IMG[k] = im; }
let gadget = null, boxes = [], boxT = 4, mines = [];
function resetGadgets() { gadget = null; boxes = []; boxT = 4; mines = []; renderGadget(); }
function renderGadget() {
  const b = $('gadgetBtn'); if (!b) return;
  b.classList.toggle('full', !!gadget); b.classList.toggle('idle', !gadget);
  b.innerHTML = gadget ? `<i>${GADGETS[gadget].icon()}</i><span>${GADGETS[gadget].name}</span>` : '<span>EMPTY</span>';
}
function takeGadget(kind) {
  gadget = kind; renderGadget(); SFX.coin(); SFX.clang();
  pops.push({ x: player.x, y: player.y - 72, text: `${GADGETS[kind].name}!`, col: '#7fd6ff', t: 0 });
  tip('gadget_' + kind, GADGETS[kind].say);
}
function useGadget() {
  if (state !== 'play' || !gadget) return;
  const g = gadget, ca = Math.cos(player.a), sa = Math.sin(player.a), bx = player.x - ca * 52, by = player.y - sa * 52;
  gadget = null; renderGadget();
  if (g === 'oil') {   // three big slicks in a line behind you
    for (let i = 0; i < 3; i++) slicks.push({ x: bx - ca * i * 64 + rand(-14, 14), y: by - sa * i * 64 + rand(-14, 14), r: 62, t: 0, life: 9, hit: new Set(), seed: Math.floor(rand(1, 999)) });
    SFX.whoosh(); callout('OIL SPILL!', '#c77dff');
  } else if (g === 'spikes') {   // a long strip across your line
    strips.push({ x: bx - ca * 24, y: by - sa * 24, a: player.a + Math.PI / 2, len: 300, t: 0, life: 10, hit: new Set(), dmg: 30 });
    SFX.crate(); callout('SPIKES!', '#d6dde3');
  } else if (g === 'mine') {
    mines.push({ x: bx, y: by, t: 0 }); SFX.clang(); callout('MINE DOWN!', '#ff5a46');
  } else if (g === 'harpoon') {   // at the car you're pointing at (ahead or beside), or the boss
    let best = null, bs = 1e9;
    for (const k of cars) { if (k.dead) continue; const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy); if (d < 40 || d > 650) continue; const sc = d * (1 + Math.abs(angDiff(player.a, Math.atan2(dy, dx))) * 1.2); if (sc < bs) { bs = sc; best = k; } }
    const B = boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < 650 ? boss : null, T = best || B, a = T ? Math.atan2(T.y + T.vy * 0.15 - player.y, T.x + T.vx * 0.15 - player.x) : player.a;
    harpoons.push({ x: player.x, y: player.y, vx: Math.cos(a) * 1400, vy: Math.sin(a) * 1400, t: 0, owner: player, mine: true });
    player.harpA = a; player.harpT = 0.4; SFX.twang(); callout('HARPOON!', '#7fd6ff');
  } else if (g === 'shock') {   // a ring that throws every car around you outward and stuns them
    SFX.horn(); SFX.clang(); parts.push({ k: 'ring', x: player.x, y: player.y, t: 0, life: 0.45, R: 400, emp: true }); parts.push({ k: 'ring', x: player.x, y: player.y, t: -0.1, life: 0.45, R: 280, emp: true });
    for (const k of cars) {
      const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy) || 1; if (d > 400) continue;
      const f = 420 + 560 * (1 - d / 400); blame(k); k.vx += dx / d * f; k.vy += dy / d * f; k.stun = Math.max(k.stun, 1.5); k.frag = Math.max(k.frag, 1.5); k.slideT = Math.max(k.slideT, 0.5); zap(player.x, player.y, k.x, k.y);
      spinHit(k, k.x - dx / d * 10, k.y - dy / d * 10, dx / d * f * k.m, dy / d * f * k.m, PIT_K);
    }
    if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < 480) { if (boss.kind === 'fortress') boss.jamT = 3; else stunBoss(1.4, false); damageBoss(boss.maxHp * 0.03, 'trick', boss.x, boss.y); }
    callout('SHOCKWAVE!', '#7fe7ff');
  }
}
function mineBoom(M) {
  M.gone = true; boom(M.x, M.y, null, 1.15);
  for (const k of cars) if (!k.dead && Math.hypot(k.x - M.x, k.y - M.y) < 140) { blame(k); damage(k, 150, 'trick', 'KABOOM!', M.x, M.y); }
  if (boss && !boss.dead && bossPoints().some(p => Math.hypot(p.x - M.x, p.y - M.y) < 140)) { damageBoss(boss.maxHp * 0.06, 'trick', M.x, M.y, 'BOOM!', true); stunBoss(1, false); }
  if (Math.hypot(player.x - M.x, player.y - M.y) < 90) hurt(12);
}
function updateGadgets(dt) {
  // a crate turns up ahead every 10-15 s, on the road if there is one
  boxT -= dt;
  if (boxT <= 0 && boxes.length < 2 && !boss) {
    boxT = rand(10, 15);
    const fwd = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a, d = 700 + rand(0, 200);
    let x = player.x + Math.cos(fwd) * d; const y = player.y + Math.sin(fwd) * d, rx = roadX(y); if (rx !== null && Math.abs(rx - x) < 450) x = rx + rand(-40, 40);
    if (!blocked(x, y, 44)) boxes.push({ x, y, t: 0, kind: pick(Object.keys(GADGETS).filter(k => k !== gadget)) });
  }
  for (const B of boxes) { B.t += dt; const d = Math.hypot(B.x - player.x, B.y - player.y); if (d < player.r + 28) { B.got = true; takeGadget(B.kind); } else if (d > 2200) B.got = true; }
  boxes = boxes.filter(B => !B.got);
  for (const M of mines) { M.t += dt; if (M.t > 0.35) for (const k of cars) if (!k.dead && Math.hypot(k.x - M.x, k.y - M.y) < k.r + 32) { mineBoom(M); break; } if (!M.gone && boss && !boss.dead && M.t > 0.35 && bossPoints().some(p => Math.hypot(p.x - M.x, p.y - M.y) < p.r + 20)) mineBoom(M); if (M.t > 25) M.gone = true; }
  mines = mines.filter(M => !M.gone);
}
function drawGadgets() {   // crates with what's inside on the lid, and your mines with a blinking light
  for (const B of boxes) {
    if (!inView(B.x, B.y, 60)) continue;
    const bob = Math.sin(clock * 5 + B.x) * 3;
    ctx.save(); ctx.translate(B.x, B.y);
    ctx.strokeStyle = 'rgba(127,214,255,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 40 + Math.sin(clock * 6) * 4, 0, TAU); ctx.stroke();   // a blue glow ring: grab me
    ctx.fillStyle = SHADOW; ctx.fillRect(-18, -12, 44, 40);
    ctx.translate(0, bob);
    inkRR(ctx, -24, -24, 48, 48, 5, 'yellow', { box: true, lw: 3 });
    const im = GADGET_IMG[B.kind]; if (im.complete) ctx.drawImage(im, -18, -18, 36, 36);
    ctx.restore();
  }
  for (const M of mines) {
    if (!inView(M.x, M.y, 30)) continue;
    inkCircle(ctx, M.x, M.y, 13, 'dark', { lw: 2.4, double: false });
    ctx.fillStyle = Math.floor(clock * 6) % 2 ? '#ff3b2a' : '#5a1a14'; ctx.beginPath(); ctx.arc(M.x, M.y, 5, 0, TAU); ctx.fill();
  }
}
