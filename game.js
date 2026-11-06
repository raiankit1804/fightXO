'use strict';
/* STRIKE ARENA – original 2D browser fighter. No external assets. */
(() => {
const W = 960, H = 540, GY = 462;
const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const rnd = (a, b) => a + Math.random() * (b - a);
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${clamp((n >> 16) + amt, 0, 255)},${clamp(((n >> 8) & 255) + amt, 0, 255)},${clamp((n & 255) + amt, 0, 255)})`;
}
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- CHARACTERS ---------------- */
const CHARS = [
  { id: 'kaito', name: 'KAITO', title: 'Ember Monk', hp: 100, speed: 4.2, jump: 15.5, scale: 1, dmg: 1, skin: '#e8b890', main: '#e8590c', dark: '#5a2008', accent: '#ffd43b', special: 'fire', beam: true, spName: 'Flare Orb – fireball', hair: 'flame', limb: 9, stats: [3, 3, 3] },
  { id: 'nyra', name: 'NYRA', title: 'Volt Duelist', hp: 90, speed: 5.3, jump: 16.5, scale: .96, dmg: .95, skin: '#c68a64', main: '#12a8c4', dark: '#0b3340', accent: '#e5fbff', special: 'dash', spName: 'Thunder Rush – lunge', hair: 'pony', limb: 7.5, stats: [2, 5, 2] },
  { id: 'brutus', name: 'BRUTUS', title: 'Granite Brawler', hp: 125, speed: 3.2, jump: 13.5, scale: 1.12, dmg: 1.22, skin: '#a9704a', main: '#5c940d', dark: '#2b4a07', accent: '#f1f3f5', special: 'slam', spName: 'Quake Smash – shockwave', hair: 'bald', limb: 12, stats: [5, 1, 5] },
  { id: 'zephyr', name: 'ZEPHYR', title: 'Veil Assassin', hp: 92, speed: 4.8, jump: 17, scale: 1, dmg: 1.02, skin: '#f1c9a5', main: '#7048e8', dark: '#1d1448', accent: '#f06595', special: 'tele', spName: 'Phantom Step – teleport', hair: 'hood', limb: 7, stats: [3, 4, 2] },
  { id: 'orion', name: 'ORION', title: 'Gravity Sage', hp: 105, speed: 3.9, jump: 15, scale: 1.05, dmg: 1.05, skin: '#d9a37a', main: '#e0a800', dark: '#4a3a0a', accent: '#fff7cc', special: 'rise', spName: 'Sky Breaker – uppercut', hair: 'sage', limb: 8.5, stats: [4, 2, 4] },
  { id: 'frost', name: 'FROST', title: 'Ice Warden', hp: 95, speed: 4.4, jump: 16, scale: .98, dmg: .98, skin: '#e3c5b3', main: '#3aa8d8', dark: '#143a5c', accent: '#ffffff', special: 'ice', spName: 'Frost Shard – slows foe', hair: 'frost', limb: 7.8, beam: true, stats: [3, 3, 3] }
];

/* ---------------- AUDIO ---------------- */
let AC = null, muted = false;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type = 'square', v = .08, slide = 0, delay = 0) {
  const a = ac(); if (!a || muted) return;
  const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, f + slide), t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + d);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + .02);
}
function noise(d, v = .15, freq = 1000) {
  const a = ac(); if (!a || muted) return;
  const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), data = b.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = freq; g.gain.value = v;
  s.connect(fl); fl.connect(g); g.connect(a.destination); s.start();
}
const SFX = {
  hit() { noise(.12, .3, 1400); tone(170, .12, 'square', .1, -90); },
  block() { noise(.07, .18, 3000); tone(420, .06, 'triangle', .08, -200); },
  whoosh() { noise(.14, .08, 700); },
  fire() { noise(.3, .12, 500); tone(300, .3, 'sawtooth', .06, 300); },
  super() { tone(110, .6, 'sawtooth', .12, 400); noise(.6, .2, 400); },
  ko() { noise(.5, .35, 300); tone(200, .6, 'sawtooth', .15, -170); },
  tele() { tone(900, .18, 'sine', .1, -700); },
  ui() { tone(660, .07, 'square', .05); },
  go() { tone(440, .1, 'square', .08); tone(660, .18, 'square', .08, 0, .1); },
  round() { tone(330, .15, 'square', .08); tone(330, .15, 'square', .08, 0, .2); }
};
let musicOn = false, musicStep = 0, musicTimer = null;
const SCALE = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3];
function musicTick() {
  if (!musicOn) return;
  const base = 110, step = musicStep++;
  if (step % 2 === 0) tone(base * Math.pow(2, SCALE[(step / 2) % SCALE.length | 0] / 12) * 2, .16, 'triangle', .035);
  if (step % 4 === 0) tone(base / 2 * (step % 16 < 8 ? 1 : 1.19), .3, 'sawtooth', .04);
  if (step % 4 === 2) noise(.04, .05, 6000);
  if (step % 8 === 0) { tone(90, .12, 'sine', .12, -50); }
}
function startMusic() { if (musicTimer) return; musicOn = true; musicTimer = setInterval(musicTick, 140); }
function stopMusic() { musicOn = false; clearInterval(musicTimer); musicTimer = null; }

/* ---------------- INPUT ---------------- */
const held = new Set();
const BUF = [{ p: 0, k: 0, s: 0, x: 0 }, { p: 0, k: 0, s: 0, x: 0 }];
const MAPS = [
  { l: ['KeyA'], r: ['KeyD'], u: ['KeyW'], d: ['KeyS'], p: ['KeyF'], k: ['KeyG'], s: ['KeyH'], x: ['KeyR'] },
  { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'], p: ['KeyJ'], k: ['KeyK'], s: ['KeyL'], x: ['KeyI'] }
];
let mode = 1; // 1 = vs CPU, 2 = two players
function keysFor(side, act) { return (mode !== 2 && side === 0) ? MAPS[0][act].concat(MAPS[1][act]) : MAPS[side][act]; }
MAPS.forEach((m, s) => { for (const k in m) m[k].push('P' + s + k); }); // gamepad virtual keys
const LAST = [{ l: 0, r: 0 }, { l: 0, r: 0 }], DASH = [0, 0];
function press(code) {
  if (held.has(code)) return; held.add(code); const now = performance.now();
  for (let side = 0; side < 2; side++) {
    for (const a of ['p', 'k', 's', 'x']) if (keysFor(side, a).includes(code)) BUF[side][a] = 8;
    for (const a of ['l', 'r']) if (keysFor(side, a).includes(code)) { if (now - LAST[side][a] < 260) DASH[side] = a === 'l' ? -1 : 1; LAST[side][a] = now; }
  }
}
const padPrev = [{}, {}];
function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let s = 0; s < 2; s++) {
    const p = pads[s]; if (!p) continue; const ax = p.axes[0] || 0, ay = p.axes[1] || 0, b = i => p.buttons[i] && p.buttons[i].pressed;
    const st = { l: ax < -.5 || b(14), r: ax > .5 || b(15), u: ay < -.6 || b(12), d: ay > .6 || b(13), p: b(2), k: b(0), s: b(3), x: b(1) || b(5) };
    for (const k in st) { if (!!st[k] !== !!padPrev[s][k]) { st[k] ? press('P' + s + k) : release('P' + s + k); padPrev[s][k] = st[k]; } }
  }
}
function bestScore() { try { return +localStorage.getItem('sa_best') || 0; } catch (e) { return 0; } }
function saveBest(v) { try { if (v > bestScore()) localStorage.setItem('sa_best', v); } catch (e) {} }
function release(code) { held.delete(code); }
function humanInput(side) {
  const g = a => keysFor(side, a).some(k => held.has(k));
  return { dash: DASH[side], l: g('l'), r: g('r'), u: g('u'), d: g('d'), p: BUF[side].p > 0, k: BUF[side].k > 0, s: BUF[side].s > 0, x: BUF[side].x > 0 };
}
addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (state === 'fight' && (e.code === 'KeyP' || e.code === 'Escape')) { togglePause(); return; }
  press(e.code);
});
addEventListener('keyup', e => release(e.code));
addEventListener('blur', () => { held.clear(); if (state === 'fight' && G && !G.paused) togglePause(); });
document.querySelectorAll('#touch .t').forEach(el => {
  const k = el.dataset.k;
  const dn = e => { e.preventDefault(); el.classList.add('down'); press(k); };
  const up = e => { e.preventDefault(); el.classList.remove('down'); release(k); };
  el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
});
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('coarse');

/* ---------------- STAGES (pre-rendered) ---------------- */
const STAGE_NAMES = ['NEON ROOFTOP', 'SUNSET TEMPLE', 'FROZEN DOCK'];
function mkCanvas() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
function stageGrad(g, stops) { const gr = g.createLinearGradient(0, 0, 0, GY); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function buildStage(i) {
  const c = mkCanvas(), g = c.getContext('2d'), R = seeded(100 + i * 77);
  if (i === 0) {
    g.fillStyle = stageGrad(g, [[0, '#120a33'], [.55, '#4a1f6e'], [1, '#ff5f9e']]); g.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,255,255,${R() * .8})`; g.fillRect(R() * W, R() * 260, 2, 2); }
    g.fillStyle = '#ffeaf3'; g.beginPath(); g.arc(760, 120, 56, 0, 7); g.fill();
    g.fillStyle = 'rgba(200,160,200,.5)'; [[745, 105, 12], [782, 135, 9], [755, 145, 6]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    [['#2b1553', 250, 70, .55], ['#1b0e3d', 200, 90, .7], ['#0f0724', 140, 110, 1]].forEach(([col, base, bw, wa], layer) => {
      let x = -20;
      while (x < W) {
        const w = bw * (.7 + R() * .8), h = base + R() * 120 - (layer ? 0 : 40), top = GY - h;
        g.fillStyle = col; g.fillRect(x, top, w, h + 10);
        for (let wy = top + 12; wy < GY - 20; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 14) if (R() < wa * .35) { g.fillStyle = R() < .5 ? '#ffd86b' : '#5eead4'; g.globalAlpha = .55; g.fillRect(wx, wy, 6, 8); g.globalAlpha = 1; }
        x += w + 4;
      }
    });
    g.save(); g.shadowColor = '#ff2e88'; g.shadowBlur = 25; g.strokeStyle = '#ff2e88'; g.lineWidth = 5; g.strokeRect(390, 130, 180, 90);
    g.fillStyle = '#ff2e88'; g.font = 'italic 900 64px Impact,sans-serif'; g.textAlign = 'center'; g.fillText('K.O.', 480, 200); g.restore();
    g.fillStyle = stageGrad(g, [[0, '#2a2147'], [1, '#14102a']]); const fl = g.createLinearGradient(0, GY, 0, H); fl.addColorStop(0, '#2d2450'); fl.addColorStop(1, '#0d0a1c'); g.fillStyle = fl; g.fillRect(0, GY, W, H - GY);
    g.save(); g.shadowColor = '#22d3ee'; g.shadowBlur = 18; g.fillStyle = '#22d3ee'; g.fillRect(0, GY - 2, W, 4); g.restore();
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2; for (let x = -200; x < W + 200; x += 80) { g.beginPath(); g.moveTo(480 + (x - 480) * .35, GY); g.lineTo(x * 1.6 - 288, H); g.stroke(); }
    g.fillStyle = '#0a0716'; g.fillRect(0, GY - 70, 14, 70); g.fillRect(W - 14, GY - 70, 14, 70);
  } else if (i === 1) {
    g.fillStyle = stageGrad(g, [[0, '#3a1c5c'], [.45, '#e0526a'], [1, '#ffb347']]); g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(480, 330, 20, 480, 330, 230); sun.addColorStop(0, '#fff3b0'); sun.addColorStop(.35, '#ffd166'); sun.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    [['#8a3a5c', 300, 40], ['#5a2650', 360, 60], ['#321a3f', 410, 80]].forEach(([col, by, amp], l) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, GY);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, by - (Math.sin(x * .008 + l * 2) + Math.sin(x * .021 + l)) * amp * .5 - R() * 12);
      g.lineTo(W, GY); g.fill();
    });
    g.fillStyle = '#c0392b'; g.fillRect(380, 255, 14, 200); g.fillRect(566, 255, 14, 200); g.fillRect(360, 245, 240, 18); g.fillRect(372, 285, 216, 10);
    g.fillStyle = '#1b0f26'; g.beginPath(); g.moveTo(345, 246); g.lineTo(480, 224); g.lineTo(615, 246); g.lineTo(600, 252); g.lineTo(480, 238); g.lineTo(360, 252); g.fill();
    [90, 870].forEach(x => {
      g.fillStyle = '#2a1736'; g.fillRect(x - 28, 120, 56, 342); g.fillStyle = '#3b2250'; for (let y = 120; y < 462; y += 38) g.fillRect(x - 32, y, 64, 8);
      g.fillStyle = '#1b0f26'; g.fillRect(x - 55, 100, 110, 22);
    });
    [260, 700].forEach(x => { const lg = g.createRadialGradient(x, 205, 3, x, 205, 55); lg.addColorStop(0, 'rgba(255,200,90,.9)'); lg.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = lg; g.fillRect(x - 60, 150, 120, 120); g.fillStyle = '#ff6b3d'; g.fillRect(x - 11, 190, 22, 30); g.fillStyle = '#1b0f26'; g.fillRect(x - 1, 160, 2, 30); });
    const fl = g.createLinearGradient(0, GY, 0, H); fl.addColorStop(0, '#8b5a3c'); fl.addColorStop(1, '#3a2418'); g.fillStyle = fl; g.fillRect(0, GY, W, H - GY);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let y = GY + 14; y < H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += 60 + (R() * 40 | 0)) { g.beginPath(); g.moveTo(x, GY); g.lineTo(x - 20, H); g.stroke(); }
    g.fillStyle = 'rgba(255,220,150,.5)'; g.fillRect(0, GY, W, 3);
  } else {
    g.fillStyle = stageGrad(g, [[0, '#050b1f'], [.5, '#0f3a5e'], [1, '#7fc8d6']]); g.fillRect(0, 0, W, H);
    for (let k = 0; k < 110; k++) { g.fillStyle = `rgba(255,255,255,${R() * .9})`; g.fillRect(R() * W, R() * 250, 2, 2); }
    [['rgba(80,255,170,.22)', 90], ['rgba(170,110,255,.2)', 130], ['rgba(60,230,255,.16)', 170]].forEach(([col, y], l) => {
      g.strokeStyle = col; g.lineWidth = 46; g.lineCap = 'round'; g.beginPath();
      for (let x = -20; x <= W + 20; x += 20) { const yy = y + Math.sin(x * .007 + l * 1.7) * 38 + Math.sin(x * .02 + l) * 12; x < 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    });
    [['#cfe9f2', 330, 90], ['#9cc7d9', 380, 70]].forEach(([col, by, amp], l) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, GY);
      for (let x = 0; x <= W; x += 30) g.lineTo(x, by - Math.abs(Math.sin(x * .006 + l * 3)) * amp * 1.4 - R() * 18);
      g.lineTo(W, GY); g.fill();
    });
    g.fillStyle = '#0b2540'; g.fillRect(0, 400, W, GY - 400);
    g.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < W; x += 40) g.fillRect(x, 410 + R() * 30, 24, 2);
    [[70, 380, 70, 82], [150, 400, 60, 62], [830, 385, 80, 77], [905, 410, 55, 52]].forEach(([x, y, w, h]) => {
      g.fillStyle = '#6b4a2e'; g.fillRect(x, y + 0, w, h + (GY - y - h)); g.strokeStyle = '#3c2815'; g.lineWidth = 3; g.strokeRect(x, y, w, GY - y);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, GY); g.moveTo(x + w, y); g.lineTo(x, GY); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x, y - 5, w, 6);
    });
    const fl = g.createLinearGradient(0, GY, 0, H); fl.addColorStop(0, '#9fb8c8'); fl.addColorStop(1, '#2a3d52'); g.fillStyle = fl; g.fillRect(0, GY, W, H - GY);
    g.strokeStyle = 'rgba(20,40,60,.5)'; g.lineWidth = 2; for (let y = GY + 16; y < H; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(0, GY, W, 4);
  }
  return c;
}
const STAGES = [];
function stageImg(i) { return STAGES[i] || (STAGES[i] = buildStage(i)); }

/* ---------------- FIGHTERS ---------------- */
function mkFighter(ch, side, cpu) {
  return { ch, side, cpu, x: side ? 660 : 300, y: GY, vx: 0, vy: 0, face: side ? -1 : 1, hp: ch.hp, maxhp: ch.hp, shown: ch.hp, meter: 0,
    act: null, hitstun: 0, blockstun: 0, kd: false, ko: false, win: false, block: false, combo: 0, comboT: 0, anim: 0, wins: 0, spCd: 0, inv: 0, alpha: 1, fallT: 0, slowT: 0, dashT: 0, dashDir: 0 };
}
function moveFor(f, name) {
  switch (name) {
    case 'punch': return { name, kind: 'punch', su: 4, ac: 3, re: 8, dmg: 6, reach: 64, y0: -128, y1: -84, stun: 14, kb: 3 };
    case 'kick': return { name, kind: 'kick', su: 7, ac: 4, re: 13, dmg: 9, reach: 88, y0: -92, y1: -26, stun: 18, kb: 5 };
    case 'sweep': return { name, kind: 'sweep', su: 9, ac: 3, re: 16, dmg: 7, reach: 92, y0: -34, y1: 0, stun: 30, kb: 5, kd: true };
    case 'super': return { name, kind: 'super', sup: true, su: 32, ac: 6, re: 26, dmg: f.ch.beam ? 0 : 26, reach: 300, y0: -160, y1: 0, stun: 50, kb: 12, kd: true };
    case 'special':
      switch (f.ch.special) {
        case 'fire': return { name, kind: 'fire', su: 12, ac: 2, re: 20, dmg: 0, cd: 50, spawn: 'fire' };
        case 'dash': return { name, kind: 'dash', su: 8, ac: 16, re: 18, dmg: 11, reach: 72, y0: -135, y1: -25, stun: 22, kb: 7, dashV: 13, cd: 70, kd: false };
        case 'slam': return { name, kind: 'slam', su: 20, ac: 4, re: 26, dmg: 12, reach: 100, y0: -120, y1: 0, stun: 26, kb: 9, wave: true, cd: 80 };
        case 'tele': return { name, kind: 'tele', su: 12, ac: 5, re: 15, dmg: 11, reach: 72, y0: -135, y1: -20, stun: 20, kb: 6, tele: true, cd: 75 };
        case 'rise': return { name, kind: 'rise', su: 6, ac: 6, re: 22, dmg: 13, reach: 60, y0: -175, y1: -20, stun: 30, kb: 4, kd: true, cd: 70 };
        case 'ice': return { name, kind: 'fire', su: 12, ac: 2, re: 20, dmg: 0, cd: 55, spawn: 'ice' };
      }
  }
}

let ARC = null, curDiff = 1;
let G = null, state = 'menu', diff = 1, stageSel = -1, sel = [null, null], turn = 0;
const opp = f => G.f[1 - f.side];

function startAct(f, name) {
  const mv = moveFor(f, name);
  f.act = { mv, t: 0, hit: false }; f.block = false;
  if (mv.cd) f.spCd = mv.cd;
  if (name === 'super') { f.meter = 0; G.flash = 34; SFX.super(); } else if (name === 'special' && mv.kind === 'tele') SFX.tele(); else SFX.whoosh();
  if (!f.cpu) BUF[f.side] = { p: 0, k: 0, s: 0, x: 0 };
  f.vx *= .3;
}
function hurtbox(o) { const s = o.ch.scale; return { l: o.x - 26 * s, r: o.x + 26 * s, t: o.y - 150 * s, b: o.y }; }
function meleeOverlap(f, o, m) {
  const s = f.ch.scale, x0 = f.x + f.face * 10 * s, x1 = f.x + f.face * m.reach * s;
  const lx = Math.min(x0, x1), rx = Math.max(x0, x1), ty = f.y + m.y0 * s, by = f.y + m.y1 * s, h = hurtbox(o);
  return lx < h.r && rx > h.l && ty < h.b && by > h.t;
}
function sparks(x, y, col, n, spd = 6) {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(1, spd); G.parts.push({ t: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: rnd(12, 26), col, r: rnd(2, 5) }); }
}
function ring(x, y, col, r1 = 60, life = 18) { G.parts.push({ t: 'r', x, y, r: 6, r1, life, max: life, col }); }

function hit(att, def, m, fromX, dmg) {
  if (!G || G.phase !== 'fight' || def.inv > 0 || def.kd || def.ko) return false;
  if (dmg === undefined) dmg = m.dmg * att.ch.dmg;
  const dir = fromX <= def.x ? 1 : -1, s = def.ch.scale;
  const blocked = def.block && def.y >= GY && (fromX - def.x) * def.face > 0;
  const cx = def.x - dir * 8, cy = def.y - 95 * s;
  if (blocked) {
    def.hp = Math.max(1, def.hp - dmg * (m.sup ? .3 : .1)); def.vx = dir * m.kb * .6; def.blockstun = 9;
    att.meter = Math.min(100, att.meter + dmg * .4); def.meter = Math.min(100, def.meter + dmg * .5);
    sparks(def.x + def.face * 20, cy, '#9be7ff', 8, 5); SFX.block(); G.stop = 3; return true;
  }
  if (def.hitstun > 0 || def.y < GY) att.combo++; else att.combo = 1;
  att.comboT = 80; dmg *= Math.max(.45, 1 - .12 * (att.combo - 1));
  def.hp -= dmg; def.act = null; def.hitstun = m.stun; def.block = false; def.blockstun = 0; def.vx = dir * m.kb;
  if (m.kd || def.y < GY) { def.kd = true; def.vy = m.sup ? -11 : -8; def.y = Math.min(def.y, GY - 1); def.hitstun = Math.max(def.hitstun, 38); def.vx = dir * (m.kb + 2); }
  if (m.slow) def.slowT = 150; if (!att.cpu) G.bestCombo = Math.max(G.bestCombo || 0, att.combo);
  att.meter = Math.min(100, att.meter + dmg * 1.3); def.meter = Math.min(100, def.meter + dmg * .8);
  sparks(cx, cy, att.ch.accent, 10, 8); sparks(cx, cy, '#fff', 5, 5); ring(cx, cy, att.ch.accent, m.sup ? 90 : 40, 14);
  G.shake = Math.max(G.shake, m.kd ? 12 : 6); G.stop = m.kd ? 9 : 5; SFX.hit();
  if (def.hp <= 0) { def.hp = 0; def.ko = true; def.kd = true; def.vy = -11; def.vx = dir * 9; G.stop = 24; G.shake = 20; SFX.ko(); }
  return true;
}

function actUpdate(f, o) {
  const a = f.act, m = a.mv, s = f.ch.scale; a.t++; f.block = false;
  if (m.tele && a.t < m.su) f.alpha = 1 - .9 * a.t / m.su;
  if (m.dashV) { if (a.t > m.su && a.t <= m.su + m.ac) { f.vx = f.face * m.dashV; if (a.t % 2) sparks(f.x - f.face * 20, f.y - rnd(30, 120), f.ch.main, 2, 3); } }
  if (m.tele && a.t === m.su) {
    sparks(f.x, f.y - 80, f.ch.main, 14, 7); ring(f.x, f.y - 80, f.ch.accent, 50, 14);
    let nx = o.x + (f.x < o.x ? 72 : -72); if (nx < 40 || nx > W - 40) nx = o.x - (nx - o.x);
    f.x = clamp(nx, 40, W - 40); f.face = o.x >= f.x ? 1 : -1; f.alpha = 1; sparks(f.x, f.y - 80, f.ch.accent, 14, 7); SFX.tele();
  }
  if (a.t === m.su + 1) {
    if (m.spawn === 'fire') { G.proj.push({ x: f.x + f.face * 44 * s, y: f.y - 95 * s, vx: f.face * 9.5, owner: f, type: 'fire', dmg: 9 * f.ch.dmg, life: 110, r: 18, stun: 18, kb: 5 }); SFX.fire(); }
    if (m.wave) { G.proj.push({ x: f.x + f.face * 70 * s, y: GY, vx: f.face * 7, owner: f, type: 'wave', dmg: 9 * f.ch.dmg, life: 60, r: 24, stun: 24, kb: 6, ground: true }); G.shake = 8; sparks(f.x + f.face * 60, GY, '#d8c8a8', 12, 6); noise(.25, .25, 200); }
    if (m.spawn === 'ice') { G.proj.push({ x: f.x + f.face * 44 * s, y: f.y - 95 * s, vx: f.face * 11.5, owner: f, type: 'ice', dmg: 8 * f.ch.dmg, life: 100, r: 16, stun: 16, kb: 4, slow: true }); SFX.fire(); }
    if (m.sup && f.ch.beam) { G.proj.push({ x: f.x + f.face * 60 * s, y: f.y - 90 * s, vx: f.face * 15, owner: f, type: 'beam', dmg: 24 * f.ch.dmg, life: 70, r: 44, stun: 50, kb: 12, kd: true, sup: true }); }
    if (m.kind === 'rise') { f.vy = -13; f.y = GY - 1; sparks(f.x, f.y, f.ch.accent, 10, 6); }
    if (m.sup) { ring(f.x, f.y - 90, f.ch.accent, 260, 22); ring(f.x, f.y - 90, f.ch.main, 180, 18); G.shake = 14; }
  }
  if (a.t > m.su && a.t <= m.su + m.ac && !a.hit && m.dmg > 0 && meleeOverlap(f, o, m)) { if (hit(f, o, m, f.x)) a.hit = true; }
  if (a.t >= m.su + m.ac + m.re) f.act = null;
}

function control(f, o, inp) {
  const c = f.ch, grounded = f.y >= GY;
  if (f.dashT > 0) { f.dashT--; f.block = false; f.vx = f.dashDir * c.speed * 2.6; if (f.anim % 3 === 0) sparks(f.x - f.dashDir * 12, f.y - rnd(10, 70), '#fff', 1, 2); return; }
  if (inp.dash && grounded && !inp.d) { f.dashT = 11; f.dashDir = inp.dash; f.block = false; if (inp.dash * f.face < 0) f.inv = Math.max(f.inv, 7); if (!f.cpu) DASH[f.side] = 0; return; }
  f.block = !!inp.d && grounded;
  const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (grounded) {
    f.face = o.x >= f.x ? 1 : -1;
    f.vx = f.block ? 0 : dir * c.speed * (dir * f.face < 0 ? .8 : 1) * (f.slowT > 0 ? .55 : 1);
    if (inp.u && !f.block) { f.vy = -c.jump; f.y = GY - 1; f.vx = dir * c.speed * 1.1; }
  } else { f.vx = clamp(f.vx + dir * .3, -c.speed * 1.2, c.speed * 1.2); }
  let n = null;
  if (inp.x && f.meter >= 100 && grounded) n = 'super';
  else if (inp.s && f.spCd <= 0 && grounded) n = 'special';
  else if (inp.k) n = (inp.d && grounded) ? 'sweep' : 'kick';
  else if (inp.p) n = 'punch';
  if (n) startAct(f, n);
}

function updateFighter(f, o, inp) {
  f.anim++; if (f.spCd > 0) f.spCd--; if (f.inv > 0) f.inv--;
  if (f.slowT > 0) { f.slowT--; if (f.anim % 8 === 0) sparks(f.x, f.y - rnd(20, 130), '#bdefff', 1, 2); }
  if (f.comboT > 0 && --f.comboT === 0) f.combo = 0;
  if (f.kd || f.ko) f.fallT++; else f.fallT = 0;
  f.alpha = 1; let ctl = false; const grounded = f.y >= GY;
  if (f.ko) { f.block = false; }
  else if (f.hitstun > 0) { f.hitstun--; f.block = false; }
  else if (f.kd) { if (grounded) { f.kd = false; f.inv = 36; } }
  else if (f.blockstun > 0) { f.blockstun--; f.block = true; }
  else if (f.act) actUpdate(f, o);
  else if (G.phase === 'ko' || G.phase === 'intro' || G.phase === 'vs') { f.block = false; f.vx *= .8; if (grounded) f.face = o.x >= f.x ? 1 : -1; }
  else { ctl = true; control(f, o, inp); }
  if (!ctl) f.vx *= (f.y >= GY ? .82 : .97);
  f.x += f.vx;
  if (f.y < GY || f.vy < 0) { f.vy += .78; f.y += f.vy; if (f.y >= GY) { f.y = GY; f.vy = 0; f.vx *= .5; if (f.ko) { G.shake = 8; noise(.15, .2, 200); } } }
  f.x = clamp(f.x, 40, W - 40);
  f.shown = f.shown > f.hp ? Math.max(f.hp, f.shown - .35) : f.hp;
}

/* ---------------- AI ---------------- */
function aiInput(f, o) {
  const i = { l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0 };
  if (G.training) return i;
  const A = f.ai || (f.ai = { cd: 20, mv: 0, mvT: 0, blk: 0 });
  const L = curDiff, dist = Math.abs(o.x - f.x), dir = o.x > f.x ? 1 : -1, s = f.ch.scale;
  const rP = 64 * s + 26 * o.ch.scale, rK = 88 * s + 26 * o.ch.scale;
  if (A.blk > 0) { A.blk--; i.d = 1; return i; }
  const danger = (o.act && dist < 190) || G.proj.some(p => p.owner !== f && Math.abs(p.x - f.x) < 170 && Math.sign(p.vx) === Math.sign(f.x - p.x));
  if (danger && f.y >= GY && !f.act && Math.random() < [.012, .04, .1][L]) { A.blk = 14 + (Math.random() * 16 | 0); }
  if (A.mvT > 0) { A.mvT--; if (A.mv > 0) { dir > 0 ? i.r = 1 : i.l = 1; } else if (A.mv < 0) { dir > 0 ? i.l = 1 : i.r = 1; } }
  if (A.cd > 0) { A.cd--; return i; }
  A.cd = [28, 17, 8][L] + (Math.random() * 10 | 0);
  const r = Math.random();
  if (o.kd || o.ko) { A.mv = 1; A.mvT = 10; return i; }
  if (f.meter >= 100 && dist < 280 && r < .6) { i.x = 1; return i; }
  if (dist > 330) {
    if (f.ch.special === 'fire' && f.spCd <= 0 && r < .5) i.s = 1; else { A.mv = 1; A.mvT = 26; if (r > .85) i.u = 1; else if (r > .7) i.dash = dir; }
  } else if (dist > rK + 30) {
    if (r < .2 && f.spCd <= 0) i.s = 1; else { A.mv = 1; A.mvT = 14; if (r > .92) i.u = 1; }
  } else if (dist > rP) {
    if (r < .6) i.k = 1; else { A.mv = 1; A.mvT = 8; }
  } else {
    if (r < .08) { i.d = 1; i.k = 1; } else if (r < .38) i.p = 1; else if (r < .62) i.k = 1; else if (r < .72 && f.spCd <= 0 && f.ch.special !== 'fire') i.s = 1;
    else if (r < .86) { A.mv = -1; A.mvT = 18; } else A.blk = 18;
  }
  return i;
}

/* ---------------- MATCH FLOW ---------------- */
function startMatch() {
  const si = stageSel < 0 ? ((mode === 3 && ARC ? ARC.idx : Math.random() * 3) | 0) % 3 : stageSel;
  curDiff = mode === 3 && ARC ? clamp(diff + (ARC.idx >= 3 ? 1 : 0), 0, 2) : diff;
  G = { f: [mkFighter(sel[0], 0, false), mkFighter(sel[1], 1, mode !== 2)], round: 1, phase: 'vs', training: mode === 4, bestCombo: 0, pt: 0, timer: 60, tick: 0, proj: [], parts: [], shake: 0, stop: 0, flash: 0,
    paused: false, stage: si, winner: null, koText: '', ended: false, bgp: [] };
  for (let k = 0; k < 50; k++) G.bgp.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(.4, 1.6), r: rnd(1, 3), ph: rnd(0, 6.28) });
  resetRound(true); G.phase = 'vs'; G.pt = 0;
}
function resetRound(first) {
  const [a, b] = G.f;
  [a, b].forEach((f, i) => { Object.assign(f, { x: i ? 660 : 300, y: GY, vx: 0, vy: 0, face: i ? -1 : 1, hp: f.maxhp, shown: f.maxhp, act: null, hitstun: 0, blockstun: 0, kd: false, ko: false, win: false, block: false, combo: 0, comboT: 0, spCd: 0, inv: 0, alpha: 1, fallT: 0, ai: null, slowT: 0, dashT: 0 }); });
  G.proj = []; G.phase = 'intro'; G.pt = 0; G.timer = 60; G.tick = 0; G.winner = null; G.flash = 0; BUF.forEach(b => { b.p = b.k = b.s = b.x = 0; });
  SFX.round();
}
function endRound() {
  const [a, b] = G.f; let w = null;
  const timeUp = G.timer <= 0 && a.hp > 0 && b.hp > 0;
  if (a.hp <= 0 && b.hp <= 0) w = null; else if (a.hp <= 0) w = b; else if (b.hp <= 0) w = a;
  else { const pa = a.hp / a.maxhp, pb = b.hp / b.maxhp; w = pa > pb ? a : pb > pa ? b : null; }
  G.phase = 'ko'; G.pt = 0; G.winner = w; G.koText = timeUp ? 'TIME UP' : 'K.O.';
  if (w) w.wins++;
  G.perfect = !!w && w.hp >= w.maxhp && !timeUp;
  if (w && ARC && !w.cpu) { ARC.score += 500 + Math.round(w.hp / w.maxhp * 500) + Math.max(0, G.timer) * 10 + (G.perfect ? 1500 : 0) + (G.bestCombo || 0) * 100; G.bestCombo = 0; }
  G.f.forEach(f => { if (!f.ko) { f.act = null; } });
}
function update() {
  if (!G || G.paused) return;
  G.bgp.forEach(p => { p.ph += .03; if (G.stage === 2) { p.y += p.v; p.x += Math.sin(p.ph) * .6; if (p.y > H) { p.y = -5; p.x = rnd(0, W); } } else if (G.stage === 1) { p.y -= p.v * .5; p.x += Math.sin(p.ph) * .5; if (p.y < 0) { p.y = H; p.x = rnd(0, W); } } });
  if (G.stop > 0) { G.stop--; return; }
  G.pt++; G.shake *= .86; if (G.flash > 0) G.flash--;
  BUF.forEach(b => { for (const k in b) if (b[k] > 0) b[k]--; });
  const [a, b] = G.f;
  const slow = G.phase === 'ko' && G.pt < 70 && G.pt % 2;
  if (!slow) {
    const ia = a.cpu ? aiInput(a, b) : humanInput(0), ib = b.cpu ? aiInput(b, a) : humanInput(1);
    const active = G.phase === 'fight';
    const none = { l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0 };
    updateFighter(a, b, active ? ia : none); updateFighter(b, a, active ? ib : none);
    DASH[0] = DASH[1] = 0;
    const dx = b.x - a.x;
    if (Math.abs(dx) < 46 && Math.abs(a.y - b.y) < 50 && !a.ko && !b.ko) { const push = (46 - Math.abs(dx)) / 2 * Math.sign(dx || 1); a.x = clamp(a.x - push, 40, W - 40); b.x = clamp(b.x + push, 40, W - 40); }
    for (let i = G.proj.length - 1; i >= 0; i--) {
      const p = G.proj[i], o = opp(p.owner); p.x += p.vx; p.life--;
      let dead = p.life <= 0 || p.x < -40 || p.x > W + 40;
      if (!dead) {
        const h = hurtbox(o), pl = p.x - p.r, pr = p.x + p.r, pt = p.type === 'wave' ? p.y - 50 : p.y - p.r, pb = p.type === 'wave' ? p.y : p.y + p.r;
        if (pl < h.r && pr > h.l && pt < h.b && pb > h.t && (!p.ground || o.y >= GY - 4)) { if (hit(p.owner, o, p, p.x, p.dmg)) dead = true; }
      }
      if (!dead && p.type === 'fire') for (const q of G.proj) if (q !== p && q.type === 'fire' && q.owner !== p.owner && Math.abs(q.x - p.x) < 34 && Math.abs(q.y - p.y) < 34) { dead = true; q.life = 0; ring(p.x, p.y, '#fff', 60, 14); sparks(p.x, p.y, '#ffd43b', 12, 7); SFX.block(); }
      if (dead) G.proj.splice(i, 1);
    }
  }
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life--; if (p.t === 'p') { p.x += p.vx; p.y += p.vy; p.vy += .25; p.vx *= .96; } else p.r = lerp(p.r, p.r1, .25); if (p.life <= 0) G.parts.splice(i, 1); }
  if (G.phase === 'vs') {
    if (G.pt >= 100) { G.phase = 'intro'; G.pt = 0; SFX.round(); }
  } else if (G.phase === 'intro') {
    if (G.pt === 60) SFX.go();
    if (G.pt >= 110) G.phase = 'fight';
  } else if (G.phase === 'fight') {
    if (G.training) {
      G.timer = 99; a.meter = Math.min(100, a.meter + .4); b.meter = Math.min(100, b.meter + .4);
      if (a.hp < a.maxhp * .4 || b.hp < b.maxhp * .4) { a.hp = a.maxhp; b.hp = b.maxhp; }
      if (a.ko || b.ko) { G.trainT = (G.trainT || 0) + 1; if (G.trainT > 60) { G.trainT = 0; resetRound(); G.phase = 'fight'; } }
    } else {
      G.tick++; if (G.tick % 60 === 0) G.timer--;
      if (a.hp <= 0 || b.hp <= 0 || G.timer <= 0) endRound();
    }
  } else if (G.phase === 'ko') {
    if (G.pt > 60 && G.winner && !G.winner.ko) G.winner.win = true;
    if (G.pt >= 200) {
      if (G.f.some(f => f.wins >= 2)) finishMatch(); else { G.round++; resetRound(); }
    }
  }
}
function finishMatch() {
  G.phase = 'end'; G.ended = true;
  const [a, b] = G.f, w = a.wins >= 2 ? a : b;
  let title = mode !== 2 ? (w === a ? 'YOU WIN!' : 'YOU LOSE') : (w === a ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS');
  let sub = `${w.ch.name} – ${w.ch.title.toUpperCase()}  ·  ${a.wins} – ${b.wins}`, btn = 'REMATCH';
  if (ARC) {
    if (w === a) {
      ARC.score += 2000;
      if (ARC.idx + 1 >= ARC.ladder.length) { title = 'CHAMPION!'; sub = `ALL FIGHTERS DEFEATED · SCORE ${ARC.score}`; btn = 'PLAY AGAIN'; ARC.done = true; saveBest(ARC.score); }
      else { title = 'STAGE CLEAR'; sub = `SCORE ${ARC.score} · NEXT: ${ARC.ladder[ARC.idx + 1].name}`; btn = 'NEXT FIGHT'; ARC.next = true; }
    } else { title = 'GAME OVER'; sub = `SCORE ${ARC.score} · BEST ${bestScore()}`; btn = 'RETRY (-1000)'; saveBest(ARC.score); }
  }
  $('endTitle').textContent = title; $('endSub').textContent = sub; $('brematch').textContent = btn;
  $('endscr').classList.remove('hidden'); $('touch').classList.remove('active'); stopMusic();
}

/* ---------------- RENDERING ---------------- */
function ik(from, to, l1, l2, bend) {
  let dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy) || .001;
  d = Math.min(d, l1 + l2 - .01); const nx = dx / Math.hypot(dx, dy || .001) || 0;
  const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [from[0] + ux * a - uy * h * bend, from[1] + uy * a + ux * h * bend];
}
function poseOf(f) {
  const a = f.anim, bob = Math.sin(a * .12) * 2;
  const P = { lean: 0, cr: 3 + bob * .5, hf: [26, -106 + bob], hb: [14, -114 + bob], ff: [18, 0], fb: [-18, 0], mouth: 0, glow: 0, ex: 0 };
  if (f.ko || f.kd) { P.hf = [-14, -86]; P.hb = [-26, -74]; P.ff = [12, -10]; P.fb = [-8, -4]; P.cr = 0; return P; }
  if (f.win) { const t = Math.sin(a * .2); P.hf = [16, -168 + t * 6]; P.hb = [-10, -170 - t * 6]; P.cr = 0; P.lean = 2; P.ff = [16, 0]; P.fb = [-16, 0]; return P; }
  if (f.hitstun > 0) { P.lean = -13; P.hf = [8, -84]; P.hb = [-12, -92]; P.ff = [10, 0]; P.fb = [-22, 0]; P.mouth = 1; return P; }
  if (f.act) {
    const m = f.act.mv, t = f.act.t;
    const e = t <= m.su ? -.25 * (t / m.su) : t <= m.su + m.ac ? 1 : 1 - (t - m.su - m.ac) / m.re;
    const eu = Math.max(e, 0); P.ex = eu;
    switch (m.kind) {
      case 'punch': P.hf = lerp2([26, -106], [m.reach * .95, -104], e); P.lean = 4 * e; P.ff = [24, 0]; P.fb = [-22, 0]; break;
      case 'kick': P.ff = lerp2([18, 0], [m.reach * .92, -76], e); P.lean = -6 * e; P.fb = [-12, 0]; P.cr = 2; break;
      case 'fire': P.hf = lerp2(P.hf, [50, -100], e); P.hb = lerp2(P.hb, [40, -98], e); P.glow = eu; P.ff = [26, 0]; P.fb = [-24, 0]; P.cr = 8; break;
      case 'dash': P.lean = 16 * (t > m.su ? 1 : 0); P.hf = [54, -100]; P.hb = [40, -108]; P.ff = [34, -10]; P.fb = [-34, -24]; P.glow = eu; break;
      case 'slam': if (t <= m.su) { P.hf = [8, -172]; P.hb = [-8, -176]; P.glow = t / m.su; } else { P.hf = [46, -20]; P.hb = [36, -26]; P.lean = 18; P.cr = 10; P.glow = 1; } break;
      case 'rise': P.hf = [24, -176]; P.hb = [12, -168]; P.ff = [14, -28]; P.fb = [-12, -40]; P.lean = -4; P.glow = eu; break;
      case 'sweep': P.cr = 34; P.ff = lerp2([14, 0], [m.reach * .9, -8], e); P.fb = [-24, 0]; P.hf = [20, -62]; P.hb = [6, -66]; P.lean = 10; break;
      case 'tele': P.cr = 22; P.hf = [30, -70]; P.hb = [14, -76]; P.glow = eu; break;
      case 'super': if (t <= m.su) { P.hf = [18, -174]; P.hb = [-8, -178]; P.glow = t / m.su; P.cr = -2; } else { P.hf = [60, -104]; P.hb = [48, -110]; P.glow = 1; P.lean = 8; P.ff = [28, 0]; P.fb = [-26, 0]; } break;
    }
    return P;
  }
  if (f.y < GY - 1) { P.ff = [16, -34]; P.fb = [-10, -46]; P.cr = 8; return P; }
  if (f.block) { P.hf = [30, -116]; P.hb = [22, -100]; P.cr = 9; P.ff = [22, 0]; P.fb = [-20, 0]; return P; }
  if (Math.abs(f.vx) > .5) {
    const ph = a * .3 * (f.vx * f.face > 0 ? 1 : -1), sn = Math.sin(ph), cs = Math.cos(ph);
    P.ff = [sn * 24, -Math.max(0, cs) * 12]; P.fb = [-sn * 24, -Math.max(0, -cs) * 12]; P.cr = 3 + Math.abs(cs) * 2;
  }
  return P;
}
function limb(g, from, to, l1, l2, bend, w, col) {
  const k = ik(from, to, l1, l2, bend), d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const end = d > l1 + l2 ? [from[0] + (to[0] - from[0]) * (l1 + l2) / d, from[1] + (to[1] - from[1]) * (l1 + l2) / d] : to;
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(k[0], k[1]); g.lineTo(end[0], end[1]); g.stroke();
  return end;
}
function drawFighter(g, f, px, py, zoom) {
  const c = f.ch, s = c.scale * (zoom || 1), L = c.limb, P = poseOf(f);
  g.save(); g.translate(px, py);
  if (!zoom) { // ground shadow
    g.fillStyle = 'rgba(0,0,0,.35)'; const sh = clamp(1 - (GY - f.y) / 260, .3, 1);
    g.beginPath(); g.ellipse(0, GY - f.y, 46 * s * sh, 8 * s * sh, 0, 0, 7); g.fill();
  }
  g.globalAlpha = f.alpha * ((f.inv > 0 && !f.kd && f.anim % 4 < 2) ? .6 : 1);
  g.scale(f.face * s, s);
  if (f.kd || f.ko) { const r = Math.min(1, f.fallT / 10); g.translate(0, -16 * r); g.rotate(-Math.PI / 2 * r); }
  const hip = [0, -72 + P.cr], sh = [P.lean, -118 + P.cr], head = [sh[0] + P.lean * .25 + 2, sh[1] - 24];
  const armBack = shade(c.skin, -35), legBack = shade(c.dark, -12);
  // back arm + leg
  limb(g, [sh[0] - 2, sh[1] + 2], P.hb, 30, 28, 1, L * .95, armBack);
  drawHand(g, P.hb, c, L, true);
  const fbE = limb(g, [hip[0] - 3, hip[1]], P.fb, 37, 37, -1, L * 1.15, legBack);
  drawFoot(g, fbE, c, L, true);
  // torso
  g.strokeStyle = c.main; g.lineWidth = L * 2.7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(hip[0], hip[1] + 4); g.lineTo(sh[0], sh[1] + 2); g.stroke();
  g.strokeStyle = shade(c.main, 40); g.lineWidth = L * .5; g.beginPath(); g.moveTo(sh[0] + L * .7, sh[1] + 6); g.lineTo(hip[0] + L * .7, hip[1] + 2); g.stroke();
  g.strokeStyle = c.accent; g.lineWidth = L * .9; g.beginPath(); g.moveTo(hip[0] - L * 1.3, hip[1] + 2); g.lineTo(hip[0] + L * 1.3, hip[1] + 2); g.stroke();
  // front leg
  const ffE = limb(g, [hip[0] + 3, hip[1]], P.ff, 37, 37, -1, L * 1.2, c.dark);
  drawFoot(g, ffE, c, L, false);
  // head
  drawHead(g, f, head, P, c);
  // front arm
  const hfE = limb(g, [sh[0] + 2, sh[1] + 2], P.hf, 30, 28, 1, L, c.skin);
  if (P.glow > 0) { const gr = g.createRadialGradient(hfE[0], hfE[1], 2, hfE[0], hfE[1], 34 * P.glow + 6); gr.addColorStop(0, c.accent); gr.addColorStop(.4, c.main + 'cc'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hfE[0], hfE[1], 34 * P.glow + 6, 0, 7); g.fill(); }
  drawHand(g, hfE, c, L, false);
  g.restore();
}
function drawHand(g, p, c, L, back) { g.fillStyle = back ? shade(c.accent, -50) : c.accent; g.beginPath(); g.arc(p[0], p[1], L * (c.id === 'brutus' ? .95 : .78), 0, 7); g.fill(); }
function drawFoot(g, p, c, L, back) { g.strokeStyle = back ? shade(c.accent, -60) : c.accent; g.lineWidth = L * 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(p[0] - 1, p[1] - 1); g.lineTo(p[0] + 11, p[1] - 1); g.stroke(); }
function drawHead(g, f, h, P, c) {
  const a = f.anim, R = c.id === 'brutus' ? 19 : 17;
  if (c.hair === 'hood') { // scarf
    g.strokeStyle = c.accent; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
    const w = Math.sin(a * .25) * 5 - f.vx * f.face * .8; g.moveTo(h[0] - 6, h[1] + 14); g.quadraticCurveTo(h[0] - 30, h[1] + 14 + w, h[0] - 50, h[1] + 20 + w * 1.6); g.stroke();
  }
  if (c.hair === 'pony') { g.strokeStyle = '#1b1b2f'; g.lineWidth = 8; g.lineCap = 'round'; const w = Math.sin(a * .2) * 5 - f.vx * f.face; g.beginPath(); g.moveTo(h[0] - 12, h[1] - 6); g.quadraticCurveTo(h[0] - 32, h[1] - 6 + w, h[0] - 34, h[1] + 22 + w); g.stroke(); }
  g.fillStyle = c.skin; g.beginPath(); g.arc(h[0], h[1], R, 0, 7); g.fill();
  if (c.hair === 'flame') {
    for (let i = 0; i < 5; i++) { const bx = h[0] - 14 + i * 7, fl = Math.sin(a * .3 + i) * 3; g.fillStyle = i % 2 ? '#ffd43b' : '#ff6b1a'; g.beginPath(); g.moveTo(bx - 6, h[1] - 10); g.lineTo(bx + fl, h[1] - 38 - (i === 2 ? 8 : 0) + Math.sin(a * .4 + i) * 3); g.lineTo(bx + 6, h[1] - 10); g.fill(); }
    g.fillStyle = '#ff6b1a'; g.beginPath(); g.arc(h[0], h[1] - 4, R, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.strokeStyle = c.accent; g.lineWidth = 4; g.beginPath(); g.moveTo(h[0] - R, h[1] - 6); g.lineTo(h[0] + R, h[1] - 6); g.stroke();
  } else if (c.hair === 'pony') {
    g.fillStyle = '#1b1b2f'; g.beginPath(); g.arc(h[0] - 1, h[1] - 3, R + 1, Math.PI * .95, Math.PI * 1.9); g.fill();
    g.strokeStyle = c.main; g.lineWidth = 4; g.beginPath(); g.moveTo(h[0] - R + 1, h[1] - 6); g.lineTo(h[0] + R - 1, h[1] - 8); g.stroke();
  } else if (c.hair === 'bald') {
    g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(h[0] + 3, h[1] + 12, 14, 9, 0, 0, Math.PI); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.beginPath(); g.moveTo(h[0] + 2, h[1] - 8); g.lineTo(h[0] + 15, h[1] - 5); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(h[0] - 8, h[1] - 14); g.lineTo(h[0] - 3, h[1] - 6); g.stroke();
  } else if (c.hair === 'hood') {
    g.fillStyle = c.dark; g.beginPath(); g.arc(h[0] - 3, h[1] - 2, R + 4, Math.PI * .6, Math.PI * 2.1); g.fill();
    g.fillStyle = shade(c.dark, 40); g.beginPath(); g.arc(h[0] + 3, h[1] + 1, R - 2, 0, 7); g.fill();
    g.fillStyle = '#0c0820'; g.fillRect(h[0] - 8, h[1] + 3, 22, 13);
    g.fillStyle = c.skin; g.fillRect(h[0] - 6, h[1] - 8, 19, 8);
  }
  if (c.hair === 'sage') {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(h[0] - 1, h[1] - 3, R + 1, Math.PI * .95, Math.PI * 1.95); g.fill();
    g.beginPath(); g.arc(h[0] - 4, h[1] - R - 6, 8, 0, 7); g.fill();
    g.strokeStyle = c.main; g.lineWidth = 4; g.beginPath(); g.moveTo(h[0] - R + 1, h[1] - 7); g.lineTo(h[0] + R - 1, h[1] - 9); g.stroke();
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.ellipse(h[0] + 4, h[1] + 13, 10, 8, 0, 0, Math.PI); g.fill();
  }
  if (c.hair === 'frost') {
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#e0fbff' : '#4cc9f0'; g.beginPath(); g.moveTo(h[0] - 19 + i * 8, h[1] - 10); g.lineTo(h[0] - 16 + i * 9, h[1] - 34 - (i % 2) * 7); g.lineTo(h[0] - 9 + i * 8, h[1] - 10); g.fill(); }
    g.fillStyle = '#4cc9f0'; g.fillRect(h[0] - R + 1, h[1] - 10, 2 * R - 2, 6);
  }
  // eyes
  const ex = h[0] + 7;
  if (c.hair === 'hood') { g.fillStyle = c.accent; g.fillRect(ex - 2, h[1] - 5, 7, 3); }
  else if (P.mouth) { g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 2, h[1] - 6); g.lineTo(ex + 4, h[1] - 2); g.moveTo(ex + 4, h[1] - 6); g.lineTo(ex - 2, h[1] - 2); g.stroke(); g.fillStyle = '#400'; g.fillRect(ex - 1, h[1] + 7, 5, 4); }
  else { g.fillStyle = '#fff'; g.fillRect(ex - 2, h[1] - 6, 7, 5); g.fillStyle = '#111'; g.fillRect(ex + 1, h[1] - 5, 3, 4); g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 3, h[1] - 8); g.lineTo(ex + 6, h[1] - 6); g.stroke(); }
}

function drawProj(p) {
  const c = p.owner.ch;
  if (p.type === 'beam') {
    const d = Math.sign(p.vx), len = 170, g = ctx.createLinearGradient(p.x - d * len, 0, p.x + d * 30, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.6, c.main); g.addColorStop(1, '#fff');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x - d * len, p.y); ctx.lineTo(p.x, p.y - p.r); ctx.lineTo(p.x + d * 30, p.y); ctx.lineTo(p.x, p.y + p.r); ctx.fill();
    ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .45, 0, 7); ctx.fill(); return;
  }
  if (p.type === 'ice') {
    const d = Math.sign(p.vx); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(d, 1);
    ctx.fillStyle = '#bdefff'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-6, -11); ctx.lineTo(22, 0); ctx.lineTo(-6, 11); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-6, -11); ctx.lineTo(22, 0); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = 'rgba(160,230,255,.3)'; ctx.beginPath(); ctx.arc(-30, 0, 14, 0, 7); ctx.fill(); ctx.restore(); return;
  }
  if (p.type === 'fire') {
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 1.8); g.addColorStop(0, '#fff'); g.addColorStop(.3, c.accent); g.addColorStop(.7, c.main); g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.8, 0, 7); ctx.fill();
    for (let i = 1; i < 6; i++) { ctx.fillStyle = `rgba(255,150,40,${.4 - i * .06})`; ctx.beginPath(); ctx.arc(p.x - p.vx * i * 1.4, p.y + Math.sin(i + p.life) * 4, p.r - i * 2, 0, 7); ctx.fill(); }
  } else {
    const d = Math.sign(p.vx); ctx.fillStyle = '#d9c9a6'; ctx.beginPath(); ctx.moveTo(p.x - d * 26, GY); ctx.lineTo(p.x, GY - 52); ctx.lineTo(p.x + d * 10, GY); ctx.fill();
    ctx.fillStyle = c.accent; ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(p.x - d * 12, GY); ctx.lineTo(p.x + d * 2, GY - 34); ctx.lineTo(p.x + d * 8, GY); ctx.fill(); ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  const [a, b] = G.f;
  ctx.save();
  const bw = 380, bh = 26, y = 22;
  [[a, 30, 1], [b, W - 30 - bw, -1]].forEach(([f, x, d]) => {
    ctx.fillStyle = 'rgba(0,0,0,.65)'; skew(x - 4, y - 4, bw + 8, bh + 8); ctx.fill();
    const pc = f.hp / f.maxhp, ps = f.shown / f.maxhp;
    const fillBar = (frac, col) => { const w = bw * frac; ctx.fillStyle = col; if (d > 0) skew(x + bw - w, y, w, bh); else skew(x, y, w, bh); ctx.fill(); };
    fillBar(ps, '#ffe066');
    const gr = ctx.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, pc > .3 ? '#7cff6b' : '#ff7b6b'); gr.addColorStop(1, pc > .3 ? '#1fa83a' : '#b3261e'); fillBar(pc, gr);
    ctx.fillStyle = '#fff'; ctx.font = 'italic 900 20px Impact,sans-serif'; ctx.textAlign = d > 0 ? 'left' : 'right'; ctx.fillText(f.ch.name + (f.cpu ? (G.training ? ' (DUMMY)' : ' (CPU)') : ''), d > 0 ? x : x + bw, y + bh + 22);
    // meter
    const mw = 250, mx = d > 0 ? 30 : W - 30 - mw, my = H - 30;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(mx, my, mw, 12);
    const full = f.meter >= 100, mg = ctx.createLinearGradient(mx, 0, mx + mw, 0); mg.addColorStop(0, '#22d3ee'); mg.addColorStop(1, full ? '#fff' : '#ff2e88');
    ctx.fillStyle = mg; const fw = mw * f.meter / 100; ctx.fillRect(d > 0 ? mx : mx + mw - fw, my, fw, 12);
    ctx.strokeStyle = full ? '#fff' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, 12);
    ctx.font = 'bold 12px Verdana'; ctx.fillStyle = full ? '#fff' : '#cbb'; ctx.textAlign = d > 0 ? 'left' : 'right';
    ctx.fillText(full ? (Math.floor(G.pt / 15) % 2 ? 'SUPER READY!' : '') : 'SUPER', d > 0 ? mx : mx + mw, my - 5);
    // round pips
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(d > 0 ? x + bw - 14 - i * 24 : x + 14 + i * 24, y + bh + 20, 8, 0, 7); ctx.fillStyle = i < f.wins ? '#ffd43b' : 'rgba(255,255,255,.2)'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); }
  });
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.arc(W / 2, 42, 32, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = G.timer <= 10 ? '#ff6b6b' : '#fff'; ctx.font = '900 38px Impact,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(G.training ? '∞' : String(Math.max(0, G.timer)), W / 2, 55);
  if (ARC) { ctx.textAlign = 'center'; ctx.font = 'bold 15px Verdana'; ctx.fillStyle = '#ffd43b'; ctx.fillText(`STAGE ${ARC.idx + 1}/${ARC.ladder.length}   SCORE ${ARC.score}`, W / 2, 98); }
  if (G.training) { ctx.textAlign = 'center'; ctx.font = 'bold 15px Verdana'; ctx.fillStyle = '#7cf'; ctx.fillText('TRAINING – practice combos freely', W / 2, 98); }
  // combos
  [a, b].forEach(f => { if (f.combo >= 2 && f.comboT > 0) { ctx.save(); ctx.textAlign = f.side ? 'right' : 'left'; ctx.font = 'italic 900 44px Impact,sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; const tx = f.side ? W - 40 : 40, ty = 170; ctx.strokeText(f.combo + ' HITS', tx, ty); ctx.fillStyle = '#ffd43b'; ctx.fillText(f.combo + ' HITS', tx, ty); ctx.restore(); } });
  ctx.restore();
}
function skew(x, y, w, h) { const k = 10; ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + w + k, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
function banner(text, t, col = '#fff', size = 96) {
  const sc = t < 10 ? lerp(2.4, 1, t / 10) : 1, al = t < 6 ? t / 6 : 1;
  ctx.save(); ctx.translate(W / 2, H / 2 - 40); ctx.scale(sc, sc); ctx.globalAlpha = al; ctx.textAlign = 'center';
  ctx.font = `italic 900 ${size}px Impact,"Arial Black",sans-serif`; ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = '#1a0b2e'; ctx.strokeText(text, 0, 0);
  const gr = ctx.createLinearGradient(0, -size * .8, 0, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, col); ctx.fillStyle = gr; ctx.fillText(text, 0, 0); ctx.restore();
}
function drawVS() {
  const t = G.pt, k = Math.min(1, t / 16), e = 1 - Math.pow(1 - k, 3), out = t > 88 ? (t - 88) / 12 : 0;
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.fillStyle = 'rgba(6,4,18,.92)'; ctx.fillRect(0, 0, W, H);
  G.f.forEach((f, s) => {
    const c = f.ch; ctx.save();
    const gr = ctx.createLinearGradient(s ? W : 0, 0, W / 2, 0); gr.addColorStop(0, c.main + 'cc'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(s ? W / 2 : 0, 0, W / 2, H);
    drawFighter(ctx, f, s ? W - 210 + (1 - e) * 400 : 210 - (1 - e) * 400, 430, 1.8);
    const tx = s ? W - 40 + (1 - e) * 500 : 40 - (1 - e) * 500;
    ctx.font = 'italic 900 64px Impact,sans-serif'; ctx.textAlign = s ? 'right' : 'left'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#120a28';
    ctx.strokeText(c.name, tx, 70); ctx.fillStyle = '#fff'; ctx.fillText(c.name, tx, 70);
    ctx.font = 'bold 22px Verdana'; ctx.fillStyle = c.accent; ctx.fillText(c.title.toUpperCase(), tx, 102);
    ctx.restore();
  });
  ctx.font = 'italic 900 120px Impact,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = '#120a28';
  ctx.strokeText('VS', W / 2, 300); ctx.fillStyle = '#ffd43b'; ctx.fillText('VS', W / 2, 300);
  ctx.restore();
}
function render() {
  if (!G) { ctx.fillStyle = '#0a0816'; ctx.fillRect(0, 0, W, H); const t = performance.now() / 1000; const gx = stageImg(((t / 8) | 0) % 3); ctx.drawImage(gx, 0, 0); return; }
  ctx.save();
  if (G.shake > .5) ctx.translate(rnd(-1, 1) * G.shake, rnd(-1, 1) * G.shake);
  ctx.drawImage(stageImg(G.stage), 0, 0);
  G.bgp.forEach(p => { if (G.stage === 2) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(p.x, p.y, p.r, p.r); } else if (G.stage === 1) { ctx.fillStyle = `rgba(255,${150 + p.r * 30 | 0},60,${.4 + Math.sin(p.ph) * .3})`; ctx.fillRect(p.x, p.y, p.r, p.r); } });
  const [a, b] = G.f, order = (a.act && !b.act) ? [b, a] : [a, b];
  order.forEach(f => drawFighter(ctx, f, f.x, f.y));
  G.proj.forEach(drawProj);
  G.parts.forEach(p => {
    if (p.t === 'p') { ctx.globalAlpha = clamp(p.life / 16, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.r, p.r); ctx.globalAlpha = 1; }
    else { ctx.globalAlpha = p.life / p.max; ctx.strokeStyle = p.col; ctx.lineWidth = 5 * p.life / p.max + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  });
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash / 60})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  drawHUD();
  if (G.phase === 'vs') drawVS();
  if (G.phase === 'intro') { if (G.pt < 60) banner(`ROUND ${G.round}`, G.pt, '#ffd43b'); else if (G.pt < 110) banner('FIGHT!', G.pt - 60, '#ff5a3c', 120); }
  if (G.phase === 'ko' || G.phase === 'end') {
    if (G.pt < 80) banner(G.koText, G.pt, '#ff3b3b', 130);
    else if (G.phase === 'ko') {
      banner(G.winner ? `${G.winner.ch.name} WINS` : 'DRAW', G.pt - 80, '#ffd43b', 70);
      if (G.perfect) { ctx.save(); ctx.textAlign = 'center'; ctx.font = 'italic 900 42px Impact,sans-serif'; ctx.fillStyle = '#7cf'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText('PERFECT!', W / 2, H / 2 + 40); ctx.fillText('PERFECT!', W / 2, H / 2 + 40); ctx.restore(); }
    }
  }
  if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- LOOP ---------------- */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  pollPads();
  if (state === 'fight' && G && !G.paused && G.phase !== 'end' && portraitTouch()) { held.clear(); togglePause(); } // auto-pause if rotated to portrait
  while (acc >= 1000 / 60) { if (state === 'fight') update(); else if (G && state !== 'fight') { /* idle */ } acc -= 1000 / 60; }
  render(); requestAnimationFrame(frame);
}

/* ---------------- UI ---------------- */
function show(id) { document.querySelectorAll('.screen').forEach(e => e.classList.add('hidden')); if (id) $(id).classList.remove('hidden'); document.body.classList.toggle('infight', !id); }
function fit() { document.documentElement.style.setProperty('--u', ($('wrap').clientWidth / 100) + 'px'); }
addEventListener('resize', fit); fit();

const cardsEl = $('cards');
CHARS.forEach((c, i) => {
  const el = document.createElement('div'); el.className = 'card'; el.dataset.i = i;
  const pc = document.createElement('canvas'); pc.width = 240; pc.height = 270;
  const pf = mkFighter(c, 0, false); pf.anim = 10; const pg = pc.getContext('2d');
  pg.translate(0, 0);
  const stat = n => `<div class="bar"><i style="width:${n * 20}%"></i></div>`;
  el.innerHTML = `<span class="badge"></span>`; el.appendChild(pc);
  el.insertAdjacentHTML('beforeend', `<div class="nm">${c.name}</div><div class="tt">${c.title}</div><div class="st"><span>PWR</span>${stat(c.stats[0])}<span>SPD</span>${stat(c.stats[1])}<span>DEF</span>${stat(c.stats[2])}</div><div class="sp">★ ${c.spName}</div>`);
  const gr = pg.createRadialGradient(120, 190, 10, 120, 190, 130); gr.addColorStop(0, c.main + '88'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  pg.fillStyle = gr; pg.fillRect(0, 0, 240, 270);
  drawFighter(pg, pf, 112, 245, 1.2 / c.scale * .96);
  el.addEventListener('click', () => pick(i)); cardsEl.appendChild(el);
});
function refreshSel() {
  const lbl = mode === 2 ? ['P1', 'P2'] : mode === 4 ? ['YOU', 'DUMMY'] : ['YOU', 'CPU'];
  document.querySelectorAll('.card').forEach(el => {
    const i = +el.dataset.i, bd = el.querySelector('.badge'), p0 = sel[0] === CHARS[i], p1 = mode !== 3 && sel[1] === CHARS[i];
    bd.className = 'badge' + (p0 && p1 ? ' pb' : p0 ? ' p0' : p1 ? ' p1' : ''); bd.textContent = p0 && p1 ? `${lbl[0]} + ${lbl[1]}` : p0 ? lbl[0] : p1 ? lbl[1] : '';
  });
  $('selTitle').textContent = !sel[0] || turn === 0 ? (mode !== 2 ? 'CHOOSE YOUR FIGHTER' : 'PLAYER 1: CHOOSE') : (mode !== 2 ? 'CHOOSE YOUR OPPONENT' : 'PLAYER 2: CHOOSE');
  $('bfight').disabled = !(sel[0] && sel[1]);
  document.querySelectorAll('[data-stage]').forEach(b => b.classList.toggle('on', +b.dataset.stage === stageSel));
  document.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('on', +b.dataset.diff === diff));
  $('diffRow').style.display = (mode === 1 || mode === 3) ? '' : 'none';
}
function pick(i) {
  SFX.ui(); ac();
  if (mode === 3) { sel = [CHARS[i], CHARS[i]]; turn = 0; } else { sel[turn] = CHARS[i]; turn = turn ? 0 : 1; }
  refreshSel();
}
function openSelect(m) { mode = m; ARC = null; sel = [null, null]; turn = 0; show('select'); refreshSel(); }
function startArcade() {
  const rest = CHARS.filter(c => c !== sel[0]).sort(() => Math.random() - .5);
  ARC = { ladder: rest, idx: 0, score: 0, done: false, next: false }; sel[1] = rest[0];
}
function rematch() {
  if (ARC) {
    if (ARC.done) startArcade();
    else { if (ARC.next) { ARC.idx++; ARC.next = false; } else ARC.score = Math.max(0, ARC.score - 1000); sel[1] = ARC.ladder[ARC.idx]; }
  }
  beginFight();
}
function showBest() { const b = bestScore(); $('best').textContent = b ? `BEST ARCADE SCORE: ${b}` : ''; }
$('barc').onclick = () => { ac(); SFX.ui(); openSelect(3); };
$('b1p').onclick = () => { ac(); SFX.ui(); openSelect(1); };
$('b2p').onclick = () => { ac(); SFX.ui(); openSelect(2); };
$('btr').onclick = () => { ac(); SFX.ui(); openSelect(4); };
$('bhow').onclick = () => { SFX.ui(); show('howto'); };
$('bhowback').onclick = () => show('title');
$('bback').onclick = () => show('title');
$('brand').onclick = () => { SFX.ui(); sel = [CHARS[Math.random() * CHARS.length | 0], CHARS[Math.random() * CHARS.length | 0]]; turn = 0; refreshSel(); };
document.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { stageSel = +b.dataset.stage; SFX.ui(); refreshSel(); });
document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { diff = +b.dataset.diff; SFX.ui(); refreshSel(); });
function portraitTouch() { return document.body.classList.contains('coarse') && innerHeight > innerWidth; }
function inFullscreen() { return document.fullscreenElement || document.webkitFullscreenElement; }
function goFullscreen() {
  if (inFullscreen()) return;
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rq) return; // e.g. iPhone Safari: not supported, the page already fills the screen
  try {
    const p = rq.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  } catch (e) {}
}
function beginFight() {
  if (portraitTouch()) return; // game only starts in landscape on phones/tablets
  goFullscreen();
  show(null); state = 'fight'; startMatch(); startMusic();
  $('touch').classList.toggle('active', mode === 1 || true);
}
$('bfight').onclick = () => { SFX.ui(); if (mode === 3) startArcade(); beginFight(); };
$('brematch').onclick = () => { SFX.ui(); rematch(); };
$('bchange').onclick = () => { SFX.ui(); state = 'menu'; G = null; openSelect(mode); };
$('bmenu').onclick = () => { SFX.ui(); state = 'menu'; G = null; mode = 1; ARC = null; showBest(); show('title'); $('touch').classList.remove('active'); };
function togglePause() {
  if (!G || G.phase === 'end') return; G.paused = !G.paused;
  $('pausescr').classList.toggle('hidden', !G.paused); if (G.paused) { stopMusic(); } else startMusic();
}
$('bresume').onclick = togglePause;
$('pausebtn').onclick = () => { if (state === 'fight') togglePause(); };
$('bquit').onclick = () => { $('pausescr').classList.add('hidden'); state = 'menu'; G = null; ARC = null; stopMusic(); showBest(); show('title'); $('touch').classList.remove('active'); };
$('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; if (muted) stopMusic(); else if (state === 'fight') startMusic(); };
$('fsbtn').onclick = () => { if (inFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else goFullscreen(); };
['fullscreenchange', 'webkitfullscreenchange', 'orientationchange'].forEach(ev => addEventListener(ev, () => { fit(); setTimeout(fit, 250); }));
if (window.visualViewport) visualViewport.addEventListener('resize', fit);
['gesturestart', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));

refreshSel(); showBest();
requestAnimationFrame(frame);
window.__SA = { get G() { return G; }, CHARS, setSel(a, b, m) { sel = [CHARS[a], CHARS[b]]; mode = m || 1; beginFight(); } };
})();
