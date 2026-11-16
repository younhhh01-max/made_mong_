'use strict';
/* =========================================================
   직관메이트 - 비시즌 메뉴 (오른쪽 위 ☰ → 월별 폴더)
   app.js 다음에 로드돼요. (S, UI, A, render 등을 사용)
   ========================================================= */

// ---------- 시즌 기준 ----------
const _now = parse(TODAY);
const SEASON = _now.getMonth() + 1 >= 4 ? _now.getFullYear() : _now.getFullYear() - 1; // 결산할 시즌
const NEXT = SEASON + 1;                                                               // 다가올 시즌
const nthDow = (y, m, dow, n) => { const d = new Date(y, m - 1, 1); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + (n - 1) * 7); return ymd(d); };
const firstDowFrom = (s, dow) => { const d = parse(s); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); return ymd(d); };

// ---------- 메뉴 폴더 구조 ----------
// 메인 화면엔 직관 예약·여행 루트·기록만 두고, 나머지는 전부 이 메뉴로 모아요
const MAIN_FOLDERS = [
  { id: 'with', label: '함께하기', title: '친구와 나누고 정산하기', items: [
    { id: 'groups', route: 'groups', emoji: '👥', title: '그룹방', desc: '루트 공유 · n빵 정산 · 단톡' },
    { id: 'tving', route: 'tving', emoji: '📺', title: '티빙 n빵 파티', desc: '못 가는 날엔 4명이 나눠서 중계 보기' },
  ] },
  { id: 'set', label: '설정', title: '내 정보', items: [
    { id: 'team', act: "A.closeMenu();A.openSheet('team')", emoji: '🎨', title: '최애 구단 변경', desc: '구단 바꾸기 · 데이터 초기화' },
  ] },
];
const OFF_FOLDERS = [
  { id: 'look', months: [11, 12], label: '11~12월', title: '시즌을 되돌아보는 시기', items: [
    { id: 'yearlog', emoji: '📊', title: `${SEASON} 나의 직관로그`, desc: '직관 횟수·승률·승요 등급 결산 카드', tag: 'HOT' },
    { id: 'event', emoji: '🎉', title: '팬 행사 원정 루트', desc: '팬페스타·골든글러브 교통·숙박 묶음' },
  ] },
  { id: 'plan', months: [1], label: '1월', title: '다음 시즌을 계획하는 시기', items: [
    { id: 'bucket', emoji: '📌', title: '원정 플래너 & 버킷리스트', desc: '가고 싶은 원정 찜 → KTX·숙소 알림' },
    { id: 'stadium', emoji: '🏟️', title: '구장 도장깨기', desc: '9개 구장 정복하고 쿠폰 받기' },
  ] },
  { id: 'camp', months: [2], label: '2월', title: '스프링캠프', items: [
    { id: 'camp', emoji: '✈️', title: '스프링캠프 참관 투어', desc: '오키나와·미야자키 전지훈련 보러 가기', tag: '2단계' },
  ] },
  { id: 'open', months: [3], label: '3월', title: '시범경기와 개막', items: [
    { id: 'preseason', emoji: '🌱', title: '시범경기 첫 직관', desc: '부담 없이 첫 직관 기록 쌓기' },
    { id: 'early', emoji: '🐣', title: '개막 얼리버드', desc: '개막 시리즈·첫 원정 미리 예약' },
  ] },
];
const ALL_FOLDERS = () => [...MAIN_FOLDERS, ...OFF_FOLDERS];
const OFF_ITEMS = OFF_FOLDERS.flatMap(f => f.items.map(i => ({ ...i, folder: f.id })));
const nowFolder = () => (OFF_FOLDERS.find(f => f.months.includes(_now.getMonth() + 1)) || {}).id;
const offState = () => { S.off = Object.assign({ bucket: {}, events: {}, campAlert: false, pre: {}, early: null }, S.off || {}); return S.off; };
UI.menu = false; UI.menuOpen = { with: true, [nowFolder() || 'look']: true }; UI.ev = null;

// ---------- 메뉴(드로어) ----------
function menuBtnHTML() { return S.team ? `<button class="menu-btn" onclick="A.openMenu()" aria-label="전체 메뉴"><i></i><i></i><i></i></button>` : ''; }
const itemOn = i => i.route ? (UI.route === i.route || (i.route === 'groups' && UI.route === 'group')) : !i.act && UI.route === 'off' && UI.params.id === i.id;
function menuHTML() {
  const cur = nowFolder();
  return `<div class="drawer-bg ${UI.menuAnim ? 'anim' : ''}" onclick="if(event.target===this)A.closeMenu()"><aside class="drawer">
    <div class="drawer-head"><div><div class="jua" style="font-size:22px">⚾ 전체 메뉴</div><div class="small" style="opacity:.85;margin-top:2px">그룹방·n빵·비시즌 기능을 모아 뒀어요</div></div>
      <button class="drawer-x" onclick="A.closeMenu()" aria-label="닫기">✕</button></div>
    <div class="drawer-body">
      ${ALL_FOLDERS().map(f => { const open = !!UI.menuOpen[f.id]; return `
      ${f.id === OFF_FOLDERS[0].id ? '<div class="drawer-sec">❄️ 비시즌</div>' : f.id === MAIN_FOLDERS[0].id ? '<div class="drawer-sec">⚾ 직관메이트</div>' : ''}
      <div class="folder ${open ? 'open' : ''}">
        <button class="folder-head" onclick="A.toggleFolder('${f.id}')">
          <span class="folder-ic">${open ? '📂' : '📁'}</span>
          <span class="grow"><b>${f.label}</b> <span class="muted small">${f.title}</span>${f.id === cur ? ' <span class="badge red">지금</span>' : ''}</span>
          <span class="muted small">${f.items.length}</span><span class="chev">›</span>
        </button>
        ${open ? `<div class="folder-items">${f.items.map(i => `
          <button class="folder-item ${itemOn(i) ? 'on' : ''}" onclick="${i.act || (i.route ? `A.go('${i.route}')` : `A.go('off',{id:'${i.id}'})`)}">
            <span class="em">${i.emoji}</span><span class="grow"><b>${i.title}</b>${i.tag ? ` <span class="badge ${i.tag === 'HOT' ? 'red' : 'gold'}">${i.tag}</span>` : ''}<span class="d">${i.desc}</span></span>
          </button>`).join('')}</div>` : ''}
      </div>`; }).join('')}
      <p class="muted small" style="margin:14px 4px 0">※ 프로토타입: 일정·가격·행사 정보는 샘플이에요</p>
    </div>
  </aside></div>`;
}
const offHead = (id, sub) => { const it = OFF_ITEMS.find(i => i.id === id); const f = OFF_FOLDERS.find(x => x.id === it.folder); return topbar({ back: 'A.offBack()', title: `${it.emoji} ${it.title}`, sub, extra: `<div class="crumb mt8">📁 ${f.label} · ${f.title}</div>` }); };

// ---------- 데이터 (샘플) ----------
const venueVisits = () => { const m = {}; S.records.forEach(r => { (m[r.venue] = m[r.venue] || []).push(r); }); return m; };
function yearStats() {
  const rs = S.records.filter(r => r.myTeam === S.team && r.date.startsWith(String(SEASON)));
  const w = rs.filter(r => r.result === 'W').length, l = rs.filter(r => r.result === 'L').length, d = rs.filter(r => r.result === 'D').length;
  const rate = w + l ? Math.round(w / (w + l) * 100) : 0;
  const cnt = {}; rs.forEach(r => cnt[r.venue] = (cnt[r.venue] || 0) + 1);
  const topV = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  const away = rs.filter(r => r.venue !== team(S.team).venue).length;
  const places = rs.reduce((a, r) => a + (r.places || []).length, 0);
  const g = rs.length === 0 ? { k: '-', name: '직관 대기 중', em: '🎫' } : rate >= 70 ? { k: 'S', name: '공식 승리요정', em: '🧚‍♀️' } : rate >= 55 ? { k: 'A', name: '승리요정 꿈나무', em: '✨' } : rate >= 40 ? { k: 'B', name: '반반 요정', em: '⚖️' } : { k: 'C', name: '보살 찐팬', em: '🙏' };
  return { rs, n: rs.length, w, l, d, rate, topV: topV ? { key: topV[0], n: topV[1] } : null, away, places, grade: g, venues: Object.keys(cnt).length };
}
function offEvents() {
  const t = team(S.team);
  const ff = nthDow(SEASON, 12, 6, 1), gg = nthDow(SEASON, 12, 5, 2);
  return [
    { id: 'fanfest', emoji: t.emoji, title: `${t.nick} 팬페스타 ${SEASON}`, date: ff, time: '14:00', venue: t.venue, place: `${VENUES[t.venue].city} · ${VENUES[t.venue].name} 일대`, desc: '선수 토크쇼 · 사인회 · 팬 미니게임' },
    { id: 'golden', emoji: '🏆', title: `${SEASON} KBO 골든글러브 시상식`, date: gg, time: '16:00', venue: 'jamsil', place: '서울 · 시상식장 (추후 발표)', desc: '레드카펫 · 시상식 현장 응원' },
  ];
}
function nextSeason() {
  const r = rng('next-' + S.team + NEXT); const my = team(S.team);
  const opps = TEAMS.filter(t => t.id !== S.team);
  for (let i = opps.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opps[i], opps[j]] = [opps[j], opps[i]]; }
  const opening = firstDowFrom(`${NEXT}-03-21`, 6);
  const openOpp = opps[0]; const openHome = r() < 0.5;
  const openSeries = [0, 1].map(k => ({ date: addDays(opening, k), opp: openOpp.id, venue: openHome ? my.venue : openOpp.venue, home: openHome, time: '14:00' }));
  // 원정 시리즈 (상대 홈구장, 금~일)
  let fri = firstDowFrom(`${NEXT}-04-03`, 5); const away = [];
  opps.forEach((o, i) => {
    if (o.venue === my.venue) return;
    const d = addDays(fri, i * 14 + (r() < 0.5 ? 0 : 7));
    away.push({ key: `${NEXT}-${o.id}`, opp: o.id, venue: o.venue, start: d, end: addDays(d, 2) });
  });
  away.sort((a, b) => a.start.localeCompare(b.start));
  const firstAway = away[0];
  // 시범경기 (3월 초중순 평일 13:00)
  const pre = []; let d = firstDowFrom(`${NEXT}-03-08`, 2);
  for (let i = 0; pre.length < 8; i++) {
    const dow = parse(d).getDay();
    if (dow !== 1) { const o = opps[(i + 1) % opps.length]; const home = r() < 0.5; pre.push({ id: 'p' + d, date: d, opp: o.id, venue: home ? my.venue : o.venue, home, time: '13:00' }); }
    d = addDays(d, 1);
  }
  return { opening, openSeries, away, firstAway, pre };
}
const cheapest = (venueKey, people) => travelOptions(S.region, venueKey, people).reduce((a, b) => a.total <= b.total ? a : b);

// ---------- 화면들 ----------
function scrOff() {
  offState();
  const id = UI.params.id;
  const f = { yearlog: offYearlog, event: offEvent, bucket: offBucket, stadium: offStadium, camp: offCamp, preseason: offPreseason, early: offEarly }[id];
  return f ? f() : scrHome();
}

function offYearlog() {
  const y = yearStats(); const t = team(S.team);
  return `<div class="view">
    ${offHead('yearlog', '스포티파이 연말결산처럼, 나의 한 시즌을 카드 한 장으로!')}
    ${y.n ? `<div class="card lift">
      <div class="stat-row"><div><b>${y.n}</b><span>직관 횟수</span></div><div><b style="color:var(--stitch)">${y.rate}%</b><span>${y.w}승 ${y.l}패${y.d ? ' ' + y.d + '무' : ''}</span></div><div><b>${y.grade.em} ${y.grade.k}</b><span>승요 등급</span></div></div>
      <hr class="stitch">
      <div class="sum-row"><span>🏟️ 가장 많이 간 구장</span><b>${y.topV ? `${VENUES[y.topV.key].name} (${y.topV.n}회)` : '-'}</b></div>
      <div class="sum-row"><span>🚄 원정 직관</span><b>${y.away}회</b></div>
      <div class="sum-row"><span>📍 들른 맛집·명소</span><b>${y.places}곳</b></div>
      <div class="sum-row"><span>🧚‍♀️ 올해의 칭호</span><b>${y.grade.name}</b></div>
    </div>
    <div class="recap-wrap"><canvas id="yearCanvas" width="1080" height="1920"></canvas></div>
    <div class="pad" style="padding-top:0"><button class="btn red block" onclick="A.shareYear()">📲 결산 카드 이미지로 공유하기</button>
      <p class="muted small center mt8">친구가 카드 보고 가입하면 둘 다 ☕ 음료 쿠폰! (예시)</p></div>`
    : `<div class="card lift"><div class="empty"><span class="em">🎫</span>${SEASON} 시즌 직관 기록이 없어요<br>시범경기부터 첫 기록을 쌓아 볼까요?</div><button class="btn red block" onclick="A.go('off',{id:'preseason'})">🌱 시범경기 보러 가기</button></div>`}
    <div class="section-title"><h3>🗓️ 월별 직관</h3></div>
    <div class="card"><div class="months">${[3, 4, 5, 6, 7, 8, 9, 10].map(m => { const rs = y.rs.filter(r => parse(r.date).getMonth() + 1 === m); return `<div><div class="bar"><i style="height:${Math.min(100, rs.length * 25)}%"></i></div><b>${rs.length}</b><span>${m}월</span></div>`; }).join('')}</div></div>
  </div>`;
}
async function drawYear() {
  const c = $('#yearCanvas'); if (!c) return;
  try { await Promise.all([document.fonts.load('80px Jua'), document.fonts.load('700 36px "Noto Sans KR"')]); } catch (e) { }
  const y = yearStats(); const t = team(S.team); const ctx = c.getContext('2d'); const W = 1080, H = 1920;
  const JUA = s => `${s}px Jua, "Malgun Gothic", sans-serif`; const SANS = (s, w = 700) => `${w} ${s}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
  ctx.clearRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const gr = ctx.createLinearGradient(0, 0, W, H); gr.addColorStop(0, t.color); gr.addColorStop(1, '#101810'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  stitchArc(ctx, -380, 700, 640, -1.1, 1.1, 'rgba(255,255,255,.25)'); stitchArc(ctx, W + 380, 1300, 640, Math.PI - 1.1, Math.PI + 1.1, 'rgba(255,255,255,.25)');
  ctx.fillStyle = '#fff'; ctx.font = SANS(34, 800); ctx.globalAlpha = .8; ctx.fillText(`MY  ${SEASON}  BALLPARK  WRAPPED`, W / 2, 150); ctx.globalAlpha = 1;
  ctx.font = JUA(96); ctx.fillText(`${SEASON} 나의 직관로그`, W / 2, 250);
  ctx.font = SANS(36, 600); ctx.globalAlpha = .9; ctx.fillText(`${S.nickname || '직관러'} · ${t.name} 팬 ${t.emoji}`, W / 2, 330); ctx.globalAlpha = 1;
  // 공 (승률)
  const bx = W / 2, by = 620, br = 210;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 40; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  stitchArc(ctx, bx - 300, by, 230, -0.75, 0.75, '#E63946'); stitchArc(ctx, bx + 300, by, 230, Math.PI - 0.75, Math.PI + 0.75, '#E63946');
  ctx.fillStyle = '#1F2A22'; ctx.font = JUA(130); ctx.fillText(`${y.rate}%`, bx, by - 10);
  ctx.font = SANS(32, 800); ctx.fillStyle = '#E63946'; ctx.fillText('직관 승률', bx, by + 85);
  // 등급
  ctx.fillStyle = '#fff'; ctx.font = JUA(70); ctx.fillText(`${y.grade.em} ${y.grade.k}등급 · ${y.grade.name}`, W / 2, 920);
  // 스탯 카드
  const cells = [['직관 횟수', `${y.n}회`], ['직관 전적', `${y.w}승 ${y.l}패${y.d ? ' ' + y.d + '무' : ''}`], ['원정 직관', `${y.away}회`], ['들른 맛집·명소', `${y.places}곳`]];
  cells.forEach(([k, v], i) => {
    const x = 90 + (i % 2) * 460, yy = 1010 + Math.floor(i / 2) * 230;
    ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(ctx, x, yy, 440, 200, 40); ctx.fill();
    ctx.fillStyle = '#6B7A70'; ctx.font = SANS(32, 700); ctx.fillText(k, x + 220, yy + 62);
    ctx.fillStyle = '#1F2A22'; ctx.font = JUA(68); ctx.fillText(v, x + 220, yy + 135);
  });
  ctx.fillStyle = '#fff'; rr(ctx, 90, 1480, 900, 170, 40); ctx.fill();
  ctx.fillStyle = '#6B7A70'; ctx.font = SANS(32, 700); ctx.fillText('🏟️ 가장 많이 간 구장', W / 2, 1530);
  ctx.fillStyle = '#1F2A22'; ctx.font = JUA(60); ctx.fillText(y.topV ? `${VENUES[y.topV.key].name}  ${y.topV.n}회` : '-', W / 2, 1600);
  ctx.fillStyle = '#fff'; ctx.font = JUA(46); ctx.fillText(`#직관메이트  #${SEASON}직관로그  #${t.nick}`, W / 2, 1745);
  ctx.font = SANS(28, 600); ctx.globalAlpha = .7; ctx.fillText(S.nickname ? `@${S.nickname}` : 'jikgwan.mate', W / 2, 1830); ctx.globalAlpha = 1;
}

function offEvent() {
  const O = offState(); const evs = offEvents(); const ev = UI.ev && evs.find(e => e.id === UI.ev.id);
  let detail = '';
  if (ev) {
    const p = UI.ev; const opts = travelOptions(S.region, ev.venue, p.people); const o = opts.find(x => x.mode === p.mode) || opts[0];
    const near = o.km < 45; const stays = STAYS[ev.venue]; const stay = !near && p.stayId ? stays.find(h => h.id === p.stayId) : null;
    const rooms = Math.ceil(p.people / 2); const tr = o.total * 2; const st = stay ? stay.price * rooms : 0; const disc = stay && stay.partner && unlocked('r5') ? st * 0.2 : 0;
    detail = `<div class="section-title"><h3>🧳 ${esc(ev.title)} 원정 묶음</h3></div>
      <div class="card"><div class="center muted small">나를 포함한 인원</div><div class="counter mt8"><button onclick="A.evSet('people',${Math.max(1, p.people - 1)})">−</button><b>${p.people}명</b><button onclick="A.evSet('people',${Math.min(8, p.people + 1)})">+</button></div></div>
      <div class="section-title"><h3>🚄 ${esc(S.region)} → ${VENUES[ev.venue].city} 교통</h3></div>
      <div style="padding:0 18px">${opts.map(x => `<button class="opt ${x.mode === o.mode ? 'on' : ''}" style="width:100%;margin:0 0 8px" onclick="A.evSet('mode','${x.mode}')"><div class="radio"></div><div class="ic">${x.emoji}</div><div class="grow"><div class="t">${x.label}</div><div class="d">${x.desc} · 약 ${x.dur}분</div></div><div class="p">${won(x.total * 2)}<div class="muted small">왕복</div></div></button>`).join('')}</div>
      ${near ? '<div class="card flat"><b>🏠 가까워서 당일치기 추천!</b><div class="muted small mt8">행사 끝나고 바로 귀가해도 충분한 거리예요.</div></div>' : `
      <div class="section-title"><h3>🏨 1박 숙소</h3><span class="muted small">${rooms}실 기준</span></div>
      <div style="padding:0 18px"><button class="opt ${!p.stayId ? 'on' : ''}" style="width:100%;margin:0 0 8px" onclick="A.evSet('stayId','')"><div class="radio"></div><div class="ic">🌙</div><div class="grow"><div class="t">숙박 없이 당일치기</div><div class="d">막차 시간 확인 필수</div></div></button>
      ${stays.map(h => `<button class="opt ${p.stayId === h.id ? 'on' : ''}" style="width:100%;margin:0 0 8px" onclick="A.evSet('stayId','${h.id}')"><div class="radio"></div><div class="ic">${h.emoji}</div><div class="grow"><div class="t">${h.name} ${h.partner ? '<span class="badge">제휴</span>' : ''}</div><div class="d">${h.type} · ${h.dist}</div></div><div class="p">${won(h.price)}</div></button>`).join('')}</div>`}
      <div class="card"><div class="sum-row"><span>${o.emoji} ${o.label} 왕복 ${p.people}명</span><span>${won(tr)}</span></div>
        ${stay ? `<div class="sum-row"><span>🏨 ${stay.name} ${rooms}실</span><span>${won(st)}</span></div>` : ''}
        ${disc ? `<div class="sum-row"><span>🎁 승리 리워드 숙소 20%</span><span class="minus">-${won(disc)}</span></div>` : ''}
        <div class="sum-row total"><span>총 예상 비용</span><span style="color:var(--stitch)">${won(tr + st - disc)}</span></div>
        <div class="muted small">1인 약 ${won((tr + st - disc) / p.people)}</div>
        <button class="btn red block mt16" onclick="A.evBook(${tr + st - disc})">${O.events[ev.id] ? '✓ 예약 변경하기' : '교통 + 숙소 한 번에 예약'}</button></div>`;
  }
  return `<div class="view">
    ${offHead('event', '경기는 없어도 “올라가야 하는” 일정! 교통·숙박을 묶어 드려요')}
    <div class="lift"></div>
    ${evs.map(e => { const past = e.date < TODAY; const bk = O.events[e.id]; return `
      <div class="card ${UI.ev?.id === e.id ? 'sel-card' : ''}" style="cursor:pointer" onclick="A.evPick('${e.id}','${e.venue}')">
        <div class="row between"><span class="badge ${past ? 'gray' : 'red'}">${past ? '종료' : 'D-' + daysBetween(TODAY, e.date)}</span>${bk ? '<span class="badge">✓ 예약완료</span>' : ''}</div>
        <div class="row mt8"><div style="font-size:34px;margin-right:12px">${e.emoji}</div><div class="grow"><b class="jua" style="font-size:18px">${esc(e.title)}</b>
          <div class="muted small">${fmtFull(e.date)} ${e.time} · ${esc(e.place)}</div><div class="small mt8">${e.desc}</div></div></div>
        ${bk ? `<div class="muted small mt8">🧳 ${bk.people}명 · ${bk.label} · 총 ${won(bk.total)}</div>` : ''}
      </div>`; }).join('')}
    ${detail || '<p class="muted small center">행사를 누르면 교통·숙소 묶음이 나와요</p>'}
  </div>`;
}

function offBucket() {
  const O = offState(); const ns = nextSeason(); const picked = ns.away.filter(a => O.bucket[a.key]);
  return `<div class="view">
    ${offHead('bucket', `${NEXT} 시즌, 올해 가고 싶은 원정을 미리 찜해 두세요`)}
    <div class="card lift"><div class="row between"><b>📌 나의 원정 버킷리스트</b><span class="badge red">${picked.length}/${ns.away.length}</span></div>
      <div class="muted small mt8">찜한 경기의 <b>KTX 예매가 열리거나</b> <b>숙소 가격이 내려가면</b> 알림을 보내드려요.</div>
      ${picked.length ? `<hr class="stitch">${picked.map(a => { const al = O.bucket[a.key]; const open = addDays(a.start, -30); return `
        <div class="list-item"><div class="date-box"><b>${parse(a.start).getDate()}</b><span>${parse(a.start).getMonth() + 1}월</span></div>
          <div class="grow"><b>${VENUES[a.venue].city} 원정 vs ${team(a.opp).short}</b><div class="muted small">🚄 예매 오픈 ${fmtDate(open)} · 🏨 숙소 ${won(STAYS[a.venue][0].price)}~</div>
          <div class="chips mt8"><button class="chip sm ${al.ktx ? 'on' : ''}" onclick="A.bkAlert('${a.key}','ktx')">🔔 KTX 오픈</button><button class="chip sm ${al.stay ? 'on' : ''}" onclick="A.bkAlert('${a.key}','stay')">🔔 숙소 특가</button></div></div></div>`; }).join('')}` : ''}
    </div>
    <div class="section-title"><h3>🗺️ ${NEXT} 원정 일정</h3><span class="muted small">샘플 일정 · 금~일 3연전</span></div>
    <div class="card" style="padding:4px 16px">${ns.away.map(a => { const on = !!O.bucket[a.key]; const c = cheapest(a.venue, 1); return `
      <div class="list-item"><div class="date-box"><b>${parse(a.start).getDate()}</b><span>${parse(a.start).getMonth() + 1}월 금</span></div>
        <div class="grow"><b>${team(a.opp).emoji} ${VENUES[a.venue].name}</b><div class="muted small">vs ${team(a.opp).name} · ${c.emoji} 편도 ${won(c.total)}~</div></div>
        <button class="heart ${on ? 'on' : ''}" onclick="A.bkToggle('${a.key}')" aria-label="찜">${on ? '❤️' : '🤍'}</button></div>`; }).join('')}
    </div>
  </div>`;
}

function offStadium() {
  const vv = venueVisits(); const keys = Object.keys(VENUES); const done = keys.filter(k => vv[k]).length;
  const goals = [{ n: 3, em: '🎟️', t: '원정 교통비 5,000원 쿠폰' }, { n: 5, em: '🏨', t: '제휴 숙소 10% 추가 할인' }, { n: 9, em: '👑', t: '전 구장 정복 뱃지 + KTX 2만원 쿠폰' }];
  return `<div class="view">
    ${offHead('stadium', `${NEXT} 시즌 목표: 9개 구장 정복!`)}
    <div class="card lift"><div class="row between"><b class="jua" style="font-size:20px">🏟️ ${done} / ${keys.length} 구장 정복</b><span class="badge red">${Math.round(done / keys.length * 100)}%</span></div>
      <div class="progress mt8"><i style="width:${done / keys.length * 100}%"></i></div>
      <div class="muted small mt8">직관 인증 기록이 있는 구장에 도장이 찍혀요. 직관 승률과 같이 쌓여요!</div></div>
    <div class="card"><div class="stadiums">${keys.map(k => { const v = VENUES[k]; const rs = vv[k]; const home = TEAMS.filter(t => t.venue === k).map(t => t.emoji).join(''); return `
      <div class="stadium ${rs ? 'done' : ''}"><div class="sic">${rs ? '✅' : home}</div><b>${v.name}</b><span>${v.city}${rs ? ` · ${rs.length}회` : ''}</span></div>`; }).join('')}</div></div>
    <div class="section-title"><h3>🎁 도장깨기 보상</h3></div>
    ${goals.map(g => { const ok = done >= g.n; return `<div class="coupon ${ok ? '' : 'locked'}"><div class="em">${g.em}</div><div><b>${g.t}</b><div class="muted small">${g.n}개 구장 달성 시</div></div><div class="need">${ok ? '✓ 사용가능' : `${g.n - done}곳 남음`}</div></div>`; }).join('')}
    <div class="pad"><button class="btn red block" onclick="A.go('off',{id:'bucket'})">📌 안 가본 구장 원정 찜하러 가기</button></div>
  </div>`;
}

function offCamp() {
  const O = offState(); const t = team(S.team);
  const camps = [
    { id: 'okinawa', em: '🌺', city: '일본 오키나와', desc: '따뜻한 남쪽 섬 · 여러 구단 연습경기 몰려있음', nights: '3박 4일', price: 890000 },
    { id: 'miyazaki', em: '♨️', city: '일본 미야자키', desc: '온천 + 캠프 참관 · 조용한 휴양 코스', nights: '3박 4일', price: 820000 },
  ];
  return `<div class="view">
    ${offHead('camp', `${NEXT}년 2월, ${t.nick} 전지훈련 보러 해외로!`)}
    <div class="card lift ball-card"><div style="padding:0 22px" class="center"><span class="badge gold">🚧 2단계 사업 · 오픈 준비 중</span>
      <div class="jua mt8" style="font-size:22px">비시즌 유일한 “직관”</div>
      <div class="muted small mt8">해외 항공·숙박 제휴가 필요해서 2단계로 준비 중이에요.<br>알림을 신청하면 오픈 즉시 알려드릴게요!</div>
      <button class="btn ${O.campAlert ? 'ghost' : 'red'} block mt12 sm" style="padding:11px" onclick="A.campAlert()">${O.campAlert ? '🔔 오픈 알림 신청 완료' : '🔔 오픈 알림 받기'}</button></div></div>
    <div class="section-title"><h3>✈️ 참관 투어 미리보기</h3><span class="muted small">예상가 · 1인</span></div>
    ${camps.map(c => `<div class="card"><div class="row"><div style="font-size:34px;margin-right:12px">${c.em}</div><div class="grow"><b class="jua" style="font-size:18px">${c.city} 캠프 투어</b><div class="muted small">${c.nights} · ${c.desc}</div></div><div class="right"><b>${won(c.price)}~</b></div></div>
      <div class="chips mt12"><span class="chip sm">✈️ 왕복 항공</span><span class="chip sm">🏨 캠프 근처 숙소</span><span class="chip sm">🚌 훈련장 셔틀</span><span class="chip sm">⚾ 연습경기 관람</span></div></div>`).join('')}
    <p class="muted small" style="margin:10px 18px">※ 구단별 캠프 장소·일정은 매년 달라져요. 실제 일정 발표 후 상품이 열려요.</p>
  </div>`;
}

function offPreseason() {
  const O = offState(); const ns = nextSeason(); const first = !S.records.some(r => r.myTeam === S.team);
  return `<div class="view">
    ${offHead('preseason', '정규시즌보다 부담 없이, 첫 직관을 시작해 보세요')}
    <div class="card lift"><div class="row"><div style="font-size:36px;margin-right:12px">🌱</div><div class="grow"><b class="jua" style="font-size:19px">${first ? '첫 직관 미션' : '새 시즌 첫 스탬프 미션'}</b>
      <div class="muted small">시범경기를 인증하면 <b>${NEXT} 시즌 첫 스탬프</b>와 ☕ 음료 1+1 쿠폰을 드려요</div></div></div></div>
    <div class="section-title"><h3>📅 ${NEXT} 시범경기</h3><span class="muted small">샘플 일정</span></div>
    <div class="card" style="padding:4px 16px">${ns.pre.map(g => { const on = !!O.pre[g.id]; const c = cheapest(g.venue, 1); return `
      <div class="list-item"><div class="date-box"><b>${parse(g.date).getDate()}</b><span>3월 ${DOW[parse(g.date).getDay()]}</span></div>
        <div class="grow"><b>vs ${team(g.opp).emoji} ${team(g.opp).short}</b> <span class="badge ${g.home ? '' : 'gray'}">${g.home ? '홈' : '원정'}</span><div class="muted small">${VENUES[g.venue].name} · ${g.time} · ${c.emoji} ${won(c.total)}~</div></div>
        <button class="mini-btn ${on ? '' : 'red'}" onclick="A.preToggle('${g.id}')">${on ? '✓ 찜' : '갈래요'}</button></div>`; }).join('')}
    </div>
    <p class="muted small" style="margin:10px 18px">💡 시범경기는 평일 낮 경기가 많아요. 입장 부담이 적어서 처음 가보는 친구랑 가기 좋아요!</p>
  </div>`;
}

function offEarly() {
  const O = offState(); const ns = nextSeason(); const t = team(S.team); const st = stats();
  const og = ns.openSeries[0]; const fa = ns.firstAway; const cOpen = cheapest(og.venue, 2); const cAway = cheapest(fa.venue, 2);
  const myCoupons = REWARDS.filter(r => st.w >= r.wins);
  const pick = (k, label) => `<button class="btn ${O.early === k ? 'ghost' : 'red'} block mt12 sm" style="padding:11px" onclick="A.earlyBook('${k}')">${O.early === k ? '✓ 얼리버드 예약 완료' : label}</button>`;
  return `<div class="view">
    ${offHead('early', `${NEXT} 개막, 제일 먼저 자리 잡기 🐣`)}
    <div class="card lift ball-card"><div style="padding:0 22px">
      <div class="row between"><span class="badge red">🎉 개막 시리즈</span><span class="badge gold">얼리버드 10%↓</span></div>
      <div class="dday mt12"><div class="big">D-${daysBetween(TODAY, og.date)}</div><div><b>${t.short} vs ${team(og.opp).short}</b><div class="muted">${fmtFull(og.date)} · ${VENUES[og.venue].name} (${og.home ? '홈' : '원정'})</div></div></div>
      <div class="muted small mt8">2인 교통 예상 ${won(cOpen.total * 2 * 0.9)} <s>${won(cOpen.total * 2)}</s></div>
      ${pick('open', '개막 시리즈 얼리버드 예약')}</div></div>
    <div class="card"><div class="row between"><b>🚄 첫 원정 루트</b><span class="muted small">${fmtDate(fa.start)} ~ ${fmtDate(fa.end)}</span></div>
      <div class="mt8"><b>${VENUES[fa.venue].city} · ${VENUES[fa.venue].name}</b> <span class="muted small">vs ${team(fa.opp).short}</span></div>
      <div class="muted small mt8">2인 · ${cAway.emoji} ${cAway.label} 왕복 + 1박 예상 ${won((cAway.total * 2 + STAYS[fa.venue][0].price) * 0.9)} <s>${won(cAway.total * 2 + STAYS[fa.venue][0].price)}</s></div>
      ${pick('away', '첫 원정 얼리버드 예약')}</div>
    <div class="section-title"><h3>🎟️ 지난 시즌 쿠폰</h3><span class="muted small">유효기간 연장</span></div>
    ${myCoupons.length ? myCoupons.map(r => `<div class="coupon"><div class="em">${r.emoji}</div><div><b>${r.title}</b><div class="muted small">${r.desc}</div></div><div class="need">~${fmtDate(ns.openSeries[1].date)}<br><span class="muted">개막까지</span></div></div>`).join('')
      : '<div class="card"><div class="empty"><span class="em">🎫</span>아직 받은 쿠폰이 없어요</div></div>'}
    <p class="muted small" style="margin:10px 18px">💡 ${SEASON} 시즌 승리 쿠폰은 ${NEXT} 개막 시리즈까지 쓸 수 있도록 유효기간을 맞췄어요.</p>
  </div>`;
}

// ---------- 액션 ----------
Object.assign(A, {
  openMenu() { UI.menu = true; UI.menuAnim = true; render(); UI.menuAnim = false; },
  closeMenu() { UI.menu = false; render(); },
  toggleFolder(id) { UI.menuOpen[id] = !UI.menuOpen[id]; render(); },
  offBack() { UI.ev = null; A.go('home'); A.openMenu(); },
  shareYear() { const c = $('#yearCanvas'); if (!c) return; UI.sheet = { type: 'img', src: c.toDataURL('image/png') }; render(); },
  evPick(id, venue) { if (UI.ev?.id === id) return; const o = travelOptions(S.region, venue, 2); UI.ev = { id, people: 2, mode: o[0].mode, stayId: '' }; render(); },
  evSet(k, v) { UI.ev[k] = v; render(); },
  evBook(total) {
    const O = offState(); const ev = offEvents().find(e => e.id === UI.ev.id); const o = travelOptions(S.region, ev.venue, UI.ev.people).find(x => x.mode === UI.ev.mode) || {};
    O.events[ev.id] = { people: UI.ev.people, mode: UI.ev.mode, label: o.label, stayId: UI.ev.stayId, total }; save(); render(); confetti(); toast(`🎉 ${ev.title} 원정 예약 완료! (데모)`);
  },
  bkToggle(key) { const O = offState(); if (O.bucket[key]) { delete O.bucket[key]; toast('찜을 해제했어요'); } else { O.bucket[key] = { ktx: true, stay: true }; toast('❤️ 버킷리스트에 담았어요! KTX·숙소 알림 ON'); } save(); render(); },
  bkAlert(key, k) { const O = offState(); O.bucket[key][k] = !O.bucket[key][k]; save(); render(); },
  campAlert() { const O = offState(); O.campAlert = !O.campAlert; save(); render(); toast(O.campAlert ? '🔔 스프링캠프 투어 오픈 알림을 신청했어요' : '알림을 해제했어요'); },
  preToggle(id) { const O = offState(); O.pre[id] = !O.pre[id]; save(); render(); if (O.pre[id]) toast('🌱 시범경기 찜! 경기 1주 전에 알려드릴게요'); },
  earlyBook(k) { const O = offState(); O.early = O.early === k ? null : k; save(); render(); if (O.early) { confetti(); toast('🐣 얼리버드 예약 완료! 개막 때 만나요 (데모)'); } },
});
