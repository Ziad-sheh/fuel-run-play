'use strict';
// Wasteland Drift · bounties.js: three standing challenges that pay gold, shown on the title screen.
// Progress carries across runs and is kept in the save; a finished bounty pays out on the spot and a new one takes
// its place. They point you at the game's best moments: drifting, jumps, gas stations, pincers, bosses, other cars.
// Classic scripts sharing one global scope, loaded in order by index.html.

const BOUNTY_KINDS = {
  wrecks:   { n: [25, 60, 120], gold: [70, 140, 260], say: n => `Take down ${n} gang cars` },
  whips:    { n: [3, 8, 15], gold: [60, 130, 240], say: n => `Take down ${n} cars with a drift whip` },
  fury:     { n: [3, 4, 5], gold: [60, 140, 260], say: n => `Reach Fury x${n}`, best: true },
  combo:    { n: [600, 1200, 2200], gold: [60, 130, 240], say: n => `Bank a ${n}-point drift combo`, best: true },
  air:      { n: [4, 10, 20], gold: [60, 120, 220], say: n => `Get air off ${n} ramps` },
  stations: { n: [1, 3, 6], gold: [60, 130, 240], say: n => `Blow up ${n} gas station${n > 1 ? 's' : ''}` },
  chain:    { n: [3, 4, 5], gold: [60, 140, 260], say: n => `Chain ${n} tricks in a row`, best: true },
  events:   { n: [2, 5, 10], gold: [70, 150, 280], say: n => `Beat ${n} road events (war parties, convoys...)` },
  boarders: { n: [2, 5, 10], gold: [50, 110, 200], say: n => `Shake off ${n} boarders` },
  fuel:     { n: [2, 5, 9], gold: [80, 160, 280], say: n => `Reach ${n} fuel stops` },
  boss:     { n: [1, 1, 1], gold: [150, 220, 320], say: (n, B) => `Beat ${BOSS_KINDS[B.boss].name}${B.car ? ' in the ' + CARS[B.car].name : ''}` },
  runGold:  { n: [150, 400, 800], gold: [60, 130, 240], say: n => `Earn ${n} gold in one run`, best: true },
};
save.bounties = (save.bounties || []).filter(B => BOUNTY_KINDS[B.kind]);   // retired kinds (pincers) make way for new ones
function newBounty(skip) {   // pick a kind not already showing; harder tiers as you go
  const have = new Set(save.bounties.map(B => B.kind).concat(skip || [])), kinds = Object.keys(BOUNTY_KINDS).filter(k => !have.has(k));
  const kind = pick(kinds), tier = Math.min(2, Math.floor((save.bountiesDone || 0) / 4) + (Math.random() < 0.3 ? 1 : 0)), K = BOUNTY_KINDS[kind];
  const B = { kind, tier, n: K.n[tier], gold: K.gold[tier], have: 0 };
  if (kind === 'boss') { const open = REGIONS.slice(0, save.unlocked).map(R => R.boss); B.boss = pick(open); if (Math.random() < 0.5) B.car = pick(CAR_ORDER.filter(c => save.owned[c])); }
  return B;
}
while (save.bounties.length < 3) save.bounties.push(newBounty());
let runBounty = 0;   // bounty gold paid during this run, for the results screen
function bountiesNewRun() { runBounty = 0; for (const B of save.bounties) delete B.fresh; }   // a bounty that came up mid-run starts counting now
function bounty(kind, amount = 1, extra) {   // something happened that a bounty might be counting
  if (FUEL_RUN) return;   // Fuel Run: no bounties (yet)
  let changed = false;
  for (const [i, B] of save.bounties.entries()) {
    if (B.kind !== kind || B.done || B.fresh) continue;   // a fresh one waits for the next run, so easy ones can't chain
    if (kind === 'boss' && (extra.boss !== B.boss || (B.car && extra.car !== B.car))) continue;
    B.have = BOUNTY_KINDS[kind].best ? Math.max(B.have, amount) : B.have + amount; changed = true;
    if (B.have >= B.n) {   // paid on the spot
      B.done = true; save.gold += B.gold; runBounty += B.gold; save.bountiesDone = (save.bountiesDone || 0) + 1;
      if (state === 'play' || state === 'cleared' || state === 'over') pops.push({ x: player.x, y: player.y - 80, text: `BOUNTY! +${B.gold} GOLD`, col: '#ffd23f', t: 0 });
      SFX.coin(); save.bounties[i] = Object.assign(newBounty([kind]), { fresh: true });
    }
  }
  if (changed) writeSave();
}
function renderBounties() {
  $('bounties').innerHTML = '<div class="label">BOUNTIES</div>' + save.bounties.map(B => {
    const K = BOUNTY_KINDS[B.kind], p = clamp(B.have / B.n, 0, 1);
    return `<div class="bty"><div><b>${K.say(B.n, B)}</b><i><em style="width:${Math.round(p * 100)}%"></em></i></div><span>+${B.gold}</span></div>`;
  }).join('');
}
renderBounties();
