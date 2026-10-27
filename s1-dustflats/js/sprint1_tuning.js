'use strict';
// Fuel Run · sprint1_tuning.js: EVERY key number for the Sprint 1 Dust Flats variants, in one place.
//   fuelrun/index.html?variant=road     mostly continuous road, escalating waves, The Bull in the closed final clearing
//   fuelrun/index.html?variant=hybrid   the same road and rules, plus short LOCKED clearings on the way
// Both share these rules; the layout is the only difference. Read by sprint1.js; nothing outside a ?variant= run uses it.
// Cheap URL overrides (all optional): &ramx= &drain= &gunfuel= &burst= &peak= &clearings= &winback= &roadlen= &bullsegs=
// Test switches: &bot=1 (autopilot) &speed=N (N updates a frame) &skill=0..1 (bot attention) &seed=N (layout seed)
// Classic scripts sharing one global scope, loaded in order by index.html.

const SPRINT1_TUNING = {
  // ---- the run: targets, for reading the metrics (nothing in play reads them) ----
  targets: { firstClearSecs: [300, 360], failedRunSecs: [150, 240], earlyDeathSecs: 90, bullAtSecs: [240, 270], ramSharePct: 40, peakOnScreen: [12, 18] },
  // ---- the road: its length per variant (world units; the car does ~385/s, x1.15 on the road). The hybrid's is shorter
  //      by about the time its clearings hold you, so The Bull comes at about the same minute in both ----
  road: { len: { road: 90000, hybrid: 70000 }, amp: [300, 420], wl: [3600, 4600], stopSpawnsAt: 0.965 },
  // ---- fuel ----
  fuel: {
    drain: 1.6,          // fuel a second, on the road and in the clearings (the tank is the car's: 100 for the Interceptor)
    drainEarly: [0.65, 60, 120],   // ...times this at the start, easing to the full drain between these run seconds (no deaths in the first 90 s)
    arenaDrain: 0.6,     // fuel a second once The Bull's clearing is sealed
    gunWreck: 1.5,         // what a wreck by the gun refills
    ramMult: 3,          // a ram wreck (your car did it: a ram, a shove into rock or another raider) refills gunWreck x this
    takedownBurst: 12,   // a takedown (ramming a CRACKED raider) refills this, times the chain bonus, instead of the ram refill
    typeK: { buggy: 1, polecat: 1, s1flank: 0.75, s1shield: 2, scrap: 0.25 },   // refill multiplier by raider type (scrap bikes are fodder)
    winBackSecs: 3,      // a wreck you cause within this many seconds of a hit...
    winBackFrac: 1,      // ...returns this share of what the hit leaked, on top of the normal refill
    flyerSecs: 0.55,     // how long the fuel blobs take to fly from the wreck to the car (the fuel is already in the tank)
  },
  // ---- crack then ram ----
  crack: {
    secs: 2.6,           // a gun hit leaves a raider CRACKED this long (each hit renews it)
    stagger: 0.45,       // and staggers it (stunned: slows, can't steer) this long...
    staggerCD: 1.1,      // ...at most once per this many seconds, so a gun can't hold one stunned forever
    gunDmgK: 1,          // gun damage multiplier (the gun can still wreck on its own)
  },
  chain: { window: 4, step: 0.35, max: 2.4 },   // takedowns within `window` s of the last chain: reward x (1 + step x (n-1)), capped at max
  // ---- the raiders: health in pips (one pip = one plain ram hit = 40 damage) ----
  enemy: {
    pips: { buggy: 3, polecat: 3, s1flank: 1, s1shield: 5, scrap: 1 },
    pileupPips: 1,       // two raiders you sent into each other (or that met while you had them marked) each lose this many pips
    flank: { speedK: 1.32, slotLat: [150, 210], dodgeR: 210, dodgeCD: 1.4, dodgeKick: 340 },   // flankers: fast side-runners; rams glance off them unless cracked, and they jink out of your nose's way
    shield: {},          // shield trucks: guns deflect; the first ram breaks the shield (and hurts); then they crack like anyone
  },
  // ---- the road's waves: from run second t, keep about n raiders on you (spawned off screen, a pack at a time).
  //      heat: how many may attack at once (1..3). mix: weights for who comes. cap: hard ceiling on the field. ----
  spawn: {
    gap: 0.55, bikePack: [2, 4], cap: 18,
    waves: [
      { t: 0,   n: 3,  heat: 1, mix: { buggy: 1 } },
      { t: 20,  n: 5,  heat: 1, mix: { buggy: 3, scrap: 2 } },
      { t: 45,  n: 7,  heat: 2, mix: { buggy: 3, scrap: 3, s1flank: 1 } },
      { t: 75,  n: 9,  heat: 2, mix: { buggy: 3, scrap: 3, s1flank: 1, s1shield: 1 } },
      { t: 110, n: 12, heat: 2, mix: { buggy: 3, polecat: 1, scrap: 4, s1flank: 2, s1shield: 1 } },
      { t: 150, n: 14, heat: 3, mix: { buggy: 3, polecat: 1, scrap: 5, s1flank: 2, s1shield: 1 } },
      { t: 185, n: 16, heat: 3, mix: { buggy: 3, polecat: 1, scrap: 6, s1flank: 2, s1shield: 2 } },
      { t: 215, n: 18, heat: 3, mix: { buggy: 3, polecat: 1, scrap: 7, s1flank: 3, s1shield: 2 } },
    ],
  },
  // ---- hybrid only: locked clearings on the road. at: where down the road (0..1); R: radius; gap: half the width of the
  //      road's way in and out (closed by wreck barricades while locked); rocks: rams-into-rock anchors inside.
  //      Each holds you until its wave is wrecked (maxSecs: then the rest flee and it opens anyway). ----
  clearings: {
    count: 2, at: [0.36, 0.7], R: 700, gap: 190, rocks: 5, lockDepth: 150, maxSecs: 75, wing: 2600,   // wing: rock walls running out to both sides, so it can't be driven round
    waves: [
      { total: 36, atOnce: 11, heat: 2, gap: 1.1, mix: { buggy: 4, scrap: 4, s1flank: 1, s1shield: 1 } },
      { total: 50, atOnce: 15, heat: 3, gap: 1.0, mix: { buggy: 4, polecat: 1, scrap: 5, s1flank: 2, s1shield: 2 } },
    ],
  },
  // ---- The Bull, in the closed final clearing (the same arena in both variants) ----
  bull: { segs: 15, ramRefill: 6 },   // its health in segments (a tank ram takes 2); what an accepted tank ram refills
  // ---- the car's fixed loadout for both variants (no weapon cards, so the comparison is the layout) ----
  loadout: { gun: 2 },
};

// ---- the cheap URL overrides ----
(() => {
  const q = new URLSearchParams(location.search), T = SPRINT1_TUNING, num = k => { const v = q.get(k); return v !== null && v !== '' && isFinite(+v) ? +v : null; };
  const set = (k, fn) => { const v = num(k); if (v !== null) { fn(v); (T.overrides = T.overrides || {})[k] = v; } };
  set('ramx', v => T.fuel.ramMult = v);
  set('drain', v => T.fuel.drain = v);
  set('gunfuel', v => T.fuel.gunWreck = v);
  set('burst', v => T.fuel.takedownBurst = v);
  set('winback', v => T.fuel.winBackFrac = v);
  set('peak', v => { T.spawn.cap = v; const top = T.spawn.waves[T.spawn.waves.length - 1].n; for (const w of T.spawn.waves) w.n = Math.round(w.n * v / top); });
  set('clearings', v => T.clearings.count = clamp(Math.round(v), 0, T.clearings.at.length));
  set('roadlen', v => { T.road.len.road = v; T.road.len.hybrid = Math.round(v * 70 / 90); });
  set('bullsegs', v => T.bull.segs = v);
})();
