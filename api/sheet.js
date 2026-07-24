// api/sheet.js
// 비공개 Google Sheets를 "서비스(로봇) 계정"으로 서버에서 읽어 CSV로 돌려주는 함수.
//
// 배경: 대시보드는 원래 브라우저가 시트를 공개 CSV로 직접 읽었지만,
//       시트를 "제한됨(비공개)"으로 바꾸면서 브라우저가 못 읽게 됨.
//       이 함수가 로봇 계정 열쇠로 서버에서 대신 읽어, 화면에는 CSV만 넘겨준다.
//       (기존 브라우저 파싱 로직은 그대로 — CSV 형식을 gviz/export와 동일하게 맞춤)
//
// 필요 환경변수: GOOGLE_SERVICE_ACCOUNT_JSON = 서비스계정 JSON 키 전체(한 줄 문자열)
const { JWT } = require('google-auth-library');

// doc 별칭 → 실제 스프레드시트 ID (ID를 프론트에 노출하지 않기 위해 서버에 둠)
const DOCS = {
  main: '1TQpPtnBowiQKw_dQrol29Gi27PRf7xKzwvUkQaPHW30', // 투자팀 로우데이터
  fund: '1bt9SeuQLF8Cf6W66zUqYIKHxrNRrLgin-dsOx1jLcRc', // 펀드팀 시트
};

// 워밍된 인스턴스에서 재사용 (콜드스타트마다 새로 생성)
let _client = null;
const _firstSheetTitle = {}; // { [spreadsheetId]: 'Sheet1' }

function getClient() {
  if (_client) return _client;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 없습니다.');
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON JSON 파싱 실패 — 키 값 형식을 확인하세요.');
  }
  _client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return _client;
}

async function authHeader() {
  const client = getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('액세스 토큰 발급 실패 (서비스계정 키를 확인하세요).');
  return { Authorization: `Bearer ${token}` };
}

// gid=0(첫 시트) 이름을 메타데이터에서 조회 (Sheets API는 범위에 시트 이름이 필요함)
async function firstSheetTitle(id, headers) {
  if (_firstSheetTitle[id]) return _firstSheetTitle[id];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties(title,index)`;
  const r = await fetch(url, { headers });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`시트 메타데이터 조회 실패 (HTTP ${r.status}): ${body.slice(0, 300)}`);
  }
  const j = await r.json();
  const sheets = (j.sheets || []).slice().sort((a, b) => (a.properties.index || 0) - (b.properties.index || 0));
  if (!sheets.length) throw new Error('시트에 탭이 없습니다.');
  const title = sheets[0].properties.title;
  _firstSheetTitle[id] = title;
  return title;
}

// 컬럼 문자(A,B,...,AA) → 번호(1-based)
function colToNum(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
// "A22:O35" → 폭(컬럼 수). gviz가 범위 폭만큼 컬럼을 채워주던 동작을 재현.
function rangeWidth(range) {
  const m = String(range).match(/^([A-Za-z]+)\d*:([A-Za-z]+)\d*$/);
  if (!m) return null;
  return colToNum(m[2]) - colToNum(m[1]) + 1;
}

// 2차원 배열 → CSV (콤마/따옴표/줄바꿈 이스케이프)
function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? '' : String(cell);
          return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(',')
    )
    .join('\r\n');
}

module.exports = async (req, res) => {
  // CORS (같은 오리진이라 보통 불필요하지만, 로컬/캐시 환경 대비)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const doc = (req.query && req.query.doc) || 'main';
    const tab = req.query && req.query.tab;   // 시트(탭) 이름 (펀드팀)
    const range = req.query && req.query.range; // A1 범위 (선택)

    const id = DOCS[doc];
    if (!id) {
      return res.status(400).json({ ok: false, error: `알 수 없는 doc 값입니다: ${doc}` });
    }

    const headers = await authHeader();

    // 읽을 A1 범위 조립: 탭 이름이 없으면 첫 시트 이름 자동 조회
    const sheetName = tab || (await firstSheetTitle(id, headers));
    const a1 = range ? `'${sheetName}'!${range}` : `'${sheetName}'`;

    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(a1)}` +
      `?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      const body = await r.text();
      // 403 = 로봇 계정이 이 시트에 뷰어로 공유되지 않음 (가장 흔한 원인)
      const hint =
        r.status === 403
          ? ' — 이 시트의 공유 설정에 서비스계정을 뷰어로 추가했는지 확인하세요.'
          : '';
      return res.status(r.status).json({
        ok: false,
        error: `Sheets API 오류 (HTTP ${r.status})${hint}`,
        detail: body.slice(0, 300),
      });
    }

    const j = await r.json();
    const values = j.values || [];

    // 컬럼 정렬 보존: gviz가 하던 대로 각 행을 범위 폭(또는 최대 폭)까지 빈칸으로 패딩
    const maxLen = values.reduce((mx, row) => Math.max(mx, row.length), 0);
    const width = (range && rangeWidth(range)) || maxLen;
    const padded = values.map((row) => {
      const out = row.slice();
      while (out.length < width) out.push('');
      return out;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.status(200).send(toCsv(padded));
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: '시트 읽기 중 오류가 발생했습니다.',
      detail: String((err && err.message) || err),
    });
  }
};
