/* Racism 2 — Super Slot Racing. © Pippo Poppi Games. MIT License. */
(function (root) {
'use strict';
const W = 400, H = 720;
const LANES = 4, LANE_W = 26;
const TRACK_HALF = LANES * LANE_W / 2 + 12;
const STEP = 3;
const GAME_URL = 'https://pippopoppi.github.io/racism2/';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function wrapAng(d) { while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function angLerp(a, b, t) { return a + wrapAng(b - a) * t; }
function rng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '--:--.---';
  const ms = Math.round(sec * 1000);
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, h = Math.floor(ms % 1000);
  return (m ? m + ':' : '') + String(s).padStart(m ? 2 : 1, '0') + '.' + String(h).padStart(3, '0');
}

/* ---------------- geometry ---------------- */
function catmullClosed(pts, segs) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < segs; j++) {
      const t = j / segs, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      });
    }
  }
  return out;
}
function resampleClosed(poly, step) {
  const out = [], n = poly.length;
  let prev = { x: poly[0].x, y: poly[0].y }, acc = 0;
  out.push({ x: prev.x, y: prev.y });
  for (let i = 1; i <= n; i++) {
    const p = poly[i % n];
    let dx = p.x - prev.x, dy = p.y - prev.y, d = Math.hypot(dx, dy);
    while (d > 0 && acc + d >= step) {
      const t = (step - acc) / d;
      const nx = prev.x + dx * t, ny = prev.y + dy * t;
      out.push({ x: nx, y: ny });
      prev = { x: nx, y: ny }; dx = p.x - nx; dy = p.y - ny; d = Math.hypot(dx, dy); acc = 0;
    }
    acc += d; prev = { x: p.x, y: p.y };
  }
  const l = out[out.length - 1];
  if (out.length > 1 && Math.hypot(l.x - out[0].x, l.y - out[0].y) < step * 0.6) out.pop();
  return out;
}
function buildLane(pts) {
  const n = pts.length;
  const x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n + 1), h = new Float64Array(n), k = new Float64Array(n);
  for (let i = 0; i < n; i++) { x[i] = pts[i].x; y[i] = pts[i].y; }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; s[i + 1] = s[i] + Math.hypot(x[j] - x[i], y[j] - y[i]); }
  const len = s[n];
  for (let i = 0; i < n; i++) { const a = (i - 1 + n) % n, b = (i + 1) % n; h[i] = Math.atan2(y[b] - y[a], x[b] - x[a]); }
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    const ds = Math.hypot(x[i] - x[a], y[i] - y[a]) + Math.hypot(x[b] - x[i], y[b] - y[i]);
    raw[i] = wrapAng(h[b] - h[a]) / Math.max(1e-6, ds);
  }
  const WIN = 6;
  for (let i = 0; i < n; i++) { let acc = 0; for (let w = -WIN; w <= WIN; w++) acc += raw[(i + w + n) % n]; k[i] = acc / (2 * WIN + 1); }
  const lane = {
    n, x, y, s, h, k, len,
    norm(sp) { sp = sp % len; if (sp < 0) sp += len; return sp; },
    idx(sp) { // largest i with s[i] <= sp
      sp = this.norm(sp); let lo = 0, hi = n;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= sp) lo = m; else hi = m; }
      const seg = s[lo + 1] - s[lo];
      return { i: lo, t: seg > 0 ? (sp - s[lo]) / seg : 0 };
    },
    at(sp) {
      const { i, t } = this.idx(sp); const j = (i + 1) % n;
      return { x: lerp(x[i], x[j], t), y: lerp(y[i], y[j], t), h: angLerp(h[i], h[j], t), k: lerp(k[i], k[j], t) };
    },
    kappaAt(sp) { const { i, t } = this.idx(sp); return lerp(k[i], k[(i + 1) % n], t); }
  };
  return lane;
}
function buildTrack(def) {
  const center = resampleClosed(catmullClosed(def.pts, 32), STEP);
  const n = center.length;
  const nx = new Float64Array(n), ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = center[(i - 1 + n) % n], b = center[(i + 1) % n];
    const hh = Math.atan2(b.y - a.y, b.x - a.x);
    nx[i] = -Math.sin(hh); ny[i] = Math.cos(hh);
  }
  const lanes = [];
  for (let L = 0; L < LANES; L++) {
    const off = (L - (LANES - 1) / 2) * LANE_W;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: center[i].x + nx[i] * off, y: center[i].y + ny[i] * off });
    lanes.push(buildLane(pts));
  }
  const cl = buildLane(center);
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const p of center) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
  const M = 300;
  return {
    def, center: cl, lanes, nx, ny,
    bounds: { x: minx - M, y: miny - M, w: maxx - minx + 2 * M, h: maxy - miny + 2 * M },
    minRadius() { let mk = 0; for (let i = 0; i < cl.n; i++) mk = Math.max(mk, Math.abs(cl.k[i])); return 1 / mk; },
    distToTrack(px, py) {
      let best = 1e18;
      for (let i = 0; i < cl.n; i += 3) { const dx = cl.x[i] - px, dy = cl.y[i] - py; const d = dx * dx + dy * dy; if (d < best) best = d; }
      return Math.sqrt(best);
    }
  };
}

/* ---------------- circuits ---------------- */
const THEMES = {
  verde: { name: 'Autodromo', ground: '#3e8d39', ground2: '#377f33', asphalt: '#4b4b53', asphalt2: '#55555e', edge: '#f4f4f4', kerb: ['#d8312f', '#f6f6f6'], slot: 'rgba(0,0,0,0.5)', decor: 'trees', grip: 1.0, bg: '#2f6d2c' },
  costa: { name: 'Riviera', ground: '#e6cf93', ground2: '#dcc27f', asphalt: '#50505a', asphalt2: '#5c5c66', edge: '#ffffff', kerb: ['#e23c3c', '#ffffff'], slot: 'rgba(0,0,0,0.5)', decor: 'palms', grip: 1.0, bg: '#2a7fc9', sea: true },
  notte: { name: 'Night City', ground: '#141629', ground2: '#1a1d33', asphalt: '#2a2c3d', asphalt2: '#33354a', edge: '#8ef1ff', kerb: ['#ff3fa4', '#35f0ff'], slot: 'rgba(0,0,0,0.65)', decor: 'city', grip: 0.97, bg: '#0a0b16', night: true, glow: true },
  neve: { name: 'Alpine', ground: '#edf4fb', ground2: '#e2ebf5', asphalt: '#3a3e4a', asphalt2: '#454a58', edge: '#ffffff', kerb: ['#1f62c2', '#ffffff'], slot: 'rgba(0,0,0,0.55)', decor: 'pines', grip: 0.9, bg: '#c7d8ea' },
  rosso: { name: 'Red Desert', ground: '#c4582f', ground2: '#b94f2a', asphalt: '#3b3238', asphalt2: '#463a41', edge: '#ffe7b3', kerb: ['#ffd23f', '#2b2b2b'], slot: 'rgba(0,0,0,0.5)', decor: 'rocks', grip: 1.0, bg: '#8a3a1f' }
};
const TRACKS = [
  { id: 'anello', name: 'Anello Veloce', theme: 'rosso', stars: 1, desc: 'Ovale a tutto gas. Perfetto per imparare.', seed: 11,
    pts: [{ x: 450, y: 1500 }, { x: 1100, y: 1650 }, { x: 1750, y: 1500 }, { x: 2000, y: 1050 }, { x: 1750, y: 600 }, { x: 1100, y: 450 }, { x: 450, y: 600 }, { x: 200, y: 1050 }] },
  { id: 'autodromo', name: 'Autodromo Verde', theme: 'verde', stars: 2, desc: 'Rettilineo lungo, chicane e curvone finale.', seed: 23,
    pts: [{ x: 300, y: 1750 }, { x: 1200, y: 1800 }, { x: 1900, y: 1700 }, { x: 2050, y: 1350 }, { x: 1750, y: 1150 }, { x: 1400, y: 1250 }, { x: 1150, y: 1000 }, { x: 1400, y: 700 }, { x: 1900, y: 650 }, { x: 2000, y: 300 }, { x: 1500, y: 150 }, { x: 900, y: 250 }, { x: 550, y: 500 }, { x: 700, y: 850 }, { x: 400, y: 1150 }, { x: 150, y: 1450 }] },
  { id: 'riviera', name: 'Riviera Sprint', theme: 'costa', stars: 3, desc: 'Curve sul mare e un tornante stretto.', seed: 37,
    pts: [{ x: 300, y: 1550 }, { x: 1200, y: 1600 }, { x: 2000, y: 1500 }, { x: 2150, y: 1200 }, { x: 1950, y: 950 }, { x: 2000, y: 650 }, { x: 1650, y: 280 }, { x: 1250, y: 380 }, { x: 1300, y: 780 }, { x: 950, y: 1000 }, { x: 700, y: 750 }, { x: 550, y: 350 }, { x: 200, y: 450 }, { x: 100, y: 900 }, { x: 120, y: 1300 }] },
  { id: 'notturno', name: 'Notturno Neon', theme: 'notte', stars: 4, desc: 'Cittadino di notte: curve a 90° e muri vicini.', seed: 51,
    pts: [{ x: 450, y: 1850 }, { x: 1300, y: 1900 }, { x: 2050, y: 1850 }, { x: 2150, y: 1450 }, { x: 1800, y: 1300 }, { x: 1450, y: 1350 }, { x: 1350, y: 1000 }, { x: 1700, y: 850 }, { x: 2100, y: 700 }, { x: 2050, y: 250 }, { x: 1500, y: 150 }, { x: 950, y: 250 }, { x: 850, y: 650 }, { x: 550, y: 800 }, { x: 150, y: 1050 }, { x: 130, y: 1400 }, { x: 220, y: 1680 }] },
  { id: 'alpi', name: 'Tornanti Alpini', theme: 'neve', stars: 5, desc: 'Montagna gelata, tornanti e poco grip. Per piloti veri.', seed: 73,
    pts: [{ x: 250, y: 1950 }, { x: 1200, y: 2000 }, { x: 2000, y: 1900 }, { x: 2100, y: 1550 }, { x: 1700, y: 1450 }, { x: 1150, y: 1550 }, { x: 850, y: 1350 }, { x: 1050, y: 1100 }, { x: 1650, y: 1150 }, { x: 2100, y: 1000 }, { x: 2000, y: 600 }, { x: 1500, y: 550 }, { x: 1050, y: 700 }, { x: 750, y: 420 }, { x: 650, y: 100 }, { x: 220, y: 160 }, { x: 100, y: 550 }, { x: 400, y: 900 }, { x: 150, y: 1300 }, { x: 100, y: 1650 }] }
];

/* ---------------- physics ---------------- */
const BASE = {
  VMAX: 820, ACC: 760, BRAKE: 720, COAST: 720, DRAG: 0.00008,
  GRIP: 2400, SLIP_GAIN: 2.4, SLIP_RECOVER: 1.6, SCRUB: 0.12,
  TURBO_T: 1.6, TURBO_V: 1.22, TURBO_A: 1.9, TURBO_CHARGES: 3,
  DERAIL_T: 1.7, LOOK: 520, K: 1
};
const P = Object.assign({}, BASE);
// Speed multiplier K: speeds scale by K, accelerations and grip by K^2, so the same corners
// need the same lift points but everything happens K times faster (lap times divide by K).
function applySpeed(K) {
  K = clamp(K || 1, 1, 4);
  P.K = K; P.VMAX = BASE.VMAX * K; P.ACC = BASE.ACC * K * K; P.BRAKE = BASE.BRAKE * K * K; P.COAST = BASE.COAST * K * K;
  P.GRIP = BASE.GRIP * K * K; P.SLIP_GAIN = BASE.SLIP_GAIN * K; P.SLIP_RECOVER = BASE.SLIP_RECOVER * K;
  P.TURBO_T = BASE.TURBO_T / K; P.DERAIL_T = BASE.DERAIL_T / Math.sqrt(K);
}
const CAR_COLORS = ['#ff2d2d', '#2d8cff', '#ffd600', '#36d399', '#c45cff', '#ff8a00'];
const AI_NAMES = ['Gigi Turbo', 'Peppe Frizione', 'Lollo Sgommata', 'Vale Scintilla', 'Tony Tornante'];

function allowedSpeed(lane, s, grip) {
  const kk = Math.abs(lane.kappaAt(s));
  return kk < 1e-6 ? 9999 : Math.sqrt(grip / kk);
}
function targetSpeed(lane, s, grip, look, brakeFactor) {
  let best = allowedSpeed(lane, s, grip);
  const brake = P.BRAKE * (brakeFactor || 0.9);
  for (let d = 10; d <= look; d += 10) {
    const va = allowedSpeed(lane, s + d, grip);
    const vn = Math.sqrt(va * va + 2 * brake * d);
    if (vn < best) best = vn;
  }
  return best;
}
function makeCar(opts) {
  return Object.assign({
    name: 'Pilota', color: '#ff2d2d', laneIdx: 0, lane: null, player: false, skill: 0.95,
    s: 0, v: 0, slip: 0, excess: 0, throttle: 0, brake: 0,
    turboT: 0, turbo: P.TURBO_CHARGES, gear: 1, rpm: 0.2,
    lap: 0, lapStart: 0, lastLap: null, bestLap: null, laps: [],
    derail: 0, derails: 0, dx: 0, dy: 0, dvx: 0, dvy: 0, dspin: 0, spin: 0,
    finished: false, finishTime: null, finishPos: 0, pos: 1,
    aiTimer: 0, aiNoise: 0, visYaw: 0, visOff: 0, wasTurbo: false,
    rl: null, rr: null, boostLightsT: 0
  }, opts);
}
function derailCar(car, race) {
  const p = car.lane.at(car.s);
  const sgn = Math.sign(p.k) || 1;
  const outward = -sgn;
  const nxv = -Math.sin(p.h), nyv = Math.cos(p.h);
  car.derail = P.DERAIL_T;
  car.derails++;
  car.dx = 0; car.dy = 0;
  car.dvx = Math.cos(p.h) * car.v * 0.55 + nxv * outward * car.v * 0.5;
  car.dvy = Math.sin(p.h) * car.v * 0.55 + nyv * outward * car.v * 0.5;
  car.dspin = sgn * (7 + Math.random() * 4);
  car.spin = 0;
  car.v = 0; car.slip = 0; car.turboT = 0;
  race.events.push({ type: 'derail', car });
}
function stepCar(car, dt, race) {
  const lane = car.lane;
  if (car.derail > 0) {
    car.derail -= dt;
    car.dx += car.dvx * dt; car.dy += car.dvy * dt;
    const f = Math.pow(0.08, dt);
    car.dvx *= f; car.dvy *= f; car.dspin *= Math.pow(0.2, dt);
    car.spin += car.dspin * dt;
    if (car.derail <= 0) { car.derail = 0; car.dx = car.dy = 0; car.spin = 0; race.events.push({ type: 'recover', car }); }
    return;
  }
  if (car.finished) { car.throttle = 0; car.brake = 0; }
  const turbo = car.turboT > 0;
  if (turbo) car.turboT -= dt;
  const vmax = P.VMAX * (turbo ? P.TURBO_V : 1);
  let a = 0;
  if (car.brake) a -= P.BRAKE;
  else if (car.throttle) a += P.ACC * (turbo ? P.TURBO_A : 1) * Math.max(0.12, 1 - car.v / vmax);
  else a -= P.COAST;
  a -= P.DRAG * car.v * car.v;
  car.v = Math.max(0, car.v + a * dt);
  const kk = lane.kappaAt(car.s);
  const lat = car.v * car.v * Math.abs(kk);
  const excess = lat / race.grip - 1;
  car.excess = excess;
  if (excess > 0) {
    car.slip = Math.min(1.3, car.slip + excess * (1 + excess) * P.SLIP_GAIN * dt);
    car.v = Math.max(0, car.v - excess * race.grip * P.SCRUB * dt);
  } else car.slip = Math.max(0, car.slip - P.SLIP_RECOVER * dt);
  if (car.slip >= 1) { derailCar(car, race); return; }
  const prevS = car.s;
  car.s += car.v * dt;
  if (car.s >= lane.len) {
    car.s -= lane.len;
    if (!car.finished) {
      if (car.lap > 0) {
        const t = race.t - car.lapStart;
        car.lastLap = t; car.laps.push(t);
        if (car.bestLap == null || t < car.bestLap) car.bestLap = t;
        race.events.push({ type: 'lap', car, time: t });
      }
      car.lapStart = race.t;
      car.lap++;
      if (car.lap > race.laps) {
        car.finished = true; car.finishTime = race.t;
        car.finishPos = ++race.finishedCount;
        race.events.push({ type: 'finish', car });
      }
    }
  }
  // gearbox (for sound + HUD)
  const tops = [0.17, 0.31, 0.47, 0.64, 0.82, 1.0];
  const vr = car.v / P.VMAX;
  let g = car.gear;
  if (vr > tops[g - 1] * 0.995 && g < 6) { g++; race.events.push({ type: 'shift', car }); }
  else if (g > 1 && vr < tops[g - 2] * 0.78) g--;
  car.gear = g;
  const lo = g > 1 ? tops[g - 2] * 0.78 : 0;
  const rpmT = clamp((vr - lo) / Math.max(0.05, tops[g - 1] - lo), 0, 1);
  const idle = 0.12;
  car.rpm += (clamp(idle + rpmT * (1 - idle) * (car.throttle ? 1 : 0.9), 0, 1.05) - car.rpm) * Math.min(1, dt * 14);
  // visual slide
  const sgn = Math.sign(kk) || 0;
  car.visOff += ((-sgn) * car.slip * 13 - car.visOff) * Math.min(1, dt * 8);
  car.visYaw += ((sgn) * car.slip * 0.5 - car.visYaw) * Math.min(1, dt * 8);
  car.sliding = excess > 0 && car.v > 60;
}
function aiControl(car, dt, race) {
  if (car.derail > 0 || car.finished) return;
  car.aiTimer -= dt;
  if (car.aiTimer <= 0) { car.aiTimer = 0.25 + Math.random() * 0.3; car.aiNoise = (Math.random() - 0.5) * 0.06; }
  // rubber band: a bit faster when behind the player, slower when far ahead
  let skill = car.skill + car.aiNoise;
  let lead = null;
  for (const h of race.players) if (!h.finished && (!lead || progress(h) > progress(lead))) lead = h;
  if (lead) {
    const gap = progress(car) - progress(lead);
    skill += clamp(-gap * 0.45, -0.05, 0.05);
  }
  const sk = clamp(skill, 0.8, 1.03);
  const grip = race.grip * (1.10 + (race.track.def.stars - 1) * 0.03) * sk * sk;
  const tgt = targetSpeed(car.lane, car.s, grip, P.LOOK, 0.86);
  car.throttle = car.v < tgt - 8 ? 1 : 0;
  car.brake = 0;
  if (car.turbo > 0 && car.turboT <= 0 && car.v > P.VMAX * 0.75 && tgt > P.VMAX * 1.1 && Math.random() < dt * 0.6) useTurbo(car, race);
}
function useTurbo(car, race) {
  if (car.turbo <= 0 || car.turboT > 0 || car.derail > 0 || car.finished) return false;
  car.turbo--; car.turboT = P.TURBO_T;
  race.events.push({ type: 'turbo', car });
  return true;
}
function progress(car) { return (car.lap - 1) + car.s / car.lane.len; }

function newRace(trackDef, laps, nPlayers, withAI) {
  const track = buildTrack(trackDef);
  const theme = THEMES[trackDef.theme];
  const race = {
    track, theme, laps, t: 0, state: 'countdown', countdown: 4.2, grip: P.GRIP * theme.grip,
    cars: [], events: [], finishedCount: 0, player: null, players: [], finishedAt: null, shake: 0
  };
  const humans = Math.max(1, Math.min(MAX_PLAYERS, nPlayers || 1));
  const humanLanes = [[1], [1, 2], [0, 1, 2], [0, 1, 2, 3]][humans - 1];
  const skills = [0.985, 0.955, 0.93];
  const names = AI_NAMES.slice().sort(() => Math.random() - 0.5);
  let ai = 0;
  const useAI = withAI !== false || humans === 1;
  for (const L of [0, 1, 2, 3]) {
    const pi = humanLanes.indexOf(L), isP = pi >= 0;
    if (!isP && !useAI) continue;
    const car = makeCar({
      player: isP, pidx: pi, laneIdx: L, lane: track.lanes[L],
      name: isP ? (humans === 1 ? 'TU' : 'P' + (pi + 1)) : names[ai],
      color: isP ? CAR_COLORS[pi] : CAR_COLORS[(humans + ai) % CAR_COLORS.length],
      skill: isP ? 1 : skills[ai]
    });
    if (!isP) ai++; else race.players.push(car);
    race.cars.push(car);
  }
  race.player = race.players[0];
  // grid order: player 2nd row, AI in front/behind for fairness
  race.cars.forEach((c, i) => { c.s = c.lane.norm(-50 - i * 10); c.lapStart = 0; });
  return race;
}
function stepRace(race, dt) {
  race.events.length = 0;
  if (race.state === 'countdown') {
    race.countdown -= dt;
    if (race.countdown <= 0) { race.state = 'race'; race.t = 0; race.events.push({ type: 'go' }); for (const c of race.cars) c.lapStart = 0; }
    return;
  }
  race.t += dt;
  for (const c of race.cars) { if (!c.player) aiControl(c, dt, race); stepCar(c, dt, race); }
  // positions
  const order = race.cars.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishPos - b.finishPos;
    if (a.finished) return -1; if (b.finished) return 1;
    return progress(b) - progress(a);
  });
  order.forEach((c, i) => c.pos = i + 1);
  const done = race.players.filter(h => h.finished);
  if (done.length && race.finishedAt == null) race.finishedAt = race.t;
  const allHumans = done.length === race.players.length;
  if (race.finishedAt != null && (allHumans || race.finishedCount === race.cars.length || race.t - race.finishedAt > 8)) {
    if (race.state === 'race') { race.state = 'finished'; race.events.push({ type: 'end' }); }
  }
}

/* ---------------- rendering: world ---------------- */
function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function tracePoly(g, xs, ys, n, from, to) {
  g.beginPath();
  for (let i = from; i <= to; i++) { const j = ((i % n) + n) % n; if (i === from) g.moveTo(xs[j], ys[j]); else g.lineTo(xs[j], ys[j]); }
}
function offsetPts(track, off) {
  const c = track.center, n = c.n, xs = new Float64Array(n), ys = new Float64Array(n);
  for (let i = 0; i < n; i++) { xs[i] = c.x[i] + track.nx[i] * off; ys[i] = c.y[i] + track.ny[i] * off; }
  return { xs, ys, n };
}
function runs(track, pred, pad) { // contiguous index ranges where pred(i) holds (padded)
  const n = track.center.n, out = []; let start = -1;
  for (let i = 0; i < n; i++) {
    const ok = pred(i);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) { out.push([start - pad, i - 1 + pad]); start = -1; }
  }
  if (start >= 0) out.push([start - pad, n - 1 + pad]);
  return out;
}
const SHOULDER = { verde: 'rgba(205,195,160,0.6)', costa: 'rgba(255,255,255,0.35)', notte: 'rgba(90,95,130,0.5)', neve: 'rgba(255,255,255,0.7)', rosso: 'rgba(60,30,20,0.45)' };
const BOARDS = ['PIPPO POPPI GAMES', 'COCCODRILLO vs PICCIONE', 'STEEL COMMAND', 'VOID VANGUARD', 'CROWD CANNON', 'GRU GRU ENERGY'];

function buildWorld(track, theme, seed, z, dpr) {
  // z = screen zoom the world will be shown at (world px -> CSS px); the canvas is built at exactly z*dpr so nothing gets resampled.
  z = z || 1; dpr = dpr || 1;
  const S = z * dpr, cs = 1 / z, low = z < 0.5; // cs: world units per CSS pixel
  const B = track.bounds, c = track.center, n = c.n;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(B.w * S); cv.height = Math.ceil(B.h * S);
  const g = cv.getContext('2d');
  g.scale(S, S); g.translate(-B.x, -B.y);
  const R = rng(seed);
  g.fillStyle = theme.ground; g.fillRect(B.x, B.y, B.w, B.h);
  g.fillStyle = theme.ground2;
  const nb = low ? 260 : 1100, bs = low ? 2.2 : 1;
  for (let i = 0; i < nb; i++) {
    const x = B.x + R() * B.w, y = B.y + R() * B.h, r = (8 + R() * 44) * bs;
    g.beginPath(); g.ellipse(x, y, r, r * 0.55, R() * 3, 0, TAU); g.fill();
  }
  let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += c.x[i]; cy += c.y[i]; } cx /= n; cy /= n;
  const outerSign = i => { const dx = cx - c.x[i], dy = cy - c.y[i]; return (dx * track.nx[i] + dy * track.ny[i]) > 0 ? -1 : 1; };

  if (theme.sea) {
    const top = B.y + B.h - 230;
    const gr = g.createLinearGradient(0, top, 0, B.y + B.h);
    gr.addColorStop(0, '#5fc3e8'); gr.addColorStop(1, '#1f6fb5');
    g.fillStyle = gr; g.fillRect(B.x, top, B.w, 230);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2 * Math.max(1, cs * 0.6);
    for (let k = 0; k < 40; k++) { const y = top + 20 + R() * 190, x = B.x + R() * B.w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20 * bs, y - 6 * bs, x + 44 * bs, y); g.stroke(); }
    g.fillStyle = '#f7e7b5'; g.fillRect(B.x, top - 26, B.w, 26);
  }
  const free = (x, y, d) => track.distToTrack(x, y) > TRACK_HALF + d && (!theme.sea || y < B.y + B.h - 260);
  const ds = low ? 2.4 : 1; // decoration size factor
  if (theme.decor === 'city') {
    for (let i = 0; i < 260; i++) {
      const x = B.x + R() * B.w, y = B.y + R() * B.h, w = 60 + R() * 110, h = 60 + R() * 110;
      if (!free(x, y, 70) || !free(x + w, y + h, 70) || !free(x + w, y, 70) || !free(x, y + h, 70)) continue;
      g.fillStyle = ['#22243a', '#2b2e4a', '#1c1e30'][Math.floor(R() * 3)]; g.fillRect(x, y, w, h);
      g.fillStyle = '#34375a'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      const step = low ? 22 : 12, ws = low ? 9 : 5;
      for (let wx = x + 10; wx < x + w - 8; wx += step) for (let wy = y + 10; wy < y + h - 8; wy += step) {
        if (R() < 0.55) { g.fillStyle = R() < 0.3 ? '#ffd27a' : '#8be9ff'; g.fillRect(wx, wy, ws, ws * 1.2); }
      }
    }
  } else {
    const nd = low ? 170 : 720;
    for (let i = 0; i < nd; i++) {
      const x = B.x + R() * B.w, y = B.y + R() * B.h;
      if (!free(x, y, 58 * (low ? 1.3 : 1))) continue;
      if (theme.decor === 'trees') {
        const r = (14 + R() * 18) * ds;
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 6 * ds, y + 7 * ds, r, 0, TAU); g.fill();
        g.fillStyle = ['#2f7a2a', '#3c8f33', '#2a6f27', '#4a9a3a'][Math.floor(R() * 4)]; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, TAU); g.fill();
      } else if (theme.decor === 'palms') {
        if (R() < 0.35) {
          g.fillStyle = ['#ff5e5e', '#ffd84d', '#4dc3ff', '#ffffff'][Math.floor(R() * 4)]; g.beginPath(); g.arc(x, y, 11 * ds, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2 * ds; g.beginPath(); g.moveTo(x - 11 * ds, y); g.lineTo(x + 11 * ds, y); g.moveTo(x, y - 11 * ds); g.lineTo(x, y + 11 * ds); g.stroke();
        } else {
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 8 * ds, y + 8 * ds, 16 * ds, 0, TAU); g.fill();
          g.strokeStyle = '#2f8a3a'; g.lineWidth = 5 * ds; g.lineCap = 'round';
          for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + R(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 14 * ds, y + Math.sin(a) * 14 * ds - 6 * ds, x + Math.cos(a) * 24 * ds, y + Math.sin(a) * 24 * ds); g.stroke(); }
          g.fillStyle = '#8b5a2b'; g.beginPath(); g.arc(x, y, 4 * ds, 0, TAU); g.fill();
        }
      } else if (theme.decor === 'pines') {
        const r = (12 + R() * 14) * ds;
        g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(x + 5 * ds, y + 6 * ds, r, 0, TAU); g.fill();
        g.fillStyle = ['#1d4d2b', '#265f33', '#17402a'][Math.floor(R() * 3)];
        g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? r : r * 0.55; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
      } else if (theme.decor === 'rocks') {
        const r = (8 + R() * 22) * ds;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 5 * ds, y + 6 * ds, r, r * 0.6, 0, 0, TAU); g.fill();
        g.fillStyle = ['#8e3f22', '#a24a28', '#6f2f1a'][Math.floor(R() * 3)];
        g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, rr = r * (0.75 + R() * 0.3); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.65); } g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,200,150,0.25)'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.2, r * 0.4, r * 0.25, 0, 0, TAU); g.fill();
      }
    }
  }

  // track surface
  const tc = document.createElement('canvas'); tc.width = cv.width; tc.height = cv.height;
  const t = tc.getContext('2d'); t.scale(S, S); t.translate(-B.x, -B.y);
  t.lineCap = 'round'; t.lineJoin = 'round';
  tracePoly(t, c.x, c.y, n, 0, n); t.closePath();
  t.strokeStyle = SHOULDER[track.def.theme] || 'rgba(0,0,0,0.2)'; t.lineWidth = TRACK_HALF * 2 + Math.max(40, 10 * cs); t.stroke();
  t.strokeStyle = theme.asphalt; t.lineWidth = TRACK_HALF * 2; t.stroke();
  if (!low) {
    t.fillStyle = theme.asphalt2;
    for (let i = 0; i < n; i += 2) { const o = (R() * 2 - 1) * (TRACK_HALF - 6); t.fillRect(c.x[i] + track.nx[i] * o, c.y[i] + track.ny[i] * o, 2 + R() * 3, 1.5); }
    t.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < n; i += 3) { const o = (R() * 2 - 1) * (TRACK_HALF - 6); t.fillRect(c.x[i] + track.nx[i] * o, c.y[i] + track.ny[i] * o, 1.5 + R() * 2, 1.5); }
  } else {
    // subtle lighter centre so the asphalt is not flat
    t.strokeStyle = theme.asphalt2; t.lineWidth = TRACK_HALF * 1.1; t.globalAlpha = 0.5; t.stroke(); t.globalAlpha = 1;
  }
  // lane slots
  for (const lane of track.lanes) {
    if (!low) { t.strokeStyle = 'rgba(255,255,255,0.10)'; t.lineWidth = 7; tracePoly(t, lane.x, lane.y, lane.n, 0, lane.n); t.closePath(); t.stroke(); }
    t.strokeStyle = low ? 'rgba(0,0,0,0.55)' : theme.slot; t.lineWidth = low ? 1.1 * cs : 3; tracePoly(t, lane.x, lane.y, lane.n, 0, lane.n); t.closePath(); t.stroke();
  }
  // edge lines
  if (theme.glow) { t.shadowColor = theme.edge; t.shadowBlur = low ? 6 * cs : 16; }
  const edgeW = low ? 1.6 * cs : 3;
  for (const side of [-1, 1]) {
    const o = offsetPts(track, side * (TRACK_HALF - edgeW / 2));
    t.strokeStyle = theme.edge; t.lineWidth = edgeW; tracePoly(t, o.xs, o.ys, n, 0, n); t.closePath(); t.stroke();
  }
  // kerbs at corners
  const KERB_K = 1 / 300, kerbW = low ? 4.5 * cs : 10, dash = low ? 8 * cs : 16;
  for (const side of [-1, 1]) {
    const o = offsetPts(track, side * (TRACK_HALF - kerbW / 2));
    for (const [a, b] of runs(track, i => Math.abs(c.k[i]) > KERB_K, 12)) {
      t.setLineDash([]); t.strokeStyle = theme.kerb[0]; t.lineWidth = kerbW; tracePoly(t, o.xs, o.ys, n, a, b); t.stroke();
      t.setLineDash([dash, dash]); t.strokeStyle = theme.kerb[1]; tracePoly(t, o.xs, o.ys, n, a, b); t.stroke();
    }
  }
  t.setLineDash([]); t.shadowBlur = 0;
  // start / finish
  {
    const i = 0, hx = Math.cos(c.h[i]), hy = Math.sin(c.h[i]), nxv = track.nx[i], nyv = track.ny[i];
    const sq = low ? Math.max(8, 4 * cs) : 8, cols = Math.floor((TRACK_HALF * 2 - 8) / sq), rows = low ? 2 : 3;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      t.fillStyle = (r + k) % 2 ? '#111' : '#fff';
      const off = -TRACK_HALF + 4 + k * sq, along = (r - (rows - 1) / 2) * sq;
      const x = c.x[i] + nxv * off + hx * along, y = c.y[i] + nyv * off + hy * along;
      t.save(); t.translate(x, y); t.rotate(c.h[i]); t.fillRect(-sq / 2, -sq / 2, sq, sq); t.restore();
    }
  }
  g.drawImage(tc, B.x, B.y, B.w, B.h);

  // straights: stands and boards
  const straights = runs(track, i => Math.abs(c.k[i]) < 1 / 1600, 0).filter(r => r[1] - r[0] > 60).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  const placeAlong = (run, off, fn) => {
    const m = Math.floor((run[0] + run[1]) / 2), sgn = outerSign(m);
    const len = (run[1] - run[0]) * STEP;
    g.save(); g.translate(c.x[m] + track.nx[m] * sgn * off, c.y[m] + track.ny[m] * sgn * off); g.rotate(c.h[m]);
    if (sgn > 0) g.scale(1, -1);
    fn(Math.min(len * 0.75, 560)); g.restore();
  };
  if (straights[0]) placeAlong(straights[0], TRACK_HALF + 78, L => {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-L / 2 + 6, -30 + 8, L, 60);
    g.fillStyle = '#5a5f6b'; g.fillRect(-L / 2, -30, L, 60);
    const dot = low ? 6 : 3, stepx = low ? 16 : 9, rows = low ? 3 : 4;
    for (let row = 0; row < rows; row++) for (let x = -L / 2 + 8; x < L / 2 - 6; x += stepx) {
      g.fillStyle = ['#ff5a5a', '#ffd34d', '#5ad1ff', '#ffffff', '#ff9bd3', '#8cff8c'][Math.floor(R() * 6)];
      g.beginPath(); g.arc(x, -22 + row * (low ? 13 : 10) + (R() - 0.5) * 3, dot, 0, TAU); g.fill();
    }
    g.fillStyle = theme.night ? '#3a3f6b' : '#d8312f'; g.fillRect(-L / 2, 20, L, 12);
    if (!low) { g.fillStyle = '#fff'; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.fillText('PIPPO POPPI GAMES', 0, 30); }
  });
  if (straights[1]) placeAlong(straights[1], TRACK_HALF + 36, L => {
    let x = -L / 2, k = 0;
    while (x + 110 < L / 2) {
      g.fillStyle = ['#ffffff', '#ffd84d', '#4dc3ff', '#ff5e5e'][k % 4]; g.fillRect(x, -9, 108, 18);
      if (!low) { g.fillStyle = '#111'; g.font = 'bold 9px Arial'; g.textAlign = 'center'; g.fillText(BOARDS[k % BOARDS.length], x + 54, 3.5); }
      x += 116; k++;
    }
  });
  // tyre walls at tight corners (outer side)
  const tr = low ? 3.2 * cs : 7, tstep = low ? Math.max(5, Math.round(2 * tr / STEP)) : 5;
  for (const [a, b] of runs(track, i => Math.abs(c.k[i]) > 1 / 120, 10)) {
    for (let i = a, k = 0; i <= b; i += tstep, k++) {
      const j = ((i % n) + n) % n, sgn = -(Math.sign(c.k[j]) || 1), o = TRACK_HALF + 22 + tr;
      const x = c.x[j] + track.nx[j] * sgn * o, y = c.y[j] + track.ny[j] * sgn * o;
      g.fillStyle = '#151515'; g.beginPath(); g.arc(x, y, tr, 0, TAU); g.fill();
      g.fillStyle = k % 2 ? '#e8e8e8' : '#d8312f'; g.beginPath(); g.arc(x, y, tr * 0.5, 0, TAU); g.fill();
    }
  }
  if (theme.night) {
    for (let i = 0; i < n; i += 90) {
      const sgn = (i / 90) % 2 ? 1 : -1, o = TRACK_HALF + 30;
      const x = c.x[i] + track.nx[i] * sgn * o, y = c.y[i] + track.ny[i] * sgn * o;
      const gr = g.createRadialGradient(x, y, 2, x, y, 95);
      gr.addColorStop(0, 'rgba(255,230,160,0.45)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 95, 0, TAU); g.fill();
      g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(x, y, low ? 2 * cs : 3.5, 0, TAU); g.fill();
    }
  }
  return { cv, g, x: B.x, y: B.y, w: B.w, h: B.h, z, cs, low };
}
function thumbCanvas(track, theme, w, h, pad) {
  const d = G.dpr || 1;
  const cv = document.createElement('canvas'); cv.width = w * d; cv.height = h * d;
  const g = cv.getContext('2d'); g.scale(d, d); const B = track.bounds, c = track.center;
  const bw = B.w - 600, bh = B.h - 600;
  const sc = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  g.translate(w / 2, h / 2); g.scale(sc, sc); g.translate(-(B.x + 300 + bw / 2), -(B.y + 300 + bh / 2));
  g.lineCap = 'round'; g.lineJoin = 'round';
  tracePoly(g, c.x, c.y, c.n, 0, c.n); g.closePath();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = TRACK_HALF * 2 + 60; g.stroke();
  g.strokeStyle = theme.asphalt2; g.lineWidth = TRACK_HALF * 2 + 10; g.stroke();
  g.strokeStyle = theme.edge; g.lineWidth = 14; g.setLineDash([60, 60]); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(c.x[0], c.y[0], 26, 0, TAU); g.fill();
  return { cv, sc, ox: B.x + 300 + bw / 2, oy: B.y + 300 + bh / 2, w, h };
}

/* ---------------- rendering: cars & effects ---------------- */
function carPose(car) {
  const p = car.lane.at(car.s);
  let x = p.x, y = p.y, ang = p.h;
  if (car.derail > 0) { x += car.dx; y += car.dy; ang += car.spin; }
  else { x += -Math.sin(p.h) * car.visOff; y += Math.cos(p.h) * car.visOff; ang += car.visYaw; }
  return { x, y, ang, h: p.h };
}
function drawCar(g, car, race, time) {
  const q = carPose(car);
  g.save(); g.translate(q.x, q.y); g.rotate(q.ang);
  const cs = G.carScale || 1; g.scale(cs, cs);
  const L = 40, Wd = 19;
  g.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(g, -L / 2 + 3, -Wd / 2 + 4, L, Wd, 6); g.fill();
  // wheels
  g.fillStyle = '#111';
  for (const [wx, wy] of [[12, -Wd / 2 - 1], [12, Wd / 2 - 4], [-13, -Wd / 2 - 1], [-13, Wd / 2 - 4]]) { roundRect(g, wx - 5, wy, 10, 5, 1.5); g.fill(); }
  // body
  const grd = g.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
  grd.addColorStop(0, shade(car.color, 1.25)); grd.addColorStop(0.5, car.color); grd.addColorStop(1, shade(car.color, 0.6));
  g.fillStyle = grd; roundRect(g, -L / 2, -Wd / 2, L, Wd, 7); g.fill();
  if (cs > 1.5) { g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1.4; g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.22)'; roundRect(g, -L / 2 + 4, -Wd / 2 + 2, 7, Wd - 4, 2); g.fill(); // air intakes
  if (car.player) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-L / 2 + 2, -1.5, L - 4, 3); }
  // cabin
  g.fillStyle = '#1b2230'; roundRect(g, -5, -Wd / 2 + 3.5, 14, Wd - 7, 4); g.fill();
  g.fillStyle = 'rgba(140,200,255,0.55)'; roundRect(g, 5, -Wd / 2 + 4.5, 4, Wd - 9, 2); g.fill();
  // spoiler
  g.fillStyle = '#15171c'; roundRect(g, -L / 2 - 3, -Wd / 2 - 2, 5, Wd + 4, 1.5); g.fill();
  // lights
  g.fillStyle = '#fff7c2'; g.fillRect(L / 2 - 4, -Wd / 2 + 2, 3, 4); g.fillRect(L / 2 - 4, Wd / 2 - 6, 3, 4);
  const braking = car.brake && car.v > 10 && car.derail === 0;
  g.fillStyle = braking ? '#ff2a2a' : '#7a1010'; g.fillRect(-L / 2 + 1, -Wd / 2 + 2, 2.5, 4); g.fillRect(-L / 2 + 1, Wd / 2 - 6, 2.5, 4);
  if (braking) { g.fillStyle = 'rgba(255,40,40,0.35)'; g.beginPath(); g.arc(-L / 2, -Wd / 2 + 4, 7, 0, TAU); g.arc(-L / 2, Wd / 2 - 4, 7, 0, TAU); g.fill(); }
  if (car.turboT > 0) {
    const f = 10 + Math.sin(time * 60) * 4 + Math.random() * 6;
    g.fillStyle = 'rgba(80,160,255,0.9)'; g.beginPath(); g.moveTo(-L / 2 - 3, -4); g.lineTo(-L / 2 - 3 - f, 0); g.lineTo(-L / 2 - 3, 4); g.fill();
    g.fillStyle = 'rgba(255,200,80,0.9)'; g.beginPath(); g.moveTo(-L / 2 - 3, -2.5); g.lineTo(-L / 2 - 3 - f * 0.6, 0); g.lineTo(-L / 2 - 3, 2.5); g.fill();
  }
  g.restore();
}
function shade(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const c = v => clamp(Math.round(v * f), 0, 255);
  return `rgb(${c(r)},${c(gg)},${c(b)})`;
}
function drawHeadlights(g, car) {
  const q = carPose(car);
  g.save(); g.translate(q.x, q.y); g.rotate(q.ang);
  const cs = Math.sqrt(G.carScale || 1); g.scale(cs, cs);
  g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(20, 0, 230, 0);
  gr.addColorStop(0, 'rgba(255,240,190,0.45)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(18, -8); g.lineTo(230, -70); g.lineTo(230, 70); g.lineTo(18, 8); g.closePath(); g.fill();
  g.restore();
}
const particles = [];
function spawnParticle(p) { if (particles.length < 400) particles.push(p); }
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.3, dt);
    if (p.grow) p.r += p.grow * dt;
  }
}
function drawParticles(g) {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1) * p.alpha;
    g.globalAlpha = a; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}
function smokeAt(x, y, col, n) {
  for (let i = 0; i < n; i++) spawnParticle({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, r: 4 + Math.random() * 4, grow: 18, life: 0.7 + Math.random() * 0.4, max: 1, alpha: 0.45, color: col });
}
function sparksAt(x, y, ang, n) {
  for (let i = 0; i < n; i++) { const a = ang + (Math.random() - 0.5) * 2.2, sp = 150 + Math.random() * 350; spawnParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.5 + Math.random() * 2, grow: 0, life: 0.3 + Math.random() * 0.5, max: 0.8, alpha: 1, color: Math.random() < 0.5 ? '#ffb347' : '#fff1a8' }); }
}
function laySkids(world, car, dt) {
  const q = carPose(car);
  const bx = Math.cos(q.ang), by = Math.sin(q.ang), nxv = -by, nyv = bx;
  const pts = [[q.x - bx * 13 + nxv * 9, q.y - by * 13 + nyv * 9], [q.x - bx * 13 - nxv * 9, q.y - by * 13 - nyv * 9]];
  const strong = car.slip > 0.15 && car.derail === 0 && car.v > 80;
  if (strong && car.rl) {
    const g = world.g; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = world.low ? 2 * world.cs : 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(car.rl[0], car.rl[1]); g.lineTo(pts[0][0], pts[0][1]); g.moveTo(car.rr[0], car.rr[1]); g.lineTo(pts[1][0], pts[1][1]); g.stroke();
  }
  car.rl = pts[0]; car.rr = pts[1];
  if (car.sliding && car.slip > 0.08 && Math.random() < car.slip * 45 * dt) { const w = pts[Math.random() < 0.5 ? 0 : 1]; smokeAt(w[0], w[1], 'rgba(230,230,230,1)', 1); }
}

/* ---------------- audio ---------------- */
const Snd = {
  ctx: null, on: true, master: null, eng: null, ready: false,
  init() {
    if (this.ctx) return;
    const C = root.AudioContext || root.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(this.master); this.bus = comp;
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.engs = [this.makeEngine(1), this.makeEngine(1.06), this.makeEngine(0.95), this.makeEngine(1.12)];
    this.ready = true;
  },
  makeEngine(detune) {
    const ctx = this.ctx, comp = this.bus, nb = this.noiseBuf;
    const e = { detune };
    e.gain = ctx.createGain(); e.gain.gain.value = 0;
    e.lp = ctx.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.frequency.value = 600; e.lp.Q.value = 1.2;
    e.shaper = ctx.createWaveShaper(); const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; curve[i] = Math.tanh(x * 2.6); }
    e.shaper.curve = curve;
    e.shaper.connect(e.lp); e.lp.connect(e.gain); e.gain.connect(comp);
    e.osc = [];
    const specs = [['sawtooth', 1, 0.5], ['square', 0.5, 0.35], ['sawtooth', 1.5, 0.22], ['sawtooth', 2, 0.18], ['sine', 3, 0.1]];
    for (const [type, mul, vol] of specs) {
      const o = ctx.createOscillator(); o.type = type; const g = ctx.createGain(); g.gain.value = vol;
      o.connect(g); g.connect(e.shaper); o.start(); e.osc.push({ o, mul: mul * detune, g });
    }
    // exhaust rumble noise
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    e.nbp = ctx.createBiquadFilter(); e.nbp.type = 'bandpass'; e.nbp.frequency.value = 180; e.nbp.Q.value = 0.7;
    e.ngain = ctx.createGain(); e.ngain.gain.value = 0;
    ns.connect(e.nbp); e.nbp.connect(e.ngain); e.ngain.connect(comp); ns.start();
    // turbo whistle
    e.wh = ctx.createOscillator(); e.wh.type = 'sine'; e.whg = ctx.createGain(); e.whg.gain.value = 0; e.wh.connect(e.whg); e.whg.connect(comp); e.wh.start();
    // tyre squeal
    e.sq = ctx.createOscillator(); e.sq.type = 'sawtooth'; e.sq.frequency.value = 1100;
    e.sqlfo = ctx.createOscillator(); e.sqlfo.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = 60; e.sqlfo.connect(lg); lg.connect(e.sq.frequency); e.sqlfo.start();
    e.sqf = ctx.createBiquadFilter(); e.sqf.type = 'bandpass'; e.sqf.frequency.value = 1500; e.sqf.Q.value = 3;
    e.sqg = ctx.createGain(); e.sqg.gain.value = 0;
    e.sq.connect(e.sqf); e.sqf.connect(e.sqg); e.sqg.connect(comp); e.sq.start();
    const ns2 = ctx.createBufferSource(); ns2.buffer = nb; ns2.loop = true;
    const nf2 = ctx.createBiquadFilter(); nf2.type = 'bandpass'; nf2.frequency.value = 2400; nf2.Q.value = 2;
    e.sqn = ctx.createGain(); e.sqn.gain.value = 0; ns2.connect(nf2); nf2.connect(e.sqn); e.sqn.connect(comp); ns2.start();
    return e;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 1 : 0, this.ctx.currentTime, 0.05); },
  engine(car, active, idx, vol) {
    if (!this.ready) return;
    const e = this.engs[idx || 0], t = this.ctx.currentTime; vol = vol || 1;
    if (!active || !car) { e.gain.gain.setTargetAtTime(0, t, 0.1); e.ngain.gain.setTargetAtTime(0, t, 0.1); e.sqg.gain.setTargetAtTime(0, t, 0.05); e.sqn.gain.setTargetAtTime(0, t, 0.05); e.whg.gain.setTargetAtTime(0, t, 0.05); return; }
    const rpm = clamp(car.rpm, 0, 1.1), thr = car.throttle ? 1 : 0;
    const f = 42 + rpm * 125;
    for (const { o, mul } of e.osc) o.frequency.setTargetAtTime(f * mul, t, 0.03);
    e.lp.frequency.setTargetAtTime(380 + rpm * 2600 + thr * 500, t, 0.05);
    const dip = car.shiftDip > 0 ? 0.4 : 1;
    e.gain.gain.setTargetAtTime((0.22 + thr * 0.16 + rpm * 0.1) * dip * (car.derail > 0 ? 0.3 : 1) * vol, t, 0.04);
    e.ngain.gain.setTargetAtTime((0.12 + thr * 0.22) * (0.4 + rpm * 0.6) * vol, t, 0.05);
    e.nbp.frequency.setTargetAtTime(120 + rpm * 260, t, 0.05);
    const sq = car.derail > 0 ? 0 : clamp(car.slip * 0.9, 0, 0.5) * (car.v > 60 ? 1 : 0);
    e.sqg.gain.setTargetAtTime(sq * 0.18 * vol, t, 0.04); e.sqn.gain.setTargetAtTime(sq * 0.35 * vol, t, 0.04);
    e.sq.frequency.setTargetAtTime(900 + car.slip * 500, t, 0.05);
    const tb = car.turboT > 0 ? 1 : 0;
    e.whg.gain.setTargetAtTime(tb * 0.06, t, 0.06); e.wh.frequency.setTargetAtTime(1200 + rpm * 2400, t, 0.05);
  },
  tone(freq, dur, type, vol, slide) {
    if (!this.ready) return; const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, freq, q, vol, sweep) {
    if (!this.ready) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t); s.stop(t + dur + 0.02);
  },
  shift() { this.noise(0.12, 900, 1.5, 0.25, 300); this.tone(180, 0.1, 'square', 0.08, 90); },
  turbo() { this.noise(0.9, 500, 1.2, 0.5, 4000); this.tone(300, 0.6, 'sawtooth', 0.08, 1400); },
  crash() { this.noise(0.6, 600, 0.6, 0.9, 120); this.tone(90, 0.5, 'sawtooth', 0.35, 30); this.noise(1.2, 3000, 1, 0.3, 800); },
  lap() { this.tone(880, 0.12, 'square', 0.18); setTimeout(() => this.tone(1320, 0.22, 'square', 0.18), 110); },
  beep(final) { if (final) this.tone(880, 0.7, 'square', 0.25); else this.tone(440, 0.18, 'square', 0.2); },
  fanfare() { [0, 120, 240, 420].forEach((d, i) => setTimeout(() => this.tone([523, 659, 784, 1046][i], i === 3 ? 0.7 : 0.18, 'square', 0.22), d)); },
  click() { this.tone(600, 0.06, 'square', 0.1); }
};

/* ---------------- game state ---------------- */
const SAVE_KEY = 'racism2';
let save = { best: {}, sound: true, laps: 3, sel: 0, wins: 0, cam: 'full', players: 1, ai: true, speed: 3, custom: [] };
const MAX_PLAYERS = 4;
try { const s = root.localStorage && root.localStorage.getItem(SAVE_KEY); if (s) save = Object.assign(save, JSON.parse(s)); } catch (e) {}
if (!Array.isArray(save.custom)) save.custom = [];
applySpeed(save.speed);
function allTracks() { return TRACKS.concat(save.custom); }
function bestKey(id) { return id + (P.K === 1 ? '' : '@x' + P.K); }
function persist() { try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

const G = {
  state: 'menu', race: null, world: null, mini: null, thumbs: [], cam: { x: 0, y: 0, ang: 0, zoom: 0.9 },
  time: 0, msgs: [], inputs: [0, 1, 2, 3].map(() => ({ gas: false, brake: false })), flash: 0, lastLights: -1, result: null
};
G.input = G.inputs[0];
const ROW_H = 150, TOP_H = 58;
function twoP() { return G.race && G.race.players.length > 1; }
function startRace(trackIdx) {
  applySpeed(save.speed);
  const list = allTracks(); if (trackIdx >= list.length) trackIdx = 0;
  const def = list[trackIdx];
  const race = newRace(def, save.laps, save.players, save.ai);
  G.race = race; G.state = 'race'; G.msgs.length = 0; particles.length = 0; G.result = null; G.lastLights = -1;
  G.mini = thumbCanvas(race.track, race.theme, 96, 96, 10);
  G.full = fitCamera(race.track, race.players.length > 1);
  G.worlds = {}; G.world = null; ensureWorld();
  const p = race.player.lane.at(race.player.s);
  G.cam.x = p.x; G.cam.y = p.y; G.cam.ang = p.h; G.cam.zoom = 0.9;
  save.sel = trackIdx; persist();
}
function message(text, color, dur) { G.msgs.push({ text, color: color || '#fff', t: 0, dur: dur || 1.6 }); if (G.msgs.length > 3) G.msgs.shift(); }
function handleEvents(race) {
  for (const ev of race.events) {
    const c = ev.car;
    switch (ev.type) {
      case 'go': message('VIA!', '#5dff7a', 1.2); Snd.beep(true); break;
      case 'derail':
        if (c.player) { message((twoP() ? c.name + ' ' : '') + 'DERAGLIATO!', c.color, 1.5); Snd.crash(); race.shake = 0.7; if (root.navigator && navigator.vibrate) try { navigator.vibrate(120); } catch (e) {} }
        { const q = carPose(c); sparksAt(q.x, q.y, q.ang, c.player ? 40 : 18); smokeAt(q.x, q.y, 'rgba(120,120,120,1)', 10); }
        break;
      case 'lap':
        if (c.player) { message((twoP() ? c.name + ' ' : '') + 'GIRO ' + fmtTime(ev.time) + (c.bestLap === ev.time ? ' ★' : ''), twoP() ? c.color : '#ffd600', 1.6); if (c.lap === race.laps) setTimeout(() => message('ULTIMO GIRO!', '#ff8a00', 1.6), 900); Snd.lap(); }
        break;
      case 'finish':
        if (c.player) { message((twoP() ? c.name + ' ' : '') + 'ARRIVO! ' + c.finishPos + '°', c.finishPos === 1 ? '#5dff7a' : '#fff', 2.5); Snd.fanfare(); }
        break;
      case 'turbo': if (c.player) { Snd.turbo(); message((twoP() ? c.name + ' ' : '') + 'TURBO!', '#4fb3ff', 0.8); } break;
      case 'shift': if (c.player) { c.shiftDip = 0.1; Snd.shift(); } break;
      case 'end': finishRace(race); break;
    }
  }
}
function finishRace(race) {
  const pl = race.player;
  const order = race.cars.slice().sort((a, b) => a.pos - b.pos);
  const id = race.track.def.id;
  let newBest = false;
  const bk = bestKey(id);
  if (pl.bestLap != null && (save.best[bk] == null || pl.bestLap < save.best[bk])) { save.best[bk] = pl.bestLap; newBest = true; }
  if (pl.pos === 1) save.wins = (save.wins || 0) + 1;
  persist();
  let winner = null;
  if (race.players.length > 1) winner = race.players.slice().sort((a, b) => a.pos - b.pos)[0];
  if (winner && winner.pidx === 0 && race.players.every(h => h.pos >= winner.pos)) save.wins = (save.wins || 0) + 1;
  G.result = { order, newBest, pos: pl.pos, best: pl.bestLap, total: pl.finishTime, derails: pl.derails, winner };
  G.state = 'result';
}

function ensureWorld() {
  const race = G.race; if (!race) return;
  const full = save.cam === 'full' || twoP();
  const key = full ? 'full' : 'chase';
  if (!G.worlds[key]) G.worlds[key] = full ? buildWorld(race.track, race.theme, race.track.def.seed, G.full.z, G.dpr) : buildWorld(race.track, race.theme, race.track.def.seed, 1, 1);
  G.world = G.worlds[key];
}
function fitCamera(track, two) {
  // whole circuit on screen: fit the track (without the decoration margin) into the free area between HUD and pedals
  const B = track.bounds, pad = 26;
  const bw = B.w - 600 + TRACK_HALF * 2 + 70 + pad * 2, bh = B.h - 600 + TRACK_HALF * 2 + 70 + pad * 2;
  const area = two ? { x: 0, y: TOP_H + 4, w: W, h: H - TOP_H - ROW_H - 8 } : { x: 0, y: 78, w: W, h: H - 78 - 236 };
  const z0 = Math.min(area.w / bw, area.h / bh), z1 = Math.min(area.w / bh, area.h / bw);
  const rot = z1 > z0 * 1.04 ? Math.PI / 2 : 0;
  return { x: B.x + B.w / 2, y: B.y + B.h / 2, rot, z: Math.max(z0, z1), sx: area.x + area.w / 2, sy: area.y + area.h / 2 };
}
/* ---------------- update ---------------- */
function update(dt) {
  G.time += dt;
  for (let i = G.msgs.length - 1; i >= 0; i--) { G.msgs[i].t += dt; if (G.msgs[i].t > G.msgs[i].dur) G.msgs.splice(i, 1); }
  const race = G.race;
  if (!race || (G.state !== 'race' && G.state !== 'result')) { for (let i = 0; i < MAX_PLAYERS; i++) Snd.engine(null, false, i); return; }
  const pl = race.player;
  if (G.state === 'race') {
    race.players.forEach((h, i) => { h.throttle = G.inputs[i].gas ? 1 : 0; h.brake = G.inputs[i].brake ? 1 : 0; });
    if (race.state === 'countdown') {
      for (const h of race.players) h.rpm += ((h.throttle ? 0.9 : 0.14) - h.rpm) * Math.min(1, dt * 5);
      const lit = Math.min(5, Math.floor((4.2 - race.countdown) / 0.7));
      if (lit !== G.lastLights && lit >= 1 && lit <= 5) { G.lastLights = lit; Snd.beep(false); }
    }
    for (const h of race.players) if (h.shiftDip > 0) h.shiftDip -= dt;
    stepRace(race, dt);
    handleEvents(race);
    for (const c of race.cars) laySkids(G.world, c, dt);
    if (race.shake > 0) race.shake -= dt;
  }
  updateParticles(dt);
  // camera
  const look = clamp(pl.v * 0.12 / P.K, 30, 110);
  const tp = pl.lane.at(pl.s + look);
  const pose = carPose(pl);
  const tx = pl.derail > 0 ? pose.x : lerp(pose.x, tp.x, 0.5), ty = pl.derail > 0 ? pose.y : lerp(pose.y, tp.y, 0.5);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 9); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 9);
  const ta = pl.lane.at(pl.s + 40 + look * 1.3).h;
  G.cam.ang = angLerp(G.cam.ang, ta, Math.min(1, dt * 3.2));
  const tz = race.state === 'countdown' ? 1.0 : lerp(1.08, 0.74, clamp(pl.v / P.VMAX, 0, 1));
  G.cam.zoom += (tz - G.cam.zoom) * Math.min(1, dt * 2.5);
  const vol = race.players.length > 1 ? 0.8 / Math.sqrt(race.players.length) : 1;
  race.players.forEach((h, i) => Snd.engine(h, G.state === 'race', i, vol));
  for (let i = race.players.length; i < MAX_PLAYERS; i++) Snd.engine(null, false, i);
}

/* ---------------- draw ---------------- */
let canvas, ctx;
function drawWorld(g) {
  const race = G.race, pl = race.player;
  g.save();
  let sx = 0, sy = 0;
  if (race.shake > 0) { sx = (Math.random() - 0.5) * 14 * race.shake; sy = (Math.random() - 0.5) * 14 * race.shake; }
  const full = save.cam === 'full' || twoP();
  if (!G.world || G.world.low !== full) ensureWorld();
  let z;
  if (full) {
    const F = G.full;
    g.translate(F.sx + sx, F.sy + sy); g.rotate(F.rot); g.scale(F.z, F.z); g.translate(-F.x, -F.y);
    z = F.z;
  } else {
    g.translate(W / 2 + sx, H * 0.6 + sy);
    g.rotate(-Math.PI / 2 - G.cam.ang);
    g.scale(G.cam.zoom, G.cam.zoom);
    g.translate(-G.cam.x, -G.cam.y);
    z = G.cam.zoom;
  }
  G.carScale = clamp(0.62 / z, 1, 3.3);
  const lw = 9 * clamp(0.5 / z, 1, 3);
  g.imageSmoothingEnabled = true;
  g.drawImage(G.world.cv, G.world.x, G.world.y, G.world.w, G.world.h);
  // racing-line assist
  if (G.state === 'race' && race.state === 'race') for (const h of race.players) {
    if (h.derail > 0) continue;
    const lane = h.lane, grip = race.grip; let prev = null;
    for (let d = 0; d <= 420; d += 14) {
      const va = allowedSpeed(lane, h.s + d, grip);
      const vBrake = Math.sqrt(Math.max(0, h.v * h.v - 2 * P.BRAKE * 0.85 * d));
      let col = null;
      if (vBrake > va * 1.02) col = 'rgba(255,40,40,0.55)'; else if (h.v > va * 1.02) col = 'rgba(255,200,40,0.45)';
      const p = lane.at(h.s + d);
      if (prev && col) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(p.x, p.y); g.stroke(); }
      prev = p;
    }
  }
  for (const c of race.cars) if (!c.player) drawCar(g, c, race, G.time);
  for (const h of race.players) drawCar(g, h, race, G.time);
  if (full) for (const h of race.players) {
    if (h.derail > 0) continue;
    const q = carPose(h), r = 30 * G.carScale * 0.5, pulse = 1 + Math.sin(G.time * 6) * 0.08;
    g.save(); g.translate(q.x, q.y); g.rotate(-G.full.rot);
    g.strokeStyle = h.color; g.lineWidth = 2.5 / z; g.beginPath(); g.arc(0, 0, r * pulse, 0, TAU); g.stroke();
    g.fillStyle = h.color; g.beginPath(); g.moveTo(0, -r * pulse - 4 / z); g.lineTo(-8 / z, -r * pulse - 18 / z); g.lineTo(8 / z, -r * pulse - 18 / z); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1 / z; g.stroke();
    g.restore();
  }
  if (race.theme.night) for (const c of race.cars) if (c.derail === 0) drawHeadlights(g, c);
  drawParticles(g);
  g.restore();
}
function btnRects() {
  return {
    gas: { x: W - 138, y: H - 160, w: 124, h: 130 },
    turbo: { x: 14, y: H - 160, w: 124, h: 130 },
    mute: { x: 58, y: H - 222, w: 40, h: 40 },
    cam: { x: 102, y: H - 222, w: 40, h: 40 },
    back: { x: 14, y: H - 222, w: 40, h: 40 }
  };
}
function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function drawPedal(g, r, color, label, pressed, sub) {
  g.save();
  g.globalAlpha = 0.92;
  g.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(g, r.x, r.y + 6, r.w, r.h, 22); g.fill();
  const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h);
  gr.addColorStop(0, pressed ? shade(color, 0.75) : shade(color, 1.15)); gr.addColorStop(1, pressed ? shade(color, 0.6) : shade(color, 0.8));
  g.fillStyle = gr; roundRect(g, r.x, r.y + (pressed ? 4 : 0), r.w, r.h - (pressed ? 4 : 0), 22); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 24; g.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif';
  while (fs > 11 && g.measureText(label).width > r.w - 10) { fs -= 1; g.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif'; }
  g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 10 : 0));
  if (sub) { g.font = 'bold 13px Arial'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText(sub, r.x + r.w / 2, r.y + r.h / 2 + 16); }
  g.restore();
}
const PKEYS = [
  { gas: ['ArrowUp', 'Space', 'ArrowRight'], brake: [], turbo: ['Enter', 'ControlRight', 'ShiftRight'], label: '↑ + Invio' },
  { gas: ['KeyW'], brake: [], turbo: ['KeyQ'], label: 'W + Q' },
  { gas: ['KeyI'], brake: [], turbo: ['KeyU'], label: 'I + U' },
  { gas: ['Numpad8'], brake: [], turbo: ['Numpad7'], label: 'Num8 + Num7' }
];
function colRects(n) { // column-local rects for one player's control block, column width cw
  const cw = W / n, m = n > 2 ? 3 : 6;
  return { cw, gas: { x: m, y: 10, w: cw - 2 * m, h: 92 }, turbo: { x: m, y: 108, w: cw - 2 * m, h: ROW_H - 116 } };
}
function colLocal(x, y, n) { if (y < H - ROW_H) return null; const cw = W / n, i = Math.min(n - 1, Math.floor(x / cw)); return { pidx: i, lx: x - i * cw, ly: y - (H - ROW_H) }; }
function drawCols(g, race) {
  const n = race.players.length, C = colRects(n);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, H - ROW_H, W, ROW_H);
  race.players.forEach((h, i) => {
    const inp = G.inputs[i];
    g.save(); g.translate(i * C.cw, H - ROW_H);
    g.fillStyle = h.color; g.globalAlpha = 0.18; g.fillRect(0, 0, C.cw, ROW_H); g.globalAlpha = 1; g.fillRect(0, 0, C.cw, 4);
    if (h.derail === 0 && h.slip > 0.05 && race.state === 'race') { g.fillStyle = `rgba(255,0,0,${0.4 * clamp(h.slip, 0, 1)})`; g.fillRect(0, 0, C.cw, ROW_H); }
    drawPedal(g, C.gas, '#2fa84f', 'GAS', inp.gas);
    const tb = h.turbo > 0 && h.turboT <= 0;
    drawPedal(g, C.turbo, tb ? '#ff8a00' : '#6b5a4a', '⚡'.repeat(h.turbo) || 'TURBO', h.turboT > 0);
    g.restore();
  });
  if (n > 2) { g.font = 'bold 9px Arial'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.textAlign = 'center'; } 
}
function drawTopStrip(g, race) {
  const n = race.players.length, x0 = 34, cw = (W - 68) / n;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, TOP_H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  race.players.forEach((h, i) => {
    const cx = x0 + cw * i + cw / 2;
    g.fillStyle = h.color; g.font = '900 ' + (n > 2 ? 13 : 15) + 'px Arial Black, Arial'; g.fillText(h.name + ' ' + h.pos + '°', cx, 13);
    g.fillStyle = '#fff'; g.font = 'bold ' + (n > 2 ? 11 : 13) + 'px Consolas, Menlo, monospace';
    g.fillText(race.state === 'countdown' ? 'PRONTI' : 'G' + Math.min(Math.max(h.lap, 1), race.laps) + '/' + race.laps + ' ' + fmtTime(race.state === 'race' && !h.finished ? race.t - h.lapStart : (h.lastLap || 0)), cx, 30);
    g.font = 'bold 10px Arial';
    if (h.derail > 0) { g.fillStyle = '#ff5a5a'; g.fillText('DERAGLIATO!', cx, 46); }
    else if (h.finished) { g.fillStyle = '#5dff7a'; g.fillText('ARRIVATO ' + h.finishPos + '°', cx, 46); }
    else { g.fillStyle = '#9be7ff'; g.fillText(n > 2 ? Math.round(h.v * 0.36 / P.K) + ' km/h G' + h.gear : Math.round(h.v * 0.36 / P.K) + ' km/h  G' + h.gear + '  best ' + fmtTime(h.bestLap), cx, 46); }
  });
  const R = stripRects();
  g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, R.back.x, R.back.y, R.back.w, R.back.h, 8); g.fill(); roundRect(g, R.mute.x, R.mute.y, R.mute.w, R.mute.h, 8); g.fill();
  g.fillStyle = '#fff'; g.font = '15px Arial'; g.fillText('⏸', R.back.x + 14, R.back.y + 15); g.fillText(Snd.on ? '🔊' : '🔇', R.mute.x + 14, R.mute.y + 15);
}
function stripRects() { return { back: { x: 3, y: 15, w: 28, h: 28 }, mute: { x: W - 31, y: 15, w: 28, h: 28 } }; }
function drawHUD2(g) {
  const race = G.race;
  drawTopStrip(g, race);
  drawCols(g, race);
  if (race.state === 'countdown') {
    const lit = Math.min(5, Math.floor((4.2 - race.countdown) / 0.7));
    g.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(g, W / 2 - 120, H / 2 - 28, 240, 56, 14); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = i < lit ? '#ff2020' : '#3a1010'; g.beginPath(); g.arc(W / 2 - 88 + i * 44, H / 2, 16, 0, TAU); g.fill(); }
  }
  g.textBaseline = 'middle';
  G.msgs.forEach((m, i) => {
    const a = m.t < 0.15 ? m.t / 0.15 : m.t > m.dur - 0.4 ? (m.dur - m.t) / 0.4 : 1;
    g.globalAlpha = clamp(a, 0, 1); g.font = '900 22px Arial Black, Arial'; g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(m.text, W / 2 + 2, H / 2 + 50 + i * 30 + 2);
    g.fillStyle = m.color; g.fillText(m.text, W / 2, H / 2 + 50 + i * 30);
    g.globalAlpha = 1;
  });
}
function drawHUD(g) {
  if (twoP()) return drawHUD2(g);
  const race = G.race, pl = race.player, R = btnRects();
  g.textBaseline = 'middle';
  // position
  g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, 10, 10, 86, 60, 12); g.fill();
  g.fillStyle = pl.pos === 1 ? '#ffd600' : '#fff'; g.font = '900 36px Arial Black, Arial'; g.textAlign = 'left'; g.fillText('P' + pl.pos, 18, 40);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = 'bold 14px Arial'; g.fillText('/' + race.cars.length, 74, 46);
  // lap & time
  g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, 104, 10, 182, 60, 12); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '900 16px Arial Black, Arial';
  g.fillText(race.state === 'countdown' ? 'PRONTI...' : 'GIRO ' + Math.min(Math.max(pl.lap, 1), race.laps) + '/' + race.laps, 195, 26);
  g.font = 'bold 18px Consolas, Menlo, monospace'; g.fillStyle = '#9be7ff';
  g.fillText(fmtTime(race.state === 'race' && !pl.finished ? race.t - pl.lapStart : (pl.lastLap || 0)), 195, 47);
  g.font = 'bold 11px Arial'; g.fillStyle = '#ffd600'; g.fillText('BEST ' + fmtTime(pl.bestLap), 195, 62);
  // minimap (chase camera only) or standings (full view)
  g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, W - 106, 10, 96, save.cam === 'full' ? 60 : 96, 12); g.fill();
  if (save.cam === 'full') {
    const order = race.cars.slice().sort((a, b) => a.pos - b.pos);
    order.forEach((c, i) => {
      const y = 20 + i * 13; g.fillStyle = c.color; g.beginPath(); g.arc(W - 96, y, 4, 0, TAU); g.fill();
      g.textAlign = 'left'; g.fillStyle = c.player ? '#ffd600' : '#fff'; g.font = (c.player ? '900 ' : 'bold ') + '10px Arial'; g.fillText((i + 1) + ' ' + c.name.split(' ')[0], W - 88, y);
    });
  } else {
    g.drawImage(G.mini.cv, W - 106, 10, G.mini.w, G.mini.h);
    for (const c of race.cars) {
      const q = carPose(c); const mx = W - 106 + 48 + (q.x - G.mini.ox) * G.mini.sc, my = 10 + 48 + (q.y - G.mini.oy) * G.mini.sc;
      g.fillStyle = c.color; g.beginPath(); g.arc(mx, my, c.player ? 4.5 : 3.5, 0, TAU); g.fill();
      if (c.player) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
    }
  }
  // mute & back
  g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, R.mute.x, R.mute.y, R.mute.w, R.mute.h, 10); g.fill(); roundRect(g, R.back.x, R.back.y, R.back.w, R.back.h, 10); g.fill();
  roundRect(g, R.cam.x, R.cam.y, R.cam.w, R.cam.h, 10); g.fill();
  g.fillStyle = '#fff'; g.font = '18px Arial'; g.textAlign = 'center'; g.fillText(Snd.on ? '🔊' : '🔇', R.mute.x + 20, R.mute.y + 21); g.fillText('⏸', R.back.x + 20, R.back.y + 21);
  g.fillText(save.cam === 'full' ? '🗺️' : '🎥', R.cam.x + 20, R.cam.y + 21);
  // speedometer
  const cx = W / 2, cy = H - 92, rad = 50;
  const vr = clamp(pl.v / (P.VMAX * P.TURBO_V), 0, 1);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(cx, cy, rad + 10, 0, TAU); g.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  g.lineWidth = 9; g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx, cy, rad, a0, a1); g.stroke();
  const grd = g.createLinearGradient(cx - rad, 0, cx + rad, 0); grd.addColorStop(0, '#3fd1ff'); grd.addColorStop(0.6, '#ffd600'); grd.addColorStop(1, '#ff3030');
  g.strokeStyle = grd; g.beginPath(); g.arc(cx, cy, rad, a0, a0 + (a1 - a0) * vr); g.stroke();
  g.fillStyle = '#fff'; g.font = '900 26px Arial Black, Arial'; g.fillText(Math.round(pl.v * 0.36 / P.K), cx, cy - 4);
  g.font = 'bold 10px Arial'; g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('km/h', cx, cy + 14);
  g.font = '900 14px Arial Black, Arial'; g.fillStyle = pl.rpm > 0.95 ? '#ff5050' : '#9be7ff'; g.fillText('G' + pl.gear, cx, cy + 30);
  // rpm bar
  g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, cx - 40, cy + 44, 80, 6, 3); g.fill();
  g.fillStyle = pl.rpm > 0.95 ? '#ff5050' : '#5dff7a'; roundRect(g, cx - 40, cy + 44, 80 * clamp(pl.rpm, 0, 1), 6, 3); g.fill();
  // pedals
  drawPedal(g, R.gas, '#2fa84f', 'GAS', G.input.gas);
  const tb = pl.turbo > 0 && pl.turboT <= 0;
  drawPedal(g, R.turbo, tb ? '#ff8a00' : '#6b5a4a', 'TURBO', pl.turboT > 0, '⚡'.repeat(pl.turbo) || 'vuoto');
  // slip warning
  if (pl.derail === 0 && pl.slip > 0.05 && race.state === 'race') {
    const a = clamp(pl.slip, 0, 1);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, `rgba(255,0,0,${0.55 * a})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (pl.slip > 0.45 && Math.floor(G.time * 8) % 2 === 0) { g.fillStyle = '#ff5050'; g.font = '900 26px Arial Black, Arial'; g.textAlign = 'center'; g.fillText('TROPPO VELOCE!', W / 2, H * 0.3); }
  }
  // countdown lights
  if (race.state === 'countdown') {
    const lit = Math.min(5, Math.floor((4.2 - race.countdown) / 0.7));
    g.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(g, W / 2 - 120, 150, 240, 56, 14); g.fill();
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < lit ? '#ff2020' : '#3a1010'; g.beginPath(); g.arc(W / 2 - 88 + i * 44, 178, 16, 0, TAU); g.fill();
      if (i < lit) { g.fillStyle = 'rgba(255,60,60,0.35)'; g.beginPath(); g.arc(W / 2 - 88 + i * 44, 178, 24, 0, TAU); g.fill(); }
    }
    if (race.countdown > 3.6) { g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('Tieni GAS. Rilascia prima delle curve!', W / 2, 228); }
  }
  // messages
  G.msgs.forEach((m, i) => {
    const a = m.t < 0.15 ? m.t / 0.15 : m.t > m.dur - 0.4 ? (m.dur - m.t) / 0.4 : 1;
    g.globalAlpha = clamp(a, 0, 1); g.font = '900 30px Arial Black, Arial'; g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(m.text, W / 2 + 2, H * 0.4 + i * 40 + 2);
    g.fillStyle = m.color; g.fillText(m.text, W / 2, H * 0.4 + i * 40);
    g.globalAlpha = 1;
  });
}
function menuRects() {
  const list = allTracks();
  const cards = list.map((t, i) => ({ x: 14, y: 156 + i * 92 - (G.menuScroll || 0), w: W - 28, h: 84, i }));
  return { cards, go: { x: 148, y: H - 94, w: W - 296, h: 60 }, laps: { x: 14, y: H - 86, w: 40, h: 44 }, players: { x: 58, y: H - 86, w: 40, h: 44 }, speed: { x: 102, y: H - 86, w: 40, h: 44 }, ai: { x: W - 98, y: H - 86, w: 40, h: 44 }, mute: { x: W - 54, y: H - 86, w: 40, h: 44 }, editor: { x: W - 110, y: 118, w: 96, h: 30 } };
}
function drawMenu(g) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#13162a'); bg.addColorStop(1, '#2a0f1f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.08; g.strokeStyle = '#fff'; g.lineWidth = 18;
  for (let i = -8; i < 14; i++) { g.beginPath(); g.moveTo(i * 60 + (G.time * 40) % 60, 0); g.lineTo(i * 60 + 300 + (G.time * 40) % 60, H); g.stroke(); }
  g.restore();
  for (let k = 0; k < 20; k++) { g.fillStyle = k % 2 ? '#fff' : '#111'; g.fillRect(k * 20, 0, 20, 10); g.fillStyle = k % 2 ? '#111' : '#fff'; g.fillRect(k * 20, 10, 20, 10); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(W / 2, 62); g.transform(1, 0, -0.18, 1, 0, 0);
  g.font = '900 54px Arial Black, Arial'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText('RACISM 2', 4, 4);
  const tg = g.createLinearGradient(0, -30, 0, 30); tg.addColorStop(0, '#fff'); tg.addColorStop(0.5, '#ffd600'); tg.addColorStop(1, '#ff6a00');
  g.fillStyle = tg; g.fillText('RACISM 2', 0, 0);
  g.restore();
  g.font = 'bold 15px Arial'; g.fillStyle = '#9be7ff'; g.fillText('SUPER SLOT RACING  •  scegli il circuito', W / 2, 104);
  const M = menuRects();
  g.fillStyle = '#3a6cff'; roundRect(g, M.editor.x, M.editor.y, M.editor.w, M.editor.h, 10); g.fill();
  g.fillStyle = '#fff'; g.font = '900 13px Arial Black, Arial'; g.fillText('✎ EDITOR', M.editor.x + M.editor.w / 2, M.editor.y + 15);
  g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '11px Arial'; g.fillText(allTracks().length > 5 ? 'scorri la lista ↕' : 'crea i tuoi circuiti →', 14, 133);
  g.save(); g.beginPath(); g.rect(0, 150, W, H - 150 - 104); g.clip();
  const list = allTracks();
  for (const c of M.cards) {
    if (c.y + c.h < 150 || c.y > H - 104) continue;
    const def = list[c.i], th = THEMES[def.theme], sel = c.i === save.sel;
    if (!G.thumbs[c.i]) G.thumbs[c.i] = thumbCanvas(buildTrack(def), th, 96, 68, 6);
    g.fillStyle = sel ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)'; roundRect(g, c.x, c.y, c.w, c.h, 14); g.fill();
    if (sel) { g.strokeStyle = '#ffd600'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = th.bg; roundRect(g, c.x + 8, c.y + 8, 96, c.h - 16, 10); g.fill();
    const th2 = G.thumbs[c.i]; if (th2) g.drawImage(th2.cv, c.x + 8, c.y + 8, th2.w, th2.h);
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '900 17px Arial Black, Arial'; g.fillText(def.name, c.x + 116, c.y + 20);
    g.fillStyle = '#ffd600'; g.font = '14px Arial'; g.fillText('★'.repeat(def.stars) + '☆'.repeat(5 - def.stars), c.x + 116, c.y + 40);
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '11px Arial'; wrapText(g, def.desc, c.x + 116, c.y + 57, c.w - 130, 13);
    const b = save.best[bestKey(def.id)]; if (b != null) { g.textAlign = 'right'; g.fillStyle = '#9be7ff'; g.font = 'bold 11px Arial'; g.fillText('BEST ' + fmtTime(b), c.x + c.w - 10, c.y + 20); }
    if (def.custom) { g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, c.x + c.w - 46, c.y + c.h - 36, 38, 28, 8); g.fill(); g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '15px Arial'; g.fillText('✎', c.x + c.w - 27, c.y + c.h - 21); }
  }
  g.restore();
  g.fillStyle = '#1a1230'; g.fillRect(0, H - 104, W, 104);
  g.textAlign = 'center';
  const go = M.go; g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, go.x, go.y + 5, go.w, go.h, 18); g.fill();
  const gg = g.createLinearGradient(0, go.y, 0, go.y + go.h); gg.addColorStop(0, '#5dff7a'); gg.addColorStop(1, '#1f9c43');
  g.fillStyle = gg; roundRect(g, go.x, go.y, go.w, go.h, 18); g.fill();
  g.fillStyle = '#073b16'; g.font = '900 22px Arial Black, Arial'; g.fillText(save.players > 1 ? 'SFIDA A ' + save.players : 'GARA! 🏁', W / 2, go.y + go.h / 2);
  g.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(g, M.laps.x, M.laps.y, M.laps.w, M.laps.h, 10); g.fill(); roundRect(g, M.mute.x, M.mute.y, M.mute.w, M.mute.h, 10); g.fill();
  roundRect(g, M.players.x, M.players.y, M.players.w, M.players.h, 10); g.fill();
  if (save.players > 1) { g.strokeStyle = '#4fb3ff'; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = '#fff'; g.font = '900 15px Arial Black, Arial'; g.fillText(save.laps + 'G', M.laps.x + 20, M.laps.y + 18);
  g.font = '9px Arial'; g.fillText('giri', M.laps.x + 20, M.laps.y + 34);
  roundRect(g, M.speed.x, M.speed.y, M.speed.w, M.speed.h, 10); g.fill();
  g.font = '900 15px Arial Black, Arial'; g.fillStyle = save.speed >= 3 ? '#ff8a00' : '#fff'; g.fillText('×' + save.speed, M.speed.x + 20, M.speed.y + 18);
  g.font = '9px Arial'; g.fillStyle = '#fff'; g.fillText('velocità', M.speed.x + 20, M.speed.y + 34);
  g.font = '900 15px Arial Black, Arial'; g.fillStyle = save.players > 1 ? '#4fb3ff' : '#fff'; g.fillText(save.players + 'P', M.players.x + 20, M.players.y + 18);
  g.font = '9px Arial'; g.fillStyle = '#fff'; g.fillText(save.players > 1 ? 'piloti' : 'solo', M.players.x + 20, M.players.y + 34);
  g.font = '18px Arial'; g.fillText(Snd.on ? '🔊' : '🔇', M.mute.x + 20, M.mute.y + 22);
  if (save.players > 1) {
    g.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(g, M.ai.x, M.ai.y, M.ai.w, M.ai.h, 10); g.fill();
    if (!save.ai) { g.strokeStyle = '#4fb3ff'; g.lineWidth = 2; g.stroke(); }
    g.font = '900 13px Arial Black, Arial'; g.fillStyle = save.ai ? '#fff' : '#4fb3ff'; g.fillText(save.ai ? 'IA' : 'NO IA', M.ai.x + 20, M.ai.y + 18);
    g.font = '9px Arial'; g.fillStyle = '#fff'; g.fillText(save.ai ? 'riempi' : 'solo noi', M.ai.x + 20, M.ai.y + 34);
  }
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.font = '11px Arial'; g.fillText(save.players > 1 ? 'Stesso schermo, un GAS per pilota • tasti ' + PKEYS.slice(0, save.players).map(k => k.label).join(' | ') : 'Tieni GAS, rilascia in curva • TURBO ⚡ • 🗺️/🎥 telecamera', W / 2, H - 14);
}
function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = t; }
  if (line) g.fillText(line, x, y);
}
function resultRects() { return { again: { x: 24, y: H - 150, w: 165, h: 52 }, menu: { x: W - 189, y: H - 150, w: 165, h: 52 }, share: { x: 60, y: H - 86, w: W - 120, h: 48 } }; }
function drawResult(g) {
  const r = G.result, race = G.race;
  g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 20px Arial Black, Arial'; g.fillStyle = '#9be7ff'; g.fillText(race.track.def.name.toUpperCase(), W / 2, 92);
  if (r.winner) {
    g.font = '900 48px Arial Black, Arial'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText('VINCE ' + r.winner.name, W / 2 + 3, 158);
    g.fillStyle = r.winner.color; g.fillText('VINCE ' + r.winner.name, W / 2, 155);
    g.font = 'bold 18px Arial'; g.fillStyle = '#fff'; g.fillText(race.cars.length === race.players.length ? 'sfida tra amici 🏆' : r.winner.pos === 1 ? 'e batte anche le IA! 🏆' : 'arrivato ' + r.winner.pos + '° assoluto', W / 2, 205);
  } else {
    g.font = '900 64px Arial Black, Arial'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText('P' + r.pos, W / 2 + 3, 158);
    g.fillStyle = r.pos === 1 ? '#ffd600' : r.pos === 2 ? '#e0e0e0' : r.pos === 3 ? '#d08a4a' : '#fff'; g.fillText('P' + r.pos, W / 2, 155);
    g.font = 'bold 18px Arial'; g.fillStyle = '#fff';
    g.fillText(r.pos === 1 ? 'VITTORIA! 🏆' : r.pos === 2 ? 'Secondo. Quasi!' : r.pos === 3 ? 'Podio di bronzo' : 'Ultimo... riprova!', W / 2, 205);
  }
  const rows = r.order; const y0 = 250;
  g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, 18, y0 - 20, W - 36, rows.length * 44 + 30, 14); g.fill();
  rows.forEach((c, i) => {
    const y = y0 + i * 44 + 6;
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '900 20px Arial Black, Arial'; g.fillText(String(i + 1), 32, y);
    g.fillStyle = c.color; g.beginPath(); g.arc(62, y, 9, 0, TAU); g.fill();
    g.fillStyle = c.player ? '#ffd600' : '#fff'; g.font = c.player ? '900 15px Arial Black, Arial' : 'bold 15px Arial'; g.fillText(c.name, 80, y - 7);
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = '11px Arial'; g.fillText('miglior giro ' + fmtTime(c.bestLap) + (c.derails ? '  •  ' + c.derails + ' deragl.' : ''), 80, y + 10);
    g.textAlign = 'right'; g.fillStyle = '#9be7ff'; g.font = 'bold 15px Consolas, Menlo, monospace';
    g.fillText(c.finished ? fmtTime(c.finishTime) : 'DNF', W - 32, y);
  });
  if (r.newBest) { g.textAlign = 'center'; g.fillStyle = '#5dff7a'; g.font = '900 16px Arial Black, Arial'; g.fillText('★ NUOVO RECORD DEL CIRCUITO ★', W / 2, y0 + rows.length * 44 + 32); }
  const R = resultRects();
  const btn = (b, col, txt, tcol) => { g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, b.x, b.y + 4, b.w, b.h, 14); g.fill(); g.fillStyle = col; roundRect(g, b.x, b.y, b.w, b.h, 14); g.fill(); g.fillStyle = tcol || '#fff'; g.font = '900 18px Arial Black, Arial'; g.textAlign = 'center'; g.fillText(txt, b.x + b.w / 2, b.y + b.h / 2); };
  btn(R.again, '#2fa84f', 'RIGARA', '#073b16'); btn(R.menu, '#3a6cff', 'CIRCUITI'); btn(R.share, '#111', 'Condividi su 𝕏');
}
function draw() {
  const g = ctx, d = G.dpr || 1;
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  if (G.state === 'menu') { drawMenu(g); return; }
  if (G.state === 'editor') { if (ED.msgT > 0) ED.msgT -= 1 / 60; drawEditor(g); return; }
  g.fillStyle = G.race.theme.bg; g.fillRect(0, 0, W, H);
  drawWorld(g);
  if (G.state === 'race') drawHUD(g);
  else if (G.state === 'result') drawResult(g);
  else if (G.state === 'paused') {
    drawHUD(g); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = '900 36px Arial Black, Arial'; g.fillText('PAUSA', W / 2, H / 2 - 40);
    g.font = 'bold 16px Arial'; g.fillText('tocca per continuare', W / 2, H / 2 + 4);
    g.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(g, W / 2 - 90, H / 2 + 40, 180, 44, 12); g.fill();
    g.fillStyle = '#fff'; g.fillText('ESCI AI CIRCUITI', W / 2, H / 2 + 62);
  }
}
function shareText() {
  const r = G.result; if (!r) return GAME_URL;
  if (r.winner) return `${r.winner.name} ha vinto la sfida a ${G.race.players.length} su "${G.race.track.def.name}" in RACISM 2 🏁 (miglior giro ${fmtTime(r.winner.bestLap)}). Sfida un amico: ${GAME_URL}`;
  return `Sono arrivato P${r.pos} su "${G.race.track.def.name}" in RACISM 2 🏁 miglior giro ${fmtTime(r.best)}${r.derails ? ` (${r.derails} deragliamenti 💀)` : ' senza deragliare 😎'}. Batti il mio tempo: ${GAME_URL}`;
}
function openShare() { const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()); try { root.open(url, '_blank', 'noopener'); } catch (e) {} }

/* ---------------- track editor ---------------- */
const ED_BOX = 2300; // design space 0..ED_BOX
const ED = { def: null, track: null, sel: -1, drag: null, problems: [], dirty: false, editingIdx: -1, msg: '', msgT: 0 };
function edArea() { return { x: 0, y: 54, w: W, h: H - 54 - 120 }; }
function edScale() { const A = edArea(); return Math.min(A.w / ED_BOX, A.h / ED_BOX) * 0.96; }
function edToScreen(x, y) { const A = edArea(), z = edScale(); return { x: A.x + A.w / 2 + (x - ED_BOX / 2) * z, y: A.y + A.h / 2 + (y - ED_BOX / 2) * z }; }
function edToWorld(sx, sy) { const A = edArea(), z = edScale(); return { x: (sx - A.x - A.w / 2) / z + ED_BOX / 2, y: (sy - A.y - A.h / 2) / z + ED_BOX / 2 }; }
function edDefault() {
  return { id: 'c' + Date.now().toString(36), name: 'Il mio circuito', theme: 'verde', stars: 3, desc: 'Circuito personalizzato', seed: Math.floor(Math.random() * 1e6), custom: true,
    pts: [{ x: 450, y: 1650 }, { x: 1150, y: 1800 }, { x: 1850, y: 1650 }, { x: 2050, y: 1150 }, { x: 1850, y: 650 }, { x: 1150, y: 500 }, { x: 450, y: 650 }, { x: 250, y: 1150 }] };
}
function openEditor(idx) {
  const list = allTracks();
  if (idx != null && idx >= 0 && list[idx] && list[idx].custom) { ED.def = JSON.parse(JSON.stringify(list[idx])); ED.editingIdx = idx; }
  else { ED.def = edDefault(); ED.editingIdx = -1; }
  ED.sel = -1; ED.drag = null; ED.dirty = false; edRebuild(); G.state = 'editor';
}
function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(d) < 1e-9) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
function edValidate(track) {
  const problems = []; const c = track.center, n = c.n;
  // tight corners: flag the nearest control point
  const MINR = 72; const bad = new Set();
  for (let i = 0; i < n; i++) if (Math.abs(c.k[i]) > 1 / MINR) { let b = 0, bd = 1e18; ED.def.pts.forEach((p, j) => { const d = (p.x - c.x[i]) ** 2 + (p.y - c.y[i]) ** 2; if (d < bd) { bd = d; b = j; } }); bad.add(b); }
  if (bad.size) problems.push({ type: 'tight', pts: [...bad], text: 'Curva troppo stretta' });
  // outer edges crossing themselves (track overlapping)
  const stride = 6, side = TRACK_HALF + 20; let cross = false;
  for (const sg of [-1, 1]) {
    const xs = [], ys = [];
    for (let i = 0; i < n; i += stride) { xs.push(c.x[i] + track.nx[i] * sg * side); ys.push(c.y[i] + track.ny[i] * sg * side); }
    const m = xs.length;
    outer: for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1) continue;
      if (segHit(xs[i], ys[i], xs[(i + 1) % m], ys[(i + 1) % m], xs[j], ys[j], xs[(j + 1) % m], ys[(j + 1) % m])) { cross = true; break outer; }
    }
    if (cross) break;
  }
  if (cross) problems.push({ type: 'cross', pts: [], text: 'La pista si sovrappone' });
  let out = false; for (const p of ED.def.pts) if (p.x < 120 || p.y < 120 || p.x > ED_BOX - 120 || p.y > ED_BOX - 120) out = true;
  if (out) problems.push({ type: 'out', pts: [], text: 'Resta dentro il bordo' });
  if (ED.def.pts.length < 4) problems.push({ type: 'few', pts: [], text: 'Servono almeno 4 punti' });
  return problems;
}
function edRebuild() { ED.track = buildTrack(ED.def); ED.problems = edValidate(ED.track); }
function edStars(track) { const r = track.minRadius(), len = track.center.len; return clamp(Math.round(1 + (len / 2200) + (r < 110 ? 1.5 : r < 160 ? 0.8 : 0)), 1, 5); }
function edInsertAt(wx, wy) {
  const pts = ED.def.pts, segs = 24, poly = catmullClosed(pts, segs);
  let bi = 0, bd = 1e18; poly.forEach((p, i) => { const d = (p.x - wx) ** 2 + (p.y - wy) ** 2; if (d < bd) { bd = d; bi = i; } });
  const seg = Math.floor(bi / segs);
  pts.splice(seg + 1, 0, { x: Math.round(wx), y: Math.round(wy) });
  ED.sel = seg + 1; ED.dirty = true; edRebuild();
}
function edButtons() {
  const y1 = H - 112, y2 = H - 58, bw = (W - 40) / 4;
  return {
    theme: { x: 10, y: y1, w: bw, h: 46 }, del: { x: 15 + bw, y: y1, w: bw, h: 46 }, reset: { x: 20 + bw * 2, y: y1, w: bw, h: 46 }, name: { x: 25 + bw * 3, y: y1, w: bw, h: 46 },
    save: { x: 10, y: y2, w: (W - 30) / 3, h: 48 }, test: { x: 15 + (W - 30) / 3, y: y2, w: (W - 30) / 3, h: 48 }, exit: { x: 20 + (W - 30) / 3 * 2, y: y2, w: (W - 30) / 3, h: 48 },
    trash: { x: W - 44, y: 12, w: 34, h: 30 }
  };
}
function drawEditor(g) {
  const th = THEMES[ED.def.theme], A = edArea(), z = edScale(), tr = ED.track, c = tr.center;
  g.fillStyle = '#0f1120'; g.fillRect(0, 0, W, H);
  g.fillStyle = th.ground; g.fillRect(A.x, A.y, A.w, A.h);
  // design box
  const b0 = edToScreen(0, 0), b1 = edToScreen(ED_BOX, ED_BOX);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.setLineDash([6, 6]); g.lineWidth = 1; g.strokeRect(b0.x, b0.y, b1.x - b0.x, b1.y - b0.y); g.setLineDash([]);
  g.save(); g.beginPath(); g.rect(A.x, A.y, A.w, A.h); g.clip();
  g.translate(A.x + A.w / 2, A.y + A.h / 2); g.scale(z, z); g.translate(-ED_BOX / 2, -ED_BOX / 2);
  g.lineCap = 'round'; g.lineJoin = 'round';
  tracePoly(g, c.x, c.y, c.n, 0, c.n); g.closePath();
  g.strokeStyle = SHOULDER[ED.def.theme] || 'rgba(0,0,0,0.2)'; g.lineWidth = TRACK_HALF * 2 + 14 / z; g.stroke();
  g.strokeStyle = th.asphalt; g.lineWidth = TRACK_HALF * 2; g.stroke();
  for (const lane of tr.lanes) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1 / z; tracePoly(g, lane.x, lane.y, lane.n, 0, lane.n); g.closePath(); g.stroke(); }
  for (const side of [-1, 1]) { const o = offsetPts(tr, side * (TRACK_HALF - 1)); g.strokeStyle = th.edge; g.lineWidth = 1.5 / z; tracePoly(g, o.xs, o.ys, c.n, 0, c.n); g.closePath(); g.stroke(); }
  for (const side of [-1, 1]) {
    const o = offsetPts(tr, side * (TRACK_HALF - 3));
    for (const [a, b] of runs(tr, i => Math.abs(c.k[i]) > 1 / 300, 12)) {
      g.setLineDash([]); g.strokeStyle = th.kerb[0]; g.lineWidth = 4 / z; tracePoly(g, o.xs, o.ys, c.n, a, b); g.stroke();
      g.setLineDash([7 / z, 7 / z]); g.strokeStyle = th.kerb[1]; tracePoly(g, o.xs, o.ys, c.n, a, b); g.stroke();
    }
  }
  g.setLineDash([]);
  // tight parts in red
  for (const [a, b] of runs(tr, i => Math.abs(c.k[i]) > 1 / 72, 4)) { g.strokeStyle = 'rgba(255,40,40,0.8)'; g.lineWidth = TRACK_HALF * 2 + 4 / z; tracePoly(g, c.x, c.y, c.n, a, b); g.stroke(); }
  // start line
  { const p = c, i = 0; g.save(); g.translate(p.x[i], p.y[i]); g.rotate(p.h[i]); for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#111' : '#fff'; g.fillRect(-4 / z, -TRACK_HALF + k * TRACK_HALF / 4, 8 / z, TRACK_HALF / 4); } g.restore(); }
  // spline + handles
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1 / z; g.beginPath(); ED.def.pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke();
  const badSet = new Set(); for (const pr of ED.problems) for (const i of pr.pts) badSet.add(i);
  ED.def.pts.forEach((p, i) => {
    const r = (i === ED.sel ? 14 : 11) / z;
    g.fillStyle = badSet.has(i) ? '#ff3b3b' : i === ED.sel ? '#ffd600' : '#ffffff'; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 2 / z; g.stroke();
    if (i === 0) { g.fillStyle = '#111'; g.font = 'bold ' + (12 / z) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', p.x, p.y); }
  });
  g.restore();
  // header
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, 54);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#ffd600'; g.font = '900 16px Arial Black, Arial'; g.fillText('EDITOR  ✎', 12, 18);
  g.fillStyle = '#fff'; g.font = 'bold 13px Arial'; g.fillText(ED.def.name + (ED.dirty ? ' *' : ''), 12, 39);
  g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '11px Arial';
  g.fillText(Math.round(c.len) + ' m  •  ' + ED.def.pts.length + ' punti  •  min R ' + Math.round(tr.minRadius()), W - 54, 39);
  const B = edButtons();
  if (ED.editingIdx >= 0) { g.fillStyle = 'rgba(255,80,80,0.25)'; roundRect(g, B.trash.x, B.trash.y, B.trash.w, B.trash.h, 8); g.fill(); g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '16px Arial'; g.fillText('🗑', B.trash.x + 17, B.trash.y + 16); }
  // status / problems
  g.textAlign = 'center';
  if (ED.msgT > 0) { g.fillStyle = '#5dff7a'; g.font = '900 14px Arial Black, Arial'; g.fillText(ED.msg, W / 2, A.y + 16); }
  else if (ED.problems.length) { g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, 30, A.y + 4, W - 60, 24, 8); g.fill(); g.fillStyle = '#ff6b6b'; g.font = '900 13px Arial Black, Arial'; g.fillText('⚠ ' + ED.problems.map(p => p.text).join(' • '), W / 2, A.y + 16); }
  else { g.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(g, 40, A.y + 4, W - 80, 24, 8); g.fill(); g.fillStyle = '#fff'; g.font = '11px Arial'; g.fillText('Trascina i punti • tocca la pista per aggiungerne uno', W / 2, A.y + 16); }
  // buttons
  const btn = (b, col, txt, tcol, small) => { g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, b.x, b.y + 3, b.w, b.h, 12); g.fill(); g.fillStyle = col; roundRect(g, b.x, b.y, b.w, b.h, 12); g.fill(); g.fillStyle = tcol || '#fff'; g.font = '900 ' + (small ? 12 : 16) + 'px Arial Black, Arial'; g.textAlign = 'center'; g.fillText(txt, b.x + b.w / 2, b.y + b.h / 2); };
  g.fillStyle = '#0f1120'; g.fillRect(0, H - 120, W, 120);
  btn(B.theme, '#3a6cff', 'TEMA: ' + ({ verde: 'PRATO', costa: 'MARE', notte: 'NOTTE', neve: 'NEVE', rosso: 'DESERTO' }[ED.def.theme] || '?'), '#fff', true);
  btn(B.del, ED.sel >= 0 && ED.def.pts.length > 4 ? '#d8312f' : '#444', '✕ PUNTO', '#fff', true);
  btn(B.reset, '#555', 'NUOVO', '#fff', true);
  btn(B.name, '#555', 'NOME', '#fff', true);
  btn(B.save, ED.problems.length ? '#444' : '#2fa84f', 'SALVA', ED.problems.length ? '#999' : '#073b16');
  btn(B.test, ED.problems.length ? '#444' : '#ff8a00', 'PROVA', ED.problems.length ? '#999' : '#3b1d00');
  btn(B.exit, '#555', 'ESCI');
}
function edSave() {
  if (ED.problems.length) return false;
  ED.def.stars = edStars(ED.track);
  if (ED.editingIdx >= 0) save.custom[ED.editingIdx - TRACKS.length] = JSON.parse(JSON.stringify(ED.def));
  else { save.custom.push(JSON.parse(JSON.stringify(ED.def))); ED.editingIdx = TRACKS.length + save.custom.length - 1; }
  G.thumbs[ED.editingIdx] = null; persist(); ED.dirty = false; ED.msg = 'SALVATO ✓'; ED.msgT = 1.5; Snd.lap();
  return true;
}
function edPress(x, y, id) {
  const B = edButtons();
  if (inRect(x, y, B.exit)) { G.state = 'menu'; return; }
  if (inRect(x, y, B.theme)) { const keys = Object.keys(THEMES); ED.def.theme = keys[(keys.indexOf(ED.def.theme) + 1) % keys.length]; ED.dirty = true; Snd.click(); return; }
  if (inRect(x, y, B.reset)) { const keep = ED.def; ED.def = edDefault(); ED.def.id = keep.id; ED.def.name = keep.name; ED.def.theme = keep.theme; ED.sel = -1; ED.dirty = true; edRebuild(); Snd.click(); return; }
  if (inRect(x, y, B.name)) { let nm = null; try { nm = root.prompt('Nome del circuito', ED.def.name); } catch (e) {} if (nm && nm.trim()) { ED.def.name = nm.trim().slice(0, 22); ED.dirty = true; } return; }
  if (inRect(x, y, B.del)) { if (ED.sel >= 0 && ED.def.pts.length > 4) { ED.def.pts.splice(ED.sel, 1); ED.sel = -1; ED.dirty = true; edRebuild(); Snd.click(); } return; }
  if (inRect(x, y, B.save)) { edSave(); return; }
  if (inRect(x, y, B.test)) { if (edSave()) { save.sel = ED.editingIdx; startRace(ED.editingIdx); G.fromEditor = true; } return; }
  if (ED.editingIdx >= 0 && inRect(x, y, B.trash)) {
    let ok = true; try { ok = root.confirm('Eliminare "' + ED.def.name + '"?'); } catch (e) {}
    if (ok) { save.custom.splice(ED.editingIdx - TRACKS.length, 1); G.thumbs.splice(ED.editingIdx, 1); save.sel = 0; persist(); G.state = 'menu'; }
    return;
  }
  const A = edArea(); if (!inRect(x, y, A)) return;
  const z = edScale();
  // handle?
  let hit = -1, hd = 1e9;
  ED.def.pts.forEach((p, i) => { const s = edToScreen(p.x, p.y); const d = Math.hypot(s.x - x, s.y - y); if (d < 18 && d < hd) { hd = d; hit = i; } });
  if (hit >= 0) { ED.sel = hit; ED.drag = { id, i: hit }; return; }
  // on the track? insert
  const w = edToWorld(x, y);
  if (ED.track.distToTrack(w.x, w.y) < TRACK_HALF + 10) { edInsertAt(w.x, w.y); ED.drag = { id, i: ED.sel }; return; }
  ED.sel = -1;
}
function edMove(x, y, id) {
  if (!ED.drag || ED.drag.id !== id) return;
  const w = edToWorld(x, y); const p = ED.def.pts[ED.drag.i];
  p.x = Math.round(clamp(w.x, 60, ED_BOX - 60)); p.y = Math.round(clamp(w.y, 60, ED_BOX - 60));
  ED.dirty = true; ED.track = buildTrack(ED.def);
}
function edRelease(id) { if (ED.drag && ED.drag.id === id) { ED.drag = null; ED.problems = edValidate(ED.track); } }

/* ---------------- input ---------------- */
const pointers = new Map();
function menuMaxScroll() { return Math.max(0, 156 + allTracks().length * 92 - (H - 104) + 8); }
function menuScrollTo(i) { const y = 156 + i * 92 - (G.menuScroll || 0); if (y < 150) G.menuScroll = 156 + i * 92 - 150; else if (y + 84 > H - 104) G.menuScroll = 156 + i * 92 + 84 - (H - 104); G.menuScroll = clamp(G.menuScroll || 0, 0, menuMaxScroll()); }
let menuDrag = null;
function menuDown(x, y, id) { menuDrag = { id, x, y, s0: G.menuScroll || 0, moved: false }; }
function menuMove(x, y, id) {
  if (!menuDrag || menuDrag.id !== id) return;
  if (!menuDrag.moved && Math.abs(y - menuDrag.y) > 8 && menuDrag.y > 150 && menuDrag.y < H - 104) menuDrag.moved = true;
  if (menuDrag.moved) G.menuScroll = clamp(menuDrag.s0 - (y - menuDrag.y), 0, menuMaxScroll());
}
function menuUp(x, y, id) { if (!menuDrag || menuDrag.id !== id) return; const d = menuDrag; menuDrag = null; if (!d.moved) pressAt(d.x, d.y, id); }
function canvasPos(ev) { const r = canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height }; }
function pressAt(x, y, id) {
  Snd.init(); Snd.resume();
  if (G.state === 'editor') { edPress(x, y, id); return; }
  if (G.state === 'menu') {
    const M = menuRects();
    if (inRect(x, y, M.editor)) { Snd.click(); openEditor(-1); return; }
    for (const c of M.cards) if (inRect(x, y, c)) {
      const def = allTracks()[c.i];
      if (def && def.custom && x > c.x + c.w - 52) { Snd.click(); openEditor(c.i); return; }
      save.sel = c.i; persist(); Snd.click(); return;
    }
    if (inRect(x, y, M.go)) { Snd.click(); startRace(save.sel); return; }
    if (inRect(x, y, M.laps)) { save.laps = save.laps >= 5 ? 1 : save.laps + 2; persist(); Snd.click(); return; }
    if (inRect(x, y, M.players)) { save.players = save.players % MAX_PLAYERS + 1; persist(); Snd.click(); return; }
    if (inRect(x, y, M.speed)) { save.speed = save.speed % 3 + 1; applySpeed(save.speed); persist(); Snd.click(); return; }
    if (save.players > 1 && inRect(x, y, M.ai)) { save.ai = !save.ai; persist(); Snd.click(); return; }
    if (inRect(x, y, M.mute)) { Snd.setOn(!Snd.on); save.sound = Snd.on; persist(); return; }
    return;
  }
  if (G.state === 'paused') {
    if (inRect(x, y, { x: W / 2 - 90, y: H / 2 + 40, w: 180, h: 44 })) { G.race = null; if (G.fromEditor) { G.fromEditor = false; openEditor(save.sel); } else G.state = 'menu'; return; }
    G.state = 'race'; clearInputs(); return;
  }
  if (G.state === 'result') {
    const R = resultRects();
    if (inRect(x, y, R.again)) { Snd.click(); startRace(save.sel); }
    else if (inRect(x, y, R.menu)) { Snd.click(); G.race = null; if (G.fromEditor) { G.fromEditor = false; openEditor(save.sel); } else G.state = 'menu'; }
    else if (inRect(x, y, R.share)) openShare();
    return;
  }
  if (twoP()) {
    const S = stripRects();
    if (inRect(x, y, S.mute)) { Snd.setOn(!Snd.on); save.sound = Snd.on; persist(); return; }
    if (inRect(x, y, S.back)) { pauseGame(); return; }
    const n = G.race.players.length, L = colLocal(x, y, n); if (!L) return;
    const C = colRects(n), car = G.race.players[L.pidx], inp = G.inputs[L.pidx];
    if (inRect(L.lx, L.ly, C.turbo)) { if (useTurbo(car, G.race)) handleEvents(G.race); return; }
    inp.gas = true; pointers.set(id, { p: L.pidx, b: 'gas' }); return;
  }
  const R = btnRects();
  if (inRect(x, y, R.mute)) { Snd.setOn(!Snd.on); save.sound = Snd.on; persist(); return; }
  if (inRect(x, y, R.back)) { pauseGame(); return; }
  if (inRect(x, y, R.cam)) { save.cam = save.cam === 'full' ? 'chase' : 'full'; persist(); Snd.click(); return; }
  if (inRect(x, y, R.turbo)) { if (useTurbo(G.race.player, G.race)) handleEvents(G.race); return; }
  G.input.gas = true; pointers.set(id, { p: 0, b: 'gas' });
}
function pauseGame() { G.state = 'paused'; clearInputs(); }
function clearInputs() { for (const i of G.inputs) i.gas = i.brake = false; pointers.clear(); for (const s of keys) { s.gas.clear(); s.brake.clear(); } }
function releaseId(id) {
  const b = pointers.get(id); if (!b) return; pointers.delete(id);
  let still = false; for (const v of pointers.values()) if (v.p === b.p && v.b === b.b) still = true;
  if (!still) G.inputs[b.p][b.b] = false;
}
const keys = [0, 1, 2, 3].map(() => ({ gas: new Set(), brake: new Set() }));
function pointerHeld(p, b) { for (const v of pointers.values()) if (v.p === p && v.b === b) return true; return false; }
function onKey(ev, down) {
  const k = ev.code, n = G.race ? G.race.players.length : 1;
  const single = n === 1;
  let used = false;
  for (let p = 0; p < MAX_PLAYERS; p++) {
    const K = PKEYS[p];
    // single player: every player's keys drive P1 (so W/S and arrows both work)
    const target = single ? 0 : p;
    if (!single && p >= n) break;
    if (K.gas.includes(k)) { used = true; if (down) keys[target].gas.add(k); else keys[target].gas.delete(k); }
    if (K.brake.includes(k)) { used = true; if (down) keys[target].brake.add(k); else keys[target].brake.delete(k); }
    if (K.turbo.includes(k) && down && !ev.repeat && G.state === 'race') { used = true; if (useTurbo(G.race.players[target], G.race)) handleEvents(G.race); }
  }
  if (used) ev.preventDefault();
  if (down && !ev.repeat) { Snd.init(); Snd.resume(); }
  if (G.state === 'race') {
    for (let p = 0; p < n; p++) { G.inputs[p].gas = keys[p].gas.size > 0 || pointerHeld(p, 'gas'); G.inputs[p].brake = keys[p].brake.size > 0 || pointerHeld(p, 'brake'); }
    if (down && k === 'Escape') pauseGame();
  } else if (down && !ev.repeat) {
    if (G.state === 'menu' && (k === 'Enter' || k === 'Space')) startRace(save.sel);
    else if (G.state === 'menu' && k === 'ArrowDown') { save.sel = (save.sel + 1) % allTracks().length; persist(); menuScrollTo(save.sel); }
    else if (G.state === 'menu' && k === 'ArrowUp') { save.sel = (save.sel + allTracks().length - 1) % allTracks().length; persist(); menuScrollTo(save.sel); }
    else if (G.state === 'editor' && k === 'Escape') G.state = 'menu';
    else if (G.state === 'paused' && (k === 'Escape' || k === 'Enter' || k === 'Space')) G.state = 'race';
    else if (G.state === 'result' && (k === 'Enter' || k === 'Space')) startRace(save.sel);
  }
  if (down && !ev.repeat && k === 'KeyC') { save.cam = save.cam === 'full' ? 'chase' : 'full'; persist(); }
  if (down && !ev.repeat && k === 'KeyM') { Snd.setOn(!Snd.on); save.sound = Snd.on; persist(); }
}

/* ---------------- boot ---------------- */
let last = 0, acc = 0;
const DT = 1 / 120;
function frame(ts) {
  const now = ts / 1000; let dt = Math.min(0.05, now - (last || now)); last = now;
  if (G.state === 'race' || G.state === 'result') {
    acc += dt;
    let n = 0; while (acc >= DT && n < 8) { update(DT); acc -= DT; n++; }
    if (acc >= DT) acc = 0;
  } else { G.time += dt; for (let i = 0; i < MAX_PLAYERS; i++) Snd.engine(null, false, i); }
  draw();
  requestAnimationFrame(frame);
}
function boot() {
  canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
  G.dpr = Math.min(2.5, Math.max(1, root.devicePixelRatio || 1));
  canvas.width = Math.round(W * G.dpr); canvas.height = Math.round(H * G.dpr);
  Snd.on = save.sound !== false;
  G.thumbs = TRACKS.map(def => thumbCanvas(buildTrack(def), THEMES[def.theme], 96, 68, 6));
  G.menuScroll = 0;
  canvas.addEventListener('pointerdown', ev => { ev.preventDefault(); const p = canvasPos(ev); if (G.state === 'menu') menuDown(p.x, p.y, ev.pointerId); else pressAt(p.x, p.y, ev.pointerId); });
  canvas.addEventListener('pointermove', ev => { const p = canvasPos(ev); if (G.state === 'menu') menuMove(p.x, p.y, ev.pointerId); else if (G.state === 'editor') edMove(p.x, p.y, ev.pointerId); });
  canvas.addEventListener('pointerup', ev => { ev.preventDefault(); const p = canvasPos(ev); if (G.state === 'menu') menuUp(p.x, p.y, ev.pointerId); else if (G.state === 'editor') edRelease(ev.pointerId); else releaseId(ev.pointerId); });
  canvas.addEventListener('pointercancel', ev => { menuDrag = null; edRelease(ev.pointerId); releaseId(ev.pointerId); });
  canvas.addEventListener('pointerleave', ev => { edRelease(ev.pointerId); releaseId(ev.pointerId); });
  canvas.addEventListener('wheel', ev => { if (G.state === 'menu') { G.menuScroll = clamp((G.menuScroll || 0) + ev.deltaY * 0.5, 0, menuMaxScroll()); ev.preventDefault(); } }, { passive: false });
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  root.addEventListener('keydown', ev => onKey(ev, true));
  root.addEventListener('keyup', ev => onKey(ev, false));
  root.addEventListener('blur', () => { if (G.state === 'race') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'race') pauseGame(); });
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined' && document.getElementById) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
root.Racism2 = { G, P, BASE, applySpeed, allTracks, ED, openEditor, edPress, edMove, edRelease, edSave, TRACKS, THEMES, buildTrack, newRace, stepRace, stepCar, aiControl, targetSpeed, allowedSpeed, useTurbo, startRace, update, draw, pressAt, releaseId, save, fmtTime, Snd, W, H };
})(typeof window !== 'undefined' ? window : globalThis);
