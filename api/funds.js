// ============================================================================
// Vercel 서버리스 함수 — 구글시트에서 펀드별 잔여투자금액·결성연도를 읽어 반환
// 경로: /api/funds  (대시보드가 접속 시 자동 호출)
// 필요 환경변수: GSA_KEY = 서비스 계정 키 JSON 전체 문자열
//   (Vercel > Project > Settings > Environment Variables 에 등록.
//    키 원본: dcamp-investment-analyzer 서비스 계정 JSON 파일 내용 전체 복사)
// 로컬 사용 시에는 이 함수 대신 sync_funds.py 가 ./api/funds 파일을 생성합니다.
// ============================================================================
const crypto = require('crypto');

const SHEET_ID = '1W_ov57w2YHgjpEoSkCFBcmbgV1S8VxtencUoDxHzn-A';
const MAIN_TAB = "d.camp 출자펀드 현황_연관기업투자"; // D=펀드명, I=의무투자금액, L=잔여투자금액
const MGMT_TAB = "간접투자정보관리";                   // C=펀드명, F=결성일자(엑셀 일련번호)
const EXCLUDE  = ['비율', '소진율', '합계', '소계'];   // 펀드가 아닌 요약 행

async function getToken(sa){
  const now = Math.floor(Date.now()/1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({alg:'RS256',typ:'JWT'}) + '.' + b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + unsigned + '.' + sig
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token_failed');
  return j.access_token;
}

module.exports = async (req, res) => {
  try {
    const sa  = JSON.parse(process.env.GSA_KEY);
    const tok = await getToken(sa);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet` +
      `?valueRenderOption=UNFORMATTED_VALUE` +
      `&ranges=${encodeURIComponent(`'${MAIN_TAB}'!D4:Q200`)}` +
      `&ranges=${encodeURIComponent(`'${MGMT_TAB}'!C2:F500`)}`;
    const j = await (await fetch(url, {headers: {Authorization: 'Bearer ' + tok}})).json();
    const [main, mgmt] = j.valueRanges.map(v => v.values || []);

    const nrm = s => String(s).toLowerCase().replace(/\s+/g, '');
    const vint = {};
    for (const r2 of mgmt) {
      const n = String(r2[0] || '').trim(), s = r2[3];
      if (n && typeof s === 'number' && s > 30000)
        vint[nrm(n)] = new Date(Date.UTC(1899, 11, 30) + s * 86400000).getUTCFullYear();
    }
    const findV = n => {
      const c = nrm(n);
      if (vint[c]) return vint[c];
      for (const k in vint) if (k.startsWith(c) || c.startsWith(k)) return vint[k];
      return null;   // 결성연도 없음 → 대시보드가 내장값으로 보완하거나 결성예정으로 제외
    };

    const funds = [];
    for (const r2 of main) {
      const name = String(r2[0] || '').trim(), ob = r2[5], rem = r2[8];
      if (!name || EXCLUDE.some(x => name.includes(x))) continue;
      if (typeof rem !== 'number' || rem <= 0) continue;
      const num = x => (typeof x === 'number' ? x : 0);
      funds.push({
        name,
        rem: +(rem / 1e8).toFixed(6),                                       // 잔여투자금액(억)
        ob: (typeof ob === 'number' && ob > 0) ? +(ob / 1e8).toFixed(6) : null,
        vintage: findV(name),
        e: +(num(r2[11]) / 1e8).toFixed(6),                                 // Early 잔여(억)
        g: +(num(r2[12]) / 1e8).toFixed(6),                                 // Growth 잔여(억)
        l: +(num(r2[13]) / 1e8).toFixed(6)                                  // Late 잔여(억)
      });
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600'); // 5분 캐시
    res.status(200).json({updated: new Date().toISOString().slice(0, 19), funds});
  } catch (e) {
    res.status(500).json({error: 'sync_failed'});
  }
};
