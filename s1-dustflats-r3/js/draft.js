'use strict';
// Fuel Run · draft.js: the demo's build. You start with one of three offensive attachments, earn salvage from wrecks you
// cause, and every so often pick one of three cards: a new attachment (three slots, never a fourth) or the next rank of
// one you have (rank 3 at most). The rules, which the offer always keeps:
//   while a slot is free, an offer holds an upgrade to something you have and a new attachment, whenever either exists;
//   with three fitted, only upgrades; with fewer than three weapon cards left, Refuel and Nitro Service fill in;
//   once all three are rank 3 there are no more screens. Nine choices a run at most. One free reroll a run.
// Offers are drawn uniformly from every legal offer with the run's own draft stream, so a seed replays the same offers
// and nothing drawn for effects or physics can change them. The picker holds the whole game while it's open.
// Classic scripts sharing one global scope, loaded in order by index.html.

const ATTACH_IDS = ['forks', 'saws', 'gun', 'cannon', 'flame', 'oil', 'shield'];
const ATTACH = {   // offense: may open a run. trig: how it fires (no button: it's all in how you drive). say: what each rank does
  forks:  { name: 'Front Forks',   offense: true,  icon: 'ram',    trig: 'RAM',             say: ['Nose rams take an extra pip and shove harder', 'Heavier shove, a wider nose', 'Two extra pips; a ram that lands protects your nose'] },
  saws:   { name: 'Side Saws',     offense: true,  icon: 'saw',    trig: 'SIDE CONTACT',    say: ['Blades cut whatever rides against your sides', 'Faster cutting', 'Bigger blades, deeper cuts'] },
  gun:    { name: 'Machine Gun',   offense: true,  icon: 'gun',    trig: 'AUTO-AIM',        say: ['Swivels and bursts at the nearest raider', 'Longer bursts, shorter rest', 'Twin barrels, harder rounds'] },
  cannon: { name: 'Heavy Cannon',  offense: true,  icon: 'cannon', trig: 'AHEAD & BESIDE',  say: ['A slow shell at the biggest group near you', 'A harder shell, a wider burst', 'Shrapnel burst, quicker reload'] },
  flame:  { name: 'Flamethrower',  offense: true,  icon: 'flame',  trig: 'CHASED OR DRIFT', say: ['A rear jet burns what chases you', 'A longer, hotter jet', 'Leaves a burning trail; lights your oil'] },
  oil:    { name: 'Oil Dispenser', offense: false, icon: 'oil',    trig: 'CHASED OR DRIFT', say: ['Drops a slick that spins chasers out', 'Bigger, longer slicks', 'Slicker still; flame lights it'] },
  shield: { name: 'Rear Shield',   offense: false, icon: 'shield', trig: 'HIT FROM BEHIND', say: ['Soaks up a hit from behind, then recharges', 'Holds more', 'Wider and recharges fast'] },
};
const SERVICE = {
  refuel: { name: 'Refuel',        icon: 'repair', trig: 'NOW', say: f => `+${f} fuel now; what won't fit pauses the drain` },
  nitro:  { name: 'Nitro Service', icon: 'trick',  trig: 'NOW', say: () => 'A full nitro tank; already full = one free boost later' },
};
const DRAFT_MAX = 9, REFUEL = 25;
const DRAFT_NEED = [3, 7, 11, 16, 22, 29, 37, 46];   // salvage you need, in total, for the 2nd..9th choice

function draftNewBuild() { return { items: {}, order: [], choices: 0, salvage: 0, offer: null, opening: false, rerolls: 1, fuelGrace: 0, nitroCredits: 0, picks: [] }; }
const draftRank = id => (demo && demo.build && demo.build.items[id]) || 0;

// ============ the rules ============
function draftCandidates(b, pool, opening) {   // the weapon cards this build may be offered: upgrades and new attachments
  const owned = Object.keys(b.items), room = owned.length < 3;
  const up = opening ? [] : owned.filter(id => b.items[id] < 3).map(id => ({ k: 'up', id, rank: b.items[id] + 1 }));
  let neu = room ? pool.filter(id => !b.items[id]).map(id => ({ k: 'new', id, rank: 1 })) : [];
  if (opening) { const off = neu.filter(c => ATTACH[c.id].offense); neu = off.length >= 3 ? off : off.concat(neu.filter(c => !ATTACH[c.id].offense)); }   // the opening is offensive (all of it, once the full pool is in)
  return { up, neu, room };
}
function draftLegalOffers(b, pool, opening) {   // every legal offer, as sets in a fixed order
  const { up, neu, room } = draftCandidates(b, pool, opening), W = up.concat(neu);
  if (!W.length) return [];
  if (W.length < 3) {   // service cards fill what the weapons can't
    const fill = 3 - W.length, svc = ['refuel', 'nitro'].map(id => ({ k: 'svc', id, rank: 0 }));
    return fill === 2 ? [W.concat(svc)] : svc.map(s => W.concat([s]));
  }
  const out = [];
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) for (let l = j + 1; l < W.length; l++) {
    const o = [W[i], W[j], W[l]];
    if (!opening && room && up.length && !o.some(c => c.k === 'up')) continue;
    if (!opening && neu.length && !o.some(c => c.k === 'new')) continue;
    out.push(o);
  }
  return out;
}
function draftShuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }   // Fisher-Yates: every order equally likely
function draftOffer(b, rng, pool, opening) {   // one legal offer, uniformly, shown in a random order; null when there's nothing left to offer
  const all = draftLegalOffers(b, pool, opening); if (!all.length) return null;
  return draftShuffle(all[Math.floor(rng() * all.length)].map(c => Object.assign({}, c)), rng);
}
const draftKey = o => o.map(c => c.k + ':' + c.id).sort().join('|');

// ============ in a run ============
const demoPool = () => demo.pool || ATTACH_IDS.filter(id => EQ_READY[id]);
function draftPending() {   // choices earned and not taken yet (the opening isn't earned: it's the start)
  const b = demo && demo.build; if (!b || b.choices >= DRAFT_MAX || b.choices < 1) return 0;
  let earned = 0; for (const need of DRAFT_NEED) if (b.salvage >= need) earned++;
  return Math.max(0, Math.min(earned, DRAFT_MAX - 1) - (b.choices - 1));
}
function draftOpen(opening) {   // a fresh offer (the picker shows it); false when nothing is left to offer
  const b = demo.build; b.opening = !!opening;
  b.offer = draftOffer(b, demo.rDraft, demoPool(), opening);
  if (!b.offer) return false;
  draftShow(); return true;
}
function draftShow() {   // the picker: the game holds still underneath, held input is dropped
  state = 'pick'; $('pickReroll').hidden = false; touches.clear(); for (const k in keys) keys[k] = false;
  renderDraft(); $('pick').hidden = false;
}
function draftCanReroll() { const b = demo.build; return b.rerolls > 0 && draftLegalOffers(b, demoPool(), b.opening).some(o => draftKey(o) !== draftKey(b.offer)); }
function draftReroll() {   // a different legal offer, once a run; with no different offer it's refused and kept
  const b = demo.build; if (state !== 'pick' || !b.offer || !draftCanReroll()) return false;
  const cur = draftKey(b.offer), alts = draftLegalOffers(b, demoPool(), b.opening).filter(o => draftKey(o) !== cur);
  b.rerolls--; b.offer = draftShuffle(alts[Math.floor(demo.rDraft() * alts.length)].map(c => Object.assign({}, c)), demo.rDraft);
  renderDraft(); SFX.whoosh(); return true;
}
function draftChoose(i) {
  const b = demo && demo.build; if (!b || state !== 'pick' || !b.offer || !b.offer[i]) return;
  const c = b.offer[i];
  if (c.k === 'new') { b.items[c.id] = 1; b.order.push(c.id); eqFitted(c.id); }
  else if (c.k === 'up') { b.items[c.id] = Math.min(3, b.items[c.id] + 1); eqFitted(c.id); }
  else if (c.id === 'refuel') { const got = changeFuel(REFUEL, 'service'), spill = REFUEL - got; if (spill > 0) b.fuelGrace += spill / Math.max(0.1, STG().drain); }   // what doesn't fit pauses the drain instead
  else if (c.id === 'nitro') { if (nitro >= 0.999) b.nitroCredits++; else nitro = 1; }
  if (b.opening) showStageCard(stageIx);   // the first pick made: now the road's card
  b.choices++; b.picks.push(c.k + ':' + c.id + (c.rank ? c.rank : '')); b.offer = null; b.pickT = b.opening ? -99 : time;   // the gap runs between road choices, not from the opening one
  $('pick').hidden = true; state = 'play'; touches.clear(); for (const k in keys) keys[k] = false;
  demo.graceT = 0.8; player.inv = Math.max(player.inv, 0.8);   // a beat to find your bearings: nothing lands in it
  pops.push({ x: player.x, y: player.y - 50, text: c.k === 'svc' ? SERVICE[c.id].name.toUpperCase() + '!' : `${ATTACH[c.id].name.toUpperCase()}${c.rank > 1 ? ' ' + 'I'.repeat(c.rank) : ''}!`, col: '#5be37d', t: 0 });
  parts.push({ k: 'ring', x: player.x, y: player.y, t: 0, life: 0.5, R: 200 }); SFX.level(); renderUps();
}
function draftSalvage(n) { if (demo && demo.build && n > 0 && demo.build.choices < DRAFT_MAX) demo.build.salvage += n; }   // from a wreck you caused, or a finite reward
function draftCalm() {   // nothing about to land on you: no raider winding up near you, no shell or bomb about to drop close by
  if (player.air || !calmNow()) return false;
  return !bombs.some(B => Math.hypot(B.tx - player.x, B.ty - player.y) < 260) && !(rocksFalling || []).some(R => Math.hypot(R.x - player.x, R.y - player.y) < 260);
}
const DRAFT_GAP = 6;   // seconds of driving between two choices on the road, so two earned at once don't come back to back
function draftTick() {   // on the road: an earned choice opens at the next calm moment, DRAFT_GAP after the last; never once the boss is coming
  if (!demo || !demo.build || state !== 'play' || stageBoss || boss || bullIn || (demo.graceT || 0) > 0 || time - (demo.build.pickT ?? -99) < DRAFT_GAP) return;
  if (draftPending() > 0 && draftCalm()) draftOpen(false);
}
function draftBeforeBoss() {   // at the arena: anything still waiting is offered now, before the boss comes out (true = held the boss)
  if (!demo || !demo.build || draftPending() <= 0) return false;
  for (const k of cars) k.flee = true; incoming = [];   // the road's raiders clear off: nothing to land on you after the pick
  return draftOpen(false);
}

// ============ the picker ============
const eqIcon = id => ICON[ATTACH[id] ? ATTACH[id].icon : SERVICE[id].icon] || ICON.evo;
function renderDraft() {
  const b = demo.build, o = b.offer || [];
  $('pickTitle').textContent = b.opening ? 'PICK YOUR FIRST WEAPON' : 'SALVAGE! PICK ONE';
  $('cards').innerHTML = o.map((c, i) => {
    if (c.k === 'svc') { const S = SERVICE[c.id]; return `<button class="card new" data-k="${i}"><div class="ic">${eqIcon(c.id)}</div><div><h3>${S.name}<em>SERVICE</em></h3><p><i class="trig">${S.trig}</i>${S.say(REFUEL)}</p></div></button>`; }
    const A = ATTACH[c.id], tag = c.k === 'new' ? 'NEW' : `RANK ${c.rank - 1} → ${c.rank}`;
    return `<button class="card${c.k === 'new' ? ' new' : ''}" data-k="${i}"><div class="ic">${eqIcon(c.id)}</div><div><h3>${A.name}<em>${tag}</em></h3><p><i class="trig">${A.trig}</i>${A.say[c.rank - 1]}</p><p class="pv">${eqPreview(c.id, c.rank)}</p></div></button>`;
  }).join('');
  $('pickLoad').innerHTML = [0, 1, 2].map(i => { const id = b.order[i]; return id ? `<i class="on">${eqIcon(id)}<b>${'▮'.repeat(b.items[id])}${'▯'.repeat(3 - b.items[id])}</b></i>` : '<i><b>EMPTY</b></i>'; }).join('');
  const can = draftCanReroll(); $('pickReroll').disabled = !can; $('pickReroll').textContent = b.rerolls > 0 ? (can ? 'REROLL (1 FREE)' : 'NO OTHER CARDS') : 'REROLL USED';
}
function renderLoad() {   // the HUD's three slots: what's fitted, its rank
  const b = demo.build; $('load').innerHTML = [0, 1, 2].map(i => { const id = b.order[i]; return id ? `<i>${eqIcon(id)}<b>${'●'.repeat(b.items[id])}${'○'.repeat(3 - b.items[id])}</b></i>` : '<i class="off"></i>'; }).join('');
}
$('pickReroll').addEventListener('click', () => { if (demo) draftReroll(); });
addEventListener('resize', () => { if (demo && state === 'pick' && demo.build && demo.build.offer) renderDraft(); });   // the same offer, laid out again
