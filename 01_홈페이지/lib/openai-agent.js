/* OpenAI 도구 호출 루프 (AI 참여 상담 · 예산 에이전트 공통). 외부 라이브러리 없이 fetch만 사용. */
'use strict';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

async function chat(key, body) {
  const send = b => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(b)
  });
  let res = await send(body);
  if (res.status === 400) { // 모델이 reasoning_effort를 지원하지 않으면 빼고 한 번 더
    const err = await res.clone().json().catch(() => ({}));
    if (/reasoning_effort/.test(JSON.stringify(err))) { body = { ...body }; delete body.reasoning_effort; res = await send(body); }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || `OpenAI HTTP ${res.status}`), { status: res.status });
  return data;
}

/* system·tools·runTool을 받아, 모델이 도구를 다 부를 때까지 반복한다. trace에 도구 호출 기록을 남긴다. */
async function runAgent({ key, system, tools, runTool, history, maxRounds = 6, maxTokens = 3000 }) {
  const messages = [{ role: 'system', content: system }, ...history];
  const trace = [], usage = { prompt: 0, completion: 0 };
  for (let round = 0; round < maxRounds; round++) {
    const data = await chat(key, { model: MODEL, messages, tools, tool_choice: 'auto', max_completion_tokens: maxTokens, reasoning_effort: 'low' });
    usage.prompt += (data.usage && data.usage.prompt_tokens) || 0;
    usage.completion += (data.usage && data.usage.completion_tokens) || 0;
    const msg = data.choices[0].message;
    if (!msg.tool_calls || !msg.tool_calls.length) return { reply: msg.content || '', trace, usage, model: data.model };
    messages.push(msg);
    for (const call of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) { args = {}; }
      const result = runTool(call.function.name, args);
      trace.push({ tool: call.function.name, args, result });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: '처리 단계가 너무 길어져 멈췄어요. 잠시 뒤 다시 시도해 주세요.', trace, usage, model: MODEL };
}

/* Vercel 핸들러 공통 처리: 메서드 · 키 · 본문 파싱 · 오류 응답 */
function handler(work) {
  return async function (req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST만 지원합니다.' }); return; }
    const key = process.env.OPENAI_API_KEY || process.env.openai_key;
    if (!key) { res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' }); return; }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    try {
      const out = await work(body || {}, key);
      if (out && out.badRequest) { res.status(400).json({ error: out.badRequest }); return; }
      res.status(200).json(out);
    } catch (e) {
      res.status(502).json({ error: 'AI 서버 응답에 실패했습니다. 잠시 뒤 다시 시도해 주세요.', detail: String(e.message).slice(0, 200) });
    }
  };
}

module.exports = { MODEL, runAgent, handler };
