'use strict';
// Wasteland Drift · bosses.js: what every boss shares: the warning, the arrival, armour and damage, stuns, the health bar, the death.
// Each kind (the Bull, the Twin-Horse, the Road Fortress) brings its own behaviour and drawing.
// Classic scripts sharing one global scope, loaded in order by index.html.

const BOSS_KINDS = {
  bull:     { name: 'THE BULL',        loose: 'THE BULL IS LOOSE!',      hp: 1,    weak: B => bullWeak(B), demoHud: B => bullWeak(B).open ? 'TANK OPEN: HIT IT!' : B.phase === 2 ? 'FURIOUS' : 'BAIT IT INTO ROCK', init: B => bullInit(B),   update: (B, dt) => updateBull(B, dt),   draw: B => drawBull(B),     points: B => bullPoints(B),     mul: (B, src) => bullMul(B, src),           hud: B => bullHud(B) },
  fortress: { name: 'ROAD FORTRESS',  loose: 'THE ROAD FORTRESS ROLLS!', hp: 1.35, noStun: true, init: B => fortInit(B), update: (B, dt) => updateFortress(B, dt), draw: B => drawFortress(B), points: B => fortPoints(B), mul: () => 1, damage: (B, n, src, x, y) => fortDamage(B, n, src, x, y), hud: B => fortHud(B) },
  twin:     { name: 'THE TWIN-HORSE',  loose: 'THE TWIN-HORSE RIDES!',   hp: 1.15, init: B => twinInit(B),   update: (B, dt) => updateTwin(B, dt),   draw: B => drawTwin(B),     points: B => twinPoints(B),     mul: (B, src, x, y) => twinMul(B, src, x, y), hud: B => twinHud(B) },
};
const BOSS_HOW = { bull: 'DODGE ITS CHARGE INTO ROCKS · THEN RAM IT', twin: 'GET BEHIND IT · RAM ITS FUEL TANKS', fortress: 'KNOCK OUT BOTH TURRETS · THEN RAM ITS ENGINE' };
const SEG = 100;   // one segment of a boss's health bar
const bossKind = () => BOSS_KINDS[(boss && boss.kind) || 'bull'];
function bossPoints() { return bossKind().points(boss); }
function bossDamageMul(src, fx, fy) { return bossKind().mul(boss, src, fx, fy); }
function updateBoss(dt) { const B = boss; if (!B) return; if (B.dead) { bossDeath(B, dt); return; } BOSS_KINDS[B.kind].update(B, dt); }
function drawBoss() { if (boss) BOSS_KINDS[boss.kind].draw(boss); }
function bossEntry(ang) {   // a point just off screen, at angle ang from where you're heading, clear of obstacles
  const fwd = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a;
  for (let i = 0; i < 24; i++) { const [x, y] = edgePoint(fwd + ang + (i ? rand(-0.5, 0.5) : 0), 140); if (!blocked(x, y, 60)) return [x, y]; }
  return spawnPoint() || [player.x - Math.cos(fwd) * 900, player.y - Math.sin(fwd) * 900];
}
function startBoss(kind) {   // you've crossed into its turf: a horn, the gang scatters, and a marker shows where it'll burst in
  bullIn = { kind, ang: (grand() < 0.5 ? -1 : 1) * rand(1.9, 2.4), t: 1.4 };   // from behind, off one shoulder
  banner = { text: BOSS_KINDS[kind].loose, sub: BOSS_HOW[kind], t: 0 }; music('stinger', 'boss'); slowT = Math.max(slowT, 0.35);
  for (const k of cars) k.flee = true; incoming = [];
  if (depot) depot.open = false;
  SFX.horn();
}
function spawnBoss(x, y, kind = regionBoss()) {
  if (x === undefined) { [x, y] = bossEntry((grand() < 0.5 ? -1 : 1) * rand(1.9, 2.4)); if (!banner) banner = { text: BOSS_KINDS[kind].loose, t: 0 }; SFX.horn(); }
  bossN++; bullIn = null;
  const hp = STG().segs * SEG, a = Math.atan2(player.y - y, player.x - x), v = SPEED * 1.12;   // segments: each hit on its weak spot takes one
  boss = { kind, x, y, a, vx: Math.cos(a) * v, vy: Math.sin(a) * v, hp, maxHp: hp, t: 0, hurtT: 0 };
  BOSS_KINDS[kind].init(boss);
  for (const k of cars) k.flee = true; incoming = [];   // the gang clears out: it's just you and the Bull
  for (let i = 0; i < 14; i++) { const q = crand(0, TAU), sp = crand(60, 220); parts.push({ k: 'dust', x: x + crand(-30, 30), y: y + crand(-30, 30), vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, t: 0, life: crand(0.6, 1), size: crand(14, 22) }); }   // bursts in through its own dust
  $('boss').hidden = false; SFX.rev();
}
function damageBoss(n, src, fx, fy, word, raw, id) {   // id: the attack, so one shot or one ram counts once (demo bosses)
  if (!boss || boss.dead || state !== 'play') return;
  const K = bossKind(); let mul;
  if (demo && K.weak) { n = bossPolicy(boss, n, src, fx, fy, id); if (n <= 0) return; mul = 1; }   // the demo's one rule: an open weak point, reached
  else if (K.damage) { const was = n; n = K.damage(boss, n, src, fx, fy); mul = n / (was || 1); }   // the Road Fortress routes hits to its turrets
  else { mul = raw ? 1 : bossDamageMul(src, fx, fy); n *= mul; }
  if (mul >= 1 && n >= 20 && (src === 'trick' || src === 'ram')) { addFury(0.15); onBossHit(); }   // landing a real hit on a boss fills Fury and sends the drones in
  if (src === 'tank' && n > 0) recordRunEvent('boss_hit', { kind: boss.kind, n });
  boss.hp -= n; boss.hurtT = 0.08; boss.bounce = Math.max(boss.bounce || 0, mul >= 1 ? 1 : 0.3); dmgBy[src] = (dmgBy[src] || 0) + n;
  if (word) pops.push({ x: boss.x, y: boss.y - 70, text: word, col: '#ffd23f', t: 0 });
  if (boss.hp <= 0) bossDown();
}
function stunBoss(secs, stuck) { const B = boss; if (!B || B.dead || bossKind().noStun) return; recordRunEvent('boss_window', { kind: B.kind, secs }); B.state = 'stunned'; B.t = 0; B.stunFor = secs; B.stuck = stuck; B.canReady = true; B.vx *= 0.15; B.vy *= 0.15; }
function bossDown() {   // the rest plays out in updateBoss on game time, so slow-mo and pauses can't knock it out of step
  boss.dead = true; boss.state = 'dead'; boss.t = 0; crashes++; if (!demo) { save.bullsDown++; writeSave(); }
  stageBossDown();
  bigMoment(boss.x, boss.y, { bull: 'BULL DOWN!', twin: 'TWIN-HORSE DOWN!', fortress: 'FORTRESS DOWN!' }[boss.kind] || 'BOSS DOWN!');
  bounty('boss', 1, { boss: boss.kind, car: player.car });
}
function bossDeath(B, dt) {   // six blasts while it burns, then the crew bails, the loot sprays and the gate opens
  const was = B.t; B.t += dt;
  for (let i = 0; i < 6; i++) if (was <= i * 0.2 && B.t > i * 0.2) boom(B.x + rand(-40, 40), B.y + rand(-40, 40), null, 1.3);
  if (was <= 1.3 && B.t > 1.3) {
    ejectCrew(B, B.crew, true);
    for (let i = 0; i < 30; i++) dropGem(B.x, B.y, 0, 2.2); for (let i = 0; i < 3; i++) dropGem(B.x, B.y, -15, 2);
    for (const g of gems) g.boss = true;   // the boss's haul finds you from anywhere on screen
    for (let i = 0; i < 24; i++) { const a = crand(0, TAU), sp = crand(200, 600); parts.push({ k: 'debris', x: B.x, y: B.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: crand(0, TAU), spin: crand(-12, 12), t: 0, life: crand(1, 1.8), size: crand(8, 16), col: cpick(['#8e1f17', '#5c626a', '#f3e6cc']) }); }
    boss = null; $('boss').hidden = true; banner = { text: 'GRAB THE LOOT!', t: 0 };
    if (depot && depot.boss) depot.winT = time + 2.4;   // the fortress is yours once the haul is in: no long drive to the gate after the fight
  }
}
