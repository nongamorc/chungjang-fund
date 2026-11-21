/* 상생기금 예산 에이전트 (Vercel 서버 함수, 2026-11-21)
   상인회 설정과 상권 상황을 받아, 모델이 예산 규칙(fund-agent.js)을 도구로 불러 확인하고 상인회 승인 요청 메모를 쓴다.
   금액은 규칙으로만 계산한다(최소 적립 · 보조금 사용 범위 강제). 예산 효과(입점·매출 증가)는 예측하지 않는다. */
'use strict';
const F = require('../fund-agent.js');
const { runAgent, handler } = require('../lib/openai-agent.js');

// 화면(fund-ui.js)의 상황 버튼과 같은 예시 입력값. 실제 데이터 연동은 구축 계획.
const SITUATIONS = {
  base: { label: '지금 충장로', v: {} },
  sales: { label: '매출이 떨어진 분기', v: { sales: -8, footfall: -3 } },
  festival: { label: '축제가 있는 분기', v: { festival: true } },
  better: { label: '공실이 줄고 있는 분기', v: { vacancyPred: 25.0, newStores: 4, sales: 4 } }
};

const TOOLS = [{
  type: 'function',
  function: {
    name: 'compute_budget',
    description: '상생기금 예산 규칙으로 이번 기간 예산안을 계산한다. 항목별 금액·배분 근거·적립액·자생 지표와 보조금 없이 4기간 운영한 결과를 돌려준다. 설정을 바꿔 대안을 비교할 때 다시 부른다.',
    parameters: {
      type: 'object',
      properties: {
        situation: { type: 'string', enum: Object.keys(SITUATIONS), description: '상권 상황' },
        cadence: { type: 'string', enum: ['quarter', 'month'], description: '예산 주기' },
        stores: { type: 'number', description: '출자 중인 새 가게 수' },
        minReserve: { type: 'number', description: '최소 적립 비율(%)' },
        match: { type: 'number', description: '보조금 매칭(만원), 없으면 0' }
      },
      required: ['situation', 'cadence', 'stores', 'minReserve', 'match'],
      additionalProperties: false
    }
  }
}];

const SYSTEM = `너는 광주 충장로 '상생기금 예산 에이전트'다. 사용자는 상인회 운영위원회다.
상생기금: 상생협약에 참여한 건물주가 새 가게에게서 받은 월세의 일부를 출자해 지역은행이 관리하는 기금이다. 예산안은 상인회가 승인해야 지역은행이 집행한다.

일하는 순서:
1. 사용자가 준 설정 그대로 compute_budget을 부른다.
2. 상인회 승인 요청 메모를 쓴다. 상인회가 다른 설정(주기·적립 비율·보조금)을 물으면 그 설정으로 compute_budget을 다시 불러 비교한다.

메모 규칙:
- 금액·비율은 도구 결과에 있는 값만 쓴다. 금액을 새로 계산하거나 바꾸지 않는다. 금액 단위는 만원.
- 형식(마크다운): "### 예산안 요약" 2줄 → "### 항목별 배분 근거" 항목마다 한 줄(금액과 배분 근거) → "### 상인회가 결정할 것" 2~3개 → "### 확인할 점" 2개(예산이 입점·매출을 얼마나 늘리는지는 예측하지 않음, 상권 데이터는 예시 값이며 실제 연동 전).
- 결과의 적립 비율이 설정한 최소 적립 비율보다 높으면, 적립금이 한 기간 출자액보다 적어 규칙이 자동으로 올렸다는 점을 요약에 쓴다.
- 공실 흐름 신호는 AI 예측 참고 신호라는 점을 근거에 쓸 때 밝힌다.
- 도구 이름이나 영어 필드 이름은 쓰지 않는다. 쉬운 한국어로 700자 안팎. 승인이나 집행을 스스로 결정하지 않는다.`;

const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const r0 = x => (Number.isFinite(x) ? Math.round(x) : null);

function computeBudget(a) {
  const sit = SITUATIONS[a.situation] ? a.situation : 'base';
  const p = {
    ...F.defaults, ...SITUATIONS[sit].v,
    cadence: a.cadence === 'month' ? 'month' : 'quarter',
    stores: Math.round(num(a.stores, 0, 2000, F.defaults.stores)),
    minReserve: num(a.minReserve, 0, 90, F.defaults.minReserve),
    match: num(a.match, 0, 1e6, 0)
  };
  const r = F.plan(p), unit = r.months === 1 ? '달' : '분기';
  const proj = F.project({ ...p, match: 0 }, 4);
  return {
    상황: SITUATIONS[sit].label,
    입력_데이터_예시값: { 현재_공실률: p.vacancyNow + '%', 공실_흐름_신호_4분기후_AI참고: p.vacancyPred + '%', 신규_입점: `${p.newStores}곳 / 목표 ${p.targetStores}곳`, 카드매출_변화: p.sales + '%', 유동인구_변화: p.footfall + '%', 축제: p.festival ? '있음' : '없음' },
    설정: { 주기: r.label, 출자_중인_새가게: p.stores, 최소_적립_비율: p.minReserve + '%', 보조금_매칭_만원: p.match },
    재원_만원: { 출자_유입: r0(r.inflow), 이월_적립금: r0(p.balance), 자체재원_합계: r0(r.own) },
    예산안: r.rows.map(x => ({ 항목: x.name, 금액_만원: r0(x.amount), 비중: r.spend ? Math.round(x.amount / r.spend * 100) + '%' : '0%', 보조금매칭_포함_만원: r0(x.match), 배분_근거: x.reasons.length ? x.reasons : ['기본 배분'], ...(x.key === 'entry' ? { 입점지원_가능_점포: `약 ${x.count}곳(1곳당 100만원 기준)` } : {}) })),
    집행_합계_만원: r0(r.spend),
    적립: { 비율: r.reserve + '%', 금액_만원: r0(r.reserveAmt), 설명: `다음 ${unit}로 이월` },
    자생_지표: { 전체재원_중_자체재원: r.own + p.match > 0 ? Math.round(r.selfShare) + '%' : '재원 없음', 출자금의_집행액_충당률: r.coverage === Infinity ? '집행 없음' : Math.round(r.coverage) + '%' },
    보조금없이_4기간: proj.map(x => ({ 기간: x.i + 1, 이월_만원: r0(x.balance), 유입_만원: r0(x.inflow), 집행_만원: r0(x.spend), 적립_만원: r0(x.reserve) }))
  };
}

function runTool(name, args) {
  return name === 'compute_budget' ? computeBudget(args || {}) : { error: `알 수 없는 도구: ${name}` };
}

module.exports = handler(async (body, key) => {
  const s = body.settings || {}, sit = SITUATIONS[body.situation] ? body.situation : 'base';
  const set = { situation: sit, cadence: s.cadence === 'month' ? 'month' : 'quarter', stores: num(s.stores, 0, 2000, 20), minReserve: num(s.minReserve, 0, 90, 30), match: num(s.match, 0, 1e6, 0) };
  const ask = `상인회 예산 설정으로 승인 요청 메모를 써 주세요.\n상황: ${SITUATIONS[sit].label}\n예산 주기: ${set.cadence === 'month' ? '매달' : '분기'} · 출자 중인 새 가게 ${set.stores}곳 · 최소 적립 ${set.minReserve}% · 보조금 매칭 ${set.match}만원\n(도구 입력값: ${JSON.stringify(set)})`;
  return runAgent({ key, system: SYSTEM, tools: TOOLS, runTool, history: [{ role: 'user', content: ask }], maxRounds: 4 });
});
module.exports.runTool = runTool; // 로컬 검증용
