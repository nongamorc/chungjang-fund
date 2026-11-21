'use strict';
/* 참여 조건 계산 화면 v5 (2026-11-18): 차등 출자율, 미참여·월세 인하·상생기금 3안 비교, LTV·금리 유지, 지역은행 거래 */
const {defaults,calculate,breakEven}=ChungjangroModel;
const el=id=>document.getElementById(id),money=x=>(x<-.000001?'−':'')+Math.abs(x).toLocaleString('ko-KR',{maximumFractionDigits:0})+'만원',signed=x=>(x>.000001?'+':'')+money(x);
let last=null;
function reset(){for(const [k,v]of Object.entries(defaults)){if(!el(k))continue;if(typeof v==='boolean')el(k).checked=v;else el(k).value=v;}}
const pct=n=>n===null?'산출 불가':n===Infinity?'100%로도 불가':(Math.ceil(n*10)/10).toFixed(1)+'%';
function chart(rows){
 const w=620,h=170,values=rows.flatMap(r=>[r.baseline,r.net,r.cutNet]),lo=Math.min(...values)-20,hi=Math.max(...values)+20;
 const points=key=>rows.map((r,i)=>`${35+i/47*570},${20+(hi-r[key])/(hi-lo)*115}`).join(' ');
 el('chart').innerHTML=`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="48개월 월별 순현금: 회색 미참여, 파랑 월세 인하, 주황 상생협약 참여"><text x="35" y="12" font-size="11" fill="#77817b">만원/월 · 미참여(회색), 월세 인하(파랑), 참여(주황)</text><polyline points="${points('baseline')}" fill="none" stroke="#9aa194" stroke-width="2"/><polyline points="${points('cutNet')}" fill="none" stroke="#4f7fa6" stroke-width="2" stroke-dasharray="5 3"/><polyline points="${points('net')}" fill="none" stroke="#bd653b" stroke-width="2"/><text x="35" y="160" font-size="11">1개월</text><text x="550" y="160" font-size="11">48개월</text></svg>`;
}
function render(){
 el('offer-field').hidden=el('same').checked;el('bank-options').hidden=!el('bank').checked;
 const p={};let error='';
 for(const [k,v]of Object.entries(defaults)){
  if(!el(k)){p[k]=v;continue;}
  if(typeof v==='boolean'){p[k]=el(k).checked;continue;}
  if(typeof v==='string'){p[k]=el(k).value;continue;}
  if(k==='offer'&&el('same').checked){p[k]=Number(el('entry').value);continue;}
  if(!el('bank').checked&&['discount','discountMonths'].includes(k)){p[k]=v;continue;}
  if(!el(k).validity.valid||!Number.isFinite(el(k).valueAsNumber))error='입력 범위';
  p[k]=el(k).valueAsNumber;
 }
 if(p.vacant>p.units)error='공실 수';
 el('error').hidden=!error;el('save').disabled=!!error;
 if(error){el('error').textContent=(error==='공실 수'?'빈 점포 수는 전체 점포 수보다 클 수 없습니다.':'입력 범위 안의 숫자를 넣어 주세요.')+' 결과는 마지막 유효 입력 기준입니다.';el('save-status').textContent='입력 오류 · 이전 결과 표시 중 · 저장할 수 없습니다.';last=null;return;}
 const r=calculate(p);last={p,r};el('save-status').textContent='';
 for(const [id,value]of Object.entries({'gain-cut':r.gainVsCut,gain:r.gain,baseline:r.baseline,net:r.net,'cut-net':r.cutNet,'rent-difference':r.rentDifference,'fund-minus':-r.fund,saving:r.saving,fund:r.fund,'bank-net':r.bankNet,'bank-income':r.bankIncome,'bank-cost':-r.saving,'bank-existing':r.bankExisting,'bank-refi':r.bankRefi,'bank-startup':r.bankStartup,'bank-loans':r.bankLoans,'bank-this':r.bankThis,'bank-move':r.bankMove,'bank-deposits':r.bankDeposits,'bank-fund':r.fundFlow}))el(id).textContent=['gain-cut','gain','rent-difference','bank-net','bank-this','bank-move'].includes(id)?signed(value):money(value);
 el('gain-cut').className=r.gainVsCut<0?'negative':'positive';
 el('cut-label').textContent=p.cut;
 el('headline').textContent=r.gainVsCut>.001?`월세를 ${p.cut}% 내리는 것보다 상생협약 참여의 순현금이 더 많습니다.`:r.gainVsCut<-.001?`현재 가정에서는 월세 ${p.cut}% 인하안의 순현금이 더 많습니다.`:'현재 가정에서는 두 안의 순현금이 같습니다.';
 el('without').textContent=`공실 유지(미참여) 대비 ${signed(r.gain)}`+(p.bank?` · 추가 인하 제외 시 ${signed(r.gainWithout)}`:' · 추가 금리 인하 미적용');
 el('handoff').textContent=`출자 ${p.rate}% · 입점 후 ${p.term}개월 약정 · 출자금은 상생기금으로`;
 el('conditions').textContent=`오늘부터 48개월 · 입점률 미참여 ${p.entry}% / 참여·인하안 ${p.same?p.entry:p.offer}% · 공통 유지율 ${p.retention}% (실측 아님). 인하안은 새 가게 월세 ${p.cut}% 인하와 LTV 상승에 따른 가산금리를 반영합니다.`;
 const eok=x=>(x/10000).toFixed(2)+'억';
 el('ltv-cut').textContent=`${r.ltvKeep.toFixed(1)}% → ${r.ltvCut.toFixed(1)}%`;
 el('ltv-cut-note').textContent=`건물값 ${eok(r.valueKeep)} → ${eok(r.valueCut)} · 가산금리 약 +${r.premium.toFixed(2)}%p`;
 el('ltv-keep').textContent=`${r.ltvKeep.toFixed(1)}% 유지`;
 el('premium-cost').textContent='금리 유지 가치 '+money(r.premiumCost);
 el('ltv-note').textContent=`예시 대출 ${(p.loan/10000).toFixed(1)}억원·금리 ${p.interest}%·고정비 월 ${p.cost}만원 기준. 월세 인하안은 LTV가 ${(r.ltvCut-r.ltvKeep).toFixed(1)}%p 올라 4년 이자가 약 ${money(r.premiumCost)} 늘어난다고 가정했습니다(환원율 ${p.cap}%, LTV 1%p당 ${p.ltvStep}%p). 상생기금은 계약 월세가 그대로라 이 부담이 없습니다. 실제 감정평가·가산 기준은 은행마다 다르고, 출자금이 평가상 비용으로 반영되는지도 확인이 필요합니다.`;
 el('fund-year').textContent=money(r.fund/4);el('fund-quarter').textContent=money(r.fund/16);
 el('tenant-example').textContent=`점포 1곳 월세 ${p.rent.toLocaleString('ko-KR')}만원: 세입자 → 건물주 ${p.rent.toLocaleString('ko-KR')}만원 전액, 건물주 → 상생기금 ${(p.rent*p.rate/100).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원/월 (${p.term}개월).`;
 
 el('bank-assumptions').textContent=`검토 가정: 임차인 대출 거래 미참여 ${p.baseShare}% / 참여 ${p.slShare}%, 대출 위치 ${p.loanAt==='move'?'다른 은행 → 대환(주거래 전환)':'이 은행(대환 없음)'}, 마진 ${p.nim}%. 실제 신규 거래 확보나 순이익이 아닙니다.`;
 const be1=breakEven(p,p.bank),be0=breakEven(p,false),offerNow=p.same?p.entry:p.offer;
 el('target').innerHTML=(be1===null?'미참여 대비 손익분기 입점률: 산출 불가 (빈 점포 또는 입점률 0)':`<b>미참여 대비 손익분기:</b> 참여 후 연 입점률 <b>${pct(be1)}</b> 이상${p.bank?` <small>(추가 인하 제외 시 ${pct(be0)})</small>`:''}<br><small>지금 가정: 미참여 ${p.entry}% · 참여 ${offerNow}% · 기금 예산으로 입점이 얼마나 빨라지는지는 시범사업에서 확인할 값입니다.</small>`);
 const describe=n=>n===null?'산출 불가':n===Infinity?'입점률 100%에서도 불가':(Math.ceil(n*10)/10).toFixed(1)+'% 이상';
 el('break-even').textContent=`미참여 대비 손익분기 참여 연 입점률: 현재 조건 ${describe(breakEven(p,true))}, 추가 인하 제외 ${describe(breakEven(p,false))}. 다른 조건은 고정한 목표값이며 실제 달성 가능성을 예측하지 않습니다.`;
 el('yearly').innerHTML=[12,24,36,48].map(n=>{const a=r.rows.slice(0,n),b=a.reduce((s,x)=>s+x.baseline,0),c=a.reduce((s,x)=>s+x.cutNet,0),v=a.reduce((s,x)=>s+x.net,0);return `<tr><td>${n/12}년</td><td>${money(b)}</td><td>${money(c)}</td><td>${money(v)}</td><td>${signed(v-b)}</td></tr>`;}).join('');chart(r.rows);
}
reset();
const query=new URLSearchParams(location.search);
for(const k of ['rate','term'])if(query.has(k)){el(k).value=query.get(k);if(!el(k).validity.valid||!Number.isFinite(el(k).valueAsNumber))el(k).value=defaults[k];}
if(query.get('bank')==='1')el('bank').checked=true;
document.addEventListener('input',e=>{if(e.target.matches('input,select'))render();});
document.addEventListener('change',e=>{if(e.target.matches('select'))render();});
el('form').addEventListener('submit',e=>e.preventDefault());
el('reset').addEventListener('click',()=>{reset();render();});
document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>{reset();const c=b.dataset.case;
 if(c==='high')el('rate').value=15;
 else if(c==='low1y')el('rate').value=5;
 else if(c==='long')el('entry').value=25;else if(c==='bank')el('bank').checked=true;else el('entry').value=0;render();}));
el('save').addEventListener('click',()=>{if(!last)return;const {p,r}=last;const text=['청충어람 참여 조건 비교 · 실제 성과 아님',`전체 ${p.units}곳 / 공실 ${p.vacant}곳 / 월세 ${money(p.rent)}`,`상생기금 출자 ${p.rate}% / 약정 ${p.term}개월 (세입자는 월세 전액 납부)`,`입점률 ${p.entry}% / ${p.same?p.entry:p.offer}% · 유지 ${p.retention}% (가정)`,`4년 순현금 미참여 ${money(r.baseline)} / 월세 ${p.cut}% 인하 ${money(r.cutNet)} / 상생기금 ${money(r.net)}`,`참여 − 인하안 ${signed(r.gainVsCut)} · 참여 − 미참여 ${signed(r.gain)}`,`LTV 인하안 ${r.ltvKeep.toFixed(1)}%→${r.ltvCut.toFixed(1)}% (가산 +${r.premium.toFixed(2)}%p, 4년 ${money(r.premiumCost)}) / 상생기금 ${r.ltvKeep.toFixed(1)}% 유지 → 금리 유지`,`상생기금 출자 4년 ${money(r.fund)} (전액 적립, 예산안·상인회 승인으로 집행)`,`은행 추가 이자마진 ${money(r.bankIncome)} − 추가 인하 비용 ${money(r.saving)} = ${signed(r.bankNet)}`,`신용·운영비 차감 전이며 순이익 아님. 기존 거래 이자마진 ${money(r.bankExisting)}은 별도.`,`전체 입력 가정: ${JSON.stringify(p)}`,'원금상환·세금·재임대·기금 집행 효과 제외. 미승인 제안 조건.'].join('\n');const url=URL.createObjectURL(new Blob(['﻿'+text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='청충어람_참여조건표.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);el('save-status').textContent='조건표 저장을 요청했습니다. 입력값은 외부로 전송하지 않습니다.';});
render();
