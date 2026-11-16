// 진짜? 가짜? 동굴 탈출 — 게임 로직
// bg 캔버스: 동굴(저해상도 픽셀) / fx 캔버스: 어둠 + 손전등 빛 + 손

const bg = document.getElementById("bg");
const fx = document.getElementById("fx");
const bctx = bg.getContext("2d");
const fctx = fx.getContext("2d");
const $center = document.getElementById("center");
const $card = document.getElementById("card");
const $btns = document.getElementById("btns");
const $hud = document.getElementById("hud");
const $panel = document.getElementById("panel");
const $bubble = document.getElementById("bubble");
const $pcard = document.getElementById("pcard");
const $pbtns = document.getElementById("pbtns");

const TOTAL = 10;
const QUAKE_AT = [2, 5]; // 3번째, 6번째 문제에서 지진

// 동굴 3D 설정
const SP = 10;            // 바위 고리 간격
const FOCAL = 10;         // 원근 계수
const FAR = 140;          // 보이는 최대 거리
const STEP_Z = SP * 2;    // 한 문제 맞힐 때 걷는 거리
const EXIT_Z = TOTAL * STEP_Z + SP * 2; // 출구 위치

let W = 320, H = 180, scale = 1, img, buf;

const state = {
  mode: "title",
  level: 1, qs: [], idx: 0, solved: 0, busy: false,
  camZ: 0, bob: 0,
  ambient: 0.08, targetAmbient: 0.08,
  lx: 160, ly: 80, pointerMoved: false,
  walk: null, fall: null, crack: null, quake: null, outro: null,
  shakeX: 0, fallY: 0, fallRot: 0, dark: 0, white: 0,
  bats: [], nextBat: 2, dust: [],
};

const ambientFor = (n) => 0.07 + n * 0.048;

// ───────────────────────── 화면 크기 ─────────────────────────
function resize() {
  const iw = innerWidth, ih = innerHeight;
  W = iw >= ih ? 320 : 200;
  H = Math.round((W * ih) / iw);
  scale = iw / W;
  for (const c of [bg, fx]) { c.width = W; c.height = H; }
  img = fctx.createImageData(W, H);
  buf = new Uint32Array(img.data.buffer);
  if (!state.pointerMoved) { state.lx = W / 2; state.ly = H * 0.42; }
}
addEventListener("resize", resize);
resize();

function setPointer(e) {
  state.lx = e.clientX / scale;
  state.ly = e.clientY / scale;
  state.pointerMoved = true;
}
addEventListener("pointermove", setPointer);
addEventListener("pointerdown", setPointer);

// ───────────────────────── 효과음 ─────────────────────────
let ac = null;
function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  }
  if (ac && ac.state === "suspended") ac.resume();
  return ac;
}
function tone(freq, dur, type = "square", vol = 0.05, endFreq = freq, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, cutoff = 500, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = "lowpass"; f.frequency.value = cutoff; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}
const sfx = {
  click: () => tone(520, 0.05, "square", 0.03),
  step: () => noise(0.09, 0.25, 350),
  right: () => { tone(660, 0.1, "square", 0.04); tone(990, 0.18, "square", 0.04, 990, 0.1); },
  wrong: () => tone(180, 0.35, "sawtooth", 0.05, 90),
  rumble: () => noise(0.9, 0.35, 180),
  fall: () => tone(520, 1.3, "sine", 0.08, 50),
  escape: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "square", 0.04, f, i * 0.12)),
  quake: () => { noise(2.6, 0.45, 120); noise(1.2, 0.2, 400, 0.6); },
  squeak: () => { tone(2600, 0.04, "square", 0.012, 3200); tone(2900, 0.04, "square", 0.012, 3400, 0.08); },
  sit: () => noise(0.25, 0.3, 250),
};

// ───────────────────────── 동굴 그리기 ─────────────────────────
function hash(k, i) {
  const x = Math.sin(k * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function fog(c, f, to = [10, 8, 12]) {
  const k = Math.pow(f, 0.85);
  return `rgb(${(c[0] * (1 - k) + to[0] * k) | 0},${(c[1] * (1 - k) + to[1] * k) | 0},${(c[2] * (1 - k) + to[2] * k) | 0})`;
}

const RING_N = 16;
function ringPoints(k, s, cx, cy, rx0, ry0, floorY) {
  const pts = [];
  for (let i = 0; i < RING_N; i++) {
    const a = (i / RING_N) * Math.PI * 2;
    const j = 0.82 + hash(k, i) * 0.3;
    let x = cx + Math.cos(a) * rx0 * s * j;
    let y = cy + Math.sin(a) * ry0 * s * j;
    if (y > floorY) y = floorY;
    pts.push([Math.round(x), Math.round(y), a]);
  }
  return pts;
}

function drawCave() {
  const cx = Math.round(W / 2 + state.shakeX);
  const cy = Math.round(H * 0.42 + state.bob);
  const rx0 = W * 0.6, ry0 = Math.min(H, W * 1.1) * 0.6;

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.fillStyle = "#000";
  bctx.fillRect(0, 0, W, H);

  // 추락 시 화면 전체가 위로 솟구치며 기울어짐
  if (state.fallY || state.fallRot) {
    bctx.translate(W / 2, H / 2);
    bctx.rotate(state.fallRot);
    bctx.translate(-W / 2, -H / 2 - state.fallY);
  }

  const camZ = state.camZ;
  const kNear = Math.ceil((camZ + 2) / SP);
  let kFar = Math.floor((camZ + FAR) / SP);
  const kExit = EXIT_Z / SP;
  const exitVisible = kFar >= kExit;
  if (exitVisible) {
    kFar = kExit;
    const g = bctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
    g.addColorStop(0, "#fffbe8");
    g.addColorStop(1, "#f3d98a");
    bctx.fillStyle = g;
    bctx.fillRect(-W, -H, W * 3, H * 3);
  } else {
    bctx.fillStyle = "#050407";
    bctx.fillRect(-W, -H, W * 3, H * 3);
  }

  for (let k = kFar; k >= kNear; k--) {
    const d = k * SP - camZ;
    const s = FOCAL / d;
    const f = Math.min(1, d / FAR);
    const floorY = Math.round(cy + ry0 * 0.62 * s);
    const pts = ringPoints(k, s, cx, cy, rx0, ry0, floorY);
    const warm = exitVisible ? Math.max(0, 1 - (kExit * SP - k * SP) / 60) : 0;
    const fogTo = warm > 0 ? [60 + 160 * warm, 52 + 140 * warm, 40 + 90 * warm] : [10, 8, 12];

    // 벽 (화면 전체 - 고리 안쪽)
    const base = hash(k, 99) < 0.5 ? [92, 78, 66] : [76, 66, 60];
    bctx.beginPath();
    bctx.rect(-W, -H, W * 3, H * 3);
    bctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) bctx.lineTo(pts[i][0], pts[i][1]);
    bctx.closePath();
    bctx.fillStyle = fog(base, f, fogTo);
    bctx.fill("evenodd");

    // 바닥
    bctx.fillStyle = fog(hash(k, 77) < 0.5 ? [58, 48, 40] : [52, 44, 38], f, fogTo);
    bctx.fillRect(-W, floorY, W * 3, H * 3);

    // 종유석
    bctx.fillStyle = fog([110, 96, 82], f, fogTo);
    for (let i = 0; i < pts.length; i++) {
      const [x, y, a] = pts[i];
      if (Math.sin(a) < -0.55 && hash(k, i + 40) > 0.5) {
        const w = Math.max(1, Math.round(rx0 * s * 0.05));
        const len = Math.round(ry0 * s * (0.12 + hash(k, i + 60) * 0.22));
        bctx.beginPath();
        bctx.moveTo(x - w, y); bctx.lineTo(x + w, y); bctx.lineTo(x, y + len);
        bctx.fill();
      }
    }
    // 바닥 돌
    if (hash(k, 50) > 0.45) {
      const rx = cx + (hash(k, 51) - 0.5) * rx0 * s * 1.3;
      const r = Math.max(1, rx0 * s * (0.04 + hash(k, 52) * 0.05));
      bctx.fillStyle = fog([84, 72, 62], f, fogTo);
      bctx.fillRect(Math.round(rx - r), Math.round(floorY - r), Math.round(r * 2), Math.round(r));
      bctx.fillRect(Math.round(rx - r * 0.6), Math.round(floorY - r * 1.4), Math.round(r * 1.2), Math.round(r * 0.5));
    }
  }

  // 지진 때 떨어지는 흙먼지와 돌 부스러기
  for (const d of state.dust) {
    bctx.fillStyle = d.big ? "#5a4c40" : "#8a7a66";
    bctx.fillRect(Math.round(d.x), Math.round(d.y), d.big ? 2 : 1, d.big ? 2 : 1);
  }

  // 발밑이 갈라지는 금
  if (state.crack) {
    bctx.strokeStyle = "#000";
    bctx.lineWidth = 1;
    for (const line of state.crack) {
      bctx.beginPath();
      bctx.moveTo(line[0][0] * W, line[0][1] * H);
      for (let i = 1; i < line.length; i++) bctx.lineTo(line[i][0] * W, line[i][1] * H);
      bctx.stroke();
    }
  }
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBats();

  return { cx, cy, exitD: EXIT_Z - camZ, rx0 };
}

// ───────────────────────── 박쥐 ─────────────────────────
const BAT_UP = ["x.......x", ".xx...xx.", "..xxxxx..", "...x.x..."];
const BAT_DOWN = ["...xxx...", ".xxxxxxx.", "xx.x.x.xx", "x.......x"];

function spawnBat(fast = false) {
  const fromLeft = Math.random() < 0.5;
  const size = Math.random() < 0.3 ? 2 : 1;
  state.bats.push({
    x: fromLeft ? -12 : W + 12,
    vx: (fromLeft ? 1 : -1) * (fast ? 90 + Math.random() * 60 : 45 + Math.random() * 35),
    baseY: H * (0.08 + Math.random() * 0.35),
    amp: 4 + Math.random() * 8,
    phase: Math.random() * 10,
    size,
  });
}

function updateBats(dt, time) {
  if (!state.outro && state.mode !== "over") {
    state.nextBat -= dt;
    if (state.nextBat <= 0) {
      const n = Math.random() < 0.35 ? 3 : 1;
      for (let i = 0; i < n; i++) spawnBat();
      if (state.mode === "play") sfx.squeak();
      state.nextBat = 4 + Math.random() * 6;
    }
  }
  for (const b of state.bats) {
    b.x += b.vx * dt;
    b.y = b.baseY + Math.sin(time * 3 + b.phase) * b.amp;
  }
  state.bats = state.bats.filter((b) => b.x > -20 && b.x < W + 20);
}

function drawBats() {
  const time = performance.now() / 1000;
  bctx.fillStyle = "#2a2028";
  for (const b of state.bats) {
    const sprite = Math.floor(time * 9 + b.phase) % 2 ? BAT_UP : BAT_DOWN;
    const s = b.size, ox = Math.round(b.x - 4 * s), oy = Math.round(b.y - 2 * s);
    for (let r = 0; r < sprite.length; r++)
      for (let c = 0; c < sprite[r].length; c++)
        if (sprite[r][c] === "x") bctx.fillRect(ox + c * s, oy + r * s, s, s);
  }
}

// 어둠 속에서도 보이는 빨간 눈
function drawBatEyes() {
  fctx.fillStyle = "#ff3a2a";
  for (const b of state.bats) {
    const s = b.size, ox = Math.round(b.x - 4 * s), oy = Math.round(b.y - 2 * s);
    fctx.fillRect(ox + 3 * s, oy + 2 * s, s, s);
    fctx.fillRect(ox + 5 * s, oy + 2 * s, s, s);
  }
}

// ───────────────────────── 지진 ─────────────────────────
function startQuake() {
  state.quake = { t0: performance.now(), dur: 2800 };
  $center.classList.add("quake");
  sfx.quake();
  for (let i = 0; i < 6; i++) spawnBat(true);
  setTimeout(sfx.squeak, 200);
}

function updateQuake(now, dt) {
  const q = state.quake;
  if (q) {
    const p = (now - q.t0) / q.dur;
    if (p >= 1 || state.mode !== "play") {
      state.quake = null;
      state.shakeX = 0; state.bob = 0;
      $center.classList.remove("quake");
    } else {
      const amp = Math.sin(p * Math.PI) * 4 * (1 + 0.5 * Math.sin(p * 40));
      state.shakeX = (Math.random() - 0.5) * amp * 2;
      state.bob = (Math.random() - 0.5) * amp;
      const n = Math.random() < amp / 4 ? 3 : 1;
      for (let i = 0; i < n; i++)
        state.dust.push({ x: Math.random() * W, y: -2, vy: 30 + Math.random() * 60, big: Math.random() < 0.2 });
    }
  }
  for (const d of state.dust) { d.y += d.vy * dt; d.vy += 120 * dt; }
  state.dust = state.dust.filter((d) => d.y < H + 4);
}

// ───────────────────────── 탈출 장면 (3인칭) ─────────────────────────
// 갈색 탐험복 + 페도라 모자
const HERO_PAL = {
  a: "#6b4421", A: "#4e2f15", h: "#3a2414", s: "#e0a878", e: "#1a1010",
  c: "#8a5a30", d: "#6e4524", b: "#3a2414", p: "#a8905e", k: "#3a2414", l: "#8a8a96", y: "#fff4b0",
};
const HERO_STAND = [
  "...aaaa...",
  "..aaaaaa..",
  "AAAAAAAAAA",
  "..hssssh..",
  "..sesses..",
  "..ssssss..",
  "...ssss...",
  ".ccbccccc.",
  "cccdbccccc",
  "sc.ccbc.cs",
  "s..ccccb.l",
  "...cccc..y",
  "...pppp...",
  "...p..p...",
  "...p..p...",
  "..kk..kk..",
];
const HERO_SIT = [
  "...aaaa...",
  "..aaaaaa..",
  "AAAAAAAAAA",
  "..hssssh..",
  "..sesses..",
  "..ssssss..",
  ".cccbcccc.",
  "cccccbcccc",
  "sccccbcccs",
  "pppppppppp",
  "kpp....ppk",
];

function drawSprite(ctx, rows, pal, x, bottomY, s) {
  const top = bottomY - rows.length * s;
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const col = pal[rows[r][c]];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x + c * s, top + r * s, s, s); }
    }
}

const COLLAPSE_AT = 1.8;   // 무너지기 시작
const COLLAPSE_DUR = 2.2;
const SIT_AT = 4.3;        // 주저앉기

function drawOutro(now) {
  const o = state.outro;
  const t = (now - o.t0) / 1000;
  const ctx = bctx;
  const groundY = Math.round(H * 0.8);
  const cx = Math.round(W / 2);
  const cp = Math.min(1, Math.max(0, (t - COLLAPSE_AT) / COLLAPSE_DUR));

  if (o.stage === 0 && t >= COLLAPSE_AT) { o.stage = 1; sfx.quake(); }
  if (o.stage === 1 && t >= SIT_AT) { o.stage = 2; sfx.sit(); }

  // 동굴 입구에서 뒤로 빠지며 3인칭으로 전환되는 카메라 + 붕괴 진동
  const zoom = 1 + 2.2 * Math.pow(Math.max(0, 1 - t / 1.6), 2);
  const shaking = t > COLLAPSE_AT && t < COLLAPSE_AT + COLLAPSE_DUR + 0.3;
  const sx = shaking ? Math.round((Math.random() - 0.5) * 4 * (1 - cp * 0.6)) : 0;
  const sy = shaking ? Math.round((Math.random() - 0.5) * 3 * (1 - cp * 0.6)) : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cx + sx, groundY - 20 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -(groundY - 20));

  // 저녁 노을 하늘
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#241c44");
  sky.addColorStop(0.45, "#7a3a62");
  sky.addColorStop(0.8, "#d8664a");
  sky.addColorStop(1, "#f2a050");
  ctx.fillStyle = sky;
  ctx.fillRect(-W, -H, W * 3, H * 3);
  // 별 몇 개
  ctx.fillStyle = "#e8d8f0";
  for (let i = 0; i < 14; i++) {
    if (Math.sin(t * 2 + i) > 0.2) ctx.fillRect(Math.round(hash(i, 1) * W), Math.round(hash(i, 2) * H * 0.25), 1, 1);
  }
  // 지는 해
  const sunX = Math.round(W * 0.8), sunY = groundY - 16;
  ctx.fillStyle = "rgba(255,170,90,0.35)";
  ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff8a3c";
  ctx.beginPath(); ctx.arc(sunX, sunY, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffc46a";
  ctx.beginPath(); ctx.arc(sunX, sunY, 8, 0, Math.PI * 2); ctx.fill();

  // 노을 구름
  for (let i = 0; i < 3; i++) {
    const x = Math.round(((i * 120 + t * (5 + i * 2)) % (W + 60)) - 40);
    const y = Math.round(H * (0.14 + i * 0.09));
    ctx.fillStyle = i === 2 ? "#f0906a" : "#b85a74";
    ctx.fillRect(x, y, 32, 4); ctx.fillRect(x + 6, y - 3, 16, 3);
  }

  // 먼 언덕 (실루엣)
  ctx.fillStyle = "#3e2c44";
  for (let x = -W; x < W * 2; x += 2) {
    const y = groundY - 18 - Math.round(Math.sin(x * 0.03) * 8 + Math.sin(x * 0.011) * 10);
    ctx.fillRect(x, y, 2, groundY - y);
  }

  // 바위산
  const mw = Math.min(W * 0.75, 260), mh = Math.min(H * 0.62, groundY - 10);
  ctx.fillStyle = "#4a3836";
  ctx.beginPath();
  ctx.moveTo(cx - mw / 2, groundY);
  ctx.lineTo(cx - mw * 0.32, groundY - mh * 0.6);
  ctx.lineTo(cx - mw * 0.12, groundY - mh * 0.92);
  ctx.lineTo(cx + mw * 0.05, groundY - mh);
  ctx.lineTo(cx + mw * 0.25, groundY - mh * 0.75);
  ctx.lineTo(cx + mw / 2, groundY);
  ctx.closePath();
  ctx.fill();
  // 노을빛이 닿는 오른쪽 면
  ctx.fillStyle = "#7a4a3e";
  ctx.beginPath();
  ctx.moveTo(cx + mw * 0.05, groundY - mh);
  ctx.lineTo(cx + mw * 0.25, groundY - mh * 0.75);
  ctx.lineTo(cx + mw / 2, groundY);
  ctx.lineTo(cx + mw * 0.3, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5c4440";
  for (let i = 0; i < 14; i++) {
    const rx = cx + (hash(i, 3) - 0.5) * mw * 0.7, ry = groundY - hash(i, 4) * mh * 0.75;
    ctx.fillRect(Math.round(rx), Math.round(ry), 6, 3);
  }

  // 동굴 입구 → 무너져 막힘
  const aw = Math.round(mw * 0.16), ah = Math.round(mh * 0.42);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, groundY, aw, ah, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#120d10";
  ctx.fill();
  ctx.clip();
  const pileTop = groundY - Math.round(ah * 1.05 * cp);
  ctx.fillStyle = "#3a2c2a";
  ctx.fillRect(cx - aw, pileTop, aw * 2, groundY - pileTop);
  ctx.fillStyle = "#5a4642";
  for (let i = 0; i < 30; i++) {
    const ry = groundY - hash(i, 8) * ah * 1.05;
    if (ry < pileTop) continue;
    ctx.fillRect(Math.round(cx + (hash(i, 7) - 0.5) * aw * 2), Math.round(ry), 4 + Math.round(hash(i, 6) * 5), 3);
  }
  ctx.restore();

  // 떨어지는 바위
  if (t > COLLAPSE_AT) {
    for (let i = 0; i < 12; i++) {
      const ti = COLLAPSE_AT + i * 0.17;
      const ft = t - ti;
      if (ft < 0) continue;
      const startY = groundY - ah - 12 - hash(i, 11) * 20;
      const y = startY + ft * ft * 260;
      if (y > Math.max(pileTop, groundY - ah * 0.2)) continue;
      const r = 2 + Math.round(hash(i, 12) * 4);
      ctx.fillStyle = i % 2 ? "#5a4642" : "#6e5650";
      ctx.fillRect(Math.round(cx + (hash(i, 9) - 0.5) * aw * 1.6) - r, Math.round(y) - r, r * 2, r * 2);
    }
  }

  // 땅
  ctx.fillStyle = "#34402c";
  ctx.fillRect(-W, groundY, W * 3, H);
  ctx.fillStyle = "#2a3424";
  for (let x = -W; x < W * 2; x += 6) ctx.fillRect(x + (x % 4), groundY + 3 + ((x * 7) % 9), 2, 1);
  ctx.fillStyle = "#6a4e3c";
  ctx.beginPath();
  ctx.moveTo(cx - aw * 0.8, groundY);
  ctx.lineTo(cx + aw * 0.8, groundY);
  ctx.lineTo(cx + aw * 1.6, H + 2);
  ctx.lineTo(cx - aw * 1.6, H + 2);
  ctx.closePath();
  ctx.fill();

  // 흙먼지 구름
  if (t > COLLAPSE_AT + 0.4) {
    const dt2 = t - COLLAPSE_AT - 0.4;
    const fade = Math.max(0, 1 - dt2 / 3.2);
    for (let i = 0; i < 16; i++) {
      const ang = Math.PI + (i / 15) * Math.PI;
      const dist = aw * (0.4 + dt2 * (0.6 + hash(i, 14) * 0.6));
      const px = cx + Math.cos(ang) * dist;
      const py = groundY - 4 + Math.sin(ang) * dist * 0.35;
      const sz = Math.round(4 + dt2 * 5 + hash(i, 15) * 4);
      ctx.fillStyle = `rgba(150,118,104,${0.55 * fade})`;
      ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
    }
  }

  // 주인공: 서 있다가 무너진 뒤 털썩 주저앉음
  const s = 2;
  const sitting = t >= SIT_AT;
  const heroBottom = groundY + 14;
  const rows = sitting ? HERO_SIT : HERO_STAND;
  const tremble = !sitting && shaking ? Math.round(Math.random() - 0.5) : 0;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(cx - 12, heroBottom - 1, 24, 2);
  drawSprite(ctx, rows, HERO_PAL, cx - 5 * s + tremble, heroBottom, s);
  if (sitting) {
    // 내려놓은 손전등
    ctx.fillStyle = HERO_PAL.l; ctx.fillRect(cx + 14, heroBottom - 3, 6, 2);
    ctx.fillStyle = HERO_PAL.y; ctx.fillRect(cx + 20, heroBottom - 3, 2, 2);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 말풍선
  if (sitting) {
    const topY = heroBottom - rows.length * s;
    $bubble.hidden = false;
    $bubble.style.left = `${cx * scale}px`;
    $bubble.style.top = `${(topY - 6) * scale}px`;
  }
}

// ───────────────────────── 어둠 + 손전등 ─────────────────────────
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
const DARK_RGB = [6, 5, 10];
const ALPHAS = [0, 72, 145, 210, 252];
const DARK_PX = ALPHAS.map((a) => ((a << 24) | (DARK_RGB[2] << 16) | (DARK_RGB[1] << 8) | DARK_RGB[0]) >>> 0);

function handGeometry(time) {
  const bx = W * (W > H ? 0.8 : 0.85), by = H + 8;
  const dx = state.lx - bx, dy = state.ly - by;
  const len = Math.hypot(dx, dy) || 1;
  const reach = Math.min(W, H) * (W > H ? 0.42 : 0.3);
  const ux = dx / len, uy = dy / len;
  const sway = Math.sin(time * 1.7) * 0.8 + state.bob * 0.6;
  return { bx, by: by + sway, ux, uy, reach, lensX: bx + ux * reach, lensY: by + sway + uy * reach };
}

function drawFx(time, cave) {
  const amb = Math.min(1, state.ambient);
  const flick = 1 + 0.015 * Math.sin(time * 13) + 0.01 * Math.sin(time * 37);
  const R = Math.min(W, H) * 0.43 * flick;
  const R2 = R * R;
  const lx = state.lx, ly = state.ly;
  const hand = handGeometry(time);

  // 출구 빛
  let er = 0;
  if (cave.exitD < FAR && state.dark < 1) er = (FOCAL / Math.max(1, cave.exitD)) * cave.rx0 * 0.9;
  const er2x2 = (er * 2) * (er * 2);
  const ecx = cave.cx, ecy = cave.cy - state.fallY;

  const dark = state.dark;
  for (let y = 0; y < H; y++) {
    const by = (y & 3) * 4;
    const dy = (y - ly) * 1.1;
    const dy2 = dy * dy;
    const hy = y - hand.lensY;
    const ey = y - ecy;
    for (let x = 0; x < W; x++) {
      let L = amb;
      const dx = x - lx;
      const d2 = dx * dx + dy2;
      if (d2 < R2) {
        let b = 1 - Math.sqrt(d2) / R;
        b = b * b * (3 - 2 * b);
        L += b * (1 - L);
      }
      const hx = x - hand.lensX;
      const h2 = hx * hx + hy * hy;
      if (h2 < 196) L += (1 - Math.sqrt(h2) / 14) * 0.5 * (1 - L);
      if (er > 0) {
        const ex = x - ecx;
        const e2 = ex * ex + ey * ey;
        if (e2 < er2x2) L += Math.min(1, 2 - Math.sqrt(e2) / er) * (1 - L);
      }
      let a = 1 - L;
      if (a < dark) a = dark;
      const q = Math.min(4, Math.floor(a * 4 + BAYER[by + (x & 3)]));
      buf[y * W + x] = DARK_PX[q];
    }
  }
  fctx.putImageData(img, 0, 0);
  if (amb < 0.5 && state.dark < 0.9) drawBatEyes();

  if (state.white > 0) {
    fctx.fillStyle = `rgba(255,248,225,${state.white})`;
    fctx.fillRect(0, 0, W, H);
  }

  if (state.dark < 0.98) drawHand(hand);
}

// 픽셀 덩어리를 이어 붙여 그리는 팔과 손전등
function blob(x0, y0, ux, uy, from, to, r, color) {
  fctx.fillStyle = color;
  for (let t = from; t <= to; t += 1) {
    const x = Math.round(x0 + ux * t), y = Math.round(y0 + uy * t);
    fctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function drawHand(h) {
  const { bx, by, ux, uy, reach } = h;
  const fall = state.fallY * 0.3;
  const y0 = by + fall;
  const lit = Math.min(1, state.ambient + 0.35);
  const c = (r, g, b) => `rgb(${(r * lit) | 0},${(g * lit) | 0},${(b * lit) | 0})`;
  blob(bx, y0, ux, uy, 0, reach * 0.55, 6, c(112, 74, 40));         // 소매 (갈색 탐험복)
  blob(bx, y0, ux, uy, reach * 0.5, reach * 0.66, 5, c(214, 160, 116)); // 손
  blob(bx, y0, ux, uy, reach * 0.6, reach * 0.9, 3, c(96, 96, 110));   // 손전등 몸통
  blob(bx, y0, ux, uy, reach * 0.88, reach * 0.98, 4, c(150, 150, 165)); // 머리
  fctx.fillStyle = "#fff4b8";
  const lxp = Math.round(bx + ux * reach), lyp = Math.round(y0 + uy * reach);
  fctx.fillRect(lxp - 2, lyp - 2, 4, 4);
}

// ───────────────────────── 화면(UI) ─────────────────────────
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function woodButton(label, onClick, sub, extra = "") {
  const b = el("button", "wood " + extra, label + (sub ? `<small>${sub}</small>` : ""));
  b.addEventListener("click", (e) => { e.stopPropagation(); audio(); sfx.click(); onClick(); });
  return b;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tf = (v) => (v ? "O" : "X");

function setCard(html) {
  $card.innerHTML = html;
  $card.style.animation = "none";
  void $card.offsetWidth;
  $card.style.animation = "";
}
function setButtons(...buttons) {
  $btns.replaceChildren(...buttons);
}

function updateHud() {
  $hud.hidden = state.mode === "title";
  $hud.replaceChildren(el("span", "lab", `${state.level}단계`));
  for (let i = 0; i < TOTAL; i++) $hud.append(el("span", "dot" + (i < state.solved ? " on" : "")));
}

function showTitle() {
  resetScene();
  state.mode = "title";
  state.camZ = 0;
  state.targetAmbient = 0.08;
  $panel.hidden = true;
  $center.classList.remove("away");
  updateHud();
  setCard(`
    <div class="tag">어두운 동굴 속, 낡은 종이 한 장</div>
    <h1>진짜? 가짜?</h1>
    <p>손전등으로 종이를 비추면 역사 문제가 보인다.<br>
    맞으면 O, 틀리면 X! 맞히면 한 걸음 앞으로,<br>틀리면… 발밑이 무너진다.</p>
    <p>${TOTAL}문제를 모두 맞히고 동굴을 탈출하라!</p>
    <p class="tag" style="margin-top:12px">단계를 고르시오</p>`);
  setButtons(...[1, 2, 3, 4, 5].map((lv) => woodButton(`${lv}단계`, () => startGame(lv), null, "lv")));
}

function resetScene() {
  Object.assign(state, {
    walk: null, fall: null, crack: null, quake: null, outro: null, dust: [],
    shakeX: 0, fallY: 0, fallRot: 0, dark: 0, white: 0, bob: 0, busy: false,
  });
  $center.classList.remove("quake");
  $panel.classList.remove("top");
  $bubble.hidden = true;
}

function startGame(level) {
  resetScene();
  Object.assign(state, { mode: "play", level, qs: pickQuestions(level, TOTAL), idx: 0, solved: 0, camZ: 0 });  state.targetAmbient = ambientFor(0);
  $panel.hidden = true;
  updateHud();
  showQuestion();
}

function showQuestion() {
  const q = state.qs[state.idx];
  state.busy = false;
  $center.classList.remove("away");
  setCard(`
    <div class="tag">제 ${state.idx + 1} 문 · ${esc(q.era)}</div>
    <div class="q">${esc(q.q)}</div>`);
  setButtons(woodButton("O", () => answer(true), null, "ox"), woodButton("X", () => answer(false), null, "ox"));
  if (QUAKE_AT.includes(state.idx)) setTimeout(() => { if (state.mode === "play" && !state.busy) startQuake(); }, 700);
}

function answer(v) {
  if (state.busy || state.mode !== "play") return;
  state.busy = true;
  const q = state.qs[state.idx];
  if (v === q.answer) {
    sfx.right();
    setCard(`
      <h2 class="ok">정답! ${tf(q.answer)}</h2>
      <div class="ex">${esc(q.explain)}</div>`);
    setButtons(woodButton("다음으로 ▶", walkForward));
  } else {
    sfx.wrong();
    setCard(`
      <h2 class="ng">틀렸다… 정답은 ${tf(q.answer)}</h2>
      <div class="ex">${esc(q.explain)}</div>`);
    setButtons();
    setTimeout(startFall, 1800);
  }
}

function walkForward() {
  state.solved++;
  updateHud();
  $center.classList.add("away");
  const done = state.solved >= TOTAL;
  state.targetAmbient = done ? 1 : ambientFor(state.solved);
  state.walk = {
    from: state.camZ,
    to: done ? EXIT_Z - 1.5 : state.camZ + STEP_Z,
    t0: performance.now(),
    dur: done ? 3600 : 1600,
    steps: done ? 8 : 4,
    lastStep: -1,
    done: () => {
      if (done) return escape();
      state.idx++;
      showQuestion();
    },
  };
}

function startFall() {
  state.mode = "falling";
  $center.classList.add("away");
  const lines = [];
  for (let n = 0; n < 5; n++) {
    let x = 0.5 + (Math.random() - 0.5) * 0.2, y = 1.0;
    const line = [[x, y]];
    const dir = (n - 2) * 0.12;
    for (let i = 0; i < 6; i++) {
      x += dir + (Math.random() - 0.5) * 0.08;
      y -= 0.04 + Math.random() * 0.03;
      line.push([x, y]);
    }
    lines.push(line);
  }
  state.crack = lines;
  state.fall = { t0: performance.now(), stage: 0 };
  sfx.rumble();
}

function gameOver() {
  state.mode = "over";
  const q = state.qs[state.idx];  $pcard.innerHTML = `
    <div class="tag">${state.level}단계</div>
    <h1 class="ng">추락했다…</h1>
    <p>${state.solved} / ${TOTAL} 문제 통과</p>
    <p class="tag" style="margin-top:14px">제 ${state.idx + 1} 문 · ${esc(q.era)}</p>
    <div class="q" style="font-size:17px">${esc(q.q)}</div>
    <div class="ex"><b>정답: ${tf(q.answer)}</b> — ${esc(q.explain)}</div>`;
  $pbtns.replaceChildren(
    woodButton("다시 도전", () => startGame(state.level)),
    woodButton("단계 선택", showTitle),
  );
  $panel.hidden = false;
}

function escape() {
  state.mode = "escaped";  sfx.escape();
  state.white = 1;
  state.bats = [];
  $center.classList.add("away");
  state.outro = { t0: performance.now(), stage: 0 };
  setTimeout(() => { if (state.outro) showEscapePanel(); }, 5600);
}

function showEscapePanel() {
  const next = state.level < 5;
  $pcard.innerHTML = `
    <div class="tag">${state.level}단계</div>
    <h1 class="ok">탈출 성공!</h1>
    <p>${TOTAL}문제를 모두 맞히고 동굴 밖으로 나왔다.</p>
    <p>${next ? "더 깊은 동굴에 도전해 볼까?" : "한국사 1급 동굴까지 정복했다!"}</p>`;
  const btns = [];
  if (next) btns.push(woodButton(`${state.level + 1}단계 도전`, () => startGame(state.level + 1)));
  btns.push(woodButton("다시 하기", () => startGame(state.level)), woodButton("단계 선택", showTitle));
  $pbtns.replaceChildren(...btns);
  $panel.classList.add("top");
  $panel.hidden = false;
  updateHud();
}

addEventListener("keydown", (e) => {
  if (state.mode !== "play" || state.busy) return;
  const k = e.key.toLowerCase();
  if (k === "o" || k === "arrowleft") answer(true);
  if (k === "x" || k === "arrowright") answer(false);
});

// ───────────────────────── 메인 루프 ─────────────────────────
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;

  state.ambient += (state.targetAmbient - state.ambient) * Math.min(1, dt * 1.5);
  if (state.white > 0) state.white = Math.max(0, state.white - dt * 0.6);

  // 걷기: 앞으로 이동 + 머리 흔들림 + 발소리
  const w = state.walk;
  if (w) {
    const p = Math.min(1, (now - w.t0) / w.dur);
    state.camZ = w.from + (w.to - w.from) * ease(p);
    const phase = p * w.steps;
    state.bob = -Math.abs(Math.sin(phase * Math.PI)) * 4;
    const stepIdx = Math.floor(phase + 0.5);
    if (stepIdx !== w.lastStep && stepIdx < w.steps) { w.lastStep = stepIdx; sfx.step(); }
    if (p >= 1) { state.walk = null; state.bob = 0; w.done(); }
  }

  // 추락: 흔들림 → 아래로 떨어짐 → 암전
  const f = state.fall;
  if (f) {
    const t = (now - f.t0) / 1000;
    if (t < 0.8) {
      state.shakeX = (Math.random() - 0.5) * 4 * Math.min(1, t * 3);
      state.bob = (Math.random() - 0.5) * 3;
    } else {
      if (f.stage === 0) { f.stage = 1; sfx.fall(); state.crack = null; }
      const p = Math.min(1, (t - 0.8) / 1.4);
      state.shakeX = 0; state.bob = 0;
      state.fallY = p * p * H * 1.6;
      state.fallRot = p * 0.35;
      state.dark = Math.min(1, p * 1.1);
      if (p >= 1) { state.fall = null; gameOver(); }
    }
  }

  updateBats(dt, time);
  updateQuake(now, dt);

  if (state.outro) {
    drawOutro(now);
    fctx.clearRect(0, 0, W, H);
    if (state.white > 0) {
      fctx.fillStyle = `rgba(255,248,225,${state.white})`;
      fctx.fillRect(0, 0, W, H);
    }
  } else {
    const cave = drawCave();
    drawFx(time, cave);
  }
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
