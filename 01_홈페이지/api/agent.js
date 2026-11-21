/* 상생협약 참여 상담 에이전트 (Vercel 서버 함수, 2026-11-21)
   건물주의 말을 받아 OpenAI 모델이 도구(참여 손익 계산 · 상권 근거)를 골라 부르고, 결과를 인용해 상담 답변을 쓴다.
   숫자는 도구 결과만 쓰도록 제한한다. API 키는 환경변수(OPENAI_API_KEY)에만 둔다. */
'use strict';
const M = require('../participation-model.js');
const { runAgent, handler } = require('../lib/openai-agent.js');

const EVIDENCE = {
  출처: '한국부동산원 R-ONE 상업용부동산 임대동향(전국 359개 상권, 2013Q1~2026Q2) · 소상공인 상가정보 4개 시점 대조 · 2025.3 언론 보도',
  사실: [
    '충장로(금남로/충장로) 중대형 상가 공실률 26.5%, 광주 상권 중앙값 12.3%의 약 2배 (R-ONE 2026Q2)',
    '2025.06에 비어 있던 충장로 빈 점포 74곳 중 1년 안에 다시 채워진 곳은 13곳(약 18%) (등록정보 기반 추정)',
    '1년 새 공실률이 3%p 이상 오른 1,707건 중 67%는 임대가격지수가 1%도 내려가지 않음 → 월세 인하 압력이 잘 통하지 않음',
    '임대가격지수 1% 상승 → 1년 자본수익률 +0.51%p, 공실 변화는 건물값에 뚜렷한 영향 없음 → 건물주는 월세를 내리기보다 비워 두는 선택을 함',
    '원도심 최근 2년 평균 공실률 21.1% vs 그 밖 12.4%, 원도심 공실이 절반으로 줄기까지 약 6.4년',
    '2025년 3월 월세 인하 협약에는 빈 점포 88곳 중 25곳(약 28%)만 참여'
  ],
  한계: '공실 감소 효과는 아직 검증되지 않음(시범사업에서 측정). AI 공실 예측은 단순 기준보다 오차가 0.66%만 작아 참고 신호로만 씀.'
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculate_participation',
      description: '내 건물 조건으로 4년 순현금(만원)을 계산한다: 그냥 비워 둠 / 월세 20% 인하 / 상생협약 참여. LTV, 손익분기 입점률, 은행 추가 금리 인하 시 결과도 준다. 참여 후 입점이 빨라지는 경우를 보려면 offer_entry를 바꿔 다시 부른다.',
      parameters: {
        type: 'object',
        properties: {
          units: { type: 'number', description: '건물 전체 점포 수' },
          vacant: { type: 'number', description: '현재 빈 점포 수' },
          rent: { type: 'number', description: '점포 1곳 월세(만원)' },
          loan: { type: 'number', description: '건물 대출 잔액(만원). 7.5억 = 75000. 모르면 0' },
          interest: { type: 'number', description: '현재 연 대출금리(%). 모르면 4.5' },
          location: { type: 'string', enum: ['high', 'mid', 'low'], description: 'high=대로변·1층 위주, mid=상권 평균, low=이면도로·상층 위주' },
          period: { type: 'string', enum: ['6m', '1y'], description: '빈 기간: 6m=6개월~1년, 1y=1년 이상' },
          offer_entry: { type: ['number', 'null'], description: '참여 후 연 입점률 가정(%). null이면 미참여와 같은 10%' }
        },
        required: ['units', 'vacant', 'rent', 'loan', 'interest', 'location', 'period', 'offer_entry'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_evidence',
      description: '충장로 공실과 임대료에 대한 데이터 분석 결과(출처 포함)를 돌려준다.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  }
];

const SYSTEM = `너는 광주 충장로 '상생협약 참여 상담 에이전트'다. 사용자는 충장로 1~3가에 빈 점포가 있는 건물주다.
상생협약: 월세는 그대로 두고, 빈 점포에 새 가게가 들어온 뒤부터 건물주가 받은 월세의 일부(건물 등급별 5~15%)를 24개월 동안 지역은행이 관리하는 상생기금에 낸다. 기금은 새 가게(주로 청년 창업자) 입점 지원과 상권 홍보에 쓰인다.

일하는 순서:
1. 점포 수, 빈 점포 수, 월세, 대출 잔액 중 빠진 값이 있으면 계산하지 말고 한 번에 짧게 물어본다. 금리·위치·빈 기간은 모르면 기본값(금리 4.5%, 상권 평균 위치, 6개월~1년 공실)을 쓰고 그렇게 가정했다고 쉬운 말로 밝힌다. mid·6m 같은 코드값은 사용자에게 쓰지 않는다.
2. 값이 모이면 get_market_evidence와 calculate_participation(offer_entry=null)을 부른다.
3. '상생협약 참여 − 그냥 비워 둠'이 음수이면, calculate_participation을 offer_entry=15와 20으로 한 번씩 더 불러 입점이 빨라지면 어떻게 되는지 확인한다.
4. 답변을 쓴다.

답변 규칙:
- 결과 해석은 calculate_participation의 '핵심_해석' 문장을 기준으로 한다. 근거마다 그 문장의 숫자를 그대로 넣는다. 핵심_해석과 반대되는 말(예: '적음'을 '많음'으로)을 쓰지 않는다.
- 숫자는 도구 결과에 있는 값만 인용한다. 직접 더하거나 빼거나 새 숫자를 만들지 않는다. 금액 단위는 만원.
- "### 판단"에는 offer_entry=null로 계산한 결과의 '판단' 값을 그대로 쓰고, 한 줄 이유는 '판단_이유'를 쉬운 말로 옮긴다. 판단을 바꾸지 않는다. 조건부 권장이면 어떤 조건(손익분기 입점률, 은행 추가 인하)에서 이득인지 근거에 쓴다.
- 형식(마크다운): "### 판단" 한 줄(참여 권장 / 조건부 권장 / 비권장) → "### 근거" 3개 → "### 불확실한 점" 2~3개 → "### 다음 할 일" 3개(상인회 1차 대상 확인, 은행 상담 때 물어볼 질문 등).
- 출자율·입점률·금리 유지·추가 인하는 승인되지 않은 제안 가정이라는 점, 공실 감소 효과는 시범사업에서 확인한다는 점을 불확실한 점에 넣는다.
- 도구 이름이나 '핵심_해석' 같은 내부 필드 이름은 답변에 쓰지 않는다. "계산 결과"라고만 부른다.
- 쉬운 한국어로 600자 안팎. 투자·법률 자문처럼 단정하지 않는다.
- 사용자가 이름·전화번호 같은 개인정보를 적어도 다시 쓰지 않는다. 상생협약과 무관한 질문에는 상담 범위를 짧게 안내한다.`;

const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const r0 = x => (Number.isFinite(x) ? Math.round(x) : null);
const r1 = x => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

function calculateParticipation(a) {
  const units = Math.round(num(a.units, 1, 100, 5));
  const p = {
    units, vacant: Math.round(num(a.vacant, 1, units, 1)), rent: num(a.rent, 1, 5000, 136),
    loan: num(a.loan, 0, 1e7, 0), interest: num(a.interest, 0, 20, 4.5),
    location: ['high', 'mid', 'low'].includes(a.location) ? a.location : 'mid',
    period: a.period === '1y' ? '1y' : '6m'
  };
  p.rate = M.gradeRate(p.location, p.period);
  const offer = a.offer_entry == null ? null : num(a.offer_entry, 0, 100, 10);
  const q = { ...p, same: offer == null, offer: offer == null ? M.defaults.entry : offer, bank: false };
  const r = M.calculate(q), rb = M.calculate({ ...q, bank: true });
  const be = M.breakEven({ ...M.defaults, ...p }, false), beBank = M.breakEven({ ...M.defaults, ...p, bank: true }, true);
  const fmtBe = v => (v == null ? '해당 없음' : v === Infinity ? '입점률을 높여도 손익분기 없음' : `${r1(v)}%`);
  // 작은 모델이 부호를 잘못 읽지 않도록 비교 문장을 코드에서 만든다
  const cmp = (x, than) => `${than}보다 4년 ${Math.abs(r0(x)).toLocaleString('ko-KR')}만원 ${x >= 0 ? '많음' : '적음'}`;
  const entryNow = offer == null ? M.defaults.entry : offer;
  const 핵심_해석 = [
    `상생협약 참여는 ${cmp(r.gainVsCut, '월세 20% 인하')}`,
    `참여 후 연 입점률 ${entryNow}% 가정에서 상생협약 참여는 ${cmp(r.gainWithout, '그냥 비워 둘 때')}`,
    `은행이 금리를 0.3%p 추가로 내려 주면 ${cmp(rb.gain, '그냥 비워 둘 때')}`,
    `참여 후 연 입점률이 ${fmtBe(be)} 이상이면 은행 추가 인하 없이도 비워 둘 때보다 이득 (은행 추가 인하 포함 시 ${fmtBe(beBank)})`,
    `월세를 20% 내리면 LTV가 ${r1(r.ltvKeep)}%에서 ${r1(r.ltvCut)}%로 올라 4년 추가 이자 약 ${r0(r.premiumCost).toLocaleString('ko-KR')}만원(가정), 상생협약은 LTV ${r1(r.ltvKeep)}% 유지`
  ];
  // 판단도 규칙으로 고정해 같은 조건이면 같은 결론이 나오게 한다
  const 판단 = r.gainWithout >= 0 ? '참여 권장' : r.gainVsCut >= 0 ? '조건부 권장' : '비권장';
  const 판단_이유 = 판단 === '참여 권장' ? '입점 속도가 같아도 비워 둘 때보다 많음'
    : 판단 === '조건부 권장' ? '월세 인하보다는 많지만 비워 둘 때보다는 적음 → 입점이 손익분기 이상 빨라지거나 은행 추가 인하가 있을 때 이득'
    : '월세 인하보다도, 비워 둘 때보다도 적음';
  return {
    판단, 판단_이유,
    핵심_해석,
    입력: { ...p, 출자율_퍼센트: p.rate },
    가정: { 약정_개월: 24, 미참여_연입점률: M.defaults.entry, 참여_연입점률: offer == null ? M.defaults.entry : offer, 입점후_유지율: M.defaults.retention, 월세인하안_인하율: M.defaults.cut, 월_고정비_만원: M.defaults.cost, 비고: '모든 조건은 승인되지 않은 제안 가정' },
    네년_순현금_만원: { 그냥_비워둠: r0(r.baseline), 월세_20퍼센트_인하: r0(r.cutNet), 상생협약_참여: r0(r.net) },
    차이_만원: { 참여_minus_월세인하: r0(r.gainVsCut), 참여_minus_비워둠: r0(r.gainWithout), 은행_0_3퍼센트포인트_추가인하시_참여_minus_비워둠: r0(rb.gain) },
    LTV_퍼센트: { 월세유지_참여: r1(r.ltvKeep), 월세20퍼센트_인하: r1(r.ltvCut) },
    월세인하시_4년_추가이자_만원: r0(r.premiumCost),
    네년_상생기금_출자_만원: r0(r.fund),
    손익분기_참여후_연입점률: { 우대없음: fmtBe(be), 은행추가인하포함: fmtBe(beBank) }
  };
}

function runTool(name, args) {
  if (name === 'calculate_participation') return calculateParticipation(args || {});
  if (name === 'get_market_evidence') return EVIDENCE;
  return { error: `알 수 없는 도구: ${name}` };
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const h = raw.slice(-10).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  return h.length && h[h.length - 1].role === 'user' ? h : null;
}

module.exports = handler(async (body, key) => {
  const history = cleanHistory(body.messages);
  if (!history) return { badRequest: '질문을 입력해 주세요.' };
  return runAgent({ key, system: SYSTEM, tools: TOOLS, runTool, history });
});
module.exports.runTool = runTool; // 로컬 검증용
