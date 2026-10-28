'use strict';
// Fuel Run · demo.js: the two-stage demo. Two separate short runs, each picked from its own menu:
//   Dust Flats → The Bull (the campaign's stage 1 look), Red Canyon → The Bombardier (stage 3's look).
// A demo run is walled off from the campaign: the car is loaned and stock (no tank/armour/engine/nitro upgrades, no
// armoury), the campaign save is never written while the demo is open (only the player's settings are), and leaving
// the demo puts the save back exactly as it was. Each run has a seed: its layout and its weapon draft draw from two
// streams made from it, apart from the moment-to-moment randomness, so a seed replays the same road and offers.
// Classic scripts sharing one global scope, loaded in order by index.html.

const DEMO_REACH = 230, DEMO_CAN_LIFE = 14, DEMO_ARENA_DRAIN = 0.55, DEMO_BOSS_CAN = 12;   // ... the drain once the arena's sealed, the can a boss spills at its first two openings   // a demo can: how close it comes to you on its own, how long it lies there
const DEMO_KEY = 'fr_demo_v1';   // the demo's own little record (car choice, best results), apart from the campaign save
const DEMO_SETTINGS = ['music', 'lowfx', 'tips'];   // save fields that are the player's settings: a change in the demo is kept
const DEMO_LEVELS = {
  flats:  { id: 'flats',  stage: 0, n: 1, segs: 15, boss: 'bull', card: ['IT CHARGES IN A STRAIGHT LINE', 'DODGE SO IT HITS A ROCK', 'THEN HIT THE TANK ON ITS BACK'], name: 'DUST FLATS', bossName: 'THE BULL',       idea: 'OPEN GROUND · BAIT ITS CHARGE INTO ROCK', other: 'canyon' },
  canyon: { id: 'canyon', stage: 2, n: 2, segs: 13, boss: 'bomber2', card: ['IT SHELLS THE RED CIRCLES', 'GET OUT OF THEM, THEN GET CLOSE', 'HIT ITS MAGAZINE WHILE IT RELOADS'], name: 'RED CANYON', bossName: 'THE BOMBARDIER', idea: 'NARROW LANES · MOVE ON TIME',            other: 'flats' },
};
let demoDebug = null, demoCar = 'interceptor', demoPrefs = { v: 1, car: 'interceptor', best: {} };

// ============ the demo's own record ============
function demoLoadPrefs() {
  try { const p = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); if (p && p.v === 1 && typeof p === 'object') demoPrefs = { v: 1, car: p.car, best: p.best && typeof p.best === 'object' ? p.best : {}, played: p.played && typeof p.played === 'object' ? p.played : {} }; } catch (e) {}
  if (!CARS[demoPrefs.car]) demoPrefs.car = 'interceptor';
  demoCar = demoPrefs.car;
}
function demoSavePrefs() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoPrefs)); } catch (e) {} }

// ============ isolation: the campaign save is put aside while the demo is open ============
let demoKeptStage = null;   // the campaign stage the title was on when the demo opened
function demoIsolate() { if (!demoSnap) { demoSnap = JSON.stringify(save); demoKeptStage = stageIx; } }
function demoRestoreSave() {   // the campaign save as it was when the demo opened, with the settings the player has now
  if (!demoSnap) return;
  const keep = {}; for (const k of DEMO_SETTINGS) keep[k] = save[k];
  const s = JSON.parse(demoSnap); for (const k of Object.keys(save)) delete save[k]; Object.assign(save, s);
  for (const k of DEMO_SETTINGS) if (keep[k] === undefined) delete save[k]; else save[k] = keep[k];
}
function demoWriteSettings() {   // writeSave during the demo: only the settings reach the stored save
  let stored = null; try { stored = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  if (!stored || typeof stored !== 'object') { try { stored = JSON.parse(demoSnap); } catch (e) { return; } }
  for (const k of DEMO_SETTINGS) if (save[k] === undefined) delete stored[k]; else stored[k] = save[k];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(stored)); } catch (e) {}
  try { const s = JSON.parse(demoSnap); for (const k of DEMO_SETTINGS) if (save[k] === undefined) delete s[k]; else s[k] = save[k]; demoSnap = JSON.stringify(s); } catch (e) {}
}
function demoLoans() {   // the car you picked, stock: no permanent upgrades and nothing from the armoury
  save.car = demoCar; save.mods = {}; save.armoury = { lv: {}, equip: {} };
}

// ============ runs ============
function demoNewSeed() { try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; } catch (e) { return Math.floor(Math.random() * 4294967296) >>> 0; } }
function demoStart(level, seed) {   // a fresh run of one level: new seed, stock loaned car, nothing carried over
  const L = DEMO_LEVELS[level]; if (!L) return;
  demoIsolate(); demoRestoreSave(); demoLoans();
  if (!demoDebug) demoDebug = { god, fast };
  god = false; fast = false;
  seed = seed === undefined ? demoNewSeed() : seed >>> 0;
  gameRng = L.proto ? seeded((seed ^ 0x3C6EF372) >>> 0) : null;   // a lab run draws its gameplay randomness from its seed; the demo's stages keep Math.random
  demo = { layout: null, level, L, seed, rLayout: seeded(seed ^ 0x1A7E0F3), rDraft: seeded(seed ^ 0x5EED5EED), variant: 0, car: demoCar, runNo: (demo ? demo.runNo : 0) + 1 };
  demo.variant = Math.floor(demo.rLayout() * 3);   // which of the level's three arrangements this run gets
  demo.build = draftNewBuild(); demo.eq = eqNew(); demo.graceT = 0;
  demoStage = Object.assign({}, STAGES[L.stage], { demo: true, segs: L.segs, drain: 0.8, chal: { id: 'demo', text: '', need: 1e9 } });
  stageIx = L.stage;
  for (const id of ['demoMenu', 'demoOver']) $(id).hidden = true;
  start(); document.body.classList.add('demo'); $('load').hidden = false; renderUps(); hideStageCard(); updateHUD();
  camF.x = player.x; camF.y = player.y; camF.w = 0; cam.threat = null; cam.cw = 0; camSafeC.t = -9; view.z = ZOOM;   // the camera starts clean: no lean toward the last boss, no raider from the last run (spawns and on-screen checks follow it, so a retry plays the same)
  hintT = (demoPrefs.played || {})[level] ? 0 : 7; demoPrefs.played = Object.assign({}, demoPrefs.played, { [level]: 1 }); demoSavePrefs();   // the first run of each road: how to steer, what your weapons do   // the road's card waits for the first pick; the HUD shows this run, not the last
  if (L.proto) protoBegin(); else draftOpen(true);   // the run starts with your first weapon (a lab run: its fixed loadout)
}
function demoTick(dt) {   // every tick of a demo run: the grace after a pick, the refuel's held drain, the attachments, the next pick
  demo.graceT = Math.max(0, demo.graceT - dt); demo.build.fuelGrace = Math.max(0, demo.build.fuelGrace - dt);
  eqUpdate(dt); draftTick();
}
function demoRetry() { if (demo) demoStart(demo.level); }   // a new seed, a new build, the same level and car
function demoCleared() {   // the boss is down: the result, once (stageCleared settles it)
  state = 'cleared'; touches.clear(); SFX.level(); music('stinger', 'victory');
  if (demo.L.proto) { demoResults(true); return; }
  const b = demoPrefs.best[demo.level] || {}; demoPrefs.best[demo.level] = { won: (b.won || 0) + 1, best: Math.min(b.best || 1e9, Math.round(time)) }; demoSavePrefs();
  demoResults(true);
}
function demoResults(won) {
  if (demo.L.proto) { protoResults(won); return; }
  $('dReport').hidden = true;
  banner = null; $('hud').hidden = true;
  const L = demo.L, T = runState ? runState.totals : { gain: {}, loss: {} };
  $('dOverTitle').textContent = won ? `${L.name} CLEARED!` : outCause || 'WRECKED!';
  $('dOverTitle').style.color = won ? '#5be37d' : '#e8432f';
  const rows = [['Time', fmt(time)], [won ? 'Fuel left' : 'Got to', won ? `${Math.floor(fuelLeft() * 100)}%` : stageBoss ? L.bossName : `${Math.round(stageProgress() * 100)}% of the road`], ['Raiders wrecked', wrecks]];
  const B = demo.build; rows.push(['Your build', `<b class="dbuild">${B.order.map(id => `<i>${eqIcon(id)}<u>${'●'.repeat(B.items[id])}</u></i>`).join('') || '—'}</b>`]);   // what you built, with its ranks
  $('dStats').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  $('dLine').textContent = won ? 'Try the other road, or this one with a different build.' : lossAdvice(T, runState && runState.lastLossSource, stageBoss ? stageBoss.kind : null);
  $('dOther').textContent = `${DEMO_LEVELS[L.other].name} ▶`;
  if (typeof showBuildId === 'function') showBuildId();
  $('demoOver').hidden = false;
}
function demoReport() {   // the run in numbers, for tests and the evidence record
  const T = runState ? runState.totals : { gain: {}, loss: {} };
  return { seed: demo && demo.seed, level: demo && demo.level, variant: demo && demo.variant, car: player && player.car, time: Math.round(time * 10) / 10, outcome: runState && runState.outcome,
    fuel: { gain: T.gain, loss: T.loss }, credited: T.credited, ambient: T.ambient, wrecks, build: demo && demo.build ? Object.assign({}, demo.build.items) : {}, picks: demo && demo.build ? demo.build.picks.slice() : [], salvage: demo && demo.build ? demo.build.salvage : 0 };
}

// ============ the menu ============
function demoOpen() {   // the demo's own menu: two roads and a car; the campaign save is set aside from here until you leave
  demoLoadPrefs(); demoIsolate(); demoRestoreSave();
  state = 'menu'; demo = null; demoStage = null; gameRng = null; stageIx = DEMO_LEVELS.flats.stage; newGame();   // a fresh backdrop, always the same one: the run you left (its boss, shells, arena) doesn't carry on behind the menu
  for (const id of ['menu', 'map', 'garage', 'over', 'pick', 'pause', 'hud', 'demoOver', 'intro']) $(id).hidden = true;
  hideStageCard(); clearTips();
  renderDemoMenu(); $('demoMenu').hidden = false;
}
function demoExit() {   // back to the campaign: its save exactly as it was (plus any settings changed), the developer switches back
  document.body.classList.remove('demo');
  demoRestoreSave(); demoSnap = null; demo = null; demoStage = null; gameRng = null;
  if (demoKeptStage !== null) { stageIx = demoKeptStage; demoKeptStage = null; }   // the campaign's own stage, not the one the demo borrowed
  if (demoDebug) { god = demoDebug.god; fast = demoDebug.fast; demoDebug = null; }
  for (const id of ['demoMenu', 'demoOver', 'pause', 'pick', 'hud', 'over', 'intro', 'load']) $(id).hidden = true; $('pickReroll').hidden = true;
  hideStageCard(); clearTips();
  state = 'menu'; newGame(); $('menu').hidden = false; renderTitleCar(); renderChips();
}
function demoSetCar(id) { if (!CARS[id]) return; demoCar = demoPrefs.car = id; demoSavePrefs(); if (!$('demoMenu').hidden) renderDemoMenu(); }
function renderDemoMenu() {
  $('dLevels').innerHTML = Object.values(DEMO_LEVELS).filter(L => !L.proto).map(L => {
    const b = demoPrefs.best[L.id];
    return `<button class="dlevel" data-level="${L.id}"><b>${L.n}</b><span><em>${L.name}</em><small>${L.bossName}</small><i>${L.idea}</i></span><u>${b && b.won ? `CLEARED ${b.won}× · BEST ${fmt(b.best)}` : 'NOT CLEARED'}</u></button>`;
  }).join('');
  $('dCarName').textContent = CARS[demoCar].name.toUpperCase();
  if (typeof renderLabMenu === 'function') renderLabMenu();
  if (typeof showBuildId === 'function') showBuildId();
}
$('dLevels').addEventListener('click', e => { const b = e.target.closest('.dlevel'); if (b) { audio(); demoStart(b.dataset.level); } });
$('dCarPrev').addEventListener('click', () => demoSetCar(CAR_ORDER[(CAR_ORDER.indexOf(demoCar) + CAR_ORDER.length - 1) % CAR_ORDER.length]));
$('dCarNext').addEventListener('click', () => demoSetCar(CAR_ORDER[(CAR_ORDER.indexOf(demoCar) + 1) % CAR_ORDER.length]));
$('dCampaign').addEventListener('click', demoExit);
$('demoBtn').addEventListener('click', () => { audio(); demoOpen(); });
$('dRetry').addEventListener('click', demoRetry);
$('dOther').addEventListener('click', () => { if (demo) demoStart(demo.L.other); });
$('dMenu').addEventListener('click', demoOpen);
demoLoadPrefs();
