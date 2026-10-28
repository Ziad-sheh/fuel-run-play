'use strict';
// Wasteland Drift · tips.js: first-run teaching and the pause menu.
// Each tip shows once, the first time its moment comes up, and is remembered in the save. They queue so they never
// overlap each other or a banner. The pause menu holds sound, music and steering, and the game pauses itself when
// you leave the app.
// Classic scripts sharing one global scope, loaded in order by index.html.

save.tips = save.tips || {};
let tipQ = [], tipT = 0, tipNow = null, tipGap = 0;
function tip(id, text) {
  if (save.tips[id] || tipQ.some(q => q.id === id) || (tipNow && tipNow.id === id)) return;
  tipQ.push({ id, text });
}
function updateTips(dt) {
  if (tipNow) { tipT -= dt; if (tipT <= 0) { $('tip').classList.remove('on'); tipNow = null; tipGap = 5; } return; }
  tipGap -= dt;
  if (!tipQ.length || tipGap > 0 || banner || state !== 'play') return;
  tipNow = tipQ.shift(); save.tips[tipNow.id] = true; writeSave();
  $('tipLabel').textContent = 'TIP'; $('tipText').textContent = tipNow.text; $('tip').classList.add('on'); tipT = 3.8;
}
function hint(text, secs = 3.2) {   // an event's how-to line: in the tip slot at the bottom, every time, so the top of the screen stays clear for what's coming
  if (tipNow && tipNow.id !== '_hint') { delete save.tips[tipNow.id]; tipQ.unshift(tipNow); }   // a tip it cuts off comes back later
  tipNow = { id: '_hint' }; tipT = secs; $('tipLabel').textContent = 'HOW'; $('tipText').textContent = text; $('tip').classList.add('on');
}
function clearTips() { tipQ = []; tipNow = null; tipT = 0; $('tip').classList.remove('on'); }
const seen = { drift: false, road: false };
function watchTips() {   // the lessons, each the first time its moment comes; stage 1 teaches them in order
  if (cars.some(k => !k.dead && !k.flee && Math.hypot(k.x - player.x, k.y - player.y) < 380)) tip('nose', 'HIT RAIDERS WITH YOUR NOSE · EACH PIP IS ONE HIT');
  if (wrecks > 0) tip('fuel', 'WRECKED RAIDERS SPILL FUEL · GRAB THE CANS');
  if (cars.some(k => (k.mode === 'tell' || k.mode === 'wind' || k.mode === 'ram') && Math.hypot(k.x - player.x, k.y - player.y) < 400)) tip('attack', 'RED = AN ATTACK · DODGE IT OR HIT THEM FIRST');
  if (hurtTotal > 0) tip('leak', 'HITS ON YOUR SIDES OR BACK LEAK FUEL');
  if (wrecks >= 3) tip('side', 'HIT A RAIDER IN THE SIDE FOR DOUBLE');
  if (wrecks >= 2) tip('wall', 'RAIDERS THAT HIT WALLS OR ROCKS ARE WRECKED');
  if (time > 9 && !seen.drift && player.slip < 0.3 && wrecks >= 4) tip('drift', 'FLICK THE WHEEL AT SPEED TO DRIFT · YOUR TAIL HITS FOR TWO');
  if (player.slip > 0.4) seen.drift = true;
  if (nitro >= 1) tip('nitro', `NITRO READY: TAP THE ORANGE BUTTON · ${CARS[player.car].move}`);
  if (drums.some(b => !b.gone && inView(b.x, b.y, -40))) tip('drum', 'ORANGE RING = IT BLOWS UP · LEAD THEM THROUGH IT');
  if (inSand(player)) tip('sand', 'SOFT SAND SLOWS YOU DOWN · STAY ON HARD GROUND');
  if (player.onRoad && time > 4) tip('road', 'THE OLD ROAD IS FASTER THAN THE SAND');
  if (ramps.some(R => inView(R.x, R.y, -60))) tip('ramp', 'HIT RAMPS FAST TO JUMP OVER THEM');
  if (walls.some(W => W.station && inView(W.x + W.w / 2, W.y + W.h / 2, -60))) tip('station', 'RAM THE GAS STATION WHEN THEY CROWD ROUND IT');
  if (onRough(player)) tip('rough', 'ROCKY GROUND: LESS GRIP. THEY SLIDE ON IT TOO');
  if (cars.some(k => k.pincer)) tip('pincer', 'PINCER! DRIFT OR NITRO OUT OF THE SQUEEZE: THEY HIT EACH OTHER');
}

// ============ pause ============
let pausedFrom = null;
function pauseGame() {
  if (state !== 'play') return;
  pausedFrom = state; state = 'paused'; touches.clear(); bankGold();
  $('pause').hidden = false; $('stageCard').hidden = true; renderPause();   // the stage card waits behind the menu; its clock is held while paused
}
function resumeGame() {
  if (state !== 'paused') return;
  state = pausedFrom || 'play'; pausedFrom = null; $('pause').hidden = true; if (stageCardT > 0) $('stageCard').hidden = false; last = performance.now();
}
function renderPause() {
  $('pSound').textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`; $('pMusic').textContent = `MUSIC: ${save.music === false ? 'OFF' : 'ON'}`; $('pFx').textContent = `EFFECTS: ${save.lowfx ? 'LIGHT' : 'FULL'}`;
  renderChips();
}
function setMuted(m) { muted = m; try { localStorage.setItem('sdlab_mute', muted ? '1' : '0'); } catch (e) {} if (master) master.gain.value = muted ? 0 : 0.9; }
$('pauseBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pauseGame(); });
$('pResume').addEventListener('click', resumeGame);
$('pRestart').addEventListener('click', () => { $('pause').hidden = true; if (demo) { demoRetry(); return; } state = 'play'; start(); });   // in the demo: a fresh run, new build
$('pQuit').addEventListener('click', () => { $('pause').hidden = true; if (demo) { demoOpen(); return; } bankGold(); state = 'menu'; newGame(); $('hud').hidden = true; $('menu').hidden = false; clearTips(); renderTitleCar(); });
$('pSound').addEventListener('click', () => { setMuted(!muted); renderPause(); });
$('pMusic').addEventListener('click', () => { save.music = save.music === false; writeSave(); renderPause(); });
$('pFx').addEventListener('click', () => { save.lowfx = !save.lowfx; writeSave(); renderPause(); });   // for older phones
$('resetTips').addEventListener('click', () => { save.tips = {}; writeSave(); $('resetTips').textContent = 'Tips reset'; });
$('openAll').addEventListener('click', () => { save.stage = STAGES.length - 1; writeSave(); $('openAll').textContent = 'All open'; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !window.noAutoPause) pauseGame(); });   // noAutoPause: the test harness runs with the pane hidden
function appAway(away) {   // the phone app went to the background (or came back): pause the run, and let the sound sleep while away
  if (away) { if (state === 'play' && !window.noAutoPause) pauseGame(); keys.ArrowLeft = keys.ArrowRight = false; touches.clear(); if (ac && ac.state === 'running') ac.suspend(); }
  else if (ac && ac.state === 'suspended') ac.resume();
}
document.addEventListener('visibilitychange', () => appAway(document.hidden));
try { const App = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (App) { App.addListener('pause', () => appAway(true)); App.addListener('resume', () => appAway(false)); } } catch (e) {}   // inside the native app shell, its own pause/resume (Android's WebView may not report hidden)
addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'p') { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); } });

// ============ the soundtrack follows the action ============
// cruising when it's quiet, the chase when a pack or an ambush is on you, the boss theme when one is out
let musicLvl = -1;
const music = (fn, ...a) => { if (window.Music && audio.music) try { Music[fn](...a); } catch (e) {} };
function musicTick() {
  if (!window.Music || !audio.music) return;
  let lvl = 0;
  if (state === 'play' || state === 'pick') lvl = boss && !boss.dead || bullIn ? 3 : ambushOn() || cars.filter(k => !k.dead && !k.flee && Math.hypot(k.x - player.x, k.y - player.y) < 650).length >= 4 ? 2 : 1;
  if (lvl !== musicLvl) { music('setIntensity', lvl); musicLvl = lvl; }
  const m = muted || save.music === false || state === 'paused';
  if (m !== musicTick.m) { music('setMuted', m); musicTick.m = m; }
}
addEventListener('resize', () => { if (innerWidth > innerHeight && innerHeight < 500 && state === 'play') pauseGame(); });   // turned sideways mid-run: pause under the rotate card
