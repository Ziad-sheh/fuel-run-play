'use strict';
// Fuel Run · sprint1_tuning.js: EVERY key number for the Sprint 1 Dust Flats variants, in one place.
//   fuelrun/index.html?variant=road     mostly continuous road, escalating waves, The Bull in the closed final clearing
//   fuelrun/index.html?variant=hybrid   the same road and rules, plus short LOCKED clearings on the way
// Both share these rules; the layout is the only difference. Read by sprint1.js; nothing outside a ?variant= run uses it.
// Cheap URL overrides (all optional): &ramx= &drain= &gunfuel= &burst= &peak= &clearings= &winback= &roadlen= &bullsegs=
// Tuning panel: &tune=1 (sprint1_tune.js; its saved values sit between these defaults and the URL overrides)
// Test switches: &bot=1 (autopilot) &speed=N (N updates a frame) &skill=0..1 (bot attention) &seed=N (layout seed)
// Classic scripts sharing one global scope, loaded in order by index.html.

const SPRINT1_TUNING = {
  // ---- the run: targets, for reading the metrics (nothing in play reads them) ----
  targets: { firstClearSecs: [300, 360], failedRunSecs: [150, 240], earlyDeathSecs: 90, bullAtSecs: [240, 270], ramSharePct: 40, peakOnScreen: [12, 18] },
  // ---- the road: its length per variant (world units; the car does ~385/s, x1.15 on the road). The hybrid's is shorter
  //      by about the time its clearings hold you, so The Bull comes at about the same minute in both ----
  road: { len: { road: 75000, hybrid: 56000 }, amp: [300, 420], wl: [3600, 4600] },
  // ---- fuel ----
  fuel: {
    drain: 1.0,          // fuel a second, the same all run: road, clearings and The Bull's arena (the tank is the car's: 100 for the
                         // Interceptor, so 100 s with no wrecks at all: nobody runs dry in the first 90 s)
    earlyHit: { secs: 90, k: 0.5 },   // for the first `secs` of a run, a raider's hit leaks this share of its usual fuel
    gunWreck: 0.35,      // what a wreck by the gun refills
    ramMult: 3,          // a ram wreck (your car did it: a ram, a shove into rock or another raider) refills gunWreck x this
    takedownBurst: 3.5,   // a takedown (ramming a CRACKED raider) refills this, times the chain bonus, instead of the ram refill
    crashK: 0.5,         // a crash you started (into rock, a wall, a drum or another raider) refills this share of a direct ram or gun wreck
    typeK: { buggy: 1, polecat: 1, s1flank: 0.75, s1shield: 2.5, scrap: 0.2 },   // refill multiplier by raider type (scrap bikes are fodder)
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
    shield: {},          // shield trucks: guns always deflect, all their life; rams (and crashes a ram started) are the only way to hurt them
  },
  // ---- the road's waves: from run second t, keep about n raiders IN VIEW (centre inside the 390x844 screen), spawned just
  //      off the top and the sides so they come on screen; one left behind out of sight for recycleSecs comes round again
  //      ahead. Spawning runs until The Bull's gate. heat: how many may attack at once (1..3). mix: who comes.
  //      cap: most raiders alive at once, on screen or not. from: where road spawns come from (weights). ----
  spawn: {
    gap: 0.3, warn: 0.8, bikePack: [2, 4], cap: 28, recycleSecs: 1.2, from: { ahead: 4, L: 2, R: 2, behind: 1 },
    waves: [
      { t: 0,   n: 3,  heat: 1, mix: { buggy: 1 } },
      { t: 20,  n: 6,  heat: 1, mix: { buggy: 3, scrap: 2 } },
      { t: 45,  n: 9,  heat: 2, mix: { buggy: 3, scrap: 3, s1flank: 1 } },
      { t: 75,  n: 12, heat: 2, mix: { buggy: 3, scrap: 3, s1flank: 1, s1shield: 1 } },
      { t: 100, n: 15, heat: 2, mix: { buggy: 3, polecat: 1, scrap: 4, s1flank: 2, s1shield: 1 } },
      { t: 130, n: 17, heat: 3, mix: { buggy: 3, polecat: 1, scrap: 5, s1flank: 2, s1shield: 1 } },
      { t: 160, n: 18, heat: 3, mix: { buggy: 3, polecat: 1, scrap: 6, s1flank: 2, s1shield: 2 } },
      { t: 200, n: 18, heat: 3, mix: { buggy: 3, polecat: 1, scrap: 7, s1flank: 3, s1shield: 2 } },
    ],
  },
  // ---- hybrid only: locked clearings on the road. at: where down the road (0..1); R: radius; gap: half the width of the
  //      road's way in and out (closed by wreck barricades while locked); rocks: rams-into-rock anchors inside;
  //      lockDepth: how far inside its edge the car must be for it to lock.
  //      A wave keeps the clearing topped up to atOnce raiders (one spawn every `gap` s) for spawnSecs, then sends no more;
  //      wreck what's left and it opens: never before minSecs, at most maxSecs (then the rest flee and it opens anyway).
  //      atOnce counts raiders IN VIEW; aliveK x atOnce caps everything alive or landing. ----
  clearings: {
    count: 2, at: [0.36, 0.7], R: 700, gap: 190, rocks: 5, lockDepth: 80, minSecs: 30, maxSecs: 60, aliveK: 1.6, wing: 4200,   // wing: rock walls running out to both sides, so it can't be driven round
    waves: [
      { spawnSecs: 26, atOnce: 15, heat: 2, gap: 0.3, mix: { buggy: 4, scrap: 4, s1flank: 1, s1shield: 1 } },
      { spawnSecs: 32, atOnce: 18, heat: 3, gap: 0.25, mix: { buggy: 4, polecat: 1, scrap: 5, s1flank: 2, s1shield: 2 } },
    ],
  },
  // ---- The Bull, in the closed final clearing (the same arena in both variants) ----
  bull: { segs: 15, ramRefill: 6 },   // its health in segments (a tank ram takes 2); what an accepted tank ram refills
  // ---- the car's fixed loadout for both variants (no weapon cards, so the comparison is the layout) ----
  loadout: { gun: 2 },
};

// ---- the tuning panel's saved values (?tune=1, sprint1_tune.js), then the cheap URL overrides on top ----
if (typeof s1TuneRestore === 'function') s1TuneRestore(SPRINT1_TUNING);
(() => {
  const q = new URLSearchParams(location.search), T = SPRINT1_TUNING, num = k => { const v = q.get(k); return v !== null && v !== '' && isFinite(+v) ? +v : null; };
  const set = (k, fn) => { const v = num(k); if (v !== null) { fn(v); (T.overrides = T.overrides || {})[k] = v; } };
  set('ramx', v => T.fuel.ramMult = v);
  set('drain', v => T.fuel.drain = v);
  set('gunfuel', v => T.fuel.gunWreck = v);
  set('burst', v => T.fuel.takedownBurst = v);
  set('winback', v => T.fuel.winBackFrac = v);
  set('peak', v => { T.spawn.cap = Math.max(T.spawn.cap, v + 8); const top = T.spawn.waves[T.spawn.waves.length - 1].n; for (const w of T.spawn.waves) w.n = Math.round(w.n * v / top); });
  set('clearings', v => T.clearings.count = clamp(Math.round(v), 0, T.clearings.at.length));
  set('roadlen', v => { T.road.len.road = v; T.road.len.hybrid = Math.round(v * 56 / 75); });
  set('bullsegs', v => T.bull.segs = v);
})();
