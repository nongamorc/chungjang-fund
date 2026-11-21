/* 상생기금 예산 에이전트 · 규칙 기반 (2026-11-18)
   실제 운영에서는 LLM 에이전트가 같은 데이터와 규칙을 읽고 예산안·근거를 작성하고, 상인회 승인 후 지역은행이 집행하는 구조를 가정.
   금액 단위: 만원. 예산 효과(입점·매출 증가)는 예측하지 않음. */
(function(root){
'use strict';
const categories=[
 {key:'entry',name:'새 가게 입점 지원',use:'입점 초기 인테리어·간판·첫 달 운영비 일부 지원',unit:100,unitLabel:'1곳당 100만원 기준'},
 {key:'promo',name:'공동 홍보·온라인 마케팅',use:'상권 SNS·지도 플랫폼 노출, 새 가게 소개 콘텐츠'},
 {key:'consume',name:'소비 촉진',use:'상권 공동 쿠폰·지역화폐 연계 할인'},
 {key:'event',name:'행사·축제',use:'거리 행사, 충장축제 연계 프로그램'},
 {key:'street',name:'거리 환경 개선',use:'빈 점포 외관 정비, 조명·안내판'}
];
const defaults={cadence:'quarter',stores:20,rent:136,rate:10,balance:0,seed:0,match:0,vacancyNow:26.5,vacancyPred:27.6,newStores:2,targetStores:3,sales:-2,footfall:1,festival:false,minReserve:30};
function plan(input){
 const p={...defaults,...input},months=p.cadence==='month'?1:3,label=p.cadence==='month'?'이번 달':'이번 분기';
 const inflow=p.stores*p.rent*p.rate/100*months;
 const own=p.balance+inflow+p.seed;
 const w={entry:30,promo:20,consume:20,event:10,street:20},why=[];
 let reserve=p.minReserve;
 const trend=p.vacancyPred-p.vacancyNow;
 if(trend>0.5){w.entry+=10;why.push({k:'entry',t:`공실 흐름 신호 ${p.vacancyNow}% → ${p.vacancyPred}% (+${trend.toFixed(1)}%p, 참고) · 입점 지원 강화`});}
 else if(trend<-0.5){w.entry-=5;w.consume+=5;why.push({k:['consume','entry'],t:`공실 흐름 신호 하락(−${Math.abs(trend).toFixed(1)}%p, 참고) · 채워진 가게의 매출 지원으로 이동`});}
 if(p.newStores<p.targetStores){w.entry+=5;why.push({k:'entry',t:`신규 입점 ${p.newStores}곳 < 목표 ${p.targetStores}곳 · 입점 지원 추가`});}
 else{w.promo+=5;why.push({k:'promo',t:`신규 입점 목표 달성(${p.newStores}곳) · 새 가게 홍보로 방문객 유치`});}
 if(p.sales<0){w.consume+=10;w.promo+=5;why.push({k:['consume','promo'],t:`카드 매출 전기 대비 −${Math.abs(p.sales)}% · 소비 촉진·홍보 강화`});}
 else if(p.sales>3){w.consume-=5;why.push({k:'consume',t:`카드 매출 +${p.sales}% · 소비 촉진 축소`});}
 if(p.footfall<0){w.promo+=5;w.event+=5;why.push({k:['event','promo'],t:`유동인구 −${Math.abs(p.footfall)}% · 방문 유도 행사·홍보 추가`});}
 if(p.festival){w.event+=15;why.push({k:'event',t:'축제·행사 시즌 · 행사 예산 확대'});}
 if(own<inflow*2&&p.balance<inflow&&reserve<50){reserve=Math.min(50,reserve+10);why.push({k:'reserve',t:`적립금이 ${months===1?'한 달':'한 분기'} 출자액보다 적음 · 적립 비율 ${reserve}%로 상향`});}
 if(p.match>0)why.push({k:['street','event','match'],t:`보조금 매칭 ${Math.round(p.match).toLocaleString('ko-KR')}만원은 일회성 사업(거리 환경 60%·행사 40%)에만 배정 · 운영비에 넣지 않음`});
 const reserveAmt=own*reserve/100,spendOwn=own-reserveAmt;
 const sumW=Object.values(w).reduce((a,b)=>a+Math.max(0,b),0);
 const rows=categories.map(c=>{const share=Math.max(0,w[c.key])/sumW;let amount=spendOwn*share;let matchAmt=0;
  if(c.key==='street')matchAmt=p.match*0.6;if(c.key==='event')matchAmt=p.match*0.4;
  return {...c,share,own:amount,match:matchAmt,amount:amount+matchAmt,reasons:why.filter(x=>[].concat(x.k).includes(c.key)).map(x=>x.t)};});
 const spend=rows.reduce((s,r)=>s+r.amount,0);
 const entryRow=rows.find(r=>r.key==='entry');entryRow.count=Math.floor(entryRow.amount/entryRow.unit);
 const selfShare=own+p.match>0?own/(own+p.match)*100:100;
 const coverage=spendOwn>0?inflow/spendOwn*100:Infinity;
 return {p,label,months,inflow,own,reserve,reserveAmt,spendOwn,spend,rows,why,selfShare,coverage,next:reserveAmt};
}
function project(input,periods){
 const out=[];let balance=(input&&input.balance)||0;
 for(let i=0;i<periods;i++){const r=plan({...input,balance,seed:i===0?(input.seed||0):0,match:i===0?(input.match||0):0});out.push({i,balance,inflow:r.inflow,spend:r.spend,reserve:r.reserveAmt});balance=r.reserveAmt;}
 return out;
}
const api={categories,defaults,plan,project};if(typeof module!=='undefined')module.exports=api;else root.FundAgent=api;
})(typeof globalThis!=='undefined'?globalThis:this);
