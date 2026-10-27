'use strict';
// Fuel Run · boss_rules.js: one boss at a time, and one rule for what hurts it in the demo.
// activeBoss() is the boss for the camera, the HUD, music and damage. A demo boss has a weak point (its kind's weak(B):
// where it is, how big, whether it's open). Every hit on it, from a ram, a weapon or anything else, goes through
// bossHit: closed, nothing gets through and the armour rings; open, a hit that physically reaches the weak point counts,
// in full, once per attack (a projectile or a ram is one attack; a saw or a flame is a fresh sample each tick).
// The campaign's bosses keep their own rules: this only applies while a demo run is on.
// Classic scripts sharing one global scope, loaded in order by index.html.

const BOSS_SRC = new Set(['tank', 'ram', 'fork', 'gun', 'cannon', 'saw', 'flame', 'ability']);   // what may hurt a demo boss: you, your weapons, your car's move
function activeBoss() { return boss && !boss.dead ? boss : null; }
function bossWeak(B = boss) { const K = B && BOSS_KINDS[B.kind]; return K && K.weak ? K.weak(B) : null; }
function bossBlocked(B, x, y) {   // a hit on closed armour: a clang and a spark where it landed, a word now and then
  B.blockT = time;
  if ((B.clangT || 0) > time) return; B.clangT = time + 0.7; SFX.clang();
  for (let i = 0; i < 5; i++) parts.push({ k: 'spark', x: x ?? B.x, y: y ?? B.y, vx: crand(-200, 200), vy: crand(-200, 200), t: 0, life: 0.22 });
  if ((B.wordT || 0) <= time) { B.wordT = time + 2.5; pops.push({ x: B.x, y: B.y - 80, text: bossWeak(B) && bossWeak(B).open ? `HIT THE ${BOSS_KINDS[B.kind].weakName || 'TANK'}!` : 'ARMOURED!', col: '#dfe6ec', t: 0, small: 1 }); }   // the word now and then; the clang every time
}
function bossPolicy(B, n, src, x, y, id) {   // the damage a demo boss takes from this hit: 0 when it doesn't count
  const W = bossWeak(B); if (!W) return n;
  if (id !== undefined && B.hitIds && B.hitIds.has(id)) return 0;   // the same attack again (another body point, another substep)
  const reach = x !== undefined && Math.hypot(x - W.x, y - W.y) <= W.r + 6;
  if (!W.open || !BOSS_SRC.has(src) || !reach) { bossBlocked(B, x, y); return 0; }
  if (id !== undefined) { (B.hitIds = B.hitIds || new Set()).add(id); if (B.hitIds.size > 400) B.hitIds = new Set([id]); }
  recordRunEvent('boss_hit', { kind: B.kind, n: Math.round(n), src });
  return n;
}
function bossHit(h) {   // { n, src, x, y, id, word }: what the boss really took
  const B = activeBoss(); if (!B) return 0;
  const hp = B.hp; damageBoss(h.n, h.src, h.x, h.y, h.word, false, h.id); return hp - B.hp;
}
const BOSS_RAM = { base: 2, fork: [0.5, 1, 1.5], nitro: 1.25, cd: 0.9, kick: 420 };   // a ram on an open weak point, in segments (forks add a little each rank, nitro a quarter); then it throws you back and needs cd seconds
const bossRamSegs = F => (BOSS_RAM.base + (F ? BOSS_RAM.fork[eqR('forks') - 1] : 0)) * (nitroT > 0 ? BOSS_RAM.nitro : 1);
