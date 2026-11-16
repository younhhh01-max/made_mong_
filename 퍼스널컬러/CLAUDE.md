# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this folder.

퍼스널 컬러 화장대 웹 앱이다. 계절(봄 웜·여름 쿨·가을 웜·겨울 쿨)과 세부 타입을 고르면 베스트/워스트 컬러를 보여 주고, 피부톤을 받아 상반신 그림에 추천 화장품을 발색해 볼 수 있다. 순수 HTML/CSS/JS 파일 하나이고 서버나 외부 API가 필요 없다.

## 파일과 실행

- `index.html`: 화면, 스타일, 데이터, 로직이 모두 들어 있다. 더블클릭해서 브라우저로 열면 동작한다.
- `퍼스널컬러_실행.bat`: 같은 폴더의 `index.html`(`%~dp0`)을 기본 브라우저로 연다. CRLF, UTF-8(`chcp 65001`).
- 확인: headless Edge(`msedge --headless --screenshot` / `--dump-dom`). 화면 지정은 복사본 마지막 `route();` 뒤에 `go('#/studio/ml/lip')`를 붙인다. 로직 테스트는 복사본 마지막 `route();` 뒤에 스크립트를 붙여 `--virtual-time-budget`과 함께 본다.

## 화면 흐름 (앱 안 기록 `stack` + `route()`)

1. `#/` 첫 화면: 4분할 원(SVG) + 세부 타입 바로 가기 + 톤 자가 체크.
2. `#/season/<봄 spring|summer|autumn|winter>/<타입>`: 세부 타입 탭, 명도·채도, 베스트/워스트 컬러, 메이크업 포인트 → "추천 화장품 보러가기".
3. `#/skin/<타입>`: 호수(13~25), 언더톤, 홍조, 피부 타입. `localStorage`(`pc-skin`)에 저장.
4. `#/studio/<타입>`: 상반신 SVG(`figure()`)와 부위 버튼(`HOTS`), 아래 "사용한 화장품" 목록.
5. `#/studio/<타입>/<부위>`: 제품 창(`openSheet()`). '발색해보기' → `state.applied[slot]`에 넣고 창을 닫는다.
- 경로는 `'#/studio/sl/lip'` 같은 문자열이지만 주소창(location.hash)은 쓰지 않는다. claude.ai 아티팩트 안에서는 해시 이동이 막히므로 `go()`가 `stack`에 쌓고 `back()`이 꺼낸다(없으면 `parentOf()`). 탭 전환은 `replaceTo()`.

## claude.ai 아티팩트 (모바일용)

- 주소: https://claude.ai/artifact/XkYCJPHVAZbvS1QSrz7hCR (비공개, 공유는 페이지의 Share 메뉴에서).
- 올리는 법: `index.html`에서 맨 앞 `<!DOCTYPE html>`~viewport meta, `</head><body>`, `</body></html>`을 뺀 파일을 만들고, `img/face.webp`·`img/skin_mask.jpg`·`img/hair_mask.jpg`·`img/cloth_mask.jpg`·`img/cloth_shade.jpg`를 같은 경로(`img/...`)의 files로 함께 올린다. 같은 주소로 다시 올리려면 Artifact 도구에 `url`을 준다.
- 색은 모두 `:root` 토큰이고 다크 모드 블록이 두 개(`prefers-color-scheme`, `[data-theme="dark"]`) 있다. 계절은 `setAccent()`가 `--accent`와 `--tint`(`SEASONS[].tint`: 봄 피치·여름 라벤더 블루·가을 카멜·겨울 네이비)만 바꾼다. `--bg`·`--card`·`--line`·`--stage-top`은 `--bg-base`·`--card-base`·`--line-base`에 `--tint`를 color-mix로 섞어 만들고(라이트 16/4/24%, 다크 10/7/18%), 첫 화면에서는 `--tint`를 지워 원래 바탕으로 돌아간다. `--accent-soft`·`--accent-text`도 color-mix.

## 데이터

- 세부 타입 10가지(국내에서 많이 쓰는 분류): 봄 라이트 sl·브라이트 sb / 여름 라이트 ll·브라이트 lb·뮤트 ml / 가을 뮤트 am·스트롱 as·딥 ad / 겨울 브라이트 wb·딥 wd. 봄 뮤트·가을 라이트 등은 없는 이유를 `SEASONS[].note`에 적어 두었다.
- `PRODUCTS`는 `add(카테고리, [[브랜드, 제품, 색상, hex, 타입들, 설명, 추가]])`. 섀도우는 `hex2`(진한 색, 발색에는 35%만 섞음), 블러셔 `calm`(홍조 추천). 타입 id가 들어 있으면 그 타입 추천, 아니면 '다른 타입 제품도 보기'로 간다.
- 피부 제품은 `skinProducts()`가 선택한 호수·언더톤·홍조·피부 타입으로 만든다(헤라 블랙 쿠션 N/C, 클리오 킬커버, 에스쁘아, 더샘 컨실러, 홍조면 그린 컨실러·닥터자르트 시카페어, 톤업 프라이머).
- 헤어·옷 색은 타입의 `hair`, `best`/`worst`에서 만든다.
- 색상 hex는 화면용 근사치다. 확인한 출처가 있는 색상명(롬앤 쥬시 래스팅 틴트 리뉴얼, 페리페라 잉크 더 벨벳 번호·이름, 헤라 블랙 쿠션 N/C 의미)을 우선했고, 렌즈는 브랜드 대신 색 계열·직경으로 적는다.
- 제품 링크는 네이버 쇼핑 검색 URL뿐이다. **외부 API·fetch는 쓰지 않는다.**

## 사진과 발색 (`figure()`, `looks()`)

- 화장대 그림은 누끼 딴 실제 사진이다(사용자 요청). 원본 `차분한 베이지 스튜디오 인물 사진.png`(1145x1374) → `img/face.webp`(투명 배경). `img/skin_mask.jpg`·`img/hair_mask.jpg`·`img/cloth_mask.jpg`는 절반 크기 흑백 마스크(흰색 = 해당 부위). `cloth_mask`는 니트 윗선(가운데 y≈1349, 양끝 ≈1274)을 따라 땄고, 피부 마스크는 그 위 쇄골·가슴 피부까지 포함한다. `img/cloth_shade.jpg`(원본 크기, 회색 128 = 변화 없음)는 옷 음영: 접힌 단 밝은 띠·그 아래 그림자·옆과 아래로 어두워짐·니트 결 노이즈.
- 사진을 바꿀 때: `tools/1_cut.py 원본 cut.png`(rembg `isnet-general-use`) → `tools/2_clean.py cut.png face.png 미리보기.png`(머리 가장자리 베이지 띠 제거) → `tools/3_masks.py face.png img`(webp·마스크 생성, 기준 피부색 출력). 그다음 `FIG.native`(기준 피부색)와 `figure()` 안의 좌표(눈동자 중심 460/687.5, 554, 반지름 21.5 · 눈꺼풀 clipPath · 입술 경로 · 블러셔 역삼각형; 옷 마스크·음영은 3_masks.py가 만들지 않으니 니트 윗선을 따라 다시 딴다), `HOTS`, `shift()`의 원래 색(눈동자 #463935, 입술 #C88486, 옷 #E7D1C4)을 새 사진에 맞춰 다시 잰다. 오른쪽 부위는 x=1147.5 기준 좌우 반전(`mirror()`).
- 색 입히기: `shift(원래색, 목표색, 모양, extra)`가 곱하기(multiply)+스크린(screen) 두 겹으로 사진의 원래 색을 목표 색으로 옮긴다(피부·눈동자·입술·옷). 쿠션(base)은 흐린 사진을 피부 마스크로 55% 덮어 결을 매끈하게 하고 screen으로 한 톤 밝힌다. 립은 실제 입술 윤곽(`lipPath`, 입꼬리 493/660, 811) 안에서만, `lipG`(가운데 진하고 가장자리로 갈수록 0) 마스크로 60% 옮긴다. 가장자리는 블렌딩되고 입술 밖으로는 번지지 않는다, 섀도우·홍조는 흐림 + multiply, 컨실러는 눈 밑 역삼각형 screen. 렌즈는 `lensMask`(동공은 비우고 홍채 링만) 안에서 밝기 35% + color 30%만 옮겨 원래 눈동자 결이 비치게 하고, 테두리 링은 15%로 아주 옅게. 블러셔는 눈 밑 둥글둥글한 역삼각형(꼭짓점을 둥글리고 변을 바깥으로 부풀림, x 372~516 · y 606~722, 사용자 요청)을 흐림 16(`b16`), multiply 22%로 올린다. 모양을 크게 잡고 흐림을 적당히 해서 가운데만 진해지지 않고 전체가 고르게 연하다(사용자 요청). 코에는 묻지 않게 안쪽 끝을 x 516(콧방울에서 떨어지게)까지만 둔다. 섀도우는 `lid`(눈두덩 전체)를 한 가지 색(`mix(hex, hex2, 0.35)`)으로 고르게 칠해 흐림 8, multiply 40%. 예전 세로 그라데이션(속눈썹 쪽 hex2가 진함)은 블러셔처럼 전체를 고르게 연하게 해 달라는 요청으로 없앴다. 옷은 `clothMask` 안에서만 `shift` 72% + color 18%, 그 위에 `cloth_shade.jpg`를 soft-light로 얹어 원단처럼 보이게 한다(예전에는 평평한 띠로 칠해서 색종이처럼 보였다). 머리는 `dyeFilter()` 그라데이션 맵: 사진을 흑백 밝기로 바꾼 뒤 feComponentTransfer 표로 밝기마다 목표 색을 대응시켜 `hairMask` 안에 85%로 덮는다. 사진 머리 밝기 중앙값 39(`HAIR_MID`) → 목표 색의 60%, 상위 95% 밝기 76(`HAIR_HI`) → 목표 색 그대로, 그보다 밝은 결만 살짝 더 밝게. 명암·결이 그대로 남는다(예전 shift+color 방식은 그림자까지 들떠서 필터 씌운 것처럼 보였다). 사진을 바꾸면 이 두 값을 머리 마스크 안 밝기 백분위로 다시 잰다. 눈썹은 화장 전 눈썹 모양(`browPath`, x 386~516, y 470~503) 그대로 흐림 + color 블렌드 55%(색만 바꿈) + multiply 18%로 연하게 올린다(털을 한 올씩 그리지 않는다). **mask·filter·clip-path를 건 그룹 안 요소에 mix-blend-mode를 걸면 격리돼서 안 먹는다** → 블렌드와 mask/filter/clip을 같은 요소에 건다.
- 슬롯 하나에 제품 하나(`SLOTS`): base, primer, corrector, concealer, brow, shadow, blush, lip, lens, hair, cloth. (악세사리 발색은 사용자 요청으로 없앴다. 계절 화면의 '어울리는 악세사리' 안내 문구만 남아 있다.)
- 피부색 = `skinHex(호수, 언더톤)` → 프라이머 8% → 쿠션 70% 섞기, 사진 피부에는 85%만 옮긴다. 홍조 진하기는 민트 프라이머·코렉터·쿠션·그린 컨실러가 각각 줄인다.
- 피부톤을 바꾸면 이미 바른 피부 제품은 지운다. 타입이 바뀌면 발색 전체를 지운다.
