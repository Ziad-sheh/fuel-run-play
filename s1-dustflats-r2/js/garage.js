'use strict';
// Wasteland Drift · garage.js: the six cars, what they cost, their upgrades, and the save kept on this device.
// Classic scripts sharing one global scope, loaded in order by index.html.

// ============ the cars ============
// Stats are multipliers on the tuned base car. Each car's nitro is its signature move (see ABILITY in combat.js).
const CARS = {
  interceptor:  { name: 'Interceptor',    price: 0,    size: 1,    spd: 1,    grip: 1,    turn: 1,    hp: 100, m: 1.2, nitroRate: 1,    boost: 1.5,
                  tag: 'Chrome, a blower and a grudge. Good at everything.',  move: 'FIRE SLIDE', say: 'Nitro throws you into a wild powerslide that leaves a trail of fire.' },
  sandviper:    { name: 'Sandviper',      price: 400,  size: 0.95, spd: 1.08, grip: 0.86, turn: 1.12, hp: 75,  m: 0.8, nitroRate: 1.2,  boost: 1.35,
                  tag: 'A dune buggy. Light, quick, and it slides like butter.', move: 'SANDSTORM', say: 'Nitro kicks up a sand cloud: every car near you goes blind. Your drift spray is wider too.' },
  juggernaut:   { name: 'Juggernaut',     price: 900,  size: 1.22, spd: 0.92, grip: 1.15, turn: 0.82, hp: 170, m: 2.4, nitroRate: 0.85, boost: 1.4,
                  tag: 'A war rig. Slow to turn and impossible to stop.',      move: 'RAMPAGE',   say: 'Nitro: nothing can hurt you and any raider you touch is wrecked. A boss keeps its rules: the Bull and Twin-Horse are dazed, the rest take one capped hit a second.' },
  harpooner:    { name: 'Harpooner',      price: 1400, size: 1,    spd: 0.98, grip: 1,    turn: 1,    hp: 110, m: 1.3, nitroRate: 1.25, boost: 1,
                  tag: 'A pickup with a whaling gun. Hook them, swing them.',  move: 'HARPOON',   say: 'Nitro fires a harpoon at the nearest car. Drift to swing it into the rocks.' },
  doof:         { name: 'Doof Wagon',     price: 2000, size: 1.12, spd: 0.95, grip: 1.05, turn: 0.92, hp: 140, m: 1.8, nitroRate: 1,    boost: 1,
                  tag: 'Speaker stacks and a flame guitar. Loud enough to hurt.', move: 'DOOF BLAST', say: 'Nitro fires a wall of sound: every car around you is blown away and stunned.' },
  blackonblack: { name: 'Black on Black', price: 3000, size: 1,    spd: 1.14, grip: 0.96, turn: 1.05, hp: 95,  m: 1.3, nitroRate: 1.1,  boost: 1.9,
                  tag: 'The last V8. Nothing on the road is faster.',          move: 'OVERDRIVE', say: 'Nitro: nearly double speed, and you ghost straight through traffic.' },
};
const CAR_ORDER = ['interceptor', 'sandviper', 'juggernaut', 'harpooner', 'doof', 'blackonblack'];
const MODS = {   // permanent upgrades: three tiers each, per car, each one about the fuel game
  tank:   { name: 'Fuel tank', say: 'Tank size: +15 fuel a level',               cost: [200, 500, 1000] },
  armour: { name: 'Armour',    say: 'Hits cost 12% less fuel (the drain is unchanged)', cost: [200, 500, 1000] },
  engine: { name: 'Engine',    say: '+4% top speed: catch them, escape', cost: [150, 400, 800] },
  nitro:  { name: 'Nitro',     say: 'Nitro fills 15% faster',           cost: [150, 400, 800] },
};

// ============ the save: gold, the cars you own, their upgrades, a few records ============
const SAVE_KEY = 'fr_save_v1';
const save = { gold: 0, car: 'interceptor', owned: { interceptor: true }, mods: {}, runs: 0, bullsDown: 0, bestLeg: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && typeof s === 'object') Object.assign(save, s); } catch (e) {}
save.owned = Object.assign({ interceptor: true }, save.owned); if (!CARS[save.car] || !save.owned[save.car]) save.car = 'interceptor';
function writeSave() { if (demoSnap) { demoWriteSettings(); return; } try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const modLv = (id, k) => (save.mods[id] && save.mods[id][k]) || 0;
function carStats(id = save.car) {
  const C = CARS[id];
  return { spd: C.spd * (1 + 0.04 * modLv(id, 'engine')), hp: C.hp + 15 * modLv(id, 'tank'), leakK: 1 - 0.12 * modLv(id, 'armour'), grip: C.grip,
           turn: C.turn, m: C.m, size: C.size, nitroRate: C.nitroRate * (1 + 0.15 * modLv(id, 'nitro')), boost: C.boost };   // hp is the fuel tank
}
let banked = 0;   // gold from this run already added to the save
function bankGold() { if (demoSnap) return; if (gold > banked) { save.gold += gold - banked; banked = gold; writeSave(); } }
addEventListener('pagehide', bankGold);
document.addEventListener('visibilitychange', () => { if (document.hidden) bankGold(); });

// ============ the armoury: weapons you buy with gold, bolted on for good ============
// Four slots, one item each, three levels. They fit every car and show on it. Crate gadgets stay as one-shot extras.
const SV = b => `<svg viewBox="0 0 32 32">${b}</svg>`;
const ARM_ICON = {
  plough: SV('<path d="M4 6 L22 6 L29 16 L22 26 L4 26 L10 16 Z" fill="#dfe6ec" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/><path d="M12 10 L18 16 L12 22" fill="none" stroke="#24160f" stroke-width="2"/>'),
  shield: SV('<path d="M6 5 H26 V18 C26 24 20 28 16 29 C12 28 6 24 6 18 Z" fill="#9aa4ae" stroke="#24160f" stroke-width="2" stroke-linejoin="round"/><path d="M11 10 H21 M11 15 H21" stroke="#24160f" stroke-width="2"/>'),
  cannon: SV('<rect x="3" y="18" width="14" height="10" rx="3" fill="#5c626a" stroke="#24160f" stroke-width="2"/><rect x="12" y="10" width="17" height="8" rx="2" fill="#3a3f45" stroke="#24160f" stroke-width="2" transform="rotate(-28 12 14)"/><circle cx="10" cy="23" r="3" fill="#ffd23f" stroke="#24160f" stroke-width="1.5"/>'),
};
const ARMOURY = {
  front: { name: 'FRONT', items: [
    { id: 'fork',   name: 'Spike Fork',   icon: () => ICON.ram,      say: ['Hit a light car nose-first and it\'s skewered', 'Longer spikes, harder rams', 'Skewers armour too'], cost: [300, 650, 1200] },
    { id: 'plough', name: 'Plough',       icon: () => ARM_ICON.plough, say: ['Hits on your nose never hurt you', 'Your shoves throw cars further', 'Shoves throw them much further'], cost: [250, 550, 1000] } ] },
  side:  { name: 'SIDES', items: [
    { id: 'saws',   name: 'Side Saws',    icon: () => ICON.saw,      say: ['Blades shred cars riding beside you', 'Sharper, longer reach', 'Blades tear through armour'], cost: [350, 750, 1300] },
    { id: 'hubs',   name: 'Hub Spikes',   icon: () => ICON.wheels,   say: ['Side-swipes hit twice as hard and spin them out', 'Side-swipes hit harder still', 'Side-swipes tear them apart'], cost: [300, 650, 1100] } ] },
  back:  { name: 'BACK', items: [
    { id: 'shield', name: 'Back Shield',  icon: () => ARM_ICON.shield, say: ['Hits from behind hurt 40% less', 'Rammers bounce off it, dazed', 'Rammers shatter on it'], cost: [300, 650, 1100] },
    { id: 'oiler',  name: 'Oil Dropper',  icon: () => ICON.oil,      say: ['Drops oil on whoever is on your tail (and when you drift)', 'Bigger slicks', 'Drops more often, lasts longer'], cost: [250, 550, 1000] } ] },
  roof:  { name: 'ROOF', items: [
    { id: 'cannon', name: 'Cannon',       icon: () => ARM_ICON.cannon, say: ['A roof turret: shells the nearest car every 1.6 s', 'Every 1.3 s, bigger blast', 'Every second, heavy hits'], cost: [500, 950, 1600] },
    { id: 'flamer', name: 'Flamethrower', icon: () => ICON.flame,    say: ['Torches anything on your tail; drift to sweep it', 'A longer, hotter flame', 'Leaves a trail of fire'], cost: [400, 850, 1400] } ] },
};
ICON.cannon = ARM_ICON.cannon; ICON.plough = ARM_ICON.plough; ICON.shield = ARM_ICON.shield; SRC.cannon = ['cannon', 'Cannon']; SRC_COL.cannon = '#ffd23f';
const ARM_ITEM = {}; for (const [slot, S] of Object.entries(ARMOURY)) for (const it of S.items) ARM_ITEM[it.id] = Object.assign({ slot }, it);
save.armoury = Object.assign({ lv: {}, equip: {} }, save.armoury);
let arm = {};   // this run's equipped items and their levels
function applyArmoury() {   // at the start of a run: what's bolted on, as levels the weapon code already understands
  arm = { fork: 0, plough: 0, saws: 0, hubs: 0, shield: 0, oiler: 0, cannon: 0, flamer: 0 };
  for (const id of Object.values(save.armoury.equip)) if (id && ARM_ITEM[id]) arm[id] = save.armoury.lv[id] || 0;
  const map = [0, 2, 3, 5];
  up.ram = map[arm.fork]; up.saw = [0, 1, 3, 5][arm.saws]; up.oil = [0, 1, 3, 5][arm.oiler]; up.flame = [0, 1, 3, 5][arm.flamer];
}
function nextBuy() {   // what to spend on: the best upgrade you can afford for the car you drive (a new weapon first); else the cheapest thing to save for. goal = the next car
  const ups = [];
  for (const [k, M] of Object.entries(MODS)) { const lv = modLv(save.car, k); if (lv < 3) ups.push({ name: `${M.name} LV ${lv + 1}`, cost: M.cost[lv], go: 'mod:' + k, rank: 0 }); }
  const id = CAR_ORDER.find(c => !save.owned[c]), goal = id ? { name: CARS[id].name, cost: CARS[id].price, go: 'car:' + id, rank: -1 } : null;
  const can = ups.filter(o => o.cost <= save.gold).sort((a, b) => b.rank - a.rank || b.cost - a.cost)[0] || (goal && goal.cost <= save.gold ? goal : null);
  const o = can || ups.concat(goal ? [goal] : []).sort((a, b) => a.cost - b.cost)[0];
  return o ? Object.assign({ affordable: !!can, goal: goal && goal !== o ? goal : null }, o) : null;
}
function renderArmoury() {
  const A = save.armoury;
  $('armoury').innerHTML = '<div class="label">ARMOURY · FITS EVERY CAR</div>' + Object.entries(ARMOURY).map(([slot, S]) => `<div class="aslot"><div class="aname">${S.name}</div>` + S.items.map(it => {
    const lv = A.lv[it.id] || 0, on = A.equip[slot] === it.id, max = lv >= 3, cost = max ? 0 : it.cost[lv];
    const act = !lv ? `<button class="chip buy" data-buy="${it.id}" ${save.gold < cost ? 'disabled' : ''}>${fmtGold(cost)}</button>`
      : `${on ? '<button class="chip on" disabled>ON</button>' : `<button class="chip" data-eq="${it.id}">FIT</button>`}${max ? '' : `<button class="chip lvlup" data-buy="${it.id}" ${save.gold < cost ? 'disabled' : ''}>▲ ${cost}</button>`}`;
    return `<div class="aitem${on ? ' on' : ''}" data-item="${it.id}"><div class="aic">${it.icon()}</div><div class="atxt"><b>${it.name}</b><small>${it.say[Math.max(0, lv - 1)]}</small><div class="pips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div><div class="abtn">${act}</div></div>`;
  }).join('') + '</div>').join('');
}
$('armoury').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const A = save.armoury;
  if (b.dataset.buy) { const it = ARM_ITEM[b.dataset.buy], lv = A.lv[it.id] || 0; if (lv >= 3 || save.gold < it.cost[lv]) return; save.gold -= it.cost[lv]; A.lv[it.id] = lv + 1; if (!lv) A.equip[it.slot] = it.id; SFX.coin(); SFX.level(); }
  else if (b.dataset.eq) { const it = ARM_ITEM[b.dataset.eq]; A.equip[it.slot] = it.id; SFX.clang(); }
  writeSave(); renderGarage();
});

// ============ the garage screen ============
let gIdx = Math.max(0, CAR_ORDER.indexOf(save.car));
const fmtGold = n => `${n.toLocaleString('en-US')} GOLD`;
function drawCarView(id) {   // the car on a patch of sand, big, at a three-quarter angle, with its shadow
  const c = $('carView'), dpr = Math.min(2, devicePixelRatio || 1), W = 300, H = 170;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAL.sand; g.fillRect(0, 0, W, H);
  g.fillStyle = DOTS.sand; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.42, H * 0.26, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(36,22,15,.3)'; g.lineWidth = 1.4; for (let i = 0; i < 9; i++) { const x = (i * 71) % W, y = 16 + (i * 37) % (H - 30); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 5, x + 28, y); g.stroke(); }
  const AL = k => Object.values(save.armoury.equip).includes(k) ? save.armoury.lv[k] || 0 : 0;   // the car wears what's fitted in the armoury
  const o = { lv: 1, ram: [0, 2, 3, 5][AL('fork')], rocket: 0, flame: AL('flamer') ? 1 : 0, caltrops: 0, wheels: 0, oil: AL('oiler') ? 1 : 0, plough: AL('plough'), shield: AL('shield'), hubs: AL('hubs') }, sp = sprite(carArtKey(id, o), carBox(id, o), gg => artCarBody(gg, id, o));
  const k = 1.45 * CARS[id].size, a = -0.32, A = CAR_ART[id], [fx, fy, fw, fh] = frontWheel(id, 0);
  g.save(); g.translate(W / 2 + 22, H / 2 + 6);
  g.save(); g.translate(SUN_X * 1.4, SUN_Y * 1.4); g.rotate(a); g.fillStyle = SHADOW; rr(g, (A.tail - 2) * k, -(A.half + 8) * k, (A.nose - A.tail + 4) * k, (A.half + 8) * 2 * k, 14); g.fill(); g.restore();
  g.rotate(a); g.scale(k, k);
  for (const s of [-1, 1]) artTyre(g, fx, s * fy, fw, fh, 0.32);
  g.drawImage(sp.c, sp.x0, sp.y0, sp.w, sp.h);
  const [flx, fly, flc] = A.flag; artFlag(g, flx, fly, flc, 0, true);
  if (AL('saws')) for (const s of [-1, 1]) { g.save(); g.translate(4, s * (A.half + 12 + AL('saws') * 2)); ink(g, () => starPath(g, 0, 0, 11 + AL('saws') * 2, 10, 0.72), 'chrome', { lw: 1.4, double: false }); g.restore(); }   // side saws
  if (AL('cannon')) { g.save(); g.translate(A.gun[0], A.gun[1]); inkRR(g, 0, -4.5, 26 + AL('cannon') * 3, 9, 2.5, 'dark', { lw: 1.8, double: false }); inkCircle(g, 0, 0, 9, 'steel', { lw: 2, double: false }); g.restore(); }   // the cannon
  g.restore();
  if (!save.owned[id]) { g.fillStyle = 'rgba(36,22,15,.45)'; g.fillRect(0, 0, W, H); g.font = `34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = INK; g.strokeText('LOCKED', W / 2, H / 2); g.fillStyle = PAL.bone; g.fillText('LOCKED', W / 2, H / 2); }
}
function modValues(id, k) {   // what the next level of this upgrade changes for this car: now → next, in the car's own numbers
  const lv = modLv(id, k), st = carStats(id), was = save.mods[id];
  save.mods[id] = Object.assign({}, was, { [k]: Math.min(3, lv + 1) }); const nx = carStats(id); if (was === undefined) delete save.mods[id]; else save.mods[id] = was;   // peek at the next level
  const pct = (a, b) => `${Math.round(a * 100)}% → ${Math.round(b * 100)}%`, C = CARS[id];
  if (k === 'tank') return `${st.hp} → ${nx.hp}`;
  if (k === 'armour') return 'hit cost ' + pct(st.leakK, nx.leakK);
  if (k === 'engine') return pct(st.spd / C.spd, nx.spd / C.spd);
  return pct(st.nitroRate / C.nitroRate, nx.nitroRate / C.nitroRate);
}
function statBar(label, v) { return `<div class="sbar"><span>${label}</span><i><b style="width:${Math.round(clamp(v, 0.05, 1) * 100)}%"></b></i></div>`; }
function renderGarage() {
  const id = CAR_ORDER[gIdx], C = CARS[id], st = carStats(id), owned = !!save.owned[id];
  $('wallet').textContent = fmtGold(save.gold);
  $('carName').textContent = C.name.toUpperCase(); $('carTag').textContent = C.tag;
  $('carMove').textContent = `NITRO: ${C.move}`; $('carMoveSay').textContent = C.say;
  $('carStats').innerHTML = statBar('SPEED', (st.spd - 0.8) / 0.5) + statBar('GRIP', (st.grip - 0.7) / 0.6) + statBar('TANK', st.hp / 220) + statBar('ARMOUR', (1 - st.leakK) / 0.36) + statBar('WEIGHT', st.m / 2.6);   // the tank is fuel; armour is how much less a hit costs
  const act = $('carAction');
  if (save.car === id) { act.textContent = 'DRIVING THIS'; act.disabled = true; act.className = 'btn alt'; }
  else if (owned) { act.textContent = 'DRIVE THIS'; act.disabled = false; act.className = 'btn'; }
  else { act.textContent = `BUY · ${fmtGold(C.price)}`; act.disabled = save.gold < C.price; act.className = 'btn'; }
  $('carMods').innerHTML = !owned ? '<div class="modnote">Buy this car to upgrade it</div>' : Object.entries(MODS).map(([k, M]) => {
    const lv = modLv(id, k), max = lv >= 3, cost = max ? 0 : M.cost[lv];
    return `<div class="mod"><div><b>${M.name}</b><small>${M.say}</small><em>${max ? 'MAX' : modValues(id, k)}</em></div><div class="pips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div><button class="chip${max ? ' on' : ''}" data-mod="${k}" ${max || save.gold < cost ? 'disabled' : ''}>${max ? 'MAX' : fmtGold(cost)}</button></div>`;
  }).join('');
  renderArmoury();
  $('carDots').innerHTML = CAR_ORDER.map((c, i) => `<i class="${i === gIdx ? 'on' : ''}${save.owned[c] ? ' own' : ''}"></i>`).join('');
  drawCarView(id);
}
function openGarage(go) {   // go = 'car:id', 'arm:id' or 'mod:key': open on that thing, scrolled to it and lit up
  go = typeof go === 'string' ? go : '';
  $('menu').hidden = true; $('garage').hidden = false; gIdx = Math.max(0, CAR_ORDER.indexOf(go.startsWith('car:') ? go.slice(4) : save.car)); renderGarage(); $('garage').scrollTop = 0;
  $('garageBack').textContent = pitStop ? '◀ BACK' : '◀ BACK';
  const el = go.startsWith('arm:') ? $('garage').querySelector(`[data-item="${go.slice(4)}"]`) : go.startsWith('mod:') ? ($('garage').querySelector(`[data-mod="${go.slice(4)}"]`) || {}).parentElement : null;
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('pulse'); }
}
let pitStop = false;   // the garage opened from a region-clear screen: BACK goes back there, and the run rolls on
function openPit(go) { pitStop = state === 'cleared' || state === 'over'; $('over').hidden = true; openGarage(go); }   // from the results screen: BACK goes back to it
function closeGarage() {
  $('garage').hidden = true;
  if (pitStop) { pitStop = false; summary(...lastSum); return; }
  $('menu').hidden = false; renderTitleCar();
}
function renderTitleCar() { $('titleCar').textContent = `${CARS[save.car].name.toUpperCase()} · ${fmtGold(save.gold)}`; if (window.renderBounties && $('bounties')) renderBounties(); const nx = nextBuy(); $('garageBtn').classList.toggle('hasnew', !!(nx && nx.affordable)); }   // a dot on the garage when you can buy something
$('garageBtn').addEventListener('click', () => { pitStop = false; openGarage(); });
$('overGarage').addEventListener('click', () => openPit());
$('nextBuy').addEventListener('click', () => { const nx = nextBuy(); openPit(nx ? nx.go : ''); });
$('garageBack').addEventListener('click', closeGarage);
$('carPrev').addEventListener('click', () => { gIdx = (gIdx + CAR_ORDER.length - 1) % CAR_ORDER.length; renderGarage(); });
$('carNext').addEventListener('click', () => { gIdx = (gIdx + 1) % CAR_ORDER.length; renderGarage(); });
{ let x0 = null; const v = $('carView');   // swipe the showroom
  v.addEventListener('pointerdown', e => { x0 = e.clientX; });
  v.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) { gIdx = (gIdx + (e.clientX < x0 ? 1 : CAR_ORDER.length - 1)) % CAR_ORDER.length; renderGarage(); } x0 = null; }); }
$('carAction').addEventListener('click', () => {
  const id = CAR_ORDER[gIdx], C = CARS[id];
  if (save.owned[id]) { save.car = id; writeSave(); renderGarage(); return; }
  if (save.gold < C.price) return;
  save.gold -= C.price; save.owned[id] = true; save.car = id; writeSave(); SFX.level(); renderGarage();
});
$('carMods').addEventListener('click', e => {
  const b = e.target.closest('[data-mod]'); if (!b || b.disabled) return;
  const id = CAR_ORDER[gIdx], k = b.dataset.mod, lv = modLv(id, k); if (lv >= 3) return;
  const cost = MODS[k].cost[lv]; if (save.gold < cost) return;
  save.gold -= cost; save.mods[id] = Object.assign({}, save.mods[id], { [k]: lv + 1 }); writeSave(); SFX.coin(); renderGarage();
});
renderTitleCar();
if (location.hash === '#garage') openGarage();   // a direct link straight into the garage
