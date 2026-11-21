'use strict';
/* 상생기금·예산 화면 v6 (2026-11-18): 사용자는 주기·규모·적립 비율·보조금만 정하고, 상권 데이터는 상황 버튼으로 고른다 */
(function(){
const {defaults,plan,project}=FundAgent;
const el=id=>document.getElementById(id),money=x=>Math.round(x).toLocaleString('ko-KR')+'만원';
const colors={entry:'#c65027',promo:'#e08a4f',consume:'#d9a441',event:'#8aa07a',street:'#4f7fa6'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const situations={
 base:{},
 sales:{sales:-8,footfall:-3},
 festival:{festival:true},
 better:{vacancyPred:25.0,newStores:4,sales:4}
};
const settings=['cadence','stores','minReserve','match'];
let sit='base';
function signals(){return {...defaults,...situations[sit]};}
function renderData(s){
 const sign=x=>(x>0?'+':x<0?'−':'')+Math.abs(x);
 const items=[['현재 공실률',s.vacancyNow+'%','R-ONE'],['공실 흐름 신호(4분기 후)',s.vacancyPred+'%','AI 모델 · 참고용'],['최근 신규 입점',`${s.newStores}곳 / 목표 ${s.targetStores}곳`,'상인회·등록정보'],['카드 매출 변화',sign(s.sales)+'%','은행 가게 계좌(동의)'],['유동인구 변화',sign(s.footfall)+'%','공공 데이터'],['축제·행사',s.festival?'있음':'없음','상인회 일정']];
 el('fd-data').innerHTML='<b>에이전트가 읽는 데이터</b><dl>'+items.map(([k,v,src])=>`<div><dt>${k}<small>${src}</small></dt><dd>${v}</dd></div>`).join('')+'</dl>';
}
function reset(){for(const k of settings)el(k).value=defaults[k];sit='base';}
function read(){
 const p=signals();let ok=true;
 for(const k of settings){
  if(k==='cadence'){p[k]=el(k).value;continue;}
  if(!el(k).validity.valid||!Number.isFinite(el(k).valueAsNumber))ok=false;
  p[k]=el(k).valueAsNumber;
 }return ok?p:null;
}
function render(){
 const ao=el('fd-ai-out');if(ao&&!ao.hidden){ao.hidden=true;el('fd-ai-status').textContent='설정이 바뀌었어요. 메모를 다시 써 주세요.';}
 document.querySelectorAll('[data-sit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sit===sit)));
 renderData(signals());
 const p=read();el('fd-error').hidden=!!p;
 if(!p){el('fd-error').textContent='입력 범위 안의 숫자를 넣어 주세요. 결과는 마지막 유효 입력 기준입니다.';return;}
 const r=plan(p),unit=r.months===1?'월':'분기';
 el('fd-kicker').textContent=`02 · 예산안 · ${r.label}`;
 el('fd-spend').textContent=money(r.spend);
 el('fd-headline').textContent=`${r.label} 상권에 쓰는 예산 · 기금 ${money(r.spendOwn)}${p.match>0?` + 보조금 매칭 ${money(p.match)}`:''} · 적립 ${r.reserve}%`;
 const selfShare=r.own+p.match>0?Math.round(r.selfShare)+'%':'재원 없음';
 const cov=r.coverage===Infinity?'집행 예산 없음':Math.round(r.coverage)+'%';
 el('fd-self').innerHTML=`<b>자생 지표</b> 전체 재원 중 자체 재원 <b>${selfShare}</b> · 보조금 제외 집행액 대비 출자금 <b>${cov}</b><br><small>출자금이 집행액 이상이면 이번 ${unit} 예산을 이번 ${unit} 출자금으로 충당합니다.</small>`;
 el('fd-bar').innerHTML=r.rows.map(x=>`<i style="width:${r.spend?x.amount/r.spend*100:0}%;background:${colors[x.key]}" title="${esc(x.name)}"></i>`).join('');
 el('fd-rows').innerHTML=r.rows.map(x=>`<tr><td><span class="fd-dot" style="background:${colors[x.key]}"></span>${esc(x.name)}<small>${esc(x.use)}${x.key==='entry'?` · ${x.unitLabel} 약 ${x.count}곳`:''}</small></td><td>${money(x.amount)}${x.match>0?`<small>매칭 ${money(x.match)} 포함</small>`:''}</td><td>${r.spend?Math.round(x.amount/r.spend*100):0}%</td><td>${x.reasons.length?x.reasons.map(t=>`<span class="fd-why">${esc(t)}</span>`).join(''):'<span class="fd-base">기본 배분</span>'}</td></tr>`).join('');
 el('fd-reserve').textContent=money(r.reserveAmt);
 el('fd-in').textContent=`재원: 출자 유입 ${money(r.inflow)} (새 가게 ${p.stores}곳 × 월세 ${p.rent}만원 × ${p.rate}% × ${r.months}개월)${p.match>0?` + 보조금 ${money(p.match)}`:''}. 세입자는 월세 전액을 건물주에게 내고, 건물주가 받은 월세에서 출자한 금액입니다.`;
 const memo=[`${r.label} 상권 부흥 예산 ${money(r.spend)}을 제안합니다. 가장 큰 항목은 ${[...r.rows].sort((a,b)=>b.amount-a.amount)[0].name}입니다.`,...r.why.map(x=>x.t),`적립 ${money(r.reserveAmt)}(${r.reserve}%)은 다음 ${unit}로 이월해 보조금 없이도 운영을 이어갑니다.`,'승인 요청: 항목별 금액과 입점 지원 대상 선정 기준. 집행 후 결과는 다음 예산안의 입력으로 씁니다.'];
 el('fd-memo').innerHTML=memo.map(t=>`<li>${esc(t)}</li>`).join('');
 const pr=project({...p,match:0},4);
 el('fd-proj').innerHTML=pr.map(x=>`<tr><td>${x.i+1}${unit==='월'?'개월':'분기'}</td><td>${money(x.balance)}</td><td>${money(x.inflow)}</td><td>${money(x.spend)}</td><td>${money(x.reserve)}</td></tr>`).join('');
 el('fd-proj-head').textContent=`4${unit==='월'?'개월':'분기'} 상권에 ${money(pr.reduce((s,x)=>s+x.spend,0))}`;
}
/* AI 예산 에이전트: 같은 설정으로 서버(api/budget.js)가 예산 규칙을 도구로 불러 승인 요청 메모를 쓴다 */
function md(text){
 const lines=esc(text).split(/\r?\n/);let html='',list=null;const close=()=>{if(list){html+=`</${list}>`;list=null;}};
 for(const raw of lines){const line=raw.trim().replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');let m;
  if(!line){close();continue;}
  if((m=line.match(/^#{1,4}\s+(.*)/))){close();html+=`<h3>${m[1]}</h3>`;}
  else if((m=line.match(/^[-*•]\s+(.*)/))){if(list!=='ul'){close();html+='<ul>';list='ul';}html+=`<li>${m[1]}</li>`;}
  else if((m=line.match(/^\d+[.)]\s+(.*)/))){if(list!=='ol'){close();html+='<ol>';list='ol';}html+=`<li>${m[1]}</li>`;}
  else{close();html+=`<p>${line}</p>`;}}
 close();return html;
}
let aiBusy=false;
async function aiMemo(){
 const p=read();if(!p||aiBusy)return;aiBusy=true;
 const btn=el('fd-ai-btn'),st=el('fd-ai-status'),out=el('fd-ai-out');btn.disabled=true;st.textContent='AI 에이전트가 예산 규칙을 불러 메모를 쓰는 중…';
 try{
  const r=await fetch('/api/budget',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({situation:sit,settings:{cadence:p.cadence,stores:p.stores,minReserve:p.minReserve,match:p.match}})});
  const d=await r.json().catch(()=>({error:'응답을 읽지 못했습니다.'}));if(!r.ok||d.error)throw new Error(d.error||('HTTP '+r.status));
  const calls=(d.trace||[]).map(t=>{const a=t.args||{},x=t.result||{};return `<li>예산 규칙 계산 — ${esc(x['상황']||'')} · ${a.cadence==='month'?'매달':'분기'} · 새 가게 ${esc(a.stores)}곳 · 최소 적립 ${esc(a.minReserve)}% → 집행 ${esc(x['집행_합계_만원'])}만원 · 적립 ${esc((x['적립']||{})['금액_만원'])}만원</li>`;}).join('');
  out.innerHTML=md(d.reply||'')+(calls?`<details class="fd-ai-trace"><summary>AI가 한 일 (도구 호출 ${d.trace.length}회)</summary><ul>${calls}</ul></details>`:'')+`<p class="fd-ai-meta">${esc(d.model||'')} · AI가 쓴 메모입니다. 금액이 위 표(규칙 계산)와 같은지 확인하세요.</p>`;
  out.hidden=false;st.textContent='';
 }catch(e){out.hidden=false;out.innerHTML=`<p class="fd-ai-err">메모를 불러오지 못했어요: ${esc(e.message)}</p>`;st.textContent='';}
 finally{aiBusy=false;btn.disabled=false;}
}
el('fd-ai-btn').addEventListener('click',aiMemo);
reset();
const q=new URLSearchParams(location.search);
if(q.has('stores')){el('stores').value=q.get('stores');if(!el('stores').validity.valid)el('stores').value=defaults.stores;}
document.addEventListener('input',e=>{if(e.target.closest('#fd-form'))render();});
document.addEventListener('change',e=>{if(e.target.closest('#fd-form'))render();});
el('fd-form').addEventListener('submit',e=>e.preventDefault());
el('fd-reset').addEventListener('click',()=>{reset();render();});
document.querySelectorAll('[data-sit]').forEach(b=>b.addEventListener('click',()=>{sit=b.dataset.sit;render();}));
document.querySelectorAll('[data-stores]').forEach(b=>b.addEventListener('click',()=>{el('stores').value=b.dataset.stores;render();}));
render();
})();
/* 에이전트 및 파이프라인 구축 계획 열기/접기 */
(function(){const btn=document.getElementById('pipe-btn'),sec=document.getElementById('pipeline'),close=document.getElementById('pipe-close');
function set(open){sec.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'데이터 파이프라인 구축 계획 접기':'데이터 파이프라인 구축 계획 보기';if(open)sec.scrollIntoView({behavior:'smooth',block:'start'});}
btn.addEventListener('click',()=>set(sec.hidden));close.addEventListener('click',()=>{set(false);btn.scrollIntoView({block:'center'});});
if(location.hash==='#pipeline')set(true);})();
