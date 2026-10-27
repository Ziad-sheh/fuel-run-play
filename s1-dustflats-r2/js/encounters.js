'use strict';
// Fuel Run · encounters.js: the demo's authored roads. A demo run doesn't use the endless generator: its whole road is
// laid out at the start from the run's layout seed (one of three arrangements per level) and every chunk is cut from that
// layout, so a wall, a drum or the fuel cache stays where it is and stays used up when you drive away and back.
// The road runs north in six beats: orientation, a new threat, two threats together, an optional risk for a reward,
// the hardest stretch, then a quiet run into the boss's arena. Each beat brings a fixed set of raiders (never refilled),
// then a few seconds' breather before the next one can start. The arena is walled in; its gate closes behind you once
// your whole car is inside, and only then does the boss come out.
// Classic scripts sharing one global scope, loaded in order by index.html.

const ENC = {
  flats: {
    len: 27000, amp: [300, 420], wl: [3600, 4600], maxActive: 3, arenaR: 640,
    beats: v => [   // at: how far down the road it starts (0..1); pk: who comes, from where, when; heat: how many may attack at once
      { name: 'orient', at: 0.03, heat: 1, recover: 3, pk: [{ type: 'buggy', from: 'starter', t: 0 }, { type: 'buggy', from: 'behind', t: 4 }] },
      { name: 'flank', at: 0.15, heat: 1, recover: 3.5, pk: (v === 2 ? [{ type: 'buggy', from: 'L', t: 0 }, { type: 'buggy', from: 'R', t: 0.8 }] : [{ type: 'buggy', from: v ? 'R' : 'L', t: 0 }, { type: 'buggy', from: v ? 'L' : 'R', t: 2.5 }]).concat([{ type: 'polecat', from: 'behind', t: 6 }]) },
      { name: 'rammer', at: 0.29, heat: 2, recover: 4, pk: [{ type: 'ram', from: 'behind', t: 0 }, { type: 'buggy', from: v === 1 ? 'L' : 'R', t: 3.5 }, { type: 'buggy', from: v === 1 ? 'R' : 'L', t: 6 }] },
      v === 1 ? { name: 'convoy', at: 0.46, heat: 2, recover: 3, convoy: true, pk: [{ type: 'buggy', from: 'behind', t: 6 }] }   // the reward beat's other form: a fuel tanker running up the road with two escorts
        : { name: 'cache', at: 0.46, heat: 2, recover: 3, cache: true, pk: [{ type: 'polecat', from: 'behind', t: 4 }, { type: 'buggy', from: 'ahead', t: 7 }] },
      { name: 'escalate', at: 0.62, heat: 3, recover: 4, pk: [
        [{ type: 'buggy', from: 'L', t: 0 }, { type: 'polecat', from: 'R', t: 0.5 }, { type: 'ram', from: 'behind', t: 3 }, { type: 'buggy', from: 'L', t: 6 }, { type: 'ram', from: 'behind', t: 9 }, { type: 'buggy', from: 'R', t: 11 }],
        [{ type: 'polecat', from: 'L', t: 0 }, { type: 'buggy', from: 'R', t: 0.5 }, { type: 'ram', from: 'behind', t: 3 }, { type: 'harpoon', from: 'R', t: 6 }, { type: 'buggy', from: 'L', t: 9 }, { type: 'ram', from: 'behind', t: 11 }],
        [{ type: 'buggy', from: 'R', t: 0 }, { type: 'buggy', from: 'L', t: 0.5 }, { type: 'ram', from: 'behind', t: 3 }, { type: 'polecat', from: 'R', t: 6 }, { type: 'harpoon', from: 'L', t: 9 }, { type: 'ram', from: 'behind', t: 11 }]][v] },
      { name: 'approach', at: 0.86, heat: 1, recover: 0, pk: [] },
    ],
  },
  canyon: {
    len: 26000, amp: [250, 320], wl: [2200, 2700], maxActive: 4, arenaR: 720, canyon: true,
    width: [[0, 210], [0.03, 255], [0.07, 255], [0.09, 230], [0.16, 250], [0.18, 330], [0.27, 330], [0.29, 560], [0.43, 560], [0.45, 250], [0.49, 250], [0.51, 470], [0.64, 470], [0.66, 300], [0.86, 300], [0.9, 420], [1, 420]],   // half the canyon's width down the road: narrows, pockets, the fork, the crossing
    beats: v => [
      { name: 'bend', at: 0.03, heat: 1, recover: 3, pk: [{ type: 'buggy', from: 'starter', t: 0 }, { type: 'buggy', from: 'behind', t: 5 }, { type: 'polecat', from: 'ahead', t: 8 }] },
      { name: 'rockfall', at: 0.17, heat: 1, recover: 3, rocks: v === 2 ? [[1.0, -1], [1.6, -1], [6.0, 1], [6.6, 1]] : [[1.0, v ? 1 : -1], [1.6, v ? 1 : -1], [2.2, v ? 1 : -1]], pk: [{ type: 'polecat', from: 'behind', t: 4 }] },
      { name: 'fork', at: 0.3, heat: 2, recover: 3, fork: true, convoy: v === 0, pk: v === 0 ? [{ type: 'buggy', from: 'behind', t: 6 }]   // the fork's prize: a tanker up the wide lane (cut it off down the tight one), or the tight lane's cache
        : [{ type: 'buggy', from: 'behind', t: 2 }, { type: v === 2 ? 'harpoon' : 'buggy', from: 'ahead', t: 5 }, { type: 'buggy', from: 'behind', t: 8 }] },
      { name: 'barrage', at: 0.5, heat: 2, recover: 3, barrage: true, pk: [{ type: 'buggy', from: 'behind', t: 7 }, { type: 'polecat', from: 'behind', t: 10 }] },
      { name: 'pursuit', at: 0.68, heat: 3, recover: 4, rocks: [[4, -1], [9, 1]], pk: [
        [{ type: 'buggy', from: 'behind', t: 0 }, { type: 'polecat', from: 'L', t: 1 }, { type: 'harpoon', from: 'ahead', t: 3 }, { type: 'ram', from: 'behind', t: 6 }],
        [{ type: 'polecat', from: 'R', t: 0 }, { type: 'polecat', from: 'L', t: 1.5 }, { type: 'buggy', from: 'behind', t: 3 }, { type: 'ram', from: 'behind', t: 6 }],
        [{ type: 'buggy', from: 'L', t: 0 }, { type: 'harpoon', from: 'ahead', t: 1.5 }, { type: 'polecat', from: 'R', t: 3 }, { type: 'buggy', from: 'behind', t: 5 }, { type: 'ram', from: 'behind', t: 7 }]][v] },
      { name: 'approach', at: 0.88, heat: 1, recover: 0, pk: [] },
    ],
  },
};
const ENC_CACHE = { fuel: 12, salvage: 4 }, ENC_BEAT_BONUS = 3, ENC_CONVOY = { speed: 0.66, hp: 160 };   // the convoy's tanker: its pace (x yours, so you can catch it even off the road) and health (four pips, armoured)   // the cache's prize (once a run); salvage for a beat in which you wrecked something

// ============ the layout: built once a run ============
function encBuild() {
  if (ENC[demo.level].proto) return protoBuild();   // the prototype lab (proto.js)
  if (ENC[demo.level].canyon) return encBuildCanyon();
  const lv = demo.level, C = ENC[lv], v = demo.variant, R = demo.rLayout, rr = (a, b) => a + R() * (b - a);
  const L = { lv, v, len: C.len, y0: 300, rocks: [], walls: [], drums: [], sands: [], crates: [], beats: C.beats(v), cache: null, arena: null };
  L.road = { x0: 0, y0: 300, x1: 0, y1: 300 - C.len, amp: rr(C.amp[0], C.amp[1]), wl: rr(C.wl[0], C.wl[1]), ph: R() * TAU, first: true };
  const at = p => { const y = 300 - C.len * p; return [roadAt(L.road, y), y]; };
  const clear = (x, y, r) => !L.rocks.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 90);
  // the flats: mesas along both sides at a distance, cover and anchors, never on the road
  for (let p = 0.02, s = 1; p < 0.95; p += rr(0.025, 0.04), s = -s) { const [rx, y] = at(p), lat = rr(ROAD_W + 260, 760), r = rr(34, 60), x = rx + s * lat; if (clear(x, y, r)) L.rocks.push({ x, y, r }); }
  // the rammer lesson: outcrops right beside the road, on one side, the other, or both
  for (const [p, side] of [[0.33, v === 1 ? 1 : -1], [0.36, v === 2 ? 1 : v === 1 ? 1 : -1], [0.39, v === 1 ? 1 : -1]]) { const [rx, y] = at(p), x = rx + side * rr(ROAD_W + 90, ROAD_W + 140), r = rr(36, 46); if (clear(x, y, r - 60)) L.rocks.push({ x, y, r }); }
  // the guarded cache, off the road on one side
  if (v !== 1) { const side = 1, [rx, y] = at(0.52); L.cache = { x: rx + side * (v === 2 ? 760 : 620), y, r: 44, taken: false, side }; }   // (the convoy arrangement has no cache)
  // the last stretch: scrap cover and drums along both lanes
  for (const p of [0.67, 0.74, 0.8]) { const [rx, y] = at(p), s = (Math.floor(p * 100) % 2) ? 1 : -1, x = rx + s * rr(ROAD_W + 160, ROAD_W + 240); L.walls.push({ x: x - 60, y: y - 18, w: 120, h: 36, hp: 3, shakeT: 0 }); L.drums.push({ x: x + rr(-40, 40), y: y - 70, r: 17 }, { x: x + rr(-40, 40), y: y + 70, r: 17 }); }
  for (let i = 0; i < 26; i++) { const p = rr(0.02, 0.95), [rx, y] = at(p), x = rx + (R() < 0.5 ? -1 : 1) * rr(ROAD_W + 300, 1400); L.sands.push({ x, y, r: rr(90, 150) }); }   // soft sand out on the flats: slower going away from the road
  // the arena: a walled bowl at the road's end, its gate on the road
  const Ar = C.arenaR, gy = 300 - C.len, A = L.arena = { x: 0, y: gy - Ar - 40, R: Ar, gateY: gy, sealed: false, gate: [], anchors: [] };
  const Rb = Ar + 40, n = Math.ceil(TAU * Rb / 105), gapHalf = Math.asin(190 / Rb);   // a gateway wide enough to find at speed
  for (let i = 0; i < n; i++) { const a = i / n * TAU; if (Math.abs(angDiff(a, Math.PI / 2)) < gapHalf) continue; L.rocks.push({ x: A.x + Math.cos(a) * Rb, y: A.y + Math.sin(a) * Rb, r: 70, rim: true }); }
  for (const a of [Math.PI / 2 - gapHalf * 0.66, Math.PI / 2, Math.PI / 2 + gapHalf * 0.66]) A.gate.push({ x: A.x + Math.cos(a) * Rb, y: A.y + Math.sin(a) * Rb, r: 70, rim: true });
  const rot = [0, Math.PI / 3, -0.35][v];
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + rot + i * TAU / 3, q = { x: A.x + Math.cos(a) * 300, y: A.y + Math.sin(a) * 300, r: 52, anchor: true }; L.rocks.push(q); A.anchors.push(q); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55, d = Ar - 90; L.crates.push({ x: A.x + Math.cos(a) * d, y: A.y + Math.sin(a) * d, r: 21 }); }   // breakables for the Bull to smash
  for (const q of L.rocks) q.lay = true;
  return L;
}
// ============ Red Canyon: the corridor, the fork, the quarry ============
const lerpW = (W, p) => { for (let i = 1; i < W.length; i++) if (p <= W[i][0]) { const [p0, w0] = W[i - 1], [p1, w1] = W[i], k = (p - p0) / (p1 - p0 || 1); return w0 + (w1 - w0) * (0.5 - 0.5 * Math.cos(Math.PI * k)); } return W[W.length - 1][1]; };
const canyonHalf = (L, y) => lerpW(ENC.canyon.width, clamp((L.y0 - y) / L.len, 0, 1));
function canyonIsland(L, y) {   // the rock island in the fork at this y: [left, right] or null
  const F = L.fork, k = 1 - Math.abs(y - F.y) / F.ay; if (k <= -45 / F.ay) return null;   // (its tip boulders reach 45 past the outline)
  const cx = roadAt(L.road, y), h = canyonHalf(L, y), tight = F.tight, wide = F.wide, a = cx - h, b = cx + h, s = Math.sqrt(Math.max(0, k));
  const full = F.reward < 0 ? [a + tight, b - wide] : [a + wide, b - tight], mid = (full[0] + full[1]) / 2, half = Math.max(45, (full[1] - full[0]) / 2 * s);
  return [mid - half, mid + half];
}
function canyonLanes(L, y) {   // the open lanes across the canyon at this y (the fork has two)
  const cx = roadAt(L.road, y), h = canyonHalf(L, y), F = L.fork; let I = F && canyonIsland(L, y);
  if (!I && F && Math.abs(y - F.y) < F.ay + 140) I = canyonIsland(L, F.y + Math.sign(y - F.y) * F.ay);   // just beyond a tip its boulders still stand mid-canyon: the routes split (and rejoin) a car's length clear of them
  return I ? [[cx - h, I[0]], [I[1], cx + h]] : [[cx - h, cx + h]];
}
function encBuildCanyon() {
  const C = ENC.canyon, v = demo.variant, R = demo.rLayout, rr = (a, b) => a + R() * (b - a);
  const L = { lv: 'canyon', v, canyon: true, len: C.len, y0: 300, rocks: [], cliffs: [], walls: [], drums: [], sands: [], crates: [], beats: C.beats(v), cache: null, arena: null };
  L.road = { x0: 0, y0: 300, x1: 0, y1: 300 - C.len, amp: rr(C.amp[0], C.amp[1]), wl: rr(C.wl[0], C.wl[1]), ph: R() * TAU, first: true };
  L.fork = { y: 300 - C.len * 0.36, ay: C.len * 0.048, tight: 240, wide: 380, reward: v === 1 ? 1 : -1 };   // the tight lane (with the cache) on the left, or the right
  L.rockSide = v === 2 ? 0 : v ? 1 : -1;
  L.barrage = { dir: [1, -1, 0][v] };   // which way the safe lane drifts: right, left, or a zigzag
  const Ar = C.arenaR, gy = 300 - C.len, A = L.arena = { x: 0, y: gy - Ar - 40, R: Ar, gateY: gy, sealed: false, gate: [], anchors: [], spots: [], quarry: true };
  const Rb = Ar + 40, inQuarry = (x, y, m) => Math.hypot(x - A.x, y - A.y) < Rb + m;
  // the walls: a boulder every 70 down each side, its face on the canyon's edge; past the road's end they hug the quarry
  for (let y = 300 + 600; y > A.y - Rb; y -= 70) {
    const yy = Math.min(y, 300), cx = roadAt(L.road, Math.max(yy, gy)), h = y > gy ? canyonHalf(L, Math.min(y, 300)) : 420;
    for (const s of [-1, 1]) { const q = { x: cx + s * (h + 52), y, r: 74, cliff: s }; if (!inQuarry(q.x, q.y, 40)) L.cliffs.push(q); }
  }
  // the island in the fork: boulders round its edge
  for (let y = L.fork.y + L.fork.ay; y > L.fork.y - L.fork.ay; y -= 60) { const I = canyonIsland(L, y); if (!I || I[1] - I[0] < 50) continue; for (const x of [I[0] + 34, I[1] - 34]) L.cliffs.push({ x, y, r: 40, island: true }); if (I[1] - I[0] > 120) L.cliffs.push({ x: (I[0] + I[1]) / 2, y, r: Math.min(70, (I[1] - I[0]) / 2 - 30), island: true }); }
  if (v !== 0) { const lanes = canyonLanes(L, L.fork.y), lane = L.fork.reward < 0 ? lanes[0] : lanes[1]; L.cache = { x: (lane[0] + lane[1]) / 2, y: L.fork.y, r: 40, taken: false, side: L.fork.reward }; }   // (the convoy arrangement has no cache)
  // the quarry: a rim, three ridges into it, a mass in the middle; three firing spots, one per pocket
  const n = Math.ceil(TAU * Rb / 105), gapHalf = Math.asin(190 / Rb);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; if (Math.abs(angDiff(a, Math.PI / 2)) < gapHalf) continue; L.rocks.push({ x: A.x + Math.cos(a) * Rb, y: A.y + Math.sin(a) * Rb, r: 70, rim: true }); }
  for (const a of [Math.PI / 2 - gapHalf * 0.66, Math.PI / 2, Math.PI / 2 + gapHalf * 0.66]) A.gate.push({ x: A.x + Math.cos(a) * Rb, y: A.y + Math.sin(a) * Rb, r: 70, rim: true });
  for (const a of [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 1.5]) for (let d = Rb - 20; d > Ar - 330; d -= 60) L.rocks.push({ x: A.x + Math.cos(a) * d, y: A.y + Math.sin(a) * d, r: 56, ridge: true });
  { const q = { x: A.x, y: A.y, r: 95, anchor: true }; L.rocks.push(q); A.anchors.push(q); }
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) A.spots.push({ x: A.x + Math.cos(a) * 470, y: A.y + Math.sin(a) * 470, a, inner: { x: A.x + Math.cos(a) * 245, y: A.y + Math.sin(a) * 245 } });
  for (const q of L.rocks) q.lay = true; for (const q of L.cliffs) q.lay = true;
  for (const q of L.rocks) if (q.rim || q.ridge || q.anchor) q.field = true;   // painted as part of the rock mass, not as separate mesas
  L.field = { K: 200, B: new Map() }; for (const q of [...L.cliffs, ...L.rocks.filter(q => q.field)]) canyonFieldAdd(L, q);
  // its landmarks, at fixed points down the road (pure look: no layout randomness): a broken rope bridge across the
  // narrows, an old mine in the left wall with its rails along the floor. Both sit in the rock or flat on the floor.
  L.marks = [['bridge', 0.06], ['mine', 0.235], ['bridge', 0.482], ['mine', 0.72], ['bridge', 0.875]].map(([k, p]) => canyonMark(L, k, 300 - C.len * p));
  return L;
}
function canyonEdge(L, y, s) {   // where the floor meets the wall on side s at this y (the rock's base, where cars hit)
  const cx = roadAt(L.road, y), h = canyonHalf(L, y); let a = 0, b = h + 200;
  for (let d = 0; d < b; d += 6) if (canyonRock(L, cx + s * d, y) < 0) { a = Math.max(0, d - 6); b = d; break; }
  for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (canyonRock(L, cx + s * m, y) < 0) b = m; else a = m; }
  return cx + s * a;
}
function canyonMark(L, k, y) {
  if (k === 'bridge') return { k, y, xl: canyonEdge(L, y, -1), xr: canyonEdge(L, y, 1) };
  const off = []; for (let yy = y + 30; yy < y + 560; yy += 20) { const x0 = roadAt(L.road, yy) - canyonHalf(L, yy); let d = 40; while (d < 200 && canyonRock(L, x0 + d, yy) < 60) d += 4; off.push([x0, d, yy]); }
  const rails = off.map(([x0, , yy], i) => [x0 + Math.max(...off.slice(Math.max(0, i - 2), i + 3).map(o => o[1])), yy]);   // along the floor beside the wall, 60 clear of its boulders on the bends too
  return { k, y, x: canyonEdge(L, y, -1), rails };
}
const CANYON_PAL = { sand: '#9a684b', sand2: '#83543c', rock: '#6e3e2c', rockTop: '#d4673e' };   // Red Canyon: a dark dusty floor under deep red rock (loose stones stay brown: red on the floor is a fuel can)
function canyonFieldAdd(L, q) {   // a boulder joins the rock mass (its collision circle is part of the painted wall)
  const { K, B } = L.field; q.field = true;
  for (let bx = Math.floor((q.x - q.r) / K); bx <= Math.floor((q.x + q.r) / K); bx++) for (let by = Math.floor((q.y - q.r) / K); by <= Math.floor((q.y + q.r) / K); by++) { const k = bx + ',' + by; if (!B.has(k)) B.set(k, []); B.get(k).push(q); }
}
// How deep into rock a point is (< 0 in rock, > 0 on the floor): the union of the very boulders the cars collide with,
// the rock beyond the canyon's sides and round the quarry, and the island's body. Its zero line is the wall's base.
function canyonRock(L, x, y) {
  const { K, B } = L.field, A = L.arena, gy = A.gateY; let d = 1e9;
  const b = B.get(Math.floor(x / K) + ',' + Math.floor(y / K)); if (b) for (const q of b) d = Math.min(d, Math.hypot(x - q.x, y - q.y) - q.r);
  let floor = A.R + 70 - Math.hypot(x - A.x, y - A.y);   // the quarry floor, out past its rim boulders
  if (y > gy - 60) { const cy = Math.min(y, 300), cx = roadAt(L.road, Math.max(cy, gy)), h = canyonHalf(L, cy); floor = Math.max(floor, Math.min(x - (cx - h), cx + h - x)); }   // the corridor
  const I = L.fork && canyonIsland(L, y); if (I) d = Math.min(d, Math.max(I[0] - x, x - I[1]));
  return Math.min(d, floor);   // rock where a boulder, the island or the outside of the floor is
}
function canyonField(L, x0, y0, x1, y1, S = 12) {   // the rock field on a world-aligned grid over a box
  x0 = Math.floor(x0 / S) * S; y0 = Math.floor(y0 / S) * S; const nx = Math.ceil((x1 - x0) / S) + 1, ny = Math.ceil((y1 - y0) / S) + 1, v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = canyonRock(L, x0 + i * S, y0 + j * S);
  return { v, nx, ny, x0, y0, S };
}
function paintCanyon(g, ch) {   // the canyon's rock: walls, island, quarry rim and ridges, raised, from the field (its base is where cars hit)
  const L = demo.layout, M = 96, F = canyonField(L, ch.x - M, ch.y - M, ch.x + CH + M, ch.y + CH + M);
  const marks = (L.marks || []).filter(m => m.y + 620 > ch.y && m.y - 160 < ch.y + CH);   // landmarks reaching into this chunk (painted the same in each)
  for (const m of marks) paintMarkFloor(g, m);
  let any = false; for (const a of F.v) if (a < 0) { any = true; break; } if (!any) return;
  paintRockField(g, F, hash2(ch.cx, ch.cy));
  for (const m of marks) paintMarkRock(g, m);
}
function paintCanyonOld(g, ch) {   // the cliffs: red rock from the canyon's edge outwards, inked, with a hatched face
  const L = demo.layout, y0 = ch.y - 120, y1 = ch.y + CH + 120, A = L.arena, gy = A.gateY;
  const side = s => { const pts = []; for (let y = y0; y <= y1; y += 40) { const cy = Math.min(y, 300), cx = roadAt(L.road, Math.max(cy, gy)), h = y > gy ? canyonHalf(L, cy) : 420; let x = cx + s * h; if (y < gy + 40) { const dy = y - A.y, R2 = (A.R + 40) ** 2 - dy * dy; if (R2 > 0) x = s < 0 ? Math.min(x, A.x - Math.sqrt(R2) + 10) : Math.max(x, A.x + Math.sqrt(R2) - 10); } pts.push([x, y]); } return pts; };
  const fill = (pts, far) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(far, pts[pts.length - 1][1]); g.lineTo(far, pts[0][1]); g.closePath(); };
  for (const s of [-1, 1]) {
    const pts = side(s), far = s * 1e5; fill(pts, far); g.fillStyle = PAL.rock; g.fill();
    g.save(); fill(pts, far); g.clip(); g.fillStyle = PAL.rockTop; for (const [x, y] of pts) { g.beginPath(); g.ellipse(x + s * 70, y, 50, 30, 0, 0, TAU); g.fill(); } g.fillStyle = DOTS.fine; g.fillRect(ch.x, ch.y, CH, CH); g.restore();
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  }
  const F = L.fork; if (y1 > F.y - F.ay && y0 < F.y + F.ay) {   // the island
    const l = [], r = []; for (let y = F.y - F.ay; y <= F.y + F.ay; y += 40) { const I = canyonIsland(L, y); if (I) { l.push([I[0], y]); r.push([I[1], y]); } }
    if (l.length > 1) { g.beginPath(); l.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = r.length - 1; i >= 0; i--) g.lineTo(r[i][0], r[i][1]); g.closePath(); g.fillStyle = PAL.rock; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
  }
}
const roadAt = (r, y) => { const t = clamp((r.y0 - y) / (r.y0 - r.y1), 0, 1), taper = Math.min(1, t * 5, (1 - t) * 5); return r.x0 + (r.x1 - r.x0) * t + r.amp * Math.sin((r.y0 - y) / r.wl * TAU + r.ph) * taper; };
function encDepot() {   // the demo's "depot": the arena at the road's end (stage progress, the trip bar and the win all read it)
  const L = demo.layout = encBuild(), A = L.arena;
  if (L.proto) { protoDepot(L); return; }
  if (L.canyon) Object.assign(PAL, CANYON_PAL);   // (the next run's applyRegion puts the stage's own colours back)
  demo.enc = { i: 0, st: 'wait', t: 0, q: [], tag: 0, credit0: 0, spawned: 0, per: {} };
  depot = { x: A.x, y: A.gateY + 40, open: true, bossDone: false, msgT: 0, len: L.len, tanks: [], sections: [], ravines: [], signs: [], road: L.road, boss: null };
}
const encProgress = () => demo && demo.layout ? (demo.layout.proto ? protoProgress() : clamp((demo.layout.y0 - player.y) / demo.layout.len, 0, 1)) : 0;

// ============ chunks: cut from the layout ============
function demoChunk(cx, cy) {
  const L = demo.layout, ch = { cx, cy, x: cx * CH, y: cy * CH, scrap: false, walls: [], posts: [], rocks: [], cranes: [], drums: [], crates: [], oils: [], sands: [], balls: [], ramps: [], roughs: [], bumps: [] };
  const inC = (x, y) => Math.floor(x / CH) === cx && Math.floor(y / CH) === cy;
  for (const q of L.rocks) if (inC(q.x, q.y)) ch.rocks.push(q);
  const over = q => !inC(q.x, q.y) && q.x + q.r + 20 > ch.x && q.x - q.r - 20 < ch.x + CH && q.y + q.r + 20 > ch.y && q.y - q.r - 20 < ch.y + CH, spill = L.rocks.filter(over);   // big rocks across a chunk edge are painted into both
  if (L.arena.sealed) for (const q of L.arena.gate) if (inC(q.x, q.y)) ch.rocks.push(q);
  for (const W of L.walls) if (!W.gone && inC(W.x + W.w / 2, W.y + W.h / 2)) { W.ch = ch; ch.walls.push(W); }
  for (const b of L.drums) if (!b.gone && inC(b.x, b.y)) { b.ch = ch; ch.drums.push(b); }
  for (const b of L.crates) if (!b.gone && inC(b.x, b.y)) { b.ch = ch; ch.crates.push(b); }
  for (const s of L.sands) if (inC(s.x, s.y)) ch.sands.push(s);
  if (L.cliffs) ch.cliffs = L.cliffs.filter(q => inC(q.x, q.y));   // the canyon: boulders for collision, painted as one cliff
  ch.paint = g => { if (L.cliffs) paintCanyon(g, ch); for (const q of spill) if (!q.field) paintMesa(g, q); };
  paintChunk(ch, seeded(hash2(cx, cy) ^ demo.seed));
  return ch;
}

// ============ the beats ============
function encStarterFrom() {   // the opening beat's first raider comes where your first attachment works, so it can show what it does and earn your first card: forks and the cannon ahead, saws alongside, the rest behind
  const s = demo.build && demo.build.order[0]; return s === 'forks' || s === 'cannon' ? 'ahead' : s === 'saws' ? (demo.rLayout() < 0.5 ? 'L' : 'R') : 'behind';
}
function encSpawnPoint(from) {   // just off screen: behind you on the road, off one shoulder, or ahead (in the canyon, flankers come along the walls from behind)
  const hw = VW / 2 / view.z, hh = VH / 2 / view.z, py = player.y, L = demo.layout;
  if (L.canyon && (from === 'L' || from === 'R')) { const y = py + hh + 140, lanes = canyonLanes(L, y), ln = from === 'L' ? lanes[0] : lanes[lanes.length - 1]; for (let i = 0; i < 12; i++) { const x = (from === 'L' ? ln[0] + 70 : ln[1] - 70) + rand(-30, 30), yy = y + rand(-60, 60); if (!blocked(x, yy, 40)) return [x, yy]; } }
  const cands = from === 'behind' ? [[roadX(py + hh + 160) ?? player.x, py + hh + 160]] : from === 'ahead' ? [[roadX(py - hh - 160) ?? player.x, py - hh - 160]]
    : [[player.x + (from === 'L' ? -1 : 1) * (hw + 140), py - 120]];
  for (const [x, y] of cands) for (let i = 0; i < 12; i++) { const qx = x + (i ? rand(-120, 120) : 0), qy = y + (i ? rand(-120, 120) : 0); if (!blocked(qx, qy, 40)) return [qx, qy]; }
  return spawnPoint();
}
function encTick(dt) {
  if (demo.layout.proto) { protoTick(dt); return; }   // the lab runs its own director
  const E = demo.enc, L = demo.layout, B = L.beats[E.i], p = encProgress();
  // the cache: drive into it for fuel and salvage, once a run
  const K = L.cache; if (K && !K.taken && Math.hypot(player.x - K.x, player.y - K.y) < K.r + player.r) { K.taken = true; const got = changeFuel(ENC_CACHE.fuel, 'cache'); draftSalvage(ENC_CACHE.salvage); SFX.can(); SFX.level(); pops.push({ x: player.x, y: player.y - 60, text: `CACHE! +${Math.round(got)} FUEL`, col: '#5be37d', t: 0 }); recordRunEvent('cache', { fuel: Math.round(got) }); }
  // raiders of a beat left far behind give up
  for (const k of cars) if (!k.dead && !k.flee && k.evTag >= 1000 && Math.hypot(k.x - player.x, k.y - player.y) > 1500 && !inView(k.x, k.y, 200)) k.flee = true;
  const A = L.arena; if (!A.sealed) { const below = player.y > A.gateY + 120 && Math.abs(player.x - A.x) > 140; depot.x = A.x; depot.y = below ? A.gateY + 160 : A.y; }   // the road's goal: line up under the gate, then into the bowl
  if (stageBoss || !B) return;
  heat.lv = B.heat;
  const N = L.beats[E.i + 1]; if (N && E.st !== 'wait' && p >= N.at && (N.cache || N.fork || N.rocks || N.barrage || N.convoy)) { for (const P of E.q) P.done = true; E.i++; E.st = 'wait'; return; }   // a beat tied to a place starts when you reach it; the last one's leftovers stay on you
  if (E.st === 'wait') {
    if (p < B.at) return;
    E.st = 'active'; E.t = 0; E.tag = 1000 + E.i; E.q = B.pk.map(x => Object.assign({}, x)); E.credit0 = runState.totals.credited; E.rowT = 0; E.gx = null;
    if (B.rocks) B.rocks = B.rocks.map(r => r.slice());
    if (B.fork && K && !K.taken) { incoming.push({ x: K.x, y: K.y + 90, type: demo.variant === 2 ? 'harpoon' : 'buggy', t: 0.3, mode: 'parked', ahead: true, evTag: E.tag }); E.spawned++; E.per[E.i] = (E.per[E.i] || 0) + 1; }   // a guard on the cache in the tight lane
    const left = cars.filter(k => !k.dead && !k.flee).sort((a, b) => b.age - a.age), room = ENC[demo.level].maxActive - (B.pk.length ? 1 : 0) - (B.cache ? 2 : 0) - (B.convoy ? 3 : 0);
    for (let i = 0; i < left.length - Math.max(0, room); i++) left[i].flee = true;   // the oldest stragglers give up: each beat's first raider always gets in
    if (B.cache && K && !K.taken) for (const s of [-1, 1]) { const gx = K.x + s * 90, gy = K.y + 40; incoming.push({ x: gx, y: gy, type: 'buggy', t: 0.3, mode: 'parked', ahead: true, evTag: E.tag }); E.spawned++; E.per[E.i] = (E.per[E.i] || 0) + 1; }   // two guards sit on the cache
    if (B.convoy) encConvoy(E);
    recordRunEvent('beat', { beat: B.name, at: Math.round(p * 100) });
  } else if (E.st === 'active') {
    E.t += dt;
    const alive = cars.filter(k => !k.dead && !k.flee).length + incoming.length;
    for (const P of E.q) if (!P.done && P.t <= E.t && alive < ENC[demo.level].maxActive) { const from = P.from === 'starter' ? encStarterFrom() : P.from, pt = encSpawnPoint(from); if (pt) { incoming.push({ x: pt[0], y: pt[1], type: P.type, t: 1.2, ahead: from !== 'behind', evTag: E.tag, soft: P.from === 'starter' }); P.done = true; E.spawned++; E.per[E.i] = (E.per[E.i] || 0) + 1; break; } }
    if (B.rocks) for (const R of B.rocks) if (!R.done && E.t >= R[0]) { R.done = true; encRockfall(R[1]); }
    if (B.barrage && p < next0(L, E.i) && E.t >= 1.5 && E.t >= (E.rowT || 0)) { E.rowT = E.t + 1.1; encBarrageRow(); }
    const mine = cars.some(k => !k.dead && !k.flee && k.evTag === E.tag) || incoming.some(I => I.evTag === E.tag) || (B.barrage && p < next0(L, E.i)), next = L.beats[E.i + 1];
    if (next && p >= next.at + 0.08) for (const P of E.q) P.done = true;   // you outran the rest of this beat: it never comes
    if (E.q.every(P => P.done) && (!mine || (next && p >= next.at + 0.02))) {   // the beat is over (or you drove on past it, its raiders still on you): a bonus if you wrecked something in it, then a breather
      if (runState.totals.credited > E.credit0 && B.pk.length) draftSalvage(ENC_BEAT_BONUS);
      E.st = 'recover'; E.t = 0;
    }
  } else if (E.st === 'recover') { E.t += dt; if (E.t >= B.recover) { E.i++; E.st = 'wait'; } }
}

function encConvoy(E) {   // a fuel tanker and two escorts out ahead, running up the road (the fork's wide lane) for the arena: catch it and wreck it for its fuel, or let it go
  const L = demo.layout, y = player.y - VH / 2 / view.z - 220; let x = roadAt(L.road, y);
  if (L.canyon) { const ls = canyonLanes(L, y), ln = ls.reduce((a, b) => b[1] - b[0] > a[1] - a[0] ? b : a); x = (ln[0] + ln[1]) / 2; }
  const a = -Math.PI / 2;
  incoming.push({ x, y, type: 'tanker', t: 0.3, mode: 'convoy', a, ahead: true, evTag: E.tag });
  for (const s of [-1, 1]) incoming.push({ x: x + s * 64, y: y + 120, type: 'buggy', t: 0.3, mode: 'convoy', a, escort: true, ahead: true, evTag: E.tag });
  E.spawned += 3; E.per[E.i] = (E.per[E.i] || 0) + 3;
  pops.push({ x: player.x, y: player.y - 90, text: 'FUEL TANKER AHEAD!', col: '#e8a23a', t: 0 });
}
function encConvoyWant(k) {   // the convoy keeps to the road (in the canyon, its lane) heading north; near the arena it turns off and is gone
  const L = demo.layout; if (k.y < L.arena.gateY + 700) { k.flee = true; return k.a; }
  const y = k.y - 360; let x = roadAt(L.road, y);
  if (L.canyon) x = canyonLanes(L, y).map(l => (l[0] + l[1]) / 2).sort((a, b) => Math.abs(a - k.x) - Math.abs(b - k.x))[0];
  return Math.atan2(y - k.y, x - k.x);
}
const next0 = (L, i) => (L.beats[i + 1] ? L.beats[i + 1].at : 1) - 0.02;   // where a scripted beat stops (just before the next)
function encRockfall(s) {   // a rockfall on one side of the road ahead: shadows first (1.3 s), the other side left clear
  const L = demo.layout;
  for (let i = 0; i < 3; i++) { const y = player.y - 430 - i * 70, lanes = canyonLanes(L, y), cx = roadAt(L.road, y), ln = lanes.length > 1 ? lanes[s < 0 ? 0 : 1] : [s < 0 ? lanes[0][0] : cx + 30, s < 0 ? cx - 30 : lanes[0][1]];
    const x = ln[0] + 40 + rand(0, Math.max(0, ln[1] - ln[0] - 80)); rocksFalling.push({ x, y, t: -i * 0.18, T: 1.3, temp: true }); }
}
function encBarrageRow() {   // one row of the crossing: shells across the canyon ahead, warned 1.3 s, leaving one lane the biggest car fits
  const L = demo.layout, E = demo.enc, y = player.y - 400, cx = roadAt(L.road, y), lanes = canyonLanes(L, y), a = lanes[0][0], b = lanes[lanes.length - 1][1];
  const gapW = 220, dir = L.barrage.dir || (E.rowN % 2 ? 1 : -1), mid = (a + b) / 2, span = Math.max(0, (b - a) / 2 - gapW / 2 - 20);   // the gap drifts across the canyon, and bends with it
  E.gu = E.gx === null ? -(L.barrage.dir || 1) * 0.45 : clamp(E.gu + dir * 0.28, -0.75, 0.75); E.gx = 0;
  E.rowN = (E.rowN || 0) + 1; const gx = mid + E.gu * span; let left = -1e9, right = 1e9;
  for (let x = a + 40; x <= b - 40; x += 95) { if (Math.abs(x - gx) < gapW / 2 + 70) continue; bombs.push({ sx: (x < gx ? a : b) + (x < gx ? -300 : 300), sy: y - 500, tx: x, ty: y, t: 0, T: 1.3, shell: true, src: 'barrage' }); if (x < gx) left = Math.max(left, x); else right = Math.min(right, x); }
  SFX.whoosh(); return { T: 1.3, gx, rel: gx - mid, gap: Math.min(right, b) - Math.max(left, a) - 2 * 78 };
}

// ============ the arena ============
function encArena() {   // called instead of the campaign's boss trigger: seal the gate behind a car that's fully in, then the boss
  const L = demo.layout, A = L.arena; if (!A || stageBoss || boss || depot.bossDone) return;
  const d = Math.hypot(player.x - A.x, player.y - A.y);
  if (d > A.R + 400) return;
  if (draftBeforeBoss()) return;   // a pick still waiting comes first
  if (!A.sealed && d < A.R - 110 && player.y < A.gateY - 160) {   // the whole car is in, clear of the gateway
    A.sealed = true; depot.x = A.x; depot.y = A.y; for (const q of A.gate) { const ch = chunks.get(`${Math.floor(q.x / CH)},${Math.floor(q.y / CH)}`); if (ch) ch.rocks.push(q); if (L.field) canyonFieldAdd(L, q); else paintAt(q.x - q.r - 60, q.y - q.r - 60, q.x + q.r + 60, q.y + q.r + 60, g => paintMesa(g, q)); for (let i = 0; i < 8; i++) parts.push({ k: 'dust', x: q.x + crand(-50, 50), y: q.y + crand(-40, 40), vx: crand(-80, 80), vy: crand(-80, 80), t: 0, life: crand(0.6, 1.1), size: crand(16, 26) }); }
    if (L.field) for (const ch of chunks.values()) if (A.gate.some(q => q.x + q.r + 160 > ch.x && q.x - q.r - 160 < ch.x + CH && q.y + q.r + 160 > ch.y && q.y - q.r - 160 < ch.y + CH)) paintChunk(ch, seeded(hash2(ch.cx, ch.cy) ^ demo.seed));   // the canyon: the gate closes as part of the rock wall
    rebuildLists(); SFX.clang(); shake = Math.max(shake, 6 * (calmMotion ? 0.3 : 1));
    for (const k of cars) k.flee = true; incoming = [];
    const kind = demo.L.boss; stageBoss = { kind, t: 0 }; depot.open = false; SFX.horn(); music('stinger', 'boss');
    if (A.quarry) { const S = A.spots[1]; spawnBoss(S.x, S.y, kind); boss.pi = 1; } else spawnBoss(A.x, A.y - A.R + 150, kind);   // it comes out of the far side, facing you
    boss.a = Math.atan2(player.y - boss.y, player.x - boss.x); boss.vx = boss.vy = 0;
    showIntro(kind);
  }
}

// ============ drawing ============
function drawDemoMark(b, k) {   // a shell on its way: the whole blast area in red, a ring closing round it as time runs out
  const R = 78; ctx.save();
  ctx.fillStyle = `rgba(232,67,47,${0.16 + 0.22 * k})`; ctx.beginPath(); ctx.arc(b.tx, b.ty, R, 0, TAU); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#e8432f'; ctx.beginPath(); ctx.arc(b.tx, b.ty, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 7; ctx.strokeStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(b.tx, b.ty, R - 10, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.stroke();   // the time left
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.tx - 16, b.ty); ctx.lineTo(b.tx + 16, b.ty); ctx.moveTo(b.tx, b.ty - 16); ctx.lineTo(b.tx, b.ty + 16); ctx.stroke();
  ctx.restore();
}
function drawDemoWorld() {   // the cache and the arena's gate, on the ground layer
  const L = demo.layout, K = L.cache, A = L.arena;
  if (K && inView(K.x, K.y, 120)) {
    ctx.save(); ctx.translate(K.x, K.y);
    if (!K.taken) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(clock * 5); ctx.fillStyle = '#5be37d'; ctx.beginPath(); ctx.arc(0, 0, K.r + 14, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    inkRR(ctx, -26, -18, 52, 36, 5, K.taken ? PAL.gun : PAL.orange, { lw: 2.6 }); inkRR(ctx, -20, -26, 16, 10, 2, PAL.red, { lw: 1.6, double: false }); inkRR(ctx, 4, -26, 16, 10, 2, PAL.red, { lw: 1.6, double: false });
    ctx.fillStyle = INK; ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(K.taken ? 'EMPTY' : 'FUEL', 0, 8);
    ctx.restore();
  }
  if (A && inView(A.x, A.y, A.R + 200)) {   // the bowl's floor, darker toward the middle, and the gate marks
    ctx.save(); const g = ctx.createRadialGradient(A.x, A.y, 60, A.x, A.y, A.R + 30); g.addColorStop(0, 'rgba(120,70,40,.28)'); g.addColorStop(1, 'rgba(120,70,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(A.x, A.y, A.R + 30, 0, TAU); ctx.fill();
    if (!A.sealed) { ctx.strokeStyle = 'rgba(255,244,220,.6)'; ctx.lineWidth = 6; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.arc(A.x, A.y, A.R + 40, Math.PI / 2 - 0.2, Math.PI / 2 + 0.2); ctx.stroke(); }
    ctx.restore();
  }
}

// ============ development only: the collision overlay (?overlay=1, or Shift+O) ============
// Red: what cars collide with. Cyan: where the painted rock begins (the field's zero line). Yellow: your body as rock
// sees it. Orange: raiders. Green dots: the middle of each open lane.
let devOverlay = new URLSearchParams(location.search).get('overlay') === '1';
addEventListener('keydown', e => { if (e.key === 'O') devOverlay = !devOverlay; });
function drawDevOverlay() {
  const z = view.z, x0 = cam.x - VW / 2 / z - 40, x1 = cam.x + VW / 2 / z + 40, y0 = cam.y - VH / 2 / z - 40, y1 = cam.y + VH / 2 / z + 40, ring = (list, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w / z; ctx.beginPath(); for (const b of list) if (b.x + b.r > x0 && b.x - b.r < x1 && b.y + b.r > y0 && b.y - b.r < y1) { ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, TAU); } ctx.stroke(); };
  ctx.save(); ctx.globalAlpha = 1;
  ring(posts, 'rgba(255,40,40,.9)', 2); ctx.strokeStyle = 'rgba(255,40,40,.9)'; for (const W of walls) ctx.strokeRect(W.x, W.y, W.w, W.h);
  const L = demo && demo.layout;
  if (L && L.field) {
    ctx.strokeStyle = 'rgba(40,230,255,.95)'; ctx.lineWidth = 3 / z; ctx.lineCap = 'round'; msStroke(ctx, msLines(canyonField(L, x0, y0, x1, y1), 0));
    ctx.fillStyle = 'rgba(70,255,120,.9)'; for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) for (const [a, b] of canyonLanes(L, y)) { ctx.beginPath(); ctx.arc((a + b) / 2, y, 4 / z, 0, TAU); ctx.fill(); }
  }
  ring(demo ? carHull(player) : [player], 'rgba(255,220,40,.95)', 2.5); ring(cars.filter(k => !k.dead), 'rgba(255,150,40,.85)', 2);
  ctx.restore();
}
