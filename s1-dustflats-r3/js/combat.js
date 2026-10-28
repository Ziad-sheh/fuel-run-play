'use strict';
// Wasteland Drift · combat.js: nitro, gems, levels, your weapons, the gang's harpoons and firebombs.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ nitro, gems, levels ============
function addNitro(v, src = 'other') {   // src: what earned it (kept for the lab's reports)
  if (demo && demo.proto && nitroT > 0) v *= PROTO_NITRO.boosting;   // the lab: how much a boost still earns while it burns
  const was = nitro >= 1, n0 = nitro; nitro = clamp(nitro + v * (player.nitroRate || 1), 0, 1);
  if (runState && nitro > n0) { const T = runState.totals; T.nitroGain[src] = (T.nitroGain[src] || 0) + nitro - n0; if (nitroT > 0) T.nitroGainBoosting = (T.nitroGainBoosting || 0) + nitro - n0; }
  if (!was && nitro >= 1 && state === 'play') SFX.close();   // the button lights up: no words needed
}
function fireNitro() {
  if (state !== 'play' || nitroT > 0) return;
  if (nitro < 1) { if (demo && demo.build && demo.build.nitroCredits > 0) { demo.build.nitroCredits--; nitro = 1; } else return; }   // a Nitro Service credit: a free boost
  nitro = 0; if (runState) runState.totals.nitroFired++; (ABILITY[player.car] || ABILITY.interceptor)();
}
const callout = (text, col = '#ffd23f') => pops.push({ x: player.x, y: player.y - (demo && demo.proto ? 84 : 44), text, col, t: 0 });   // the lab lifts it clear of the car (crowds hide it otherwise)
// every car's nitro is its signature move
const ABILITY = {
  interceptor() { nitroT = 1.8; SFX.nitro(); callout('NITRO!'); },   // a wild powerslide; drifting leaves fire (update.js)
  sandviper() {   // a sand cloud: everything near you goes blind and loses you
    nitroT = 1.5; SFX.nitro(); SFX.whoosh(); callout('SANDSTORM!', '#f2e4c8');
    for (let i = 0; i < 46; i++) { const a = crand(0, TAU), sp = crand(160, 560); parts.push({ k: 'spray', x: player.x, y: player.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: crand(0.7, 1.2), size: crand(10, 20) }); }
    for (const k of cars) if (Math.hypot(k.x - player.x, k.y - player.y) < 480) k.blindT = Math.max(k.blindT || 0, 3);
    const B = boss; if (B && !B.dead && Math.hypot(B.x - player.x, B.y - player.y) < 480 && (B.state === 'hunt' || B.state === 'wind')) { B.state = 'hunt'; B.t = -1.5; pops.push({ x: B.x, y: B.y - 70, text: 'LOST YOU!', col: '#f2e4c8', t: 0 }); }
  },
  juggernaut() { nitroT = 2; player.rampage = 2; player.inv = Math.max(player.inv, 2); SFX.nitro(); SFX.horn(); callout('RAMPAGE!', '#ff7a1a'); },   // nothing hurts you; whatever you hit is wrecked
  harpooner() {   // a harpoon at the nearest car you're facing (or the Bull); drift to swing it into something hard
    let best = null, bs = 1e9;
    for (const k of cars) { if (k.dead) continue; const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy); if (d < 40 || d > 600) continue; const sc = d * (1 + Math.abs(angDiff(player.a, Math.atan2(dy, dx))) * 1.4); if (sc < bs) { bs = sc; best = k; } }
    const B = boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < 600 ? boss : null;
    const T = best || B, a = T ? Math.atan2(T.y + T.vy * 0.15 - player.y, T.x + T.vx * 0.15 - player.x) : player.a;
    harpoons.push({ x: player.x, y: player.y, vx: Math.cos(a) * 1350, vy: Math.sin(a) * 1350, t: 0, owner: player, mine: true });
    player.harpA = a; player.harpT = 0.4; SFX.twang(); callout('HARPOON!', '#7fd6ff');
  },
  doof() {   // a wall of sound: every car around you is blown away and stunned; it even stops the Bull's charge
    SFX.horn(); SFX.nitro(); bigMoment(player.x, player.y, 'DOOF!', 1.1, 0.7);
    parts.push({ k: 'ring', x: player.x, y: player.y, t: 0, life: 0.5, R: 420 }); parts.push({ k: 'ring', x: player.x, y: player.y, t: -0.12, life: 0.5, R: 300 });
    for (let i = 0; i < 12; i++) parts.push({ k: 'fire', x: player.x + crand(-8, 8), y: player.y + crand(-8, 8), vx: Math.cos(player.a) * crand(200, 420) + crand(-60, 60), vy: Math.sin(player.a) * crand(200, 420) + crand(-60, 60), t: 0, life: crand(0.3, 0.5), size: crand(8, 13) });   // the flame guitar
    for (const k of cars) {
      const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy) || 1; if (d > 430) continue;
      const f = 380 + 560 * (1 - d / 430); k.vx += dx / d * f; k.vy += dy / d * f; k.stun = Math.max(k.stun, 1.6); k.frag = Math.max(k.frag, 1.4); k.slideT = Math.max(k.slideT, 0.5); markPlayerCause(k, 'ability');   // whatever it throws into the scenery is yours
      spinHit(k, k.x - dx / d * 10, k.y - dy / d * 10, dx / d * f * k.m, dy / d * f * k.m, PIT_K); if (k.crew) ejectCrew(k, 1);
    }
    const B = boss; if (B && !B.dead && Math.hypot(B.x - player.x, B.y - player.y) < 480) { if (B.kind === 'fortress') { B.jamT = 3; pops.push({ x: B.x, y: B.y - 100, text: 'TURRETS JAMMED!', col: '#7fd6ff', t: 0 }); } else if (B.state === 'charge' || B.state === 'wind' || B.state === 'swipe' || B.state === 'tell') stunBoss(1.2, false); damageBoss(B.maxHp * 0.03, 'trick', B.x, B.y); }
  },
  blackonblack() { nitroT = 2.5; player.ghostT2 = 2.5; SFX.nitro(); SFX.boost(3); callout('OVERDRIVE!', '#c9a227'); },   // nearly double speed, through traffic
};
// ============ fury: the multiplier for driving with style ============
// Takedowns, whips, near misses, dodged lunges, banked drifts and big air fill it; about two takedowns a level, x1 to x5.
// It drains when you stop and a hit knocks it down a level. It multiplies gold (up to x3) and XP (up to x1.6), and the gang
// hears you coming: each level adds a car to the pack. x5 is WITNESS ME: nitro fills and the car shines chrome.
let fury = { lv: 1, fill: 0, idle: 0, best: 1 };
const furyXP = () => 1 + 0.15 * (fury.lv - 1), furyGold = () => 1 + 0.5 * (fury.lv - 1);   // XP up to x1.6, gold up to x3
const FURY_NEED = [0, 1, 1.4, 1.8, 2.3];   // each level takes more: about a dozen takedowns from x1 to x5
function addFury(v) {
  if (FUEL_RUN || state !== 'play' || !player) return;   // Fuel Run: no Fury
  fury.idle = 0; fury.fill += v / FURY_NEED[Math.min(4, fury.lv)];
  while (fury.fill >= 1 && fury.lv < 5) { fury.fill -= 1; fury.lv++; furyUp(); }
  if (fury.lv >= 5) fury.fill = Math.min(fury.fill, 1);
}
function furyUp() {
  fury.best = Math.max(fury.best, fury.lv); bounty('fury', fury.lv); SFX.fury(fury.lv);
  if (fury.lv === 5) { fury.flashT = time + 1.6; slowT = Math.max(slowT, 0.2); addNitro(1, 'fury'); music('stinger', 'levelup'); }   // WITNESS ME! flashes on the Fury bar, not over your car
}
function furyHit() {   // a real hit knocks you down a level
  if (state !== 'play') return;
  if (fury.lv > 1) { fury.lv--; fury.fill = 0.3; }
  else fury.fill = Math.max(0, fury.fill - 0.5);
}
function updateFury(dt) {
  fury.idle += dt;
  if (fury.idle > (fury.lv >= 4 ? 2.5 : 3)) { fury.fill -= (0.2 + 0.08 * fury.lv) * dt; if (fury.fill < 0) { if (fury.lv > 1) { fury.lv--; fury.fill = 0.7; } else fury.fill = 0; } }
}
// ============ tricks: every crash you cause has a name and points ============
// Points x Fury, and tricks within 2.5 s of each other chain into DOUBLE, TRIPLE... for a bonus. Your best score is the goal.
const TRICK_PTS = { 'SKEWERED!': 150, 'SAWN!': 120, 'BLASTED!': 120, 'SHATTERED!': 150, 'TOASTED!': 100, 'ROCKFALL!': 200, 'FLAMED!': 150, 'INTO THE ABYSS!': 300, 'SKIM!': 150, 'WIPEOUT!': 25, 'BULLSEYE!': 250, 'PILE-UP!': 200, 'HEAD-ON!': 300, 'KABOOM!': 200, 'KA-BOOM!': 250, 'RAMMED!': 120, 'WHIPPED!': 150,
  'SPUN OUT!': 150, 'SHUNTED!': 120, 'STOMPED!': 200, 'TRAIN!': 250, 'CHOMP!': 250, 'TWISTED!': 200, 'SMASH!': 200, 'SPLAT!': 150, 'GORED!': 100, 'FLATTENED!': 100, 'PLOUGHED!': 120, 'KRUNCH!': 120 };
const BIG_TRICK = { 'BULLSEYE!': 1, 'PILE-UP!': 1, 'HEAD-ON!': 1, 'KABOOM!': 1, 'KA-BOOM!': 1, 'STOMPED!': 1, 'TRAIN!': 1, 'CHOMP!': 1 };
const CHAIN_WORDS = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUAD!', 'MAYHEM!'];
let score = 0, tricks = 0, chain = { n: 0, t: -9, best: 0 }, lastWordT = -9;
function trick(word, x, y, src) {   // word = null for a weapon kill: points without the big word
  if (FUEL_RUN || state !== 'play') return;   // Fuel Run: no trick words or score; a wreck says what happened (cars.js)
  if (word === 'WIPEOUT!') { score += 25 * fury.lv; return; }   // crashed near you on its own: a few points, quietly
  chain.n = time - chain.t < 2.5 ? chain.n + 1 : 1; chain.t = time; chain.best = Math.max(chain.best, chain.n); heatTrick(); if (chain.n >= 3) bounty('chain', chain.n);
  const base = word ? TRICK_PTS[word] || 100 : 60, gain = Math.round(base * fury.lv * (1 + 0.25 * (chain.n - 1)));
  score += gain; tricks++;
  if (word && time - lastWordT > 0.8) { lastWordT = time; if (Math.hypot(x - player.x, y - player.y) < 120) y = Math.min(y, player.y) - 90; parts.push({ k: 'burst', x, y, t: 0, life: 0.8, word, big: BIG_TRICK[word] ? 1 : 0.8, rot: crand(-0.2, 0.2) }); }   // one word at a time; the score and the chain live in the corner
  if (BIG_TRICK[word] && time - tdBeat > 2) { tdBeat = time; slowT = Math.max(slowT, 0.14); shake = Math.max(shake, 7 * (calmMotion ? 0.3 : 1)); }   // the big ones get a beat of slow-mo
}
// ============ heat: the harder you fight, the more they send ============
// Stars 1-5 per leg, raised by your tricks: more cars, and tougher ones (pole-cats at 2, ram trucks at 3, harpoons and
// bombers at 4). At 5 the leg's guardian (or, on the last leg, the region's boss) comes out to hunt you down.
const HEAT_AT = [0, 0, 7, 17, 30, 46];   // tricks this leg to reach each star
let heat = { lv: 1, n: 0 };
function heatTrick() {
  heat.n++;
  if (heat.lv < 5 && heat.n >= HEAT_AT[heat.lv + 1]) {
    heat.lv++; SFX.fury(heat.lv); SFX.rev();
    if (heat.lv === 5) pops.push({ x: player.x, y: player.y - 110, text: 'MAXIMUM HEAT!', col: '#ff5a46', t: 0 });   // the stars in the corner show the rest
    if (heat.lv === 5) maxHeat();
  }
}
// ============ levels: the card screen waits for a calm moment ============
let pickAt = 0, pickBy = 0;   // the earliest and latest game time the waiting cards open
const LEVELS = false;   // the old level-up weapon cards are retired: gadgets from crates took their place
function gainXP(v) {
  if (!LEVELS) return;
  xp += v;
  while (xp >= xpNeed(level)) { xp -= xpNeed(level); level++; pendingLv++; if (BOLTS[level]) { pops.push({ x: player.x, y: player.y - 70, text: `+${BOLTS[level]}`, col: '#ffd23f', t: 0 }); for (let i = 0; i < 10; i++) parts.push({ k: 'spark', x: player.x, y: player.y, vx: crand(-260, 260), vy: crand(-260, 260), t: 0, life: 0.35 }); } }
  if (pendingLv > 0 && state === 'play' && !pickBy) { pickAt = time + 0.4; pickBy = time + 5; pops.push({ x: player.x, y: player.y - 80, text: 'LEVEL UP!', col: '#7fd6ff', t: 0 }); SFX.level(); }
}
function calmNow() {   // nothing about to hit you: no attack lined up, not in the air or mid-drift, not right after a takedown
  if (player.air || player.slip > 0.3 || time - lastTD < 0.6) return false;
  if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < 700) return false;
  return !cars.some(k => !k.dead && !k.flee && Math.hypot(k.x - player.x, k.y - player.y) < 420 && (k.mode === 'tell' || k.mode === 'swipe' || k.mode === 'wind' || k.mode === 'lunge' || k.mode === 'pole' || k.aimT > 0));
}
function pickTick() {   // called while you play: open the cards once it's calm, or after 5 s regardless
  if (pendingLv <= 0) { pickBy = 0; return; }
  if (!pickBy) { pickAt = time + 0.4; pickBy = time + 5; }
  if (time >= pickAt && (time >= pickBy || calmNow())) openPick();
}
function openPick() {
  pendingLv--; pickBy = 0; state = 'pick'; touches.clear(); if (!boss) music('stinger', 'levelup');
  const held = Object.keys(UPS).filter(k => up[k] > 0), room = held.length < MAX_SLOTS;   // six weapons at most
  const evos = Object.keys(EVOS).filter(k => up[k] >= EVO_LV && up[EVOS[k].needs] > 0 && !up.evo[k]).map(k => 'evo:' + k);
  const mix = shuffle, mine = mix(held.filter(k => up[k] < 5)), pool = mix(Object.keys(UPS).filter(k => up[k] < 5 && (up[k] > 0 || room)));
  const choice = evos.slice(0, 3);
  if (mine.length && choice.length < 3) choice.push(mine[0]);   // always one upgrade to something you carry, so a build can be steered
  for (const k of pool) { if (choice.length >= 3) break; if (!choice.includes(k)) choice.push(k); }   // no Repair card: repairs come from fuel cans
  if (choice.length < 3) choice.push('gold');
  $('cards').innerHTML = choice.map(k => {
    if (k === 'repair') return `<button class="card new" data-k="repair"><div class="ic">${ICON.repair}</div><div><h3>Repair<em>+50 HP</em></h3><p>Weld the car back together</p></div></button>`;
    if (k === 'gold') return `<button class="card new" data-k="gold"><div class="ic">${ICON.evo}</div><div><h3>Scrap Haul<em>+40 GOLD</em></h3><p>Strip a wreck for parts and sell them at the depot</p></div></button>`;
    if (k.startsWith('evo:')) { const w = k.slice(4), E = EVOS[w]; return `<button class="card evo" data-k="${k}"><div class="ic">${ICON[w]}</div><div><h3>${E.name}<em>EVOLVE</em></h3><p>${UPS[w].name} + ${UPS[E.needs].name}: ${E.say}</p></div></button>`; }
    const L = up[k] + 1;
    return `<button class="card${L === 1 ? ' new' : ''}" data-k="${k}"><div class="ic">${ICON[k]}</div><div><h3>${UPS[k].name}<em>${L === 1 ? 'NEW' : 'LV ' + L}</em></h3><p><i class="trig">${UPS[k].tag}</i>${UPS[k].say[L - 1]}</p></div></button>`;
  }).join('');
  $('pick').hidden = false;
}
function choose(k) {
  if (demo) { if (k === 'evo' && demo.proto) { protoTakeRam(); return; } draftChoose(+k); return; }   // the demo's own picker (the lab's evolution card)
  if (state !== 'pick') return;
  if (k === 'repair') player.hp = Math.min(player.maxHp, player.hp + 50);
  else if (k === 'gold') gold += 40;
  else if (k.startsWith('evo:')) { const w = k.slice(4); up.evo[w] = true; bigMoment(player.x, player.y, EVOS[w].name.toUpperCase() + '!', 1, 0.9); SFX.level(); }
  else { up[k]++; if (k === 'wheels') applySize(); }
  $('pick').hidden = true; state = 'play'; player.inv = 0.6; renderUps();
  if (!k.startsWith('evo:')) pops.push({ x: player.x, y: player.y - 50, text: k === 'repair' ? 'WELDED!' : k === 'gold' ? '+40 GOLD' : `${UPS[k].name.toUpperCase()}!`, col: '#5be37d', t: 0 });
  parts.push({ k: 'ring', x: player.x, y: player.y, t: 0, life: 0.5, R: 200 });
  if (pendingLv > 0) { pickAt = time + 1; pickBy = time + 5; }   // another level waiting: the next calm moment, a second from now at the earliest
}
$('cards').addEventListener('click', e => { const b = e.target.closest('.card'); if (b) choose(b.dataset.k); });

// ============ weapons ============
function nearestEnemy(x, y, range, skip) {   // returns {k} for a car or {boss, p} for the rig's nearest point
  let best = null, bd = range;
  for (const k of cars) { if (k.dead || (skip && skip.has(k))) continue; const d = Math.hypot(k.x - x, k.y - y); if (d < bd) { bd = d; best = { x: k.x, y: k.y, vx: k.vx, vy: k.vy, k }; } }
  if (boss && !boss.dead && !(skip && skip.has(boss))) for (const p of bossPoints()) { const d = Math.hypot(p.x - x, p.y - y) - 30; if (d < bd) { bd = d; best = { x: p.x, y: p.y, vx: boss.vx, vy: boss.vy, boss: true }; } }
  return best;
}
function hitAt(t, n, src, word, fx, fy) { if (t.boss) damageBoss(n, src, fx ?? t.x, fy ?? t.y); else damage(t.k, n, src, word, fx, fy); }
let cannonT = 1, cannonA = 0, cannonFlash = 0;
function weapons(dt) {
  gunFlash = Math.max(0, gunFlash - dt); cannonFlash = Math.max(0, cannonFlash - dt);
  if (arm.cannon) {   // the cannon (armoury): every couple of seconds, a shell at the nearest car in a cone ahead of your nose
    cannonT -= dt; let tgt = null, bd = 560;   // the turret turns all the way round: the nearest car, wherever it is
    for (const k of cars) { if (k.dead) continue; const d = Math.hypot(k.x - player.x, k.y - player.y); if (d < bd && d > 45) { bd = d; tgt = k; } }
    if (!tgt && boss && !boss.dead) for (const q of bossPoints()) { const d = Math.hypot(q.x - player.x, q.y - player.y); if (d < bd) { bd = d; tgt = { x: q.x, y: q.y, vx: boss.vx, vy: boss.vy }; } }
    const aim = tgt ? Math.atan2(tgt.y + tgt.vy * bd / 1000 - player.y, tgt.x + tgt.vx * bd / 1000 - player.x) : player.a;
    cannonA += angDiff(cannonA, aim) * ease(tgt ? 18 : 6, dt);
    if (tgt && cannonT <= 0 && Math.abs(angDiff(cannonA, aim)) < 0.25) {
      cannonT = [0, 1.6, 1.3, 1][arm.cannon]; cannonFlash = 0.1;
      rockets.push({ x: player.x + Math.cos(cannonA) * 30, y: player.y + Math.sin(cannonA) * 30, a: cannonA, sp: 1150, t: 0, dmg: [0, 80, 110, 150][arm.cannon], R: [0, 90, 110, 130][arm.cannon], straight: true, shell: true, src: 'cannon' });
      player.vx -= Math.cos(cannonA) * 25; player.vy -= Math.sin(cannonA) * 25; SFX.thud(); SFX.pop(); shake = Math.max(shake, 2.5);
    }
  }
  const pv = Math.hypot(player.vx, player.vy), ca = Math.cos(player.a), sa = Math.sin(player.a);
  // machine gun (AIM): the roof gun only fires at cars in a cone ahead of your nose. Point the car; drift to sweep it
  if (up.gun) {
    gunT -= dt;
    const L = up.gun, R = 400 + 25 * L;
    let tgt = null, bd = R;
    for (const k of cars) { if (k.dead) continue; const dx = k.x - player.x, dy = k.y - player.y, d = Math.hypot(dx, dy); if (d < bd && Math.abs(angDiff(player.a, Math.atan2(dy, dx))) < 0.75) { bd = d; tgt = { x: k.x, y: k.y, vx: k.vx, vy: k.vy }; } }
    if (!tgt && boss && !boss.dead) for (const q of bossPoints()) { const dx = q.x - player.x, dy = q.y - player.y, d = Math.hypot(dx, dy) - 30; if (d < bd && Math.abs(angDiff(player.a, Math.atan2(dy, dx))) < 0.75) { bd = d; tgt = { x: q.x, y: q.y, vx: boss.vx, vy: boss.vy }; } }
    if (tgt) {
      const d = Math.hypot(tgt.x - player.x, tgt.y - player.y), lead = d / 950;
      const aim = Math.atan2(tgt.y + tgt.vy * lead - player.y, tgt.x + tgt.vx * lead - player.x);
      turretA += angDiff(turretA, aim) * ease(20, dt);
      if (gunT <= 0) {
        gunT = 0.2 * Math.pow(0.88, L - 1);
        const n = L >= 5 ? 3 : L >= 3 ? 2 : 1, dmg = 10 + 4 * L;
        for (let i = 0; i < n; i++) {
          const a = turretA + (n === 3 ? (i - 1) * 0.12 : 0) + rand(-0.03, 0.03), off = n === 2 ? (i ? 5 : -5) : 0;
          bullets.push({ x: player.x + Math.cos(turretA) * 20 - Math.sin(turretA) * off, y: player.y + Math.sin(turretA) * 20 + Math.cos(turretA) * off, vx: Math.cos(a) * 950 + player.vx * 0.5, vy: Math.sin(a) * 950 + player.vy * 0.5, t: 0, dmg });
        }
        gunFlash = 0.05; SFX.gun();
      }
    } else turretA += angDiff(turretA, player.a) * ease(6, dt);
  }
  // flamethrower (DRIFT): while you slide, a jet of fire from the tail sweeps with it; from level 3 the slide leaves a fire trail
  const tail = arm.flamer && cars.find(k => !k.dead && Math.hypot(k.x - player.x, k.y - player.y) < 200 && Math.abs(angDiff(player.a + Math.PI, Math.atan2(k.y - player.y, k.x - player.x))) < 0.6);   // the flamethrower also scorches anything right on your tail
  if (up.flame && pv > 120 && !player.air && (player.slip > 0.3 || tail)) {
    const L = up.flame, R = (130 + 20 * L) * (evo('flame') ? 1.5 : 1), lat = -sa * player.vx + ca * player.vy, fa = player.slip > 0.3 ? player.a + Math.PI - Math.sign(lat || 1) * 0.55 : Math.atan2(tail.y - player.y, tail.x - player.x);
    const tx = player.x - ca * 26 * player.size, ty = player.y - sa * 26 * player.size;
    for (let i = 0; i < 2; i++) { const a = fa + crand(-0.3, 0.3), sp = crand(R * 2.2, R * 3); parts.push({ k: 'fire', x: tx, y: ty, vx: Math.cos(a) * sp + player.vx * 0.5, vy: Math.sin(a) * sp + player.vy * 0.5, t: 0, life: crand(0.25, 0.38), size: crand(7, 12) }); }
    flameT -= dt;
    if (flameT <= 0) {
      flameT = 0.2; const dmg = 9 + 4 * L; let any = false;
      for (const k of cars) { if (k.dead) continue; const dx = k.x - tx, dy = k.y - ty, d = Math.hypot(dx, dy); if (d < R + k.r && Math.abs(angDiff(fa, Math.atan2(dy, dx))) < 0.55) { damage(k, dmg, 'flame', 'TOASTED!'); any = true; } }
      if (boss && !boss.dead) for (const q of bossPoints()) { const dx = q.x - tx, dy = q.y - ty; if (Math.hypot(dx, dy) < R + q.r && Math.abs(angDiff(fa, Math.atan2(dy, dx))) < 0.6) { damageBoss(dmg, 'flame', q.x, q.y); any = true; break; } }
      if (any) SFX.flame();
    }
    if (L >= 3) { trailT -= dt; if (trailT <= 0) { trailT = 0.15; fires.push({ x: tx, y: ty, r: 32, t: 0, life: L >= 5 ? 2.2 : 1.4, mine: true }); } }
  }
  // bullets
  for (const b of bullets) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    for (const k of cars) if (!k.dead && Math.hypot(k.x - b.x, k.y - b.y) < k.r + 5) { b.dead = true; damage(k, b.dmg, b.src || 'gun', 'SHREDDED!', b.x - b.vx * 0.02, b.y - b.vy * 0.02); k.vx += b.vx * 0.015; k.vy += b.vy * 0.015; SFX.ping(); for (let i = 0; i < 3; i++) parts.push({ k: 'spark', x: b.x, y: b.y, vx: -b.vx * 0.2 + crand(-160, 160), vy: -b.vy * 0.2 + crand(-160, 160), t: 0, life: 0.18 }); break; }
    if (!b.dead && boss && !boss.dead) for (const p of bossPoints()) if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + 4) { b.dead = true; damageBoss(b.dmg, 'gun', b.x, b.y); SFX.ping(); parts.push({ k: 'spark', x: b.x, y: b.y, vx: crand(-160, 160), vy: crand(-160, 160), t: 0, life: 0.18 }); break; }
    if (!b.dead) for (const br of drums) if (!br.gone && Math.hypot(br.x - b.x, br.y - b.y) < br.r + 3) { b.dead = true; drumBoom(br); break; }
    if (!b.dead) for (const cr of crates) if (!cr.gone && Math.hypot(cr.x - b.x, cr.y - b.y) < cr.r) { b.dead = true; breakCrate(cr); break; }
    if (!b.dead && blocked(b.x, b.y, 2)) { b.dead = true; parts.push({ k: 'spark', x: b.x, y: b.y, vx: crand(-120, 120), vy: crand(-120, 120), t: 0, life: 0.15 }); }
  }
  bullets = bullets.filter(b => !b.dead && b.t < 0.5);
  // rockets
  for (const m of rockets) {
    m.t += dt; if (m.t < 0) { m.x = player.x; m.y = player.y; continue; }
    const tg = boss && !boss.dead && Math.hypot(boss.x - m.x, boss.y - m.y) < 900 ? bossPoints().reduce((q, p) => Math.hypot(p.x - m.x, p.y - m.y) < Math.hypot(q.x - m.x, q.y - m.y) ? p : q) : nearestEnemy(m.x, m.y, 850);   // homes on whatever part of a boss is nearest: no free hits on a weak spot
    if (tg && m.t > 0.15 && !m.straight) m.a += clamp(angDiff(m.a, Math.atan2(tg.y - m.y, tg.x - m.x)), -5.5 * dt, 5.5 * dt);   // rockets home; cannon shells fly straight
    if (!m.straight) m.sp = Math.min(720, m.sp + 900 * dt);
    m.x += Math.cos(m.a) * m.sp * dt; m.y += Math.sin(m.a) * m.sp * dt;
    if (cchance() < 0.45) parts.push({ k: 'puff', x: m.x - Math.cos(m.a) * 10, y: m.y - Math.sin(m.a) * 10, vx: crand(-15, 15), vy: crand(-15, 15), t: 0, life: crand(0.3, 0.5), size: crand(4, 6) });   // a thin trail, not a smokescreen
    const hitK = cars.find(k => !k.dead && Math.hypot(k.x - m.x, k.y - m.y) < k.r + 8);
    const hitB = boss && !boss.dead && bossPoints().some(p => Math.hypot(p.x - m.x, p.y - m.y) < p.r + 6);
    if (hitK || hitB || m.t > 3 || blocked(m.x, m.y, 4)) {
      m.dead = true; smallBoom(m.x, m.y, m.R);
      const ms = m.src || 'rocket';
      if (hitB) damageBoss(m.dmg, ms, m.x, m.y);
      const mw = m.shell ? 'BLASTED!' : 'BOOM!';
      for (const k of cars) { if (k.dead) continue; const d = Math.hypot(k.x - m.x, k.y - m.y); if (k === hitK) damage(k, m.dmg, ms, mw, m.x - Math.cos(m.a) * 20, m.y - Math.sin(m.a) * 20); else if (d < m.R) damage(k, m.dmg * 0.5, ms, mw, m.x, m.y); if (!k.dead && d < m.R) { const f = 260 * (1 - d / m.R) + 80; k.vx += (k.x - m.x) / (d || 1) * f; k.vy += (k.y - m.y) / (d || 1) * f; k.frag = Math.max(k.frag, 0.7); } }
      for (const b of drums) if (!b.gone && Math.hypot(b.x - m.x, b.y - m.y) < m.R * 0.6) b.fuse = b.fuse || 0.1;
    }
  }
  rockets = rockets.filter(m => !m.dead);
  arsenal(dt);
}

// ============ gang tricks: harpoons and firebombs ============
function bombWall(k) {   // five shells in a line across your path, one slot left out: the gap is the way through
  const a = Math.hypot(player.vx, player.vy) > 60 ? Math.atan2(player.vy, player.vx) : player.a, nx = -Math.sin(a), ny = Math.cos(a);
  const cx = player.x + player.vx * 0.95, cy = player.y + player.vy * 0.95, gap = 1 + Math.floor(grand() * 4);   // never an end slot
  for (let i = 0; i < 6; i++) if (i !== gap) { const o = (i - 2.5) * 130; bombs.push({ sx: k.x, sy: k.y, tx: cx + nx * o, ty: cy + ny * o, t: 0, T: 0.95, shell: true }); }
  SFX.whoosh();
}
function updateGangWeapons(k, dt, d) {
  k.cool -= dt;
  if (k.kind === 'harpoon') {
    if (k.aimT > 0) {
      k.aimT -= dt; if (k.aimT > 0.2) k.aimA = Math.atan2(player.y - k.y, player.x - k.x);
      if (k.aimT <= 0) { harpoons.push({ x: k.x, y: k.y, vx: Math.cos(k.aimA) * 950, vy: Math.sin(k.aimA) * 950, t: 0, owner: k }); k.cool = rand(4, 5.5); SFX.twang(); }
    } else if (k.cool <= 0 && d > 150 && d < 450 && !lineBlocked(k.x, k.y, player.x, player.y)) { k.aimT = 0.8; k.aimA = Math.atan2(player.y - k.y, player.x - k.x); }
  } else if (k.kind === 'bomber' && k.cool <= 0 && d < 600) {
    k.cool = k.T.elite ? 2.6 + rand(1.3, 1.9) : rand(3.5, 5);
    if (k.T.elite) { k.reloadT = 2.6; recordRunEvent('boss_window', { kind: 'bombard' }); pops.push({ x: k.x, y: k.y - 80, text: 'RELOADING · RAM IT!', col: '#5be37d', t: 0, small: 1 }); }   // the Bombardier's window: after each volley it slows to reload
    if (k.T.elite && STG().meet === 2 && (k.volleys = (k.volleys || 0) + 1) % 2 === 0) bombWall(k);   // the second meeting: every other volley is a wall with one gap
    else for (let i = 0; i < (k.T.elite ? 3 : 1); i++) bombs.push({ sx: k.x, sy: k.y, tx: player.x + player.vx * (0.9 + i * 0.25) + (i ? rand(-90, 90) : 0), ty: player.y + player.vy * (0.9 + i * 0.25) + (i ? rand(-90, 90) : 0), t: -i * 0.15, T: 0.9, shell: k.T.elite }); SFX.whoosh();   // the Bombardier throws three, and they hurt where they land
  }
}
