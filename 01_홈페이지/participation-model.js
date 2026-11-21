/* 충장로 상생기금 계산 모델 v5 (2026-11-18)
   Values are consultation assumptions, not estimated policy effects. Amounts: KRW 10,000 (만원).
   - 세입자는 계약 월세 100%를 건물주에게 냄. 건물주가 받은 월세에서 건물 등급별 차등 비율을 상생기금에 출자.
   - 출자금 전액은 지역은행이 관리하는 상생기금 계좌로 들어가며, 사용처는 예산안 + 상인회 승인으로 정함(첫 2개월 환급 없음).
   - 금리: 계약 월세를 내리지 않으므로 수익환원 건물값·LTV가 유지되고, 그만큼 금리를 유지. 월세 인하안과 비교.
   - 추가 금리 인하는 선택 조건(기본 제외). */
(function(root){
'use strict';
const grades={
 location:{high:{label:'대로변·1층 위주 (상권 평균 월세 이상)',adj:5},mid:{label:'상권 평균 수준',adj:0},low:{label:'이면도로·상층 위주 (평균 미만)',adj:-3}},
 period:{'6m':{label:'6개월~1년 비어 있음',adj:0},'1y':{label:'1년 이상 비어 있음',adj:-2}},
 base:10,min:5,max:15
};
function gradeRate(location,period){
 const l=grades.location[location]||grades.location.mid,v=grades.period[period]||grades.period['6m'];
 return Math.min(grades.max,Math.max(grades.min,grades.base+l.adj+v.adj));
}
const defaults={units:5,vacant:2,rent:136,rate:10,term:24,entry:10,offer:10,retention:90,loan:75000,interest:4.5,cost:50,
 location:'mid',period:'6m',cut:20,cap:6.5,ltvStep:0.03,
 discount:.3,discountMonths:24,slShare:50,baseShare:0,slAmt:5000,loanAt:'this',nim:2.49,dep:1500,same:true,bank:false};
function path(annual,retention,term){
 const hazard=1-(1-annual)**(1/12),arrivals=[],rows=[];let empty=1;
 for(let month=0;month<48;month++){
  const incoming=empty*hazard;empty-=incoming;arrivals.push(incoming);
  let occupied=0,eligible=0;
  arrivals.forEach((amount,start)=>{const age=month-start,alive=amount*(age>=2?retention:1);occupied+=alive;if(age<term)eligible+=alive;});
  rows.push({occupied,eligible});
 }return rows;
}
/* 수익환원 방식의 단순 건물값: 연 계약 월세 ÷ 환원율. 공실 칸도 시세 월세로 평가한다고 가정. */
function collateral(p){
 const capRate=p.cap/100,full=p.units*p.rent*12;
 const valueKeep=capRate>0?full/capRate:Infinity;
 const valueCut=capRate>0?(full-p.vacant*p.rent*p.cut/100*12)/capRate:Infinity;
 const ltvKeep=valueKeep>0?p.loan/valueKeep*100:Infinity,ltvCut=valueCut>0?p.loan/valueCut*100:Infinity;
 const premium=Math.max(0,ltvCut-ltvKeep)*p.ltvStep;
 return {valueKeep,valueCut,ltvKeep,ltvCut,premium};
}
function calculate(input){
 const p={...defaults,...input},base=path(p.entry/100,p.retention/100,p.term),offer=path((p.same?p.entry:p.offer)/100,p.retention/100,p.term),rows=[];
 const c=collateral(p),interest=p.loan*p.interest/100/12,premiumMonthly=p.loan*c.premium/100/12;
 const discount=p.bank?p.loan*Math.min(p.interest,p.discount)/100/12:0;
 for(let m=0;m<48;m++){
  const b=base[m],o=offer[m],monthly=p.vacant*p.rent,fund=monthly*o.eligible*p.rate/100,saving=m<p.discountMonths?discount:0;
  const baseline=p.rent*(p.units-p.vacant+p.vacant*b.occupied)-interest-p.cost;
  const net=p.rent*(p.units-p.vacant+p.vacant*o.occupied)-fund-interest+saving-p.cost;
  const cutLoss=monthly*o.occupied*p.cut/100;
  const cutNet=p.rent*(p.units-p.vacant+p.vacant*o.occupied)-cutLoss-interest-premiumMonthly-p.cost;
  const startupBalance=p.vacant*(o.occupied*p.slShare/100-b.occupied*p.baseShare/100)*p.slAmt;
  rows.push({baseline,net,cutNet,cutLoss,premium:premiumMonthly,fund,saving,rentDifference:monthly*(o.occupied-b.occupied),startupBalance,startupIncome:startupBalance*p.nim/100/12,refiIncome:(p.loanAt==='move'?p.loan:0)*p.nim/100/12,existingIncome:(p.loanAt==='move'?0:p.loan)*p.nim/100/12,occupied:p.vacant*o.occupied});
 }
 const sum=k=>rows.reduce((s,r)=>s+r[k],0),fund=sum('fund'),saving=sum('saving'),rentDifference=sum('rentDifference'),gainWithout=rentDifference-fund,bankIncome=sum('startupIncome')+sum('refiIncome');
 const net=sum('net'),cutNet=sum('cutNet');
 return {rows,baseline:sum('baseline'),net,cutNet,gainVsCut:net-cutNet,cutLoss:sum('cutLoss'),premiumCost:sum('premium'),...c,
  fund,saving,rentDifference,gainWithout,gain:gainWithout+saving,
  bankIncome,bankNet:bankIncome-saving,bankExisting:sum('existingIncome'),bankRefi:sum('refiIncome'),bankStartup:sum('startupIncome'),
  bankLoans:rows[47].startupBalance+(p.loanAt==='move'?p.loan:0),bankThis:sum('startupIncome')-saving,bankMove:sum('startupIncome')+p.loan*p.nim/100/12*48-saving,
  bankDeposits:rows[47].occupied*p.dep,fundFlow:fund};
}
function breakEven(p,withDiscount){
 if(p.vacant===0||p.entry===0)return null;
 const fn=rate=>{const r=calculate({...p,same:false,offer:rate});return withDiscount?r.gain:r.gainWithout;};
 if(fn(100)<-1e-8)return Infinity;
 if(fn(0)>=0)return 0;
 let lo=0,hi=100;for(let i=0;i<44;i++){const mid=(lo+hi)/2;if(fn(mid)>=0)hi=mid;else lo=mid;}return hi;
}
const api={defaults,grades,gradeRate,path,collateral,calculate,breakEven};if(typeof module!=='undefined')module.exports=api;else root.ChungjangroModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
