'use strict';
// ============ Wasteland Drift: live soundtrack engine ============
// War drums, distorted guitars, a flame-guitar lead and brass, all synthesised with the Web Audio API.
// No samples and no other game globals. Key: D Phrygian (D Eb F G A Bb C), the flat second gives the menace.
//   Music.init(ctx, dest)  build the graph once        Music.start() / Music.stop(fade = 1.5)
//   Music.setIntensity(0..3)  applied on the next bar   Music.stinger('boss'|'victory'|'depot'|'wrecked'|'levelup')
//   Music.setVolume(0..1)  default 0.45                 Music.setMuted(bool)      Music.state()
// Scheduling follows "A Tale of Two Clocks": a 25 ms setInterval books notes about 0.15 s ahead on ctx.currentTime.
// The drone, bass, rhythm guitar, lead, wind, ghost tom strokes and chains are persistent sources driven by automation,
// so they allocate nothing per note. Accented drums, metal hits and brass are short-lived nodes that stop and disconnect
// themselves; a voice budget sheds ghost notes first if too many would ring at once.
// Mix: the music bus peaks below 0.9 (soft clip ceiling 0.89). The low end lives at 150-400 Hz and there is presence
// at 2-5 kHz, because the game is played on phone speakers that give almost nothing below 120 Hz.
// Variation is seeded: each 4-bar phrase picks pre-written grooves, riffs, chord moves and fills from small libraries.
(function (root) {
  // ---------- pitch helpers ----------
  const IN_KEY = [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0];          // D Phrygian, pitch classes relative to D
  const pc = s => ((s % 12) + 12) % 12;
  const snap = s => (IN_KEY[pc(s)] ? s : s - 1);                 // pull a stray note down into the key
  const fifth = s => (IN_KEY[pc(s + 7)] ? s + 7 : s + 6);        // diatonic fifth (A gets the tritone Eb: menace)
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const D2 = 38, D3 = 50, D4 = 62, D5 = 74;                      // MIDI notes
  const DEG = { '0': 0, '1': 1, '3': 3, '5': 5, '7': 7, '8': 8, 'a': 10, 'c': 12, 'z': -2, 'y': -4 };
  const V = c => (c >= '1' && c <= '9' ? (c.charCodeAt(0) - 48) / 9 : 0);   // velocity digit -> 0..1

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- pattern library: 16 steps per bar ('.' = nothing, '1'..'9' = velocity) ----------
  // Drum rows: D doom hit, L/M/H low/mid/high taiko, S metal clank (the snare), K chains (the hat), X crash.
  const BPM = [124, 124, 124, 132];
  const GROOVE = [
    [],
    [ // 1 cruising: a steady convoy pulse
      { D: '8.......7.......', L: '......5....4..5.', H: '....6.......6...', K: '4.3.4.3.4.3.4.3.' },
      { D: '8.....6.8.......', L: '....5.......5.5.', M: '..4...4...4...4.', S: '....4.......4...', K: '3.3.4.3.3.3.4.3.' },
      { D: '9.6.....9.6.....', L: '......4.......4.', H: '....5.......5...', K: '4.4.4.4.4.4.4.4.' },
    ],
    [ // 2 chase: full war drums
      { D: '9.......8.......', L: '7.5.6.5.7.5.6.5.', H: '....8.......8...', S: '....7.......7...', K: '.3.3.3.3.3.3.3.3' },
      { D: '9.....7.9.......', L: '7.57..5.7.57..5.', H: '....8.......8.6.', S: '....7.......7...', K: '3.3.3.3.3.3.3.3.' },
      { D: '9..6..7.9..6..7.', L: '..5..5....5..5..', M: '......6.......6.', S: '....8.......8...', K: '3.2.3.2.3.2.3.2.' },
    ],
    [ // 3 the Bull: double-time
      { D: '9...6...8...6...', L: '6.4.6.4.6.4.6.4.', M: '.3.3.3.3.3.3.3.3', H: '....9.......9...', S: '....8.......8...', K: '4.3.4.3.4.3.4.3.' },
      { D: '9.....7.9.....7.', L: '..6..6....6..6..', M: '.4..4..4.4..4..4', H: '....9.......9...', S: '....8..5....8...', K: '4.3.4.3.4.3.4.3.' },
      { D: '9.8.....9.8.....', L: '6464..64646464..', H: '....9.......9..7', S: '....8.......8...', K: '4.3.4.3.4.3.4.3.' },
    ],
  ];
  // the drums answer a guitar "call" riff in the second half of the bar
  const ANSWER = { D: '9...............', S: '....7...........', H: '........8.7.....', M: '...........8.7..', L: '..............99', K: '3.3.3.3.........' };
  const BREAK = [ // breakdown: four bars that empty out and climb back
    { D: '9...............', X: '5...............', L: '..........4.....' },
    { D: '9.......6.......', L: '..........4...4.' },
    { D: '9.......9.......', L: '....5.....5.5.5.', K: '3.3.3.3.3.3.3.3.' },
    { D: '9...............', L: '4.4.5.5.66667788', M: '........5.5.6.6.', S: '............5679' },
  ];
  const FILL_SHORT = [ // the last beat of a 4-bar phrase
    { at: 12, H: '............97..', L: '..............89' },
    { at: 12, D: '............9...', L: '............6789' },
    { at: 12, H: '............9.8.', M: '.............8.9' },
  ];
  const FILL_LONG = [ // the last two beats of an 8-bar phrase
    { at: 8, D: '........9.......', H: '........9.8.....', M: '...........8.7..', L: '.............8.9' },
    { at: 8, H: '........98......', M: '..........87....', L: '............6789' },
    { at: 8, D: '........9.......', H: '........9..8..7.', L: '.........9..8..9' },
  ];
  const FILL_BAR = { at: 0, D: '9.......9.......', L: '7.5.7.5.75757575', M: '........6.6.6.6.', H: '..............99' };
  const PICKUP = { L: '............5678', H: '..............79' };   // rising into a higher intensity

  // Rhythm guitar: r = X accented chug, x palm-muted chug, O ringing power chord, o short chord, '-' let ring, '.' mute.
  // p = degree under each onset (0 root, 1 flat second, 3 minor third, 5 fourth, 7 fifth, 8 flat sixth, a flat seventh).
  const RIFF = {
    gallop:  { r: 'X.xxX.xxX.xxO---', p: '0.000.000.001...' },
    pulse:   { r: 'X.x.x.X.x.x.X.x.', p: '0.0.0.0.0.0.a.1.' },
    call:    { r: 'O---X.X.........', p: '1...0.0.........', call: 1 },
    stomp:   { r: 'X..X..X.X..X..X.', p: '0..0..1.0..0..3.' },
    menace:  { r: 'X.xxX.xxX.xxo.o.', p: '0.001.110.003.1.' },
    doom:    { r: 'O-------O---o.o.', p: '0.......8...a.1.' },
    saw:     { r: 'XxxxXxxxXxxxXxxx', p: '0000000000001111' },
    rampage: { r: 'Xx.xXx.xXx.xXxXx', p: '00.000.000.00011' },
    stab:    { r: 'X.xxX.xxXxxxO---', p: '0.000.001110a...' },
  };
  const BREAK_RIFF = [
    { r: 'O-------O-------', p: '0.......1.......' },
    { r: 'O-------O---O---', p: '0.......8...a...' },
    { r: 'X...X...X...X...', p: '0...0...0...0...' },
    { r: 'X.x.X.x.XxxxXxxx', p: '0000000000001111' },
  ];
  const RIFF_SEQ = [null, null,
    [['gallop', 'gallop', 'gallop', 'menace'], ['pulse', 'pulse', 'stomp', 'menace'], ['call', 'call', 'call', 'gallop'],
     ['stomp', 'stomp', 'pulse', 'doom'], ['gallop', 'pulse', 'gallop', 'doom']],
    [['saw', 'saw', 'rampage', 'stab'], ['rampage', 'rampage', 'saw', 'stab'], ['saw', 'rampage', 'saw', 'doom'], ['stab', 'saw', 'stab', 'rampage']],
  ];
  // chord roots per bar, semitones from D (i0 holds each root for two bars)
  const PROG = [
    [[0, 0, 1, 0], [0, 0, -2, 0], [0, 1, 0, -2], [0, 0, -4, -2]],
    [[0, 0, 0, 1], [0, 0, -4, -2], [0, 1, 0, -2], [0, 3, 1, 0]],
    [[0, 0, 0, 1], [0, 0, -4, -2], [0, 1, 0, -2], [0, 3, 1, 0], [0, 0, -2, 1]],
    [[0, 0, 0, 1], [0, 1, 0, 1], [0, 0, -4, -2], [0, -2, -4, 1]],
  ];
  // cruising bass pulse: x root, o octave, 5 fifth, b flat second, '-' tie
  const BASS = ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxx.o.', 'x.x.x.x.x.x.o.x.', 'x..xx.x.x..xx.x.'];
  // flame-guitar phrases, two bars each: [step, length, semitones from D5, bend from (semitones), tremolo]
  const LEAD = {
    cry:   [[0, 6, 0, -2], [6, 2, 1], [8, 4, 0], [12, 4, -2], [16, 8, 3, -2], [24, 4, 1], [28, 4, 0]],
    climb: [[0, 8, 0, 0, 1], [8, 8, 3, 0, 1], [16, 8, 5, -2, 1], [24, 6, 7, 0, 1], [30, 2, 8, -1]],
    dive:  [[0, 8, 12, -2], [8, 2, 10], [10, 2, 8], [12, 2, 7], [14, 2, 5], [16, 2, 3], [18, 2, 1], [20, 12, 0]],
    call:  [[0, 2, 0], [2, 2, 1], [4, 4, 0], [12, 2, 0], [14, 2, 1], [16, 6, 3, -2], [24, 8, -2, 0, 1]],
    howl:  [[0, 16, 12, -2, 1], [16, 8, 10, 0, 1], [24, 8, 8, -1, 1]],
  };
  const LEAD_SEQ = [['cry', 'climb', 'cry', 'dive'], ['call', 'cry', 'climb', 'dive'], ['climb', 'call', 'cry', 'dive']];
  // brass stabs per bar: [step, length, semitones from the bar's root, velocity]; -1 = the brass rests (the lead talks)
  const BRASS = [
    [[0, 3, 0, 1]],
    [[0, 2, 0, 0.9], [10, 1, 0, 0.7], [12, 4, 1, 1]],
    [[0, 6, 0, 1], [8, 2, -2, 0.8], [12, 4, 0, 1]],
    [[6, 2, 0, 0.8], [8, 6, 0, 1]],
  ];
  const BRASS_SEQ = [[0, -1, 1, -1], [2, -1, 0, 1], [0, 3, -1, 1], [2, -1, 3, -1]];
  // ambient bed for the menu: [bar, step, kind (m pipe ring, X crash, D far drum), semitones from D4, velocity]
  const AMB = [
    [[0, 0, 'X', 0, 0.5], [0, 0, 'D', 0, 0.5], [2, 10, 'm', 7, 0.5], [4, 0, 'D', 0, 0.42], [5, 4, 'm', 13, 0.45], [7, 8, 'm', 0, 0.4]],
    [[0, 0, 'D', 0, 0.5], [1, 6, 'm', 12, 0.5], [3, 12, 'm', 8, 0.4], [4, 0, 'D', 0, 0.45], [4, 2, 'D', 0, 0.3], [6, 0, 'm', 13, 0.55]],
    [[0, 0, 'm', 0, 0.6], [2, 0, 'D', 0, 0.4], [2, 2, 'D', 0, 0.3], [4, 8, 'm', 7, 0.45], [6, 0, 'D', 0, 0.45], [6, 2, 'D', 0, 0.32], [7, 4, 'm', 1, 0.4]],
  ];
  // layer levels per intensity (0 menu, 1 cruising, 2 chase, 3 boss)
  const MIX = {
    wind:  [0.35, 0.22, 0.14, 0.1],
    drone: [0.6, 0.45, 0.42, 0.45],
    amb:   [1, 0, 0, 0],
    drums: [0, 0.8, 1, 1],
    bass:  [0, 0.6, 0.75, 0.75],
    gtr:   [0, 0, 1, 1],
    lead:  [0, 0, 0, 1],
    brass: [0, 0, 0, 1],
  };
  const LAYERS = Object.keys(MIX);
  const PATTERN_LAYERS = ['drums', 'bass', 'gtr', 'lead', 'brass'];   // held during a stinger

  // ---------- compile the text patterns once ----------
  function compileRiff(r) {
    r.k = []; r.s = []; r.n = [];
    for (let i = 0; i < 16; i++) {
      const c = r.r[i];
      r.k[i] = 0; r.s[i] = 0; r.n[i] = 0;
      if (c === '.' || c === '-') continue;
      let j = i + 1; while (j < 16 && r.r[j] === '-') j++;
      r.k[i] = c; r.s[i] = DEG[r.p[i]] !== undefined ? DEG[r.p[i]] : 0;
      r.n[i] = c === 'x' || c === 'X' ? 1 : c === 'o' ? Math.min(2, j - i) : j - i;
    }
    return r;
  }
  const BDEG = { x: 0, o: 12, '5': 7, b: 1 };
  function compileBass(str) {
    const b = { k: [], s: [], n: [] };
    for (let i = 0; i < 16; i++) {
      const c = str[i]; b.k[i] = 0; b.s[i] = 0; b.n[i] = 0;
      if (BDEG[c] === undefined) continue;
      let j = i + 1; while (j < 16 && str[j] === '-') j++;
      b.k[i] = c; b.s[i] = BDEG[c]; b.n[i] = j - i;
    }
    return b;
  }
  for (const k in RIFF) compileRiff(RIFF[k]);
  BREAK_RIFF.forEach(compileRiff);
  const BASSC = BASS.map(compileBass), BASS_HOLD = compileBass('x-------x-------');
  for (const k in LEAD) {          // legato flags: [5] slides in from the previous note, [6] runs into the next
    const ph = LEAD[k];
    for (let i = 0; i < ph.length; i++) {
      const e = ph[i], p = ph[i - 1], q = ph[i + 1];
      e[5] = !!(p && p[0] + p[1] === e[0]); e[6] = !!(q && e[0] + e[1] === q[0]);
    }
  }
  function curve(fn) { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = fn(i * 2 / (n - 1) - 1); return c; }
  const asym = (k, o) => x => (Math.tanh(k * (x + o)) - Math.tanh(k * o)) / (1 + Math.tanh(k * o));
  const CURVE = {
    clip: curve(x => 0.89 * Math.tanh(2 * x / 0.89)),     // fed at half level: unity slope, never above 0.89
    sat: curve(x => Math.tanh(2.5 * x) / Math.tanh(2.5)),  // drum bus grit: puts taiko harmonics where phones can play them
    bass: curve(x => Math.tanh(2 * x) / Math.tanh(2)),
    gtr: curve(asym(8, 0.012)),
    lead: curve(asym(12, 0.01)),
  };
  const ROWS = 'DLMHSKX';
  const TOM = { L: [100, 0.11, 2.1, 'skin'], M: [145, 0.085, 2, 'skin'], H: [210, 0.065, 1.7, 'ka'] };   // Hz, decay, slap, filter
  const LOOK = 0.15, TICK = 25, CAP = 26;

  // ================= one engine instance =================
  function makeEngine() {
    let ctx = null, dest = null, offline = false, vNow = 0;
    let pre, vol, mute, fade, sting, revIn, echoIn, echoDelay, noiseBuf;
    const L = {};
    let R = null;                                 // drum racks: kit (pattern drums), amb (menu bed), sting (stingers)
    let windBP, windWh, windEnv, droneLP, bassEnv, bassLP, bassOut, gtrEnv, gtrPalm, gtrPost, leadEnv, ghostEnv, chainEnv;
    let src = null;                               // persistent oscillators while playing
    let volume = 0.45, muted = false, seed = 0x5EED, starts = 0;
    let rand = mulberry(1), hum = mulberry(2);
    const SC = { sting: 1 }; for (const n of LAYERS) SC[n] = 1;   // per-layer trims (QA solo/mute)
    const now = () => (offline ? vNow : ctx.currentTime);

    // ---------- voice bookkeeping: an estimate of live per-note nodes, used to shed ghost notes ----------
    const VN = 256, vS = new Float64Array(VN), vE = new Float64Array(VN), vC = new Uint8Array(VN);
    let vI = 0, peakLive = 0, made = 0, stingUntil = 0;
    function liveAt(t) { let n = 0; for (let i = 0; i < VN; i++) if (vS[i] <= t && vE[i] > t) n += vC[i]; return n; }
    let trace = null, shed = 0;                   // QA: every node group's lifetime (exact peak), notes dropped
    function room(t, nodes, prio) {               // may this note sound? ghosts give way first, pattern notes next
      if (prio >= 2) return true;
      const cap = t < stingUntil ? CAP - 10 : CAP;          // pattern notes make room while a stinger sounds
      if (liveAt(t) + nodes <= (prio ? cap : cap - 8)) return true;
      shed++; return false;
    }
    function reg(t, end, nodes) {
      vS[vI] = t; vE[vI] = end; vC[vI] = nodes; vI = (vI + 1) % VN; made += nodes;
      const n = liveAt(t); if (n > peakLive) peakLive = n;
      if (trace) trace.push(t, end, nodes);
    }
    // per-note sources clean up after themselves; the last source of a voice also disconnects its gain and filter
    function done() {
      this.disconnect();
      if (this._a) { this._a.disconnect(); this._a = null; }
      if (this._b) { this._b.disconnect(); this._b = null; }
    }

    // ---------- graph helpers ----------
    function gn(v, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
    function bq(type, f, q, to, gain) {
      const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
      if (q !== undefined) b.Q.value = q; if (gain !== undefined) b.gain.value = gain; if (to) b.connect(to); return b;
    }
    function shaper(c, os, to) { const w = ctx.createWaveShaper(); w.curve = c; w.oversample = os || 'none'; if (to) w.connect(to); return w; }
    function pan(v, to) {
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (p.pan) p.pan.value = v; p.connect(to); return p;
    }
    function impulse(sec, tau) {     // a dark, generated hall: decaying noise that loses its top end as it fades
      const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr), r = mulberry(99);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); let lp = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr, a = 0.55 - 0.47 * (t / sec);
          lp += (r() * 2 - 1 - lp) * a;
          d[i] = t < 0.014 ? 0 : lp * Math.exp(-t / tau);
        }
      }
      return b;
    }
    function makeRack(out) {
      const r = { out };
      r.post = gn(0.36, out);
      const push = bq('peaking', 350, 1, r.post, 3), shelf = bq('lowshelf', 100, undefined, push, -3);
      r.sat = shaper(CURVE.sat, 'none', shelf);
      r.body = gn(0.9, r.sat);                     // tonal drum bodies are saturated together: harmonics at 150-400 Hz
      r.skin = bq('bandpass', 1800, 0.8, out);     // taiko skin slap
      r.boom = bq('lowpass', 500, 0.7, r.body);    // the doom hit's air
      r.ka = bq('bandpass', 3300, 0.9, out);       // high taiko rim
      r.clank = bq('bandpass', 3000, 1, out);      // scrap-metal snare
      r.hat = bq('bandpass', 7000, 1, out);        // chains
      r.crash = bq('bandpass', 4500, 0.6, out);
      return r;
    }

    function build() {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      { const d = noiseBuf.getChannelData(0), r = mulberry(7); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
      // output: pre -> rumble cut -> glue compressor -> phone-weight bump -> soft top -> soft clip -> volume -> mute -> fade
      fade = gn(1); fade.connect(dest);
      mute = gn(muted ? 0 : 1, fade);
      vol = gn(volume, mute);
      const clip = shaper(CURVE.clip, 'none', vol);
      const clipIn = gn(0.5, clip);
      const top = bq('highshelf', 9000, undefined, clipIn, -3);           // keep the very top soft
      const presence = bq('peaking', 3000, 0.8, top, 2.5);                 // attack and bite for phone speakers
      const weight = bq('peaking', 200, 0.9, presence, 1);                 // weight where a phone can play it
      const glue = ctx.createDynamicsCompressor();
      glue.threshold.value = -16; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.2;
      glue.connect(weight);
      const lows = bq('lowshelf', 110, undefined, glue, -2.5);
      const rumble = bq('highpass', 42, 0.7, lows);
      pre = gn(0.85, rumble);
      // space: a generated reverb and a dotted-eighth echo for the lead
      const conv = ctx.createConvolver(); conv.buffer = impulse(2.2, 0.36);
      revIn = gn(1, conv); conv.connect(gn(0.32, pre));
      echoDelay = ctx.createDelay(1.5); echoDelay.delayTime.value = 0.36;
      const echoLP = bq('lowpass', 2400, 0.7, echoDelay);
      echoDelay.connect(gn(0.3, echoLP));               // feedback loop through the low-pass
      echoIn = gn(1, echoDelay);
      echoDelay.connect(gn(0.32, pre));
      // layers (gains move with intensity) and their reverb sends
      const SEND = { wind: 0.12, drone: 0.3, amb: 0.75, drums: 0.2, bass: 0, gtr: 0.07, lead: 0.24, brass: 0.28 };
      for (const n of LAYERS) { L[n] = gn(0, pre); if (SEND[n]) L[n].connect(gn(SEND[n], revIn)); }
      L.lead.connect(gn(0.4, echoIn));
      sting = gn(1, pre); sting.connect(gn(0.3, revIn));
      R = { kit: makeRack(L.drums), amb: makeRack(L.amb), sting: makeRack(sting) };
      // wind: looped noise through a wandering band-pass, plus a thin whistle
      windEnv = gn(0.6, bq('lowpass', 2400, 0.7, gn(0.7, L.wind)));
      windBP = bq('bandpass', 700, 0.9, windEnv);
      windWh = bq('bandpass', 650, 12, gn(2.2, L.wind));
      // drone: detuned saws through a slow low-pass
      droneLP = bq('lowpass', 420, 2.5, bq('highpass', 95, 0.7, gn(0.075, L.drone)));
      // bass: two saws an octave apart, enveloped, filtered, then driven
      bassOut = gn(0.26, L.bass);
      const bassTop = bq('lowpass', 2600, 0.7, bassOut);
      const growl = bq('peaking', 330, 1, bassTop, 4);
      const bassHP = bq('highpass', 90, 0.6, growl);
      const bassSat = shaper(CURVE.bass, 'none', bassHP);       // driven after the filter: growl that phones can play
      bassLP = bq('lowpass', 700, 3, gn(3.5, bassSat));
      bassEnv = gn(0, bassLP);
      // rhythm guitar: oscillators -> envelope -> drive -> distortion -> palm-mute low-pass -> cabinet -> two sides
      const gL = pan(-0.45, L.gtr), gR = pan(0.45, L.gtr);
      gtrPost = gn(0.45, gL);
      const dbl = ctx.createDelay(0.05); dbl.delayTime.value = 0.013; gtrPost.connect(dbl); dbl.connect(gn(0.85, gR));
      const gtrHP = bq('highpass', 200, 0.9, gtrPost);
      const cab = bq('lowpass', 7000, 0.7, gtrHP);
      const mid = bq('peaking', 2400, 0.9, cab, 3);
      const scoop = bq('peaking', 300, 1.2, mid, -2);
      gtrPalm = bq('lowpass', 3400, 0.8, scoop);
      const gtrSh = shaper(CURVE.gtr, '2x', gtrPalm);
      const gtrTight = bq('highpass', 80, 0.7, gtrSh);
      gtrEnv = gn(0, gn(5, gtrTight));
      // flame guitar: saw + square, heavier drive, a screaming mid peak, vibrato from an LFO
      const leadOut = gn(0.13, L.lead);
      const leadHP = bq('highpass', 280, 0.7, leadOut);
      const leadLP2 = bq('lowpass', 5000, 0.7, leadHP);
      const leadLP = bq('lowpass', 3400, 0.8, leadLP2);
      const leadPk = bq('peaking', 1900, 1.2, leadLP, 3);
      const leadSh = shaper(CURVE.lead, '2x', leadPk);
      leadEnv = gn(0, gn(4, leadSh));
      // the kit's ghost strokes and chains are persistent voices too: the busiest rows allocate nothing
      ghostEnv = gn(0, R.kit.body); chainEnv = gn(0, R.kit.hat);
    }

    function startSources(t) {
      src = { list: [] };
      const osc = (type, f, to, det) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
        o.connect(to); o.start(t); src.list.push(o); return o;
      };
      const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true; w.connect(windBP); w.connect(windWh); w.start(t); src.list.push(w);
      const tri = gn(0.8, droneLP); src.triG = tri;
      src.drone = [osc('sawtooth', mtof(D2), droneLP, -7), osc('sawtooth', mtof(D2), droneLP, 7), osc('sawtooth', mtof(D2 + 7), droneLP, 3), osc('triangle', mtof(D3), tri, 0)];
      src.droneDet = [-7, 7, 3, 0];
      const sawG = gn(0.6, bassEnv), octG = gn(0.75, bassEnv); src.bassG = [sawG, octG];
      src.bass = [osc('sawtooth', mtof(D2), sawG), osc('sawtooth', mtof(D3), octG, 5)];   // root + octave: weight that phones can play
      src.gtr = [osc('sawtooth', mtof(D2), gtrEnv, -6), osc('sawtooth', mtof(D2), gtrEnv, 6), osc('sawtooth', mtof(D2 + 7), gtrEnv, 2)];
      src.lead = [osc('sawtooth', mtof(D5), leadEnv), osc('square', mtof(D5), leadEnv, 7)];
      src.vib = gn(0);                            // vibrato depth in cents, per play session
      src.lfo = osc('sine', 5.6, src.vib);
      src.ghost = osc('sine', TOM.M[0], ghostEnv);
      const ch = ctx.createBufferSource(); ch.buffer = noiseBuf; ch.loop = true; ch.connect(chainEnv); ch.start(t, 0.7); src.list.push(ch);
      src.vib.connect(src.lead[0].detune); src.vib.connect(src.lead[1].detune);
      for (const p of [bassEnv.gain, gtrEnv.gain, leadEnv.gain, ghostEnv.gain, chainEnv.gain]) { p.cancelScheduledValues(t); p.setValueAtTime(0, t); }
    }
    function stopSources(t) {
      if (!src) return;
      for (const o of src.list) { try { o.stop(t); } catch (e) {} o.onended = done; }
      const s = src; src = null;
      const tidy = () => { try { s.vib.disconnect(); s.triG.disconnect(); s.bassG[0].disconnect(); s.bassG[1].disconnect(); } catch (e) {} };
      if (offline) tidy(); else setTimeout(tidy, Math.max(0, (t - now()) * 1000) + 200);
    }

    // ================= instruments =================
    function noise(t, vel, tc, to) {             // a burst from the shared noise buffer
      const s = ctx.createBufferSource(), g = ctx.createGain(), end = t + tc * 5 + 0.01;
      reg(t, end, 2);
      s.buffer = noiseBuf; s.loop = true;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.0015); g.gain.setTargetAtTime(0, t + 0.002, tc);
      s.connect(g); g.connect(to); s.start(t, hum() * 1.8); s.stop(end); s.onended = done; s._a = g;
    }
    function body(t, type, f0, f1, f2, sweep, vel, tc, to, end) {   // a pitched drum body: fast drop f0 -> f1, then sag to f2
      const o = ctx.createOscillator(), g = ctx.createGain();
      reg(t, end, 2);
      o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + sweep); o.frequency.setTargetAtTime(f2, t + sweep, tc * 2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0, t + 0.004, tc);
      o.connect(g); g.connect(to); o.start(t); o.stop(end); o.onended = done; o._a = g;
    }
    function tom(t, k, vel, rack, prio, ghost) {
      const T = TOM[k], f = T[0], tc = T[1], end = t + tc * 4 + 0.03, slap = vel > 0.5 && !ghost;
      if (!room(t, slap ? 4 : 2, prio)) return;
      body(t, k === 'H' ? 'triangle' : 'sine', f * 2.4, f, f * 0.86, 0.03, vel * 0.68, tc, rack.body, end);
      if (slap) noise(t, vel * T[2], 0.03 + tc * 0.15, rack[T[3]]);
    }
    function doom(t, vel, rack) {                 // the big low war-drum hit
      const end = t + 0.6;
      if (!room(t, 4, vel > 0.9 || rack !== R.kit ? 2 : 1)) return;   // stinger and menu hits always sound
      body(t, 'sine', 190, 60, 54, 0.1, vel * 0.7, 0.14, rack.body, end);
      noise(t, vel * 0.7, 0.06, rack.boom);
    }
    function clank(t, vel, rack, prio) {          // scrap-metal snare
      const end = t + 0.3;
      if (!room(t, 4, prio)) return;
      noise(t, vel, 0.06, rack.clank);
      body(t, 'triangle', 430, 245, 225, 0.05, vel * 0.35, 0.045, rack.body, end);
    }
    function ghostTom(t, k, vel) {                // quiet in-between strokes on one persistent drum voice
      const T = TOM[k], f = T[0], p = src.ghost.frequency, g = ghostEnv.gain;
      p.setValueAtTime(f * 2.2, t); p.exponentialRampToValueAtTime(f, t + 0.03); p.setTargetAtTime(f * 0.88, t + 0.03, T[1] * 2);
      g.setTargetAtTime(vel * 0.75, t, 0.0015); g.setTargetAtTime(0, t + 0.005, T[1]);
    }
    function chain(t, vel) { const g = chainEnv.gain; g.setTargetAtTime(vel * 0.48, t, 0.001); g.setTargetAtTime(0, t + 0.003, 0.022); }
    function hat(t, vel, rack) {
      if (!room(t, 2, 0)) return;
      noise(t, vel * 0.34, 0.022, rack.hat);
    }
    function crash(t, vel, rack) {                // a sheet of scrap struck hard, with a low gong under it
      noise(t, vel * 0.36, 0.32, rack.crash);
      body(t, 'sine', 160, 147, 140, 0.02, vel * 0.3, 0.2, rack.body, t + 1.05);
    }
    function metal(t, semi, vel, rack) {          // a struck pipe: two inharmonic partials and a click
      const f = mtof(D4 + semi), end = t + 3.2;
      if (!room(t, 6, 1)) return;
      reg(t, end, 4);
      const a = ctx.createOscillator(), b = ctx.createOscillator(), ga = ctx.createGain(), gb = ctx.createGain();
      a.type = b.type = 'sine'; a.frequency.value = f; b.frequency.value = f * 2.76; b.detune.value = 4;
      ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(vel * 0.2, t + 0.003); ga.gain.setTargetAtTime(0, t + 0.005, 0.6);
      gb.gain.setValueAtTime(0, t); gb.gain.linearRampToValueAtTime(vel * 0.09, t + 0.002); gb.gain.setTargetAtTime(0, t + 0.004, 0.25);
      a.connect(ga); b.connect(gb); ga.connect(rack.out); gb.connect(rack.out);
      a.start(t); b.start(t); a.stop(end); b.stop(end); a.onended = done; b.onended = done; a._a = ga; b._a = gb;
      noise(t, vel * 0.22, 0.012, rack.ka);
    }
    function brass(t, semi, len, vel, to, oct, prio, bend) {   // a horn section: power chord of saws through a blatting low-pass
      const r = snap(semi), base = D3 + (oct || 0) + r, end = t + len + (len < 0.3 ? 0.21 : 0.34);
      if (!room(t, 5, prio === undefined ? 2 : prio)) return;
      reg(t, end, 5);
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.Q.value = 1.6;
      f.frequency.setValueAtTime(240, t); f.frequency.linearRampToValueAtTime(1300 + 2400 * vel, t + 0.07);
      f.frequency.setTargetAtTime(800 + 1000 * vel, t + 0.08, 0.3); f.frequency.setTargetAtTime(240, t + len, 0.12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.16, t + 0.03);
      g.gain.setTargetAtTime(vel * 0.12, t + 0.05, 0.25); g.gain.setTargetAtTime(0, t + len, len < 0.3 ? 0.04 : 0.065);
      const notes = [base, D3 + (oct || 0) + fifth(r), base + 12];
      let o = null;
      for (let i = 0; i < 3; i++) {
        o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = (i - 1) * 6;
        const fr = mtof(notes[i]);
        if (bend) { o.frequency.setValueAtTime(fr * Math.pow(2, bend / 12), t); o.frequency.setTargetAtTime(fr, t + 0.12, 0.14); }   // sags into pitch
        else { o.frequency.setValueAtTime(fr * 0.97, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.05); }
        o.connect(f); o.start(t); o.stop(end); o.onended = done;
      }
      f.connect(g); g.connect(to); o._a = f; o._b = g;
    }
    function whoosh(t, dur, vel, f0, f1) {        // rising filtered air
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 0.05;
      reg(t, end, 3);
      s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.6;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(f); f.connect(g); g.connect(sting); s.start(t, hum()); s.stop(end); s.onended = done; s._a = f; s._b = g;
    }
    function engineDie(t) {                       // the war rig coughs, catches, and dies
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + 3.3;
      reg(t, end, 3);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(74, t + 1.2); o.frequency.exponentialRampToValueAtTime(30, t + 3.1);
      f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(320, t + 3.1);
      g.gain.setValueAtTime(0, t);
      const cough = [0, 0.3, 0.52, 0.9, 1.25, 1.75, 2.3];
      for (let i = 0; i < cough.length; i++) {
        const c = t + cough[i];
        g.gain.setTargetAtTime(0.42 * (1 - i / 9), c, 0.008); g.gain.setTargetAtTime(0.04, c + 0.11 + i * 0.03, 0.035);
      }
      g.gain.setTargetAtTime(0, t + 2.7, 0.15);
      o.connect(f); f.connect(g); g.connect(R.sting.body); o.start(t); o.stop(end); o.onended = done; o._a = f; o._b = g;
    }

    // ---------- persistent voices: automation only, nothing allocated per note ----------
    function bassNote(t, semi, dur, vel) {
      const f = mtof(D2 + snap(semi));
      src.bass[0].frequency.setValueAtTime(f, t); src.bass[1].frequency.setValueAtTime(f * 2, t);
      const g = bassEnv.gain;
      g.setTargetAtTime(vel, t, 0.004); g.setTargetAtTime(vel * 0.7, t + 0.03, 0.12); g.setTargetAtTime(0, t + dur, 0.025);
      bassLP.frequency.setTargetAtTime(800 + 1400 * vel, t, 0.004); bassLP.frequency.setTargetAtTime(700, t + 0.025, 0.09);
    }
    function gtrNote(t, semi, kind, vel, len) {
      const r = snap(semi), f0 = mtof(D2 + r), o = src.gtr, g = gtrEnv.gain;
      o[0].frequency.setValueAtTime(f0, t); o[1].frequency.setValueAtTime(f0, t); o[2].frequency.setValueAtTime(mtof(D2 + fifth(r)), t);
      if (kind === 'x' || kind === 'X') {         // palm-muted chug
        g.setTargetAtTime(vel, t, 0.002); g.setTargetAtTime(0, t + Math.min(len, 0.085), 0.014);
        gtrPalm.frequency.setTargetAtTime(kind === 'X' ? 3800 : 2800, t, 0.003);
      } else {                                    // open power chord rings
        g.setTargetAtTime(vel, t, 0.003); g.setTargetAtTime(vel * 0.55, t + 0.05, 0.5); g.setTargetAtTime(0, t + len - 0.01, 0.035);
        gtrPalm.frequency.setTargetAtTime(7000, t, 0.006);
      }
    }
    function leadNote(t, e, sd) {
      const semi = e[2], len = e[1] * sd, bend = e[3] || 0, f = mtof(D5 + semi), g = leadEnv.gain, vel = 0.9;
      for (let i = 0; i < 2; i++) {
        const p = src.lead[i].frequency;
        if (bend) { p.setValueAtTime(mtof(D5 + semi + bend), t); p.setTargetAtTime(f, t + 0.03, 0.06); }
        else if (e[5]) p.setTargetAtTime(f, t, 0.014);      // legato slide
        else p.setValueAtTime(f, t);
      }
      g.setTargetAtTime(vel, t, e[5] ? 0.01 : 0.004);
      if (e[4]) {                                 // tremolo picking: 32nd-note re-attacks
        const step = sd / 2, n = Math.floor(len / step + 0.001);
        for (let i = 1; i < n; i++) { const ti = t + i * step; g.setTargetAtTime(vel * 0.04, ti - 0.016, 0.005); g.setTargetAtTime(vel, ti, 0.004); }
      }
      const v = src.vib.gain;
      v.setTargetAtTime(0, t, 0.02);
      if (len > 0.3 && !e[4]) v.setTargetAtTime(30, t + 0.16, 0.12);
      if (!e[6]) g.setTargetAtTime(0, t + len - 0.015, 0.03);
    }
    function releaseAll(t) {
      bassEnv.gain.setTargetAtTime(0, t, 0.04); gtrEnv.gain.setTargetAtTime(0, t, 0.04); leadEnv.gain.setTargetAtTime(0, t, 0.05);
    }
    function droneTo(t, semi) {
      const r = snap(semi), d = src.drone, tc = 0.35;
      d[0].frequency.setTargetAtTime(mtof(D2 + r), t, tc); d[1].frequency.setTargetAtTime(mtof(D2 + r), t, tc);
      d[2].frequency.setTargetAtTime(mtof(D2 + fifth(r)), t, tc); d[3].frequency.setTargetAtTime(mtof(D3 + r), t, tc);
    }

    // ================= transport =================
    let playing = false, stopping = false, timer = null, stopTimer = null;
    let intensity = 0, target = 0, bpm = BPM[0], sd = 60 / BPM[0] / 4;   // sd = one sixteenth, in seconds
    let step = 0, bar = 0, nextT = 0;
    let holdFrom = 0, holdUntil = 0, restoreAt = 0, pickupBar = -1, crashNext = false, droneRoot = 99, quiet = false;
    const ph = { n: 0, bar: 0, prog: PROG[0][0], grooves: [0, 0, 0, 0], riffs: null, bass: 0, brk: false, since: 0,
      leadSeq: LEAD_SEQ[0], brassSeq: BRASS_SEQ[0], fill: 0, fillIdx: 0, amb: AMB[0] };
    const mkPlan = () => ({ root: 0, drums: null, fill: null, riff: null, bass: null, lead: null, leadOff: 0, brass: null, amb: null, ambBar: 0, crash: false });
    let cur = mkPlan(), last = mkPlan();
    const on = {}, out = {};
    const DRONE_CUT = [[260, 360, 520, 700], [240, 320, 420], [220, 300, 380], [240, 320, 400]];
    // ring of recent bar starts, so state() reports what is audible rather than what is booked
    const BR = 8, brT = new Float64Array(BR), brN = new Int32Array(BR), brS = new Float64Array(BR), brI = new Int8Array(BR);
    let brK = 0;
    const pick = a => a[(rand() * a.length) | 0];

    function newPhrase() {
      const I = intensity, n = ph.n++;
      if (I === 0) { if (ph.bar % 8 === 0) { ph.prog = pick(PROG[0]); ph.amb = pick(AMB); } ph.brk = false; return; }
      ph.prog = pick(PROG[I]);
      ph.brk = I >= 2 && n >= 2 && ph.since >= 3 && rand() < (I === 3 ? 0.18 : 0.25);   // an occasional breakdown, well spaced
      ph.since = ph.brk ? 0 : ph.since + 1;
      const G = GROOVE[I], g = (rand() * G.length) | 0;
      ph.grooves[0] = ph.grooves[1] = ph.grooves[3] = g;
      ph.grooves[2] = rand() < 0.35 ? (g + 1) % G.length : g;
      ph.riffs = RIFF_SEQ[I] ? pick(RIFF_SEQ[I]) : null;
      ph.bass = (rand() * BASSC.length) | 0;
      if (I === 3) { if (ph.bar % 8 === 0) ph.leadSeq = pick(LEAD_SEQ); ph.brassSeq = pick(BRASS_SEQ); }
      ph.fill = ph.bar % 8 === 4 ? 1 : 0;                              // 8-bar phrase ends get the long fill
      ph.fillIdx = (rand() * 3) | 0;
    }
    function planBar() {
      const I = intensity, b = ph.bar % 4, b8 = ph.bar % 8, c = cur;
      c.drums = c.fill = c.riff = c.bass = c.lead = c.brass = c.amb = null; c.leadOff = 0;
      c.crash = crashNext; crashNext = false;
      if (I === 0) { c.root = ph.prog[b8 >> 1]; c.amb = ph.amb; c.ambBar = b8; c.crash = false; return; }
      c.root = ph.prog[b];
      if (ph.brk) {
        c.drums = BREAK[b];
        if (I >= 2) c.riff = BREAK_RIFF[b]; else c.bass = BASS_HOLD;
        if (I === 3 && b < 2) { c.lead = LEAD.howl; c.leadOff = b * 16; }
        if (I === 3 && b === 2) c.brass = BRASS[0];
        if (b === 3) crashNext = true;
        return;
      }
      c.riff = ph.riffs ? RIFF[ph.riffs[b]] : null;
      c.drums = c.riff && c.riff.call ? ANSWER : GROOVE[I][ph.grooves[b]];   // call-and-response: drums answer the guitar
      if (I === 1) c.bass = BASSC[ph.bass];
      if (b === 3) {
        c.fill = ph.fill ? (I === 3 && rand() < 0.5 ? FILL_BAR : FILL_LONG[ph.fillIdx]) : FILL_SHORT[ph.fillIdx];
        crashNext = true;
      }
      if (I === 3) {
        c.lead = LEAD[ph.leadSeq[b8 >> 1]]; c.leadOff = (b8 & 1) * 16;
        const k = ph.brassSeq[b]; c.brass = k >= 0 ? BRASS[k] : null;
      }
    }
    function levels(t, from, to) {              // layer gains; from < 0 = set everything (start, resume)
      const fall = sd * 16 * 0.3;
      for (const n of LAYERS) {
        const b = MIX[n][to] * SC[n], a = from < 0 ? -1 : MIX[n][from] * SC[n], p = L[n].gain;
        if (a === b) continue;
        p.cancelScheduledValues(t);
        if (from < 0) p.setTargetAtTime(b, t, 0.4);
        else if (b > a) p.setTargetAtTime(b, t, from === 0 ? 0.6 : 0.05);   // in: a swell out of the menu, a punch otherwise
        else p.setTargetAtTime(b, t, fall);                                  // out: fade across the bar
      }
    }
    function beginBar(t, play) {
      const tmp = last; last = cur; cur = tmp;    // keep last bar's plan for the layers that fade out
      const prev = intensity;
      if (target !== intensity) { intensity = target; ph.n = 0; ph.bar = 0; ph.since = 2; }
      bpm = BPM[intensity]; sd = 60 / bpm / 4;
      if (ph.bar % 4 === 0) newPhrase();
      planBar();
      ph.bar++;
      for (const n of LAYERS) { on[n] = MIX[n][intensity] > 0; out[n] = !on[n] && prev !== intensity && MIX[n][prev] > 0; }
      brT[brK] = t; brN[brK] = bar; brS[brK] = sd * 4; brI[brK] = intensity; brK = (brK + 1) % BR;
      if (trace) planLog.push(describe(cur));
      if (!play || !src) return;
      if (restoreAt) { if (t >= restoreAt) { restoreAt = 0; levels(t, -1, intensity); } }
      else if (prev !== intensity) levels(t, prev, intensity);
      // persistent voices that sit this bar out let go, so nothing hangs
      if (!on.bass && !out.bass) bassEnv.gain.setTargetAtTime(0, t, 0.05);
      if (!on.gtr && !out.gtr) gtrEnv.gain.setTargetAtTime(0, t, 0.05);
      if (!(out.lead ? last.lead : on.lead && cur.lead)) leadEnv.gain.setTargetAtTime(0, t, 0.05);
      if (!restoreAt) {
        if (cur.root !== droneRoot) { droneRoot = cur.root; droneTo(t, cur.root); }
        if (ph.bar % 2 === 1) { const C = DRONE_CUT[intensity]; droneLP.frequency.setTargetAtTime(C[(hum() * C.length) | 0], t, 1.6); }
      }
      windBP.frequency.setTargetAtTime(320 + 1000 * hum(), t, 1.4);
      windEnv.gain.setTargetAtTime(0.35 + 0.65 * hum(), t, 1.1);
      windWh.frequency.setTargetAtTime(540 + 420 * hum(), t, 2.2);
      if (prev !== intensity || !bar) echoDelay.delayTime.setTargetAtTime(sd * 3, t, 0.08);   // dotted eighth, glides on tempo changes
      const q = cur.drums === BREAK[0] || cur.drums === BREAK[1];   // the first half of a breakdown sits back
      if (q !== quiet) { quiet = q; gtrPost.gain.setTargetAtTime(q ? 0.17 : 0.45, t, q ? 0.25 : 0.5); bassOut.gain.setTargetAtTime(q ? 0.17 : 0.26, t, 0.3); }
    }
    function drumRow(t, s, pat, rack, prio) {
      for (let i = 0; i < 7; i++) {
        const k = ROWS[i], row = pat[k];
        if (!row) continue;
        const v = V(row[s]);
        if (!v) continue;
        const vv = v * (0.93 + 0.1 * hum()), th = k === 'D' ? t : t + (hum() - 0.5) * 0.006;
        if (k === 'D') doom(th, vv, rack);
        else if (k === 'S') clank(th, vv, rack, prio);
        else if (k === 'K') { if (rack === R.kit) chain(th, vv); else hat(th, vv, rack); }
        else if (k === 'X') crash(th, vv, rack);
        else if (v < 0.45 && rack === R.kit) ghostTom(th, k, vv);
        else tom(th, k, vv, rack, v < 0.45 ? 0 : prio);
      }
    }
    function bassStep(t, s, p) {
      const b = p.bass;
      if (b) { const k = b.k[s]; if (k) bassNote(t, k === '5' ? fifth(p.root) : p.root + b.s[s], b.n[s] * sd * 0.85, k === 'o' ? 0.75 : 0.85); return; }
      const r = p.riff;
      if (!r) return;
      const k = r.k[s];
      if (!k) return;
      const pal = k === 'x' || k === 'X';
      bassNote(t, p.root + r.s[s], pal ? sd * 0.8 : r.n[s] * sd * 0.95, k === 'x' ? 0.72 : 0.9);   // bass doubles the riff
    }
    function playStep(t) {
      const s = step, c = cur;
      if (c.amb && !restoreAt) {
        const ev = c.amb;
        for (let i = 0; i < ev.length; i++) {
          const e = ev[i];
          if (e[0] !== c.ambBar || e[1] !== s) continue;
          if (e[2] === 'm') metal(t, e[3], e[4], R.amb); else if (e[2] === 'X') crash(t, e[4], R.amb); else doom(t, e[4], R.amb);
        }
      }
      if (t >= holdFrom && t < holdUntil) return;           // a stinger has the floor
      if (on.drums || out.drums) {
        const p = out.drums ? last : c;
        if (s === 0 && p.crash && on.drums) crash(t, 0.7, R.kit);
        const pat = on.drums && p.fill && s >= p.fill.at ? p.fill : p.drums;
        if (pat) drumRow(t, s, pat, R.kit, 1);
      }
      if (on.bass || out.bass) bassStep(t, s, out.bass ? last : c);
      if (on.gtr || out.gtr) {
        const p = out.gtr ? last : c, r = p.riff;
        if (r && r.k[s]) { const k = r.k[s]; gtrNote(t, p.root + r.s[s], k, k === 'X' ? 1 : k === 'x' ? 0.75 : 0.95, r.n[s] * sd); }
      }
      if (on.lead || out.lead) {
        const p = out.lead ? last : c, P = p.lead, st = s + p.leadOff;
        if (P) for (let i = 0; i < P.length; i++) if (P[i][0] === st) leadNote(t, P[i], sd);
      }
      if (on.brass || out.brass) {
        const p = out.brass ? last : c, B = p.brass;
        if (B) for (let i = 0; i < B.length; i++) { const e = B[i]; if (e[0] === s) brass(t, p.root + e[2], e[1] * sd, e[3], L.brass, 0, 1); }
      }
      if (pickupBar === bar && s >= 12) drumRow(t, s, PICKUP, R.sting, 2);
    }
    const planLog = [];                           // QA: one line per bar when tracing
    let NAMES = null;
    function describe(c) {
      if (!NAMES) {
        NAMES = new Map();
        GROOVE.forEach((G, i) => G.forEach((g, j) => NAMES.set(g, 'g' + i + 'ABC'[j])));
        for (const k in RIFF) NAMES.set(RIFF[k], k);
        for (const k in LEAD) NAMES.set(LEAD[k], k);
        BREAK.forEach((g, j) => NAMES.set(g, 'break' + j)); BREAK_RIFF.forEach((g, j) => NAMES.set(g, 'brkRiff' + j));
        FILL_SHORT.forEach((g, j) => NAMES.set(g, 'fillS' + j)); FILL_LONG.forEach((g, j) => NAMES.set(g, 'fillL' + j));
        NAMES.set(FILL_BAR, 'fillBar'); NAMES.set(ANSWER, 'answer'); BRASS.forEach((g, j) => NAMES.set(g, 'brass' + j));
        AMB.forEach((g, j) => NAMES.set(g, 'amb' + j)); BASSC.forEach((g, j) => NAMES.set(g, 'bass' + j)); NAMES.set(BASS_HOLD, 'bassHold');
      }
      const n = o => (o ? NAMES.get(o) || '?' : '-');
      return `bar ${bar + 1} i${intensity} root ${c.root} drums ${n(c.drums)} fill ${n(c.fill)} riff ${n(c.riff)} bass ${n(c.bass)} lead ${n(c.lead)}${c.lead ? '@' + c.leadOff : ''} brass ${n(c.brass)} amb ${n(c.amb)}${c.crash ? ' crash' : ''}`;
    }
    let minLead = 9, skips = 0;                  // QA: the closest a note was booked to its play time; throttle skips
    function advance(play) {
      const t = nextT;
      if (play && t - now() < minLead) minLead = t - now();
      if (step === 0) beginBar(t, play);
      if (play && !muted) playStep(t);
      nextT += sd; step++;
      if (step === 16) { step = 0; bar++; }
    }
    function tick() {
      if (!playing || !ctx) return;
      const t = now();
      if (nextT < t) {                            // the timer was throttled (hidden tab): skip ahead quietly, no burst
        skips++; while (nextT < t + 0.03) advance(false);
        if (src) { if (!restoreAt) levels(nextT, -1, intensity); releaseAll(nextT); }
      }
      const look = !offline && typeof document !== 'undefined' && document.hidden ? 1.2 : LOOK;
      while (nextT < t + look) advance(true);
    }

    // ================= stingers =================
    function gridBeat(minT) { if (!playing) return minT; let x = nextT - (step % 4) * sd; while (x < minT) x += 4 * sd; return x; }
    function gridBar(minT) { if (!playing) return minT; let x = nextT - step * sd; while (x < minT) x += 16 * sd; return x; }
    const onBeat = () => gridBeat(Math.max(now() + 0.04, playing ? nextT : 0));    // the first beat not yet booked
    function hold(t0, t1) { holdFrom = t0; holdUntil = t1; if (src) releaseAll(t0); }

    function stBoss() {                           // the Bull appears: a huge horn, then a taiko roll that lands on a bar line
      const spb = 4 * sd, t = onBeat(), end = playing ? gridBar(t + 1.5 * spb) : t + 3 * spb, len = Math.min(2.4, end - t);
      if (playing) hold(t, end);
      stingUntil = end + 0.5;
      brass(t, 0, len, 1, sting, -12);
      brass(t, 0, len, 0.9, sting, 0, 2, 1);      // the upper horn sags from the flat second into D: menace
      doom(t, 1, R.sting); crash(t, 0.8, R.sting);
      let i = 0;
      for (let x = t + spb; x < end - 0.001; x += sd, i++) {
        const k = (x - t) / (end - t);
        if (i % 2) tom(x, 'M', 0.25 + 0.45 * k, R.sting, 2, true);    // ghost strokes between the main hits
        else tom(x, i % 4 ? 'L' : 'H', 0.35 + 0.6 * k, R.sting, 2);
      }
      doom(end, 1, R.sting); crash(end, target >= 2 ? 0.5 : 0.9, R.sting);
    }
    function phrase(t, P, lastLen, firstOct, lastOct) {   // brass + taiko hits: [step, length, semitones, velocity]
      for (let i = 0; i < P.length; i++) {
        const e = P[i], x = t + e[0] * sd, fin = i === P.length - 1, len = fin ? Math.max(e[1] * sd, lastLen) : e[1] * sd - 0.02;
        brass(x, e[2], len, e[3], sting, 0);
        if (i === 0 && firstOct) brass(x + 0.01, e[2], len, 0.85, sting, firstOct);
        if (fin && lastOct) brass(x + 0.01, e[2], len, 0.6, sting, lastOct);
        tom(x, fin ? 'L' : 'M', 0.85, R.sting, 2, i > 0 && !fin);   // slap on the first and last hits only
      }
    }
    function stVictory() {                        // the Bull is scrap: bVI - bVII - I, the heroic cadence
      const t = onBeat();
      if (playing) hold(t, t + 32 * sd);
      stingUntil = t + 32 * sd;
      phrase(t, [[0, 6, 0, 1], [6, 2, 0, 0.8], [8, 4, -4, 0.95], [12, 4, -2, 0.95], [16, 16, 0, 1]], 2.6, -12, 12);
      doom(t, 1, R.sting); crash(t, 0.7, R.sting); doom(t + 8 * sd, 0.9, R.sting);
      for (let j = 12; j < 16; j++) tom(t + j * sd, j < 14 ? 'H' : 'M', 0.6 + 0.08 * (j - 12), R.sting, 2, j % 2 === 1);
      doom(t + 16 * sd, 1, R.sting); crash(t + 16 * sd, 1, R.sting); doom(t + 24 * sd, 0.7, R.sting);
    }
    function stDepot() {                          // leg cleared: a short rising call that lands an octave up
      const t = onBeat();
      if (playing) hold(t, t + 16 * sd);
      stingUntil = t + 16 * sd + 1;
      phrase(t, [[0, 2, 0, 0.9], [2, 2, 3, 0.85], [4, 2, 5, 0.9], [6, 2, -2, 0.9], [8, 8, 0, 1]], 1.6, 0, 12);
      doom(t, 0.9, R.sting); tom(t + 7 * sd, 'H', 0.7, R.sting, 2, true); doom(t + 8 * sd, 1, R.sting); crash(t + 8 * sd, 0.8, R.sting);
    }
    function stWrecked() {                        // game over: impact, a dying engine, the drone sinks an octave
      const t = now() + 0.02;
      target = 0; pickupBar = -1; stingUntil = t + 3.4;
      doom(t, 1, R.sting); crash(t, 0.6, R.sting); engineDie(t + 0.05);
      if (!playing || !src) return;
      hold(t, t + 4.5); restoreAt = t + 4.5;
      for (const n of PATTERN_LAYERS) { const p = L[n].gain; p.cancelScheduledValues(t); p.setTargetAtTime(0, t, 0.12); }
      const d = src.drone;
      for (let i = 0; i < 4; i++) {
        const p = d[i].detune, b = src.droneDet[i];
        p.cancelScheduledValues(t); p.setValueAtTime(b, t); p.linearRampToValueAtTime(b - 1200, t + 3.2);
        p.setValueAtTime(b - 1200, t + 4.3); p.linearRampToValueAtTime(b, t + 4.4);
      }
      droneLP.frequency.cancelScheduledValues(t); droneLP.frequency.setTargetAtTime(110, t + 0.3, 1.1);
      const g = L.drone.gain; g.cancelScheduledValues(t); g.setTargetAtTime(Math.max(0.5, MIX.drone[intensity]), t, 0.1); g.setTargetAtTime(0, t + 2.4, 0.45);
    }
    function stLevelup() {                        // bright and short, under the game's own C-major blip: a C chord lifting to G
      const t = now() + 0.01;
      stingUntil = t + 0.9;
      whoosh(t, 0.3, 0.16, 500, 3200);
      brass(t, -2, 0.22, 0.85, sting, 0); brass(t + 0.24, 5, 0.5, 1, sting, 0);
      tom(t + 0.24, 'H', 0.7, R.sting, 2);
    }
    const STING = { boss: stBoss, victory: stVictory, depot: stDepot, wrecked: stWrecked, levelup: stLevelup };

    // ================= public API =================
    const api = {
      init(c, d) {
        if (!c) return api;
        if (ctx === c) { if (d && d !== dest) { fade.disconnect(); dest = d; fade.connect(dest); } return api; }
        if (ctx) {                                // a new context: drop the old graph
          clearInterval(timer); clearTimeout(stopTimer); timer = stopTimer = null;
          if (src) stopSources(now()); playing = stopping = false;
          try { fade.disconnect(); } catch (e) {}
        }
        ctx = c; dest = d || c.destination; vNow = 0;
        offline = (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext) ||
          (typeof webkitOfflineAudioContext !== 'undefined' && c instanceof webkitOfflineAudioContext);
        build();
        return api;
      },
      start() {
        if (!ctx) return;
        if (playing) {
          if (stopping) {                         // restarted during the fade-out: come back up
            stopping = false; clearTimeout(stopTimer); stopTimer = null;
            const t = now(); fade.gain.cancelScheduledValues(t); fade.gain.setTargetAtTime(1, t, 0.15);
          }
          return;
        }
        const t = now() + 0.06;
        rand = mulberry(seed + starts * 7919); hum = mulberry((seed ^ 0xA5A5) + starts); starts++;
        intensity = target; bpm = BPM[intensity]; sd = 60 / bpm / 4;
        step = 0; bar = 0; nextT = t; ph.n = 0; ph.bar = 0; ph.since = 2;
        holdFrom = holdUntil = restoreAt = 0; pickupBar = -1; crashNext = false; droneRoot = 99; quiet = false;
        gtrPost.gain.setValueAtTime(0.45, t); bassOut.gain.setValueAtTime(0.26, t);
        brT.fill(0); brN.fill(-1);
        for (const n of LAYERS) on[n] = out[n] = false;
        startSources(t);
        fade.gain.cancelScheduledValues(t); fade.gain.setValueAtTime(1, t);
        for (const n of LAYERS) { const p = L[n].gain; p.cancelScheduledValues(t); p.setValueAtTime(0, t); }
        levels(t, -1, intensity);
        playing = true; stopping = false;
        if (!offline) timer = setInterval(tick, TICK);
        tick();
      },
      stop(f) {
        if (!ctx || !playing || stopping) return;
        const sec = Math.max(0, f === undefined ? 1.5 : +f || 0), t = now(), p = fade.gain;
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + sec + 0.005);
        stopping = true;
        const fin = () => {                       // the scheduler keeps playing under the fade, then everything stops
          clearInterval(timer); timer = stopTimer = null; playing = stopping = false;
          releaseAll(now()); stopSources(now() + 0.03);
        };
        if (offline) fin(); else stopTimer = setTimeout(fin, sec * 1000 + 120);
      },
      setIntensity(l) {
        const v = Math.max(0, Math.min(3, Math.round(+l) || 0));
        if (v === target) return;
        if (playing && v > intensity && step > 0 && step < 12 && !(nextT < holdUntil)) pickupBar = bar;   // rising fill into the change
        else if (v <= intensity) pickupBar = -1;
        target = v;
      },
      stinger(name) {
        const fn = STING[name];
        if (!ctx || !fn) return;
        if (muted) { if (name === 'wrecked') { target = 0; pickupBar = -1; } return; }
        fn();
      },
      setVolume(v) { volume = Math.max(0, Math.min(1, +v || 0)); if (vol) vol.gain.setTargetAtTime(volume, now(), 0.05); },
      setMuted(b) {
        muted = !!b;
        if (mute) { mute.gain.setTargetAtTime(muted ? 0 : 1, now(), 0.03); if (muted && src) releaseAll(now()); }
      },
      state() {
        const t = ctx ? now() : 0;
        if (!playing || stopping) return { playing: false, intensity: target, bar: 0, beat: 0, bpm: BPM[target], target, voices: 0 };
        let k = -1;
        for (let i = 0; i < BR; i++) if (brN[i] >= 0 && brT[i] <= t && (k < 0 || brT[i] > brT[k])) k = i;
        if (k < 0) return { playing: true, intensity, bar: 0, beat: 0, bpm, target, voices: liveAt(t) };
        const beat = Math.min(3, Math.floor((t - brT[k]) / brS[k])) + 1;
        return { playing: true, intensity: brI[k], bar: brN[k] + 1, beat, bpm: Math.round(60 / brS[k]), target, voices: liveAt(t) };
      },
      setSeed(n) { seed = n >>> 0; },
      // QA hooks for the lab page: drive an OfflineAudioContext instance and read the voice counters
      _pump(until) { if (!offline) return; while (vNow < until - 1e-9) { vNow = Math.min(until, vNow + 0.05); tick(); } },
      _trace(on) { trace = on ? [] : null; planLog.length = 0; },
      _plan() { return planLog.slice(); },
      _stats() {                                  // peak = exact overlap from the trace when tracing, else the running estimate
        let peak = peakLive;
        if (trace) {
          const ev = [];
          for (let i = 0; i < trace.length; i += 3) ev.push([trace[i], trace[i + 2]], [trace[i + 1], -trace[i + 2]]);
          ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          let n = 0; peak = 0; for (const e of ev) { n += e[1]; if (n > peak) peak = n; }
        }
        return { peakLive: peak, made, shed, offline, minLead, skips };
      },
      _scale(n, v) { if (n in SC) { SC[n] = v; if (n === 'sting' && sting) sting.gain.value = v; } },
    };
    return api;
  }

  const Music = makeEngine();
  Music._new = makeEngine;                        // a separate engine (for offline renders) without touching the live one
  root.Music = Music;
})(typeof window !== 'undefined' ? window : this);
