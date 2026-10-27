'use strict';
// Wasteland Drift · art.js: the Ink & Rust look (art direction A).
// Thick ink with a faint offset double line, hatched and halftoned shade, rivets, seams and chipped paint, long
// shadows from a low sun at the top left. Vehicle bodies are drawn once into sprites, so they stay crisp at any zoom
// and cost one drawImage a frame; the moving parts (steered wheels, crew, flags, guns, damage) are drawn live on top.

const PAL = {
  sand: '#e8b673', sand2: '#d69858', rock: '#a8603a', rockTop: '#cf905c', rust: '#a9532c', rust2: '#7a3a22', chrome: '#d4dbe0', steel: '#8d969e', gun: '#5c626a',
  orange: '#f07a24', red: '#d8432f', blood: '#8e1f17', yellow: '#f2c23a', teal: '#2f8f9d', purple: '#7d4fc9', bone: '#f2e4c8', dark: '#3b2a20', tyre: '#2c211b',
  glass: '#86c6d8', skin: '#f1ece4', smoke: '#8a7d74', fire1: '#fff2a8', fire2: '#ff9a1f', fire3: '#e8432f', storm1: '#c78a52', storm2: '#8e5a36', asphalt: '#6a625a', paint: '#f2c23a',
};
const SHADOW = 'rgba(80,30,40,.32)', SUN_X = 10, SUN_Y = 14;   // the low sun sits top-left: every shadow falls down-right
const LINE = 3, THIN = 1.3;
DOTS.fine = dotPattern('rgba(36,22,15,.42)', 6, 1.3);

// ============ paths and inked shapes ============
function pCircle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
function pPoly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function pEllipse(g, x, y, rx, ry, a = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, TAU); }
// one inked shape: flat colour, shade on the lower side (halftone, then hatching) inside its box, then the ink line and its faint double
function ink(g, path, fill, o = {}) {
  if (fill) { path(); g.fillStyle = PAL[fill] || fill; g.fill(); }
  if (o.box && o.shade !== false) {
    const [x, y, w, h] = o.box;
    g.save(); path(); g.clip();
    g.fillStyle = DOTS.fine; g.fillRect(x, y + h * 0.55, w, h * 0.6);
    if (o.hatch !== false) { g.strokeStyle = 'rgba(36,22,15,.5)'; g.lineWidth = 1; g.beginPath(); for (let i = -h; i < w; i += 4.5) { g.moveTo(x + i, y + h); g.lineTo(x + i + h * 0.5, y + h * 0.62); } g.stroke(); }
    g.restore();
  }
  if (o.line !== false) {
    path(); g.lineWidth = o.thin ? THIN : (o.lw || LINE); g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    if (!o.thin && o.double !== false) { g.save(); g.translate(0.8, 0.6); g.globalAlpha *= 0.35; path(); g.lineWidth = 1; g.stroke(); g.restore(); }
  }
}
const withBox = (o, b) => o.box === true ? Object.assign({}, o, { box: b }) : o;
const inkRR = (g, x, y, w, h, r, fill, o = {}) => ink(g, () => rr(g, x, y, w, h, r), fill, withBox(o, [x, y, w, h]));
const inkCircle = (g, x, y, r, fill, o = {}) => ink(g, () => pCircle(g, x, y, r), fill, withBox(o, [x - r, y - r, 2 * r, 2 * r]));
const inkEllipse = (g, x, y, rx, ry, a, fill, o = {}) => ink(g, () => pEllipse(g, x, y, rx, ry, a), fill, withBox(o, [x - rx, y - ry, 2 * rx, 2 * ry]));
const inkPoly = (g, pts, fill, o = {}) => ink(g, () => pPoly(g, pts), fill, o);
function inkLine(g, pts, w = THIN, col = INK) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
function rivets(g, pts, r = 0.9) { g.fillStyle = INK; g.beginPath(); for (const [x, y] of pts) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill(); }
function fillOnly(g, path, fill, alpha = 1) { path(); g.save(); g.globalAlpha *= alpha; g.fillStyle = PAL[fill] || fill; g.fill(); g.restore(); }

// ============ sprites: draw once at high resolution, blit every frame ============
const SPR = 2.2;   // sprite pixels per local unit: still oversampled at the closest zoom on a 2x screen
const spriteCache = new Map();
function sprite(key, box, draw, scale = SPR) {
  let s = spriteCache.get(key);
  if (s) { s.used = clock; return s; }
  const [x0, y0, x1, y1] = box, c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * scale); c.height = Math.ceil((y1 - y0) * scale);
  const g = c.getContext('2d'); g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale); draw(g);
  s = { c, x0, y0, w: x1 - x0, h: y1 - y0, used: clock };
  spriteCache.set(key, s);
  if (spriteCache.size > 48) { let old = null; for (const e of spriteCache) if (!old || e[1].used < old[1].used) old = e; spriteCache.delete(old[0]); }
  return s;
}
function blit(s) { ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h); }
function blitWhite(s, a) {   // the hit flash: the same silhouette in white
  if (!s.white) { const c = document.createElement('canvas'); c.width = s.c.width; c.height = s.c.height; const g = c.getContext('2d'); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); s.white = c; }
  const was = ctx.globalAlpha; ctx.globalAlpha = was * a; ctx.drawImage(s.white, s.x0, s.y0, s.w, s.h); ctx.globalAlpha = was;
}
function castShadow(x, y, a, L, W, k = 1) {   // a car's long shadow, thrown down-right in world space
  ctx.save(); ctx.translate(x + SUN_X * k, y + SUN_Y * k); ctx.rotate(a); ctx.fillStyle = SHADOW; rr(ctx, -L / 2, -W / 2, L, W, Math.min(9, W / 3)); ctx.fill(); ctx.restore();
}

// ============ parts shared by every vehicle ============
function artTyre(g, x, y, w, h, ang, spikes) {
  g.save(); g.translate(x, y); if (ang) g.rotate(ang);
  inkRR(g, -w / 2, -h / 2, w, h, h * 0.35, 'tyre', { box: true, lw: 2.2 });
  g.strokeStyle = 'rgba(255,240,220,.25)'; g.lineWidth = 1.2; g.beginPath(); for (let i = -w / 2 + 3; i < w / 2; i += 3.6) { g.moveTo(i, -h / 2 + 1.5); g.lineTo(i, h / 2 - 1.5); } g.stroke();
  if (spikes) for (const s of [-1, 1]) inkPoly(g, [[-3, s * h / 2], [0, s * (h / 2 + 6)], [3, s * h / 2]], 'chrome', { lw: 1.1, double: false });
  g.restore();
}
function artHead(g, x, y, r, driver, horns) {   // a war boy's white-painted bald head, or a driver in goggles
  if (horns) for (const s of [-1, 1]) inkPoly(g, [[x - 1, y + s * r * 0.6], [x + 5, y + s * (r + 5)], [x + 2, y + s * r * 0.3]], 'bone', { lw: 1.1, double: false });
  inkCircle(g, x, y, r, driver ? 'dark' : 'skin', { box: true, lw: 1.4, hatch: false, double: false });
  if (driver) { g.fillStyle = PAL.glass; g.fillRect(x + r * 0.15, y - r * 0.8, r * 0.55, r * 1.6); }
  else { g.fillStyle = INK; g.beginPath(); g.ellipse(x + r * 0.35, y - r * 0.4, r * 0.28, r * 0.2, 0, 0, TAU); g.ellipse(x + r * 0.35, y + r * 0.4, r * 0.28, r * 0.2, 0, 0, TAU); g.fill(); }
}
function artWarBoy(g, x, y, armA) {   // top-down: white-painted shoulders, bald head, spear up
  inkEllipse(g, x, y, 5, 8, 0, 'skin', { box: true, lw: 1.4, hatch: false, double: false });
  const ex = x + Math.cos(armA) * 24, ey = y + Math.sin(armA) * 24;
  inkLine(g, [[x, y + 3], [ex, ey]], 2.2);
  inkPoly(g, [[ex + Math.cos(armA) * 7, ey + Math.sin(armA) * 7], [ex - Math.sin(armA) * 3.2, ey + Math.cos(armA) * 3.2], [ex + Math.sin(armA) * 3.2, ey - Math.cos(armA) * 3.2]], 'chrome', { lw: 1.1, double: false });
  artHead(g, x + 1, y, 4.4, false);
}
function artFlag(g, x, y, col, ph, skull) {   // a pole leaning back and a flag snapping in the wind
  inkLine(g, [[x, y], [x - 28, y - 9]], 2);
  const w = Math.sin(clock * 9 + ph) * 3.5, w2 = Math.sin(clock * 9 + ph + 1.2) * 4;
  ink(g, () => { g.beginPath(); g.moveTo(x - 28, y - 9); g.quadraticCurveTo(x - 36, y - 11 + w, x - 46, y - 8 + w2); g.lineTo(x - 44, y + 3 + w2); g.quadraticCurveTo(x - 35, y + 1 + w, x - 26, y + 2); g.closePath(); }, col, { lw: 1.6, double: false });
  if (skull) { g.fillStyle = PAL.bone; g.beginPath(); g.arc(x - 36, y - 3 + w * 0.6, 3, 0, TAU); g.fill(); g.fillStyle = INK; g.fillRect(x - 37.5, y - 4 + w * 0.6, 1.2, 1.2); g.fillRect(x - 35.5, y - 4 + w * 0.6, 1.2, 1.2); }
}
function artFlame(g, x, y, len, w = 3) {   // exhaust or nitro flame, two tongues
  for (const [c, k] of [['fire2', 1], ['fire1', 0.55]]) { g.fillStyle = PAL[c]; g.beginPath(); g.moveTo(x, y - w * k); g.quadraticCurveTo(x - len * k * 0.6, y - (w + 1) * k, x - len * k * (0.9 + fxRand() * 0.2), y); g.quadraticCurveTo(x - len * k * 0.6, y + (w + 1) * k, x, y + w * k); g.fill(); }
}
function artDamage(g, dmg, w, h) {   // dents, then a bare-metal patch where a panel came off
  if (dmg < 0.25) return;
  const dents = [[-w * 0.3, -h * 0.25], [w * 0.2, h * 0.28], [-w * 0.05, h * 0.3], [w * 0.32, -h * 0.3]], n = dmg > 0.75 ? 4 : dmg > 0.5 ? 3 : 2;
  for (let i = 0; i < n; i++) { const [x, y] = dents[i]; inkLine(g, [[x - 4, y - 2], [x - 1, y + 2], [x + 2, y - 2], [x + 5, y + 1]], 1.6); }
  if (dmg > 0.5) { inkRR(g, -w * 0.42, -h * 0.5, w * 0.22, h * 0.32, 2, 'steel', { lw: 1.6, double: false }); rivets(g, [[-w * 0.38, -h * 0.42], [-w * 0.24, -h * 0.42]], 1.2); }
}

// ============ vehicles: nose toward +x ============
// The six cars you can drive. Each draws its own body; the generic part adds the bigger rear wheels and the bolt-ons
// you earn in a run (armour, push bar or ram spikes, rocket pods, flamers, caltrop box, extra pipes, the big wing),
// placed from the car's own dimensions so they fit every body.
function bodyInterceptor(g) {   // chrome, an orange stripe, a blower, roll cage, spare wheel and jerrycans
  for (const s of [-1, 1]) inkRR(g, -36, s * 17 - 2.6, 46, 5.2, 2.6, 'chrome', { box: true, lw: 1.6 });   // side pipes
  inkRR(g, -36, -16, 70, 32, 9, 'chrome', { box: true });
  fillOnly(g, () => rr(g, -36, -5, 70, 3.4, 1), 'orange'); fillOnly(g, () => rr(g, -36, 1.6, 70, 3.4, 1), 'orange');
  g.fillStyle = PAL.chrome; for (const cx of [-22, -3, 19]) g.fillRect(cx, -5, 2, 3.4);   // chipped stripe
  inkLine(g, [[-12, -16], [-12, 16]]); inkLine(g, [[16, -16], [16, 16]]);   // panel seams
  const rv = []; for (let i = -30; i < 32; i += 8) rv.push([i, -13.5], [i, 13.5]); rivets(g, rv);
  inkPoly(g, [[-8, -11], [7, -9], [7, 9], [-8, 11]], 'glass', { box: [-8, -11, 15, 22], lw: 1.8 });
  artHead(g, 1, -4.5, 4.4, true);   // you
  inkRR(g, 14, -8, 17, 16, 3, 'chrome', { box: true, lw: 1.8 });   // the blower
  inkRR(g, 27, -6, 9, 12, 2, 'dark', { lw: 1.6 });
  for (const yy of [-4, 0, 4]) inkLine(g, [[16, yy], [27, yy]], 1);
  inkLine(g, [[-14, -15], [-14, 15]], 2.6); inkLine(g, [[-14, -15], [4, -12]], 2.2); inkLine(g, [[-14, 15], [4, 12]], 2.2);   // roll cage
  inkCircle(g, -30, 0, 9, 'dark', { box: true, lw: 1.8 }); inkCircle(g, -30, 0, 4, 'chrome', { lw: 1.2, double: false });   // spare wheel
  for (const yy of [-12, 7]) inkRR(g, -25, yy, 7, 5, 1.2, 'red', { lw: 1.2, double: false });   // jerrycans
  inkRR(g, -41, -17, 5, 34, 1.5, 'orange', { lw: 1.6 });   // wing
}
function bodySandviper(g) {   // a dune buggy: a narrow tub, a tube cage, paddle tyres, the engine hanging off the back
  inkRR(g, -40, -8, 13, 16, 3, 'chrome', { box: true, lw: 1.8 });   // the engine out back
  for (const yy of [-5, 0, 5]) inkCircle(g, -35, yy, 1.9, 'dark', { line: false });   // three velocity stacks in a row
  inkRR(g, -30, -9, 54, 18, 7, 'yellow', { box: true });
  g.fillStyle = INK; for (const cx of [-24, -14, -4, 6]) { g.beginPath(); g.moveTo(cx, -9); g.lineTo(cx + 6, -2); g.lineTo(cx + 3, -9); g.fill(); g.beginPath(); g.moveTo(cx, 9); g.lineTo(cx + 6, 2); g.lineTo(cx + 3, 9); g.fill(); }   // hazard chevrons
  inkPoly(g, [[22, -8], [38, -3], [38, 3], [22, 8]], 'yellow', { box: [22, -8, 16, 16], lw: 2.2 });   // the nose
  inkRR(g, 26, -3.5, 9, 7, 2, 'red', { lw: 1.2, double: false });   // a spare can on the nose
  g.strokeStyle = PAL.chrome; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.rect(-22, -12.5, 28, 25); g.moveTo(-22, -12.5); g.lineTo(6, 12.5); g.moveTo(-22, 12.5); g.lineTo(6, -12.5); g.stroke();   // the cage
  g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
  artHead(g, -6, 0, 4.4, true);
}
function bodyJuggernaut(g) {   // a war rig: a long chrome guzzoline tank, a rust cab, a plough with painted teeth
  for (const s of [-1, 1]) artTyre(g, -14, s * 19, 18, 11);   // middle axle
  inkRR(g, -52, -15, 56, 30, 13, 'chrome', { box: true, lw: 3.2 });   // the tank
  for (let i = -42; i <= -6; i += 12) inkLine(g, [[i, -14], [i, 14]], 1.6);
  fillOnly(g, () => { g.beginPath(); g.ellipse(-30, -6, 9, 5, 0.3, 0, TAU); g.moveTo(-5, 7); g.ellipse(-10, 7, 6, 3.5, -0.2, 0, TAU); }, 'rust', 0.85);
  inkCircle(g, -24, 0, 4.5, 'dark', { lw: 1.4, double: false });   // the filler cap
  inkRR(g, 4, -17, 30, 34, 4, 'rust', { box: true, lw: 3 });   // the cab
  inkRR(g, 22, -13, 6, 26, 1.5, 'glass', { lw: 1.3, double: false });
  artHead(g, 15, -6, 4.4, true);
  for (const s of [-1, 1]) { inkRR(g, 2, s * 19 - 3, 8, 6, 2.5, 'chrome', { lw: 1.4, double: false }); inkCircle(g, 4, s * 19, 2.2, INK, { line: false }); }   // smokestacks
  inkPoly(g, [[34, -24], [46, -14], [46, 14], [34, 24]], 'chrome', { box: [34, -24, 12, 48] });   // the plough
  g.fillStyle = '#fff'; for (let yy = -16; yy < 16; yy += 5.5) { g.beginPath(); g.moveTo(38, yy); g.lineTo(42, yy + 2.75); g.lineTo(38, yy + 5.5); g.fill(); }
}
function bodyHarpooner(g) {   // a pickup: teal cab, an open bed with the gun mount (drawn live), spare harpoons, a winch
  inkRR(g, -40, -15, 74, 30, 7, 'teal', { box: true });
  inkRR(g, -36, -11, 34, 22, 3, 'rust2', { lw: 1.8 });   // the bed
  g.strokeStyle = 'rgba(36,22,15,.5)'; g.lineWidth = 1; g.beginPath(); for (let x = -33; x < -4; x += 5) { g.moveTo(x, -11); g.lineTo(x, 11); } g.stroke();
  for (const s of [-1, 1]) { inkLine(g, [[-34, s * 8.5], [-12, s * 8.5]], 2.2, PAL.steel); inkPoly(g, [[-12, s * 8.5 - 2.4], [-7, s * 8.5], [-12, s * 8.5 + 2.4]], 'chrome', { lw: 1, double: false }); }   // spare harpoons
  inkCircle(g, -6, 0, 5, 'dark', { lw: 1.6, double: false }); g.strokeStyle = PAL.steel; g.lineWidth = 1; g.beginPath(); g.arc(-6, 0, 2.6, 0, TAU); g.stroke();   // winch
  inkRR(g, 0, -13, 22, 26, 5, 'teal', { box: true, lw: 2.2 });   // cab roof
  inkRR(g, 15, -10, 5, 20, 1.5, 'glass', { lw: 1.2, double: false });
  artHead(g, 8, -5, 4.2, true);
  g.strokeStyle = PAL.bone; g.lineWidth = 2; g.beginPath(); for (let x = 24; x <= 32; x += 4) g.lineTo(x, (x / 4) % 2 ? -10 : -6); g.stroke();   // zigzag on the hood
}
function bodyDoof(g) {   // the Doof Wagon: drums at the back, a wall of speakers, the guitarist on his bungee at the nose
  inkRR(g, -44, -18, 64, 36, 6, 'dark', { box: true });
  for (const [x, y] of [[-36, -9], [-36, 9], [-24, -9], [-24, 9]]) { inkCircle(g, x, y, 6, 'rust', { lw: 1.6, double: false }); inkCircle(g, x, y, 3.4, 'bone', { lw: 1, double: false }); }   // war drums
  for (let i = 0; i < 4; i++) { const y = -16 + i * 8; inkRR(g, 2, y, 14, 8, 1, '#2a2226', { lw: 1.4, double: false }); inkCircle(g, 9, y + 4, 2.8, 'steel', { lw: 0.9, double: false }); }   // the speaker wall
  inkRR(g, 16, -15, 22, 30, 5, 'red', { box: true, lw: 2.4 });   // cab
  inkRR(g, 30, -11, 5, 22, 1.5, 'glass', { lw: 1.2, double: false });
  inkLine(g, [[38, -12], [46, 0], [38, 12]], 2.2, PAL.chrome); inkLine(g, [[38, -12], [46, 0], [38, 12]], 0.9);   // the bungee frame
  inkEllipse(g, 44, 0, 4.5, 6.5, 0, 'red', { lw: 1.3, double: false }); artHead(g, 45, 0, 3.6, false);   // the Doof Warrior in red
  inkRR(g, 40, 5, 12, 4, 1.5, 'chrome', { lw: 1.2, double: false });   // his guitar
}
function bodyBlackOnBlack(g) {   // the last V8: black paint, gold pinstripes, a huge blower through the hood, side pipes
  for (const s of [-1, 1]) inkRR(g, -30, s * 17 - 2.6, 40, 5.2, 2.6, 'chrome', { box: true, lw: 1.6 });
  inkRR(g, -38, -15, 76, 30, 10, '#1d1a1c', { box: true });
  g.strokeStyle = '#c9a227'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-34, -11); g.lineTo(34, -11); g.moveTo(-34, 11); g.lineTo(34, 11); g.stroke();   // gold pinstripes
  inkPoly(g, [[-16, -12], [-2, -10], [-2, 10], [-16, 12]], 'glass', { box: [-16, -12, 14, 24], lw: 1.6 });
  artHead(g, -8, -4.5, 4.2, true);
  inkRR(g, 12, -9, 22, 18, 3, 'chrome', { box: true, lw: 2 });   // the blower
  inkRR(g, 30, -7, 10, 14, 2, 'dark', { lw: 1.6 });
  for (const yy of [-5, 0, 5]) inkLine(g, [[14, yy], [30, yy]], 1);
  inkRR(g, -42, -14, 5, 28, 1.5, '#1d1a1c', { lw: 1.6 });   // spoiler
}
const CAR_ART = {   // body, dimensions (tail, nose, half width), wheels [x, y, w, h], where the live bits go, the scale on the road
  interceptor:  { draw: bodyInterceptor,  tail: -41, nose: 34, half: 16, rear: [-21, 20, 20, 11], front: [21, 20, 20, 11], gun: [-4, 5],   flag: [-34, -12, 'orange'], pipes: [[-36, -17], [-36, 17]], cab: [-14, 4, 13] },
  sandviper:    { draw: bodySandviper,    tail: -40, nose: 38, half: 10, rear: [-24, 18, 24, 14], front: [22, 15, 14, 8],  gun: [-14, 0],  flag: [-38, 6, 'red'],      pipes: [[-41, -5], [-41, 5]],   cab: [-22, 6, 12] },
  juggernaut:   { draw: bodyJuggernaut,   tail: -52, nose: 46, half: 17, rear: [-36, 19, 18, 11], front: [24, 19, 18, 11], gun: [-30, 0],  flag: [-50, -12, 'dark'],   pipes: [[2, -19], [2, 19]],     cab: [4, 34, 15] },
  harpooner:    { draw: bodyHarpooner,    tail: -40, nose: 34, half: 15, rear: [-24, 18, 19, 11], front: [20, 18, 19, 11], gun: [-18, 0],  flag: [-38, -10, 'dark'],   pipes: [[-40, -9], [-40, 9]],   cab: [0, 22, 12] },
  doof:         { draw: bodyDoof,         tail: -44, nose: 46, half: 18, rear: [-26, 20, 20, 12], front: [24, 20, 20, 12], gun: [-30, 0],  flag: [-42, -14, 'red'],    pipes: [[-44, -12], [-44, 12]], cab: [16, 38, 13] },
  blackonblack: { draw: bodyBlackOnBlack, tail: -42, nose: 40, half: 15, rear: [-22, 18, 22, 12], front: [24, 17, 18, 10], gun: [-24, 0],  flag: [-40, -10, 'dark'],   pipes: [[-30, -17], [-30, 17]], cab: [-16, -2, 12] },
};
const wheelK = wl => 1 + 0.16 * wl;
function rearWheel(id, wl) { const [x, y, w, h] = CAR_ART[id].rear, k = wheelK(wl); return [x, y + 2 * wl, w * k, h * k]; }
function frontWheel(id, wl) { const [x, y, w, h] = CAR_ART[id].front, k = wheelK(wl); return [x, y + 2 * wl, w * k, h * k]; }
function artCarBody(g, id, o) {
  const A = CAR_ART[id], [rx, ry, rw, rh] = rearWheel(id, o.wheels), L = A.nose - A.tail;
  for (const s of [-1, 1]) artTyre(g, rx, s * ry, rw, rh, 0, o.lv >= 10 || o.hubs);
  if (o.shield) { const w = 6 + o.shield * 1.5; inkRR(g, A.tail - w - 2, -A.half - 4, w, 2 * A.half + 8, 2, 'steel', { box: true, lw: 2.2 }); rivets(g, [[A.tail - w / 2 - 2, -A.half + 2], [A.tail - w / 2 - 2, 0], [A.tail - w / 2 - 2, A.half - 2]], 1.3); }   // the back shield
  if (o.rocket) for (const s of [-1, 1]) { const len = 18 + 2 * o.rocket, y = s * (ry + rh / 2 + 5); inkRR(g, rx + 9, y - 5, len, 10, 4, 'gun', { box: true, lw: 1.8 }); inkCircle(g, rx + 9 + len, y, 3.4, 'orange', { lw: 1.2, double: false }); rivets(g, [[rx + 13, y - 2.5], [rx + 13, y + 2.5]]); }
  if (o.lv >= 12) { inkRR(g, A.tail - 9, -A.half - 8, 7, 2 * A.half + 16, 2, 'red', { box: true, lw: 2 }); for (const s of [-1, 1]) inkLine(g, [[A.tail - 3, s * (A.half - 2)], [A.tail + 5, s * (A.half - 6)]], 2.2); }   // the big wing
  if (o.lv >= 8) for (const s of [-1, 1]) inkRR(g, A.tail - 5, s * 6 - 2.5, 10, 5, 2, 'chrome', { lw: 1.4, double: false });   // extra pipes
  A.draw(g, o);
  if (o.lv >= 2) for (const s of [-1, 1]) { const x0 = A.tail + L * 0.18, w = L * 0.46; inkRR(g, x0, s * (A.half + 1.5) - 2.5, w, 5, 1.2, 'steel', { box: true, lw: 1.6 }); rivets(g, [[x0 + 4, s * (A.half + 1.5)], [x0 + w / 2, s * (A.half + 1.5)], [x0 + w - 4, s * (A.half + 1.5)]], 1.1); }   // bolted armour
  if (o.lv >= 6) { const [c0, c1, ch] = A.cab; inkLine(g, [[c0, -ch], [c1, ch]], 1.8); inkLine(g, [[c0, ch], [c1, -ch]], 1.8); }   // roof cage
  if (o.caltrops) { inkRR(g, A.tail - 3, -7, 9, 14, 2, 'gun', { box: true, lw: 1.6 }); inkPoly(g, [[A.tail + 1.5, -4], [A.tail + 3, 0], [A.tail + 5, 0], [A.tail + 3, 1.4], [A.tail + 1.5, 4], [A.tail, 1.4], [A.tail - 2, 0], [A.tail, 0]], 'chrome', { lw: 0.8, double: false }); }
  if (o.ram) {   // the ram: a steel bar with spikes that get longer as it levels
    const n = 3 + Math.min(2, Math.floor(o.ram / 2)), reach = 9 + o.ram * 2.6, hw = Math.max(A.half - 2, 12);
    inkRR(g, A.nose, -hw - 2, 7, 2 * hw + 4, 2, 'steel', { box: true, lw: 2 });
    for (let i = 0; i < n; i++) { const y = -hw + 2 * hw * i / (n - 1); inkPoly(g, [[A.nose + 7, y - 4], [A.nose + 7 + reach, y], [A.nose + 7, y + 4]], 'chrome', { lw: 1.4, double: false }); }
  } else if (o.plough) {   // the plough: a steel wedge on the nose
    const hw = A.half + 3, reach = 10 + o.plough * 3;
    inkPoly(g, [[A.nose - 2, -hw], [A.nose + reach * 0.55, -hw], [A.nose + reach, 0], [A.nose + reach * 0.55, hw], [A.nose - 2, hw]], 'steel', { box: [A.nose - 2, -hw, reach + 2, 2 * hw], lw: 2.2 });
    inkLine(g, [[A.nose + reach * 0.3, -hw * 0.6], [A.nose + reach * 0.75, 0], [A.nose + reach * 0.3, hw * 0.6]], 1.4);
  } else if (o.lv >= 4) inkRR(g, A.nose, -A.half + 2, 5, 2 * A.half - 4, 2, 'chrome', { box: true, lw: 1.8 });   // push bar
  if (o.flame) for (const s of [-1, 1]) inkRR(g, A.nose - 8, s * (A.half - 3) - 3, 13, 6, 2.5, 'gun', { lw: 1.6, double: false });   // flamer nozzles
  if (o.lance) for (const s of [-1, 1]) for (const dy of [0, 3.5]) { const y = s * (A.half + 4 + dy); inkLine(g, [[A.tail + 12, y], [A.tail + 12 + (A.nose - A.tail) * 0.5, y]], 2, PAL.steel); inkPoly(g, [[A.tail + 12 + (A.nose - A.tail) * 0.5, y - 2.4], [A.tail + 18 + (A.nose - A.tail) * 0.5, y], [A.tail + 12 + (A.nose - A.tail) * 0.5, y + 2.4]], 'orange', { lw: 0.9, double: false }); }   // thunder-stick racks
  if (o.oil) { inkCircle(g, A.tail + 9, -A.half + 7, 5.5, '#2a2433', { lw: 1.4, double: false }); g.strokeStyle = '#c77dff'; g.lineWidth = 1; g.beginPath(); g.arc(A.tail + 9, -A.half + 7, 3, 0, TAU); g.stroke(); }   // oil barrel
  if (o.mortar) { inkCircle(g, A.tail + 10, A.half - 7, 6, 'gun', { lw: 1.6, double: false }); inkCircle(g, A.tail + 10, A.half - 7, 3, INK, { line: false }); }   // mortar tube
  if (o.emp) { const [c0, c1] = A.cab, cx = (c0 + c1) / 2; inkCircle(g, cx, 0, 6.5, 'gun', { lw: 1.6, double: false }); g.strokeStyle = '#b87333'; g.lineWidth = 1.6; for (const r of [3, 4.8]) { g.beginPath(); g.arc(cx, 0, r, 0, TAU); g.stroke(); } inkCircle(g, cx, 0, 1.8, '#7fe7ff', { line: false }); }   // the coil
}
function carBox(id, o) {
  const A = CAR_ART[id], [, ry, , rh] = rearWheel(id, o.wheels), [, fy, , fh] = frontWheel(id, o.wheels);
  const yb = Math.max(ry + rh / 2 + (o.rocket ? 12 : 6), fy + fh / 2 + 6, A.half + 12, 26);
  return [A.tail - 14 - (o.shield ? 12 : 0), -yb, A.nose + (o.ram ? 14 + o.ram * 2.6 : o.plough ? 14 + o.plough * 3 : 8), yb];
}
function carArtKey(id, o) { return `${id}${o.lv >= 2 ? 1 : 0}${o.lv >= 4 ? 1 : 0}${o.lv >= 6 ? 1 : 0}${o.lv >= 8 ? 1 : 0}${o.lv >= 10 ? 1 : 0}${o.lv >= 12 ? 1 : 0}r${o.ram}k${o.rocket}f${o.flame ? 1 : 0}c${o.caltrops ? 1 : 0}w${o.wheels}${o.lance ? 'L' : ''}${o.oil ? 'O' : ''}${o.mortar ? 'M' : ''}${o.emp ? 'E' : ''}p${o.plough || 0}s${o.shield || 0}h${o.hubs ? 1 : 0}`; }
// The gang wears its job: one colour per role, one outline per car. Rammers are red with chrome on the nose (the buggy a
// spike wedge, the ram truck a plough wider than itself); the harpoon car is teal with a long gun; the bomb thrower is
// purple with bombs bulging off its flanks; the pole-cat is hazard yellow and black under its pole; scrap bikes are dark
// two-wheelers with a white-painted rider. A light rim in the role's tint keeps each one off the ground on any stage.
const ROLE = { ram: '#e0412b', pull: '#1fa3a6', throw: '#8a4fd6', board: '#f2c23a', swarm: '#3b2a20' };
const RIM = { ram: '#ffd9cc', pull: '#cdf7f2', throw: '#eadcff', board: '#fff2b0', swarm: '#f2e4c8' };
function rimmed(draw, box, col, w = 2.4) {   // a sticker edge: the car's silhouette grown by w in a light tint, behind it (drawn once, into the sprite)
  return g => {
    const [x0, y0, x1, y1] = box, W = Math.ceil((x1 - x0) * SPR), H = Math.ceil((y1 - y0) * SPR), c = document.createElement('canvas'), m = document.createElement('canvas');
    c.width = m.width = W; c.height = m.height = H;
    const t = c.getContext('2d'); t.setTransform(SPR, 0, 0, SPR, -x0 * SPR, -y0 * SPR); draw(t);
    const q = m.getContext('2d'); q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.drawImage(m, x0 + Math.cos(a) * w, y0 + Math.sin(a) * w, x1 - x0, y1 - y0); }
    g.drawImage(c, x0, y0, x1 - x0, y1 - y0);
  };
}
function artBuggy(g) {   // a spike buggy (rams): an open red tub on fat tyres, a roll cage, the engine out back, a chrome spike wedge for a nose
  for (const s of [-1, 1]) artTyre(g, -15, s * 16, 20, 12);
  inkCircle(g, -25, 0, 6, 'chrome', { lw: 1.4, double: false }); inkCircle(g, -25, 0, 2.6, 'dark', { line: false });   // the engine
  inkPoly(g, [[-21, -9], [8, -10], [18, -6], [18, 6], [8, 10], [-21, 9]], ROLE.ram, { box: [-21, -10, 39, 20] });   // the tub
  for (const cx of [-14, -5]) inkLine(g, [[cx, -6], [cx + 6, 0], [cx, 6]], 2.6);   // painted chevrons: it comes straight at you
  g.strokeStyle = PAL.chrome; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-11, -11); g.lineTo(-11, 11); g.moveTo(-11, -11); g.lineTo(6, -9); g.moveTo(-11, 11); g.lineTo(6, 9); g.stroke();   // the cage
  g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  inkPoly(g, [[16, -12], [31, 0], [16, 12]], 'chrome', { box: [16, -12, 15, 24], lw: 2.2 }); inkLine(g, [[19, 0], [28, 0]], 1.2);   // the spike wedge
  artHead(g, -1, 0, 4.2, true);
}
function artRam(g) {   // a ram truck (rams): six wheels, a long red box, a dark cab, a spiked plough wider than the truck
  for (const [tx, ty] of [[-26, -21], [-12, -21], [-26, 21], [-12, 21]]) artTyre(g, tx, ty, 16, 10);
  inkRR(g, -38, -17, 62, 34, 4, ROLE.ram, { box: true });
  fillOnly(g, () => { g.beginPath(); g.arc(-22, -8, 4, 0, TAU); g.moveTo(9, 9); g.arc(6, 9, 3, 0, TAU); }, 'rust');
  inkLine(g, [[-20, -17], [-20, 17]], 1.4);
  rivets(g, [[-34, -14], [-34, 14], [-24, -14], [-24, 14], [-8, -14], [-8, 14]]);
  inkRR(g, -4, -14, 20, 28, 3, 'dark', { box: true, lw: 2 });   // cab
  inkRR(g, 10, -11, 5, 22, 1.5, 'glass', { lw: 1.4, double: false });
  artHead(g, 4, -5, 4.2, true);
  inkPoly(g, [[24, -28], [42, -17], [42, 17], [24, 28]], 'chrome', { box: [24, -28, 18, 56], lw: 3 });   // the plough
  g.fillStyle = '#fff'; for (let yy = -20; yy < 20; yy += 5.5) { g.beginPath(); g.moveTo(31, yy); g.lineTo(36, yy + 2.75); g.lineTo(31, yy + 5.5); g.fill(); }   // painted teeth
  for (let yy = -21; yy <= 21; yy += 10.5) inkPoly(g, [[42, yy - 3.5], [52, yy], [42, yy + 3.5]], 'chrome', { lw: 1.3, double: false });
  for (const s of [-1, 1]) { inkCircle(g, -34, s * 12, 4.5, 'dark', { lw: 1.4, double: false }); inkCircle(g, -34, s * 12, 2, INK, { line: false }); }   // smokestacks
}
function artHarpoon(g) {   // a harpoon car (pulls): long, low and teal; a cable drum feeds the swivel gun up front (drawn live), spare harpoons on the back
  for (const s of [-1, 1]) artTyre(g, -19, s * 16, 18, 10);
  inkRR(g, -34, -12, 60, 24, 6, ROLE.pull, { box: true });
  g.strokeStyle = PAL.bone; g.lineWidth = 2; g.beginPath(); for (let x = -28; x <= 22; x += 6) g.lineTo(x, (x / 6) % 2 ? -8 : -4); g.stroke();   // zigzag
  rivets(g, [[-30, -9], [-30, 9], [-16, -9], [-16, 9], [18, -9], [18, 9]]);
  for (const yy of [-6, 6]) { inkLine(g, [[-37, yy], [-17, yy]], 2.4, PAL.steel); inkPoly(g, [[-17, yy - 2.8], [-11, yy], [-17, yy + 2.8]], 'chrome', { lw: 1, double: false }); }   // spare harpoons
  inkCircle(g, -3, 0, 8, 'dark', { lw: 1.8 }); g.strokeStyle = PAL.chrome; g.lineWidth = 1.2; for (const r of [3, 5.5]) { g.beginPath(); g.arc(-3, 0, r, 0, TAU); g.stroke(); }   // the cable drum
  inkRR(g, 7, -11, 12, 10, 3, 'dark', { lw: 1.6 }); inkRR(g, 14, -9, 4, 7, 1.2, 'glass', { lw: 1.1, double: false });
  artHead(g, 11, -6, 3.8, true);
}
function artBomber(g) {   // a bomb thrower (throws): a round purple tub, a mortar out back, fused bombs bulging off both flanks
  for (const s of [-1, 1]) artTyre(g, -17, s * 15, 16, 9);
  inkRR(g, -30, -13, 54, 26, 13, ROLE.throw, { box: true });
  ink(g, () => { g.beginPath(); g.moveTo(24, -8); g.quadraticCurveTo(14, -6, 9, -2.5); g.quadraticCurveTo(14, 0, 9, 2.5); g.quadraticCurveTo(14, 6, 24, 8); g.closePath(); }, 'orange', { lw: 1.2, double: false });   // hood flames
  for (const s of [-1, 1]) for (const bx of [-12, -1, 10]) { inkCircle(g, bx, s * 16, 5.2, INK, { line: false }); g.fillStyle = PAL.bone; g.beginPath(); g.arc(bx - 1.6, s * 16 - 1.6, 1.5, 0, TAU); g.fill(); inkLine(g, [[bx + 2, s * 19.5], [bx + 4, s * 23]], 1.4, PAL.bone); }   // the bombs on the flanks
  inkCircle(g, -21, 0, 8, 'gun', { box: true, lw: 2 }); inkCircle(g, -21, 0, 4.4, INK, { line: false });   // the mortar, pointing up
  inkRR(g, 2, -8, 13, 16, 3, 'dark', { lw: 1.6 }); inkRR(g, 10, -6, 4, 12, 1.2, 'glass', { lw: 1.1, double: false });
  artHead(g, 6, 0, 3.8, true);
}
function artPolecat(g) {   // a pole-cat (boards): a light car in hazard yellow and black, the pole's mast in the middle (the pole and its rider are live)
  for (const s of [-1, 1]) artTyre(g, -16, s * 16, 18, 11);
  inkRR(g, -26, -10, 48, 20, 6, ROLE.board, { box: true });
  g.fillStyle = INK; for (const cx of [-21, -12, 6, 14]) { g.beginPath(); g.moveTo(cx, -10); g.lineTo(cx + 4, -10); g.lineTo(cx + 8, 10); g.lineTo(cx + 4, 10); g.fill(); }   // hazard bands
  inkCircle(g, -6, 0, 6.5, 'gun', { lw: 1.8 }); inkCircle(g, -6, 0, 3, ROLE.board, { lw: 1.2, double: false });   // the mast socket
  inkRR(g, 6, -6, 9, 12, 3, 'dark', { lw: 1.4, double: false }); inkRR(g, 11, -5, 3, 10, 1, 'glass', { lw: 1, double: false });
  artHead(g, 8, 0, 3.8, true);
  for (const yy of [-5, 5]) inkPoly(g, [[22, yy - 3], [30, yy], [22, yy + 3]], 'chrome', { lw: 1.1, double: false });
}
function artScrap(g) {   // a scrap bike (swarms): two wheels in a line, a bare dark frame, a white-painted war boy hunched over the bars
  artTyre(g, -17, 0, 18, 9);
  inkRR(g, -26, -6, 10, 3.4, 1.5, 'chrome', { lw: 1.2, double: false });   // the pipe
  inkPoly(g, [[-16, -4], [14, -3], [14, 3], [-16, 4]], ROLE.swarm, { lw: 2 });   // the frame
  inkEllipse(g, 4, 0, 7, 5.5, 0, 'rust', { box: true, lw: 1.8 });   // the tank
  inkLine(g, [[13, -11], [11, 0], [13, 11]], 3.2, INK); inkLine(g, [[13, -11], [11, 0], [13, 11]], 1.6, PAL.chrome);   // the bars
  for (const s of [-1, 1]) inkLine(g, [[-6, s * 6], [12, s * 10]], 2.2, PAL.skin);   // arms
  inkEllipse(g, -6, 0, 5.5, 8.5, 0, 'skin', { box: true, lw: 1.6, hatch: false, double: false });   // shoulders
  artHead(g, -4, 0, 4.6, false);
}
const GANG_ART = {   // sprite, role, box, front wheels (live), the scale that keeps each car its size against its hit circle, crew seats, flag, tail and nose lights
  buggy:   { draw: artBuggy,   role: 'ram',   box: [-36, -27, 40, 27], front: [[14, 15, 13, 8]], k: 0.8, crew: [[-16, 0]], flag: [-22, 8], flagCol: 'red', skull: false, rear: [-22, 7], nose: [18, 7] },
  ram:     { draw: artRam,     role: 'ram',   box: [-44, -32, 56, 32], front: [[20, 20, 16, 10]], k: 0.62, crew: [[-28, -9], [-28, 9]], flag: [-36, 10], flagCol: 'dark', skull: true, rear: [-36, 13], nose: [24, 13] },
  harpoon: { draw: artHarpoon, role: 'pull',  box: [-42, -26, 34, 26], front: [[17, 16, 16, 9]], k: 0.75, crew: [[-22, 4]], flag: [-30, 10], flagCol: 'dark', skull: true, rear: [-32, 8], nose: [24, 8] },
  polecat: { draw: artPolecat, role: 'board', box: [-32, -25, 36, 25], front: [[16, 14, 13, 8]], k: 0.8, crew: [], flag: [-22, 8], flagCol: 'orange', skull: true, rear: [-24, 8], nose: [22, 8], pole: true },
  bomber:  { draw: artBomber,  role: 'throw', box: [-36, -28, 32, 28], front: [[17, 15, 15, 8]], k: 0.75, crew: [[-4, 7]], flag: [-30, 10], flagCol: 'dark', skull: true, rear: [-28, 9], nose: [22, 8], fuses: true },
  scrap:   { draw: artScrap,   role: 'swarm', box: [-30, -17, 26, 17], front: [[18, 0, 16, 7]], k: 1.08, crew: [], flag: [-20, 3], flagCol: 'dark', skull: false, rear: [-26, 0], nose: [22, 0] },   // the prototype's light fodder, a pack at a time
};
for (const A of Object.values(GANG_ART)) A.draw = rimmed(A.draw, A.box, RIM[A.role]);
GANG_ART.rig = GANG_ART.ram; GANG_ART.bombard = GANG_ART.bomber; GANG_ART.tanker = GANG_ART.ram;   // the guardians: the same machines, built twice the size

// The Bull: a horned monster truck. Plates come off as it crashes; it burns brighter when it rages.
function artBull(g, o) {
  for (const s of [-1, 1]) artTyre(g, -24, s * 27, 30, 16);
  for (const s of [-1, 1]) inkRR(g, -54, s * 17 - 3.5, 16, 7, 3, 'chrome', { lw: 1.6, double: false });   // exhaust stacks out the back
  inkRR(g, -48, -22, 88, 44, 9, o.rage ? '#c8261a' : 'blood', { box: true, lw: 3.4 });
  fillOnly(g, () => { g.beginPath(); g.ellipse(-36, 12, 7, 4, 0.3, 0, TAU); g.moveTo(25, -12); g.ellipse(18, -12, 6, 3.5, -0.2, 0, TAU); }, 'rust2', 0.8);
  inkLine(g, [[-6, -22], [-6, 22]], 1.6); inkLine(g, [[-32, -22], [-32, 22]], 1.4);
  const rv = []; for (let i = -42; i < 38; i += 9) rv.push([i, -19.5], [i, 19.5]); rivets(g, rv, 1);
  const PL = [[-44, -30], [-2, -30], [-44, 22], [-2, 22]];   // armour plates
  for (let i = 0; i < o.plates; i++) { const [x, y] = PL[i]; inkRR(g, x, y, 36, 8, 2, 'steel', { box: true, lw: 2 }); rivets(g, [[x + 4, y + 4], [x + 18, y + 4], [x + 32, y + 4]], 1.3); }
  inkRR(g, -30, -15, 24, 30, 4, 'dark', { lw: 2 });   // cab
  inkRR(g, -12, -12, 5, 24, 2, 'glass', { lw: 1.2, double: false });
  // a painted skull on the cab roof, nose forward: cranium, slanted sockets, a toothy jaw
  inkEllipse(g, -21, 0, 7, 8, 0, 'bone', { lw: 1.3, double: false }); inkRR(g, -15.5, -4.5, 4.5, 9, 1, 'bone', { lw: 1.2, double: false });
  g.fillStyle = INK; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-23, s * 1.2); g.lineTo(-18, s * 1.6); g.lineTo(-19.5, s * 5.2); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(-16, 0); g.lineTo(-14.6, -1); g.lineTo(-14.6, 1); g.closePath(); g.fill(); g.lineWidth = 0.8; g.strokeStyle = INK; g.beginPath(); for (const yy of [-2.5, 0, 2.5]) { g.moveTo(-15.5, yy); g.lineTo(-11, yy); } g.stroke();
  inkRR(g, 4, -12, 26, 24, 4, 'chrome', { box: true, lw: 2.2 });   // blower
  for (const yy of [-6, 0, 6]) inkLine(g, [[7, yy], [27, yy]], 1.2);
  inkPoly(g, [[22, -9], [33, -6], [33, 6], [22, 9]], 'dark', { lw: 1.8, double: false }); for (const yy of [-4, 0, 4]) inkLine(g, [[24, yy], [32, yy * 0.8]], 1, PAL.steel);   // air scoop
  inkRR(g, 38, -24, 8, 48, 3, 'chrome', { box: true, lw: 2.4 });   // bull bar
  g.fillStyle = '#fff'; for (let yy = -20; yy < 20; yy += 5) { g.beginPath(); g.moveTo(40, yy); g.lineTo(44, yy + 2.5); g.lineTo(40, yy + 5); g.fill(); }
  for (const s of [-1, 1]) ink(g, () => { g.beginPath(); g.moveTo(44, s * 12); g.quadraticCurveTo(68, s * 20, 72, s * 46); g.quadraticCurveTo(61, s * 28, 44, s * 21); g.closePath(); }, 'bone', { box: [44, s > 0 ? 12 : -46, 28, 34], lw: 2.6 });   // horns
}
const BULL_BOX = [-62, -50, 78, 50];

// ============ drawing vehicles in the world ============
function liveTyre(x, y, w, h, ang, spikes) { artTyre(ctx, x, y, w, h, ang, spikes); }

// ============ the ground: painted once per chunk ============
// Decoration comes from a global grid of seeded cells, so a dune or a track that crosses a chunk border is painted by both
// chunks identically: no seams. The road is a pure function of world position for the same reason.
function cells(x0, y0, x1, y1, size, salt, fn) {
  for (let cy = Math.floor(y0 / size); cy <= Math.floor(y1 / size); cy++)
    for (let cx = Math.floor(x0 / size); cx <= Math.floor(x1 / size); cx++) fn(seeded(hash2(cx * 7 + salt, cy * 13 - salt * 3)), cx * size, cy * size);
}
function paintGround(g, ch, R) {
  const X = ch.x, Y = ch.y, X1 = X + CH, Y1 = Y + CH;
  g.fillStyle = PAL.sand; g.fillRect(X, Y, CH, CH);
  for (const D of allDepots()) {   // the Bull's turf darkens toward the depot in a smooth ring
    if (!D.boss) continue; const tg = g.createRadialGradient(D.x, D.y, turfR() - 300, D.x, D.y, turfR() + 700); tg.addColorStop(0, REG().turf); tg.addColorStop(1, REG().turf + '00'); g.fillStyle = tg; g.fillRect(X, Y, CH, CH);
  }
  cells(X - 300, Y - 300, X1 + 300, Y1 + 300, 420, 1, (C, cx, cy) => {   // dunes: flat darker sand under a halftone
    if (C() > 0.85) return; const x = cx + C() * 420, y = cy + C() * 420, rx = 120 + C() * 150, ry = 40 + C() * 55, a = C() * 0.6 - 0.3;
    g.save(); g.translate(x, y); g.rotate(a); pEllipse(g, 0, 0, rx, ry); g.globalAlpha = 0.42; g.fillStyle = PAL.sand2; g.fill(); g.globalAlpha = 1; g.fillStyle = DOTS.sand; g.fill(); g.restore();
  });
  const cyn = demo && demo.layout && demo.layout.canyon;   // Red Canyon: no cracked mud (it read as a dry riverbed); scree under the walls instead
  if (!cyn) cells(X - 160, Y - 160, X1 + 160, Y1 + 160, 800, 2, (C, cx, cy) => {   // a dried mud flat, cracked
    if (C() > 0.18) return; const x = cx + 150 + C() * 500, y = cy + 150 + C() * 500, rx = 70 + C() * 50, ry = 40 + C() * 30, a = C() * 3;
    g.save(); g.translate(x, y); g.rotate(a); pEllipse(g, 0, 0, rx, ry); g.globalAlpha = 0.5; g.fillStyle = PAL.sand2; g.fill(); g.clip();
    g.globalAlpha = 0.45; g.strokeStyle = INK; g.lineWidth = 1.4; for (let i = 0; i < 9; i++) { let px = (C() - 0.5) * rx * 1.6, py = (C() - 0.5) * ry * 1.6; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (C() - 0.5) * 34; py += (C() - 0.5) * 26; g.lineTo(px, py); } g.stroke(); }
    g.restore();
  });
  g.strokeStyle = INK; g.lineCap = 'round';
  cells(X - 70, Y - 70, X1 + 70, Y1 + 70, 160, 3, (C, cx, cy) => {   // wind ripples
    for (let i = 0; i < 2; i++) { if (C() > 0.7) continue; const x = cx + C() * 160, y = cy + C() * 160, w = 18 + C() * 34; g.globalAlpha = 0.32; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke(); }
  });
  g.globalAlpha = 1;
  cells(X - 700, Y - 700, X1 + 700, Y1 + 700, 900, 4, (C, cx, cy) => {   // old tyre tracks wandering across the sand
    if (C() > 0.22) return; const x = cx + C() * 900, y = cy + C() * 900, a = C() * TAU, bend = (C() - 0.5) * 0.004, len = 500 + C() * 400;
    for (const o of [-11, 11]) { g.beginPath(); for (let d = 0; d <= len; d += 25) { const aa = a + bend * d; g.lineTo(x + Math.cos(aa) * d - Math.sin(aa) * o, y + Math.sin(aa) * d + Math.cos(aa) * o); } g.strokeStyle = 'rgba(110,60,30,.2)'; g.lineWidth = 7; g.setLineDash([6, 4]); g.stroke(); g.setLineDash([]); }
  });
  if (REG().id === 'yards') cells(X - 80, Y - 80, X1 + 80, Y1 + 80, 300, 9, (C, cx, cy) => {   // the Rust Yards: oil stains, bolts and scrap underfoot
    if (C() < 0.6) { g.fillStyle = 'rgba(30,20,20,.22)'; pEllipse(g, cx + C() * 300, cy + C() * 300, 18 + C() * 34, 10 + C() * 16, C() * 3); g.fill(); }
    g.fillStyle = 'rgba(90,60,50,.55)'; for (let i = 0; i < 4; i++) { const x = cx + C() * 300, y = cy + C() * 300; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y + 2); g.lineTo(x + 3, y + 7); g.closePath(); g.fill(); }
  });
  if (REG().id === 'salt') cells(X - 120, Y - 120, X1 + 120, Y1 + 120, 240, 10, (C, cx, cy) => {   // the Salt Wastes: a crust of pale plates with inked cracks
    const x = cx + 40 + C() * 160, y = cy + 40 + C() * 160, n = 5 + Math.floor(C() * 3), r = 40 + C() * 50, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + C() * 0.5, k = r * (0.7 + C() * 0.4); pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k]); }
    pPoly(g, pts); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill(); g.strokeStyle = 'rgba(36,22,15,.3)'; g.lineWidth = 1.3; g.lineJoin = 'round'; g.stroke();
  });
  paintRoad(g, ch);
  if (cyn) cells(X - 20, Y - 20, X1 + 20, Y1 + 20, 120, 11, (C, cx, cy) => {   // scree: chips of rock fallen at the walls' feet, flat on the floor
    for (let i = 0; i < 3; i++) {
      const x = cx + C() * 120, y = cy + C() * 120, r = 2.5 + C() * 4, a = C() * TAU, d = canyonRock(demo.layout, x, y); if (d < r + 10 || d > 26 + C() * 90) continue;
      const pts = []; for (let k = 0; k < 5; k++) { const b = a + k / 5 * TAU, q = r * (0.7 + ((k * 7 + i) % 3) * 0.2); pts.push([x + Math.cos(b) * q, y + Math.sin(b) * q]); }
      g.fillStyle = SHADOW; g.save(); g.translate(r * 0.5, r * 0.7); pPoly(g, pts); g.fill(); g.restore(); inkPoly(g, pts, 'rock', { lw: 1, double: false });
    }
  });
  cells(X - 20, Y - 20, X1 + 20, Y1 + 20, 210, 5, (C, cx, cy) => {   // pebbles
    if (C() > 0.55) return; const x = cx + C() * 210, y = cy + C() * 210, r = 2.5 + C() * 4.5;
    g.fillStyle = SHADOW; g.beginPath(); g.arc(x + r * 0.5, y + r * 0.7, r, 0, TAU); g.fill();
    inkCircle(g, x, y, r, 'rock', { lw: 1.2, double: false });
  });
  if (ch.scrap) {   // the Bull's yard: oil stains, bolts and rust flakes
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,25,20,.16)'; pEllipse(g, X + 60 + R() * (CH - 120), Y + 60 + R() * (CH - 120), 20 + R() * 40, 12 + R() * 20, R() * 3); g.fill(); }
    g.fillStyle = 'rgba(122,58,34,.55)'; for (let i = 0; i < 18; i++) { const x = X + 10 + R() * (CH - 20), y = Y + 10 + R() * (CH - 20); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 2); g.lineTo(x + 2, y + 6); g.closePath(); g.fill(); }   // rust flakes
  }
  cells(X - 140, Y - 140, X1 + 140, Y1 + 140, 460, 6, (C, cx, cy) => {   // set dressing, flat on the ground: bones, a toppled pylon, a sunk wreck, a skull on a stake
    if (C() > 0.2) return; const x = cx + 80 + C() * 300, y = cy + 80 + C() * 300, k = C(), a = C() * TAU;
    if (blockedNear(ch, x, y, 120)) return;
    if (k < 0.3) paintSkull(g, x, y, a); else if (k < 0.5) paintPylon(g, x, y, a, 170 + C() * 90); else if (k < 0.72) paintHulk(g, x, y, a); else if (k < 0.86) paintTotem(g, x, y); else paintTyres(g, x, y);
  });
}
function blockedNear(ch, x, y, m) { return ch.walls.some(W => x > W.x - m && x < W.x + W.w + m && y > W.y - m && y < W.y + W.h + m) || ch.rocks.some(P => Math.hypot(P.x - x, P.y - y) < P.r + m) || ch.sands.some(S => Math.hypot(S.x - x, S.y - y) < S.r + m) || ch.oils.some(O => Math.hypot(O.x - x, O.y - y) < O.r + m); }
// the old highway: cracked asphalt, faded centre dashes, sand drifted over it, broken edges
const ROAD_W = 80;
function paintRoad(g, ch) {
  const y0 = ch.y - 60, y1 = ch.y + CH + 60, pts = [];
  for (let y = Math.floor(y0 / 40) * 40; y <= y1; y += 40) { const x = roadX(y); if (x === null) { if (pts.length) break; continue; } pts.push([x, y]); }
  if (pts.length < 2 || pts.every(([x]) => x + ROAD_W * 1.4 < ch.x || x - ROAD_W * 1.4 > ch.x + CH)) return;
  const half = y => ROAD_W * (1 + 0.14 * Math.sin(y * 0.031) + 0.1 * Math.sin(y * 0.077 + 1));   // ragged edges
  if (demo && demo.layout && demo.layout.canyon) { paintTrail(g, pts, half); return; }   // Red Canyon: a dirt trail, not a highway
  const band = () => { g.beginPath(); pts.forEach(([x, y], i) => { const w = half(y); i ? g.lineTo(x - w, y) : g.moveTo(x - w, y); }); for (let i = pts.length - 1; i >= 0; i--) { const [x, y] = pts[i]; g.lineTo(x + half(y + 17), y); } g.closePath(); };
  g.save(); band(); g.fillStyle = PAL.asphalt; g.fill(); g.clip();
  g.fillStyle = DOTS.fine; g.globalAlpha = 0.5; g.fillRect(ch.x - 100, y0, CH + 200, y1 - y0); g.globalAlpha = 1;
  for (const [x, y] of pts) {   // faded centre dashes, on a global rhythm so neighbours agree
    if (((y % 160) + 160) % 160 !== 0) continue; const x2 = roadX(y + 60) ?? x;
    g.save(); g.translate(x, y); g.rotate(Math.atan2(60, x2 - x)); g.globalAlpha = 0.6; g.fillStyle = PAL.paint; g.fillRect(-2.5, 0, 5, 56); g.restore();
  }
  cells(ch.x - 100, y0, ch.x + CH + 100, y1, 120, 7, (C, cx, cy) => {   // cracks and potholes
    const y = cy + C() * 120, rx = roadX(y); if (rx === null) return; const x = rx + (C() - 0.5) * ROAD_W * 1.6;
    if (C() < 0.25) { g.fillStyle = 'rgba(36,22,15,.35)'; pEllipse(g, x, y, 8 + C() * 10, 5 + C() * 6, C() * 3); g.fill(); return; }
    g.strokeStyle = INK; g.globalAlpha = 0.55; g.lineWidth = 1.3; let px = x, py = y; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (C() - 0.5) * 30; py += (C() - 0.5) * 24; g.lineTo(px, py); } g.stroke(); g.globalAlpha = 1;
  });
  cells(ch.x - 100, y0, ch.x + CH + 100, y1, 260, 8, (C, cx, cy) => {   // wind-blown sand streaking across it
    if (C() > 0.6) return; const y = cy + C() * 260, rx = roadX(y); if (rx === null) return; const x = rx + (C() - 0.5) * ROAD_W, l = 50 + C() * 80;
    g.fillStyle = PAL.sand; g.beginPath(); g.moveTo(x - l / 2, y + 5); g.quadraticCurveTo(x, y - 16, x + l / 2, y - 2); g.quadraticCurveTo(x + l * 0.1, y + 3, x - l / 2, y + 5); g.fill();
  });
  g.restore();
  band(); g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
}
// Red Canyon's trail: packed dirt and two wheel ruts, lighter than any rock and with no ink edge, so it guides without
// reading as a wall or a ramp; it fades out before the rock island, so it never points you into the rock.
function paintTrail(g, pts, half) {
  const F = demo.layout.fork, fade = y => F ? clamp((Math.abs(y - F.y) - F.ay - 60) / 260, 0, 1) : 1;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], k = Math.min(fade(y0), fade(y1)); if (k <= 0) continue;
    g.globalAlpha = 0.4 * k; g.strokeStyle = '#b88c6a'; g.lineWidth = half(y0) * 1.7; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();   // packed dust, paler than the floor
    g.globalAlpha = 0.3 * k; g.strokeStyle = '#5a3424'; g.lineWidth = 6;
    for (const o of [-24, 24]) { g.beginPath(); g.moveTo(x0 + o, y0); g.lineTo(x1 + o, y1); g.stroke(); }   // wheel ruts
  }
  g.restore();
}
// ---- set dressing (flat, no ink-heavy outlines, so it reads as ground and not as something to dodge)
function paintSkull(g, x, y, a) {   // a cow skull half sunk in the sand
  g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 0.92;
  inkEllipse(g, 0, 0, 9, 11, 0, 'bone', { lw: 1.6, double: false });
  for (const s of [-1, 1]) ink(g, () => { g.beginPath(); g.moveTo(s * 7, -7); g.quadraticCurveTo(s * 24, -14, s * 22, -28); g.quadraticCurveTo(s * 15, -16, s * 4, -11); g.closePath(); }, 'bone', { lw: 1.4, double: false });
  g.fillStyle = INK; g.beginPath(); g.arc(-3.6, -2, 2.4, 0, TAU); g.arc(3.6, -2, 2.4, 0, TAU); g.fill();
  g.restore();
}
function paintTotem(g, x, y) {   // a skull on a stake: its long shadow says it's tall
  g.strokeStyle = SHADOW; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 34, y + 52); g.stroke();
  inkCircle(g, x, y, 5, 'dark', { lw: 1.4, double: false });
  inkEllipse(g, x, y - 4, 9, 11, 0, 'bone', { box: true, lw: 1.8, hatch: false });
  for (const s of [-1, 1]) ink(g, () => { g.beginPath(); g.moveTo(x + s * 7, y - 8); g.quadraticCurveTo(x + s * 22, y - 14, x + s * 20, y - 26); g.quadraticCurveTo(x + s * 14, y - 15, x + s * 4, y - 11); g.closePath(); }, 'bone', { lw: 1.4, double: false });
  g.fillStyle = INK; g.beginPath(); g.arc(x - 3.5, y - 5, 2.4, 0, TAU); g.arc(x + 3.5, y - 5, 2.4, 0, TAU); g.fill();
}
function paintPylon(g, x, y, a, L) {   // a toppled transmission tower, half buried, its lattice flat in the sand
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(80,30,40,.16)'; g.fillRect(6, -6, L, 24);
  g.globalAlpha = 0.75;
  inkLine(g, [[0, -12], [L, -5]], 2.4); inkLine(g, [[0, 12], [L, 5]], 2.4);
  for (let i = 0; i < L; i += 22) { const w1 = 12 - i / L * 7, w2 = 12 - (i + 22) / L * 7; inkLine(g, [[i, -w1], [i + 22, w2]], 1.2); inkLine(g, [[i, w1], [i + 22, -w2]], 1.2); }
  inkLine(g, [[L * 0.7, -20], [L * 0.7, 20]], 2); inkLine(g, [[L * 0.45, -24], [L * 0.45, 24]], 2);
  g.globalAlpha = 1;
  inkEllipse(g, L * 0.96, 0, 26, 14, 0, 'sand', { line: false, shade: false });   // buried end
  g.restore();
}
function paintHulk(g, x, y, a) {   // a wreck sunk to its windows, sand drifted over it
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(80,30,40,.2)'; rr(g, -18, -6, 50, 24, 8); g.fill();
  inkRR(g, -28, -14, 54, 28, 8, 'rust2', { box: true, lw: 2 });
  fillOnly(g, () => rr(g, -28, -14, 54, 9, 6), 'rust', 0.9);
  inkRR(g, -9, -10, 18, 20, 4, 'dark', { lw: 1.4, double: false });
  inkRR(g, 12, 9, 13, 7, 3, 'tyre', { lw: 1.2, double: false });
  inkEllipse(g, 20, 4, 26, 14, 0.4, 'sand', { line: false, shade: false });
  g.restore();
}
function paintTyres(g, x, y) {
  for (const [dx, dy, r] of [[0, 0, 14], [19, 6, 12], [8, 17, 11]]) { g.fillStyle = 'rgba(80,30,40,.2)'; g.beginPath(); g.arc(x + dx + 6, y + dy + 8, r, 0, TAU); g.fill(); inkCircle(g, x + dx, y + dy, r, 'tyre', { lw: 1.8, double: false }); inkCircle(g, x + dx, y + dy, r * 0.42, 'sand2', { lw: 1.2, double: false }); }
  inkEllipse(g, x + 4, y + 26, 28, 12, 0.2, 'sand', { line: false, shade: false });
}
// ---- the things you can hit, painted into the chunk (they never move)
function paintMesa(g, P) {   // a rock pillar: lit top, hatched flank, a long shadow. Solid: weave past it and the chasers behind you hit it
  const R2 = seeded(Math.round(P.x * 13 + P.y * 7)), pts = [], top = [];
  for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, k = P.r * (0.86 + R2() * 0.2); pts.push([P.x + Math.cos(a) * k, P.y + Math.sin(a) * k]); }
  g.save(); g.translate(SUN_X * 2.2, SUN_Y * 2.2); pPoly(g, pts); g.fillStyle = SHADOW; g.fill(); g.restore();
  inkPoly(g, pts, 'rock', { box: [P.x - P.r, P.y - P.r, 2 * P.r, 2 * P.r], lw: 3.4 });
  for (const [px, py] of pts) top.push([P.x + (px - P.x) * 0.62 - P.r * 0.14, P.y + (py - P.y) * 0.62 - P.r * 0.16]);
  inkPoly(g, top, 'rockTop', { lw: 1.6, double: false });
  inkLine(g, [[P.x - P.r * 0.45, P.y - P.r * 0.05], [P.x - P.r * 0.1, P.y + P.r * 0.22], [P.x + P.r * 0.3, P.y + P.r * 0.08]], 1.4);
}
function roughRect(x, y, w, h, r, R2, jit) {   // a rounded rectangle's outline with a hand-cut wobble
  const pts = [], per = [];
  const corner = (cx, cy, a0) => { for (let i = 0; i <= 3; i++) { const a = a0 + i / 3 * Math.PI / 2; per.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  for (let i = 0; i < per.length; i++) {
    const [ax, ay] = per[i], [bx, by] = per[(i + 1) % per.length], n = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / 34));
    for (let k = 0; k < n; k++) { const t = k / n, px = ax + (bx - ax) * t, py = ay + (by - ay) * t, mx = px - (x + w / 2), my = py - (y + h / 2), l = Math.hypot(mx, my) || 1, j = (R2() - 0.5) * 2 * jit; pts.push([px + mx / l * j, py + my / l * j]); }
  }
  return pts;
}
function paintCliff(g, W, ch) {   // a canyon wall: a rough rock mass, strata, a lit rim along the gap, its shadow thrown into the gap
  const R2 = seeded(ch.cx * 31 + ch.cy * 17 + (W.side === 'L' ? 1 : 2)), pts = roughRect(W.x - 10, W.y - 10, W.w + 20, W.h + 20, 46, R2, 9);
  g.save(); g.translate(SUN_X * 2.6, SUN_Y * 2.6); pPoly(g, pts); g.fillStyle = SHADOW; g.fill(); g.restore();
  inkPoly(g, pts, 'rock', { line: false });
  g.save(); pPoly(g, pts); g.clip();
  g.globalAlpha = 0.5; g.fillStyle = DOTS.fine; g.fillRect(W.x - 20, W.y - 20, W.w + 40, W.h + 40); g.globalAlpha = 1;
  g.strokeStyle = INK; g.globalAlpha = 0.4; g.lineWidth = 1.6;
  for (let y = W.y + 20 + R2() * 30; y < W.y + W.h; y += 34 + R2() * 46) { const b = (R2() - 0.5) * 26; g.beginPath(); g.moveTo(W.x - 20, y); g.bezierCurveTo(W.x + W.w * 0.3, y + b, W.x + W.w * 0.6, y - b, W.x + W.w + 20, y + (R2() - 0.5) * 12); g.stroke(); }   // strata, uneven
  g.globalAlpha = 0.55; g.lineWidth = 1.3;
  for (let i = 0; i < 5; i++) { let x = W.x + R2() * W.w, y = W.y + R2() * W.h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R2() - 0.5) * 22; y += 14 + R2() * 16; g.lineTo(x, y); } g.stroke(); }   // cracks
  g.globalAlpha = 1;
  const rimX = W.side === 'L' ? W.x + W.w - 6 : W.x - 10;   // the lit rim where the cliff meets the gap
  g.fillStyle = PAL.rockTop; g.fillRect(rimX, W.y - 20, 16, W.h + 40);
  g.strokeStyle = 'rgba(36,22,15,.5)'; g.lineWidth = 1; g.beginPath(); const hx = W.side === 'L' ? W.x + W.w - 40 : W.x + 14; for (let y = W.y; y < W.y + W.h; y += 5) { g.moveTo(hx, y); g.lineTo(hx + 24, y - 12); } g.stroke();   // hatched flank
  g.restore();
  pPoly(g, pts); g.strokeStyle = INK; g.lineWidth = 3.4; g.lineJoin = 'round'; g.stroke();
  g.save(); g.translate(0.8, 0.6); g.globalAlpha = 0.35; pPoly(g, pts); g.lineWidth = 1; g.stroke(); g.restore();
  for (let i = 0; i < 3; i++) { const by = W.y + 60 + R2() * (W.h - 120), bx = W.side === 'L' ? W.x + W.w + 10 + R2() * 14 : W.x - 10 - R2() * 14; paintBoulder(g, bx, by, 7 + R2() * 6, R2); }   // rocks fallen at its foot
}
function paintBoulder(g, x, y, r, R2) { const pts = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, k = r * (0.8 + R2() * 0.3); pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k]); } g.save(); g.translate(r * 0.5, r * 0.7); pPoly(g, pts); g.fillStyle = SHADOW; g.fill(); g.restore(); inkPoly(g, pts, 'rock', { lw: 1.6, double: false }); }
// ---- contours of a sampled field (marching squares): a rock mass painted from the same shapes the cars collide with ----
// A field is { v, nx, ny, x0, y0, S }: values on a world-aligned grid, S apart. Inside is v < iso. Grids line up across
// chunks, so a shape painted into two chunks meets itself exactly at the join.
function msCellPts(F, i, j, iso, out) {   // the inside part of one cell, as a polygon (corners and edge crossings, in order)
  const { v, nx, x0, y0, S } = F, x = x0 + i * S, y = y0 + j * S;
  const c = [[x, y, v[j * nx + i]], [x + S, y, v[j * nx + i + 1]], [x + S, y + S, v[(j + 1) * nx + i + 1]], [x, y + S, v[(j + 1) * nx + i]]];
  out.length = 0;
  for (let k = 0; k < 4; k++) {
    const a = c[k], b = c[(k + 1) % 4], ia = a[2] < iso, ib = b[2] < iso;
    if (ia) out.push([a[0], a[1]]);
    if (ia !== ib) { const t = (iso - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function msPath(g, F, iso = 0) {   // one path for the whole inside region (a single fill: no hairline seams between cells)
  const { v, nx, ny, x0, y0, S } = F, pts = []; g.beginPath();
  for (let j = 0; j < ny - 1; j++) {
    let run = -1;
    for (let i = 0; i < nx; i++) {
      const full = i < nx - 1 && v[j * nx + i] < iso && v[j * nx + i + 1] < iso && v[(j + 1) * nx + i] < iso && v[(j + 1) * nx + i + 1] < iso;
      if (full) { if (run < 0) run = i; continue; }
      if (run >= 0) { g.rect(x0 + run * S, y0 + j * S, (i - run) * S, S); run = -1; }   // whole cells in a row: one rectangle
      if (i >= nx - 1) continue;
      msCellPts(F, i, j, iso, pts); if (pts.length < 3) continue;
      g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath();
    }
  }
}
function msLines(F, iso = 0, keep) {   // the contour as segments [x1, y1, x2, y2, i, j]; keep(i, j) may drop some (broken strata)
  const { v, nx, ny, x0, y0, S } = F, segs = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const x = x0 + i * S, y = y0 + j * S, c = [[x, y, v[j * nx + i]], [x + S, y, v[j * nx + i + 1]], [x + S, y + S, v[(j + 1) * nx + i + 1]], [x, y + S, v[(j + 1) * nx + i]]], hit = [];
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; if ((a[2] < iso) !== (b[2] < iso)) { const t = (iso - a[2]) / (b[2] - a[2]); hit.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    if (hit.length < 2 || (keep && !keep(i, j))) continue;
    segs.push([hit[0][0], hit[0][1], hit[1][0], hit[1][1], i, j]); if (hit.length === 4) segs.push([hit[2][0], hit[2][1], hit[3][0], hit[3][1], i, j]);
  }
  return segs;
}
function msStroke(g, segs) { g.beginPath(); for (const [a, b, c, d] of segs) { g.moveTo(a, b); g.lineTo(c, d); } g.stroke(); }
const HATCH = (() => { const c = document.createElement('canvas'); c.width = c.height = 10; const h = c.getContext('2d'); h.strokeStyle = 'rgba(36,22,15,.5)'; h.lineWidth = 1.3; h.beginPath(); for (const o of [-10, 0, 10]) { h.moveTo(o, 10); h.lineTo(o + 10, 0); } h.stroke(); return ctx.createPattern(c, 'repeat'); })();   // the comic hatch on rock in shade
// A raised rock mass from its field F (inside = rock, <0; the zero line is exactly where cars collide): a long shadow
// thrown down-right, a dark face that is deepest on the sides facing down-right (the mesa's convention, one sun for
// everything), strata across the face, a lit top with planes and cracks, an inked base and a lit rim.
function paintRockField(g, F, seed) {
  const { v, nx, ny, x0, y0, S } = F, n = nx * ny, T = new Float32Array(n), W = new Float32Array(n), D = new Float32Array(n);
  const vx = SUN_X / Math.hypot(SUN_X, SUN_Y), vy = SUN_Y / Math.hypot(SUN_X, SUN_Y);
  const sm = new Float32Array(n);   // a softened copy: the top edge runs smoother than the boulder-scalloped base
  { const tmp = new Float32Array(n); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let a = 0, k = 0; for (let d = -2; d <= 2; d++) { const ii = i + d; if (ii < 0 || ii >= nx) continue; a += v[j * nx + ii]; k++; } tmp[j * nx + i] = a / k; }   // a 5x5 box blur in two passes
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let a = 0, k = 0; for (let d = -2; d <= 2; d++) { const jj = j + d; if (jj < 0 || jj >= ny) continue; a += tmp[jj * nx + i]; k++; } sm[j * nx + i] = a / k; } }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const at = (ii, jj) => sm[clamp(jj, 0, ny - 1) * nx + clamp(ii, 0, nx - 1)], gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1), gl = Math.hypot(gx, gy) || 1;
    const d = (gx * vx + gy * vy) / gl, w = 24 + 44 * clamp((d + 0.15) / 1.1, 0, 1), k = j * nx + i;   // d: how much this face looks down-right
    W[k] = w; D[k] = d; T[k] = sm[k] + w;
  }
  const field = a => ({ v: a, nx, ny, x0, y0, S });
  const band = (f) => { const a = new Float32Array(n); for (let k = 0; k < n; k++) a[k] = Math.max(v[k], -T[k], f(k)); return field(a); };   // the face, where f(k) < 0
  const R2 = seeded(seed);
  // the floor round it: a soft contact shade, then the long shadow a tall wall throws across the floor
  g.lineJoin = 'round'; g.lineCap = 'round';
  const base = msLines(F, 0);
  g.strokeStyle = 'rgba(40,10,12,.13)'; g.lineWidth = 22; msStroke(g, base); g.lineWidth = 9; g.strokeStyle = 'rgba(40,10,12,.2)'; msStroke(g, base);
  g.save(); g.translate(SUN_X * 5.2, SUN_Y * 5.2); msPath(g, F); g.fillStyle = 'rgba(34,8,14,.24)'; g.fill(); g.restore();   // see-through: the floor in a wall's shadow stays clearly floor
  // the face: three deep reds, all darker than the floor, under a lit top lighter than it, so height and the edge read
  // in grey too: warmest where it turns to the sun, darkest and hatched where it looks away
  msPath(g, F); g.fillStyle = '#6a2416'; g.fill();
  msPath(g, band(k => (D[k] + 0.05) * 80)); g.fillStyle = '#86301f'; g.fill();
  const low = !!save.lowfx;   // reduced effects (the pause menu's EFFECTS: LIGHT): the same shapes and tones, without hatching, strata, planes or grit
  msPath(g, band(k => (0.3 - D[k]) * 80)); g.fillStyle = '#45150e'; g.fill(); if (!low) { g.fillStyle = HATCH; g.fill(); }
  g.strokeStyle = 'rgba(36,22,15,.38)'; g.lineWidth = 1.4;   // strata across the broad faces, broken here and there
  if (!low) for (const f of [0.38, 0.7]) { const a = new Float32Array(n); for (let k = 0; k < n; k++) a[k] = sm[k] + f * W[k]; msStroke(g, msLines(field(a), 0, (i, j) => W[j * nx + i] > 22 && hash2(i + Math.round(x0 / S), j + Math.round(y0 / S) + f * 97) % 5 !== 0)); }
  // the top: lit rock with planes, grit and a few cracks
  const top = field(T);
  g.save(); msPath(g, top); g.fillStyle = PAL.rockTop; g.fill(); g.clip();
  const P = 150, gx0 = Math.floor(x0 / P), gy0 = Math.floor(y0 / P), gx1 = Math.ceil((x0 + nx * S) / P), gy1 = Math.ceil((y0 + ny * S) / P);
  if (!low) for (let cy = gy0; cy <= gy1; cy++) for (let cx = gx0; cx <= gx1; cx++) {   // planes: tied to world cells, so they match across chunks
    const r = seeded(hash2(cx, cy) ^ 0x51ab), px = (cx + 0.2 + r() * 0.6) * P, py = (cy + 0.2 + r() * 0.6) * P, rad = 28 + r() * 36, pts = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + r() * 0.5, q = rad * (0.6 + r() * 0.5); pts.push([px + Math.cos(a) * q, py + Math.sin(a) * q * 0.75]); }
    pPoly(g, pts); g.fillStyle = r() < 0.5 ? 'rgba(255,214,170,.13)' : 'rgba(90,35,20,.12)'; g.fill();
    if (r() < 0.55) { g.strokeStyle = 'rgba(36,22,15,.42)'; g.lineWidth = 1.3; g.beginPath(); let x = px + (r() - 0.5) * 60, y = py + (r() - 0.5) * 60; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 34; y += 10 + r() * 18; g.lineTo(x, y); } g.stroke(); }
  }
  if (!low) { g.globalAlpha = 0.45; g.fillStyle = DOTS.fine; g.fillRect(x0, y0, nx * S, ny * S); g.globalAlpha = 1; }
  g.restore();
  // ink: the top edge with its lit rim, then the base where the rock meets the floor (where you hit it)
  g.strokeStyle = 'rgba(255,226,190,.75)'; g.lineWidth = 2.6; msStroke(g, msLines(top, -3));
  g.strokeStyle = 'rgba(36,22,15,.8)'; g.lineWidth = 1.6; msStroke(g, msLines(top, 0));
  g.strokeStyle = INK; g.lineWidth = 3.6; msStroke(g, base);
  g.save(); g.translate(0.8, 0.6); g.globalAlpha = 0.35; g.lineWidth = 1; msStroke(g, base); g.restore();
  return R2;
}
// ---- Red Canyon's landmarks (encounters.js places them): what lies on the floor is flat and faint, what stands is on the rock
const TIMBER = '#b8864f', TIMBER2 = '#7a5232';
function plank(g, x, y, l, w, a, col = TIMBER) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.fillRect(-l / 2, -w / 2, l, w); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(-l / 2, -w / 2, l, w); g.restore(); }
function paintMarkFloor(g, m) {   // before the rock: the mine's rails, the fallen planks of the bridge
  const R2 = seeded(Math.round(-m.y) * 7 + 3);
  if (m.k === 'mine') {   // old mine rails from the shaft along the wall: sleepers, two rails, a gap where they've gone
    const P = [[m.x - 30, m.y], [m.x + 40, m.y + 6], ...m.rails], gap = 6 + Math.floor(R2() * 10);
    g.save(); pEllipse(g, m.x + 44, m.y + 8, 62, 42, 0.35); g.globalAlpha = 0.3; g.fillStyle = '#dcb58c'; g.fill(); g.globalAlpha = 0.6; g.fillStyle = DOTS.sand; g.fill(); g.restore();   // pale spoil tipped out of the shaft
    g.save(); g.globalAlpha = 0.85; g.lineCap = 'butt';
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1], a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a), L = Math.hypot(x1 - x0, y1 - y0);
      for (let t = 0; t < L; t += 16) { const x = x0 + Math.cos(a) * t, y = y0 + Math.sin(a) * t; g.save(); g.translate(x, y); g.rotate(a + (R2() - 0.5) * 0.25); g.fillStyle = TIMBER2; g.fillRect(-3.5, -18, 7, 36); g.restore(); }   // sleepers
      if (i === gap || i === gap + 1) continue;   // a stretch of rail torn up
      for (const o of [-11, 11]) { g.strokeStyle = '#2e2420'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x0 + nx * o, y0 + ny * o); g.lineTo(x1 + nx * o, y1 + ny * o); g.stroke(); g.strokeStyle = 'rgba(220,200,180,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + nx * o - 0.8, y0 + ny * o - 0.8); g.lineTo(x1 + nx * o - 0.8, y1 + ny * o - 0.8); g.stroke(); }
    }
    g.restore(); return;
  }
  g.save(); g.globalAlpha = 0.75;   // the bridge's fallen deck: a few planks lying flat across the floor below it
  for (let i = 0; i < 6; i++) { const x = m.xl + 70 + R2() * (m.xr - m.xl - 140), y = m.y + (R2() - 0.5) * 90; plank(g, x, y, 30 + R2() * 16, 8, (R2() - 0.5) * 2.4); }
  g.restore();
}
function paintMarkRock(g, m) {   // after the rock: the mine's boarded mouth in the wall, the broken bridge's stubs on each rim
  if (m.k === 'mine') {
    const x = m.x, y = m.y, d = 54;   // the mouth: cut into the face from the wall's foot, timber-framed and boarded up
    g.beginPath(); g.moveTo(x + 2, y - 28); g.lineTo(x - d * 0.6, y - 28); g.quadraticCurveTo(x - d * 1.1, y, x - d * 0.6, y + 28); g.lineTo(x + 2, y + 28); g.closePath(); g.fillStyle = '#140906'; g.fill();
    g.strokeStyle = 'rgba(150,130,115,.6)'; g.lineWidth = 2.4; g.beginPath(); for (const o of [-11, 11]) { g.moveTo(x + 2, y + o); g.lineTo(x - d * 0.55, y + o * 0.8); } g.stroke();   // the rails run on into the dark
    plank(g, x - d * 0.35, y - 31, d * 0.85, 8, 0); plank(g, x - d * 0.35, y + 31, d * 0.85, 8, 0); plank(g, x - d * 0.8, y, 9, 70, 0);   // the frame
    plank(g, x - d * 0.28, y - 10, 60, 7, 1.1); plank(g, x - d * 0.28, y + 10, 60, 7, -1.1);   // boards nailed across
    return;
  }
  for (const [e, s] of [[m.xl, -1], [m.xr, 1]]) {   // each rim: two posts on the top, the deck's stub over the face to the wall's foot, its broken end hanging
    const px = e + s * (s < 0 ? 78 : 50), ex = e + s * 6, x0 = Math.min(px, ex), x1 = Math.max(px, ex);   // (the left wall's face, turned from the sun, is the wider)
    g.fillStyle = 'rgba(34,8,14,.35)'; g.fillRect(x0 + 8, m.y - 30 + 11, x1 - x0, 60);   // its shadow on the rock
    for (let x = px; s < 0 ? x < ex - 4 : x > ex + 4; x -= s * 12) { const t = Math.abs(x - ex), end = t < 26; plank(g, x - s * 6, m.y + (end ? -s * (26 - t) * 0.25 : 0), 10, 58, end ? s * (0.1 + (26 - t) * 0.012) : 0); }
    plank(g, ex + s * 8, m.y + 30, 9, 30, s * 0.5, TIMBER2);   // a plank dangling down the wall
    g.strokeStyle = '#2e2018'; g.lineWidth = 2.4; for (const o of [-31, 31]) { g.beginPath(); g.moveTo(px, m.y + o); g.lineTo(ex, m.y + o); g.quadraticCurveTo(ex - s * 5, m.y + o + 12, ex - s * 1, m.y + o + 22); g.stroke(); }   // rope rails, snapped
    for (const o of [-33, 33]) { g.fillStyle = SHADOW; g.beginPath(); g.arc(px + 7, m.y + o + 10, 8, 0, TAU); g.fill(); inkCircle(g, px, m.y + o, 8.5, TIMBER2, { lw: 2.2, double: false }); }
  }
}
function paintPost(g, P) {   // a gate post: rusted pipe, a hazard band
  g.fillStyle = SHADOW; g.beginPath(); g.arc(P.x + 6, P.y + 8, P.r, 0, TAU); g.fill();
  inkCircle(g, P.x, P.y, P.r, 'gun', { box: true, lw: 2.6, hatch: false });
  g.save(); pCircle(g, P.x, P.y, P.r * 0.62); g.clip(); g.fillStyle = PAL.yellow; g.fillRect(P.x - P.r, P.y - P.r, 2 * P.r, 2 * P.r); g.fillStyle = INK; for (let i = -2; i < 3; i++) g.fillRect(P.x + i * 6 - 1.5, P.y - P.r, 3, 2 * P.r); g.restore();
  g.lineWidth = 1.4; g.strokeStyle = INK; g.beginPath(); g.arc(P.x, P.y, P.r * 0.62, 0, TAU); g.stroke();
}
function paintCraneBase(g, C) {   // the wrecking ball's turntable
  g.fillStyle = SHADOW; g.beginPath(); g.arc(C.x + 8, C.y + 11, C.r + 6, 0, TAU); g.fill();
  inkCircle(g, C.x, C.y, C.r + 6, 'yellow', { box: true, lw: 3.2 });
  inkCircle(g, C.x, C.y, C.r * 0.55, 'gun', { lw: 1.8, double: false });
  const rv = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; rv.push([C.x + Math.cos(a) * C.r * 0.85, C.y + Math.sin(a) * C.r * 0.85]); } rivets(g, rv, 2);
}
function blob(x, y, r, seed, n = 32) {   // a smooth irregular outline: two slow lobes, no spikes
  const a1 = seed % 7, a2 = seed % 11, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 0.88 + 0.08 * Math.sin(a * 2 + a1) + 0.05 * Math.sin(a * 3 + a2); pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]); }
  return pts;
}
function paintSoftSand(g, S) {   // deep soft sand: a sunken rippled patch with a soft rim; it slows you
  const pts = blob(S.x, S.y, S.r, Math.round(S.x + S.y));
  pPoly(g, pts); g.fillStyle = '#e2a865'; g.fill();
  g.save(); pPoly(g, pts); g.clip();
  g.fillStyle = 'rgba(120,60,20,.22)'; g.beginPath(); g.ellipse(S.x - S.r * 0.18, S.y - S.r * 0.2, S.r * 0.95, S.r * 0.85, 0, 0, TAU); g.rect(S.x - S.r * 2, S.y - S.r * 2, S.r * 4, S.r * 4); g.fill('evenodd');   // the far lip throws a shadow into the dip
  g.strokeStyle = 'rgba(120,60,20,.45)'; g.lineWidth = 2.2; g.lineCap = 'round'; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(S.x - S.r * 0.75, S.y + k * S.r * 0.22); g.quadraticCurveTo(S.x, S.y + k * S.r * 0.22 - 10, S.x + S.r * 0.75, S.y + k * S.r * 0.22); g.stroke(); }
  g.restore();
  pPoly(g, pts); g.setLineDash([10, 7]); g.strokeStyle = 'rgba(36,22,15,.55)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
  // no icon: the sunken ripples say it, and a tip explains it once
}
function paintOil(g, O) {   // a slick: black, a rainbow sheen, a spin arrow
  const pts = blob(O.x, O.y, O.r, Math.round(O.x * 3 + O.y));
  inkPoly(g, pts, '#1d1726', { lw: 2.6 });
  for (const [col, k] of [['rgba(255,80,200,.45)', 0.75], ['rgba(80,220,255,.45)', 0.6], ['rgba(255,230,90,.4)', 0.45]]) { g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(O.x - 6, O.y - 4, O.r * k, 3.6, 5.6); g.stroke(); }
  // no icon: the black gloss and its oily sheen say 'slippery'
}

// ============ effects ============
function flamePath(g, x, y, r, n, seed, rot) { const F = seeded(seed); g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + rot, k = i % 2 ? 0.52 + F() * 0.14 : 0.9 + F() * 0.3; g.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); } g.closePath(); }
function drawFireball(p, k) {   // a ragged inked fireball: three tongues of flame, ink rays while it's fresh
  const grow = k < 0.15 ? 0.45 + k / 0.15 * 0.55 : 1 - (k - 0.15) * 0.55, r = p.R * grow, rot = p.seed + k * 0.8, a = k > 0.6 ? (1 - k) / 0.4 : 1;
  ctx.save(); ctx.globalAlpha = a;
  ink(ctx, () => flamePath(ctx, p.x, p.y, r, 9, p.seed, rot), k < 0.5 ? 'fire3' : 'dark', { lw: 2.2, double: false });
  ink(ctx, () => flamePath(ctx, p.x - 2, p.y - 1, r * 0.7, 8, p.seed + 2, -rot), k < 0.45 ? 'fire2' : 'smoke', { lw: 1.4, double: false });
  if (k < 0.4) ink(ctx, () => flamePath(ctx, p.x - 4, p.y - 3, r * 0.4, 7, p.seed + 5, rot), 'fire1', { line: false });
  if (k < 0.4) { ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; const P = seeded(p.seed * 7); ctx.beginPath(); for (let i = 0; i < 7; i++) { const aa = P() * TAU, r1 = r * 1.15 + P() * 6, r2 = r1 + 8 + P() * 12; ctx.moveTo(p.x + Math.cos(aa) * r1, p.y + Math.sin(aa) * r1); ctx.lineTo(p.x + Math.cos(aa) * r2, p.y + Math.sin(aa) * r2); } ctx.stroke(); }
  ctx.restore();
}
// film grain: a tile of noise, multiplied over the frame at a different offset each frame
const GRAIN = (() => { const c = document.createElement('canvas'); c.width = c.height = 180; const x = c.getContext('2d'), d = x.createImageData(180, 180); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat'); })();
function drawGrade() {   // sun glare from the top left, a warm vignette, grain
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(VW, VH) * 1.05); sg.addColorStop(0, 'rgba(255,244,205,.2)'); sg.addColorStop(1, 'rgba(255,244,205,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, VW, VH);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.42, VW / 2, VH / 2, Math.max(VW, VH) * 0.78); vg.addColorStop(0, 'rgba(60,25,10,0)'); vg.addColorStop(1, 'rgba(60,25,10,.38)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (save.lowfx) return;   // light effects: no film grain
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.07; ctx.translate(-fxRand() * 180, -fxRand() * 180); ctx.fillStyle = GRAIN; ctx.fillRect(0, 0, VW + 180, VH + 180); ctx.restore();
}
// the storm: two tileable strips of billows (shadowed behind, sunlit in front) scrolling with the wind over a dark body
const STORM_TW = 1320;
function stormBand(front) {
  return sprite('storm' + (front ? 1 : 0), [-60, -100, STORM_TW + 60, 160], g => {
    const R2 = seeded(front ? 91 : 57), B = [];
    for (let x = 0; x < STORM_TW;) {   // irregular: a big billow, then a couple of small ones tucked against it
      const big = R2() < 0.4, r = front ? (big ? 44 + R2() * 14 : 22 + R2() * 14) : 40 + R2() * 30;
      B.push({ x, y: (front ? 4 : -30) + Math.sin(x / STORM_TW * TAU * 2 + (front ? 0 : 2)) * 16 + (R2() - 0.5) * (big ? 30 : 18) - (big ? 10 : 0), r });
      x += r * (front ? 1.05 : 1.15) + R2() * 16;
    }
    const all = []; for (const b of B) { all.push(b); if (b.x < 90) all.push(Object.assign({}, b, { x: b.x + STORM_TW })); if (b.x > STORM_TW - 90) all.push(Object.assign({}, b, { x: b.x - STORM_TW })); }
    const mass = () => { g.beginPath(); for (const b of all) { g.moveTo(b.x + b.r, b.y); g.arc(b.x, b.y, b.r, 0, TAU); } g.rect(-60, 12, STORM_TW + 120, 148); };
    g.fillStyle = front ? PAL.storm1 : PAL.storm2; mass(); g.fill();
    g.save(); mass(); g.clip();
    if (front) {
      g.globalAlpha = 0.6; g.fillStyle = PAL.storm2; g.beginPath(); for (const b of all) { g.moveTo(b.x + 6 + b.r, b.y + b.r * 0.55); g.arc(b.x + 6, b.y + b.r * 0.55, b.r * 0.95, 0, TAU); } g.rect(-60, 46, STORM_TW + 120, 120); g.fill();   // shaded undersides
      g.globalAlpha = 0.55; g.fillStyle = PAL.bone;
      for (const b of all) { g.save(); pCircle(g, b.x, b.y, b.r); g.clip(); g.beginPath(); g.rect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); g.arc(b.x + b.r * 0.22, b.y + b.r * 0.3, b.r * 0.98, 0, TAU, true); g.fill('evenodd'); g.restore(); }   // a crescent of light on each billow's sunny side
    }
    g.globalAlpha = front ? 0.45 : 0.6; g.fillStyle = DOTS.fine; g.fillRect(-60, -100, STORM_TW + 120, 260);
    g.restore();
    if (front) { g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = 2.4; g.globalAlpha = 0.75; for (const b of all) { g.beginPath(); g.arc(b.x, b.y, b.r, 3.95, 5.45); g.stroke(); } g.globalAlpha = 1; }   // ink caps: the cloud's silhouette
  }, 0.8);
}
