'use strict';
// Fuel Run · fuel.js: what makes Fuel Run. Your tank drains; wrecked raiders spill fuel; every stage ends in a boss.
// The rules a player should be able to say back:
//   1. Fuel is life: it drains all the time, cans fill it, their hits leak it. Empty and the engine dies.
//   2. Every raider shows its hits left (pips). Your nose takes one, its side two, nitro three; your tail (drifting) two.
//   3. Their attacks are shown first (red line, red lane, red glow); landed on your side or back, they leak fuel.
//   4. A raider that slams into a wall, a rock or another raider while it hunts you is wrecked outright.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ the stages: ten on the road to the Road Fortress, each with its own idea, each ending in a boss ============
// area: the look (0 the Dust Flats, 1 the Rust Yards, 2 the Salt Wastes: the REGIONS palettes); set: the stage's idea on the road;
// boss + meet: who waits at the end, and whether it's the first or second time you meet it (the second brings one new move);
// chal: the stage's own star. len: the road in world units (about 90 s at speed); cap: the pack at the start and at the end
// of the road; types: who rides; segs: hits the boss takes; drain: fuel per second; hit: what every hit costs, times this
// (the late stages hit harder, so the armour and tank upgrades matter); tint: the stage's own shade of its area's ground.
const AREAS = ['THE DUST FLATS', 'THE RUST YARDS', 'THE SALT WASTES'];
const STAGES = [
  { name: 'THE DUST FLATS',    idea: 'RAM RAIDERS. STEAL THEIR FUEL.',        area: 0, set: 'open',   boss: 'bull',     meet: 1, segs: 3,
    chal: { id: 'side', text: 'Wreck 3 raiders with a side hit', need: 3 },        len: 26000, cap: [2, 4], types: { buggy: 1 }, drain: 0.8, hit: 1 },
  { name: 'THE CONVOY ROAD',   idea: 'FUEL TANKERS AHEAD. TAKE THEM DOWN.',  area: 0, set: 'convoy', boss: 'rig',      meet: 1, segs: 6,
    chal: { id: 'tanker', text: 'Wreck all 3 tankers', need: 3 },                   len: 27000, cap: [2, 5], types: { buggy: 3, polecat: 1 }, tint: ['#f3cf96', 0.18], drain: 0.85, hit: 1 },
  { name: 'CANYON PASS',       idea: 'ROCKS FALL WHERE THE SHADOWS GROW.',   area: 0, set: 'canyon', boss: 'bombard',  meet: 1, segs: 6,
    chal: { id: 'rock', text: 'Crush 4 raiders under rocks', need: 4 },             len: 28000, cap: [3, 6], types: { buggy: 3, polecat: 1, harpoon: 1 }, tint: ['#c8603c', 0.16], drain: 0.9, hit: 1 },
  { name: 'THE RUINED TOWN',   idea: 'TIGHT CORNERS. MAKE THEM HIT THE WALLS.', area: 1, set: 'town', boss: 'twin',     meet: 1, segs: 6,
    chal: { id: 'twincrash', text: 'Make the Twin-Horse crash twice', need: 2 },    len: 29000, cap: [3, 6], types: { buggy: 3, polecat: 2, ram: 1 }, tint: ['#9a8a80', 0.18], drain: 1.0, hit: 1 },
  { name: 'THE SCRAPYARD',     idea: 'THE WRECKING BALLS SWING BOTH WAYS.',  area: 1, set: 'scrap',  boss: 'bull',     meet: 2, segs: 5,
    chal: { id: 'ball', text: 'Let the balls smash 4 raiders', need: 4 },           len: 30000, cap: [3, 7], types: { buggy: 3, polecat: 2, ram: 1, harpoon: 1 }, drain: 0.95, hit: 1 },
  { name: 'THE OIL FIELD',     idea: 'THE GROUND GLOWS, THEN IT BLOWS.',     area: 1, set: 'oil',    boss: 'fortress', meet: 1, segs: 4,
    chal: { id: 'geyser', text: 'Burn 6 raiders on geysers', need: 6 },             len: 31000, cap: [3, 7], types: { buggy: 3, polecat: 2, ram: 2, harpoon: 1 }, tint: ['#4e382a', 0.16], drain: 0.95, hit: 1.05 },
  { name: 'THE DUNE SEA',      idea: 'HIT THE RIDGES. LAND ON THEM.',        area: 2, set: 'dunes',  boss: 'rig',      meet: 2, segs: 9,
    chal: { id: 'stomp', text: 'Land on 3 raiders', need: 3 },                      len: 32000, cap: [4, 8], types: { buggy: 3, polecat: 2, ram: 2, bomber: 1 }, tint: ['#f0cf8c', 0.18], drain: 1.1, hit: 1.3 },
  { name: 'THE WHITEOUT',      idea: 'KEEP MOVING. IT\'S RIGHT BEHIND YOU.', area: 2, set: 'storm',  boss: 'bombard',  meet: 2, segs: 9,
    chal: { id: 'storm', text: 'Never get caught by the storm', need: 1, never: true }, len: 33000, cap: [4, 8], types: { buggy: 2, polecat: 2, ram: 2, harpoon: 1, bomber: 1 }, tint: ['#f8f6f0', 0.28], drain: 1.15, hit: 1.4 },
  { name: 'THE BROKEN BRIDGE', idea: 'JUMP THE GAP. LET THEM FOLLOW.',       area: 2, set: 'bridge', boss: 'twin',     meet: 2, segs: 10,
    chal: { id: 'ravine', text: 'Send 3 raiders into the ravine', need: 3 },        len: 34000, cap: [4, 9], types: { buggy: 2, polecat: 2, ram: 2, harpoon: 2, bomber: 1 }, tint: ['#a6aec2', 0.18], drain: 1.2, hit: 1.5 },
  { name: 'THE FORTRESS ROAD', idea: 'EVERYTHING YOU\'VE LEARNED.',          area: 2, set: 'mix',    boss: 'fortress', meet: 2, segs: 9,
    chal: { id: 'plough', text: 'Never touch the Fortress\'s plough', need: 1, never: true }, len: 36000, cap: [5, 10], types: { buggy: 2, polecat: 2, ram: 3, harpoon: 2, bomber: 2 }, tint: ['#d88a68', 0.18], drain: 1.25, hit: 1.6 },
];
let stageIx = 0;
const STG = () => demoStage || STAGES[stageIx];   // a demo run plays its own copy of a stage
const mixHex = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
function tintStage() { const t = STG().tint; if (t) for (const key of ['sand', 'sand2', 'rock', 'rockTop']) PAL[key] = mixHex(PAL[key], t[0], t[1]); }   // after applyRegion: the stage's own shade
// how each boss is beaten: three lines on its intro card (the last one is the key), the second meeting's new move, and a
// short line for the boss bar (the name and the short line must fit in 40 characters on a phone)
const BOSS_CARD = {
  bull:     { name: 'THE BULL', lines: ['IT CHARGES IN A STRAIGHT LINE', 'DODGE SO IT HITS A ROCK', 'THEN RAM IT WHILE IT\'S DAZED'], short: 'RAM IT WHEN IT CRASHES',
              lines2: ['IT CHARGES TWICE', 'DODGE BOTH INTO THE ROCKS', 'THEN RAM IT WHILE IT\'S DAZED'], short2: 'IT CHARGES TWICE' },
  rig:      { name: 'THE WAR RIG', lines: ['A HEAVY TRUCK THAT RAMS FROM BEHIND', 'ITS NOSE IS ARMOURED', 'RAM ITS SIDES'], short: 'RAM ITS SIDES',
              lines2: ['TWO GUARDS RIDE ITS SIDES', 'WRECK ITS GUARDS', 'THEN RAM ITS SIDES'], short2: 'WRECK THE GUARDS FIRST' },
  bombard:  { name: 'THE BOMBARDIER', lines: ['IT THROWS FIREBOMBS, THEN RELOADS', 'STAY OUT OF THE RED CIRCLES', 'RAM IT · SAFEST WHILE IT RELOADS'], short: 'SAFEST WHILE IT RELOADS',
              lines2: ['ITS BOMBS MAKE A WALL', 'FIND THE GAP', 'RAM IT · SAFEST WHILE IT RELOADS'], short2: 'SAFEST WHILE IT RELOADS' },
  twin:     { name: 'THE TWIN-HORSE', lines: ['IT RIDES BESIDE YOU AND THROWS LANCES', 'WHEN IT FLASHES, PULL AWAY', 'RAM THE TANKS ON ITS BACK'], short: 'RAM ITS BACK TANKS',
              lines2: ['IT\'S FURIOUS: TWO LANCES AT ONCE', 'WHEN IT FLASHES, PULL AWAY', 'RAM THE TANKS ON ITS BACK'], short2: 'RAM ITS BACK TANKS' },
  fortress: { name: 'THE ROAD FORTRESS', lines: ['IT CAN\'T BE RAMMED · KNOCK OUT ITS GUNS', 'LIGHT THE DRUMS AS IT PASSES', 'THEN RAM ITS ENGINE'], short: 'BLOW UP ITS GUNS',
              lines2: ['IT DROPS RAIDERS AS IT GOES', 'LIGHT THE DRUMS AS IT PASSES', 'THEN RAM ITS ENGINE'], short2: 'BLOW UP ITS GUNS' },
};
const bossCard = (S = STG()) => { const C = BOSS_CARD[S.boss]; return S.meet === 2 ? { name: C.name, lines: C.lines2, short: C.short2 } : C; };

// ============ the stage card: the stage's name, its idea and its three stars, as you set off ============
let stageCardT = 0;
const STAR_GOALS = S => ['Clear the stage', S.chal.text, '60% fuel left when the boss falls'];
function showStageCard(i) {
  if (demo) { const L = demo.L; $('scNum').textContent = `DEMO · ROAD ${L.n} OF 2`; $('scName').textContent = L.name; $('scIdea').textContent = L.idea; $('scGoals').innerHTML = `<span class="goal">Beat ${L.bossName.toLowerCase()}</span>`; $('stageCard').hidden = false; stageCardT = 3.2; return; }
  const S = STAGES[i];
  $('scNum').textContent = `STAGE ${i + 1} · ${AREAS[S.area]}`; $('scName').textContent = S.name; $('scIdea').textContent = S.idea;
  $('scGoals').innerHTML = STAR_GOALS(S).map(g => `<span class="goal">${g}</span>`).join('');
  $('stageCard').hidden = false; stageCardT = 3.2;
}
function hideStageCard() { stageCardT = 0; $('stageCard').hidden = true; }
function updateStageCard(dt) { if (stageCardT <= 0) return; stageCardT -= dt; if (stageCardT <= 0 || introT > 0) hideStageCard(); }

const ARENA = 1500;   // this close to the fortress the boss comes out
const stageProgress = () => demo && demo.layout ? encProgress() : depot ? clamp(1 - Math.hypot(depot.x - player.x, depot.y - player.y) / depot.len, 0, 1) : 0;

// ============ fuel ============
let stageBoss = null, introT = 0, fuelLowT = 0, wrecks = 0, outCause = '';
function burnFuel(dt) {   // the tank drains while you drive; the boss intro holds it
  if (state !== 'play' || runHeld() || god || (runState && runState.outcome !== 'active') || (demo && demo.build && demo.build.fuelGrace > 0)) return;   // a card up, the stage already won, or a refuel's overflow: the drain waits
  changeFuel(-(demo && demo.layout && demo.layout.arena.sealed ? DEMO_ARENA_DRAIN : STG().drain) * (fast ? 0.5 : 1) * dt, 'drain');   // the demo's arena drains slower: the fight is about the boss
  if (player.hp < player.maxHp * 0.25) { fuelLowT -= dt; if (fuelLowT <= 0) { fuelLowT = 1.2; SFX.ping(); } tip('lowfuel', 'LOW FUEL · WRECK RAIDERS TO REFILL'); }
  if (player.hp <= 0) { player.hp = 0; outCause = 'OUT OF FUEL!'; if (runState) runState.lastLossSource = 'drain'; gameOver(); }   // gameOver locks the loss once
}
function gainFuel(n) {   // a can: what the tank really takes pops over you and the gauge fills; a full tank takes nothing and says nothing
  const got = changeFuel(n, 'can'); player.ghost = Math.max(player.ghost, player.hp);
  if (got >= 0.5) { pops.push({ x: player.x, y: player.y - 56, text: `+${Math.round(got)} FUEL`, col: '#5be37d', t: 0, small: 2 }); recordRunEvent('fuel_gain', { source: 'can', n: Math.round(got) }); $('hp').classList.remove('gain'); void $('hp').offsetWidth; $('hp').classList.add('gain'); }
  return got;
}
function leakFuel(n, x, y) {   // a hit that landed: the red number shows how much it cost
  pops.push({ x: player.x, y: player.y - 56, text: `-${Math.round(n)} FUEL`, col: '#ff5a46', t: 0, small: 2, hurt: 1 });   // drawn over every other word
}

// ============ the Whiteout: a storm that follows you down the road ============
// It stays close enough to see (never more than STORM_BACK behind), never swallows you deep, waits while the boss is out,
// and slows while you keep wrecking raiders. Inside it you can barely see and it drinks your fuel; raiders it catches are torn apart.
const stormOn = () => STG().set === 'storm', STORM_BACK = 600;
function updateStorm(dt) {
  if (!stormOn()) return;
  const fightOn = !!stageBoss || !!bullIn;   // from the boss's arrival to the end of the stage
  stormY = Math.min(stormY - SPEED * 0.88 * (fightOn ? 0 : time - lastTD < 4 ? 0.5 : 1) * dt, player.y + STORM_BACK);
  if (fightOn) stormY = Math.max(stormY, player.y + 1300);
  stormY = Math.max(stormY, player.y - 260);
  if (player.y > stormY + 60) {   // caught: the star for this stage is gone, the fuel drains (3 a second at most), the gang loses you
    chalFail('storm');
    player.stormT = (player.stormT || 0) - dt; if (player.stormT <= 0) { player.stormT = 0.25; hurt(Math.min(0.75, 0.4 + (player.y - stormY - 60) / 600), true, 'storm'); }
    for (const k of cars) if (!k.flee && Math.hypot(k.x - player.x, k.y - player.y) > 150) k.blindT = Math.max(k.blindT || 0, 0.6);
  }
  for (const k of cars) if (k.y > stormY + 60) {
    k.stormT = (k.stormT || 0) - dt; if (k.stormT <= 0) { k.stormT = 0.25; damage(k, 7, 'trick', undefined, undefined, undefined, true, { kind: 'storm', playerCaused: false, at: time }); }
    if (grand() < dt * 1.6) { const a = k.a + (grand() < 0.5 ? 1 : -1) * Math.PI / 2, f = rand(220, 380); k.vx += Math.cos(a) * f; k.vy += Math.sin(a) * f; spinHit(k, k.x - Math.cos(k.a) * 20, k.y - Math.sin(k.a) * 20, Math.cos(a) * f * k.m, Math.sin(a) * f * k.m, PIT_K); }   // gusts
  }
  updateStormFx(dt);
}

// ============ the War Rig's guards (second meeting): two pole-cats ride its flanks; a guarded side can't be hurt ============
// A guard that falls behind leaves its side open; a wrecked one is replaced GUARD_BACK seconds later, from off screen.
const GUARD_BACK = 15, GUARD_OFF = 84;
function rigFlank(R, side) { return [R.x - Math.sin(R.a) * side * GUARD_OFF + Math.cos(R.a) * 10, R.y + Math.cos(R.a) * side * GUARD_OFF + Math.sin(R.a) * 10]; }   // side -1 its left, 1 its right
function rigSideOpen(R, side) {
  const g = R.guards && R.guards[side < 0 ? 'l' : 'r']; if (!g || g.dead) return true;
  const [fx, fy] = rigFlank(R, side); return Math.hypot(g.x - fx, g.y - fy) > 160;
}
function updateRigGuards(dt) {
  if (STG().boss !== 'rig' || STG().meet !== 2) return;
  const R = cars.find(k => k.stageBoss && !k.dead);
  if (!R) { for (const k of cars) if (k.guard && !k.flee) k.flee = true; return; }
  if (!R.guards) { R.guards = { l: null, r: null }; R.guardT = { l: 0, r: 0 }; for (const s of [-1, 1]) { const [x, y] = rigFlank(R, s); landCar({ x, y, type: 'polecat', ahead: true, guardOf: R, guardSide: s }); } return; }   // they ride in with it
  for (const s of [-1, 1]) {
    const key = s < 0 ? 'l' : 'r', g = R.guards[key];
    if (g && !g.dead) continue;
    if (g) { R.guards[key] = null; R.guardT[key] = GUARD_BACK; }
    R.guardT[key] -= dt;
    if (R.guardT[key] <= 0) { const p = spawnPoint(); if (p) { incoming.push({ x: p[0], y: p[1], type: 'polecat', t: 1.5, guardOf: R, guardSide: s }); R.guardT[key] = 1e9; } }
  }
}

// ============ hits: pips ============
// Every raider's health is a row of pips over it; one pip is PIP points of damage, so the old damage sources still work.
// Only a wreck you caused spills fuel: your hit or tail whip in the last 3 s, a raider you knocked into another,
// an attack you dodged into a wall, a drum. Raiders that crash on their own just burn.
const WORD_KIND = { 'HIT': 'ram', 'SIDE HIT': 'ram', 'NITRO RAM': 'ability', 'TAIL WHIP': 'ability', 'FLATTENED!': 'ambient', 'KABOOM!': 'drum', 'KA-BOOM!': 'drum', 'ROCKFALL!': 'rock', 'SMASH!': 'ball', 'ERUPTED!': 'geyser', 'TOASTED!': 'fire', 'STOMPED!': 'stomp', 'INTO THE ABYSS!': 'ravine', 'PILE-UP!': 'raider', 'HEAD-ON!': 'raider', 'BULLSEYE!': 'wall', 'SHUNTED!': 'wall', 'SPUN OUT!': 'wall', 'SKIM!': 'wall', 'WIPEOUT!': 'wall', 'KRUNCH!': 'wall', 'SMASHED!': 'wall', 'BLAM!': 'ambient' };   // a word's kind, for callers that haven't resolved a cause; never the credit
const SIPHON = 2;   // fuel a boarder steals each second he rides
function pipsOf(k) { return Math.max(0, Math.ceil(k.hp / PIP - 0.001)); }
function clangOn(k, guarded) {   // a hit that doesn't count: the armour rings and says where to hit instead (a guarded side: once, as a tip)
  if ((k.clangT || 0) > time) return; k.clangT = time + 0.8; SFX.clang();
  if (guarded) { tip('guarded', 'GUARDED · WRECK THE GUARD FIRST'); for (let i = 0; i < 6; i++) parts.push({ k: 'spark', x: k.x + crand(-20, 20), y: k.y + crand(-20, 20), vx: crand(-200, 200), vy: crand(-200, 200), t: 0, life: 0.25 }); return; }
  pops.push({ x: k.x, y: k.y - 60, text: guarded ? 'GUARDED · WRECK THE GUARD' : k.type === 'rig' ? 'ARMOURED · HIT ITS SIDE' : 'CLANG!', col: '#dfe6ec', t: 0, small: 1 });
}
function hitRaider(k, n, word, fx, fy) {   // your hit: n pips (a boss loses at most two segments to one hit), a word that says why it counted
  if (k.stageBoss) { n = capBossSegments(n); freeze = Math.max(freeze, 0.05); SFX.takedown(); recordRunEvent('boss_hit', { kind: k.type, n }); }
  const kind = word === 'NITRO RAM' || word === 'TAIL WHIP' ? 'ability' : 'ram';
  blame(k); markPlayerCause(k, kind, CAUSE_WINDOW, word === 'SIDE HIT' ? 'side' : undefined); if (runState) runState.totals.rams++; recordRunEvent('ram_hit', { car: k.type, n, word });
  const before = pipsOf(k); if (player.boarders.length) throwBoarder();   // the jolt bucks him off
  damage(k, n * PIP, 'trick', word, fx, fy, true, { kind, playerCaused: true, at: time, detail: word === 'SIDE HIT' ? 'side' : undefined });
  if (!k.dead && pipsOf(k) < before) pops.push({ x: k.x, y: k.y - 40 * k.size, text: n > 1 ? `${word} x${n}` : word, col: n > 1 ? '#ffd23f' : '#fff', t: 0, small: 1 });
}

// ============ the end of the road: the boss ============
function stageEndCheck(dd) {   // called every tick: close enough to the fortress and the boss comes out
  if (demo && demo.layout) { encArena(); return; }   // a demo road ends in a walled arena (encounters.js)
  if (stageBoss || boss || bullIn || depot.bossDone || dd > ARENA) return;
  if (demo && draftBeforeBoss()) return;   // a pick still waiting is offered before the boss comes out
  const kind = STG().boss;
  stageBoss = { kind, t: 0 };
  for (const k of cars) k.flee = true; incoming = [];
  depot.open = false; SFX.horn(); music('stinger', 'boss');
  if (BOSS_KINDS[kind]) { bullIn = { kind, ang: (grand() < 0.5 ? -1 : 1) * rand(1.9, 2.4), t: 1.4 }; }
  else { const p = bossEntry((grand() < 0.5 ? -1 : 1) * rand(1.6, 2.2)); incoming.push({ x: p[0], y: p[1], type: kind, t: 1.4, stageBoss: true }); }
  showIntro(kind);
}
function showIntro(kind) {   // the card: who it is and how to beat it, while the game runs in slow motion
  const C = demo && demo.L.card ? { name: demo.L.bossName, lines: demo.L.card } : bossCard(); hideStageCard();
  $('introName').textContent = C.name;
  $('introLines').innerHTML = C.lines.map((l, i) => `<span${i === C.lines.length - 1 ? ' class="key"' : ''}>${l}</span>`).join('');
  $('intro').hidden = false; introT = 3.2; slowT = Math.max(slowT, 3.2);
  banner = null;
}
function updateIntro(dt) {
  if (introT <= 0) return;
  introT -= dt * 2.8;   // real seconds: update runs on slowed time during the intro
  if (introT <= 0) { $('intro').hidden = true; slowT = 0; }
}
function stageBossDown() {   // the boss is beaten: the haul flies in, then the stage is cleared
  if (!stageBoss || stageBoss.done || !lockRunWin()) return;
  stageBoss.done = true; stageBoss.left = runState.fuelAtWin; depot.bossDone = true; depot.open = true;   // stars count the fuel you had when it went down, not its loot
  depot.winT = time + 2.4;
}

// ============ the stage's challenge: its own star, counted as you play ============
// Each stage has one: a count to reach (wreck 3 tankers) or a "never" (never get caught by the storm) that fails for good.
const CHAL_LABEL = { side: 'SIDE-HIT WRECKS', tanker: 'TANKERS', rock: 'CRUSHED BY ROCKS', twincrash: 'TWIN-HORSE CRASHES', ball: 'SMASHED BY BALLS',
  geyser: 'BURNED ON GEYSERS', stomp: 'LANDED ON', storm: 'STAY OUT OF THE STORM', ravine: 'INTO THE RAVINE', plough: 'KEEP OFF ITS PLOUGH' };
let chal = { id: '', n: 0, need: 1, failed: false, never: false };
function chalReset() { const C = STG().chal; chal = { id: C.id, n: 0, need: C.need, failed: false, never: !!C.never }; $('chal').classList.remove('flash'); }
function chalAdd(id, n = 1) {   // one more toward the stage's count; reaching it chimes and flashes the line (no words)
  if (id !== chal.id || chal.never || chal.n >= chal.need || state !== 'play' || (runState && runState.outcome !== 'active')) return;
  chal.n = Math.min(chal.need, chal.n + n);
  if (chal.n >= chal.need) { SFX.level(); $('chal').classList.remove('flash'); void $('chal').offsetWidth; $('chal').classList.add('flash'); }
}
function chalFail(id) { if (id !== chal.id || !chal.never || chal.failed || state !== 'play' || (runState && runState.outcome !== 'active')) return; chal.failed = true; SFX.clang(); }   // a "never" broken: it greys out for the rest of the run
const chalOk = () => chal.never ? !chal.failed : chal.n >= chal.need;
const chalText = () => `★ ${CHAL_LABEL[chal.id]}${chal.never ? '' : ` ${chal.n}/${chal.need}`}`;

// ============ the three stars: clear the stage, its challenge, 60% fuel when the boss falls ============
const STAR = { CLEAR: 1, GOAL: 2, FUEL: 4 }, FUEL_STAR = 0.6;
const starCount = b => (b & 1) + (b >> 1 & 1) + (b >> 2 & 1);
function migrateStars(sv) {   // a v1 save counted stars by fuel left: one or more = cleared, three = 70% fuel, which beats the 60% star
  if (sv.starsV === 2) return;
  for (const k of Object.keys(sv.stars || {})) { const v = sv.stars[k]; sv.stars[k] = v >= 1 ? STAR.CLEAR | (v >= 3 ? STAR.FUEL : 0) : 0; }
  sv.starsV = 2;
}
save.stage = save.stage || 0; save.stars = save.stars || {}; migrateStars(save); writeSave();
const fuelLeft = () => runState && runState.fuelAtWin !== null ? runState.fuelAtWin : player.hp / player.maxHp;   // the fuel you had when the boss fell, once it has
function stageCleared() {   // the stars this run earned join the ones you had; gold for the clear and every star this run. Paid once.
  if (!runState || runState.payoutDone || runState.outcome === 'lost') return; runState.payoutDone = true; recordRunEvent('run_end', { outcome: 'won' });
  if (demo) { demoCleared(); return; }   // the demo pays nothing into the campaign
  const had = save.stars[stageIx] || 0, bits = STAR.CLEAR | (chalOk() ? STAR.GOAL : 0) | (fuelLeft() >= FUEL_STAR ? STAR.FUEL : 0);
  const bonus = 40 + 15 * stageIx + 30 * starCount(bits); gold += bonus;
  save.stars[stageIx] = had | bits; save.stage = Math.max(save.stage, Math.min(STAGES.length - 1, stageIx + 1));
  if (stageIx === STAGES.length - 1) save.flatsDone = true;
  state = 'cleared'; touches.clear(); SFX.level(); music('stinger', 'victory'); bankGold(); writeSave();
  results(true, bits, bits & ~had, bonus);
}
function totalStars() { return Object.values(save.stars).reduce((a, b) => a + starCount(b), 0); }
function bestLineText() { return `★ ${totalStars()} / ${STAGES.length * 3}`; }
function renderStageMap() {   // the road to the fortress: three areas, ten stops, stars under each, the next one pulsing, the rest locked
  const nodes = STAGES.map((S, i) => {
    const open = i <= save.stage, bits = save.stars[i] || 0, next = i === save.stage, x = i % 2 ? 'r' : 'l', C = bossCard(S);
    const head = i === 0 || STAGES[i - 1].area !== S.area ? `<div class="area ink">${AREAS[S.area]}</div>` : '';
    return `${head}<button class="stage ${x}${open ? '' : ' locked'}${next ? ' next' : ''}" data-i="${i}" ${open ? '' : 'disabled'}>
      <b>${i + 1}</b><span><em>${S.name}</em><small>${C.name}${S.meet === 2 ? ' · AGAIN' : ''}</small></span>
      <i>${[STAR.CLEAR, STAR.GOAL, STAR.FUEL].map(b => bits & b ? '★' : '<u>★</u>').join('')}</i></button>`;
  }).join('');
  $('mapList').innerHTML = `<div class="road">${nodes}</div>`;
  $('mapStars').textContent = bestLineText();
}
function openMap() { hideStageCard(); $('menu').hidden = true; $('over').hidden = true; $('garage').hidden = true; renderStageMap(); $('map').hidden = false; const n = $('mapList').querySelector('.next'); if (n) n.scrollIntoView({ block: 'center' }); }
$('mapList').addEventListener('click', e => { const b = e.target.closest('.stage'); if (!b || b.disabled) return; startStage(+b.dataset.i); });
$('mapBack').addEventListener('click', () => { $('map').hidden = true; $('menu').hidden = false; renderTitleCar(); renderChips(); });
renderChips();
