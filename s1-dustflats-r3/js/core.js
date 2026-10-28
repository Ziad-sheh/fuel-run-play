'use strict';
// Fuel Run · core.js: setup, tuning, settings, upgrade icons, synthesised sound, halftone patterns. (Forked from Wasteland Drift.)
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ setup ============
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let DPR = 1, VW = 0, VH = 0, ZOOM = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2); VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  ZOOM = Math.min(VW / 520, VH / 960);   // base zoom: close enough on a phone to see faces and spikes; pulls back a little at speed, in a crowd and in the boss fight
}
addEventListener('resize', resize); resize();
const TAU = Math.PI * 2, CAR = 1.25;
const calmMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // the phone asks for less motion: softer shakes
let gameRng = null;   // a prototype-lab run's own gameplay random numbers (set by demoStart); null everywhere else: the shared Math.random, exactly as before
const grand = () => gameRng ? gameRng() : Math.random();
const rand = (a, b) => a + grand() * (b - a), pick = a => a[Math.floor(grand() * a.length)];
// A shuffle that a lab run can replay anywhere: a fixed n-1 draws (a sort with a random comparator calls it a different
// number of times in different browsers, and even in one as it warms up). Elsewhere the old sort, exactly as before.
const shuffle = a => { if (!gameRng) return a.sort(() => grand() - 0.5); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(grand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let fxSeed = 0x2545F491;   // drawing's own random numbers (shake, flicker, grain): a frame drawn more or less often never shifts the game's
const fxRand = () => { fxSeed = (fxSeed + 0x6D2B79F5) | 0; let t = Math.imul(fxSeed ^ (fxSeed >>> 15), 1 | fxSeed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }, fxr = (a, b) => a + fxRand() * (b - a);
// Effects spawned during play (sparks, dust, debris, scorch marks): in a lab run they draw from the effects stream, so a
// change to how a hit looks never shifts what the enemies do; elsewhere they stay on the shared stream, exactly as before.
const cchance = () => gameRng ? fxRand() : grand(), crand = (a, b) => a + cchance() * (b - a), cpick = a => a[Math.floor(cchance() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, ease = (r, dt) => 1 - Math.exp(-r * dt);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const INK = '#24160f', CREAM = '#fff4dc', FONT = '"Bangers", Impact, "Arial Black", sans-serif';
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ============ the locked feel ============
const SPEED = 385, GRIP = 4.5, TURN = 3.5;   // a notch faster than the Feel Lab
const PIP = 40;   // one hit on a raider: its health is shown as pips, one pip = PIP damage
const GANG = {   // they grip less than you: drift and they slide wide. hp is pips times PIP: a buggy takes two hits, a ram truck five. leak is the fuel their landed attack costs you, fuel the can they spill
  buggy:   { name: 'Spike buggy', hp: 80,  leak: 8,  fuel: 5,  r: 15, speed: 1.08, turn: 2.6, grip: 3.0, scale: 0.9,  ram: 1.25, gem: 1, gold: 1, can: 7,  chase: 0,  col: '#ffc83d', m: 0.7, wind: 0.65, lunge: 0.8 },
  ram:     { name: 'Ram truck',   hp: 200, leak: 16, fuel: 10, r: 22, speed: 0.9,  turn: 1.6, grip: 4.6, scale: 1.3,  ram: 1.3, gem: 4, gold: 3, can: 12, col: '#d8432f', armour: true, m: 2.2, wind: 0.9, lunge: 1.25 },
  harpoon: { name: 'Harpoon car', hp: 120, leak: 10, fuel: 7,  r: 17, speed: 1.0,  turn: 2.4, grip: 3.4, scale: 1.05, ram: 1,   gem: 2, gold: 2, can: 8,  col: '#2fa6a6', keep: 300, m: 1 },
  bomber:  { name: 'Bomb thrower', hp: 120, leak: 10, fuel: 7, r: 17, speed: 0.97, turn: 2.4, grip: 3.4, scale: 1.05, ram: 1,   gem: 2, gold: 2, can: 8,  col: '#8b4fd1', keep: 360, m: 1 },
  rig:     { name: 'THE WAR RIG', hp: 1400, leak: 20, fuel: 0, r: 34, speed: 0.95, turn: 1.5, grip: 4.8, scale: 2.0, ram: 1.6, gem: 0, gold: 30, can: 10, col: '#d8432f', armour: true, m: 6, wind: 0.75, lunge: 1.4, elite: true, art: 'ram',
             how: 'MAKE IT CHARGE INTO ROCKS · THEN RAM ITS SIDES' },
  bombard: { name: 'THE BOMBARDIER', hp: 1000, leak: 12, fuel: 0, r: 30, speed: 0.9, turn: 2, grip: 3.6, scale: 1.8, ram: 1.2, gem: 0, gold: 30, can: 10, col: '#8b4fd1', keep: 360, m: 4, elite: true, art: 'bomber',
             how: 'CHASE IT DOWN AND RAM IT · DODGE THE FIREBOMBS' },
  tanker:  { name: 'FUEL TANKER', hp: 240, leak: 14, fuel: 12, r: 30, speed: 0.8, turn: 1.4, grip: 4.5, scale: 1.8, ram: 1.4, gem: 0, gold: 40, can: 12, col: '#e8a23a', armour: true, m: 5, art: 'ram', convoy: true },
  scrap:   { name: 'Scrap bike',  hp: 40,  leak: 3,  fuel: 0,  r: 11, speed: 1.12, turn: 3.4, grip: 3.4, scale: 0.6,  ram: 0.6, gem: 1, gold: 0, can: 2,  chase: 0,  col: '#a7a39a', m: 0.35, light: true },   // the prototype's light fodder: one pip, light enough to shove, a pack at a time; no fuel (raiders and caches refuel you)
  polecat: { name: 'Pole-cat',    hp: 80,  leak: 8,  fuel: 5,  r: 15, speed: 1.06, turn: 2.6, grip: 3.0, scale: 0.95, ram: 1.1, gem: 2, gold: 1, can: 7,  chase: 0,  col: '#e8b13a', m: 0.75, wind: 0.65, lunge: 0.8, vault: true },
};
const FUEL_RUN = true;   // this build is Fuel Run: switches off Wasteland Drift's storm, Fury, tricks and bounties
let control = 'tap', god = false, fast = false;
let demo = null, demoStage = null, demoSnap = null;   // the two-stage demo (demo.js): the run's context, its stage, the campaign save set aside   // a real run by default; the developer panel can switch on the test helpers
try {
  const c = JSON.parse(localStorage.getItem('fr_settings') || localStorage.getItem('sdlab_feel') || '{}');
  if (c.control === 'tap' || c.control === 'swipe') control = c.control;
  god = c.god === true; fast = c.fast === true;
} catch (e) {}
const saveSettings = () => { try { localStorage.setItem('fr_settings', JSON.stringify({ control, god, fast })); } catch (e) {} };
let best = 0, bestScore = 0; try { if (!localStorage.getItem('fr_best_v2')) { localStorage.removeItem('fr_bestScore'); localStorage.setItem('fr_best_v2', '1'); } best = +(localStorage.getItem('fr_best') || localStorage.getItem('wl_best')) || 0; bestScore = +localStorage.getItem('fr_bestScore') || 0; } catch (e) {}   // the old record came from test runs: start clean once
const CHIPS = {
  ctl: () => [['tap', '◀ Tap sides ▶', control === 'tap'], ['swipe', 'Swipe', control === 'swipe']],
  god: () => [['god1', "Can't die", god], ['god0', 'Real run', !god]],
  fast: () => [['fast1', 'Short leg', fast], ['fast0', 'Full leg', !fast]],
};
function renderChips() {
  for (const [k, fn] of Object.entries(CHIPS)) for (const id of [k, k + '2', k + '3']) if ($(id)) $(id).innerHTML = fn().map(([v, t, on]) => `<button class="chip${on ? ' on' : ''}" data-v="${v}">${t}</button>`).join('');
  $('bestLine').textContent = typeof bestLineText === 'function' ? bestLineText() : '';   // stars won so far (fuel.js)
}
for (const id of ['ctl', 'ctl2', 'ctl3', 'god', 'fast']) $(id).addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return; const v = b.dataset.v;
  if (v === 'tap' || v === 'swipe') control = v; else if (v.startsWith('god')) god = v === 'god1'; else fast = v === 'fast1';
  saveSettings(); renderChips();
});
$('howBtn').addEventListener('click', () => { $('how').hidden = !$('how').hidden; });
{ let taps = [];   // five quick taps on the logo open the developer panel
  $('logo').addEventListener('click', () => { const t = performance.now(); taps = taps.filter(x => t - x < 2000); taps.push(t); if (taps.length >= 5) { taps = []; $('dev').hidden = !$('dev').hidden; } }); }
renderChips();

// ============ upgrades ============
const sv = (body) => `<svg viewBox="0 0 32 32">${body}</svg>`;
const ICON = {
  gun:      sv('<rect x="3" y="12" width="17" height="9" fill="#ffd23f" stroke="#24160f" stroke-width="2"/><rect x="19" y="14" width="10" height="5" fill="#ffd23f" stroke="#24160f" stroke-width="2"/><rect x="6" y="19" width="6" height="9" fill="#ffd23f" stroke="#24160f" stroke-width="2"/>'),
  rocket:   sv('<path d="M4 16 L20 9 L29 16 L20 23 Z" fill="#c8693a" stroke="#24160f" stroke-width="2"/><path d="M4 16 L0 10 L2 16 L0 22 Z" fill="#ff9a1f"/><rect x="9" y="13" width="6" height="6" fill="#ffd23f" stroke="#24160f" stroke-width="1.5"/>'),
  flame:    sv('<path d="M16 2 C24 10 27 17 22 25 C19 30 13 30 10 25 C6 19 9 13 12 9 C12 14 14 15 15 15 C15 9 14 6 16 2 Z" fill="#ff7a1a" stroke="#24160f" stroke-width="2"/><path d="M16 15 C19 19 19 24 16 26 C13 24 13 19 16 15 Z" fill="#ffd23f"/>'),
  ram:      sv('<path d="M3 5 L29 11 L14 16 L29 21 L3 27 L9 16 Z" fill="#dfe6ec" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/>'),
  wheels:   sv('<circle cx="16" cy="16" r="13" fill="#3a2a22" stroke="#24160f" stroke-width="2"/><circle cx="16" cy="16" r="13" fill="none" stroke="#fff4dc" stroke-width="2" stroke-dasharray="4 2.5"/><circle cx="16" cy="16" r="6" fill="#c9b8a0" stroke="#24160f" stroke-width="2"/>'),
  caltrops: sv('<path d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z" fill="#9aa4ae" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/>'),
  repair:   sv('<path d="M13 4h6v9h9v6h-9v9h-6v-9H4v-6h9z" fill="#5be37d" stroke="#24160f" stroke-width="2"/>'),
  oil:      sv('<path d="M16 3 C22 11 26 16 26 21 A10 10 0 0 1 6 21 C6 16 10 11 16 3 Z" fill="#2a2433" stroke="#24160f" stroke-width="2"/><path d="M11 21 A5 5 0 0 0 16 26" fill="none" stroke="#c77dff" stroke-width="2.5"/>'),
  saw:      sv('<path d="M16 2 L19 8 L25 6 L24 12 L30 15 L25 19 L28 25 L21 24 L19 30 L15 25 L9 29 L9 22 L2 21 L7 16 L3 10 L10 10 L11 3 Z" fill="#dfe6ec" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="16" r="4" fill="#5c626a" stroke="#24160f" stroke-width="2"/>'),
  mortar:   sv('<rect x="10" y="6" width="12" height="18" rx="2" fill="#5c626a" stroke="#24160f" stroke-width="2"/><rect x="6" y="22" width="20" height="6" fill="#a9532c" stroke="#24160f" stroke-width="2"/><circle cx="16" cy="6" r="4" fill="#24160f"/>'),
  drone:    sv('<rect x="11" y="12" width="10" height="8" rx="2" fill="#7fd6ff" stroke="#24160f" stroke-width="2"/><path d="M4 8h8M20 8h8M4 24h8M20 24h8" stroke="#24160f" stroke-width="3"/><path d="M8 8v4M24 8v4M8 24v-4M24 24v-4" stroke="#24160f" stroke-width="2"/>'),
  emp:      sv('<rect x="12" y="4" width="8" height="20" rx="3" fill="#5c626a" stroke="#24160f" stroke-width="2"/><path d="M8 12 L13 12 M19 12 L24 12 M8 18 L13 18 M19 18 L24 18" stroke="#b87333" stroke-width="2.5"/><path d="M17 1 L11 14 L16 14 L13 28 L22 11 L17 11 Z" fill="#7fe7ff" stroke="#24160f" stroke-width="1.5"/>'),
  lance:    sv('<path d="M4 28 L24 8" stroke="#8d969e" stroke-width="3.5"/><path d="M22 4 L29 3 L28 10 Z" fill="#ff7a1a" stroke="#24160f" stroke-width="2"/><circle cx="23" cy="9" r="3.5" fill="#e8432f" stroke="#24160f" stroke-width="1.5"/>'),
  evo:      sv('<path d="M16 2 L20 12 L30 12 L22 18 L25 29 L16 22 L7 29 L10 18 L2 12 L12 12 Z" fill="#ffd23f" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/><path d="M16 9 L18 14 L23 14 L19 17 L20.5 22 L16 19 L11.5 22 L13 17 L9 14 L14 14 Z" fill="#ff7a1a"/>'),
  trick:    sv('<path d="M16 2 l3 8 8-3-4 8 7 4-8 2 2 8-7-5-6 6v-8l-8-1 6-6-5-6 8 1z" fill="#ff7a1a" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/>'),
};
// every weapon fires from a move you make with the car; the tag on its card names the move
const UPS = {
  gun:      { name: 'Machine Gun',  tag: 'AIM',       say: ['A roof gun fires at cars in front of your nose', 'More damage, fires faster', 'Twin barrels', 'More damage, fires faster', 'Triple spread'] },
  rocket:   { name: 'Rockets',      tag: 'DRIFT END', say: ['Let go of a drift: 1, 2 or 3 rockets for a blue, orange or purple one', 'One more rocket a drift', 'Bigger blast', 'One more rocket a drift', 'Harder hits'] },
  flame:    { name: 'Flamethrower', tag: 'DRIFT',     say: ['Drift and fire jets from your tail, sweeping with the slide', 'Longer flame, hotter', 'Drifting leaves a fire trail', 'Longer flame, hotter', 'The trail burns longer'] },
  ram:      { name: 'Spiked Ram',   tag: 'RAM',       say: ['Nose-first hits land much harder', 'Sharper', 'Sharper', 'Sharper', 'Tears through armour'] },
  wheels:   { name: 'Monster Wheels', tag: 'WEIGHT',  say: ['Bigger and heavier: rammers get crushed', 'Bigger. Hits hurt you less', 'Bigger. Your shoves hit harder', 'Bigger. Hits hurt you less', 'Maximum monster'] },
  caltrops: { name: 'Caltrops',     tag: 'DRIFT END', say: ['Let go of a drift and a spike strip drops across your line', 'Longer strip', 'Longer strip', 'Spikes hurt more', 'Spikes shred'] },
  oil:      { name: 'Oil Drops',    tag: 'DRIFT',     say: ['Drift and oil sprays from your tail: chasers spin out', 'Bigger slicks', 'Sprays more often', 'Bigger slicks', 'Slicks last twice as long'] },
  saw:      { name: 'Side Saws',    tag: 'SIDE',      say: ['Blades shred cars beside you, harder the faster you pass', 'Sharper', 'Bigger blades, longer reach', 'Sharper', 'Blades tear armour'] },
  mortar:   { name: 'Mortar',       tag: 'AIR',       say: ['Land a jump and shells rain on the nearest cars', 'Bigger blast', 'One more shell', 'Harder hits', 'One more shell'] },
  drone:    { name: 'Bomb Drone',   tag: 'TAKEDOWN',  say: ['Every takedown sends a drone to bomb another car', 'Bigger bombs', 'A second drone', 'Bigger bombs', 'A third drone'] },
  emp:      { name: 'EMP Coil',     tag: 'NEAR MISS', say: ['Dodge a car by a hair and it gets shocked and stunned', 'The shock spreads to cars next to it', 'Stronger shock', 'Wider spread', 'Lightning jumps car to car'] },
  lance:    { name: 'Thunder-sticks', tag: 'SIDE',    say: ['Throw exploding lances at cars riding beside you', 'Bigger blast', 'A lance each side', 'Throws faster', 'Two lances each side'] },
};
// evolutions: get a weapon to level 3, carry its partner, and the two fuse into something much nastier
const EVO_LV = 3;
const EVOS = {
  gun:      { needs: 'drone',    name: 'Hornet Swarm',     say: 'After every takedown your drones grow guns and hunt' },
  rocket:   { needs: 'mortar',   name: 'Doomsday Barrage', say: 'An orange or purple drift rains missiles on every car in sight' },
  flame:    { needs: 'oil',      name: 'Inferno Trail',    say: 'Your oil burns, and your flame reaches half as far again' },
  ram:      { needs: 'wheels',   name: 'Juggernaut Plough', say: 'Anything you hit nose-first at speed is wrecked, even armour' },
  saw:      { needs: 'caltrops', name: 'Buzzsaw Storm',    say: 'Letting go of a drift flings saw blades out of both sides' },
  emp:      { needs: 'lance',    name: 'Thunderdome',      say: 'Every near miss arcs lightning through the whole pack' },
};
const MAX_SLOTS = 6;   // you can carry six weapons at once
const SRC = { gun: ['gun', 'Machine gun'], rocket: ['rocket', 'Rockets'], flame: ['flame', 'Flamethrower'], ram: ['ram', 'Spiked ram'], crush: ['wheels', 'Monster wheels'], caltrops: ['caltrops', 'Caltrops'], oil: ['oil', 'Oil drops'], saw: ['saw', 'Side saws'], mortar: ['mortar', 'Mortar'], drone: ['drone', 'Bomb drone'], emp: ['emp', 'EMP coil'], lance: ['lance', 'Thunder-sticks'], trick: ['trick', 'Tricks & traps'] };
const SRC_COL = { gun: '#ffe680', rocket: '#ff9a3c', flame: '#ffb347', ram: '#ffffff', crush: '#c8ff7a', caltrops: '#d6dde3', oil: '#c77dff', saw: '#dfe6ec', mortar: '#ff7a1a', drone: '#7fd6ff', emp: '#7fe7ff', lance: '#ff5a46', trick: '#ffd23f' };
const BOLTS = { 2: 'SIDE ARMOUR', 4: 'BULL BAR', 6: 'ROOF CAGE', 8: 'QUAD EXHAUST', 10: 'HUB SPIKES', 12: 'BIG WING' };
const xpNeed = L => Math.round(8 + (L - 1) * 4 + Math.pow(L - 1, 1.5));   // only your takedowns drop XP: a card every 25-40 s of good driving, about eight a region

// ============ sound (synthesised) ============
// sound takes its randomness from its own generator: sounds are throttled on the audio clock, so if they drew from
// Math.random a seeded test run would drift with real time
const srand01 = (() => { let s = 0x9E3779B9; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
const srand = (a, b) => a + srand01() * (b - a), spick = a => a[Math.floor(srand01() * a.length)];
let ac = null, master = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('sdlab_mute') === '1'; } catch (e) {}
function silentWav() {   // iPhone mutes web audio on the silent switch; a looping silent <audio> started from a tap fixes it
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  let str = ''; b.forEach(x => str += String.fromCharCode(x)); return 'data:audio/wav;base64,' + btoa(str);
}
let unlockEl = null;
function audio() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    ac = new A();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 6;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = srand01() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  if (window.Music && !audio.music) { audio.music = true; try { Music.init(ac, master); Music.setVolume(0.42); } catch (e) { console.error(e); } }   // the soundtrack shares the master bus
  if (!unlockEl) { try { unlockEl = new Audio(silentWav()); unlockEl.loop = true; unlockEl.setAttribute('playsinline', ''); unlockEl.play().catch(() => {}); } catch (e) {} }
}
function tone(f0, f1, dur, vol, type = 'square', delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function nz(dur, vol, type = 'lowpass', f0 = 1400, f1 = f0, delay = 0, q = 1) {
  if (!ac) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, srand01() * 1.5); s.stop(t + dur + 0.02);
}
const thr = {};
const ok = (k, gap) => { if (!ac) return false; const n = ac.currentTime; if (n - (thr[k] || 0) < gap) return false; thr[k] = n; return true; };
let lastCrash = 0;
const SFX = {
  crash(combo = 1) {
    if (!ac) return;
    const p = srand(0.85, 1.15), v = ac.currentTime - lastCrash < 0.08 ? 0.6 : 1; lastCrash = ac.currentTime;
    nz(0.22, 0.55 * v, 'bandpass', 2400 * p, 500, 0, 1.4);
    tone(190 * p, 55, 0.18, 0.14 * v, 'square'); tone(247 * p, 70, 0.16, 0.1 * v, 'sawtooth');
    tone(105 * p, 30, 0.8, 0.6 * v, 'sine', 0.02); nz(1.1, 0.5 * v, 'lowpass', 1200, 90, 0.02);
    for (let i = 0; i < 6; i++) nz(0.05, 0.1 * v, 'highpass', 5000 + srand01() * 3000, 4000, 0.03 + srand01() * 0.3);
    if (combo > 1) for (let i = 0; i < Math.min(combo, 6); i++) tone(523 * Math.pow(1.26, i), 523 * Math.pow(1.26, i), 0.1, 0.07, 'square', 0.12 + i * 0.07);
  },
  pop() { if (!ok('pop', 0.05)) return; tone(120, 40, 0.3, 0.35, 'sine'); nz(0.35, 0.3, 'lowpass', 1500, 100); },
  thud() { if (!ok('thud', 0.06)) return; tone(110, 45, 0.2, 0.3, 'sine'); nz(0.15, 0.18, 'lowpass', 600, 150); },
  clang() { if (!ok('clang', 0.08)) return; tone(520, 380, 0.25, 0.1, 'triangle'); tone(780, 600, 0.2, 0.06, 'square'); nz(0.1, 0.2, 'bandpass', 3000, 1500, 0, 3); },
  hit() { tone(220, 60, 0.3, 0.25, 'sawtooth'); nz(0.25, 0.3, 'bandpass', 1500, 400, 0, 1.2); },
  shove() { if (!ok('shove', 0.05)) return; tone(160, 90, 0.12, 0.25, 'square'); nz(0.12, 0.3, 'bandpass', 1800, 700, 0, 2); },
  slice() { if (!ok('slice', 0.05)) return; nz(0.18, 0.35, 'highpass', 6000, 2500); tone(900, 300, 0.12, 0.08, 'sawtooth'); },
  crate() { if (!ok('crate', 0.04)) return; nz(0.12, 0.3, 'bandpass', 900, 300, 0, 2); tone(180, 90, 0.08, 0.1, 'square'); },
  close() { tone(900, 1400, 0.1, 0.06); },
  gun() { if (!ok('gun', 0.055)) return; nz(0.05, 0.16, 'highpass', 3500, 1500); tone(420, 120, 0.05, 0.05, 'square'); },
  ping() { if (!ok('ping', 0.04)) return; tone(1800, 1200, 0.04, 0.03, 'triangle'); },
  launch() { nz(0.4, 0.14, 'bandpass', 700, 2600, 0, 2); },
  flame() { if (!ok('flame', 0.12)) return; nz(0.18, 0.08, 'bandpass', 900, 500, 0, 0.8); },
  twang() { tone(300, 80, 0.35, 0.18, 'sawtooth'); tone(900, 200, 0.15, 0.06, 'square'); },
  whoosh() { nz(0.5, 0.15, 'bandpass', 400, 1800, 0, 1.5); },
  horn() { for (const f of [73.4, 110, 146.8]) tone(f, f * 0.98, 1.4, 0.18, 'sawtooth'); tone(73.4, 69, 1.2, 0.15, 'sawtooth', 1.6); tone(110, 104, 1.2, 0.12, 'sawtooth', 1.6); },   // a D power chord: in key with the soundtrack (D Phrygian)
  rumble() { if (!ok('rumble', 0.45)) return; tone(48, 38, 0.5, 0.25, 'sawtooth'); },
  gem() { if (!ok('gem', 0.035)) return; const f = srand(1300, 1700); tone(f, f * 1.4, 0.06, 0.035, 'sine'); },
  coin() { if (!ok('coin', 0.05)) return; tone(1600, 1600, 0.05, 0.035, 'square'); tone(2100, 2100, 0.08, 0.035, 'square', 0.05); },
  level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.14, 0.09, 'square', i * 0.08)); },
  nitro() { tone(180, 900, 0.5, 0.08, 'sawtooth'); nz(0.4, 0.15, 'bandpass', 600, 3500); },
  wreck(big = 1) { if (!ok('wreck', 0.04)) return; nz(0.18, 0.3 * big, 'bandpass', 1800, 500, 0, 1.2); tone(110, 40, 0.35, 0.3 * big, 'sine'); nz(0.5, 0.2 * big, 'lowpass', 900, 80, 0.02); },
  grind() { if (!ok('grind', 0.07)) return; nz(0.09, 0.12, 'bandpass', 3200, 2600, 0, 4); },
  rev() { if (!ok('rev', 0.15)) return; tone(90, 160, 0.6, 0.12, 'sawtooth'); },
  lunge() { if (!ok('lunge', 0.1)) return; tone(160, 380, 0.35, 0.12, 'sawtooth'); nz(0.3, 0.15, 'bandpass', 500, 2200, 0, 1.5); },
  ole() { tone(660, 990, 0.12, 0.08, 'square'); tone(990, 1320, 0.16, 0.07, 'square', 0.1); },
  boost(t) { tone(300, 300 + 400 * t, 0.3, 0.09, 'sawtooth'); nz(0.3, 0.12, 'bandpass', 800, 3000); },
  takedown() { if (!ok('takedown', 0.06)) return; tone(72, 30, 0.55, 0.5, 'sine'); nz(0.32, 0.5, 'bandpass', 1500, 280, 0, 1); tone(196, 58, 0.22, 0.14, 'square'); tone(523, 390, 0.3, 0.07, 'triangle', 0.02); nz(0.08, 0.28, 'highpass', 4500, 2200); },   // your hit: a deeper crunch with a metal ring
  can() { if (!ok('can', 0.05)) return; tone(260, 470, 0.09, 0.07, 'triangle'); tone(390, 660, 0.09, 0.06, 'triangle', 0.07); },   // a fuel can: two glugs
  fury(lv) { const f = 146.8 * Math.pow(2, (lv - 1) / 6); tone(f, f, 0.32, 0.1, 'sawtooth'); tone(f * 1.5, f * 1.5, 0.32, 0.08, 'sawtooth'); tone(f * 2, f * 2, 0.18, 0.05, 'square', 0.05); nz(0.25, 0.14, 'bandpass', 700, 2600, 0, 1.5); },   // a power-chord stab, a step higher each level (in D)
};

// ============ comic ink: halftone patterns ============
function dotPattern(col, size, r) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.fillStyle = col;
  g.beginPath(); g.arc(size / 2, size / 2, r, 0, TAU); for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill();
  return ctx.createPattern(c, 'repeat');
}
const DOTS = { ink: dotPattern('rgba(36,22,15,.38)', 7, 1.5), sand: dotPattern('rgba(150,75,25,.30)', 14, 3), fire: dotPattern('rgba(255,245,170,.85)', 9, 2.2), dark: dotPattern('rgba(36,22,15,.22)', 10, 2.2) };
