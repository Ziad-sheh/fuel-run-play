'use strict';
// Fuel Run · ui.js: HUD, screens, the main loop and the test hook.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ HUD and screens ============
let hudCache = {};
function setHUD(k, v, fn) { if (hudCache[k] !== v) { hudCache[k] = v; fn(v); } }
function updateHUD() {
  setHUD('hp', Math.floor(player.hp), v => { $('hpFill').style.width = `${v / player.maxHp * 100}%`; $('hpText').textContent = `FUEL ${v}`; $('hp').classList.toggle('low', v < player.maxHp * 0.25); });   // rounded down: "78" means at least 78
  setHUD('hpStar', player.hp >= player.maxHp * FUEL_STAR, v => $('hpStar').classList.toggle('on', v));   // the tick reads the unrounded tank, so it agrees with the star
  setHUD('ghost', Math.round(player.ghost), v => { $('hpGhost').style.width = `${v / player.maxHp * 100}%`; });
  if (depot) {   // the trip bar: how far down the road, then who you're fighting
    const pr = stageProgress(), fight = !!(stageBoss && !stageBoss.done), nm = bossCard().name;
    const label = fight ? `BEAT ${nm}` : `${demo ? demo.L.name : `STAGE ${stageIx + 1}`} · ${Math.round(pr * 100)}%${pr > 0.85 ? ' · BOSS AHEAD' : ''}`;
    setHUD('trip', Math.round(pr * 200), v => { $('tripFill').style.width = `${v / 2}%`; });
    setHUD('tripLabel', label, v => { $('tripLabel').textContent = v; });
    setHUD('tripFight', fight, v => { $('trip').classList.toggle('fight', v); });
  }
  setHUD('kills', wrecks, v => { $('kills').textContent = `${v} WRECKED`; });
  if (demo) $('chal').hidden = true; else $('chal').hidden = false;
  if (!demo) setHUD('chal', chalText() + (chal.failed ? 'x' : chalOk() ? 'v' : ''), () => { const c = $('chal'); c.textContent = chalText(); c.classList.toggle('failed', chal.failed); c.classList.toggle('done', !chal.never && chalOk()); });
  setHUD('gold', demo ? -1 : gold, v => { $('gold').hidden = v < 0; if (v >= 0) $('gold').textContent = `${v} GOLD`; });   // the demo pays no gold: no counter
  const E = boss ? null : cars.find(k => k.stageBoss && !k.dead);   // the stage boss's bar: one block per hit it can take
  setHUD('bossShow', !!(boss || E), v => { $('boss').hidden = !v; });
  const BC = bossCard();
  setHUD('bossName', boss && demo && BOSS_KINDS[boss.kind].weak ? `${demo.L.bossName} · ${BOSS_KINDS[boss.kind].demoHud(boss)}` : boss ? `${BC.name}${boss.kind === 'fortress' ? ' · ' + fortHud(boss) : boss.state === 'stunned' ? (boss.kind === 'bull' ? ' · RAM IT NOW! TANK x2' : ' · RAM IT NOW!') : ' · ' + BC.short}` : E ? `${BC.name} · ${BC.short}` : '', v => { if (v) $('bossName').textContent = v; });
  setHUD('boss', boss ? Math.round(clamp(boss.hp / boss.maxHp, 0, 1) * 100) : E ? Math.round(clamp(E.hp / E.maxHp, 0, 1) * 100) : -1, v => { if (v >= 0) $('bossFill').style.width = `${v}%`; });
  setHUD('segs', STG().segs, v => { $('bossBar').style.setProperty('--segs', v); });
}
function renderUps() { $('ups').innerHTML = ''; if (demo && demo.build) renderLoad(); else $('load').hidden = true; }
let lastP = -1, lastN = '';
function updateNitroBtn() {
  const on = nitroT > 0, credit = !on && nitro < 1 && demo && demo.build && demo.build.nitroCredits > 0, ready = !on && (nitro >= 1 || credit), p = Math.round((on ? nitroT / 1.8 : credit ? 1 : nitro) * 100), st = on ? 'on' : ready ? 'ready' : '';   // a banked Nitro Service counts as a full boost
  const b = $('nitroBtn'); if (p !== lastP) { b.style.setProperty('--p', p); lastP = p; } if (st !== lastN) { b.className = 'round ' + (st || 'idle'); lastN = st; }
}
$('nitroBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fireNitro(); });
$('gadgetBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); useGadget(); });
let round = 0;
function start() {   // (re)start the current stage
  audio(); clearTips(); newGame(); music('start'); musicLvl = -1; state = 'play'; round++; banner = null; showStageCard(stageIx);
  $('menu').hidden = true; $('over').hidden = true; $('pick').hidden = true; $('map').hidden = true; $('garage').hidden = true; $('hud').hidden = false; $('intro').hidden = true;
}
function startStage(i) { stageIx = clamp(i, 0, STAGES.length - 1); start(); }
let lastSum = null;   // what the results screen last showed, so the garage's BACK can bring it back
function results(cleared, bits, gained, bonus) {   // a stage cleared (its three stars, the gold it paid) or a stage lost (how far you got; you keep the gold)
  banner = null; lastSum = [cleared, bits, gained, bonus];
  const pr = Math.round(stageProgress() * 100), nx = nextBuy(), S = STG(), left = Math.floor(fuelLeft() * 100);   // rounded down, so "60%" and the star agree
  $('overTitle').textContent = cleared ? `STAGE ${stageIx + 1} CLEARED!` : outCause || 'WRECKED!';
  $('overTitle').style.color = cleared ? '#5be37d' : '#e8432f';
  const owned = cleared ? (save.stars[stageIx] || 0) | bits : 0;   // every star you own for this stage, the ones new this run popping in
  $('stars').hidden = !cleared; $('stars').innerHTML = [STAR.CLEAR, STAR.GOAL, STAR.FUEL].map((b, i) => `<i class="${owned & b ? 'on' : ''}${gained & b ? ' new' : ''}" style="--d:${(i + 1) * 0.15}s">★</i>`).join('');
  const mark = b => bits & b ? '★' : '☆';
  const rows = cleared ? [[`${mark(STAR.CLEAR)} Cleared`, '✓'], [`${mark(STAR.GOAL)} ${S.chal.text}`, chalOk() ? '✓' : chal.never ? '✕' : `${chal.n}/${chal.need}`], [`${mark(STAR.FUEL)} 60% fuel left`, `${left}%`],
      ['Raiders wrecked', wrecks], ['Gold earned', `+${gold.toLocaleString('en-US')}`], ['In the bank', save.gold.toLocaleString('en-US')]]
    : [['Got to', stageBoss ? 'the boss' : `${pr}% of the road`], ['Raiders wrecked', wrecks], ['Gold kept', `+${gold.toLocaleString('en-US')}`], ['In the bank', save.gold.toLocaleString('en-US')]];
  $('stats').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  const all = save.stars[stageIx] || 0, missing = !(all & STAR.GOAL) ? `★ left here: ${S.chal.text.toLowerCase()}` : !(all & STAR.FUEL) ? `★ left here: ${Math.ceil(player.maxHp * FUEL_STAR)} fuel (60%) when the boss falls: wreck more on the road, take fewer hits` : 'All three stars!';
  $('statline').textContent = cleared ? missing : lossAdvice(runState ? runState.totals : {}, runState && runState.lastLossSource, stageBoss ? stageBoss.kind : null);
  $('nextBuy').hidden = !nx; $('nextBuy').classList.toggle('can', !!(nx && nx.affordable));
  if (nx) $('nextBuy').innerHTML = `<span>${nx.affordable ? 'BUY NOW' : 'NEXT TO BUY'}: ${nx.name.toUpperCase()}<small>${nx.affordable ? fmtGold(nx.cost) : `${fmtGold(nx.cost - save.gold)} more to go`}${nx.goal ? ` · ${nx.goal.cost <= save.gold ? 'or the' : 'next car:'} ${nx.goal.name}, ${nx.goal.cost.toLocaleString('en-US')}` : ''}</small></span><em>▶</em>`;
  $('dmg').hidden = true;
  const more = cleared && stageIx < STAGES.length - 1;
  $('keep').hidden = !more; $('keep').textContent = `STAGE ${stageIx + 2} ▶`;
  $('again').textContent = cleared ? 'REPLAY' : 'RETRY'; $('again').className = more ? 'btn alt' : 'btn';
  $('over').hidden = false; $('hud').hidden = true;
}
function lossAdvice(T, src, bossKind) {   // one tip after a loss: the killing blow if there was one, else what drained the most, else how to get a wreck at all
  const L = T.loss || {}, n = k => Math.round(L[k] || 0), credited = T.credited || 0, ambient = T.ambient || 0;
  const blow = src && src !== 'drain' ? src : Object.keys(L).filter(k => k !== 'drain').sort((a, b) => (L[b] || 0) - (L[a] || 0))[0], big = blow && n(blow) >= 20;
  const by = {
    barrage: () => `The shelling took ${n('barrage')}: watch the red circles and drive through the gap they leave`,
    boss: () => ({ bomber2: `The Bombardier's shells took ${n('boss')}: leave the red circles early, then catch it while it reloads`, bull: `The Bull's charge took ${n('boss')}: when it lowers its head, turn hard off its line`, rig: `The War Rig took ${n('boss')}: it rams from behind, so get off the line behind you`, bombard: `The Bombardier took ${n('boss')}: stay out of the red circles and ram it as it reloads`, twin: `The Twin-Horse took ${n('boss')}: pull away when it flashes, then ram its back`, fortress: `The Fortress took ${n('boss')}: stay off its front and its red lines, and light the drums beside its guns` }[bossKind] || `The boss took ${n('boss')}: watch for its warning and get off its line`),
    storm: () => `The storm took ${n('storm')}: keep driving forward; it only catches a car that stops or turns back`,
    boarder: () => `A boarder siphoned ${n('boarder')}: drift hard, or ram something, to shake him off`,
    impact: () => `Hits on your sides took ${n('impact')}: hit them with your nose first, or get off their line`,
    drum: () => `Drums took ${n('drum')}: one blows just after you touch it, so hit it at speed and keep going`,
    fire: () => `Fire took ${n('fire')}: go round the flames`,
    ball: () => `The wrecking balls took ${n('ball')}: watch the swing and cross when it's away`, geyser: () => `Geysers took ${n('geyser')}: the ground glows before it blows`, rock: () => `Falling rocks took ${n('rock')}: the shadow shows where`, fall: () => `The ravine took ${n('fall')}: hit the ramp straight and fast`,
  };
  if (src && src !== 'drain' && by[src]) return by[src]();
  if (big && by[blow]) return by[blow]();
  const arena = demo && bossKind && { bull: "The Bull outlasted your tank: turn off its charge so it hits rock, then hit the tank on its back while it's dazed", bomber2: 'The Bombardier outlasted your tank: get close as its last shell lands, then hit the magazine while it reloads' }[bossKind];
  if (arena) return arena;   // the demo, dry in the arena: the fight in front of you, not the road you left
  if (credited === 0) return 'You ran dry without a wreck: drive your nose into a raider; two hits wreck a buggy and its fuel flies to you';
  if (ambient >= credited) return `${ambient} raiders died near you but not by you: only wrecks you cause yourself spill fuel`;
  return `You ran dry after ${credited} wrecks: hit raiders with your nose and take their fuel before the drain beats you`;
}
function summary() { if (lastSum) results(...lastSum); }   // the garage's BACK
function saveBest() {}
function legCleared() { stageCleared(); }
function gameOver() {
  if (!lockRunLoss(outCause || 'WRECKED!')) return;   // once: a second death callback changes nothing
  hideStageCard(); $('intro').hidden = true; introT = 0; slowT = 0; clearTips(); touches.clear(); keys.ArrowLeft = keys.ArrowRight = false;   // every card and tip goes with the run
  music('stinger', 'wrecked'); state = 'over'; updateHUD(); if (!demo) save.runs++; bankGold();
  const me = round; setTimeout(() => { if (round === me && state === 'over') { if (demo) demoResults(false); else results(false, 0, 0, 0); } }, 1100);
}
$('play').addEventListener('click', () => { audio(); openMap(); });
$('again').addEventListener('click', () => startStage(stageIx));
$('keep').addEventListener('click', () => startStage(stageIx + 1));
$('toMap').addEventListener('click', openMap);

// ============ loop ============
newGame();
let last = performance.now();
let frameErrors = 0;
function frameDt(now) { const dt = clamp((now - last) / 1000, 0, 1 / 30); last = now; return dt; }   // real seconds since the last frame: never negative, never a long stall
function advanceFrame(dt) {   // one frame of the game on real seconds: paused screens only draw; a hit-pause holds; slow motion slows the clock
  engineTick(dt); musicTick();   // the engine note follows your speed; the soundtrack follows the action
  if (state === 'pick' || state === 'cleared' || state === 'paused') { render(0); return; }
  if (freeze > 0) { freeze -= dt; render(0.001); return; }
  const sdt = slowT > 0 ? dt * 0.35 : dt; slowT = Math.max(0, slowT - dt);   // near-miss slow-mo
  const u0 = window.protoFrame ? performance.now() : 0; update(sdt / 2); update(sdt / 2); if (window.protoFrame) protoUpd = performance.now() - u0; render(sdt);
  if (state === 'play' || state === 'over') { updateHUD(); updateNitroBtn(); }
}
function frame(now) {
  requestAnimationFrame(frame);   // schedule first: one bad frame must never freeze the game
  const dt = frameDt(now);
  const f0 = window.protoFrame ? performance.now() : 0;
  try { advanceFrame(dt); if (window.protoFrame) protoFrame(now, performance.now() - f0); }
  catch (e) { if (frameErrors++ < 5) console.error(e); try { if (ctx.reset) ctx.reset(); else cv.width = cv.width; } catch (e2) {} }   // drop any half-finished drawing state
}
requestAnimationFrame(frame);

// test hook: run frames while the tab is hidden; s = -1..1 steering held for the frames
window.__lab = {
  get state() { return state; }, get player() { return player; }, get cars() { return cars; }, get boss() { return boss; }, get up() { return up; }, get dmgBy() { return dmgBy; }, get fury() { return fury; }, get heat() { return heat; }, get score() { return score; }, get tricks() { return tricks; }, get selfCrashes() { return selfCrashes; }, get level() { return level; }, get gold() { return gold; }, get depot() { return depot; }, get leg() { return leg; }, get stormY() { return stormY; },
  start, startStage, fireNitro, choose, gainXP, spawnBoss, set control(v) { control = v; },
  cards: () => [...$('cards').children].map(b => b.dataset.k),
  step(n, s = 0, draw = true) { for (let i = 0; i < n && (state === 'play' || state === 'over'); i++) { keys.ArrowLeft = s < 0; keys.ArrowRight = s > 0; update(1 / 120); update(1 / 120); if (draw) render(1 / 60); } keys.ArrowLeft = keys.ArrowRight = false; if (draw) updateHUD(); return { state, crashes, level, hp: Math.round(player.hp), time: +time.toFixed(1), cars: cars.length, boss: boss ? Math.round(boss.hp) : null }; },
};
// developer shortcuts for checking screens on a phone or in a browser: #play, #qa-cleared, #map
if (location.hash === '#play') startStage(0);
if (location.hash === '#qa-cleared') { startStage(0); gold = 212; player.hp = player.maxHp * 0.8; stageCleared(); }
if (location.hash === '#map') openMap();
if (new URLSearchParams(location.search).get('demo') === 'two-stage') demoOpen();
if (window.FR_ENTRY === 'lab' && !new URLSearchParams(location.search).get('lab')) demoOpen();   // the lab's own build (a separate link): it opens on the menu that holds the lab
if (new URLSearchParams(location.search).get('lab')) { demoOpen(); protoOpenFromLink(new URLSearchParams(location.search).get('lab')); }   // the prototype lab: ?lab=a | b | ram | stress   // the demo's own link opens its menu
if (typeof s1Boot === 'function') s1Boot();   // Sprint 1's Dust Flats variants: ?variant=road | hybrid (sprint1.js)
