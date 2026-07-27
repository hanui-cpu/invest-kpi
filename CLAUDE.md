# dcamp KPI 대시보드 (invest-kpi) — AI 작업 지침

빌드 도구 없는 정적 사이트 + Vercel 서버리스 함수. 사람용 절차는 `MAINTENANCE.md` 참고.

## 배포 파이프라인 (절대 규칙)

- **main에 머지되면 Vercel이 자동 배포**한다 (dcamp-invest-kpi.vercel.app, 1~2분).
- **Vercel 수동 배포 금지.** GitHub main이 유일한 진실이다. 수동 배포는 코드-실서비스 불일치 사고를 만든다(2026-07 실제 발생).
- 작업은 항상 브랜치 + PR로. main 직접 푸시 금지. 잘못 머지되면 PR의 Revert 사용.
- 사용자가 GitHub 웹 에디터만 쓸 수 있게 안내할 것 (git CLI 강요 금지).

## 구조 — 팀별 독립 페이지 (2026-07-27 분리 완료)

| 파일 | 내용 | 담당 |
|---|---|---|
| `index.html` | 투자팀 페이지 전체 (마크업+CSS+JS 단일 파일, AI 브리핑 포함) | 투자팀(hanui-cpu) |
| `fund.html` | 펀드팀 페이지 전체 (단일 파일, 시뮬레이터 이동 버튼 포함) | 펀드팀(juheum/zoom-dcamp) |
| `drypowder.html` | 의무투자 배수 시뮬레이터 | 펀드팀 |
| `api/sheet.js` | 비공개 구글시트 → CSV 중계 (`/api/sheet?doc=main|fund&tab=…`) | 투자팀 |
| `api/briefing.js` | AI 브리핑 생성 | 투자팀 |
| `api/funds.js` | 시뮬레이터용 펀드 데이터 (시트 실시간) | 펀드팀 |
| `funds_data.js` | 시뮬레이터 오프라인 스냅샷 (api 실패 시 폴백) | 펀드팀 |

핵심 불변식:

1. **index.html과 fund.html은 각각 완전히 독립**(self-contained). 헤더·전체 CSS·PDF/PPT 캡처 코드가 **양쪽에 복제**되어 있다 → 공통 요소 수정은 반드시 두 파일에 동일 적용. 한 팀 페이지 내부 수정은 그 파일만.
2. 페이지 간 이동은 헤더 탭의 `location.href` 링크 (switchTeam 함수는 폐기됨). 각 페이지는 `const currentTeam='invest'|'fund'` 고정 — 공용 다운로드 코드의 반대 팀 분기는 의도된 dead code이므로 "미정의 참조"로 오인해 지우지 말 것.
3. **drypowder.html의 원본은 이 리포가 아니다** — 펀드팀 로컬 프로젝트("출자 펀드 드라이파우더 소진" 폴더)에서 독립 재계산 검증을 거쳐 복사해 온다. 배포본과 원본의 유일한 차이 = 헤더의 "← 펀드팀 KPI 대시보드" 복귀 버튼 한 줄(주석 표시). **시뮬레이터의 수치·계산 로직을 이 리포에서 직접 수정하지 말고 펀드팀에 요청하라.** 문구 수준 수정은 가능하나 원본 관리자(juheum)에게 알릴 것.
4. **확장자 없는 `api/funds` 파일을 절대 커밋하지 말 것** — 정적 파일이 서버리스 함수 라우트를 가려 실시간 연동이 죽는다 (.gitignore에 있음).

## 데이터 흐름·환경변수

- 두 대시보드: `fetchCsvRows()` → `/api/sheet?doc=…` (시트는 비공개, 서버 함수가 로봇 계정으로 읽음). env: `GOOGLE_SERVICE_ACCOUNT_JSON`.
- 시뮬레이터: `fetch('api/funds')` → 실패 시 `funds_data.js` 스냅샷("로컬 모드" 표시). env: `GSA_KEY` 우선, 없으면 `GOOGLE_SERVICE_ACCOUNT_JSON` 재사용.
- 타임스탬프는 KST(Asia/Seoul)로 변환해 내보낸다 — 서버는 UTC이므로 `toISOString()` 그대로 쓰면 9시간 늦게 보인다(수정된 버그, 재발 금지).
- `fetchCsvRows`의 fetch는 `credentials:'same-origin'` — Vercel 프리뷰(SSO 보호)에서 API가 동작하기 위한 설정이니 'omit'으로 되돌리지 말 것.
- Vercel 환경변수는 Production에만 적용되어 있을 수 있음 → 프리뷰에서 데이터 500은 env 범위 문제이지 코드 버그가 아닐 수 있다.

## 알려진 함정 (실제 발생 사례)

- **시트 헤더 문구로 표를 찾는 파서**: `rowHas()`는 부분 문자열 매칭이다. 해외 표 헤더의 "통화구분"이 국내 표 조건('구분')에 걸려 국내 펀드 목록이 0건이 된 사례 있음(수정: `!rowHas(r,'국가')` 추가). 시트 열/헤더 변경 시 파서 영향을 반드시 확인하라.
- **로컬 정적 서버/file://에서는 api 계열이 404/500** → 진단 배너가 뜨는 게 정상 동작. 코드 버그로 오진하지 말 것. 실데이터 검증이 필요하면 `/api/*`를 실서비스로 프록시하는 로컬 서버를 만들어 테스트하라.
- 원본에 존재하는 소수의 dead 참조(mt-c, vw-all, c-early-cnt, dom-tooltip, f-year 등)는 null 가드/미호출로 안전하다 — 정리하려면 별도 PR로.

## 검증 기대치

수정 후 최소한: (1) 두 페이지 브라우저 로드에 미처리 예외 없음, (2) 헤더 탭 왕복·시뮬레이터 버튼·복귀 버튼 동작, (3) 머지 후 실서비스에서 데이터 로딩 확인. 대규모 수정이면 분리 불변식(위 1·2번) 위반 여부를 grep으로 점검하라.
