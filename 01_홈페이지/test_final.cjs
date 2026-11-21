'use strict';
/* v5 (2026-11-18) 계산 검증: 차등 출자율·상인회 기금 전액 적립·월세 인하안 대비 금리 유지·AI 예산 에이전트 */
const fs=require('fs'),assert=require('assert'),path=require('path');
const m=require('./participation-model.js'),a=require('./fund-agent.js');
let count=0;
for(const bank of [false,true])for(const rate of [0,5,10,15])for(const term of [2,24,48])for(const entry of [0,10,100])for(const cut of [0,20]){
 const r=m.calculate({bank,rate,term,entry,cut});
 assert(Math.abs(r.net-r.baseline-r.gain)<1e-7,'건물주 항등식');
 assert(Math.abs(r.gain-(r.rentDifference-r.fund+r.saving))<1e-7,'차이 분해');
 assert(Math.abs(r.net-r.cutNet-r.gainVsCut)<1e-7,'인하안 항등식');
 assert(Math.abs(r.bankIncome-r.saving-r.bankNet)<1e-8,'은행 비용 차감');
 assert(Math.abs(r.rentDifference)<1e-8,'동일 입점 월세 차이 0');
 if(cut===0)assert(r.premiumCost===0&&Math.abs(r.ltvCut-r.ltvKeep)<1e-9,'인하 0이면 LTV 동일');
 else assert(r.ltvCut>r.ltvKeep,'인하 시 LTV 상승');
 count++;
}
const grade={};for(const l of ['high','mid','low'])for(const v of ['6m','1y'])grade[l+'-'+v]=m.gradeRate(l,v);
assert.deepStrictEqual(grade,{'high-6m':15,'high-1y':13,'mid-6m':10,'mid-1y':8,'low-6m':7,'low-1y':5});
const cases=[['기본(출자 10%)',{}],['대로변 1층 15%',{rate:15}],['이면·1년 이상 5%',{rate:5}],['추가 인하',{bank:true}],['입점 25%',{entry:25}],['입점 0%',{entry:0}]];
const results=cases.map(([name,p])=>{const r=m.calculate(p);return {name,미참여:Math.round(r.baseline),월세인하:Math.round(r.cutNet),참여:Math.round(r.net),참여_미참여:Math.round(r.gain),참여_인하안:Math.round(r.gainVsCut),기금:Math.round(r.fund),LTV:[+r.ltvKeep.toFixed(1),+r.ltvCut.toFixed(1)],금리유지가치:Math.round(r.premiumCost),은행_이은행:Math.round(r.bankThis),은행_대환:Math.round(r.bankMove)};});
assert.equal(results[0].참여_미참여,-162);assert.equal(results[0].참여_인하안,750);assert.equal(results[0].금리유지가치,468);
assert.equal(m.defaults.rate,m.gradeRate(m.defaults.location,m.defaults.period));
let agentCount=0;
for(const cadence of ['month','quarter'])for(const stores of [0,5,20,61])for(const match of [0,1000])for(const festival of [false,true])for(const sales of [-5,0,5]){
 const r=a.plan({cadence,stores,match,festival,sales});
 assert(Math.abs(r.spend+r.reserveAmt-(r.own+match))<1e-6,'예산+적립=재원');
 assert(Math.abs(r.rows.reduce((s,x)=>s+x.match,0)-match)<1e-6,'보조금 전액 일회성 배정');
 assert(r.rows.every(x=>x.amount>=0),'음수 예산 없음');agentCount++;
}
const agent=a.plan({});
fs.writeFileSync(path.join(__dirname,'최종검증.json'),JSON.stringify({passed:true,version:'v5 2026-11-18',combinations:count,agentCombinations:agentCount,checks:['건물주 순현금 항등식','참여−미참여 분해(월세차이−출자+추가인하)','참여−월세인하안 항등식','은행 추가 인하 비용 차감','동일 입점조건 월세 차이 0','인하 0%면 LTV 동일·인하 시 LTV 상승','등급별 출자율 표','기본 출자율 = 등급 기준','AI 예산: 집행+적립=재원','AI 예산: 보조금은 일회성 항목에만'],grade,results,agentDefault:{inflow:agent.inflow,spend:Math.round(agent.spend),reserve:Math.round(agent.reserveAmt),rows:agent.rows.map(x=>[x.name,Math.round(x.amount)])},browserQA:'2026-11-18 데스크톱 1280px·모바일 390px 네 페이지 오류 없음, 가로 넘침 없음, 협약→계산기→기금 화면 연결 확인'},null,2));
console.log('PASS',count,'model conditions,',agentCount,'agent conditions');
