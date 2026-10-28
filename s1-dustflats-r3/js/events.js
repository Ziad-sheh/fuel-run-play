'use strict';
// Wasteland Drift · events.js: the director. Between the depots, about once a minute, something happens: a war party
// comes at you head-on, a fuel convoy runs for the depot, a roadblock goes up across the road, bombers on the ridge
// shell the road, or the War Rig or the Bombardier comes hunting. Each one is announced with what to do, and beating
// it pays. The region's boss still guards the fortress at the end of every third leg (about every 3-4 minutes).
// Classic scripts sharing one global scope, loaded in order by index.html.

let ev = null, eventT = 22, evId = 0, lastEvent = '', evCount = 0;
const CONVOY_AT = [0.25, 0.5, 0.75];   // the convoy road: a tanker and its escort at a quarter, half and three quarters of the way
let tankersSeen = 0, convoyN = 0;
function resetEvents() { ev = null; eventT = 22; lastEvent = ''; evCount = 0; tankersSeen = 0; convoyN = 0; }
function updateConvoys() {
  if (STG().set !== 'convoy' || stageBoss || convoyN >= CONVOY_AT.length || stageProgress() < CONVOY_AT[convoyN]) return;
  if (ev && ev.kind === 'convoy') { const T = cars.find(k => k.evTag === ev.id && k.type === 'tanker'); if (T) T.flee = true; ev.end = true; ev.fail = 'THE CONVOY GOT AWAY'; updateEvents(0); }   // the next one is due: this one gets away, so all three come before the boss
  if (ev) return; convoyN++; startEvent('convoy', convoyN > 1);
}   // only the first one says what it is
const fwdA = () => depot ? Math.atan2(depot.y - player.y, depot.x - player.x) : Math.atan2(player.vy, player.vx);   // the way to the depot
const evCars = e => cars.filter(k => k.evTag === e.id && !k.dead);
const EV = {
  warparty: {
    name: 'WAR PARTY AHEAD!', sub: 'WEAVE THROUGH, OR NITRO-RAM', pts: 400, gold: 25, win: 'WAR PARTY SMASHED!',
    start(e) {
      const a = fwdA(), n = 3 + Math.min(3, heat.lv), ca = Math.cos(a), sa = Math.sin(a), d0 = offScreen() + 120;
      for (let i = 0; i < n; i++) { const lat = -230 + 460 * i / (n - 1) + rand(-30, 30), lon = d0 + rand(0, 160);
        incoming.push({ x: player.x + ca * lon - sa * lat, y: player.y + sa * lon + ca * lat, type: i % 3 === 2 && heat.lv >= 3 ? 'ram' : 'buggy', t: 0.4 + i * 0.07, mode: 'oncoming', ahead: true, evTag: e.id }); }
      e.n = n; e.h0 = hurtTotal;
    },
    tick(e) { if (e.t > 1.5 && !evCars(e).some(k => k.mode === 'oncoming')) { const clean = hurtTotal - e.h0 < 5; e.ok = e.kills >= 2 || clean; e.end = true; if (clean && e.kills < 2) e.win = 'CLEAN THROUGH!'; if (!e.ok) e.fail = 'THEY GOT PAST'; } },   // weave through untouched, or take two down
    hud: e => `WAR PARTY · ${evCars(e).filter(k => k.mode === 'oncoming').length} COMING`,
  },
  convoy: {
    name: 'FUEL CONVOY!', sub: 'WRECK THE TANKER BEFORE THE DEPOT', pts: 800, gold: 0, win: 'TANKER DOWN!',
    start(e) {
      const a = fwdA(), side = grand() < 0.5 ? -1 : 1, ca = Math.cos(a), sa = Math.sin(a), lon = 650, lat = side * 260;
      incoming.push({ x: player.x + ca * lon - sa * lat, y: player.y + sa * lon + ca * lat, type: 'tanker', t: 0.6, mode: 'convoy', ahead: true, evTag: e.id }); tankersSeen++;
      for (let i = 0; i < 2; i++) incoming.push({ x: player.x + ca * (lon - 120) - sa * (lat + (i ? 90 : -90)), y: player.y + sa * (lon - 120) + ca * (lat + (i ? 90 : -90)), type: 'buggy', t: 0.8 + i * 0.2, ahead: true });   // its escort
    },
    tick(e) {
      const T = cars.find(k => k.evTag === e.id && k.type === 'tanker');
      if (!T) { if (e.t > 2) { e.ok = e.kills > 0; e.end = true; if (!e.ok) e.fail = 'THE CONVOY GOT AWAY'; } return; }
      const dp = depot ? Math.hypot(depot.x - T.x, depot.y - T.y) : 1e9;
      if (Math.hypot(T.x - player.x, T.y - player.y) > 1900 || dp < 900 || e.t > 50) { T.dead = true; e.end = true; e.fail = 'THE CONVOY GOT AWAY'; }   // it made it
    },
    hud: e => { const T = cars.find(k => k.evTag === e.id && k.type === 'tanker'); return T ? `CONVOY · WRECK THE TANKER · ${(Math.hypot(T.x - player.x, T.y - player.y) / 1000).toFixed(1)} KM` : 'CONVOY'; },
  },
  roadblock: {
    name: 'ROADBLOCK!', sub: 'FIND THE GAP, OR HIT IT FLAT OUT', pts: 300, gold: 15, win: 'ROADBLOCK BUSTED!',
    ok: () => Math.abs(angDiff(fwdA(), -Math.PI / 2)) < 0.6,   // only when the road runs up the screen
    start(e) {
      const y = player.y - 1150, rx = roadX(y) ?? player.x + (depot ? (depot.x - player.x) * 1150 / Math.max(1, player.y - depot.y) : 0), gap = rx + rand(-140, 140), half = 80; e.gap = gap; e.half = half;
      const ch = chunks.get(`${Math.floor(rx / CH)},${Math.floor(y / CH)}`) || null;
      const add = W => { W.block = true; W.ch = ch; W.shakeT = 0; if (ch) ch.walls.push(W); else walls.push(W); };
      add({ x: rx - 800, y: y - 20, w: gap - half - (rx - 800), h: 40, hp: 2 }); add({ x: gap + half, y: y - 20, w: rx + 800 - (gap + half), h: 40, hp: 2 });
      for (const s of [-1, 1]) for (const o of [0, 30]) { const b = { x: gap + s * (half + 26 + o), y: y + 34, r: 17, ch }; if (ch) ch.drums.push(b); else drums.push(b); }   // barrels flank the gap: lead them into it
      for (let i = 0; i < 2 + (heat.lv >= 3 ? 1 : 0); i++) incoming.push({ x: rx + rand(-300, 300), y: y - 90 - rand(0, 60), type: 'buggy', t: 0.3, mode: 'parked', ahead: true, evTag: e.id });
      if (ch) rebuildLists(); e.y = y;
    },
    tick(e) { if (player.y < e.y - 90) { e.end = true; const gap = Math.abs(player.x - e.gap) < e.half + 40; e.ok = e.smashed || gap; if (gap && !e.smashed) e.win = 'THROUGH THE GAP!'; if (!e.ok) e.fail = 'WENT ROUND IT'; } else if (e.t > 40) { e.end = true; } },
    hud: e => `ROADBLOCK · ${(Math.max(0, player.y - e.y) / 1000).toFixed(1)} KM`,
  },
  bombers: {
    name: 'BOMBING RUN!', sub: 'DODGE THE RED CIRCLES', pts: 300, gold: 15, win: 'NOT A SCRATCH!',
    start(e) { e.next = 0.6; e.hp0 = player.hp; },
    tick(e, dt) {
      e.next -= dt;
      if (e.next <= 0 && e.t < 12) {
        e.next = leg <= 2 ? 0.8 : 0.6; const s = grand() < 0.5 ? -1 : 1, a = Math.atan2(player.vy, player.vx) + s * Math.PI / 2;
        bombs.push({ sx: player.x + Math.cos(a) * 650, sy: player.y + Math.sin(a) * 650, tx: player.x + player.vx * 1 + rand(-120, 120), ty: player.y + player.vy * 1 + rand(-120, 120), t: 0, T: 1, shell: true }); SFX.whoosh();
      }
      if (e.t > 13.2) { e.end = true; e.ok = player.hp > e.hp0 - 20; if (!e.ok) e.fail = 'BOMBING RUN OVER'; }
    },
    hud: e => `BOMBING RUN · ${Math.max(0, Math.ceil(12 - e.t))} S`,
  },
  hunter: {
    name: '', pts: 1000, gold: 60, win: '',
    start(e) {
      e.type = leg % 2 ? 'rig' : 'bombard'; const p = spawnPoint(); if (!p) { e.end = true; return; }
      incoming.push({ x: p[0], y: p[1], type: e.type, t: 1.2, evTag: e.id });
      if (e.type === 'bombard') for (let i = 0; i < 2; i++) { const q = spawnPoint(); if (q) incoming.push({ x: q[0], y: q[1], type: 'polecat', t: 1.4 + i * 0.3 }); }   // its escort
    },
    tick(e) { const G = cars.find(k => k.evTag === e.id && k.T.elite); if (!G && e.t > 3) { e.end = true; e.ok = e.kills > 0; } else if (G && e.t > 75) { G.flee = true; e.end = true; e.fail = `${G.T.name} BACKED OFF`; } },
    hud: () => '',
  },
};
function pickEvent() {
  if (evCount === 1) return 'hunter';   // the second event of a run: a mini-boss, so you meet something big within the first two minutes
  const kinds = Object.keys(EV).filter(k => k !== lastEvent && (!EV[k].ok || EV[k].ok()) && (k !== 'hunter' || (heat.lv >= 3 && lastEvent)) && (k !== 'bombers' || evCount > 0));   // the War Rig, the Bombardier and a bombing run never open a run
  return pick(kinds);
}
function startEvent(kind, quiet) {
  const E = EV[kind]; ev = { kind, id: ++evId, t: 0, kills: 0 }; lastEvent = kind; evCount++;
  if (E.name) { if (!quiet) { banner = { text: E.name, t: 0, short: true }; hint(E.sub); } SFX.horn(); }   // a quick title up top, how to beat it down below; the War Rig and the Bombardier announce themselves
  E.start(ev);
}
function updateEvents(dt) {
  if (state !== 'play' || !depot) return;
  if (ev) {
    ev.t += dt; EV[ev.kind].tick(ev, dt);
    if (ev.end) {
      const E = EV[ev.kind];
      if (ev.ok) { const g = Math.round(E.gold * furyGold()), p = Math.round(E.pts * fury.lv); score += p; gold += g; addFury(0.5); SFX.level(); bounty('events'); if ((ev.win || E.win) && !FUEL_RUN) pops.push({ x: player.x, y: player.y - 90, text: `${ev.win || E.win} +${p.toLocaleString('en-US')}`, col: '#5be37d', t: 0 }); }
      else if (ev.fail) pops.push({ x: player.x, y: player.y - 90, text: ev.fail, col: '#c9c2b8', t: 0 });
      ev = null; eventT = FUEL_RUN ? 1e9 : rand(38, 52);   // Fuel Run: events only come from the stage's idea
    }
    return;
  }
  if (boss || bullIn || ambushOn()) return;
  eventT -= dt;
  if (eventT <= 0 && Math.hypot(depot.x - player.x, depot.y - player.y) > 3200) startEvent(pickEvent());
}
function maxHeatEvent() { if (!ev) startEvent('hunter'); }   // five stars on the road: the War Rig or the Bombardier comes for you
