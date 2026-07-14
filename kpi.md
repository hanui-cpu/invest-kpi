# invest-kpi 대시보드 작업 진행 기록

> d.camp 직접투자 KPI 대시보드 — GitHub 코드 클론 → 바이브코딩 → Vercel 배포 → 5차에 걸친 수정 내역을 정리한 문서입니다.

---

## 📦 프로젝트 개요

- **저장소**: https://github.com/hanui-cpu/invest-kpi
- **로컬 경로**: `C:\Users\디캠프\Desktop\claude\작업물\invest-kpi`
- **배포 URL**: https://dcamp-invest-kpi.vercel.app
  - 관리자 모드(데이터 새로고침 버튼 표시): `?admin=dcamp2026`
- **로우데이터 시트**: https://docs.google.com/spreadsheets/d/1TQpPtnBowiQKw_dQrol29Gi27PRf7xKzwvUkQaPHW30
- **주요 기술**: 단일 HTML (Vanilla JS) + Chart.js + PapaParse + Vercel 정적 배포

### 파일 구조

```
invest-kpi/
├── index.html                # 배포용 (항상 index_투자+펀드.html을 복사해 덮어씀)
├── index_투자+펀드.html       # 메인 소스 파일 (투자팀 + 펀드팀 탭 통합본, 여기를 수정)
├── index_투자.html            # 투자팀 단독 구버전 (참고용)
├── presentation.html          # 프레젠테이션용 별도 파일
├── fonts/
│   └── SUIT-Variable.ttf     # 본문 · 숫자 공통 폰트
├── vercel.json               # 폰트 캐시 헤더 + CORS
├── .git/
└── .vercel/
```

> **수정 → 배포 루틴**: `index_투자+펀드.html` 수정 → `index.html`로 복사 → `vercel --prod --yes`

---

## 🗂️ 핵심 상수 (index.html 상단)

### 컬럼 매핑 (2차 수정에서 전면 교체, 7차에서 date 기준 변경)

| 상수 key | 인덱스 | 시트 컬럼 | 용도 |
|---|---|---|---|
| `company` | 0 | A | 기업명 |
| `date` | **14** | **O** | **의결일자 (7차에서 D열 투자일자 → O열 의결일자로 변경)** |
| `exitDate` | 4 | E | 회수일자 |
| `preValue` | 5 | F | Pre-value |
| `minor` | 10 | K | 중분류(도메인) |
| `amount` | 12 | M | 투자금액 |
| `exitAmount` | 13 | N | 회수금액 |

### 연도별 목표 (5차 수정에서 객체화)

```js
const YEARLY_GOALS = {
  2025: { domainFocus: null, earlyStage: null, recovery: null,  investLimit: 120  },
  2026: { domainFocus: 80,   earlyStage: 50,   recovery: 12.6,  investLimit: 250  },
  2027: { domainFocus: null, earlyStage: null, recovery: 22.7,  investLimit: null },
  2028: { domainFocus: null, earlyStage: null, recovery: 36.5,  investLimit: null },
  2029: { domainFocus: null, earlyStage: null, recovery: 55.7,  investLimit: null },
  2030: { domainFocus: null, earlyStage: null, recovery: 45.4,  investLimit: null },
};
```

> **6차 업데이트 (2026-04-28)**: 회수 목표 5개년 재산정 (위 표 반영). EXIT_TARGETS_EOK도 동일 값으로 동기화.

- 값이 `null`이면 해당 KPI 카드는 **자동으로 비활성** 렌더링
- 극초기 기준선: `EARLY_PREVALUE_THRESHOLD = 100억원`

---

## 🧭 최종 페이지 구조 (5차 완료 시점)

```
┌─────────────────────────────────────────────────────────────┐
│ [헤더] Investment KPI Dashboard · 새로고침 · PDF / PPT 다운로드 │
├─────────────────────────────────────────────────────────────┤
│ [필터바] 연도 · 분기 · 집계                                   │
├─────────────────────────────────────────────────────────────┤
│ [목표 카드 4개 · 가로 풀폭]                                   │
│  ① 2026년 목표 도메인 집중도    80%                          │
│  ② 2026년 목표 극초기 투자금액  50억원                        │
│  ③ 2026년 목표 회수금액         12.6억원                      │
│  ④ 2026년 총 투자한도           250억원                       │
├──────────────────────────────────┬──────────────────────────┤
│ 📂 투자 (2fr)                     │ 📂 회수 (1fr)            │
├──────────────────────────────────┼──────────────────────────┤
│ [실적 2개]                        │ [실적 1개]               │
│   ・목표 도메인 집중도 실적       │   ・회수 실적            │
│   ・목표 극초기 투자금액 실적     │                          │
├──────────────────────────────────┼──────────────────────────┤
│ ▸ 도메인별 투자 건수 (차트)       │ ▸ 연도별 회수 목표 vs 실적 │
│ ▸ 도메인별 상세 현황 (접힘)       │ ▸ 회수 상세 (접힘)        │
│ ▸ 극초기 투자 실적 (카드 2개)     │                          │
│ ▸ 극초기 투자 상세 (접힘)         │                          │
└──────────────────────────────────┴──────────────────────────┘
```

모바일(≤900px)은 1단으로 자동 전환.

---

## 📜 차수별 변경 이력

### 🟢 0차: 초기 클론 & 배포

- GitHub에서 저장소 clone
- 기존 파일: `index.html` 하나 (도메인별 투자 건수만 집계하는 KPI 대시보드)
- Vercel CLI로 프로젝트 이름 `dcamp-invest-kpi`로 첫 배포
- **결과 URL**: `https://dcamp-invest-kpi.vercel.app`

---

### 🟢 1차: 극초기·회수 섹션 신규 추가

**추가 내용**
- `COL` 상수에 `exitDate(4), preValue(5), exitAmount(13)` 추가
- `EARLY_PREVALUE_THRESHOLD`, `EARLY_TARGET_EOK_2026`, `EXIT_TARGETS_EOK` 상수 신설
- **극초기 투자 진척률 카드**: Pre-value 100억 미만 집계, 2026 목표 50억 대비 달성률 게이지
- **극초기 상세 테이블**: 기업명 / 도메인 / Pre-value / 투자금액 / 투자일자
- **연도별 회수 목표 vs 실적**: 2026 달성률 카드 + 2026~2030 목표/실적 막대그래프
- **회수 상세 테이블**: 기업명 / 회수일자 / 투자금액 / 회수금액 / 멀티플(2.35x)

---

### 🟢 2차: 컬럼 매핑 오류 수정 + 카드 확장

**컬럼 매핑 전면 교체** (오염된 참조 전부 수정)
- 잘못 참조하던 `major:7, minor:8, amount:10` → 정답 매핑으로 교체
- 결과: `D/E/F/K/M/N` 기준, `COLUMN_MAP` 상수로 분리 + `COL` 별칭 유지

**UI 추가**
- 상단 `goal-banner`: 4개 카드 그리드 — 집중도 / 총 투자한도 / 목표 회수금액 / 목표 극초기 투자금액
- 실적 카드 줄 확장 (3 → 5열): 집중도 / 투자건수 / 예산 / 회수 실적 / 극초기 실적
- 회수 섹션 전면 연도 필터 연동 (카드·차트·테이블 일관 필터)

---

### 🟢 3차: UI/레이아웃 대청소

- **상단 목표 카드 순서**: 회수 → 집중도 → 극초기 → 투자한도
- **실적 카드 순서도 같은 순서**로 정렬, "2026년" 접두어 제거, "투자건수" 카드 삭제
- **도메인 집중도 실적 카드 톤 통일** (주황 강조박스 제거 → 일반 카드와 동일)
- **상세 섹션 3개 아코디언화**: 기본 접힘 + 독립 토글 + ▼/▲ chevron
  - `panel-domain`, `panel-early`, `panel-exit`
- **테이블 정렬 유틸리티**: `.tl / .tc / .tr` 클래스 도입
- **숫자 폰트 가독성**: `tabular-nums`, `zero` feature 적용
- **재배포** 완료

---

### 🟢 4차: 2단 레이아웃 + 폰트 강화 (→ 5차에서 다시 교체)

- **상세 영역을 `.detail-split` 2단 그리드로 재배치** (좌: 투자 / 우: 회수)
- 각 컬럼 상단에 대분류 헤더(밑줄 2px)
- **이모지 전부 제거** (🌱 💰 📋 🎉 ⏳ 등) · chevron ▼ 는 유지
- 극초기 달성률 옆 "투자금액 기준" 보조문구 추가
- **JetBrains Mono 도입** + `slashed-zero` 적용 (→ 5차에서 제거)
- `.numeric-value` 클래스 신설

---

### 🟢 5차 (최종): SUIT 통일 + YEARLY_GOALS + 통합 2단 그룹

**폰트**
- 사용자 제공 `SUIT-Variable.ttf` → `/fonts/`에 배치
- `@font-face` 등록 (weight 100-900)
- `html, body` 전역을 **SUIT Variable** 로 통일
- JetBrains Mono / DM Mono / `slashed-zero` **전부 제거**
- `.numeric-value` = SUIT + `tabular-nums`만 유지 (0 모양 변경 없음)
- `vercel.json`에 폰트 캐시 헤더 + CORS 추가

**레이아웃**
- 상단 "247건 로드완료" 상태바 DOM 제거 (로딩 상태는 `console.log`로만)
- 목표 카드 순서 재배치: **집중도 → 극초기 → 회수 → 투자한도**
- "총 투자한도 실적" 카드 **삭제** (투자한도는 상단 목표에만)
- "2026 회수 실적" → **"회수 실적"** 제목 간결화
- 실적 카드 줄을 삭제하고 `.detail-split` 각 컬럼 상단에 `.kpi-row`로 흡수
  - 투자 컬럼: 2fr · 실적 2개(집중도, 극초기)
  - 회수 컬럼: 1fr · 실적 1개(회수)

**연도별 활성/비활성**
- `YEARLY_GOALS` 객체로 연도별 KPI 유효성 선언
- 헬퍼: `getGoals(year)`, `setGoalBox`, `setKpiCardDisabled`, `setColDisabled`
- 비활성 상태: `opacity 0.4`, `pointer-events:none`, 호버 툴팁 `해당 연도에는 목표가 설정되지 않았습니다`
- 카드 제목의 연도 표시 동적 변경 ("2025년 총 투자한도" 식)

| 선택 연도 | 활성 KPI |
|---|---|
| 2025 이하 | 총 투자한도만 |
| 2026 | 전체 활성 |
| 2027~2030 | 회수만 활성 |

---

### 🟢 6차 (2026-04-28): 회수 목표 갱신 + 다운로드 기능 + UI 정리

**데이터**
- 5개년 회수 목표 재산정 후 반영
  - `EXIT_TARGETS_EOK` / `YEARLY_GOALS.recovery`: 12.6 / 22.7 / 36.5 / 55.7 / 45.4
- 정적 HTML에 박혀 있던 "13.9억" 기본값들도 모두 12.6억으로 동기화
  (`exit-kpi-unit`, `exit-kpi-rlbl`, `c-exit-target`, gauge-lbl 등)

**상단 헤더**
- 대시보드 타이틀: `직접투자 · 집중 도메인 비중 모니터링` → **`Investment KPI Dashboard`**
- 브라우저 탭 `<title>`도 `Investment KPI Dashboard · d.camp` 로 동기화
- 헤더 우측 `브리핑 출력` 단일 버튼 → **`PDF 다운로드` + `PPT 다운로드`** 두 버튼으로 교체

**상단 필터바 정리**
- `차트 기준 (건수/금액)` 토글 **삭제** — 항상 건수 기준
- `표시 (전체/핵심)` 토글 **삭제** — 항상 전체 도메인
- 관련 디바이더(`<div class="fdiv">`)도 함께 제거
- JS의 `metricMode/viewMode` 변수와 `setMetric/setView` 함수는 남겨 두었으나 사용되지 않음 (기본값 `'c'`/`'all'` 고정으로 동작)

**도메인별 상세 — 호버 툴팁 추가**
- `calcStats`에서 이미 모이고 있던 `g[dom].companies` Set을 활용
- `renderTable`에서 도메인 셀에 `data-tip` (URL-encoded JSON) 부여
- `body`에 단일 `#dom-tooltip` 요소를 만들고 `mouseover/mousemove/mouseout` 이벤트 위임으로 위치/표시 제어
  - `position:fixed` + 마우스 위치 추적 → 패널 `overflow:hidden` 영역 밖에서도 안 잘림
  - 화면 우/하단에 닿으면 자동으로 좌/상단 플립
  - 가나다순 정렬, "포함 기업 (N개)" 헤더 + UL 리스트
  - 검정 배경 + 주황 헤더로 토스트와 일관된 톤

**줄바꿈 깨짐 픽스**
- 회수 요약 3카드 (`연도별 회수 목표 vs 실적` 패널 내부): 부모에 `.exit-summary-cards` 클래스 부여 → CSS로 `cl/cs/cv-wrap` 모두 `white-space:nowrap`
  - cv 30px / cu 14px 통일, 카드를 flex-column 으로 만들고 게이지 `margin-top:auto` → 3개 박스의 값/게이지 라인이 일직선으로 정렬
  - `@media(max-width:780px)` 에서 cv 24px / cu 12px 자동 축소 (좁아져도 한 줄 유지)
- 극초기·회수 상세 테이블 셀: `#panel-early table td, #panel-exit table td { white-space:nowrap }` — 좁아지면 `.tw`의 `overflow-x:auto` 가 가로 스크롤로 대응

**브리핑 출력 → PDF/PPT 다운로드 (전체 대시보드 캡처)**

추가된 외부 라이브러리(CDN, head 영역):
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
```

신규 함수 (기존 `doPrint` 통째로 교체):
- `captureFullDashboard()` — 캡처 전 처리:
  1. 모든 `.panel.collapsible.collapsed` 의 `collapsed` 클래스 임시 제거 (아코디언 펼치기)
  2. `.hd-r`(다운로드 버튼들) `visibility:hidden`
  3. `#dom-tooltip` `display:none` 강제
  4. `setTimeout(400ms)` 으로 transition(0.28s) 안정 대기
  5. `html2canvas(document.body, { scale:2, backgroundColor:'#F2F1EC', windowWidth/Height: scrollWidth/Height })`
  6. **반드시** finally 블록처럼 원상복구 (collapsed 재부여, 버튼 visibility 복원)
- `setDlBtnsBusy(busy)` — 두 버튼 동시 비활성화/시각 다운 처리
- `downloadPDF()` — A4 세로(210×297mm), 8mm 여백, `canvas.height` 가 한 페이지보다 크면 PNG slice 로 분할하여 `pdf.addPage()` → `pdf.addImage()` 반복
- `downloadPPT()` — `LAYOUT_WIDE` (13.333×7.5 inch), 0.3 inch 여백, 마찬가지로 슬라이스 단위로 슬라이드 추가
- 파일명: `dcamp-invest-kpi-${period}-${YYYY-MM-DD}.{pdf|pptx}` (period = 선택 연도 또는 "전체")

알려진 한계:
- 캡처 시 폰트(SUIT Variable)가 이미 로드되어 있어야 함 — 첫 진입 직후 즉시 다운로드하면 폰트 미적용 가능
- 차트 캔버스는 same-origin 이라 정상 캡처되지만, 만약 이미지 호스팅을 외부 도메인으로 옮기게 되면 `useCORS` 이슈 점검 필요
- `position:sticky` 가 걸린 `.fbar` 등은 캡처 시 정상 위치로 잡히도록 `windowWidth/Height` 를 명시적으로 지정함

---

### 🟢 7차 (2026-05-19): 투자 연도 분류 기준 변경 (D열 → O열)

**배경**
- 기존: 투자 데이터의 연도 분류를 `D열 투자일자` 기준으로 계산
- 변경: `O열 의결일자` 기준으로 변경 — "O열에 2026으로 시작하는 기업만 2026년 투자로 인정"
- **회수는 변경 없음** — 그대로 `E열 회수일자` 기준 유지

**구현**
- `COLUMN_MAP.date` 인덱스: `3 → 14`
- 변수명(`COL.date`)은 그대로 두되 주석에 "의결일자" 명시
- 영향 받는 부분 (모두 자동 반영됨, 추가 수정 불필요):
  - `getFiltered()` / `getCardFiltered()` — 연도/분기 필터
  - `renderChart`의 분기별 집계
  - 연도 드롭다운 자동 생성 (`[...new Set(...qi(r[COL.date])?.y...)]`)
  - 극초기 상세 테이블 정렬·표시 (`a[COL.date]` → 의결일자로 정렬)
  - `rawData` 1차 필터 (의결일자가 비어있는 행은 제외됨)
- UI 라벨: 극초기 상세 테이블 헤더 `투자일자 → 의결일자`로 변경

**주의사항**
- 의결일자가 비어 있는 과거 투자 데이터는 연도 필터에 잡히지 않음 (대시보드 투자 집계에서 제외)
- 동일 기업이 의결일자/투자일자가 다른 연도일 경우, 본 변경 이후 의결일자 기준 연도로 분류됨
- 시트 O열에 의결일자가 누락된 항목이 있으면 데이터 입력 보완 필요

**7차 직후 보완 (회수 0건 버그 픽스)**
- 증상: 시트 raw 1차 필터(`r[COL.date]?.trim().length>=4`)가 의결일자 기준으로 바뀌어, **의결일자가 비어 있는 과거 행이 rawData에서 통째로 제거** → 그 행에 회수일자가 있어도 회수 집계에 안 잡힘 (예: 2012년 투자 → 2025년 회수, 의결일자 없음)
- 수정: raw 필터를 OR 조건으로 변경
  ```js
  rawData=rows.slice(1).filter(r=>{
    const hasDate=(r[COL.date]||'').trim().length>=4;
    const hasExitDate=(r[COL.exitDate]||'').trim().length>=4;
    return hasDate||hasExitDate; // 둘 중 하나라도 있으면 유지
  });
  ```
- 결과: 의결일자 없는 행도 회수일자가 있으면 살아남아 `calcExitByYear()`가 정상 집계함

---

## 🔧 자주 쓰는 운영 명령

**로컬 열기**
- 파일 탐색기에서 `index.html` 더블클릭
- 또는 `file:///C:/Users/디캠프/Desktop/claude/작업물/invest-kpi/index.html`

**재배포 (수정 후)**
```bash
cd "C:/Users/디캠프/Desktop/claude/작업물/invest-kpi"
vercel --prod --yes
```

**스모크 테스트**
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://dcamp-invest-kpi.vercel.app
curl -s -o /dev/null -w "FONT %{http_code} · %{content_type}\n" https://dcamp-invest-kpi.vercel.app/fonts/SUIT-Variable.ttf
```

---

## 🧠 앞으로 건드리지 말 것 (5차 기준 고정값)

- 컬럼 매핑(`COLUMN_MAP`의 D/E/F/K/M/N) — 시트 구조 바뀌면 여기만 수정
- 연도 필터 동작 (누적/분기 모드 포함)
- 아코디언 클릭 토글 동작
- 전체 색상 테마 (`--or`, `--ok`, `--bad` 등)
- 테이블 정렬 유틸리티(`.tl / .tc / .tr`)

---

## 🪴 향후 손대면 좋을 것 (아이디어)

- 연도별 투자한도(`YEAR_BUDGETS`)가 `YEARLY_GOALS.investLimit`와 이중으로 관리 중 → 통합
- `YEARLY_GOALS`에 2031+ 연도가 들어오면 목표 테이블이 자동 확장되도록 차트 Y축 스케일 유연화
- 회수 차트는 현재 2026~2030 고정 — `Object.keys(YEARLY_GOALS)`로 동적 생성하면 관리 편함
- 도메인 집중도 실적도 "금액 기준/건수 기준" 토글이 있으면 편의성 ↑ (현재는 건수 기준 고정)

---

---

### 🟢 8차 (2026-07-01): 펀드팀 탭 통합 + 건수/금액 이중 막대 + 도메인 변경

**펀드팀 대시보드 추가**
- `index (11).html` (펀드팀 전용 대시보드)을 `index_투자+펀드.html`에 합체
- 상단에 **투자팀 / 펀드팀** 탭 전환 UI 추가
- 각 탭은 독립 데이터 소스 · 독립 렌더링 로직

**도메인별 투자 현황 차트 개선 (건수+금액 이중 막대)**
- 기존: 건수만 단일 막대
- 변경: **금액 막대 + 건수 막대** 그룹형 가로 막대 차트 (Chart.js grouped bar)
  - 금액 비중(%) · 건수 비중(%) 각각 X축 기준 백분율로 표시
  - 핵심 도메인(★): 주황 계열 / 일반: 회색 계열
- 차트 범례(legend) HTML 추가: 핵심·금액 / 핵심·건수 / 일반·금액 / 일반·건수

**Vercel 프로젝트 도메인**
- `dcamp-invest-kpi`로 프로젝트명 확정 → `https://dcamp-invest-kpi.vercel.app`

---

### 🟢 9차 (2026-07-01): 차트 제목 변경 + 색상 구분 개선

**차트 제목**
- `2026년 · 누적 · 도메인별 투자 건수 · 금액` → **`N년 도메인별 투자 현황`**
  - 연도 필터에 따라 "2026년 도메인별 투자 현황" 등으로 동적 변경

**색상 구분 강화**
- 금액 막대(실선): 핵심 = 파랑 `rgba(29,78,216,0.85)` / 일반 = 슬레이트 회색
- 건수 막대: Canvas `createPattern()`으로 **빗금 패턴** 적용
  - 핵심 건수 = 주황(`#FF5831`) 빗금 / 일반 건수 = 회색(`#BBBBBB`) 빗금
- 범례도 동일 스타일 반영 (`repeating-linear-gradient` CSS로 빗금 표현)

---

### 🟢 10차 (2026-07-01): 금액 기준 정렬 + 막대 순서 조정

**차트**
- 금액 비중 기준 내림차순 정렬 (`renderChart` 내에서 `sort((a,b)=>b[1].amt-a[1].amt)`)
- 데이터셋 순서: **금액 막대 먼저, 건수 막대 나중** (기존 반대였음)

---

### 🟢 11차 (2026-07-01): 핵심 도메인 색상 주황으로 통일

**차트 색상 변경**
- 핵심 도메인 금액 막대: 파랑(`rgba(29,78,216,0.85)`) → **주황(`rgba(255,88,49,0.85)`)**
- 핵심 도메인 건수 막대: 주황 빗금 유지 (변경 없음)
- 일반 도메인: 변경 없음 (회색 계열 유지)
- 범례 "핵심 · 금액" 색상도 파랑 → 주황으로 업데이트

```js
// 핵심=주황 실선 / 일반=회색 실선
const amtColors=sorted.map(([d])=>KEY_DOMAINS.has(d)?'rgba(255,88,49,0.85)':'rgba(100,116,139,0.75)');
const amtBorders=sorted.map(([d])=>KEY_DOMAINS.has(d)?'#FF5831':'#64748B');
// 핵심=주황 빗금 / 일반=회색 빗금
const cntColors=sorted.map(([d])=>makeDiagPattern(KEY_DOMAINS.has(d)?'#FF5831':'#BBBBBB'));
```

---

### 🟢 12차 (2026-07-01): 도메인별 상세현황 테이블 개선

**제목**
- `2026년 · 도메인별 상세 현황 (N개)` → **`2026년 도메인별 상세 현황 (N개)`** (· 제거)

**컬럼 순서 변경**

| 변경 전 | 변경 후 |
|---|---|
| 도메인 · 구분 · 건수 · 건수비중 · 금액(억원) · 금액비중 · 집중도 | 도메인 · 구분 · **금액(억원) · 금액비중 · 건수(건) · 건수비중** · 집중도 |

- 헤더 HTML, 데이터 행(`renderTable`), 핵심 도메인 소계 행 모두 동일 순서로 수정

**정렬**
- 테이블도 금액 기준 내림차순 정렬 추가 (`sortedDisplay` 로컬 변수 사용)
- 소계 행은 정렬 대상 제외, 항상 맨 아래 고정

---

### 🟢 13차 (2026-07-07): G열 "극초기 여부" 추가에 따른 컬럼 재매핑 (데이터 미반영 버그 수정)

**배경**
- 시트 G열에 "극초기 여부 (기관 최초투자 or Pre-100억 이하)" 컬럼을 신규 추가
- 그 뒤에 있던 모든 컬럼이 한 칸씩 밀렸는데 `COLUMN_MAP`은 예전 위치를 그대로 참조 → 의결일자 자리에 실제로는 회수금액이 들어와 날짜 파싱 실패, 투자 데이터 전체가 대시보드에 반영 안 되는 버그 발생

**컬럼 매핑 변경**

| 상수 key | 이전 | 이후 |
|---|---|---|
| `minor` (중분류) | K(10) | **L(11)** |
| `amount` (투자금액) | M(12) | **N(13)** |
| `exitAmount` (회수금액) | N(13) | **O(14)** |
| `date` (의결일자) | O(14) | **P(15)** |
| `earlyFlag` (극초기 여부, 신규) | — | **G(6)** |

**극초기 판정 기준 변경**
- 기존: `preValue < 100억원` 자동 계산 (`EARLY_PREVALUE_THRESHOLD`)
- 변경: **G열 값이 "여"인 행만** 극초기로 카운팅 (`getEarlyDeals` 수정)
- `EARLY_PREVALUE_THRESHOLD` 상수 제거 (더 이상 사용 안 함)
- UI 라벨: "극초기 투자 실적 (Pre-value 100억원 미만)" → **"극초기 투자 실적 (기관 최초투자 or Pre-100억 이하)"**

**주의사항**
- 시트 구조(컬럼 순서)가 또 바뀌면 `COLUMN_MAP`을 다시 맞춰야 함 — 열 삽입/삭제 시 이 문서의 표부터 확인
- 확인 시점 기준 G열에 "여"로 표기된 행은 3건, 의결일자(P열) 채워진 행은 40건/263건 — 나머지는 시트 데이터 입력 상태에 따름 (코드 버그 아님)

---

### 🟢 14차 (2026-07-14): 2026 투자 브리핑 (AI 인사이트) — 배포 완료

> 목표 카드 4장 위에 AI 기반 "진척도 + 제안형 브리핑" 영역 추가. **경로 A(실적 데이터 기반)로 출시.** 기밀 검토리스트 연동은 회사 보안정책(`iam.disableServiceAccountKeyCreation`, 서비스계정 JSON 키 생성 차단)으로 보류 → 추후 WIF/관리자 예외로 얹을 예정.

**구현 요약**
- 신규 `api/briefing.js` (Vercel 서버리스, `@google/generative-ai`, 모델 `gemini-2.5-flash`, 응답 스키마 `{headline, diagnosis, proposals[]}` 고정)
- `package.json`(의존성), `.env`/`.env.example`(로컬), Vercel 환경변수 `GEMINI_API_KEY`(Production) 등록
- `.gitignore`에 `.env`, `node_modules` 추가 (키 유출 방지)
- index.html: 투자탭 `#team-invest` 최상단에 `#briefing` 블록 삽입 (goal-banner 위) + CSS + JS 모듈
- **숫자·신호등은 브라우저가 계산**(기존 `calcStats`/`getEarlyDeals`/`calcExitByYear` 재사용 → 카드와 100% 일치), **AI는 문장만**. `renderBriefing(yv)`는 `renderAll` 끝에서 try/catch로 격리 호출.
- 표시 조건: **연도 필터 === '2026'** 일 때만 (그 외 숨김)
- 캐시: `localStorage['brief-ai-<날짜>']`, 숫자 서명(sig) 일치 시 재사용 → 실질 하루 1회 호출. 숫자 바뀌면 재생성.
- AI 먹통/키 없음: 신호등·숫자만 표시하고 `#brief-note`로 안내 (브리핑 통째로 사라지지 않음)
- 신호등 색상 범례(🟢순조/🟡주의/🔴시급): `.brief-head` 오른쪽 상단 `.brief-legend`로 표시

**신호등 판정 규칙** (`index.html`)
- 집중도(ratio): 실적/목표 ≥1 초록, ≥0.85 노랑, 그 외 빨강
- 극초기·회수(flow): 달성률 ÷ 연중경과율(pace) ≥0.9 초록, ≥0.6 노랑, 그 외 빨강 (기한=12월 말)
- 투자한도(ceiling): 소진율 >100 빨강, ≥90 노랑, 그 외 초록

**향후(검토리스트 연동 시)**: `api/briefing.js`에 서버사이드로 검토리스트를 읽어 `(초)/(후)` 딜 집계를 프롬프트에 주입 → 극초기·집중도 제안 구체화. 회사명은 집계로만 노출.

**향후(접속 보안 — 보류)**: "@dcamp.kr 계정만 접속" 요청 → 다음에 추가 예정. 방안 A(권장) = Google OAuth(동의화면 Internal → dcamp.kr 조직만 인증 + `hd=dcamp.kr` 검증) + Vercel Middleware로 전 페이지 게이트 + 로그인/콜백 함수 2개 + 세션 쿠키(SESSION_SECRET). 방안 B = 공통 비밀번호 1개(간단하나 계정 구분 없음). 켜면 미로그인 사용자는 전부 차단되므로 팀 공지 필요. (OAuth 클라이언트는 서비스계정 키와 다른 종류라 이전 조직정책에 안 걸릴 가능성.)

---

## 📝 (원본 기획 메모) 2026 투자 브리핑 설계

> 2026-07-14 기획 확정. 아래는 구상 단계 메모 (구현은 위 14차 참조).

**위치·노출**
- 투자 탭, 목표 카드 4장 바로 위
- **2026 선택 시에만** 표시 (과거 연도 필터 시 헤드라인 없음)

**모양: 헤드라인 + 신호등 4칸 + 두 층(진단/제안)**
```
┌ 헤드라인(AI) ─────────────────────────────────┐
│ 2026년, 목표 4개 중 2개 순조 · 2개는 속도 필요    │
├ 신호등·숫자(코드 계산) ────────────────────────┤
│ 🟡집중도 72% │🟡극초기 32/50억│🔴회수 5.2/12.6│🟢한도 56%│
├ 진단(AI, 짧게) ───────────────────────────────┤
│ 🔎 회수가 반년 경과 대비 뒤처져 가장 시급          │
├ 제안(AI, 적극·집계로만) ───────────────────────┤
│ 💡 검토 중 핵심도메인 초기딜 진행 시 집중도+극초기 충족│
│    회수는 하반기 집중, 페이스 점검 우선            │
└───────────────────────────────────────────────┘
```

**역할 분담 (숫자 안전장치)**
| 항목 | 담당 |
|---|---|
| 숫자·달성률·신호등 색 | **코드** (AI 못 건드림 → 숫자 오류 원천 차단) |
| 헤드라인·진단·제안 문장 | **AI(Gemini)**, JSON 스키마 검사 통과분만 표시 |

**핵심 규칙 (합의 사항)**
- 페이스 기준: 목표 마감 = **2026-12-31** → 연중 경과율로 "뒤처짐" 판정 (신규 계산 필요)
- 제안 재료: 검토리스트의 `(초)=초기투자 / (후)=후속투자` 활용 → 극초기·집중도 제안에 연결. 회수는 예정 파이프라인 없음 → **방향 제안까지만**
- 기밀: 검토 중 기업명 **숨기고 집계로만** 노출 ("핵심도메인 초기딜 2건" 식)
- 생성 시점: **하루 1회 생성 후 캐시**
- AI 먹통 시: 글은 비우고 **신호등·숫자만** 표시

**데이터 소스**
- 실적: 기존 로우데이터 시트 (그대로)
- 검토리스트(기밀): 별도 시트 `13npeAuys3M4zeSXE1_jWfINa2PUze9Lf` (gid 204565049) — **제한된 보기**
  - 컬럼 구조 확인 필요 (서비스계정 연결 후 확인 예정)

**아키텍처 (기밀 보호 = 서버 사이드 처리)**
```
검토리스트(기밀) → [api/briefing.js 서버 함수 안에서만 읽기] → 계산 → Gemini
                                                             ↓
화면(공개 URL) ← 완성된 "브리핑 글 + 숫자"만 수신 (원본 리스트 절대 미노출)
```
- 신규 파일: `api/briefing.js` (Vercel 서버리스 함수)
- 검토리스트 읽기: **비공개 구글 서비스계정** (public CSV 금지 — 기밀이라 화면 노출 위험)

**빌드 전 준비물 (진행 중)**
1. Gemini API 키
2. 구글 서비스계정 발급 (JSON 키)
3. 서비스계정 이메일을 검토리스트 시트에 뷰어로 공유
4. 검토리스트 시트 실제 컬럼 구조 확인
- Vercel 환경변수 등록: `GEMINI_API_KEY`, 서비스계정 JSON

**진행 방식**: (A) 준비물(서비스계정 등)부터 함께 → 완료 후 빌드 착수

---

_마지막 업데이트: 2026-07-14 (14차 2026 AI 브리핑 + 신호등 범례 배포 완료 · 접속 보안은 보류)_
