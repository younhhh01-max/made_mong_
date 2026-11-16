'use strict';
/* =========================================================
   직관메이트 - 야구 직관 + 지역 관광 프로토타입
   ========================================================= */

// ---------- utils ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDate = s => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };
const fmtFull = s => { const d = parse(s); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} (${DOW[d.getDay()]})`; };
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const hm = m => { m = Math.round(m); const day = Math.floor(m / 1440); const r = ((m % 1440) + 1440) % 1440; return (day > 0 ? '익일 ' : '') + `${pad2(Math.floor(r / 60))}:${pad2(r % 60)}`; };
const r5 = m => Math.round(m / 5) * 5;
const r100 = n => Math.round(n / 100) * 100;
const uid = () => Math.random().toString(36).slice(2, 9);
const TODAY = ymd(new Date());
const team = id => TEAMS.find(t => t.id === id);
function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
function rng(seed) { let a = typeof seed === 'string' ? hash(seed) : seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function distKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const ballSVG = (cls = '') => `<svg class="${cls}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#fff" stroke="#e9ece9" stroke-width="3"/><path d="M24 12 C42 34 42 66 24 88" fill="none" stroke="#E63946" stroke-width="4" stroke-dasharray="5 4"/><path d="M76 12 C58 34 58 66 76 88" fill="none" stroke="#E63946" stroke-width="4" stroke-dasharray="5 4"/></svg>`;
const FRIEND_NAMES = ['민지', '서연', '하은', '지우', '수아', '예린', '채원'];
const FAMILY_NAMES = ['엄마', '아빠', '언니', '동생', '이모', '삼촌', '할머니'];
const AVATARS = ['🐰', '🐻', '🐱', '🐶', '🦊', '🐼', '🐨', '🐹'];

// ---------- state ----------
const STORE = 'jikgwan-mate-v1';
const DEFAULT = {
  team: null, nickname: '', region: '서울', address: '',
  records: [], bookings: [], groups: [],
  tving: { plan: 'premium', partyType: 'team', joined: false, useCoupon: false },
};
function load() { try { return Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { return structuredClone(DEFAULT); } }
let S = load();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { } };
const UI = { route: 'home', params: {}, ob: 1, obTeam: null, calMonth: null, selDate: null, plan: null, planMonth: null, sheet: null, groupTab: 'route', recapTheme: 'grass', lastStamp: null };

// ---------- schedule (샘플 일정 자동 생성) ----------
let SCHED = [];
function buildSchedule(teamId) {
  const r = rng('sch-' + teamId);
  const others = TEAMS.filter(t => t.id !== teamId).map(t => t.id);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const start = parse(addDays(TODAY, -42));
  while (start.getDay() !== 2) start.setDate(start.getDate() - 1); // 화요일부터
  const games = []; let s = 0; let cur = ymd(start); const end = addDays(TODAY, 100);
  while (cur <= end) {
    for (const len of [3, 3]) { // 화~목, 금~일 3연전
      const opp = others[s % others.length]; const home = r() < 0.55; const sid = 's' + s;
      for (let k = 0; k < len; k++) {
        const date = addDays(cur, k); const dow = parse(date).getDay();
        const time = dow === 0 ? '14:00' : dow === 6 ? '17:00' : '18:30';
        const g = { id: date, date, dow, opp, home, venue: home ? team(teamId).venue : team(opp).venue, time, sid, idx: k };
        if (date < TODAY) {
          const rr = rng('res-' + teamId + date);
          g.my = Math.floor(rr() * 10); g.op = Math.floor(rr() * 9); if (rr() < 0.06) g.op = g.my;
          g.result = g.my > g.op ? 'W' : g.my < g.op ? 'L' : 'D';
        }
        games.push(g);
      }
      cur = addDays(cur, len); s++;
    }
    cur = addDays(cur, 1); // 월요일 휴식
  }
  return games;
}
const refreshSched = () => { SCHED = S.team ? buildSchedule(S.team) : []; if (S.team) document.documentElement.style.setProperty('--team', team(S.team).color); };
const gameById = id => SCHED.find(g => g.id === id);
const nextGame = () => SCHED.find(g => g.date >= TODAY);
const seriesOf = g => SCHED.filter(x => x.sid === g.sid);

// ---------- stats / rewards ----------
function stats() {
  const rs = S.records.filter(r => r.myTeam === S.team);
  const w = rs.filter(r => r.result === 'W').length, l = rs.filter(r => r.result === 'L').length, d = rs.filter(r => r.result === 'D').length;
  return { n: rs.length, w, l, d, rate: w + l ? Math.round(w / (w + l) * 100) : 0 };
}
const unlocked = id => stats().w >= REWARDS.find(r => r.id === id).wins;
const nextReward = () => REWARDS.find(r => r.wins > stats().w);

// ---------- weather ----------
const WX_CACHE = {};
const WMO = c => c === 0 ? ['☀️', '맑음'] : c <= 2 ? ['🌤️', '구름 조금'] : c === 3 ? ['☁️', '흐림'] : c <= 48 ? ['🌫️', '안개'] : c <= 57 ? ['🌦️', '이슬비'] : c <= 67 ? ['🌧️', '비'] : c <= 77 ? ['❄️', '눈'] : c <= 82 ? ['🌦️', '소나기'] : ['⛈️', '뇌우'];
async function getWeather(venueKey, date, time) {
  const key = venueKey + date;
  if (WX_CACHE[key]) return WX_CACHE[key];
  const v = VENUES[venueKey]; const diff = daysBetween(TODAY, date); let wx = null;
  if (diff >= 0 && diff <= 15) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${v.lat}&longitude=${v.lng}&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Asia%2FSeoul&start_date=${date}&end_date=${date}`;
      const j = await (await fetch(url)).json();
      const h = parseInt(time, 10);
      wx = { code: j.hourly.weather_code[h], temp: Math.round(j.hourly.temperature_2m[h]), max: Math.round(j.daily.temperature_2m_max[0]), min: Math.round(j.daily.temperature_2m_min[0]), rain: j.daily.precipitation_probability_max[0] ?? 0, live: true };
    } catch (e) { wx = null; }
  }
  if (!wx) {
    const r = rng('wx' + key); const m = parse(date).getMonth();
    const avg = [-1, 2, 7, 13, 18, 22, 25, 26, 22, 15, 8, 1][m];
    const code = [0, 0, 1, 2, 3, 61][Math.floor(r() * 6)];
    const max = Math.round(avg + 4 + r() * 3);
    wx = { code, max, min: max - 7 - Math.round(r() * 3), temp: max - 2, rain: code === 61 ? 60 + Math.round(r() * 30) : Math.round(r() * 30), live: false };
  }
  WX_CACHE[key] = wx; return wx;
}
function wxTip(wx, dome) {
  if (dome) return '🏟️ 돔구장이라 비 걱정 NO! 실내라 가벼운 겉옷이면 충분해요';
  if (wx.rain >= 60) return '☔ 우천 취소 가능성 있어요! 우비 & 방수팩 꼭 챙기기';
  if (wx.temp <= 10) return '🧣 저녁엔 꽤 쌀쌀해요. 담요 & 핫팩 필수!';
  if (wx.max >= 29) return '🧴 햇빛 쨍쨍! 선크림 · 쿨토시 · 휴대용 선풍기';
  return '😊 직관하기 딱 좋은 날씨예요! 유니폼 입고 출발~';
}

// ---------- transport / route / stay ----------
const regionOf = name => REGIONS.find(r => r.name === name) || REGIONS[0];
function travelOptions(regionName, venueKey, people) {
  const o = typeof regionName === 'string' ? regionOf(regionName) : regionName, v = VENUES[venueKey]; const d = distKm(o, v);
  const cars = Math.ceil(people / 4);
  if (d < 45) {
    return [
      { mode: 'subway', label: '지하철·버스', emoji: '🚇', dur: Math.round(25 + d * 2.2), unit: 1550 + (d > 20 ? 900 : 0), per: 'person', desc: '교통카드로 간편하게' },
      { mode: 'taxi', label: '택시', emoji: '🚕', dur: Math.round(15 + d * 1.8), unit: r100(4800 + d * 1.3 * 1000), per: 'car', desc: `${cars}대 기준 · 4명까지 1대` },
      { mode: 'car', label: '자차', emoji: '🚗', dur: Math.round(15 + d * 1.8), unit: r100(d * 1.3 * 180 + 5000), per: 'car', desc: '유류비 + 주차비 예상' },
    ].map(x => ({ ...x, km: d, total: x.unit * (x.per === 'person' ? people : cars) }));
  }
  const road = d * 1.3;
  const ktx = { mode: 'ktx', label: 'KTX', emoji: '🚄', dur: Math.round(d * 1.25 / 200 * 60 + 15), unit: r100(d * 1.25 * 135), per: 'person', desc: `${o.hub} → ${v.hub}` };
  const list = [ktx];
  if (d > 100) list.push({ mode: 'srt', label: 'SRT', emoji: '🚅', dur: Math.round(ktx.dur * 0.95), unit: r100(ktx.unit * 0.88), per: 'person', desc: '수서·동탄 출발 시 추천' });
  list.push({ mode: 'bus', label: '고속버스', emoji: '🚌', dur: Math.round(road / 85 * 60 + 20), unit: r100(road * 68), per: 'person', desc: '우등 고속 · 가성비 최고' });
  list.push({ mode: 'car', label: '자차', emoji: '🚗', dur: Math.round(road / 90 * 60), unit: r100(road * 220 + 5000), per: 'car', desc: `유류비 + 톨비 + 주차 · ${cars}대` });
  return list.map(x => ({ ...x, km: d, total: x.unit * (x.per === 'person' ? people : cars) }));
}
// 홈·원정 경기를 한 여행에 섞을 수 있어요: 날짜별로 그날 있는 도시(구장)를 정해요
const planGames = p => SCHED.filter(g => g.date >= p.start && g.date <= p.end);
function dayVenue(p, date) {
  const gs = planGames(p); const g = gs.find(x => x.date === date);
  if (g) return g.venue;
  const prev = gs.filter(x => x.date < date).pop(); if (prev) return prev.venue;
  const next = gs.find(x => x.date > date); if (next) return next.venue;
  return gameById(p.gameId).venue;
}
const venueOfPlan = p => dayVenue(p, p.start);          // 가는 편 도착 구장
const lastVenueOfPlan = p => dayVenue(p, p.end);        // 오는 편 출발 구장
const planVenues = p => { const vs = []; for (let i = 0; i <= nights(p); i++) { const v = dayVenue(p, addDays(p.start, i)); if (vs[vs.length - 1] !== v) vs.push(v); } return vs; };
const citiesOf = vs => vs.map(v => VENUES[v].city).filter((c, i, a) => a.indexOf(c) === i).join(' → ');
const modeOpts = p => travelOptions(p.region, venueOfPlan(p), p.people);
const curMode = p => { const os = modeOpts(p); return os.find(o => o.mode === p.mode) || os[0]; };
const inMode = p => { const os = travelOptions(p.region, lastVenueOfPlan(p), p.people); return os.find(o => o.mode === p.mode) || os.find(o => o.mode === 'ktx') || os[0]; };
// 구장 → 구장 이동 (같은 수단이 있으면 그대로, 없으면 가장 무난한 수단)
const hopMode = (from, to, mode, people) => { const os = travelOptions(VENUES[from], to, people); return os.find(o => o.mode === mode) || os.find(o => o.mode === 'ktx') || os[0]; };
// 1박마다 묵는 구장: 그날 밤 있던 도시
const stayNights = p => { const m = {}; for (let i = 0; i < nights(p); i++) { const v = dayVenue(p, addDays(p.start, i)); m[v] = (m[v] || 0) + 1; } return m; };
const planStays = p => { const m = stayNights(p); if (!p.stays) p.stays = {}; Object.keys(m).forEach(v => { if (p.stays[v] === undefined) p.stays[v] = STAYS[v][0].id; }); return Object.keys(m).map(v => ({ venue: v, nights: m[v], stay: p.stays[v] ? STAYS[v].find(h => h.id === p.stays[v]) : null })); };
function outTimes(p) {
  const o = curMode(p); const g = planGames(p).find(x => x.date === p.start);
  const ideal = g ? Math.max(toMin(g.time) - 390, 600) : 720; // 경기 1시간 30분 전 도착 + 관광 시간 확보
  const latest = g ? toMin(g.time) - 90 - 40 : 1080;
  return [-60, 0, 60].map(off => { const arr = Math.min(ideal + off, latest); const dep = r5(arr - o.dur); return { dep, arr: dep + o.dur }; });
}
function inTimes(p) {
  const o = inMode(p); const g = planGames(p).find(x => x.date === p.end);
  const base = g ? [toMin(g.time) + 240, toMin(g.time) + 270, toMin(g.time) + 310] : [960, 1050, 1140];
  return base.map(dep => ({ dep: r5(dep), arr: r5(dep) + o.dur }));
}
const nights = p => daysBetween(p.start, p.end);
const rooms = p => p.companion === 'couple' || p.companion === 'solo' ? 1 : p.companion === 'family' ? Math.ceil(p.people / 4) : Math.ceil(p.people / 2);

function sortPool(pool, comp, seed) {
  const r = rng(comp + ':' + seed);
  return pool.map(s => ({ s, k: (s.tags.includes(comp) ? 0 : 1.2) + r() * 1.1 - (s.partner ? 0.15 : 0) })).sort((a, b) => a.k - b.k).map(x => x.s);
}
function buildRoute(p) {
  const myT = team(S.team);
  const pools = {}; const poolOf = v => pools[v] || (pools[v] = sortPool(SPOTS[v], p.companion, p.routeSeed));
  const used = new Set(); const games = planGames(p); const o = curMode(p), oi = inMode(p);
  const out = outTimes(p)[p.outIdx], back = inTimes(p)[p.inIdx];
  const origin = regionOf(p.region); const n = nights(p); const days = [];
  for (let i = 0; i <= n; i++) {
    const date = addDays(p.start, i); const g = games.find(x => x.date === date); const last = i === n; const items = [];
    const vKey = dayVenue(p, date), venue = VENUES[vKey], pool = poolOf(vKey); const prevV = i > 0 ? dayVenue(p, addDays(date, -1)) : vKey;
    let t;
    if (i === 0) {
      items.push({ kind: 'move', time: out.dep, emoji: o.emoji, title: `${origin.name} → ${venue.city} (${o.label})`, desc: `${hm(out.dep)} 출발 · ${hm(out.arr)} 도착 · 약 ${o.dur}분`, reservable: true, reserved: true });
      t = r5(out.arr + 20);
    } else if (prevV !== vKey) {
      const h = hopMode(prevV, vKey, p.mode, p.people); const pv = VENUES[prevV];
      const dep = g ? Math.max(540, Math.min(600, toMin(g.time) - 90 - 60 - h.dur)) : 600;
      items.push({ kind: 'stay', time: dep - 30, emoji: '☀️', title: '숙소 체크아웃', desc: `짐 챙겨서 ${venue.city}(으)로 출발!` });
      items.push({ kind: 'move', time: dep, emoji: h.emoji, title: `${pv.city} → ${venue.city} (${h.label})`, desc: `${hm(dep)} 출발 · ${hm(dep + h.dur)} 도착 · 약 ${h.dur}분 · ${g && !g.home ? '원정' : '홈'} 경기 따라 이동 🚀`, reservable: true, reserved: true, fare: h.total, hop: true });
      t = r5(dep + h.dur + 20);
    } else {
      items.push({ kind: 'stay', time: 600, emoji: '☀️', title: '숙소 체크아웃 & 출발', desc: '짐은 프런트에 맡기고 가볍게!' });
      t = 630;
    }
    const limit = g ? toMin(g.time) - 90 : last ? back.dep - 40 : 1170;
    let ate = false;
    for (let guard = 0; guard < 6; guard++) {
      let pref;
      if (!ate && t >= 630 && t <= 840) pref = ['food'];
      else if (t < 630) pref = ['sight', 'exhibit', 'cafe', 'shop'];
      else if (t < 1020) pref = ['cafe', 'exhibit', 'sight', 'shop'];
      else pref = ['food', 'sight'];
      const fits = s => !used.has(s.id) && t + s.dur <= limit - 10;
      const spot = pool.find(s => fits(s) && pref.includes(s.cat)) || pool.find(fits);
      if (!spot) break;
      used.add(spot.id);
      items.push({ kind: 'spot', time: t, spotId: spot.id, emoji: spot.emoji, title: spot.name, desc: spot.desc, dur: spot.dur, cat: spot.cat, price: spot.price, partner: !!spot.partner, reservable: !!spot.reserve, reserved: false });
      if (spot.cat === 'food') ate = true;
      t = r5(t + spot.dur + 20);
    }
    if (g) {
      const st = toMin(g.time);
      items.push({ kind: 'game', time: st - 90, emoji: '🏟️', title: `${venue.name} 도착`, desc: '입장 · 굿즈샵 · 응원도구 챙기기 · 치킨 픽업 🍗' });
      items.push({ kind: 'game', time: st, emoji: '⚾', title: `플레이볼! ${myT.short} vs ${team(g.opp).short}`, desc: `${g.home ? '홈' : '원정'} 경기 · 목청껏 응원하기 📣`, gameId: g.id });
      if (last) items.push({ kind: 'move', time: back.dep, emoji: oi.emoji, title: `${venue.city} → ${origin.name} (${oi.label})`, desc: `${hm(back.dep)} 출발 · ${hm(back.arr)} 도착${back.arr >= 1440 ? ' 🌙 심야 도착 주의' : ''}`, reservable: true, reserved: true });
      else items.push({ kind: 'stay', time: st + 230, emoji: '🏨', title: '숙소 체크인', desc: '오늘 경기 이야기하며 꿀잠 💤', checkin: true });
    } else {
      if (last) items.push({ kind: 'move', time: back.dep, emoji: oi.emoji, title: `${venue.city} → ${origin.name} (${oi.label})`, desc: `${hm(back.dep)} 출발 · ${hm(back.arr)} 도착`, reservable: true, reserved: true });
      else items.push({ kind: 'stay', time: 1200, emoji: '🏨', title: '숙소 체크인', desc: '내일 경기를 위해 푹 쉬기 💤', checkin: true });
    }
    days.push({ date, venue: vKey, gameId: g ? g.id : null, items });
  }
  return days;
}
const planKey = p => JSON.stringify([p.start, p.end, p.companion, p.people, p.region, p.mode, p.outIdx, p.inIdx, p.routeSeed]);
function costs(p) {
  const hops = (p.days || []).flatMap(d => d.items).filter(i => i.hop).reduce((a, i) => a + (i.fare || 0), 0);
  const transport = curMode(p).total + inMode(p).total + hops;
  const stays = planStays(p); const stay = stays.find(x => x.stay)?.stay || null;
  const stayCost = stays.reduce((a, x) => a + (x.stay ? x.stay.price * x.nights * rooms(p) : 0), 0);
  const stayDisc = unlocked('r5') ? stays.reduce((a, x) => a + (x.stay && x.stay.partner ? x.stay.price * x.nights * rooms(p) * 0.2 : 0), 0) : 0;
  const spots = (p.days || []).flatMap(d => d.items).filter(i => i.kind === 'spot');
  const onsite = spots.reduce((a, s) => a + s.price * p.people, 0);
  const foodDisc = unlocked('r3') ? spots.filter(s => s.partner && (s.cat === 'food' || s.cat === 'cafe')).reduce((a, s) => a + s.price * p.people * 0.15, 0) : 0;
  const total = transport + stayCost - stayDisc;
  return { transport, hops, stays, stay, stayCost, stayDisc, onsite, foodDisc, total, per: (total + onsite - foodDisc) / p.people };
}

// ---------- UI helpers ----------
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#app').appendChild(el); setTimeout(() => el.remove(), 2400);
}
function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const colors = ['#E63946', '#2E9E4F', '#fff', '#F2C14E', getComputedStyle(document.documentElement).getPropertyValue('--team')];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + '%'; c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * .6 + 's'; c.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    box.appendChild(c);
  }
  $('#app').appendChild(box); setTimeout(() => box.remove(), 3500);
}
const teamBadge = (t, size = 54, fs = 26) => `<div class="tm-badge" style="background:${t.color};width:${size}px;height:${size}px;font-size:${fs}px">${t.emoji}</div>`;
const avatar = (name, i, g) => `<div class="avatar" title="${esc(name)}">${name === '나' ? team(S.team).emoji : AVATARS[i % AVATARS.length]}</div>`;

function topbar({ title, sub = '', back = null, right = '', extra = '' }) {
  return `<div class="topbar"><div class="row">
    ${back ? `<button class="back-btn" onclick="${back}">←</button>` : `<div class="logo jua">${ballSVG()}직관메이트</div>`}
    <div class="row" style="gap:8px">${right}${typeof menuBtnHTML === 'function' ? menuBtnHTML() : ''}</div>
  </div>
  ${title ? `<h1 class="jua" style="margin-top:14px">${title}</h1>` : ''}
  ${sub ? `<div class="sub">${sub}</div>` : ''}${extra}</div>`;
}
const teamPill = () => { const t = team(S.team); return `<button class="team-pill" onclick="A.openSheet('team')"><span class="team-dot"></span>${t.emoji} ${t.short}</button>`; };

function navHTML(on) {
  const items = [['home', '🏠', '홈'], ['schedule', '📅', '직관예약'], ['records', '⚾', '직관기록']];
  return `<nav class="nav">${items.map(([k, ic, l]) => `<button class="${on === k ? 'on' : ''}" onclick="A.go('${k}')"><span class="ic">${ic}</span>${l}</button>`).join('')}</nav>`;
}

function calHTML(month, mode) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const dim = new Date(y, m, 0).getDate();
  const total = Math.ceil((first.getDay() + dim) / 7) * 7;
  const p = UI.plan;
  let cells = '';
  for (let i = 0; i < total; i++) {
    const d = new Date(y, m - 1, 1 - first.getDay() + i); const ds = ymd(d);
    const g = SCHED.find(x => x.date === ds);
    const cls = ['cal-day'];
    if (d.getMonth() !== m - 1) cls.push('other');
    if (ds === TODAY) cls.push('today');
    if (g) { cls.push('game'); if (!g.home) cls.push('away'); }
    if (ds < TODAY) cls.push('past');
    if (S.bookings.some(b => ds >= b.start && ds <= b.end)) cls.push('booked');
    if (mode === 'browse' && UI.selDate === ds) cls.push('sel');
    if (mode === 'range') { if (ds === p.start || ds === p.end) cls.push('sel'); else if (ds > p.start && ds < p.end) cls.push('inrange'); }
    cells += `<button class="${cls.join(' ')}" onclick="A.calTap('${ds}','${mode}')"><span class="num">${d.getDate()}</span>${g ? `<span class="opp">${g.home ? 'vs' : '@'}${team(g.opp).short}</span><span class="tm">${g.time}</span>` : ''}</button>`;
  }
  return `<div class="cal">
    <div class="cal-head"><button onclick="A.calMove(-1,'${mode}')">‹</button><b>${y}년 ${m}월</b><button onclick="A.calMove(1,'${mode}')">›</button></div>
    <div class="cal-grid">${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
    <div class="legend"><span><i style="background:var(--grass-light)"></i>홈 경기</span><span><i style="background:#F2F4F2"></i>원정 경기</span><span>⚾ 예약됨</span></div>
  </div>`;
}

function timelineHTML(days, { editable = false, booking = null, group = null } = {}) {
  const src = booking || UI.plan;
  const stayNameOf = v => { const id = src?.stays ? src.stays[v] : (v === src?.venue ? src?.stayId : null); return id ? STAYS[v]?.find(h => h.id === id)?.name : null; };
  return days.map((d, di) => {
    const g = d.gameId ? gameById(d.gameId) : null; const stayName = stayNameOf(d.venue || booking?.venue);
    return `<div class="day-head"><span class="dnum">DAY ${di + 1}</span><b>${fmtDate(d.date)}</b>${d.venue && days.some(x => x.venue && x.venue !== d.venue) ? `<span class="badge gray">📍 ${VENUES[d.venue].city}</span>` : ''}${g ? `<span class="badge red">⚾ ${g.time} ${g.home ? 'vs' : '@'} ${team(g.opp).short}</span>` : '<span class="badge">🧳 관광 데이</span>'}</div>
    <div class="timeline">${d.items.map((it, ii) => {
      const cls = it.kind === 'game' ? 'game' : it.kind === 'move' ? 'move' : it.kind === 'stay' ? 'stay' : '';
      const desc = it.checkin && stayName ? `${stayName} · ${it.desc}` : it.desc;
      let acts = '';
      if (it.kind === 'spot') {
        const extra = [];
        if (it.partner) extra.push(`<span class="badge gold">🤝 제휴${unlocked('r3') && it.cat !== 'sight' ? ' · 15%쿠폰' : ''}</span>`);
        if (editable) {
          if (it.reservable) extra.push(`<button class="mini-btn ${it.reserved ? 'done' : 'red'}" onclick="A.reserve(${di},${ii})">${it.reserved ? '✓ 예약완료' : (it.cat === 'food' ? '🍽️ 예약하기' : '🎟️ 예매하기')}</button>`);
          extra.push(`<button class="mini-btn" onclick="A.swap(${di},${ii})">🔄 다른 곳</button>`);
        } else if (it.reserved) extra.push('<span class="badge red">✓ 예약완료</span>');
        if (group) { const k = `${di}-${ii}`; const v = group.votes?.[k] || 0; extra.push(`<button class="mini-btn ${v ? 'done' : ''}" onclick="A.vote('${group.id}','${k}')">👍 ${v ? v + '명 좋아요' : '좋아요'}</button>`); }
        acts = `<div class="acts">${extra.join('')}</div>`;
      }
      const dur = it.dur ? ` · ${it.dur}분` : '';
      return `<div class="tl-item ${cls}"><span class="time">${hm(it.time).replace('익일 ', '+')}</span><div class="tt">${it.emoji} ${esc(it.title)}</div><div class="dd">${esc(desc)}${dur}</div>${acts}</div>`;
    }).join('')}</div>`;
  }).join('');
}

// ---------- screens ----------
function scrOnboard() {
  if (UI.ob === 1) {
    return `<div class="view">
      <div class="topbar center" style="padding-bottom:34px">
        <div class="hero-ball">${ballSVG()}</div>
        <h1 class="jua" style="margin-top:12px;font-size:28px">직관메이트</h1>
        <div class="sub">야구 보러 가는 길, 여행이 되다 ✈️⚾</div>
      </div>
      <div class="q-title">나의 최애 구단은?</div>
      <div class="q-sub">응원하는 KBO 구단을 골라주세요. 경기 일정과 여행 루트를 맞춰드릴게요!</div>
      <div class="team-grid">${TEAMS.map(t => `
        <button class="team-card ${UI.obTeam === t.id ? 'on' : ''}" onclick="A.obPick('${t.id}')">
          <div class="em" style="background:${t.color}">${t.emoji}</div>
          <div><div class="nm">${t.name}</div><div class="st">${VENUES[t.venue].city} · ${VENUES[t.venue].name}</div></div>
          ${UI.obTeam === t.id ? '<span class="check">✓</span>' : ''}
        </button>`).join('')}
      </div>
      <div class="pad mt8"><button class="btn red block" ${UI.obTeam ? '' : 'disabled'} onclick="A.obNext()">다음으로 →</button></div>
    </div>`;
  }
  const t = team(UI.obTeam);
  return `<div class="view">
    ${topbar({ title: `${t.emoji} ${t.nick} 팬 반가워요!`, sub: '출발 정보를 알려주면 교통편을 찾아드려요', back: 'A.obBack()' })}
    <div class="card lift ball-card"><div class="pad" style="padding:6px 30px">
      <label class="field"><span>닉네임</span><input class="input" id="obNick" placeholder="예: 승리요정" value="${esc(S.nickname)}" maxlength="10"></label>
      <label class="field"><span>사는 지역 (출발지)</span><select class="input" id="obRegion">${REGIONS.map(r => `<option ${r.name === S.region ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>
      <label class="field"><span>상세 주소 (선택)</span><input class="input" id="obAddr" placeholder="예: 마포구 연남동" value="${esc(S.address)}"></label>
    </div></div>
    <div class="pad"><button class="btn red block" onclick="A.obDone()">직관메이트 시작하기 ⚾</button>
    <p class="muted center small mt12">※ 프로토타입: 경기 일정·가격·결과는 샘플 데이터예요</p></div>
  </div>`;
}

function scrHome() {
  const t = team(S.team); const st = stats();
  const upcoming = S.bookings.filter(b => b.end >= TODAY).sort((a, b) => a.start.localeCompare(b.start));
  const nb = upcoming[0]; const ng = nb ? gameById(nb.gameId) : nextGame();
  const nr = nextReward();
  let main = '';
  if (nb && ng) {
    const dd = daysBetween(TODAY, nb.start);
    main = `<div class="card lift ball-card"><div style="padding:0 26px">
      <div class="row between"><span class="badge red">✈️ 예약된 직관 여행</span><span class="muted small">${fmtDate(nb.start)}${nb.end !== nb.start ? ' ~ ' + fmtDate(nb.end) : ''}</span></div>
      <div class="dday mt12"><div class="big">${dd === 0 ? 'D-DAY' : 'D-' + dd}</div><div><b>${t.short} vs ${team(ng.opp).short}</b><div class="muted">${VENUES[ng.venue].name} · ${ng.time}</div></div></div>
      <button class="btn green block mt12 sm" style="padding:11px" onclick="A.go('booking',{id:'${nb.id}'})">🗺️ 여행 루트 보기</button>
    </div></div>`;
  } else if (ng) {
    const dd = daysBetween(TODAY, ng.date);
    main = `<div class="card lift ball-card"><div style="padding:0 26px">
      <div class="row between"><span class="badge">📅 다음 ${t.nick} 경기</span><span class="muted small">${fmtDate(ng.date)} ${ng.time}</span></div>
      <div class="dday mt12"><div class="big">${dd === 0 ? 'D-DAY' : 'D-' + dd}</div><div><b>${t.short} vs ${team(ng.opp).short}</b><div class="muted">${VENUES[ng.venue].name} (${ng.home ? '홈' : '원정'})</div></div></div>
      <button class="btn red block mt12 sm" style="padding:11px" onclick="A.startPlan('${ng.id}')">✈️ 이 경기 직관 여행 짜기</button>
    </div></div>`;
  }
  return `<div class="view">
    ${topbar({ right: teamPill(), title: `안녕, ${esc(S.nickname || '직관러')}님! ${t.emoji}`, sub: `오늘도 ${t.nick} 승리를 위해 함께 응원해요 📣` })}
    ${main}
    <div class="section-title"><h3>🌤️ 직관 날 날씨</h3>${ng ? `<span class="muted small">${fmtDate(nb ? nb.start : ng.date)} · ${VENUES[ng.venue].city}</span>` : ''}</div>
    <div class="card" id="wxcard"><div class="muted center">날씨 불러오는 중... ⚾</div></div>
    <div class="section-title"><h3>⚾ 나의 직관 승률</h3><a onclick="A.go('records')">스탬프 보기 ›</a></div>
    <div class="card">
      <div class="stat-row"><div><b>${st.n}</b><span>직관 횟수</span></div><div><b style="color:var(--stitch)">${st.w}승 ${st.l}패</b><span>${st.d ? st.d + '무 · ' : ''}직관 전적</span></div><div><b>${st.rate}%</b><span>승리요정 지수</span></div></div>
      ${nr ? `<div class="mt16 small"><div class="row between"><span>다음 리워드: ${nr.emoji} <b>${nr.title}</b></span><b>${st.w}/${nr.wins}승</b></div><div class="progress mt8"><i style="width:${Math.min(100, st.w / nr.wins * 100)}%"></i></div></div>` : '<div class="mt12 center badge gold">👑 모든 리워드 달성! 시즌 MVP 직관러</div>'}
    </div>
    <div class="section-title"><h3>📆 다가오는 경기</h3><a onclick="A.go('schedule')">전체 일정 ›</a></div>
    <div class="card" style="padding:4px 16px">${SCHED.filter(g => g.date >= TODAY).slice(0, 5).map(g => `
      <div class="list-item" onclick="A.go('schedule');UI.selDate='${g.date}';UI.calMonth='${g.date.slice(0, 7)}';render()" style="cursor:pointer">
        <div class="date-box"><b>${parse(g.date).getDate()}</b><span>${parse(g.date).getMonth() + 1}월 ${DOW[g.dow]}</span></div>
        <div class="grow"><b>vs ${team(g.opp).emoji} ${team(g.opp).name}</b><div class="muted small">${VENUES[g.venue].name} · ${g.time}</div></div>
        <span class="badge ${g.home ? '' : 'gray'}">${g.home ? '홈' : '원정'}</span>
      </div>`).join('')}
    </div>
  </div>`;
}
async function fillWeather() {
  const el = $('#wxcard'); if (!el) return;
  const upcoming = S.bookings.filter(b => b.end >= TODAY).sort((a, b) => a.start.localeCompare(b.start))[0];
  const g = upcoming ? (planGamesOfBooking(upcoming).find(x => x.date >= TODAY) || gameById(upcoming.gameId)) : nextGame();
  if (!g) { el.innerHTML = '<div class="muted center">예정된 경기가 없어요</div>'; return; }
  const v = VENUES[g.venue]; const wx = await getWeather(g.venue, g.date, g.time);
  if (!$('#wxcard')) return;
  const [em, txt] = WMO(wx.code);
  $('#wxcard').innerHTML = `<div class="weather"><div class="em">${em}</div><div class="grow"><div class="temp">${wx.temp}°</div><div class="muted">${txt} · 경기 시작(${g.time}) 기준</div></div><span class="badge ${wx.live ? '' : 'gray'}">${wx.live ? '📡 실시간 예보' : '📊 평년 기준 예상'}</span></div>
    <div class="wx-grid"><div>최고 / 최저<b>${wx.max}° / ${wx.min}°</b></div><div>강수확률<b>${wx.rain}%</b></div><div>경기장<b style="font-size:12px">${v.dome ? '🏟️ 돔구장' : '☀️ 야외'}</b></div></div>
    <div class="tip">${wxTip(wx, v.dome)}</div>`;
}
const planGamesOfBooking = b => SCHED.filter(g => g.date >= b.start && g.date <= b.end && (b.venues ? b.venues.includes(g.venue) : g.venue === b.venue));
const bCities = b => citiesOf(b.venues || [b.venue]);
const bVenueNames = b => (b.venues || [b.venue]).map(v => VENUES[v].name).filter((n, i, a) => a.indexOf(n) === i).join(' · ');

function scrSchedule() {
  const t = team(S.team);
  if (!UI.calMonth) UI.calMonth = TODAY.slice(0, 7);
  if (!UI.selDate) UI.selDate = nextGame()?.date;
  const g = UI.selDate ? SCHED.find(x => x.date === UI.selDate) : null;
  let card = '';
  if (g) {
    const o = team(g.opp); const past = g.date < TODAY; const series = seriesOf(g);
    card = `<div class="card ball-card mt16"><div style="padding:0 24px">
      <div class="row between"><span class="badge ${g.home ? '' : 'gray'}">${g.home ? '🏠 홈 경기' : '🚌 원정 경기'}</span><span class="muted small">${fmtFull(g.date)} ${g.time}</span></div>
      <div class="match mt12"><div>${teamBadge(t)}<div class="nm">${t.short}</div></div><div class="vs">${past ? `${g.my} : ${g.op}` : 'VS'}</div><div>${teamBadge(o)}<div class="nm">${o.short}</div></div></div>
      <div class="center muted small">📍 ${VENUES[g.venue].name} · ${VENUES[g.venue].city} · ${series.length}연전 중 ${g.idx + 1}차전</div>
      ${past ? `<div class="center mt12"><span class="badge ${g.result === 'W' ? 'red' : 'gray'}">${g.result === 'W' ? '🎉 승리한 경기' : g.result === 'L' ? '😢 아쉬운 패배' : '🤝 무승부'}</span></div>`
        : `<button class="btn red block mt16" onclick="A.startPlan('${g.id}')">✈️ 이 경기 직관 여행 짜기</button>`}
    </div></div>`;
  } else if (UI.selDate) card = `<div class="card mt16"><div class="empty"><span class="em">😴</span>이 날은 경기가 없어요</div></div>`;
  return `<div class="view">
    ${topbar({ right: teamPill(), title: `${t.emoji} ${t.nick} 경기 일정`, sub: '직관 갈 경기를 선택하세요 · 샘플 일정' })}
    <div class="lift"></div>
    ${calHTML(UI.calMonth, 'browse')}
    ${card}
  </div>`;
}

// ----- 예약 위저드 -----
const stepKeys = p => nights(p) > 0 ? ['dates', 'who', 'move', 'route', 'stay', 'confirm'] : ['dates', 'who', 'move', 'route', 'confirm'];
const STEP_LABEL = { dates: '기간', who: '동행', move: '교통', route: '루트', stay: '숙소', confirm: '확인' };
function scrPlan() {
  const p = UI.plan; const keys = stepKeys(p); if (p.step >= keys.length) p.step = keys.length - 1;
  const k = keys[p.step]; const g = gameById(p.gameId); const t = team(S.team); const v = VENUES[venueOfPlan(p)]; const cities = citiesOf(planVenues(p));
  const head = `<div class="topbar" style="padding-bottom:22px"><div class="row"><button class="back-btn" onclick="A.planPrev()">←</button>
    <div class="jua" style="font-size:16px">${planGames(p).length > 1 ? `${t.short} ${planGames(p).length}경기` : `${t.short} vs ${team(g.opp).short}`} · ${cities} 직관여행</div><button class="back-btn" onclick="A.go('schedule')">✕</button></div>
    <div class="steps" style="padding:0">${keys.map((x, i) => `<i class="${i <= p.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="sub" style="margin-top:8px">STEP ${p.step + 1}. ${STEP_LABEL[k]}</div></div>`;
  let body = '', next = '다음 →', nextOk = true;
  if (k === 'dates') {
    const games = planGames(p); const n = nights(p); const series = seriesOf(g).filter(x => x.date >= TODAY);
    body = `<div class="q-title">언제 떠날까요? 🗓️</div><div class="q-sub">당일치기, 1박2일, 3연전 전부! 홈·원정 경기를 섞어서 골라도 도시 이동까지 짜드려요. 캘린더에서 시작일 → 종료일을 눌러 선택하세요.</div>
      <div class="chips" style="padding:0 18px 14px">
        <button class="chip ${n === 0 ? 'on' : ''}" onclick="A.quickRange(0)">⚡ 당일치기</button>
        <button class="chip ${n === 1 && p.start === g.date ? 'on' : ''}" onclick="A.quickRange(1)">🌙 1박 2일</button>
        ${series.length >= 2 ? `<button class="chip ${p.start === series[0].date && p.end === series[series.length - 1].date && n > 0 ? 'on' : ''}" onclick="A.quickRange('series')">🔥 ${series.length}연전 전부</button>` : ''}
      </div>
      ${calHTML(UI.planMonth, 'range')}
      <div class="card mt16"><div class="row between"><b>${fmtDate(p.start)}${n ? ' ~ ' + fmtDate(p.end) : ''}</b><span class="badge red">${n === 0 ? '당일치기' : `${n}박 ${n + 1}일`}</span></div>
      <div class="muted small mt8">⚾ 포함 경기 ${games.length}개: ${games.map(x => `${fmtDate(x.date)} ${x.home ? 'vs' : '@'}${team(x.opp).short}(${x.home ? '홈' : '원정'})`).join(', ') || '없음'}</div>
      ${planVenues(p).length > 1 ? `<div class="small mt8" style="color:var(--grass-dark)">🚀 ${citiesOf(planVenues(p))} · 경기 따라 도시 이동이 루트에 포함돼요</div>` : ''}
      ${p.selecting ? '<div class="small mt8" style="color:var(--stitch)">👉 종료일을 눌러주세요</div>' : ''}</div>`;
    nextOk = games.length > 0;
  } else if (k === 'who') {
    body = `<div class="q-title">누구랑 가나요? 💕</div><div class="q-sub">동행에 맞춰 루트와 숙소를 추천해 드려요.</div>
      <div class="comp-grid">${COMPANIONS.map(c => `<button class="comp-card ${p.companion === c.id ? 'on' : ''}" onclick="A.setComp('${c.id}')"><div class="em">${c.emoji}</div><b>${c.label}</b><span>${c.desc}</span></button>`).join('')}</div>
      ${p.companion === 'friends' || p.companion === 'family' ? `<div class="card mt16"><div class="center muted small">나를 포함한 총 인원</div><div class="counter mt8"><button onclick="A.people(-1)">−</button><b>${p.people}명</b><button onclick="A.people(1)">+</button></div>
        <div class="center small mt8" style="color:var(--grass-dark)">👥 예약 후 그룹방에서 n빵 정산할 수 있어요!</div></div>` : ''}`;
  } else if (k === 'move') {
    const os = modeOpts(p); const o = curMode(p); if (!p.mode) p.mode = o.mode;
    const outs = outTimes(p), ins = inTimes(p); const origin = regionOf(p.region);
    body = `<div class="q-title">어떻게 갈까요? 🚄</div><div class="q-sub">${p.companion !== 'solo' ? p.people + '명 · ' : ''}경기 1시간 30분 전 야구장 도착 기준으로 시간표를 골랐어요.</div>
      <div class="card"><div class="row"><label class="field grow" style="margin:0"><span>출발 지역</span><select class="input" onchange="A.setRegion(this.value)">${REGIONS.map(r => `<option ${r.name === p.region ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>
      <label class="field grow" style="margin:0"><span>상세 주소</span><input class="input" value="${esc(p.address)}" placeholder="동/역 이름" oninput="UI.plan.address=this.value"></label></div>
      <div class="muted small mt8">📍 ${origin.hub} → ${v.hub} → ${v.name} · 약 ${Math.round(o.km)}km</div>
      ${planVenues(p).length > 1 ? `<div class="small mt8" style="color:var(--grass-dark)">🚀 ${citiesOf(planVenues(p))} 이동 후 ${VENUES[lastVenueOfPlan(p)].city}에서 돌아와요 · 도시 간 이동은 루트에 자동 포함</div>` : ''}</div>
      ${os.map(x => { const multi = lastVenueOfPlan(p) !== venueOfPlan(p); const back = multi ? (travelOptions(p.region, lastVenueOfPlan(p), p.people).find(y => y.mode === x.mode) || inMode(p)) : x; return `<button class="opt ${x.mode === o.mode ? 'on' : ''}" onclick="A.setMode('${x.mode}')"><div class="ic">${x.emoji}</div><div><div class="t">${x.label}</div><div class="d">${x.desc} · 약 ${x.dur >= 60 ? Math.floor(x.dur / 60) + '시간 ' : ''}${x.dur % 60}분</div></div><div class="p">${won(x.total + back.total)}<div class="d">${multi ? '가는 편+오는 편' : '왕복'}</div></div></button>`; }).join('')}
      <div class="section-title"><h3>➡️ 가는 편 · ${fmtDate(p.start)}</h3></div>
      <div class="chips" style="padding:0 18px">${outs.map((x, i) => `<button class="chip ${p.outIdx === i ? 'on' : ''}" onclick="A.setOut(${i})">${hm(x.dep)} → ${hm(x.arr)}${x.dep < 360 ? ' 🌅' : ''}</button>`).join('')}</div>
      <div class="section-title"><h3>⬅️ 오는 편 · ${fmtDate(p.end)}</h3></div>
      <div class="chips" style="padding:0 18px">${ins.map((x, i) => `<button class="chip ${p.inIdx === i ? 'on' : ''}" onclick="A.setIn(${i})">${hm(x.dep)} → ${hm(x.arr)}</button>`).join('')}</div>
      <p class="muted small" style="margin:12px 18px">${planGames(p).some(x => x.date === p.end) ? '⏱️ 경기 종료(약 3시간 20분 후) + 역 이동 시간을 고려했어요.' : ''}</p>`;
  } else if (k === 'route') {
    if (!p.days || p.routeKeyBuilt !== planKey(p)) { p.days = buildRoute(p); p.routeKeyBuilt = planKey(p); }
    const comp = COMPANIONS.find(c => c.id === p.companion);
    body = `<div class="q-title">${cities} 직관 루트 완성! 🗺️</div><div class="q-sub">${comp.emoji} ${comp.label} 가기 좋은 곳 위주로 짰어요. 맛집은 바로 예약까지!</div>
      <div style="padding:0 18px" class="row"><button class="btn ghost sm grow" onclick="A.reroll()">🎲 다른 루트 추천</button><button class="btn ghost sm grow" onclick="A.reserveAll()">🍽️ 맛집 한번에 예약</button></div>
      ${timelineHTML(p.days, { editable: true })}`;
  } else if (k === 'stay') {
    const rm = rooms(p); const groups = planStays(p); const multi = groups.length > 1;
    body = `<div class="q-title">어디서 잘까요? 🛏️</div><div class="q-sub">${nights(p)}박 · 객실 ${rm}개 기준 · 야구장 가까운 순으로 추천해요.${multi ? ' 도시마다 따로 골라주세요!' : ''}</div>
      ${groups.map(({ venue: sv, nights: n }) => { const list = STAYS[sv]; const cur = p.stays[sv]; return `${multi ? `<div class="section-title"><h3>📍 ${VENUES[sv].city} · ${n}박</h3><span class="muted small">${VENUES[sv].name} 근처</span></div>` : ''}
      ${list.map(h => { const tot = h.price * n * rm; const disc = h.partner && unlocked('r5'); return `<button class="opt ${cur === h.id ? 'on' : ''}" onclick="A.setStay('${h.id}','${sv}')"><div class="ic">${h.emoji}</div><div class="grow"><div class="t">${h.name}</div><div class="d">${h.type} · ${h.dist}</div>${h.partner ? `<span class="badge gold mt8">🤝 직관메이트 제휴${disc ? ' · 20% 쿠폰 적용' : ''}</span>` : ''}</div><div class="p">${disc ? `<div class="d" style="text-decoration:line-through">${won(tot)}</div>` : ''}${won(disc ? tot * 0.8 : tot)}<div class="d">1박 ${won(h.price)}</div></div></button>`; }).join('')}
      <button class="opt ${cur === null ? 'on' : ''}" onclick="A.setStay(null,'${sv}')"><div class="ic">🙅‍♀️</div><div><div class="t">숙소는 따로 구할게요</div><div class="d">친척집, 이미 예약함 등</div></div></button>`; }).join('')}
      ${!unlocked('r5') ? `<p class="muted small" style="margin:8px 18px">💡 직관 ${REWARDS[2].wins}승을 달성하면 제휴 숙소 20% 할인 쿠폰이 열려요!</p>` : ''}`;
  } else if (k === 'confirm') {
    if (!p.days || p.routeKeyBuilt !== planKey(p)) { p.days = buildRoute(p); p.routeKeyBuilt = planKey(p); }
    const c = costs(p); const o = curMode(p); const comp = COMPANIONS.find(x => x.id === p.companion);
    const reserved = p.days.flatMap(d => d.items).filter(i => i.kind === 'spot' && i.reserved);
    body = `<div class="q-title">예약 내용을 확인해요 ✅</div>
      <div class="card ball-card"><div style="padding:0 24px">
        <div class="sum-row"><span>📅 일정</span><b>${fmtDate(p.start)}${nights(p) ? ' ~ ' + fmtDate(p.end) : ''} (${nights(p) ? nights(p) + '박' + (nights(p) + 1) + '일' : '당일'})</b></div>
        <div class="sum-row"><span>⚾ 경기</span><b>${planGames(p).length}경기 @ ${planVenues(p).map(x => VENUES[x].name).filter((n, i, a) => a.indexOf(n) === i).join(', ')}</b></div>
        <div class="sum-row"><span>👥 동행</span><b>${comp.emoji} ${comp.label} ${p.people}명</b></div>
        <div class="sum-row"><span>${o.emoji} 교통</span><b>${o.label} ${planVenues(p).length > 1 ? '+ 도시 간 이동' : '왕복'}</b></div>
        <div class="sum-row"><span>🏨 숙소</span><b>${c.stays.filter(x => x.stay).map(x => x.stay.name).join(', ') || (nights(p) ? '직접 해결' : '당일치기')}</b></div>
        <div class="sum-row"><span>🍽️ 맛집·전시 예약</span><b>${reserved.length}건</b></div>
      </div></div>
      <div class="card"><b class="jua" style="font-size:17px">💳 결제 금액</b>
        <div class="sum-row mt8"><span>교통 (${c.hops ? '도시 간 이동 포함' : '왕복'} ${p.people}명)</span><span>${won(c.transport)}</span></div>
        ${c.stayCost ? `<div class="sum-row"><span>숙소 (${nights(p)}박 × ${rooms(p)}실)</span><span>${won(c.stayCost)}</span></div>` : ''}
        ${c.stayDisc ? `<div class="sum-row"><span>🏨 승리 쿠폰 (숙소 20%)</span><span class="minus">-${won(c.stayDisc)}</span></div>` : ''}
        <div class="sum-row total"><span>지금 결제</span><span style="color:var(--stitch)">${won(c.total)}</span></div>
        <hr class="stitch"><div class="sum-row"><span class="muted">현장 결제 예상 (식비·입장료)</span><span>${won(c.onsite)}</span></div>
        ${c.foodDisc ? `<div class="sum-row"><span class="muted">🍽️ 제휴 맛집 15% 쿠폰</span><span class="minus">-${won(c.foodDisc)}</span></div>` : ''}
        ${p.people > 1 ? `<div class="tip">👯‍♀️ ${p.people}명이 n빵하면 <b>1인당 약 ${won(c.per)}</b> · 예약 후 그룹방에서 정산하세요!</div>` : ''}
        <p class="muted small mt12">※ 경기 티켓은 구단 공식 예매처에서 별도 예매해요.</p>
      </div>`;
    next = '예약 완료하기 ⚾';
  }
  return `<div class="view">${head}${body}</div>
    <div class="wizard-foot"><button class="btn white" onclick="A.planPrev()">이전</button><button class="btn red grow" ${nextOk ? '' : 'disabled'} onclick="A.planNext()">${next}</button></div>`;
}

function scrDone() {
  const b = S.bookings.find(x => x.id === UI.params.id); const v = VENUES[b.venue];
  return `<div class="view"><div class="success"><div class="em">🎉</div><h2 class="jua" style="font-size:26px;margin:10px 0 6px">예약 완료!</h2>
    <p class="muted">${bCities(b)} 직관 여행 준비 끝! 승리요정이 되어주세요 🧚‍♀️</p></div>
    <div class="card ball-card"><div style="padding:0 24px">
      <div class="sum-row"><span>📅</span><b>${fmtDate(b.start)}${b.end !== b.start ? ' ~ ' + fmtDate(b.end) : ''}</b></div>
      <div class="sum-row"><span>📍</span><b>${bVenueNames(b)}</b></div>
      <div class="sum-row"><span>💳</span><b>${won(b.cost.total)}</b></div>
    </div></div>
    <div class="pad">
      ${b.people > 1 ? `<button class="btn red block" onclick="A.makeGroup('${b.id}')">👥 그룹방 만들고 n빵하기</button>` : ''}
      <button class="btn green block mt12" onclick="A.go('booking',{id:'${b.id}'})">🗺️ 여행 루트 보기</button>
      <button class="btn white block mt12" onclick="A.go('home')">홈으로</button>
    </div></div>`;
}

function scrBooking() {
  const b = S.bookings.find(x => x.id === UI.params.id); if (!b) return scrHome();
  const v = VENUES[b.venue]; const comp = COMPANIONS.find(c => c.id === b.companion);
  const grp = S.groups.find(gr => gr.bookingId === b.id);
  return `<div class="view">
    ${topbar({ back: "A.go('home')", title: `${bCities(b)} 직관 여행 🗺️`, sub: `${fmtDate(b.start)}${b.end !== b.start ? ' ~ ' + fmtDate(b.end) : ''} · ${comp.emoji} ${comp.label} ${b.people}명 · ${bVenueNames(b)}` })}
    <div class="card lift"><div class="row between"><span>💳 결제 금액</span><b style="color:var(--stitch)">${won(b.cost.total)}</b></div>
      <div class="row mt12">${grp ? `<button class="btn ghost sm grow" onclick="A.go('group',{id:'${grp.id}'})">👥 그룹방 가기</button>` : (b.people > 1 ? `<button class="btn ghost sm grow" onclick="A.makeGroup('${b.id}')">👥 그룹방 만들기</button>` : '')}
      <button class="btn ghost sm grow" onclick="A.cancelBooking('${b.id}')">예약 취소</button></div></div>
    ${timelineHTML(b.days, { booking: b })}
  </div>`;
}

function scrRecords() {
  const st = stats(); const t = team(S.team);
  const recs = S.records.filter(r => r.myTeam === S.team).sort((a, b) => a.date.localeCompare(b.date));
  const slots = Math.max(15, Math.ceil((recs.length + 1) / 5) * 5);
  const fairy = st.n === 0 ? '첫 직관을 인증해 보세요!' : st.rate >= 70 ? '🧚‍♀️ 공식 승리요정! 당신이 가면 이겨요' : st.rate >= 50 ? '✨ 승리요정 꿈나무' : '💪 그래도 끝까지 응원하는 찐팬';
  return `<div class="view">
    ${topbar({ right: teamPill(), title: '⚾ 나의 직관 기록', sub: fairy })}
    <div class="card lift"><div class="stat-row"><div><b>${st.n}</b><span>직관</span></div><div><b style="color:var(--stitch)">${st.w}승</b><span>${st.l}패 ${st.d}무</span></div><div><b>${st.rate}%</b><span>직관 승률</span></div></div>
      <button class="btn red block mt16" onclick="A.openSheet('verify')">📸 직관 인증하고 스탬프 받기</button></div>
    <div class="section-title"><h3>🏅 직관 스탬프</h3><span class="muted small">W 승 · L 패 · D 무</span></div>
    <div class="card"><div class="stamps">${Array.from({ length: slots }, (_, i) => { const r = recs[i]; return r ? `<div class="stamp ${r.result} ${UI.lastStamp === r.id ? 'pop' : ''}" title="${r.date}"><span class="lbl">${r.result === 'W' ? 'WIN' : r.result === 'L' ? 'LOSE' : 'DRAW'}<br><small>${parse(r.date).getMonth() + 1}/${parse(r.date).getDate()}</small></span></div>` : `<div class="stamp"><span class="lbl">${i + 1}</span></div>`; }).join('')}</div></div>
    <div class="section-title"><h3>🎁 승리 리워드</h3><span class="muted small">이길수록 쌓이는 할인 쿠폰</span></div>
    ${REWARDS.map(r => { const ok = st.w >= r.wins; return `<div class="coupon ${ok ? '' : 'locked'}"><div class="em">${r.emoji}</div><div><b>${r.title}</b><div class="muted small">${r.desc}</div></div><div class="need">${ok ? '✓ 사용가능' : `${r.wins}승 달성 시<br><span class="muted">${r.wins - st.w}승 남음</span>`}</div></div>`; }).join('')}
    <div class="section-title"><h3>📒 직관 일기</h3></div>
    <div class="card" style="padding:4px 16px">${recs.length ? recs.slice().reverse().map(r => `
      <div class="list-item"><div class="date-box"><b>${parse(r.date).getDate()}</b><span>${parse(r.date).getMonth() + 1}월</span></div>
      <div class="grow"><b>${t.short} ${r.my} : ${r.op} ${team(r.opp).short}</b> <span class="badge ${r.result === 'W' ? 'red' : 'gray'}">${r.result === 'W' ? '승' : r.result === 'L' ? '패' : '무'}</span><div class="muted small">${VENUES[r.venue].name}</div></div>
      <button class="mini-btn red" onclick="A.go('recap',{id:'${r.id}'})">📸 결산카드</button></div>`).join('') : '<div class="empty"><span class="em">🎫</span>아직 직관 기록이 없어요</div>'}
    </div>
  </div>`;
}

function scrRecap() {
  const r = S.records.find(x => x.id === UI.params.id); if (!r) return scrRecords();
  return `<div class="view">
    ${topbar({ back: "A.go('records')", title: '📸 오늘의 경기 결산 카드', sub: '인스타 스토리에 올리고 자랑하기!' })}
    <div class="chips" style="padding:16px 18px 0;justify-content:center">
      ${[['grass', '🌱 잔디'], ['ball', '⚾ 야구공'], ['team', '🎨 팀컬러']].map(([k, l]) => `<button class="chip ${UI.recapTheme === k ? 'on' : ''}" onclick="UI.recapTheme='${k}';render()">${l}</button>`).join('')}
    </div>
    <div class="recap-wrap"><canvas id="recapCanvas" width="1080" height="1920"></canvas></div>
    <div class="pad" style="padding-top:0"><button class="btn red block" onclick="A.shareRecap()">📲 인스타 스토리용 이미지 만들기</button></div>
  </div>`;
}

function scrTving() {
  const T = S.tving; const plan = TVING_PLANS.find(x => x.id === T.plan); const share = plan.price / 4; const t = team(S.team);
  const canCoupon = unlocked('r7'); const disc = canCoupon && T.useCoupon ? share * 0.5 : 0;
  const mates = T.partyType === 'team'
    ? [{ n: `${t.nick}여신`, e: t.emoji, paid: true }, { n: `${VENUES[t.venue].city}직관러`, e: t.emoji, paid: true }, { n: '보살팬99', e: t.emoji, paid: false }]
    : [{ n: '야구는9회말', e: team('lg').emoji, paid: true }, { n: '치킨은사랑', e: team('kia').emoji, paid: true }, { n: '응원단장', e: team('lotte').emoji, paid: false }];
  const nextPay = new Date(); nextPay.setMonth(nextPay.getMonth() + 1); nextPay.setDate(3);
  return `<div class="view">
    ${topbar({ right: teamPill(), title: '📺 티빙 n빵 파티', sub: '경기 못 가는 날엔 티빙으로! 같이 나누면 부담 DOWN' })}
    <div class="card lift tving-hero"><div class="tving-logo">TVING × 직관메이트</div>
      <div style="font-size:15px;margin-top:6px">KBO 생중계 · 하이라이트 · 다시보기</div>
      <div class="jua" style="font-size:30px;margin-top:10px">월 <span style="color:#FF153C">${won(share)}</span></div>
      <div style="font-size:12px;opacity:.75">${plan.name} ${won(plan.price)} ÷ 4명 분할결제</div></div>
    <div class="section-title"><h3>요금제</h3></div>
    <div class="chips" style="padding:0 18px">${TVING_PLANS.map(x => `<button class="chip ${T.plan === x.id ? 'on' : ''}" onclick="A.tv('plan','${x.id}')">${x.name} ${won(x.price)}</button>`).join('')}</div>
    <div class="section-title"><h3>파티 유형</h3></div>
    <div class="chips" style="padding:0 18px"><button class="chip ${T.partyType === 'team' ? 'on' : ''}" onclick="A.tv('partyType','team')">${t.emoji} ${t.nick} 팬끼리</button><button class="chip ${T.partyType === 'any' ? 'on' : ''}" onclick="A.tv('partyType','any')">🎲 아무나 4명</button></div>
    <div class="section-title"><h3>👑 나의 파티 ${T.joined ? '<span class="badge">이용 중</span>' : '<span class="badge gray">예시</span>'}</h3></div>
    <div class="card"><div class="members">
      <div class="member"><div class="avatar" style="border-color:var(--stitch)">${t.emoji}</div><b>나 👑</b><div class="muted">${T.joined ? '결제완료' : '파티장'}</div></div>
      ${mates.map(m => `<div class="member"><div class="avatar">${m.e}</div><b>${m.n}</b><div class="muted" style="color:${m.paid ? 'var(--grass-dark)' : 'var(--stitch)'}">${m.paid ? '결제완료' : '결제대기'}</div></div>`).join('')}
    </div><hr class="stitch">
      <div class="sum-row"><span>${plan.name} 월 요금</span><span>${won(plan.price)}</span></div>
      <div class="sum-row"><span>÷ 4명 분할</span><span>${won(share)}</span></div>
      ${canCoupon ? `<label class="sum-row" style="cursor:pointer"><span>📺 승리 쿠폰 (50%) 적용 <input type="checkbox" ${T.useCoupon ? 'checked' : ''} onchange="A.tv('useCoupon',this.checked)"></span><span class="minus">${disc ? '-' + won(disc) : ''}</span></label>` : `<div class="sum-row"><span class="muted">📺 ${REWARDS[3].wins}승 달성 시 50% 할인권 지급</span><span class="muted">${stats().w}/${REWARDS[3].wins}승</span></div>`}
      <div class="sum-row total"><span>내 월 결제액</span><span style="color:var(--stitch)">${won(share - disc)}</span></div>
      <div class="muted small mt8">💳 다음 결제일 ${nextPay.getMonth() + 1}/${nextPay.getDate()} · 매월 자동 분할결제 · 파티원 미결제 시 알림</div>
      ${T.joined ? `<div class="row mt16"><button class="btn ghost sm grow" onclick="A.copyInvite()">🔗 초대 링크 복사</button><button class="btn white sm grow" onclick="A.tv('joined',false)">파티 나가기</button></div>`
        : `<button class="btn red block mt16" onclick="A.tvJoin()">${won(share - disc)} 결제하고 파티 시작</button>`}
    </div>
    <div class="section-title"><h3>🔍 지금 모집 중인 파티</h3></div>
    ${[{ n: `${t.nick} 찐팬 모여라`, c: 3, e: t.emoji, p: '프리미엄' }, { n: '야구 시즌 같이 봐요', c: 2, e: '⚾', p: '스탠다드' }, { n: '퇴근 후 직관 대신 티빙', c: 1, e: '🌙', p: '베이직' }].map(x => `
      <div class="opt" style="cursor:default"><div class="ic">${x.e}</div><div class="grow"><div class="t">${x.n}</div><div class="d">${x.p} · ${x.c}/4명 · 빈자리 ${4 - x.c}</div></div><button class="btn green sm" onclick="toast('🙌 참여 신청 완료! 파티장 수락을 기다려요')">참여</button></div>`).join('')}
    <p class="muted small" style="margin:10px 18px">※ 프로토타입 예시 화면입니다. 실제 티빙 요금·정책과 다를 수 있어요.</p>
  </div>`;
}

function settle(g) {
  const total = g.expenses.reduce((a, e) => a + e.amount, 0); const share = total / g.members.length;
  const bal = {}; g.members.forEach(m => bal[m] = -share); g.expenses.forEach(e => { if (bal[e.payer] !== undefined) bal[e.payer] += e.amount; });
  const deb = Object.entries(bal).filter(([, v]) => v < -1).map(([k, v]) => [k, -v]);
  const cre = Object.entries(bal).filter(([, v]) => v > 1);
  const tx = []; let i = 0, j = 0;
  while (i < deb.length && j < cre.length) {
    const x = Math.min(deb[i][1], cre[j][1]); tx.push({ from: deb[i][0], to: cre[j][0], amt: Math.round(x / 10) * 10 });
    deb[i][1] -= x; cre[j][1] -= x; if (deb[i][1] < 1) i++; if (cre[j][1] < 1) j++;
  }
  return { total, share, tx };
}

function scrGroups() {
  return `<div class="view">
    ${topbar({ right: teamPill(), title: '👥 그룹방', sub: '친구들과 루트 공유하고 n빵 정산까지 한 번에' })}
    <div class="lift"></div>
    ${S.groups.length ? S.groups.map(g => { const s = settle(g); const b = S.bookings.find(x => x.id === g.bookingId); return `
      <div class="card" onclick="A.go('group',{id:'${g.id}'})" style="cursor:pointer">
        <div class="row between"><b class="jua" style="font-size:18px">${esc(g.name)}</b><span class="muted small">${g.members.length}명</span></div>
        <div class="row mt8"><div class="avatars">${g.members.map((m, i) => avatar(m, i)).join('')}</div><span class="muted small" style="margin-left:10px">${g.members.map(esc).join(', ')}</span></div>
        <div class="row between mt12 small"><span>${b ? `🗺️ ${bCities(b)} ${fmtDate(b.start)}` : '🗺️ 루트 미연결'}</span><span>💸 총 ${won(s.total)} · 1인 ${won(s.share)}</span></div>
      </div>`; }).join('') : '<div class="card"><div class="empty"><span class="em">👯‍♀️</span>아직 그룹방이 없어요</div></div>'}
    <div class="pad"><button class="btn red block" onclick="A.openSheet('newGroup')">＋ 새 그룹방 만들기</button></div>
  </div>`;
}

function scrGroup() {
  const g = S.groups.find(x => x.id === UI.params.id); if (!g) return scrGroups();
  const b = S.bookings.find(x => x.id === g.bookingId); const tab = UI.groupTab;
  let body = '';
  if (tab === 'route') {
    body = b ? `<div class="card flat" style="margin-top:0"><div class="row between"><b>🗺️ ${bCities(b)} 직관 여행</b><span class="muted small">${fmtDate(b.start)}${b.end !== b.start ? ' ~ ' + fmtDate(b.end) : ''}</span></div><div class="muted small mt8">가고 싶은 곳에 👍를 눌러 의견을 모아요!</div></div>${timelineHTML(b.days, { booking: b, group: g })}`
      : `<div class="card"><div class="empty"><span class="em">🗺️</span>연결된 여행 루트가 없어요</div>
        ${S.bookings.length ? S.bookings.map(x => `<button class="opt" style="width:100%;margin:0 0 8px" onclick="A.linkBooking('${g.id}','${x.id}')"><div class="ic">✈️</div><div><div class="t">${bCities(x)} · ${fmtDate(x.start)}</div><div class="d">${bVenueNames(x)}</div></div></button>`).join('') : `<button class="btn red block" onclick="A.go('schedule')">직관 여행 짜러 가기</button>`}</div>`;
  } else if (tab === 'money') {
    const s = settle(g);
    body = `<div class="card ball-card" style="margin-top:0"><div style="padding:0 24px" class="center"><div class="muted small">총 지출</div><div class="jua" style="font-size:32px">${won(s.total)}</div><div class="badge red mt8">${g.members.length}명 n빵 · 1인 ${won(s.share)}</div></div></div>
      <div class="section-title" style="margin-top:6px"><h3>💸 정산하기</h3></div>
      <div class="card">${s.tx.length ? s.tx.map(x => `<div class="settle">${avatar(x.from, g.members.indexOf(x.from))} <span><b>${esc(x.from)}</b> → ${esc(x.to)}</span><b>${won(x.amt)}</b></div>`).join('') + `<button class="btn green block mt12 sm" style="padding:11px" onclick="toast('📩 송금 요청을 보냈어요! (데모)')">💌 송금 요청 보내기</button>` : '<div class="muted center">정산할 금액이 없어요 🎉</div>'}</div>
      <div class="section-title"><h3>🧾 지출 내역</h3></div>
      <div class="card" style="padding:4px 16px">${g.expenses.map(e => `<div class="list-item"><div class="grow"><b>${esc(e.title)}</b><div class="muted small">${esc(e.payer)} 결제</div></div><b>${won(e.amount)}</b><button class="mini-btn red" onclick="A.delExpense('${g.id}','${e.id}')">삭제</button></div>`).join('') || '<div class="empty">지출을 추가해 보세요</div>'}</div>
      <div class="card"><b>＋ 지출 추가</b>
        <div class="row mt8"><input class="input" id="exTitle" placeholder="예: 치킨 & 맥주"><input class="input" id="exAmt" type="number" inputmode="numeric" placeholder="금액" style="max-width:110px"></div>
        <div class="row mt8"><select class="input" id="exPayer">${g.members.map(m => `<option>${esc(m)}</option>`).join('')}</select><button class="btn red sm" style="white-space:nowrap;padding:13px 16px" onclick="A.addExpense('${g.id}')">추가</button></div></div>`;
  } else {
    body = `<div class="chat">${g.msgs.map(m => `<div class="msg ${m.who === '나' ? 'me' : ''}">${m.who === '나' ? '' : `<div class="who">${esc(m.who)}</div>`}<div class="bubble">${esc(m.text)}</div></div>`).join('')}</div>
      <div class="chat-input"><input class="input" id="chatIn" placeholder="메시지 보내기" onkeydown="if(event.key==='Enter')A.sendMsg('${g.id}')"><button class="btn red sm" onclick="A.sendMsg('${g.id}')">전송</button></div>`;
  }
  return `<div class="view" id="groupView">
    ${topbar({ back: "A.go('groups')", title: esc(g.name), extra: `<div class="row mt12"><div class="avatars">${g.members.map((m, i) => avatar(m, i)).join('')}</div><span class="sub" style="margin:0 0 0 10px">${g.members.map(esc).join(' · ')}</span></div>` })}
    <div class="tabs">${[['route', '🗺️ 루트'], ['money', '💸 n빵 정산'], ['chat', '💬 톡']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="UI.groupTab='${k}';render()">${l}</button>`).join('')}</div>
    ${body}
  </div>`;
}

// ---------- sheets ----------
function sheetHTML() {
  const s = UI.sheet; let inner = '';
  if (s.type === 'team') {
    inner = `<h3>최애 구단 변경</h3><div class="team-grid">${TEAMS.map(t => `<button class="team-card ${S.team === t.id ? 'on' : ''}" onclick="A.changeTeam('${t.id}')"><div class="em" style="background:${t.color}">${t.emoji}</div><div><div class="nm">${t.name}</div><div class="st">${VENUES[t.venue].city}</div></div></button>`).join('')}</div>
      <div class="pad"><button class="btn white block" onclick="A.resetAll()">🔄 처음부터 다시 시작 (데이터 초기화)</button></div>`;
  } else if (s.type === 'verify') {
    const done = new Set(S.records.map(r => r.gameId + r.myTeam));
    const cands = SCHED.filter(g => g.date <= TODAY && g.date >= addDays(TODAY, -21) && !done.has(g.id + S.team)).reverse();
    const sel = s.gameId ? gameById(s.gameId) : null;
    inner = `<h3>📸 직관 인증하기</h3>
      <p class="q-sub" style="margin-top:-6px">다녀온 경기를 고르고 인증하면 스탬프가 쾅! 찍혀요</p>
      ${cands.length ? cands.slice(0, 6).map(g => `<button class="opt ${s.gameId === g.id ? 'on' : ''}" onclick="UI.sheet.gameId='${g.id}';render()"><div class="radio"></div><div class="grow"><div class="t">${fmtDate(g.date)} vs ${team(g.opp).short}</div><div class="d">${VENUES[g.venue].name}</div></div><div class="p">${g.result ? `${g.my}:${g.op}` : '<span class="badge red">오늘</span>'}</div></button>`).join('') : '<div class="empty">최근 3주 내 인증 가능한 경기가 없어요</div>'}
      ${sel ? `<div class="pad">
        ${!sel.result ? `<div class="row mb8"><label class="field grow"><span>${team(S.team).short} 점수</span><input class="input" type="number" id="vMy" value="${esc(s.my)}" oninput="UI.sheet.my=this.value"></label><label class="field grow"><span>${team(sel.opp).short} 점수</span><input class="input" type="number" id="vOp" value="${esc(s.op)}" oninput="UI.sheet.op=this.value"></label></div>` : ''}
        <div class="row" style="align-items:stretch">
          <label class="upload-box grow"><input type="file" accept="image/*" hidden onchange="A.photo(this)">${s.photo ? `<img src="${s.photo}">` : '<div style="font-size:28px">🎫</div><b>티켓·입장 사진</b><div class="muted small">눌러서 업로드</div>'}</label>
          <button class="upload-box grow" onclick="A.locate()" style="${s.loc ? 'border-color:var(--grass);background:var(--grass-light)' : ''}"><div style="font-size:28px">${s.loc ? '✅' : '📍'}</div><b>${s.loc ? '위치 인증 완료' : '위치로 인증'}</b><div class="muted small">${s.loc ? esc(s.locMsg || '') : '경기장 근처인지 확인'}</div></button>
        </div>
        <button class="btn red block mt16" ${s.photo || s.loc ? '' : 'disabled'} onclick="A.verify()">스탬프 받기 ⚾</button></div>` : ''}`;
  } else if (s.type === 'img') {
    inner = `<h3>📲 결산 카드 저장하기</h3><p class="q-sub" style="margin-top:-6px">휴대폰은 이미지를 <b>길게 눌러</b>, PC는 <b>우클릭 → 이미지 저장</b>으로 저장한 뒤 인스타 스토리에 올려주세요!</p>
      <img class="img-preview" src="${s.src}" alt="오늘의 직관 결산 카드">
      <div class="pad"><button class="btn white block" onclick="A.closeSheet()">닫기</button></div>`;
  } else if (s.type === 'newGroup') {
    inner = `<h3>＋ 새 그룹방</h3><div class="pad" style="padding-top:0">
      <label class="field"><span>그룹방 이름</span><input class="input" id="ngName" placeholder="예: 대전 원정대 🦅"></label>
      <label class="field"><span>함께할 친구 (쉼표로 구분)</span><input class="input" id="ngMembers" placeholder="예: 민지, 서연, 하은"></label>
      <button class="btn red block" onclick="A.createGroup()">만들기</button></div>`;
  }
  return `<div class="sheet-bg" onclick="if(event.target===this)A.closeSheet()"><div class="sheet"><div class="grab"></div>${inner}</div></div>`;
}

// ---------- recap canvas ----------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function stitchArc(ctx, cx, cy, rad, a0, a1, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.setLineDash([30, 22]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a1); ctx.stroke(); ctx.restore();
}
async function drawRecap() {
  const c = $('#recapCanvas'); if (!c) return;
  const r = S.records.find(x => x.id === UI.params.id); if (!r) return;
  try { await Promise.all([document.fonts.load('80px Jua'), document.fonts.load('700 36px "Noto Sans KR"')]); } catch (e) { }
  const ctx = c.getContext('2d'); const W = 1080, H = 1920; const t = team(r.myTeam), o = team(r.opp); const v = VENUES[r.venue];
  const theme = UI.recapTheme; const JUA = s => `${s}px Jua, "Malgun Gothic", sans-serif`; const SANS = (s, w = 700) => `${w} ${s}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
  ctx.clearRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // background
  if (theme === 'grass') {
    for (let x = 0; x < W; x += 120) { ctx.fillStyle = (x / 120) % 2 ? '#37AE5A' : '#2E9E4F'; ctx.fillRect(x, 0, 120, H); }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 8; ctx.setLineDash([24, 18]); ctx.beginPath(); ctx.moveTo(0, 1780); ctx.lineTo(W, 1780); ctx.stroke(); ctx.setLineDash([]);
  } else if (theme === 'ball') {
    ctx.fillStyle = '#FFFBF3'; ctx.fillRect(0, 0, W, H);
    stitchArc(ctx, -420, 960, 700, -1.2, 1.2, '#E63946'); stitchArc(ctx, W + 420, 960, 700, Math.PI - 1.2, Math.PI + 1.2, '#E63946');
  } else {
    const gr = ctx.createLinearGradient(0, 0, W, H); gr.addColorStop(0, t.color); gr.addColorStop(1, '#111'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    stitchArc(ctx, W / 2, -300, 700, 0.3, Math.PI - 0.3, 'rgba(255,255,255,.35)');
  }
  const onDark = theme !== 'ball';
  ctx.fillStyle = onDark ? '#fff' : '#1F2A22';
  ctx.font = JUA(70); ctx.fillText('⚾ 직관메이트', W / 2, 150);
  ctx.font = SANS(34, 800); ctx.globalAlpha = .85; ctx.fillText("TODAY'S  GAME  RECAP", W / 2, 230); ctx.globalAlpha = 1;
  // card
  const cx = 80, cy = 300, cw = W - 160, ch = 1360;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = '#fff'; rr(ctx, cx, cy, cw, ch, 64); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle = '#E63946'; ctx.lineWidth = 6; ctx.setLineDash([22, 16]); rr(ctx, cx + 24, cy + 24, cw - 48, ch - 48, 48); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#6B7A70'; ctx.font = SANS(36, 600); ctx.fillText(`${fmtFull(r.date)}  ·  ${v.name}`, W / 2, cy + 100);
  // teams
  const drawTeam = (tm, x) => { ctx.fillStyle = tm.color; ctx.beginPath(); ctx.arc(x, cy + 290, 110, 0, Math.PI * 2); ctx.fill(); ctx.font = '110px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.fillText(tm.emoji, x, cy + 296); ctx.fillStyle = '#1F2A22'; ctx.font = JUA(50); ctx.fillText(tm.short, x, cy + 460); };
  drawTeam(t, 250); drawTeam(o, W - 250);
  ctx.fillStyle = '#1F2A22'; ctx.font = JUA(150); ctx.fillText(`${r.my}:${r.op}`, W / 2, cy + 300);
  // result
  const res = r.result === 'W' ? ['WIN!  승리요정 등극 🧚‍♀️', '#E63946'] : r.result === 'L' ? ['LOSE  그래도 내 팀 💪', '#7d8a80'] : ['DRAW  끝까지 짜릿했다 🤝', '#E0A800'];
  ctx.fillStyle = res[1]; rr(ctx, 170, cy + 540, W - 340, 120, 60); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = JUA(56); ctx.fillText(res[0], W / 2, cy + 603);
  // stats
  const st = stats(); const boxes = [[`${st.n}회`, '시즌 직관'], [`${st.w}승 ${st.l}패`, '직관 전적'], [`${st.rate}%`, '직관 승률']];
  boxes.forEach((b, i) => { const bx = cx + 60 + i * ((cw - 120) / 3), bw = (cw - 120) / 3 - 20; ctx.fillStyle = '#E7F6EA'; rr(ctx, bx, cy + 720, bw, 190, 34); ctx.fill(); ctx.fillStyle = '#1C6E36'; ctx.font = JUA(54); ctx.fillText(b[0], bx + bw / 2, cy + 795); ctx.fillStyle = '#6B7A70'; ctx.font = SANS(30, 600); ctx.fillText(b[1], bx + bw / 2, cy + 862); });
  // route
  const places = (r.places && r.places.length ? r.places : SPOTS[r.venue].slice(0, 3).map(s => s.emoji + ' ' + s.name)).slice(0, 3);
  ctx.textAlign = 'left'; ctx.fillStyle = '#1F2A22'; ctx.font = JUA(44); ctx.fillText('🗺️ 오늘의 직관 루트', cx + 80, cy + 990);
  ctx.font = SANS(36, 600); places.forEach((pl, i) => { ctx.fillStyle = '#E63946'; ctx.beginPath(); ctx.arc(cx + 100, cy + 1065 + i * 70, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillText(pl.length > 22 ? pl.slice(0, 22) + '…' : pl, cx + 130, cy + 1066 + i * 70); });
  // stamp
  ctx.save(); ctx.translate(cx + cw - 190, cy + 1120); ctx.rotate(-0.25); ctx.strokeStyle = '#E63946'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#E63946'; ctx.font = JUA(40); ctx.fillText('직관인증', 0, -14); ctx.font = JUA(34); const nth = S.records.filter(x => x.myTeam === r.myTeam && x.date <= r.date).length; ctx.fillText(`#${nth}번째`, 0, 34); ctx.restore();
  // companion
  ctx.textAlign = 'center'; ctx.fillStyle = '#6B7A70'; ctx.font = SANS(34, 600);
  const comp = COMPANIONS.find(cc => cc.id === r.companion); ctx.fillText(comp ? `${comp.emoji} ${comp.label}${r.people > 1 ? ` ${r.people}명` : ''} 함께한 직관` : `${t.emoji} ${t.nick}와 함께한 하루`, W / 2, cy + ch - 70);
  // bottom
  ctx.fillStyle = onDark ? '#fff' : '#1F2A22'; ctx.font = JUA(46); ctx.fillText(`#직관메이트  #${t.nick}  #${r.result === 'W' ? '승리요정' : '찐팬인증'}`, W / 2, 1745);
  ctx.font = SANS(28, 600); ctx.globalAlpha = .7; ctx.fillText(S.nickname ? `@${S.nickname}` : 'jikgwan.mate', W / 2, 1840); ctx.globalAlpha = 1;
}

// ---------- seed demo ----------
function seedDemo() {
  const past = SCHED.filter(g => g.result).reverse();
  const wins = past.filter(g => g.result === 'W').slice(0, 3); const loss = past.filter(g => g.result === 'L').slice(0, 1);
  [...wins, ...loss].forEach(g => {
    const sp = sortPool(SPOTS[g.venue], 'friends', g.id).slice(0, 3).map(s => s.emoji + ' ' + s.name);
    S.records.push({ id: uid(), gameId: g.id, myTeam: S.team, date: g.date, opp: g.opp, venue: g.venue, my: g.my, op: g.op, result: g.result, method: 'demo', companion: 'friends', people: 3, places: sp });
  });
  if (!S.groups.length) {
    S.groups.push({
      id: uid(), name: `${team(S.team).nick} 원정대 ⚾`, members: ['나', '민지', '서연', '하은'], bookingId: null, votes: {},
      expenses: [{ id: uid(), title: 'KTX 왕복 4인', amount: 190400, payer: '나' }, { id: uid(), title: '숙소 1박 (2실)', amount: 178000, payer: '민지' }, { id: uid(), title: '야구장 치킨 & 음료', amount: 62000, payer: '서연' }],
      msgs: [{ who: '민지', text: '이번 원정 진짜 가는 거지?? 🔥' }, { who: '서연', text: '나 유니폼 새로 샀어 ㅋㅋ' }, { who: '나', text: '루트 짜서 올릴게! 맛집 예약도 해둘게 🍽️' }, { who: '하은', text: '응원봉 4개 챙길게 📣' }],
    });
  }
}

// ---------- actions ----------
const A = {
  go(route, params = {}) { UI.menu = false; if (route !== 'off' || UI.params.id !== params.id) UI.ev = null; UI.route = route; UI.params = params; UI.sheet = null; UI._key = null; if (route === 'group' && UI._gid !== params.id) { UI.groupTab = 'route'; UI._gid = params.id; } render(); },
  // onboarding
  obPick(id) { UI.obTeam = id; render(); },
  obNext() { UI.ob = 2; render(); },
  obBack() { UI.ob = 1; render(); },
  obDone() {
    S.nickname = $('#obNick').value.trim(); S.region = $('#obRegion').value; S.address = $('#obAddr').value.trim();
    S.team = UI.obTeam; refreshSched(); if (!S.records.some(r => r.myTeam === S.team)) seedDemo(); save();
    UI.route = 'home'; render(); confetti(); toast(`${team(S.team).emoji} ${team(S.team).nick} 팬 등록 완료! 데모 직관 기록 4개를 넣어뒀어요`);
  },
  changeTeam(id) { S.team = id; refreshSched(); if (!S.records.some(r => r.myTeam === id)) seedDemo(); save(); UI.selDate = null; UI.sheet = null; render(); toast(`${team(id).emoji} ${team(id).name}(으)로 변경했어요`); },
  resetAll() { try { localStorage.removeItem(STORE); } catch (e) { } S = load(); UI.ob = 1; UI.obTeam = null; UI.sheet = null; UI.route = 'home'; refreshSched(); render(); },
  openSheet(type) { UI.sheet = { type }; render(); },
  closeSheet() { UI.sheet = null; render(); },
  // calendar
  calMove(d, mode) {
    const key = mode === 'range' ? 'planMonth' : 'calMonth'; const [y, m] = UI[key].split('-').map(Number);
    const nd = new Date(y, m - 1 + d, 1); UI[key] = `${nd.getFullYear()}-${pad2(nd.getMonth() + 1)}`; render();
  },
  calTap(ds, mode) {
    if (mode === 'browse') { UI.selDate = ds; render(); return; }
    const p = UI.plan;
    if (ds < TODAY) return toast('지난 날짜는 선택할 수 없어요');
    if (!p.selecting || ds < p.start) { p.start = ds; p.end = ds; p.selecting = true; }
    else { if (daysBetween(p.start, ds) > 4) return toast('최대 4박 5일까지 선택할 수 있어요'); p.end = ds; p.selecting = false; }
    A._fixAnchor(); render();
  },
  _fixAnchor() { const p = UI.plan; const gs = planGames(p); if (gs.length && !gs.some(g => g.id === p.gameId)) p.gameId = gs[0].id; p.stays = {}; },
  quickRange(kind) {
    const p = UI.plan; const g = gameById(p.gameId); p.selecting = false;
    if (kind === 0) { p.start = p.end = g.date; }
    else if (kind === 1) { p.start = g.date; p.end = addDays(g.date, 1); }
    else { const s = seriesOf(g).filter(x => x.date >= TODAY); p.start = s[0].date; p.end = s[s.length - 1].date; }
    A._fixAnchor(); render();
  },
  // plan wizard
  startPlan(gameId) {
    const g = gameById(gameId);
    UI.plan = { gameId, start: g.date, end: g.date, companion: 'friends', people: 2, region: S.region, address: S.address, mode: null, outIdx: 1, inIdx: 0, stays: {}, step: 0, days: null, routeSeed: 0, selecting: false };
    UI.planMonth = g.date.slice(0, 7); A.go('plan');
  },
  planPrev() { const p = UI.plan; if (p.step === 0) return A.go('schedule'); p.step--; UI._key = null; render(); },
  planNext() {
    const p = UI.plan; const keys = stepKeys(p);
    if (keys[p.step] === 'confirm') return A.book();
    if (keys[p.step] === 'move') { S.region = p.region; S.address = p.address; save(); }
    p.step++; UI._key = null; render();
  },
  setComp(id) { const p = UI.plan; p.companion = id; p.people = id === 'solo' ? 1 : id === 'couple' ? 2 : Math.max(p.people, id === 'family' ? 3 : 2); render(); },
  people(d) { const p = UI.plan; p.people = Math.min(8, Math.max(2, p.people + d)); render(); },
  setRegion(v) { UI.plan.region = v; UI.plan.mode = null; render(); },
  setMode(m) { UI.plan.mode = m; render(); },
  setOut(i) { UI.plan.outIdx = i; render(); },
  setIn(i) { UI.plan.inIdx = i; render(); },
  setStay(id, venue) { UI.plan.stays[venue] = id; render(); },
  reroll() { UI.plan.routeSeed++; UI.plan.days = null; render(); toast('🎲 새로운 루트를 추천했어요!'); },
  reserve(di, ii) {
    const it = UI.plan.days[di].items[ii]; it.reserved = !it.reserved; render();
    if (it.reserved) toast(`${it.cat === 'food' ? '🍽️' : '🎟️'} ${it.title} ${hm(it.time)} ${UI.plan.people}명 예약 완료!`);
  },
  reserveAll() {
    let n = 0; UI.plan.days.forEach(d => d.items.forEach(it => { if (it.kind === 'spot' && it.reservable && !it.reserved) { it.reserved = true; n++; } }));
    render(); toast(n ? `✨ ${n}곳 한 번에 예약 완료!` : '이미 모두 예약했어요');
  },
  swap(di, ii) {
    const p = UI.plan; const it = p.days[di].items[ii];
    const used = new Set(p.days.flatMap(d => d.items).filter(x => x.spotId).map(x => x.spotId));
    const pool = sortPool(SPOTS[p.days[di].venue || venueOfPlan(p)], p.companion, uid()).filter(s => !used.has(s.id));
    const s = pool.find(x => x.cat === it.cat) || pool[0];
    if (!s) return toast('더 추천할 곳이 없어요 😅');
    p.days[di].items[ii] = { ...it, spotId: s.id, emoji: s.emoji, title: s.name, desc: s.desc, dur: s.dur, cat: s.cat, price: s.price, partner: !!s.partner, reservable: !!s.reserve, reserved: false };
    render();
  },
  book() {
    const p = UI.plan; const c = costs(p);
    const vs = planVenues(p); const stays = Object.fromEntries(c.stays.map(x => [x.venue, x.stay ? x.stay.id : null]));
    const b = { id: uid(), gameId: p.gameId, venue: vs[0], venues: vs, start: p.start, end: p.end, companion: p.companion, people: p.people, region: p.region, mode: p.mode, stayId: stays[vs[0]] || null, stays, days: p.days, cost: { total: c.total, transport: c.transport, stay: c.stayCost - c.stayDisc }, createdAt: Date.now() };
    S.bookings.push(b); save(); UI.plan = null; A.go('done', { id: b.id }); confetti();
  },
  cancelBooking(id) { S.bookings = S.bookings.filter(b => b.id !== id); S.groups.forEach(g => { if (g.bookingId === id) g.bookingId = null; }); save(); A.go('home'); toast('예약을 취소했어요'); },
  // groups
  makeGroup(bid) {
    const b = S.bookings.find(x => x.id === bid); const v = VENUES[b.venue];
    const names = b.companion === 'family' ? FAMILY_NAMES : b.companion === 'couple' ? ['자기💕'] : FRIEND_NAMES;
    const members = ['나', ...names.slice(0, b.people - 1)];
    const o = travelOptions(b.region, b.venue, b.people).find(x => x.mode === b.mode) || travelOptions(b.region, b.venue, b.people)[0];
    const exps = [{ id: uid(), title: `${o.label} ${b.venues && b.venues.length > 1 ? '교통(도시 이동 포함)' : '왕복'} ${b.people}인`, amount: b.cost.transport, payer: '나' }];
    if (b.cost.stay) exps.push({ id: uid(), title: '숙소', amount: b.cost.stay, payer: '나' });
    const g = { id: uid(), name: `${bCities(b)} 직관 원정대 ${team(S.team).emoji}`, members, bookingId: b.id, votes: {}, expenses: exps, msgs: [{ who: '나', text: `${fmtDate(b.start)} ${bCities(b)} 직관 여행 예약했어! 루트 확인하고 👍 눌러줘~` }] };
    S.groups.unshift(g); save(); A.go('group', { id: g.id }); toast('👥 그룹방을 만들었어요! 교통·숙소비가 자동으로 추가됐어요');
  },
  createGroup() {
    const name = $('#ngName').value.trim() || '새 직관 그룹 ⚾';
    const ms = $('#ngMembers').value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 9);
    const g = { id: uid(), name, members: ['나', ...(ms.length ? ms : ['친구1'])], bookingId: null, votes: {}, expenses: [], msgs: [{ who: '나', text: '그룹방 만들었어! 같이 직관 가자 ⚾' }] };
    S.groups.unshift(g); save(); A.go('group', { id: g.id });
  },
  linkBooking(gid, bid) { const g = S.groups.find(x => x.id === gid); g.bookingId = bid; save(); render(); toast('🗺️ 여행 루트를 공유했어요'); },
  vote(gid, k) { const g = S.groups.find(x => x.id === gid); g.votes = g.votes || {}; g.votes[k] = g.votes[k] ? 0 : 1 + Math.floor(Math.random() * (g.members.length - 1)); save(); render(); },
  addExpense(gid) {
    const g = S.groups.find(x => x.id === gid); const title = $('#exTitle').value.trim(); const amount = parseInt($('#exAmt').value, 10);
    if (!title || !amount) return toast('내용과 금액을 입력해 주세요');
    g.expenses.push({ id: uid(), title, amount, payer: $('#exPayer').value }); save(); render(); toast('🧾 지출을 추가했어요');
  },
  delExpense(gid, eid) { const g = S.groups.find(x => x.id === gid); g.expenses = g.expenses.filter(e => e.id !== eid); save(); render(); },
  sendMsg(gid) {
    const g = S.groups.find(x => x.id === gid); const el = $('#chatIn'); const text = el.value.trim(); if (!text) return;
    g.msgs.push({ who: '나', text }); save(); render(); A._scrollBottom();
    const others = g.members.filter(m => m !== '나'); if (!others.length) return;
    const replies = ['좋아좋아 👍', 'ㅋㅋㅋ 완전 찬성', '오늘 무조건 이긴다 🔥', '나 정산 바로 할게!', '헐 거기 맛집이래 😋', '응원가 연습해 가야지 📣'];
    setTimeout(() => { g.msgs.push({ who: others[Math.floor(Math.random() * others.length)], text: replies[Math.floor(Math.random() * replies.length)] }); save(); if (UI.route === 'group' && UI.groupTab === 'chat') { render(); A._scrollBottom(); } }, 1100);
  },
  _scrollBottom() { const v = $('.view'); if (v) v.scrollTop = v.scrollHeight; },
  // verify
  photo(input) { const f = input.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { UI.sheet.photo = fr.result; render(); }; fr.readAsDataURL(f); },
  locate() {
    const g = gameById(UI.sheet.gameId); const v = VENUES[g.venue];
    const ok = msg => { UI.sheet.loc = true; UI.sheet.locMsg = msg; render(); };
    if (!navigator.geolocation) return ok('데모 인증');
    toast('📍 위치 확인 중...');
    navigator.geolocation.getCurrentPosition(pos => {
      const d = distKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, v);
      if (d < 1.5) ok(`${v.name} 근처 확인!`); else { ok('데모 인증'); toast(`경기장에서 ${Math.round(d)}km 떨어져 있지만, 데모라서 인증해 드릴게요 😉`); }
    }, () => ok('데모 인증'), { timeout: 3000 });
  },
  verify() {
    const s = UI.sheet; const g = gameById(s.gameId); let my = g.my, op = g.op;
    if (!g.result) { my = parseInt(s.my, 10); op = parseInt(s.op, 10); if (isNaN(my) || isNaN(op)) return toast('경기 점수를 입력해 주세요'); }
    const before = stats().w;
    const bk = S.bookings.find(b => g.date >= b.start && g.date <= b.end);
    const places = bk ? bk.days.flatMap(d => d.items).filter(i => i.kind === 'spot').map(i => i.emoji + ' ' + i.title) : [];
    const rec = { id: uid(), gameId: g.id, myTeam: S.team, date: g.date, opp: g.opp, venue: g.venue, my, op, result: my > op ? 'W' : my < op ? 'L' : 'D', method: s.photo ? 'photo' : 'location', companion: bk?.companion, people: bk?.people || 1, places };
    S.records.push(rec); save(); UI.sheet = null; UI.lastStamp = rec.id; render();
    const unlockedNow = REWARDS.find(r => r.wins > before && r.wins <= stats().w);
    if (rec.result === 'W') confetti();
    setTimeout(() => toast(unlockedNow ? `🎉 ${unlockedNow.wins}승 달성! ${unlockedNow.emoji} ${unlockedNow.title} 쿠폰 획득!` : rec.result === 'W' ? '🧚‍♀️ 승리 스탬프 쾅! 승리요정 인증' : '⚾ 직관 스탬프 쾅! 다음엔 꼭 이기자'), 300);
    setTimeout(() => UI.lastStamp = null, 1000);
  },
  // recap
  shareRecap() {
    const src = $('#recapCanvas').toDataURL('image/png');
    UI.sheet = { type: 'img', src }; render();
  },
  saveRecap() { A.shareRecap(); },
  // tving
  tv(k, v) { S.tving[k] = v; save(); render(); },
  tvJoin() { S.tving.joined = true; save(); render(); confetti(); toast('📺 티빙 파티 결제 완료! (데모)'); },
  copyInvite() { const link = `https://jikgwan.mate/tving/${uid()}`; Promise.resolve().then(() => navigator.clipboard.writeText(link)).then(() => toast('🔗 초대 링크를 복사했어요'), () => toast('🔗 초대 링크: ' + link)); },
};
window.A = A; window.UI = UI; window.toast = toast; window.render = render;

// ---------- render ----------
function render() {
  const app = $('#app');
  const key = UI.route + '|' + (UI.plan?.step ?? '') + '|' + (UI.params.id || '') + '|' + UI.ob;
  const view = app.querySelector('.view'); const st = key === UI._key && view ? view.scrollTop : 0; UI._key = key;
  const dsc = app.querySelector('.drawer-body')?.scrollTop || 0;
  let html;
  if (!S.team) html = scrOnboard();
  else html = ({ home: scrHome, schedule: scrSchedule, plan: scrPlan, done: scrDone, booking: scrBooking, records: scrRecords, recap: scrRecap, tving: scrTving, groups: scrGroups, group: scrGroup, off: scrOff })[UI.route]?.() || scrHome();
  const navOn = { home: 'home', schedule: 'schedule', records: 'records', recap: 'records', booking: 'home', done: 'home' }[UI.route];
  const showNav = S.team && UI.route !== 'plan';
  app.innerHTML = html + (showNav ? navHTML(navOn) : '') + (UI.menu && S.team ? menuHTML() : '') + (UI.sheet ? sheetHTML() : '');
  const v = app.querySelector('.view'); if (v) { v.style.scrollBehavior = 'auto'; v.scrollTop = st; requestAnimationFrame(() => { v.style.scrollBehavior = ''; }); }
  const db = app.querySelector('.drawer-body'); if (db && !UI.menuAnim) db.scrollTop = dsc;
  if (S.team && UI.route === 'home') fillWeather();
  if (S.team && UI.route === 'recap') drawRecap();
  if (S.team && UI.route === 'off' && UI.params.id === 'yearlog') drawYear();
}

// PC에서도 마우스로 끌어서 스크롤 (폰처럼)
(() => {
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const v = e.target.closest('.view, .drawer-body, .sheet');
    if (!v || e.target.closest('input, select, textarea, canvas, label')) return;
    drag = { v, y: e.clientY, top: v.scrollTop, moved: false };
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.v.classList.add('dragging'); }
    drag.v.scrollTop = drag.top - dy;
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null; d.v.classList.remove('dragging');
    if (!d.moved) return;
    const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', eat, { capture: true }), 60);
  });
})();

// offseason.js 로드 후 첫 렌더
document.addEventListener('DOMContentLoaded', () => { refreshSched(); render(); });
