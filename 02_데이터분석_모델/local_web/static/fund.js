
/* ===== 펀드 모델 v2 (fund_model.py와 동일한 식) ===== */
const BASE = {n_buildings:612, avg_area_m2:450, rent_m2:21200, vacancy0:0.265, unit_area:80,
  annual_donation_eok:0,n_rate:0.05, participation:0.5, years:5, target_vacancy:0.15, sliding:true,
  a_pb:0.35, a_st:0.30, a_sv:0.10, a_fe:0.20, a_ops:0.05, settle_rate:0.30, settle_months:6,
  sales0_eok:560, sales_drift:0, lam_pb:2.0, lam_fe:1.0, occ_feedback:0.5, exit0:0.12,
  eps_fill:2.5, eps_exit:1.5, eps_rent:1.5, kappa_sv:1.0, horizon:10};
const areaOf=p=>p.n_buildings*p.avg_area_m2;
function slide(p,v){ if(!p.sliding) return 1; return Math.min(1,Math.max(0.6,1-2*(p.vacancy0-v))); }

const FUND_RATE_STEPS=[1,2,3,5,7,10,15,20,30,40,50];
const FUND_HEAT_RATES=[1,5,10,20,30,40,50];
const FUND_PART_STEPS=[10,30,50,70,100];
let fundCache=new Map();
const fundKey=p=>JSON.stringify(Object.keys(p).sort().map(k=>[k,p[k]]));
async function prepareFund(p){
 const list=[p,{...BASE}];
 FUND_RATE_STEPS.forEach(n=>list.push({...p,n_rate:n/100}));
 FUND_HEAT_RATES.forEach(n=>FUND_PART_STEPS.forEach(pp=>list.push({...p,n_rate:n/100,participation:pp/100,target_vacancy:0})));
 const rows=await api('/api/fund',{params:list});
 return new Map(list.map((q,i)=>[fundKey(q),rows[i]]));
}
function simulate(p,on){return fundCache.get(fundKey(p))[on?'fund':'base'];}
function stakeholder(p){return fundCache.get(fundKey(p)).stakeholder;}
function landlord(p){return fundCache.get(fundKey(p)).landlord;}
