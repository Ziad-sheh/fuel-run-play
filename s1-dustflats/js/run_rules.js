'use strict';
// Fuel Run · run_rules.js: one record of a run, and one rule for what counts as yours.
// Every wreck resolves to a cause {kind, playerCaused, at, chainId}: fuel, the wreck count, the stage's challenge and
// the ledger all read that one cause. The word on screen is never the rule. The tank only changes through changeFuel,
// so the ledger knows what the player really gained and lost, by source. Loaded right after core.js; it reads the
// game's globals only when called, never at load.
let runState = null, runSeq = 0, chainSeq = 0, lures = new Map();
const CAUSE_WINDOW = 3;   // seconds a player's action keeps counting for what happens to that raider next
const ATTACK_MODES = new Set(['swipe', 'lunge', 'ram', 'brake', 'oncoming', 'pole']);
const CAUSE_KINDS = ['ram', 'ability', 'weapon', 'drum', 'wall', 'rock', 'raider', 'ball', 'geyser', 'stomp', 'ravine', 'storm', 'fire', 'ambient'];

function resetRunState(mode = 'campaign') {
  runState = { id: ++runSeq, mode, outcome: 'active', fuelAtWin: null, challengeAtWin: null, payoutDone: false,
    totals: { gain: {}, loss: {}, wrecks: 0, credited: 0, ambient: 0, rams: 0, dodges: 0, nitroGain: {}, nitroFired: 0 }, events: [] };
  lures = new Map();
  return runState;
}
function recordRunEvent(type, data) {   // the latest 600 events, for teaching and for reading a run afterwards; totals don't depend on the cap
  if (!runState) return null;
  const e = Object.assign({ t: Math.round((typeof time === 'number' ? time : 0) * 100) / 100, type }, data || {});
  runState.events.push(e); if (runState.events.length > 600) runState.events.splice(0, runState.events.length - 600);
  return e;
}
function changeFuel(delta, source = 'other') {   // the only way the tank moves: clamped, and kept by source; returns what was really applied
  if (!player || (delta < 0 && runState && runState.outcome === 'won')) return 0;   // a won run loses nothing more
  const before = player.hp, next = clamp(before + delta, 0, player.maxHp), applied = next - before;
  player.hp = next;
  if (runState && applied !== 0) { const T = applied > 0 ? runState.totals.gain : runState.totals.loss; T[source] = (T[source] || 0) + Math.abs(applied); }
  return applied;
}

// ============ causes ============
function markPlayerCause(k, kind, secs = CAUSE_WINDOW, detail) {   // your action on this raider: it counts for CAUSE_WINDOW seconds
  if (!k || k.dead) return;
  const chainId = k.cause && k.cause.until > time ? k.cause.chainId : ++chainSeq;
  k.cause = { kind, at: time, until: time + secs, chainId, detail };
}
function carryCause(from, to) {   // a chain: the car you sent flying carries your cause to the one it hits
  if (!from || !from.cause || from.cause.until <= time || !to || to.dead) return;
  if (to.cause && to.cause.until > time) return;   // it already has one of its own
  to.cause = Object.assign({}, from.cause, { at: time, until: time + CAUSE_WINDOW, detail: undefined });
}
const playerCause = k => !!(k && k.cause && k.cause.until > time);
const attackMissed = k => !!k && ((k.missT !== undefined && time - k.missT < CAUSE_WINDOW) || (k.attackT !== undefined && time - k.attackT < 0.6 && !k.hitYou));   // it committed to you and didn't get you
function noteAttack(k, attacking) {   // called every tick for every raider: remembers a committed attack, and the moment it ends without landing
  if (k.flee) { k.attacking = false; return; }   // scattering at the boss's arrival is not a miss
  if (attacking && !k.hitYou) { k.attackT = time; k.attacking = true; }
  else if (k.attacking && !attacking) { k.attacking = false; if (!k.hitYou) { k.missT = time; if (runState) runState.totals.dodges++; recordRunEvent('attack_dodged', { car: k.type }); } }
}
function pursuing(k) {   // on your tail: close, and heading your way (or mid-attack)
  if (!k || k.flee || k.guard) return false;
  const d = Math.hypot(k.x - player.x, k.y - player.y); if (d > 700) return false;
  if (ATTACK_MODES.has(k.mode)) return true;
  const to = Math.atan2(player.y - k.y, player.x - k.x), v = Math.hypot(k.vx, k.vy);   // its nose or its motion toward you: a head-on crash bounces the motion before this is asked
  return Math.abs(angDiff(k.a, to)) < 1.4 || (v > 40 && Math.abs(angDiff(Math.atan2(k.vy, k.vx), to)) < 1.4);
}
function lureTouch(key, x, y, r, rIn = -1) {   // the player is inside a hazard's warning area (a disc, or a ring between rIn and r): remembered for CAUSE_WINDOW seconds
  if (!player || !key) return;
  const d = Math.hypot(player.x - x, player.y - y);
  if (d < r + player.r && d > rIn - player.r) { const L = lures.get(key) || {}; L.inT = time; lures.set(key, L); }
}
const luredInto = key => { const L = key && lures.get(key); return !!L && time - L.inT < CAUSE_WINDOW; };
function resolveWreckCause(k, kind, lureKey, direct) {   // the one decision: did the player cause this wreck?
  const playerCaused = !!direct || kind === 'ram' || kind === 'ability' || kind === 'weapon' || kind === 'stomp' || playerCause(k) || attackMissed(k) || (lureKey !== undefined && luredInto(lureKey) && pursuing(k));
  return { kind: CAUSE_KINDS.includes(kind) ? kind : 'ambient', playerCaused, at: time, chainId: k && k.cause ? k.cause.chainId : undefined, detail: k && k.cause ? k.cause.detail : undefined };
}
// ============ the outcome: won or lost once, never both ============
function lockRunWin() {   // the accepted final hit on the boss: from here the drain, hostile damage and the challenge are frozen
  if (!runState || runState.outcome !== 'active') return false;
  runState.outcome = 'won'; runState.fuelAtWin = player.hp / player.maxHp; runState.challengeAtWin = chalOk();
  recordRunEvent('boss_defeated', { fuel: Math.round(player.hp), challenge: runState.challengeAtWin });
  return true;
}
function lockRunLoss(cause) {   // a fatal hit or an empty tank: a boss dying a frame later can't turn it into a win
  if (!runState || runState.outcome !== 'active') return false;
  runState.outcome = 'lost'; runState.lossCause = cause; recordRunEvent('run_end', { outcome: 'lost', cause });
  return true;
}
const runHeld = () => (typeof introT === 'number' && introT > 0) || (typeof stageCardT === 'number' && stageCardT > 0) || !!(demo && demo.graceT > 0);   // the demo's beat after a pick holds them too   // a card is up: hostile clocks and damage wait
const capBossSegments = n => Math.min(2, Math.max(0, n));   // a boss loses at most two segments to one hit
