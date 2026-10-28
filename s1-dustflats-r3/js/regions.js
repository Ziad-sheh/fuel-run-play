'use strict';
// Fuel Run · regions.js: the regions' look, the stage's road length and who rides it. (The stage map is in fuel.js.)
// Classic scripts sharing one global scope, loaded in order by index.html.

const REGIONS = [
  { id: 'flats', name: 'THE DUST FLATS', blurb: 'Open desert and a broken highway. The Bull guards the fortress.', boss: 'bull',
    pal: { sand: '#e8b673', sand2: '#d69858', rock: '#a8603a', rockTop: '#cf905c', storm1: '#c78a52', storm2: '#8e5a36' }, turf: '#c98d55', stormBody: '#a56d41',
    canyon: 0.16, pocket: 0.6, oil: 0.1, pockets: ['gates', 'gates', 'utrap', 'utrap', 'alley', 'runway', 'runway', 'wrecker', 'boxes'],
    gang: { buggy: 6, ram: 2, harpoon: 1, bomber: 1, polecat: 1 }, early: 1, legs: [16000, 18000, 20000] },
  { id: 'yards', name: 'THE RUST YARDS', blurb: 'Scrap heaps, cranes and oil. The Twin-Horse rides with its lancers.', boss: 'twin',
    pal: { sand: '#c98a60', sand2: '#a76b47', rock: '#7a4a38', rockTop: '#a06850', storm1: '#a86a4a', storm2: '#5e3524' }, turf: '#9c5e3c', stormBody: '#7a4a32',
    canyon: 0.05, pocket: 0.78, oil: 0.35, pockets: ['wrecker', 'wrecker', 'alley', 'alley', 'boxes', 'boxes', 'utrap', 'runway', 'gates'],
    gang: { buggy: 3, ram: 4, harpoon: 2, bomber: 1, polecat: 2 }, early: 0.7, legs: [17000, 19000, 21000] },
  { id: 'salt', name: 'THE SALT WASTES', blurb: 'Blinding salt and white ridges. The Road Fortress rolls on.', boss: 'fortress',
    pal: { sand: '#eadcc2', sand2: '#d3c0a0', rock: '#c2ae8e', rockTop: '#f2e8d6', storm1: '#e2d4bc', storm2: '#a8977c' }, turf: '#cdb895', stormBody: '#c2b298',
    canyon: 0.26, pocket: 0.35, oil: 0.05, pockets: ['gates', 'runway', 'runway', 'utrap', 'alley'],
    gang: { buggy: 4, ram: 2, harpoon: 2, bomber: 3, polecat: 2 }, early: 0.5, legs: [18000, 20000, 22000] },
];
let region = 0;
const REG = () => REGIONS[region];
const regionBoss = () => REG().boss;
save.unlocked = Math.max(1, Math.min(REGIONS.length, save.unlocked || 1)); save.cleared = save.cleared || {}; save.region = clamp(save.region || 0, 0, save.unlocked - 1);
function applyRegion() {   // repaint the world in this region's colours
  Object.assign(PAL, REG().pal);
  spriteCache.delete('storm0'); spriteCache.delete('storm1');
}
const legLen = () => STG().len * (fast ? 0.4 : 1);   // a stage is one road to the boss's fortress
const legBoss = () => STG().boss;

// the gang mix: each region leans on different cars, and the later regions bring the heavy ones in sooner
function pickType() {   // the stage decides who rides: a weighted pick, with at most two ram trucks and one of each ranged car at once
  const W = STG().types, n = k => cars.filter(c => c.type === k).length + incoming.filter(I => I.type === k).length, o = [];
  for (const [k, w] of Object.entries(W)) if (k === 'buggy' || k === 'polecat' || n(k) < (k === 'ram' ? 2 : 1)) for (let i = 0; i < w; i++) o.push(k);
  return pick(o.length ? o : ['buggy']);
}
// ============ the leg's guardian ============
// Each fuel stop has one: the War Rig on the first, the Bombardier on the second. It waits at the gate as part of the
// ambush, unless you reach five stars first: then it comes out on the road to hunt you. Beat it and the gate's yours.
const legGuard = () => null;   // no guardians on the road: the War Rig and the Bombardier are stage bosses now
function spawnGuardian(ambush) {
  if (!depot || depot.guardOut || depot.guardDone || !legGuard()) return;
  const p = spawnPoint(); if (!p) return;
  depot.guardOut = true; incoming.push({ x: p[0], y: p[1], type: legGuard(), t: 1.2, ambush: !!ambush });
  if (legGuard() === 'bombard') for (let i = 0; i < 2; i++) { const q = spawnPoint(); if (q) incoming.push({ x: q[0], y: q[1], type: 'polecat', t: 1.4 + i * 0.3, ambush: !!ambush }); }   // its escort
}
function announceGuardian(k) {   // the big entrance: its name, how to beat it, the horn, and a beat of slow-mo (a stage boss has its intro card instead)
  if (k.stageBoss) return;
  banner = { text: k.T.name + '!', sub: k.T.how, t: 0 }; SFX.horn(); slowT = Math.max(slowT, 0.4); music('stinger', 'boss');
}
function guardianDown(k) {   // a stage boss down: the haul flies in, then the stage is cleared
  bigMoment(k.x, k.y, k.T.name + ' DOWN!', 1.4, 1.1); SFX.horn(); boom(k.x, k.y, null, 1.4);
  for (let i = 0; i < 30; i++) dropGem(k.x, k.y, 0, 2.2); for (let i = 0; i < 3; i++) dropGem(k.x, k.y, -15, 1.6);
  for (const g of gems) g.boss = true;
  if (k.stageBoss) stageBossDown();
}
function maxHeat() {}   // (Wasteland Drift's five-star boss call; Fuel Run's boss waits at the end of the road)

// ============ the ambush at a fuel stop ============
function updateAmbush(dt, dd) {
  const D = depot;
  if (!D.ambush) {
    if (D.bossDone || dd > Math.min(3000, turfR() * 0.6)) return;
    const n = 5 + 2 * ((leg - 1) % 3) + 2 * region + Math.floor((leg - 1) / 3) * 2;
    D.ambush = { n }; D.open = false; banner = { text: 'AMBUSH!', t: 0 }; SFX.horn();
    incoming = incoming.filter(I => I.ambush);
    for (let i = 0; i < n; i++) { const p = spawnPoint(); if (!p) continue; incoming.push({ x: p[0], y: p[1], type: i % 4 === 3 ? pick(['ram', 'harpoon', 'bomber']) : pickType(), t: 0.8 + i * 0.3, ambush: true }); }
    return;
  }
  if (D.bossDone) return;
  const left = cars.filter(k => k.ambush && !k.dead).length + incoming.filter(I => I.ambush).length;
  D.ambush.left = left;
  if (left === 0) { D.open = true; D.bossDone = true; banner = { text: 'THE GATE IS OPEN!', t: 0 }; SFX.level(); }
}
const ambushOn = () => false;   // no ambushes in Fuel Run

// (the stage map lives in fuel.js)
