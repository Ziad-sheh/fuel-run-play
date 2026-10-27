'use strict';
// Wasteland Drift · engine.js: your engine and tyres, synthesised and always running.
// A gritty V8: two detuned saws and a sub through a waveshaper and a low-pass that opens with speed. The pitch climbs
// through each gear and drops on the shift; nitro adds a supercharger whine; sliding adds tyre screech. Persistent
// nodes, parameters eased every frame, so it costs almost nothing.
// Classic scripts sharing one global scope, loaded in order by index.html.

let eng = null;
function engineInit() {
  if (eng || !ac) return;
  const out = ac.createGain(); out.gain.value = 0; out.connect(master);
  const shape = ac.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 3.2); } shape.curve = curve;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 2.2;
  shape.connect(lp); lp.connect(out);
  const mk = (type, det, g) => { const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.detune.value = det; v.gain.value = g; o.connect(v); v.connect(shape); o.start(); return o; };
  const oscs = [mk('sawtooth', -9, 0.32), mk('sawtooth', 11, 0.28), mk('square', 0, 0.22)];
  const whine = ac.createOscillator(), wg = ac.createGain(); whine.type = 'sine'; wg.gain.value = 0; whine.connect(wg); wg.connect(master); whine.start();   // the supercharger
  const sq = ac.createBufferSource(), sf = ac.createBiquadFilter(), sg = ac.createGain(); sq.buffer = noiseBuf; sq.loop = true; sf.type = 'bandpass'; sf.frequency.value = 2200; sf.Q.value = 6; sg.gain.value = 0; sq.connect(sf); sf.connect(sg); sg.connect(master); sq.start();   // tyre screech
  eng = { out, lp, oscs, whine, wg, sg, sf, gearT: 0 };
}
function engineTick(dt) {
  if (!ac) return; if (!eng) engineInit(); if (!eng) return;
  const t = ac.currentTime, on = (state === 'play' || state === 'pick') && !muted;
  const sp = Math.hypot(player.vx, player.vy), top = SPEED * (player.spd || 1) * 1.5;
  // four gears: the pitch rises through each and falls back on the shift
  const r = clamp(sp / top, 0, 1), gear = Math.min(3, Math.floor(r * 4)), inGear = r * 4 - gear;
  const f = 38 + gear * 7 + inGear * 34 + (nitroT > 0 ? 14 : 0) + (player.air ? 18 : 0);
  for (const o of eng.oscs) o.frequency.setTargetAtTime(f * (o.type === 'square' ? 0.5 : 1), t, 0.05);
  eng.lp.frequency.setTargetAtTime(260 + r * 1300 + (nitroT > 0 ? 500 : 0), t, 0.08);
  eng.out.gain.setTargetAtTime(on ? 0.05 + r * 0.07 + (nitroT > 0 ? 0.03 : 0) : 0, t, 0.1);
  eng.whine.frequency.setTargetAtTime(f * 9, t, 0.06); eng.wg.gain.setTargetAtTime(on && nitroT > 0 ? 0.018 : 0, t, 0.08);
  const slide = on && !player.air && sp > 140 ? clamp((player.slip - 0.25) * 1.6, 0, 1) : 0;
  eng.sg.gain.setTargetAtTime(slide * 0.06, t, 0.05); eng.sf.frequency.setTargetAtTime(1900 + slide * 900, t, 0.08);
}
