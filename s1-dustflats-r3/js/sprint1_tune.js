'use strict';
// Fuel Run · sprint1_tune.js: the Sprint 1 tuning panel (?tune=1). A phone-sized overlay of big sliders over the numbers
// in sprint1_tuning.js. Changes apply LIVE (the run reads these values every frame or every wreck) and are kept in
// localStorage (fr_s1_tune_v1): only the values you moved in the panel are kept. Order on load: the file's defaults, then
// the panel's saved values, then the URL overrides (&drain= etc. still win for a one-off test). COPY puts the current
// values on the clipboard; RESET puts the file's defaults back and forgets the saved values.
// Loaded before sprint1_tuning.js, which calls s1TuneRestore() just before its URL overrides.
// Classic scripts sharing one global scope, loaded in order by index.html.

const S1_TUNE_KEY = 'fr_s1_tune_v1';
let S1_TUNE_DEFAULTS = null;   // the file's own values, before anything else touches them
const S1_TUNE_ROWS = [   // id, label, path in SPRINT1_TUNING (or a special), min, max, step
  ['cap', 'Spawn cap (alive)', 'spawn.cap', 6, 40, 1],
  ['peakCap', 'On-screen enemy cap', 'spawn.peakCap', 4, 18, 1],
  ['density', 'Density scale (all waves n)', '*density', 0.5, 1.5, 0.05],
  ['hitK', 'Enemy hit damage x', 'enemy.hitK', 0.5, 5, 0.1],
  ['drain', 'Fuel drain /s', 'fuel.drain', 0.2, 3, 0.05],
  ['gunWreck', 'Gun wreck refill', 'fuel.gunWreck', 0, 3, 0.05],
  ['ramMult', 'Ram multiplier', 'fuel.ramMult', 1, 6, 0.25],
  ['takedownBurst', 'Takedown burst', 'fuel.takedownBurst', 0, 20, 0.5],
  ['crackSecs', 'Crack duration s', 'crack.secs', 0.5, 6, 0.1],
  ['clrMin', 'Clearing min s', 'clearings.minSecs', 0, 60, 1],
  ['clrMax', 'Clearing max s', 'clearings.maxSecs', 20, 120, 1],
  ['atOnce0', 'Clearing 1 on screen', 'clearings.waves.0.atOnce', 4, 30, 1],
  ['atOnce1', 'Clearing 2 on screen', 'clearings.waves.1.atOnce', 4, 30, 1],
];
const s1TPath = (T, path) => { const p = path.split('.'), last = p.pop(); let o = T; for (const k of p) o = o[k]; return [o, last]; };
function s1TuneGet(id) {
  const T = SPRINT1_TUNING, R = S1_TUNE_ROWS.find(r => r[0] === id);
  if (R[2] === '*density') { const W = T.spawn.waves, D = S1_TUNE_DEFAULTS.spawn.waves; return Math.round(W[W.length - 1].n / D[D.length - 1].n * 100) / 100; }
  const [o, k] = s1TPath(T, R[2]); return o[k];
}
function s1TuneSet(id, v) {
  const T = SPRINT1_TUNING, R = S1_TUNE_ROWS.find(r => r[0] === id);
  if (R[2] === '*density') { T.spawn.waves.forEach((w, i) => { w.n = Math.max(1, Math.round(S1_TUNE_DEFAULTS.spawn.waves[i].n * v)); }); return; }
  const [o, k] = s1TPath(T, R[2]); o[k] = v;
}
function s1TuneSaved() { try { const s = JSON.parse(localStorage.getItem(S1_TUNE_KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
function s1TuneRestore(T) {   // called by sprint1_tuning.js: keep the defaults, then lay the saved values over them
  S1_TUNE_DEFAULTS = JSON.parse(JSON.stringify(T));
  const S = s1TuneSaved(); for (const [id, v] of Object.entries(S)) if (S1_TUNE_ROWS.some(r => r[0] === id) && isFinite(v)) s1TuneSet(id, +v);
}
function s1TuneValues() { const o = {}; for (const [id] of S1_TUNE_ROWS) o[id] = s1TuneGet(id); return o; }

// ============ the panel ============
function s1TuneOpen() {
  const st = document.createElement('style');
  st.textContent = `#s1t{position:fixed;z-index:60;right:6px;top:calc(env(safe-area-inset-top) + 118px);width:min(94vw,360px);max-height:62vh;overflow-y:auto;background:rgba(36,22,15,.8);border:3px solid #24160f;border-radius:6px;padding:8px 10px;box-sizing:border-box;font:14px/1.2 -apple-system,system-ui,sans-serif;color:#fff4dc;touch-action:pan-y;-webkit-user-select:none;user-select:none}
#s1t.off{display:none}
#s1t .r{margin:6px 0 10px}#s1t .h{display:flex;justify-content:space-between;font-weight:700}#s1t .h b{color:#ffd23f;font-variant-numeric:tabular-nums}
#s1t .c{display:flex;align-items:center;gap:6px;margin-top:4px}#s1t input[type=range]{flex:1;height:36px;accent-color:#ff7a1a;touch-action:none}
#s1t button,#s1tBtn{font:700 18px/1 -apple-system,system-ui,sans-serif;min-width:44px;min-height:40px;border:3px solid #24160f;border-radius:6px;background:#fff4dc;color:#24160f}
#s1t .bar{display:flex;gap:8px;position:sticky;top:-8px;background:rgba(36,22,15,.95);padding:6px 0;margin:-8px 0 4px}#s1t .bar button{flex:1;font-size:15px}
#s1tBtn{position:fixed;z-index:61;right:6px;top:calc(env(safe-area-inset-top) + 74px);font-size:14px;padding:0 10px;opacity:.9}
#s1tToast{position:fixed;z-index:62;left:50%;top:45%;transform:translateX(-50%);background:#5be37d;color:#24160f;border:3px solid #24160f;border-radius:6px;padding:8px 16px;font:700 18px system-ui;display:none}
#s1t .note{font-size:12px;opacity:.75;margin:2px 0 6px}`;
  document.head.appendChild(st);
  const P = document.createElement('div'); P.id = 's1t';
  P.innerHTML = `<div class="bar"><button data-a="copy">COPY</button><button data-a="reset">RESET</button><button data-a="hide">HIDE</button></div>
<div class="note">Live: changes apply to the current run at once and are saved on this device.</div>` +
    S1_TUNE_ROWS.map(([id, label, , mn, mx, step]) => `<div class="r"><div class="h"><span>${label}</span><b id="s1tv_${id}"></b></div><div class="c"><button data-a="dec" data-id="${id}">−</button><input type="range" id="s1ts_${id}" min="${mn}" max="${mx}" step="${step}"><button data-a="inc" data-id="${id}">+</button></div></div>`).join('');
  document.body.appendChild(P);
  const B = document.createElement('button'); B.id = 's1tBtn'; B.textContent = 'TUNE'; document.body.appendChild(B);
  const toast = document.createElement('div'); toast.id = 's1tToast'; document.body.appendChild(toast);
  const say = t => { toast.textContent = t; toast.style.display = 'block'; clearTimeout(say.t); say.t = setTimeout(() => { toast.style.display = 'none'; }, 1100); };
  const fmtV = (id, v) => { const st2 = S1_TUNE_ROWS.find(r => r[0] === id)[5]; return st2 >= 1 ? String(Math.round(v)) : (+v).toFixed(st2 < 0.1 ? 2 : 1); };
  const show = () => { for (const [id] of S1_TUNE_ROWS) { const v = s1TuneGet(id); $('s1ts_' + id).value = v; $('s1tv_' + id).textContent = fmtV(id, v); } };
  const put = (id, v) => {   // clamp, apply live, remember
    const R = S1_TUNE_ROWS.find(r => r[0] === id); v = Math.round(clamp(v, R[3], R[4]) / R[5]) * R[5]; v = +v.toFixed(3);
    s1TuneSet(id, v); const S = s1TuneSaved(); S[id] = v; try { localStorage.setItem(S1_TUNE_KEY, JSON.stringify(S)); } catch (e) {}
    $('s1ts_' + id).value = v; $('s1tv_' + id).textContent = fmtV(id, v);
  };
  P.addEventListener('input', e => { const id = e.target.id.replace('s1ts_', ''); if (e.target.type === 'range') put(id, +e.target.value); });
  P.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a, id = b.dataset.id;
    if (a === 'inc' || a === 'dec') { const R = S1_TUNE_ROWS.find(r => r[0] === id); put(id, s1TuneGet(id) + (a === 'inc' ? R[5] : -R[5])); }
    else if (a === 'hide') P.classList.add('off');
    else if (a === 'reset') { try { localStorage.removeItem(S1_TUNE_KEY); } catch (e2) {} for (const [rid, , path] of S1_TUNE_ROWS) { if (path === '*density') s1TuneSet(rid, 1); else { const [o, k] = s1TPath(SPRINT1_TUNING, path), [d] = s1TPath(S1_TUNE_DEFAULTS, path); o[k] = d[k]; } } show(); say('Defaults back'); }
    else if (a === 'copy') {
      const txt = JSON.stringify(s1TuneValues());
      const fallback = () => { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e3) {} t.remove(); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).catch(fallback); else fallback();   // (a phone on the dev server's LAN address isn't a secure context)
      console.log('[s1 tune]', txt); say('Copied!');
    }
  });
  B.addEventListener('click', () => P.classList.toggle('off'));
  for (const el of [P, B]) for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true });   // taps on the panel never reach the game
  show();
}
if (new URLSearchParams(location.search).get('tune') === '1') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', s1TuneOpen); else setTimeout(s1TuneOpen, 0);
}
