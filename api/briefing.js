// api/briefing.js
// 투자 KPI 대시보드 "2026 브리핑" 생성 서버 함수.
// 브라우저가 이미 계산한 숫자(집중도/극초기/회수/투자한도)를 받아서,
// Gemini가 "숫자는 그대로 두고 문장만" 작성한다. (숫자 계산·판정은 절대 AI가 안 함)
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_INSTRUCTION = `
너는 d.camp 직접투자팀의 KPI 대시보드에 들어갈 "브리핑 문구"를 쓰는 보조자다.
입력으로 2026년 목표 대비 실적 숫자가 이미 계산되어 들어온다.

[절대 규칙]
1. 숫자를 새로 만들거나 다시 계산하지 마라. 주어진 숫자만 쓴다. 다르게 바꾸지 마라.
2. 특정 회사 이름은 언급하지 마라 (아직 파이프라인 데이터가 없다). 도메인/전략 방향으로만 제안한다.
3. 이모지를 쓰지 마라 (화면에서 따로 붙인다).
4. 사람이 쓴 것처럼 자연스럽고 담백한 한국어. 딱딱하거나 AI 같은 말투 금지. 각 문장은 짧게.

[판단 배경]
- 목표 달성 기한은 2026년 12월 말이다. 입력의 elapsedPct(연중 경과율)를 기준으로 "페이스(속도)"를 판단하라.
  예: 어떤 누적 지표의 달성률이 경과율보다 많이 낮으면 "페이스가 뒤처졌다"고 본다.
- 지표 성격(kind):
  - ratio(집중도): 비중이라 페이스 개념이 약하다. 목표치 대비 얼마나 가까운지로 본다.
  - flow(극초기/회수): 연말까지 쌓아야 하는 누적 금액. 달성률 vs 경과율로 페이스를 본다.
  - ceiling(투자한도): 넘으면 안 되는 한도. 많이 남았으면 여유, 거의 다 썼으면 주의.

[출력]
- headline: 전체 상황을 한 문장으로 요약 (예: "목표 4개 중 2개는 순조롭고, 회수·집중도는 속도를 높여야 합니다").
- diagnosis: 가장 시급하거나 뒤처진 항목 1가지를 짧게 짚는다 (한 문장).
- proposals: 부족분을 채우기 위한 구체적이고 적극적인 방향 제안 1~3개. 각 항목은 한 문장.
  회수는 회사를 못 짚으니 "하반기 집중/페이스 점검" 같은 방향까지만. 극초기·집중도는 "미달 핵심 도메인 우선" 같은 방향으로.
`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    diagnosis: { type: 'string' },
    proposals: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'diagnosis', 'proposals'],
};

// 입력 숫자를 Gemini가 읽기 좋은 텍스트로 정리 (여기서 값은 절대 바꾸지 않음)
function buildPrompt(m) {
  const k = m.kpis || {};
  const line = (x) => {
    if (!x) return '';
    if (x.kind === 'ceiling')
      return `- ${x.label}: 소진 ${x.used}${x.unit} / 한도 ${x.limit}${x.unit} (소진율 ${x.rate}%, 신호등 ${x.light})`;
    const cnt = x.count != null ? ` · ${x.count}건` : '';
    return `- ${x.label}: 실적 ${x.actual}${x.unit} / 목표 ${x.target}${x.unit} (달성률 ${x.rate}%${cnt}, 성격 ${x.kind}, 신호등 ${x.light})`;
  };
  return [
    `기준일: ${m.asOf} · 2026년 중 약 ${m.elapsedPct}% 경과 (연말까지 약 ${m.daysLeft}일 남음)`,
    '',
    '[2026년 목표 대비 실적 — 이미 확정된 숫자]',
    line(k.concentration),
    line(k.early),
    line(k.exit),
    line(k.budget),
  ].filter((s) => s !== '').join('\n');
}

function validMetrics(m) {
  return m && typeof m === 'object' && m.kpis && typeof m.kpis === 'object';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '허용되지 않은 메서드입니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      error: 'GEMINI_API_KEY가 서버 환경변수에 설정되지 않았습니다.',
    });
  }

  // Vercel Node 함수는 JSON body를 자동 파싱하지만, 문자열로 올 수도 있어 방어적으로 처리
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const metrics = body && body.metrics;
  if (!validMetrics(metrics)) {
    return res.status(400).json({ ok: false, error: '지표 데이터(metrics)가 없거나 형식이 올바르지 않습니다.' });
  }

  const prompt = buildPrompt(metrics);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        ok: false,
        error: 'Gemini 응답이 JSON 스키마와 일치하지 않습니다. 재시도가 필요합니다.',
        detail: text.slice(0, 500),
      });
    }

    // 스키마 최소 검증 — 필드가 없으면 프론트가 신호등만 표시하도록 실패 처리
    if (!data || typeof data.headline !== 'string' || !Array.isArray(data.proposals)) {
      return res.status(502).json({ ok: false, error: 'Gemini 응답 구조가 올바르지 않습니다.' });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Gemini 호출 중 오류가 발생했습니다.',
      detail: String((err && err.message) || err),
    });
  }
};
