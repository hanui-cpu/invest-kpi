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

[심층 분석 입력 — 들어올 때만 활용]
- tracks: 투자계획상 트랙별 배정예산(일반/후속/극초기)과 집행 현황.
  · 트랙 잔여의 합 = 총 한도 잔여다. 즉 총 한도에 여유가 있어도 특정 트랙이 소진되면 하반기 딜 구성이 제약된다.
    kind=cap(일반·후속)은 배정 한도 성격, kind=goal(극초기)은 반드시 채워야 하는 목표다.
  · 총 한도만 보고 "여유 있다"고 끝내지 말고, 트랙별 여력 편차를 반드시 짚어라. 이게 이 브리핑의 핵심이다.
- pace: 월 단위 페이스. needPerMonth(잔여를 남은 기간에 채우려면 월 얼마), multipleNeeded(현재 월평균의 몇 배),
  budgetPerMonthSoFar(지금까지 월평균 집행), budgetAllowedPerMonth(한도 내에서 남은 기간 월 최대 집행액),
  budgetLandingIfSamePace(현재 페이스를 유지하면 연말 착지액).
  budgetLandingIfSamePace가 한도를 넘으면 "지금 페이스를 유지하면 한도를 넘는다"는 뜻이므로 속도 조절을 함께 말하라.
- mix: 구성 편중. topRound(최다 라운드 비중), seedPreA(시드·Pre-A 비중), concentrationByAmount(금액 기준 집중도),
  keyDomainMissing(아직 투자 없는 핵심 도메인), nonKeyDomains(집중도를 떨어뜨린 비핵심 도메인).
  극초기가 미달인데 시드·Pre-A 비중이 낮다면 그것이 구조적 원인이다 — 이런 인과를 설명에 써라.

[출력]
  화면 구조상 headline은 항상 보이고, diagnosis·proposals는 접혀 있다가 펼쳐야 보인다.
  세 항목이 같은 말을 표현만 바꿔 반복하면 안 된다 — 각자 다른 정보를 담아라.
- headline: "무엇이 병목인가 + 왜 그런가"를 한 문장에 담는다. 병목 지표 이름만 대지 말고,
  다른 섹션 데이터(트랙 여력, 라운드·도메인 구성 등)에서 찾은 핵심 원인 1개를 반드시 함께 써라.
  (예: "OO 트랙이 N% 소진되고 △△ 비중도 낮아 OO 투자가 가장 뒤처졌습니다")
- diagnosis: 1~2문장. **headline과 같은 내용을 다른 말로 반복하지 마라.** headline이 다루지 않은
  추가 정보만 짧게 덧붙인다 — 영향 범위(다른 지표로 어떻게 번지는지), 심각도, 또는 headline에 못 담은
  두 번째 원인 등. 주어진 숫자를 최소 하나 인용하라.
- proposals: 부족분을 채우기 위한 구체적이고 적극적인 방향 제안 2~3개. 각 항목은 한 문장.
  · 각 제안에 숫자 근거를 하나씩 넣어라 (예: "월 O억 페이스", "잔여 O억", "미투자 핵심 도메인 O개").
  · 회사명은 여전히 금지. 도메인명·라운드명·트랙명은 써도 된다.
  · 서로 겹치지 않게 쓴다. 트랙 간 배분 조정, 라운드 구성 조정, 도메인 소싱 우선순위처럼 각기 다른 레버를 제안하라.
  · **두 개 이상의 지표를 잇는 제안을 최소 하나 넣어라.** 하나를 고치면 다른 하나도 같이 움직이는 지점을 찾아라
    (예: 미투자 핵심 도메인에서 시드·Pre-A를 소싱하면 극초기와 집중도가 함께 올라간다).
  · 화면에 이미 숫자로 표시된 것을 그대로 되풀이하지 말고, 순서·상충·부작용에 대한 판단을 더하라.
    (예: 무엇을 먼저 할지, 무엇과 상충하는지, 무리하게 밀면 어떤 위험이 생기는지)
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
  const out = [
    `기준일: ${m.asOf} · 2026년 중 약 ${m.elapsedPct}% 경과 (연말까지 약 ${m.daysLeft}일 남음)`,
    '',
    '[2026년 목표 대비 실적 — 이미 확정된 숫자]',
    ...[k.concentration, k.early, k.exit, k.budget].map(line).filter(Boolean),
  ];

  // [15차] 트랙별 예산 집행 (투자계획 기준)
  if (Array.isArray(m.tracks) && m.tracks.length) {
    out.push('', '[트랙별 배정예산 대비 집행 — 투자계획 기준, 잔여의 합 = 총 한도 잔여]');
    m.tracks.forEach((t) => {
      let extra;
      if (t.remain < 0) {
        extra = `배정 초과 ${Math.abs(t.remain)}억원`;
      } else if (t.kind === 'goal') {
        // 채워야 하는 목표 → "월 얼마 필요 / 몇 배 가속"
        extra = `미달 ${t.remain}억원`
          + (t.needPerMonth ? ` · 채우려면 남은 기간 월 ${t.needPerMonth}억원 집행 필요` : '')
          + (t.multipleNeeded ? ` (현재 월평균의 ${t.multipleNeeded}배 가속)` : '');
      } else {
        // 배정 한도 → "남은 여력 / 월 얼마까지 가능"
        extra = `남은 여력 ${t.remain}억원`
          + (t.needPerMonth ? ` · 남은 기간 월 ${t.needPerMonth}억원까지 집행 가능` : '');
      }
      out.push(`- ${t.label}(${t.kind}): 집행 ${t.used}억원 / 배정 ${t.alloc}억원 (${t.rate}%, ${t.count}건, 신호등 ${t.light}) · ${extra}`);
    });
    out.push('  ※ 트랙별 신호등: cap은 소진율이 연중 경과율보다 크게 앞서면 yellow(잔여 여력 부족 주의)다.');
  }

  // [15차] 페이스
  const p = m.pace;
  if (p) {
    out.push('', '[페이스]');
    if (p.monthsDone != null) out.push(`- 실적 반영 구간: 1~${p.monthsDone}월 · 남은 기간 약 ${p.monthsLeft}개월`);
    if (p.budgetPerMonthSoFar != null) out.push(`- 지금까지 월평균 집행: ${p.budgetPerMonthSoFar}억원`);
    if (p.budgetAllowedPerMonth != null) out.push(`- 한도 내에서 남은 기간 월 최대 집행 가능액: ${p.budgetAllowedPerMonth}억원`);
    if (p.budgetLandingIfSamePace != null) out.push(`- 현재 페이스 유지 시 연말 착지: ${p.budgetLandingIfSamePace}억원 (한도 ${(k.budget && k.budget.limit) || '?'}억원)`);
  }

  // [15차] 구성 편중
  const x = m.mix;
  if (x) {
    out.push('', '[구성]');
    if (x.topRound) out.push(`- 최다 라운드: ${x.topRound.name} — 금액 비중 ${x.topRound.ratio}% (${x.topRound.count}건)`);
    if (x.seedPreA) out.push(`- 시드·Pre-A 비중: ${x.seedPreA.ratio}% (${x.seedPreA.count}건 ${x.seedPreA.eok}억원)`);
    if (x.concentrationByAmount != null) out.push(`- 금액 기준 도메인 집중도: ${x.concentrationByAmount}% (신호등 지표는 건수 기준)`);
    if (x.keyDomainCovered != null) out.push(`- 핵심 도메인 투자 커버리지: ${x.keyDomainCovered}/${x.keyDomainTotal}개`);
    if (Array.isArray(x.keyDomainMissing) && x.keyDomainMissing.length) out.push(`- 아직 투자 없는 핵심 도메인: ${x.keyDomainMissing.join(', ')}`);
    if (Array.isArray(x.nonKeyDomains) && x.nonKeyDomains.length) {
      out.push(`- 집중도를 떨어뜨린 비핵심 도메인: ${x.nonKeyDomains.map((d) => `${d.domain}(${d.count}건 ${d.eok}억원)`).join(', ')}`);
    }
    if (x.topDomain) out.push(`- 금액 최다 도메인: ${x.topDomain.domain} — 전체의 ${x.topDomain.ratio}% (${x.topDomain.count}건 ${x.topDomain.eok}억원)`);
  }

  // [15차] 실행 우선순위 근거 — 화면에 이미 표시되는 숫자다
  const a = m.actions;
  if (a) {
    out.push('', '[하반기 실행 우선순위 — 화면에 이미 표시된 숫자]');
    if (a.earlyDealsNeeded) {
      out.push(`- 극초기 잔여 ${a.earlyRemain}억원 ÷ 극초기 평균 딜 ${a.avgDealEarly}억원 = 약 ${a.earlyDealsNeeded}건 추가 필요`
        + (a.earlyDealsPerSession ? ` (남은 투심 ${a.sessionsLeft}회 기준 회당 약 ${a.earlyDealsPerSession}건, 상반기 ${a.earlyCount}건)` : ''));
    }
    if (a.avgDealEarly && a.avgDealAll) {
      out.push(`- 딜 규모 구조: 극초기 평균 ${a.avgDealEarly}억원 vs 전체 평균 ${a.avgDealAll}억원`
        + ' → 극초기는 딜당 금액이 작아 목표 금액을 채우려면 건수가 더 많이 필요하다');
    }
    if (a.earlyKeyRatio != null) {
      out.push(`- 극초기 ${a.earlyCount}건 중 핵심 도메인 ${a.earlyKeyCount}건 (${a.earlyKeyRatio}%)`
        + ` — 전체 도메인 집중도(${(k.concentration && k.concentration.actual) || '?'}%)와 비교하라.`
        + ' 이 값이 더 낮으면 극초기 소싱이 핵심 도메인 밖에서 나오고 있다는 뜻이므로,'
        + ' "미투자 핵심 도메인 × 시드·Pre-A" 소싱이 극초기와 집중도를 동시에 끌어올린다.');
    }
    out.push('  ※ 이 우선순위 숫자는 화면에 이미 보인다. 제안에서 그대로 되풀이하지 말고,'
      + ' 순서·상충·리스크에 대한 판단을 더하라 (예: 무엇을 먼저, 무엇과 상충, 무리하면 어떤 부작용).');
  }

  return out.join('\n');
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
