async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'요청 실패');return j;}
let AN,QA,MC,ML;
async function boot(){
({AN,QA,MC,ML}=await api('/api/data'));
fundCache=await prepareFund({...BASE});
initialize();}
function initialize(){




/* ===== 데이터 (Python 결과 · 한국부동산원 R-ONE 원자료) ===== */

const IMPNAME={eps_rent:"실질임대료→입점",eps_fill:"매출→입점",occ_feedback:"점포→매출",lam_pb:"페이백 매출승수",eps_exit:"매출→폐업",sales_drift:"매출 추세",lam_fe:"축제 매출승수",exit0:"기준 폐업률",kappa_sv:"생존지원 효과"};

const $=id=>document.getElementById(id);
const fmt=(x,d=1)=>(+x).toLocaleString("ko-KR",{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(x,d=1)=>fmt(x*100,d)+"%";
const pv=p=>p<0.001?"p<0.001":"p="+(p<0.1?p.toFixed(3):p.toFixed(2));
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const NS="http://www.w3.org/2000/svg";
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}


/* ---------- 차트 ---------- */
function tipFor(box){let t=box.querySelector(".tip");if(!t){t=document.createElement("div");t.className="tip";t.hidden=true;box.appendChild(t);}return t;}
function placeTip(box,tip,ev){const bx=box.getBoundingClientRect();let left=ev.clientX-bx.left+12;if(left+tip.offsetWidth>bx.width)left=ev.clientX-bx.left-tip.offsetWidth-12;tip.style.left=Math.max(0,left)+"px";tip.style.top="8px";}
function W_(box){return Math.max(300,Math.min(760,box.clientWidth||640));}
function lineChart(box,o){
  const {x,series,bands=[],yMin,yMax,yFmt,xFmt,h=240,marks=[],vmarks=[],dots=[],tipRows}=o;
  box.innerHTML="";const W=W_(box),H=h,m={l:48,r:14,t:14,b:28};
  const svg=el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img"},box);
  const xs=i=>m.l+(W-m.l-m.r)*i/(x.length-1), ys=v=>m.t+(H-m.t-m.b)*(1-(v-yMin)/(yMax-yMin));
  for(let i=0;i<=5;i++){const v=yMin+(yMax-yMin)*i/5;
    el("line",{x1:m.l,x2:W-m.r,y1:ys(v),y2:ys(v),stroke:css("--line"),"stroke-width":1},svg);
    const t=el("text",{x:m.l-6,y:ys(v)+4,"text-anchor":"end"},svg);t.textContent=yFmt(v);}
  const step=Math.ceil(x.length/(W<420?6:11));
  x.forEach((xv,i)=>{if(i%step)return;const t=el("text",{x:xs(i),y:H-8,"text-anchor":"middle"},svg);t.textContent=xFmt(xv);});
  marks.forEach(mk=>{el("line",{x1:m.l,x2:W-m.r,y1:ys(mk.v),y2:ys(mk.v),stroke:css("--ink2"),"stroke-dasharray":"4 4","stroke-width":1},svg);
    const t=el("text",{x:W-m.r,y:ys(mk.v)-6,"text-anchor":"end"},svg);t.textContent=mk.label;});
  vmarks.forEach(mk=>{const X=xs(mk.i);el("line",{x1:X,x2:X,y1:m.t,y2:H-m.b,stroke:css("--muted"),"stroke-dasharray":"3 4"},svg);
    const t=el("text",{x:X+4,y:m.t+10},svg);t.textContent=mk.label;});
  bands.forEach(b=>{let d="";b.lo.forEach((v,i)=>d+=(i?"L":"M")+xs(i)+","+ys(v));for(let i=b.hi.length-1;i>=0;i--)d+="L"+xs(i)+","+ys(b.hi[i]);
    el("path",{d:d+"Z",fill:b.color,"fill-opacity":0.16,stroke:"none"},svg);});
  series.forEach(s=>{let d="";s.values.forEach((v,i)=>d+=(i?"L":"M")+xs(i)+","+ys(v));
    el("path",{d,fill:"none",stroke:s.color,"stroke-width":2,"stroke-opacity":s.op??1,"stroke-dasharray":s.dash||"","stroke-linejoin":"round"},svg);
    const li=s.values.length-1;el("circle",{cx:xs(li),cy:ys(s.values[li]),r:3.5,fill:s.color,"fill-opacity":s.op??1,stroke:css("--surface"),"stroke-width":2},svg);});
  dots.forEach(d=>el("circle",{cx:xs(d.i),cy:ys(d.v),r:5,fill:css(d.color),stroke:css("--surface"),"stroke-width":2},svg));
  const cross=el("line",{y1:m.t,y2:H-m.b,stroke:css("--muted"),"stroke-width":1,visibility:"hidden"},svg);
  const hit=el("rect",{x:m.l,y:m.t,width:W-m.l-m.r,height:H-m.t-m.b,fill:"transparent"},svg);
  const tip=tipFor(box);
  function move(ev){const r=svg.getBoundingClientRect();const px=(ev.clientX-r.left)*W/r.width;
    let i=Math.round((px-m.l)/(W-m.l-m.r)*(x.length-1));i=Math.max(0,Math.min(x.length-1,i));
    cross.setAttribute("x1",xs(i));cross.setAttribute("x2",xs(i));cross.setAttribute("visibility","visible");
    tip.innerHTML=tipRows(i);tip.hidden=false;placeTip(box,tip,ev);}
  hit.addEventListener("pointermove",move);hit.addEventListener("pointerdown",move);
  hit.addEventListener("pointerleave",()=>{tip.hidden=true;cross.setAttribute("visibility","hidden");});
}
function barChart(box,{labels,groups,yMax,yFmt,valFmt,h=220,tipRow,stacked=false}){
  box.innerHTML="";const W=W_(box),H=h,m={l:48,r:10,t:18,b:28};
  const svg=el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img"},box);
  const ys=v=>m.t+(H-m.t-m.b)*(1-v/yMax);
  for(let i=0;i<=4;i++){const v=yMax*i/4;el("line",{x1:m.l,x2:W-m.r,y1:ys(v),y2:ys(v),stroke:css("--line")},svg);
    const t=el("text",{x:m.l-6,y:ys(v)+4,"text-anchor":"end"},svg);t.textContent=yFmt(v);}
  const n=labels.length,slot=(W-m.l-m.r)/n,gw=Math.min(slot*0.7,90);
  const nb=stacked?1:groups.length,bw=(gw-(nb-1)*2)/nb;const tip=tipFor(box);
  labels.forEach((lab,i)=>{const x0=m.l+slot*i+(slot-gw)/2;
    const t=el("text",{x:m.l+slot*i+slot/2,y:H-8,"text-anchor":"middle"},svg);t.textContent=lab;
    let acc=0;const paths=[];
    groups.forEach((g,j)=>{const v=g.values[i];if(v==null||v<=0)return;
      const x=stacked?x0:x0+j*(bw+2);const y0=stacked?acc:0;const top=y0+v;acc=top;
      const yT=ys(top),yB=ys(y0)-(stacked&&j>0?0:0),hh=yB-yT;
      const last=!stacked||groups.slice(j+1).every(gg=>!(gg.values[i]>0));
      const r=last?Math.min(4,bw/2,hh):0;
      const gap=stacked&&y0>0?1:0;
      const d=`M${x},${yB-gap}V${yT+r}Q${x},${yT} ${x+r},${yT}H${x+bw-r}Q${x+bw},${yT} ${x+bw},${yT+r}V${yB-gap}Z`;
      paths.push(el("path",{d,fill:g.color},svg));
      if(!stacked&&valFmt&&hh>0){const tx=el("text",{x:x+bw/2,y:yT-5,"text-anchor":"middle"},svg);tx.textContent=valFmt(v);tx.style.fill=css("--ink2");}
      if(!stacked){const hit=el("rect",{x:x-2,y:m.t,width:bw+4,height:H-m.t-m.b,fill:"transparent"},svg);
        const p=paths[paths.length-1];const show=ev=>{tip.innerHTML=tipRow(i,j);tip.hidden=false;placeTip(box,tip,ev);p.setAttribute("fill-opacity",.8);};
        hit.addEventListener("pointermove",show);hit.addEventListener("pointerdown",show);hit.addEventListener("pointerleave",()=>{tip.hidden=true;p.setAttribute("fill-opacity",1);});}});
    if(stacked){if(valFmt&&acc>0){const tx=el("text",{x:x0+bw/2,y:ys(acc)-5,"text-anchor":"middle"},svg);tx.textContent=valFmt(acc);tx.style.fill=css("--ink2");}
      const hit=el("rect",{x:x0-2,y:m.t,width:bw+4,height:H-m.t-m.b,fill:"transparent"},svg);
      const show=ev=>{tip.innerHTML=tipRow(i);tip.hidden=false;placeTip(box,tip,ev);paths.forEach(p=>p.setAttribute("fill-opacity",.8));};
      hit.addEventListener("pointermove",show);hit.addEventListener("pointerdown",show);hit.addEventListener("pointerleave",()=>{tip.hidden=true;paths.forEach(p=>p.setAttribute("fill-opacity",1));});}
  });
  el("line",{x1:m.l,x2:W-m.r,y1:ys(0),y2:ys(0),stroke:css("--muted")},svg);
}

function scatterChart(box,{x,y,lo,hi,h=260,label="",hl=null}){
  box.innerHTML="";const W=W_(box),H=h,m={l:44,r:14,t:12,b:34};
  const svg=el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img"},box);
  const sx=v=>m.l+(W-m.l-m.r)*(v-lo)/(hi-lo),sy=v=>m.t+(H-m.t-m.b)*(1-(v-lo)/(hi-lo));
  for(let i=0;i<=5;i++){const v=lo+(hi-lo)*i/5;el("line",{x1:m.l,x2:W-m.r,y1:sy(v),y2:sy(v),stroke:css("--line")},svg);
    const t=el("text",{x:m.l-6,y:sy(v)+4,"text-anchor":"end"},svg);t.textContent=Math.round(v);const t2=el("text",{x:sx(v),y:H-16,"text-anchor":"middle"},svg);t2.textContent=Math.round(v);}
  const t3=el("text",{x:(W+m.l)/2,y:H-2,"text-anchor":"middle"},svg);t3.textContent="예측 →";
  const t4=el("text",{x:m.l+4,y:m.t+10},svg);t4.textContent="↑ 실제";
  el("line",{x1:sx(lo),y1:sy(lo),x2:sx(hi),y2:sy(hi),stroke:css("--muted"),"stroke-dasharray":"4 4"},svg);
  const c=css("--accent");for(let i=0;i<x.length;i++){if(x[i]<lo||x[i]>hi||y[i]<lo||y[i]>hi)continue;el("circle",{cx:sx(x[i]),cy:sy(y[i]),r:2.6,fill:c,"fill-opacity":.35},svg);}
  if(hl)hl.forEach(p=>{el("circle",{cx:sx(p.x),cy:sy(p.y),r:5,fill:css("--cut"),stroke:css("--surface"),"stroke-width":2},svg);});
}
function hbars(box,rows,{fmtv=v=>v.toFixed(2),max}={}){
  const mx=max||Math.max(...rows.map(r=>Math.abs(r.v)))||1;
  box.innerHTML=rows.map(r=>`<div class="bar-row"><span>${r.k}</span><div class="track"><span class="fill" style="left:0;width:${Math.max(0,r.v)/mx*100}%;background:var(${r.c||"--accent"})"></span></div><span class="num" style="text-align:right">${fmtv(r.v)}</span></div>`).join("");
}

/* ---------- 1. 메인 ---------- */
function drawMain(){
  const E=AN.eda,S=E.series,T=AN.tests;
  $("mainFacts").innerHTML=[
    [fmt(E.tgt_vac)+"%","중대형상가 공실률",`${E.asof} · 상권 중앙값: 광주 ${fmt(E.gj_median)}%, 전국 ${fmt(E.nat_median)}%`],
    ["상위 "+Math.round((1-E.tgt_pct)*100)+"%","전국 공실 순위",`${E.n_last}개 상권 중 ${E.tgt_rank}번째로 높음`],
    ["+"+Math.round(E.tgt_prem*100)+"%","1층 임대료, 광주 평균 대비",`㎡당 ${fmt(E.tgt_rent)}천원 vs ${fmt(E.gj_rent)}천원`],
    [fmt((E.change.ri_to/E.change.ri_from-1)*100)+"%","임대가격지수 2013→2026",`공실은 ${fmt(E.change.vac_from)}% → ${fmt(E.change.vac_to)}%`],
    [fmt(E.tgt_capret,2)+"%","분기 자본수익률",`자산가치가 분기마다 하락 (${E.asof})`],
    ["−32.2%","월 4대소비 매출","2019→2024, 동구 빅데이터 (2026.1 보도)"]].map(([b,s,m])=>`<div class="fact"><b>${b}</b><span>${s}</span><small>${m}</small></div>`).join("");
  const q=S.quarter;
  lineChart($("cTrend"),{x:q,series:[{values:S.nat_med,color:css("--base")},{values:S.gj_med,color:css("--u-fe")},{values:S.vac,color:css("--accent")}],yMin:0,yMax:35,yFmt:v=>Math.round(v),xFmt:v=>v.endsWith("Q1")?v.slice(2,4)+"년":"",h:230,
    tipRows:i=>`<b>${q[i]}</b><br>금남로/충장로 <span class="num">${fmt(S.vac[i])}%</span><br>광주 상권 중앙값 <span class="num">${S.gj_med[i]==null?"–":fmt(S.gj_med[i])+"%"}</span><br>전국 상권 중앙값 <span class="num">${fmt(S.nat_med[i])}%</span>`});
  const ri=S.rentidx.map(v=>v??null);const ok=ri.filter(v=>v!=null);
  lineChart($("cRidx"),{x:q,series:[{values:ri.map((v,i)=>v??ri.find(z=>z!=null)),color:css("--cut")}],yMin:90,yMax:120,yFmt:v=>Math.round(v),xFmt:v=>v.endsWith("Q1")?v.slice(2,4)+"년":"",h:230,
    tipRows:i=>`<b>${q[i]}</b><br>임대가격지수 <span class="num">${ri[i]==null?"–":fmt(ri[i])}</span><br>공실률 <span class="num">${fmt(S.vac[i])}%</span>`});
  $("ridxNote").textContent=`임대가격지수 ${fmt(ok[0])} → ${fmt(ok[ok.length-1])} (${fmt((ok[ok.length-1]/ok[0]-1)*100)}%). 같은 기간 공실률은 ${fmt(E.change.vac_from)}%에서 ${fmt(E.change.vac_to)}%로 ${fmt(E.change.vac_to-E.change.vac_from)}%p 올랐습니다.`;
  $("mainProof").innerHTML=`<b>실데이터 검증 (전국 ${T.H3.n_b.toLocaleString()}개 관측)</b><span class="ink2">임대가격지수가 1% 내리면 1년 자본수익률(자산가치 변화)이 ${fmt(T.H3.b_rent4,2)}%p 내려갑니다(${pv(T.H3.p_rent4)}). 반면 공실률이 1%p 늘어도 자본수익률은 거의 변하지 않습니다(${fmt(T.H3.b_vac4,3)}%p, ${pv(T.H3.p_vac4)}). 임대료 인하는 평가가치 하락과 함께 나타나지만, 공실 변화와 당기 자본수익률의 관련성은 이 모형에서 뚜렷하지 않았습니다. 공실 상승기에 임대료가 거의 안 내려가는 현상(H1)과 들어맞습니다. 단, 부동산원 자본수익률은 임대료로 환산한 감정가치에서 계산되므로 둘이 함께 움직이는 데에는 계산상 연동도 포함됩니다. 담보비율에 미치는 영향은 은행·감정평가사 확인이 필요합니다.</span>`;
}
let appraisalVersion=0;
async function drawHyp(){
  const version=++appraisalVersion,rent=+$("rent").value,cut=+$("cut").value/100;
  const {v0,loan,v,ltv,rep,xs,ys}=await api('/api/appraisal',{rent,cut});
  if(version!==appraisalVersion)return;
  $("cutO").value=Math.round(cut*100)+"%";
  $("hVal").textContent=fmt(v/1e8)+"억";$("hVal0").textContent="인하 전 "+fmt(v0/1e8)+"억 → 인하 후 "+fmt(v/1e8)+"억";
  $("hLtv").textContent=pct(ltv,1);$("hLtv").style.color=ltv>0.7?css("--bad"):"";
  $("hRep").textContent=fmt(rep/1e8,2)+"억";$("hRepS").textContent=rep>0?"예시 조건상 한도 초과분":"예시 조건상 한도 이내";
  $("hRent").textContent=rent.toLocaleString("ko-KR")+"원/㎡·월";$("hLoan").textContent=fmt(loan/1e8)+"억원";
  const monthly=500*rent/1e4;
  $("rentBeforeAfter").innerHTML=`<div><span>예시 건물 월세 · 인하 전</span><b>${fmt(monthly,0)}만원</b><i style="width:100%"></i></div><div><span>${Math.round(cut*100)}% 인하 후</span><b>${fmt(monthly*(1-cut),0)}만원</b><i style="width:${(1-cut)*100}%"></i></div>`;
  $("ltvExplanation").textContent=`월세 ${Math.round(cut*100)}% 인하 → 평가액 ${fmt(v0/1e8)}억에서 ${fmt(v/1e8)}억으로 감소. 대출 ${fmt(loan/1e8)}억은 그대로여서 대출 비율이 60%에서 ${pct(ltv,1)}로 ${ltv>.7?"올라 한도 70%를 넘습니다":"변합니다"}. 비용·환원율을 고정한 가정 예시입니다.`;
  if($("v-evidence").hidden)return;
  lineChart($("cLtv"),{x:xs,series:[{values:ys,color:css("--accent")}],yMin:.5,yMax:1.3,yFmt:v=>Math.round(v*100)+"%",xFmt:v=>v+"%",h:270,
    marks:[{v:.7,label:"대출 약정 한도 70%"}],vmarks:[{i:cut*100/5,label:"선택 "+Math.round(cut*100)+"% 인하"}],dots:[{i:cut*100/5,v:ltv,color:"--cut"}],
    tipRows:i=>`월세 인하율 ${xs[i]}% → 평가액 대비 대출 ${pct(ys[i],1)}`});
  const svg=$("cLtv").querySelector("svg");svg.setAttribute("aria-label","가로축은 월세 인하율, 세로축은 평가액 대비 대출 비율. 선택한 인하율은 주황 점으로 표시.");
}
function drawMainKpis(){
  const p={...BASE};const b=simulate(p,false),f=simulate(p,true);const s=stakeholder(p,b,f);
  $("mainHeadline").textContent=`공실 입점 후 출자로, 5년 ${fmt(s.fund_cum)}억 (가정)`;
  $("mainKpis").innerHTML=[
    ["1년차 기금",fmt(s.fund_y1)+"억",`초기 공실 참여 ${(s.participating_area/1e4).toFixed(2)}만㎡ · 입점 전 출자 0원`],
    ["5년 누계",fmt(s.fund_cum)+"억","초기 공실 면적의 50% 참여 가정 · 민간 재원"],
    ["5년차 공실률",pct(s.vac5_fund),"기금 미시행 "+pct(s.vac5_base)+" (별도 동태 가정)"],
    ["정착금 수혜",fmt(s.settled_total,0)+"건","1건 "+fmt(s.settle_per_tenant_man,0)+"만원 · 입점 유지 시 단순 회수 "+fmt(s.settle_payback_years)+"년"]].map(([l,v,t])=>`<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${t}</span></div>`).join("");
}

/* ---------- 2. 분석 ---------- */
function drawAnalysis(){
  const T=AN.tests,D=AN.data;
  drawLocalComparison();drawRegionalComparison();drawDetailedEvidence();
  const rows=[
    ["H1 · 공실이 늘면 임대료도 내려갈까?","1년 공실 변화 ↔ 1년 임대가격지수 변화",`공실 급등 관측의 ${fmt(T.H1.share_no_cut*100)}%에서 임대가격지수가 1% 이상 하락하지 않았습니다.`],
    ["H2 · 임대료가 비싼 상권은 공실이 더 늘까?","지역 평균 대비 임대료 ↔ 다음 1년 공실 변화","높은 임대료와 공실 증가의 관련성은 일부 관찰됐지만, 같은 상권의 변화만 비교하면 뚜렷하지 않아 부분 지지입니다."],
    ["H3 · 임대료 변화는 자산가치와 연결될까?","임대가격지수·공실 변화 ↔ 1년 자본수익률",`임대지수 1% 변화와 자본수익률 ${fmt(T.H3.b_rent4,2)}%p 변화가 함께 관찰됐습니다. 평가 계산의 연동도 포함됩니다.`],
    ["H4 · 원도심은 다른 상권보다 공실이 높을까?","원도심 분류 ↔ 최근 2년 평균 공실률",`원도심 ${fmt(T.H4.mean_old)}%, 기타 ${fmt(T.H4.mean_other)}%로 비교됐습니다.`],
    ["H5 · 높은 공실은 오래 이어질까?","이번 분기 공실률 ↔ 다음 분기 공실률",`분기별 공실의 지속성이 높게 나타났습니다. 원도심 지속성 계수는 ${fmt(T.H5.rho_old,3)}입니다.`]
  ];
  $("hypothesisTable").innerHTML='<thead><tr><th>확인한 질문</th><th>비교한 변수</th><th>분석에서 관찰한 결과</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>`<td class="wrap">${v}</td>`).join('')+'</tr>').join('')+'</tbody>';
  $("analysisMeta").textContent=`분석 범위: ${D.areas}개 상권 · ${D.from}~${D.to} · ${D.rows.toLocaleString()}행. 원도심 분류는 공식 지정이 아닌 프로젝트의 정의입니다.`;
}


function drawRegionalComparison(){
 const E=AN.eda,S=E.series,R=E.vacancy_comparison.quarters[E.asof];
 $("regionalVacancyKpis").innerHTML=[["광주 상권 중앙값",E.gj_median],["전국 상권 중앙값",E.nat_median],["금남로/충장로",E.tgt_vac]].map(([label,value])=>`<div><span>${label}</span><b>${fmt(value)}<small>%</small></b></div>`).join('');
 lineChart($("cRegionalVacancy"),{x:S.quarter,series:[{values:S.vac,color:css("--cut")},{values:S.gj_med,color:css("--accent")},{values:S.nat_med,color:css("--base")}],yMin:0,yMax:Math.ceil(Math.max(...S.vac,...S.gj_med,...S.nat_med)/5)*5,yFmt:v=>v+"%",xFmt:q=>q.endsWith('Q1')?q.slice(2,4)+'년':'',h:280,tipRows:i=>`${S.quarter[i]}<br>충장로 ${fmt(S.vac[i])}%<br>광주 중앙값 ${fmt(S.gj_med[i])}%<br>전국 중앙값 ${fmt(S.nat_med[i])}%`});
 $("regionalVacancyTable").innerHTML='<thead><tr><th>2026Q2 비교 집단</th><th>상권 수</th><th>중앙값</th><th>단순평균</th></tr></thead><tbody>'+[["광주",R.gwangju],["전국",R.national]].map(([name,r])=>`<tr><td>${name}</td><td>${r.n}개</td><td>${fmt(r.median)}%</td><td>${fmt(r.mean)}%</td></tr>`).join('')+'</tbody>';
 $("regionalVacancyMeaning").textContent=`충장로 ${fmt(E.tgt_vac)}%는 광주 상권 중앙값보다 ${fmt(E.tgt_vac-E.gj_median)}%p, 전국 상권 중앙값보다 ${fmt(E.tgt_vac-E.nat_median)}%p 높습니다. 중앙값뿐 아니라 단순평균과 비교해도 높게 나타납니다.`;
}

function drawLocalComparison(){
 const C=AN.local_comparison;const a=C.rows[0],b=C.rows[1];
 $("comparisonSummary").innerHTML=`<div><span>금남로 / 충장로</span><b>${fmt(a.value)}<small>%</small></b></div><div><span>수완지구</span><b>${fmt(b.value)}<small>%</small></b></div><div><span>같은 유형의 격차</span><b>+${fmt(C.gap_pp)}<small>%p</small></b></div>`;
 barChart($("cLocalVacancy"),{labels:C.rows.map(r=>r.area),groups:[{values:[a.value,null],color:css("--cut")},{values:[null,b.value],color:css("--accent")}],yMax:30,yFmt:v=>v+"%",valFmt:v=>fmt(v)+"%",h:260,tipRow:i=>`${C.rows[i].area} · ${C.quarter} 집합상가 공실률 ${fmt(C.rows[i].value)}%`});
 const quarters=a.series.map(r=>r.quarter);
 lineChart($("cLocalTrend"),{x:quarters,series:[{values:a.series.map(r=>r.vacancy),color:css("--cut")},{values:b.series.map(r=>r.vacancy),color:css("--accent")}],yMin:0,yMax:30,yFmt:v=>v+"%",xFmt:v=>v.slice(2),h:260,tipRows:i=>`${quarters[i]}<br>금남로/충장로 ${fmt(a.series[i].vacancy)}%<br>수완지구 ${fmt(b.series[i].vacancy)}%`});
}
function drawDetailedEvidence(){
 const T=AN.tests;
  // 가설 카드

  const H=T;const verdict=(k,h)=>k==="H2"&&h.p_fe>=0.05?["warn","△ 부분 지지"]:h.supported?["good","✓ 지지"]:["bad","✕ 기각"];const card=(k,h,stat,detail)=>`<div class="panel"><div class="status"><span class="chip ${verdict(k,h)[0]}">${verdict(k,h)[1]}</span><span class="eyebrow">${k}</span></div><h3>${h.title}</h3><b class="big">${stat}</b><span class="ink2" style="font-size:13.5px">${detail}</span><span class="note">${h.method}</span></div>`;

  $("hyp").innerHTML=[

    card("H1",H.H1,`${Math.round(H.H1.share_no_cut*100)}%`,`공실률이 1년에 3%p 이상 오른 ${H.H1.n_rose.toLocaleString()}건 중 ${Math.round(H.H1.share_no_cut*100)}%는 임대가격지수가 1%도 안 내려갔습니다. 공실 1%p 상승당 임대료 반응은 ${fmt(H.H1.b_up,2)}%(${pv(H.H1.p_up)}), 공실 하락기 반응은 ${fmt(H.H1.b_down,3)}%로 비대칭(Wald ${pv(H.H1.wald_p)}).`),

    card("H2",H.H2,`+${fmt(H.H2.b,2)}%p`,`시도 평균보다 임대료가 100% 비싸면 1년 뒤 공실이 ${fmt(H.H2.b,2)}%p 더 늘어납니다(${pv(H.H2.p)}, 95% 구간 ${fmt(H.H2.ci[0],2)}~${fmt(H.H2.ci[1],2)}). 방향은 유의하지만 크기는 작고, 같은 상권 안의 변화만 보면(상권 고정효과) 유의성이 사라집니다(${pv(H.H2.p_fe)}). 그래서 부분 지지로 판정했습니다.`),

    card("H3",{...H.H3,title:"임대료와 자산가치는 함께 움직인다"},`${fmt(H.H3.b_rent4,2)}%p`,`임대가격지수 1% 변화 → 1년 자본수익률 ${fmt(H.H3.b_rent4,2)}%p(${pv(H.H3.p_rent4)}). 같은 회귀에서 공실률 변화의 효과는 ${fmt(H.H3.b_vac4,3)}%p(${pv(H.H3.p_vac4)}). 다만 공실률이 높은 상권은 이후 1년 자본수익률이 1%p당 ${fmt(H.H3.b_vac_future,3)}%p 낮습니다(${pv(H.H3.p_vac_future)}). 자본수익률은 임대료로 환산한 감정가치에서 계산되므로 계산상 연동이 포함됩니다.`),

    card("H4",H.H4,`${fmt(H.H4.mean_old)}% vs ${fmt(H.H4.mean_other)}%`,`최근 2년 평균 공실률, 원도심 ${H.H4.n_old}곳 vs 기타 ${H.H4.n_other}곳 (Welch ${pv(H.H4.t_p)}, Mann-Whitney ${pv(H.H4.mw_p)}). 2018~19년 대비 상승폭은 ${fmt(H.H4.chg_old)}%p vs ${fmt(H.H4.chg_other)}%p로 원도심이 더 컸지만, 이 차이 자체는 유의하지 않습니다(${pv(H.H4.chg_p)}).`),

    card("H5",H.H5,`반감기 ${fmt(H.H5.half_life_q/4)}년`,`분기 자기상관 ρ=${fmt(H.H5.rho,3)}(${pv(H.H5.p)}). 공실 충격이 절반으로 줄기까지 전체 상권 ${fmt(H.H5.half_life_q/4)}년, 원도심은 ρ=${fmt(H.H5.rho_old,3)}로 ${fmt(H.H5.half_life_old/4)}년이 걸립니다.`)].join("");


 barChart($("cH4Restored"),{labels:["원도심","기타 상권"],groups:[{values:[T.H4.mean_old,T.H4.mean_other],color:css("--accent")}],yMax:30,yFmt:v=>v+"%",valFmt:v=>fmt(v)+"%",h:220,tipRow:i=>`최근 2년 평균 공실률 ${fmt(i?T.H4.mean_other:T.H4.mean_old)}%`});
 barChart($("cH5Restored"),{labels:["원도심","전체 상권"],groups:[{values:[T.H5.half_life_old/4,T.H5.half_life_q/4],color:css("--cut")}],yMax:8,yFmt:v=>v+"년",valFmt:v=>fmt(v)+"년",h:220,tipRow:i=>`공실 충격 반감기 ${fmt((i?T.H5.half_life_q:T.H5.half_life_old)/4)}년 · 기존 모형 추정`});
 $("qualityReview").innerHTML='<h3>전처리와 품질 확인</h3><p>보관 원자료 '+QA.raw_long_rows.toLocaleString()+'행에서 분석 패널 '+QA.panel_rows.toLocaleString()+'행을 구성했습니다. 이 수치는 기존 분석 기록입니다.</p><div class="tbl"><table><thead><tr><th>확인 항목</th><th>보관 기록</th></tr></thead><tbody>'+Object.entries(QA.quality).filter(([k,v])=>!Array.isArray(v)&&typeof v!=='object').map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')+'</tbody></table></div>';
}

/* ---------- 3-0. 브라우저 AI 학습 ---------- */

/* 브라우저 실제 학습/선택/평가/입력 예측. 모델 재학습과 test 열람을 분리한다. */
const SEL=new Set(ML.cols);let TRAINED=null,SELECTED=null,TESTED=false,TEST_RESULT=null;
function buildFeatBoxes(){
  $('featBoxes').textContent='고정 피처: 현재 공실률 · 1년 공실 변화 · 1년 임대가격지수 변화 · 원도심 여부. 이전 test 기반 피처 선정 결과는 사용하지 않습니다.';
  $('trainLede').textContent='로컬 Python 서버에서 train 2,806건으로 학습 → valid 920건으로 선택 → test 956건으로 평가합니다. 시간 간격을 두며 과거 자료의 회고적 평가입니다. scikit-learn 구현으로 기존 JS 수치와 다를 수 있습니다.';
  const lab=()=>{['rounds','lr','depth'].forEach(id=>$(id+'O').value=$(id).value);};
  ['rounds','lr','depth'].forEach(id=>$(id).addEventListener('input',()=>{lab();if(SELECTED&&!TESTED){SELECTED=null;$('testBtn').disabled=true;$('trainMsg').textContent='설정을 변경했습니다. 다시 valid 선택을 실행하세요.';}}));lab();
  const select=$('realArea');
  ML.latest.forEach((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=r.area;select.appendChild(o);});
  select.value=ML.latest.findIndex(r=>r.area===ML.target_area);
  const load=()=>{const r=ML.latest[+select.value];$('realQuarter').value=r.quarter;['realVac','realChange','realRent','realOld'].forEach((id,i)=>$(id).value=r.x[i]);invalidatePrediction();};
  select.addEventListener('change',load);load();
  ['realQuarter','realVac','realChange','realRent','realOld'].forEach(id=>$(id).addEventListener('input',invalidatePrediction));
  $('testBtn').addEventListener('click',()=>testSelected().catch(e=>$('trainMsg').textContent=e.message));
  $('predictBtn').addEventListener('click',()=>predictReal().catch(e=>$('inputMsg').textContent=e.message));
  drawTypes();
}
function invalidatePrediction(){TRAINED=null;$('predictionModels').innerHTML='';$('predictionCaution').textContent='';$('trainFc').textContent='입력값 확인 후 예측 실행을 누르세요.';$('inputMsg').textContent='저장된 실측값을 불러오거나 직접 입력할 수 있습니다. 수정값의 출처는 사용자가 확인해야 합니다.';$('predictionExplanation').textContent='예측 실행 후 결과의 의미를 설명합니다.';}
async function train(){
  if(TESTED)return;
  SELECTED=null;$('testBtn').disabled=true;$('predictBtn').disabled=true;invalidatePrediction();
  $('trainBtn').disabled=true;$('trainMsg').textContent='train에서 학습 중… test는 선택에 사용하지 않습니다.';
  ['rounds','lr','depth'].forEach(id=>$(id).disabled=true);
  try{
    SELECTED=await api('/api/train',{rounds:+$('rounds').value,lr:+$('lr').value,depth:+$('depth').value});
    $('tTrain').innerHTML=regressionTable(SELECTED.models,SELECTED.chosen);
    hbars($('trainImp'),ML.labels.map((k,i)=>({k,v:SELECTED.importance[i]})),{fmtv:v=>fmt(v,3)});
    $('trainMsg').textContent=`5개 회귀모델 중 valid MAE로 ${SELECTED.chosen} 선택. test에서 현재값 유지 기준과 별도로 비교합니다. test 버튼을 누르면 설정과 모델이 고정됩니다. test 확인 후 반복 조정은 독립 평가가 아닙니다.`;
    $('testBtn').disabled=false;$('progBar').style.width='100%';
  }catch(e){$('trainMsg').textContent=e.message;}finally{$('trainBtn').disabled=false;['rounds','lr','depth'].forEach(id=>$(id).disabled=false);}
}
async function testSelected(){
  if(!SELECTED||TESTED)return;
  const r=await api('/api/test',{token:SELECTED.token});TESTED=true;TEST_RESULT=r;
  ['trainBtn','testBtn','rounds','lr','depth'].forEach(id=>$(id).disabled=true);
  $('testResults').textContent=`valid로 고정한 모델: ${SELECTED.chosen} / test ${r.n}건. 아래는 모든 모델의 동일 test 평가입니다. test 점수로 재선택하지 않습니다. ${r.selected.MAE>r.baseline.MAE?'선택 모델의 test MAE가 현재값 유지보다 큽니다.':'선택 모델의 test MAE가 현재값 유지 이하입니다.'}`;
  $('tTest').innerHTML=regressionTable([r.baseline,...r.models],SELECTED.chosen);
  scatterChart($('cTrainSc'),{x:r.pred,y:r.y,lo:0,hi:100,hl:[]});
  $('predictBtn').disabled=false;$('trainMsg').textContent='test 평가 완료. 같은 고정 모델로 입력값을 예측합니다. 이 화면에서는 재조정을 잠갔습니다. 새로고침 후 반복 평가해도 새 test가 되는 것은 아닙니다.';
  $('trainFc').textContent='test 평가가 끝났습니다. 실측값을 확인하고 입력값으로 예측 실행을 누르세요.';
}
async function predictReal(){
  if(!TESTED)throw Error('먼저 valid 선택 및 test 평가를 완료하세요.');
  const ids=['realVac','realChange','realRent','realOld'];
  if(ids.some(id=>$(id).value.trim()===''))throw Error('입력값을 모두 채워주세요.');
  const x=ids.map(id=>Number($(id).value)),q=$('realQuarter').value.trim();
  if(!/^\d{4}Q[1-4]$/.test(q))throw Error('기준분기는 2026Q2 형식으로 입력하세요.');
  if(x.some(v=>!Number.isFinite(v))||x[0]<0||x[0]>100||x[1]<-100||x[1]>100||x[2]<=-100||![0,1].includes(x[3])||x[0]-x[1]<0||x[0]-x[1]>100)throw Error('공실률 및 전년 공실률은 0~100%, 지수 변화는 -100% 초과, 원도심은 0/1이어야 합니다.');
  if(q<ML.now.quarter)throw Error(`기준분기는 ${ML.now.quarter} 이후로 입력하세요. 이미 평가에 사용한 과거 시점은 신규 예측으로 표시하지 않습니다.`);
  const pred=await api('/api/predict',{token:SELECTED.token,x,quarter:q}),target=pred.target;
  TRAINED={...pred,now:x[0],best:SELECTED.chosen,target};
  const delta=pred.point-x[0],sign=delta>0?'+':'';
  $('trainFc').textContent=`${target} 예상 공실률 ${fmt(pred.point,2)}% · 현재 대비 ${sign}${fmt(delta,2)}%p`;
  $('inputMsg').textContent=pred.outside?'학습 범위 밖 입력입니다. 결과를 신중하게 해석하세요.':'';
  $('predictionModels').innerHTML='<thead><tr><th>모델</th><th>예측</th><th>valid MAE (%p)</th><th>역할</th></tr></thead><tbody>'+SELECTED.models.map((m,i)=>`<tr><td>${m.model}</td><td>${fmt(pred.predictions[i],2)}%</td><td>${fmt(m.MAE,3)}</td><td>${m.model===SELECTED.chosen?'입력 예측에 사용':i===0?'선형회귀 기준모델':'미선택 학습 모델'}</td></tr>`).join('')+'</tbody>';
  const trend=Math.abs(delta)<.005?'큰 변화가 없는 수준':`${Math.abs(delta).toFixed(2)}%p ${delta>0?'상승':'하락'}`;
  $('predictionExplanation').textContent=`입력한 상권 지표를 바탕으로 1년 뒤 공실률은 ${fmt(pred.point,2)}%로 예상됩니다. 현재 ${fmt(x[0],2)}%에서 ${trend}하는 계산 결과입니다. ${SELECTED.chosen}의 참고 예측이며, 펀드 시행 효과는 포함하지 않습니다.`;
  $('predictionCaution').textContent=`test 평균 절대오차 ${fmt(TEST_RESULT.selected.MAE,2)}%p. ${TEST_RESULT.selected.MAE>TEST_RESULT.baseline.MAE?'현재값 유지 기준모델보다 test 오차가 큽니다. ':''}valid 잔차 참고 범위 ${fmt(pred.lo,2)}~${fmt(pred.hi,2)}% (보장 구간 아님).`;

}
function drawTypes(){
  const proposals={'고공실·상승':'정착금·생존지원 우선 검토: 신규 입점과 퇴점 방지를 함께 측정',
    '고공실·비상승':'장기 공실 입점 지원과 지원 종료 후 유지율 확인',
    '저공실·상승':'퇴점 예방과 페이백 시범사업, 순증 소비 검증',
    '저공실·비상승':'대규모 기금보다 모니터링·소규모 소비 실험 검토'};
  const rule=ML.type_rule;
  $('typeNote').textContent=`${rule.asof} 필수 피처가 있는 ${rule.n}개 상권. 공실률 중앙값 ${rule.vacancy_median}% 이상/미만 × 1년 공실 변화 >0/≤0. 설명용 상대 분류이며 원인·위험·지원 적격성 판정이 아닙니다.`;
  $('typeTable').innerHTML='<thead><tr><th>유형</th><th>상권 수</th><th>평균 공실률</th><th>검토할 개입 (효과 미검증)</th></tr></thead><tbody>'+Object.entries(proposals).map(([k,v])=>{const rr=ML.latest.filter(r=>r.type===k);return `<tr><td>${k}</td><td>${rr.length}</td><td>${rr.length?fmt(rr.reduce((s,r)=>s+r.x[0],0)/rr.length):'–'}%</td><td class="wrap">${v}</td></tr>`;}).join('')+'</tbody>';
  const r=ML.latest.find(r=>r.area===ML.target_area);$('typeTarget').textContent=`금남로/충장로: ${r.type}, 현재 ${fmt(r.x[0])}%, 1년 변화 ${fmt(r.x[1])}%p. 전국 비교 속 사례 연구이며 전국에 같은 효과를 가정하지 않습니다.`;
}

function regressionTable(rows,chosen){
  const val=(v,d=3)=>v==null?'해당 없음':fmt(v,d);
  return '<thead><tr><th>모델</th><th>MAE (%p)</th><th>RMSE (%p)</th><th>R²</th></tr></thead><tbody>'+rows.map(r=>`<tr class="${r.model===chosen?'me':''}"><td>${r.model}${r.model===chosen?' · valid 선택':''}</td><td>${val(r.MAE)}</td><td>${val(r.RMSE)}</td><td>${val(r.R2)}</td></tr>`).join('')+'</tbody>';
}

/* ---------- 시뮬레이터 ---------- */
const PRESETS={self:{n:5,part:50,years:5,target:15,drift:0},bold:{n:7,part:70,years:7,target:15,drift:0}};
function params(){
  const raw={pb:+$("apb").value,st:+$("ast").value,sv:+$("asv").value,fe:+$("afe").value};const tot=raw.pb+raw.st+raw.sv+raw.fe||1;
  return {...BASE,annual_donation_eok:+$("donation").value,n_rate:+$("n").value/100,participation:+$("part").value/100,years:+$("years").value,horizon:Math.max(10,+$("years").value),
    target_vacancy:+$("target").value/100,sliding:$("slide").checked,
    a_pb:0.95*raw.pb/tot,a_st:0.95*raw.st/tot,a_sv:0.95*raw.sv/tot,a_fe:0.95*raw.fe/tot,
    settle_rate:+$("srate").value/100,settle_months:+$("smon").value,
    n_buildings:+$("buildings").value,avg_area_m2:+$("area").value,rent_m2:+$("rent").value,vacancy0:+$("vac0").value/100,
    eps_rent:+$("epsr").value,lam_pb:+$("lam").value,sales_drift:+$("drift").value/100};}
function labels(p){$("buildingsO").value=p.n_buildings+"동";$("donationO").value=p.annual_donation_eok+"억/년";$("nO").value=$("n").value+"%";$("partO").value=$("part").value+"%";
  $("yearsO").value=$("years").value+"년";$("targetO").value=$("target").value+"%";
  $("apbO").value=pct(p.a_pb,0);$("astO").value=pct(p.a_st,0);$("asvO").value=pct(p.a_sv,0);$("afeO").value=pct(p.a_fe,0);
  $("srateO").value=$("srate").value+"%";$("smonO").value=$("smon").value+"개월";
  $("areaO").value=(+$("area").value).toLocaleString("ko-KR")+"㎡";$("rentO").value=(+$("rent").value).toLocaleString("ko-KR");$("vac0O").value=(+$("vac0").value).toFixed(1)+"%";
  $("epsrO").value=(+$("epsr").value).toFixed(1);$("lamO").value=(+$("lam").value).toFixed(2)+"원";$("driftO").value=(+$("drift").value>0?"+":"")+$("drift").value+"%";}
let runVersion=0;
async function run(){
 const version=++runVersion,p=params();
 try { const next=await prepareFund(p); if(version!==runVersion||fundKey(p)!==fundKey(params()))return; fundCache=next; } catch(e){$("appStatus").textContent=e.message;return;}
  labels(p);$("earlyExitNote").textContent=p.vacancy0<=p.target_vacancy?"현재 공실률이 조기 해제 목표 이하이므로 시작 시점에 종료됩니다. 이 조건의 기금 유입은 0원입니다.":"";const b=simulate(p,false),f=simulate(p,true),s=stakeholder(p,b,f);
  $("kF1").textContent=fmt(s.fund_y1)+"억";$("kF1s").textContent=`초기 공실 참여 ${(s.participating_area/1e4).toFixed(2)}만㎡ · 입점 전 출자 0원`;
  $("kFc").textContent=fmt(s.fund_cum)+"억";$("kFcs").textContent=`${s.years_active}년 운영`+(s.years_active<p.years?" (목표 달성 조기 해제)":"")+` · 최초 유입 연도 대비 ${s.fund_growth>=0?"+":""}${pct(s.fund_growth)}`;
  $("kV5").textContent=pct(s.vac5_fund);$("kV5s").textContent=`무대책 ${pct(s.vac5_base)} · ${fmt((s.vac5_base-s.vac5_fund)*100)}%p 낮음`;
  $("kSt").textContent="+"+fmt(s.stores_gain_y5,0)+"곳";$("kSts").textContent=`임대 1건 ${p.unit_area}㎡ 기준 · 기금 1억당 ${fmt(s.stores_per_eok)}곳`;
  if(!$("v-simulator").hidden) drawSimCharts(p,b,f,s);
  drawStake(p,b,f,s);drawGrowth(p,b,f,s);drawSheet(p);drawLL(p,b,f);drawHeat(p);
  document.querySelectorAll(".presets button").forEach(bt=>{const pr=PRESETS[bt.dataset.p];
    bt.setAttribute("aria-pressed",String(Object.keys(pr).every(k=>+$(k).value===pr[k])));});
}
function drawSimCharts(p,b,f,s){
  const yrs=[...Array(p.horizon+1).keys()];
  // 전체 상권과 초기 공실 코호트의 분모가 달라 별도 그래프로 표시한다.
  const allV=[...b.vac,...f.vac],minV=Math.min(...allV),maxV=Math.max(...allV);
  const pad=Math.max(.002,(maxV-minV)*.15);
  const lo=Math.max(0,Math.floor((minV-pad)*200)/200),hi=Math.min(1,Math.ceil((maxV+pad)*200)/200);
  const change=(p.vacancy0-f.vac[5])*100,gap=(b.vac[5]-f.vac[5])*100;
  $("pathSummary").innerHTML=`<div><span>시작 공실률</span><b>${pct(p.vacancy0)}</b></div><div><span>기금 시행 · 5년 뒤</span><b>${pct(f.vac[5])}</b></div><div><span>시작 대비 ${change>=0?'감소':'증가'}</span><b>${fmt(Math.abs(change))}<small>%p</small></b></div>`;
  lineChart($("cPath"),{x:yrs,series:[{values:b.vac,color:css("--base"),dash:"5 4"},{values:f.vac,color:css("--accent")}],
    bands:[{lo:b.vac.map((v,i)=>Math.min(v,f.vac[i])),hi:b.vac.map((v,i)=>Math.max(v,f.vac[i])),color:css("--accent")}],
    yMin:lo,yMax:hi,yFmt:v=>fmt(v*100,1)+"%",xFmt:v=>v+"년",h:300,
    dots:[{i:0,v:f.vac[0],color:"--accent"},{i:5,v:f.vac[5],color:"--accent"}],
    vmarks:s.years_active<p.horizon?[{i:s.years_active,label:"약정 종료"}]:[],
    tipRows:i=>`<b>${i}년차 · 상권 전체</b><br>기금 미시행 <span class="num">${pct(b.vac[i],2)}</span><br>기금 시행 <span class="num">${pct(f.vac[i],2)}</span><br>미시행 대비 차이 ${fmt((b.vac[i]-f.vac[i])*100,2)}%p`});
  $("cPath").querySelector('svg').setAttribute('aria-label',`전체 상권 공실률. 시작 ${pct(p.vacancy0)}, 기금 시행 5년 뒤 ${pct(f.vac[5])}. 세로축 ${pct(lo)}에서 ${pct(hi)}로 확대 표시.`);
  $("pathAxisNote").textContent=`변화를 보기 쉽게 세로축을 ${pct(lo)}~${pct(hi)}로 확대했습니다(0%부터 시작하지 않음). 색칠한 부분은 시행·미시행 차이이며, 5년 뒤 미시행보다 ${fmt(Math.abs(gap))}%p ${gap>=0?'낮습니다':'높습니다'}.`;
  lineChart($("cParticipantPath"),{x:yrs,series:[{values:f.vP,color:css("--accent")}],
    yMin:0,yMax:1,yFmt:v=>Math.round(v*100)+"%",xFmt:v=>v+"년",h:220,
    vmarks:s.years_active<p.horizon?[{i:s.years_active,label:"약정 종료"}]:[],
    tipRows:i=>`<b>${i}년차 · 초기 참여 공실 공간</b><br>해당 공간 중 공실 비율 ${pct(f.vP[i])}`});
  const ny=Math.max(s.years_active,1),idx=[...Array(ny).keys()];
  const st=idx.map(i=>f.st_used[i]),pb=idx.map(i=>f.pb[i]),sv=idx.map(i=>f.fund[i]*p.a_sv),fe=idx.map(i=>f.fe[i]),op=idx.map(i=>f.fund[i]*0.05);
  const ymax=Math.ceil(Math.max(...f.fund.slice(0,ny))*1.2/5)*5||5;
  barChart($("cFund"),{labels:idx.map(i=>(i+1)+"년"),stacked:true,groups:[{values:pb,color:css("--u-pb")},{values:st,color:css("--u-st")},{values:sv,color:css("--u-sv")},{values:fe,color:css("--u-fe")},{values:op,color:css("--u-op")}],
    yMax:ymax,yFmt:v=>fmt(v,0),valFmt:v=>fmt(v,1),h:220,
    tipRow:i=>`<b>${i+1}년차 · 기금 ${fmt(f.fund[i],2)}억</b><br>페이백 ${fmt(pb[i],2)} · 정착금 ${fmt(st[i],2)}<br>생존 지원 ${fmt(sv[i],2)} · 축제 ${fmt(fe[i],2)} · 실비 ${fmt(op[i],2)}<br>정착금 ${fmt(f.settled[i],0)}건 · 출자율 ${fmt(f.n_eff[i]*100,2)}%`});
  // 정착금 회수
  const unitRent=p.unit_area*p.rent_m2*12,cost=unitRent*p.settle_rate*p.settle_months/12;const nAvg=s.years_active?f.n_eff.slice(0,s.years_active).reduce((a,c)=>a+c,0)/s.years_active:p.n_rate;
  const mo=[...Array(61).keys()];const cumC=mo.map(m=>unitRent*nAvg*m/12/1e4);const costM=cost/1e4;
  const be=s.settle_payback_years*12;
  lineChart($("cPayback"),{x:mo,series:[{values:cumC,color:css("--u-st")}],yMin:0,yMax:Math.ceil(Math.max(costM*1.6,cumC[60])/100)*100,yFmt:v=>fmt(v,0)+"만",xFmt:v=>v%12===0?(v/12)+"년":"",h:200,
    marks:[{v:costM,label:"정착금 1건 "+fmt(costM,0)+"만원"}],vmarks:be<=60?[{i:Math.round(be),label:"회수 "+fmt(s.settle_payback_years)+"년"}]:[],
    tipRows:i=>`${i}개월<br>누적 출자 <span class="num">${fmt(cumC[i],0)}만원</span>`});
  $("paybackNote").textContent=`임대 1건(${p.unit_area}㎡, 월세 ${fmt(unitRent/12/1e4,0)}만원)에 정착금 ${fmt(costM,0)}만원을 주면, 입점한 점포의 건물주 출자로 ${fmt(s.settle_payback_years)}년 뒤 회수됩니다. ${s.settle_payback_years<=p.years?"입점 유지와 남은 약정기간이 충분할 때 회수 가능한 단순 계산입니다.":"약정기간보다 길어 정착금 조건을 낮추거나 출자율을 올려야 합니다."}`;
  // 선순환
  const area=areaOf(p);const vs=[];for(let v=100;v>=0;v-=5)vs.push(v/100);
  const participatingArea=area*p.vacancy0*p.participation;
  const fv=vs.map(v=>participatingArea*p.rent_m2*12*(1-v)*p.n_rate/1e8);
  const ci=vs.reduce((bi,v,i)=>Math.abs(v-f.vP[0])<Math.abs(vs[bi]-f.vP[0])?i:bi,0);
  lineChart($("cLoop"),{x:vs,series:[{values:fv,color:css("--accent")}],yMin:0,yMax:Math.ceil(Math.max(...fv)*1.15),yFmt:v=>fmt(v,0)+"억",xFmt:v=>Math.round(v*100)+"%",h:200,
    dots:[{i:ci,v:fv[ci],color:"--cut"}],tipRows:i=>`초기 공실 참여 공간의 현재 공실률 <span class="num">${pct(vs[i],0)}</span><br>연간 기금 <span class="num">${fmt(fv[i],1)}억</span> (출자율 인하 전)`});
  $("loopNote").textContent=`초기 공실 중 약정한 ${(participatingArea/1e4).toFixed(2)}만㎡를 고정해서 봅니다. 그 공간의 공실률이 1%p 줄 때 연간 출자금은 ${fmt(participatingArea*p.rent_m2*12*.01*p.n_rate/1e8,2)}억 증가합니다(출자율 인하·기부금 제외). 시작 시에는 모두 비어 있어 임대료 출자가 0원입니다.`;
}
function drawStake(p,b,f,s){
  const ll=landlord(p,b,f);const C=ll[3],A=ll[0],A2=ll[1];
  $("stake").innerHTML=[
    ["세입자 · 신규",fmt(s.settle_per_tenant_man,0)+"만원",`입점 정착금 1건. 첫해 실질 임대료 ${pct(s.first_year_rent_cut,0)} 인하 효과, 약정기간 ${fmt(s.settled_total,0)}건 지원`],
    ["세입자 · 입점 후",fmt(s.sv_per_store_man,1)+"만원/년",`초기 공실 참여 공간 입점 점포 1곳당 생존 지원금 평균`],
    ["소비자",fmt(s.payback_cum_eok,1)+"억",`약정기간 상권 페이백 누계. 초기 공실 참여 공간 점포 결제에만 적립`],
    ["건물주",(C.net5-A2.net5>=0?"+":"")+fmt((C.net5-A2.net5)*1e4,0)+"만원",`참여 시 5년 순현금, 비참여 대비. 현상유지 대비 ${(C.net5-A.net5>=0?"+":"")+fmt((C.net5-A.net5)*1e4,0)}만원, LTV ${pct(C.ltv,0)} 유지`],
  ].map(([k,v,t])=>`<div class="panel"><span class="eyebrow">${k}</span><b class="big">${v}</b><span class="ink2" style="font-size:13.5px">${t}</span></div>`).join("");
}
function drawLL(p,b,f){
  const ll=landlord(p,b,f);const A=ll[0].net5;
  $("tLL").querySelector("tbody").innerHTML=ll.map((r,i)=>{
    const d=r.net5-A;let chip;
    if(r.repay>0) chip='<span class="chip bad">✕ 약정 초과</span>';
    else if(i===0) chip='<span class="chip mut">기준</span>';
    else if(d>=0) chip='<span class="chip good">가정 내 순편익 ≥ 0</span>';
    else chip='<span class="chip warn">! 손실</span>';
    return `<tr class="${i===3?"me":""}"><td>${r.name}</td><td class="num">${fmt(r.month1,0)}만원</td><td class="num">${fmt(r.net5,2)}억</td><td class="num">${i?(d>=0?"+":"")+fmt(d*1e4,0)+"만":"–"}</td><td class="num">${pct(r.ltv,0)}</td><td class="num">${fmt(r.repay,2)}억</td><td>${chip}</td></tr>`;}).join("");
  const C=ll[3].net5,A2=ll[1].net5;
  $("llNote").textContent=`시작 시 전부 비어 있는 임대면적 500㎡ 예시, 평균 임대료 ${p.rent_m2.toLocaleString("ko-KR")}원/㎡, LTV 60%·금리 4.5%·보유비 0.4% 기준. 참여(C)는 비참여(A′)보다 5년간 ${C>=A2?fmt((C-A2)*1e4,0)+"만원 더":fmt((A2-C)*1e4,0)+"만원 덜"} 법니다. 정착금·페이백이 초기 공실 참여 공간에만 돌아가기 때문입니다.`;
}
let SHEET=[];
function drawSheet(p){
  const ns=FUND_RATE_STEPS;SHEET=[];
  ns.forEach(n=>{const q={...p,n_rate:n/100};const b=simulate(q,false),f=simulate(q,true),s=stakeholder(q,b,f),ll=landlord(q,b,f);
    SHEET.push({n,f1:s.fund_y1,cum:s.fund_cum,yrs:s.years_active,v5:s.vac5_fund,b5:s.vac5_base,settled:s.settled_total,pay:s.settle_payback_years,
      m1:ll[3].month1,net:ll[3].net5,vsA:ll[3].net5-ll[0].net5,vsA2:ll[3].net5-ll[1].net5});});
  const cur=ns.reduce((a,b)=>Math.abs(b-p.n_rate*100)<Math.abs(a-p.n_rate*100)?b:a);
  const head=["n%","1년차 기금","약정 누계","5년차 공실률","공실 감소","정착금 건수","정착금 회수","건물주 월 순현금","5년 순현금","무대책 대비","비참여 대비"];
  const col=v=>`style="color:var(${v>=0?"--good":"--bad"})"`;
  $("tSheet").innerHTML=`<thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>`+SHEET.map(r=>
    `<tr class="${r.n===cur?"me":""}"><td class="num">${r.n}%</td><td class="num">${fmt(r.f1)}억</td><td class="num">${fmt(r.cum)}억 <span class="muted">(${r.yrs}년)</span></td>
    <td class="num">${pct(r.v5)}</td><td class="num">${fmt((r.b5-r.v5)*100)}%p</td><td class="num">${fmt(r.settled,0)}건</td>
    <td class="num" style="color:var(${r.pay<=p.years?"--good":"--bad"})">${isFinite(r.pay)?fmt(r.pay)+"년":"–"}</td>
    <td class="num">${fmt(r.m1,0)}만</td><td class="num">${fmt(r.net,2)}억</td>
    <td class="num" ${col(r.vsA)}>${r.vsA>=0?"+":""}${fmt(r.vsA*1e4,0)}만</td><td class="num" ${col(r.vsA2)}>${r.vsA2>=0?"+":""}${fmt(r.vsA2*1e4,0)}만</td></tr>`).join("")+"</tbody>";
}
$("copySheet").addEventListener("click",()=>{
  const head=["n%","1년차기금(억)","약정누계(억)","운영연수","5년차공실률(%)","무대책5년차공실률(%)","정착금건수","정착금회수(년)","건물주월순현금(만원)","5년순현금(억)","무대책대비(만원)","비참여대비(만원)"];
  const tsv=[head.join("\t"),...SHEET.map(r=>[r.n,r.f1.toFixed(2),r.cum.toFixed(2),r.yrs,(r.v5*100).toFixed(2),(r.b5*100).toFixed(2),r.settled.toFixed(0),r.pay.toFixed(2),r.m1.toFixed(0),r.net.toFixed(3),(r.vsA*1e4).toFixed(0),(r.vsA2*1e4).toFixed(0)].join("\t"))].join("\n");
  const ok=()=>{$("copyMsg").textContent="복사했습니다. 엑셀에 붙여넣으세요.";};
  const fail=()=>{const r=document.createRange();r.selectNodeContents($("tSheet"));const s=getSelection();s.removeAllRanges();s.addRange(r);$("copyMsg").textContent="표를 선택했습니다. Ctrl+C로 복사하세요.";};
  try{navigator.clipboard.writeText(tsv).then(ok,fail);}catch(e){fail();}
});
function drawHeat(p){
  const ns=FUND_HEAT_RATES,ps=FUND_PART_STEPS;const cells=[];
  ns.forEach(n=>ps.forEach(pp=>{const q={...p,n_rate:n/100,participation:pp/100,target_vacancy:0};const b=simulate(q,false),f=simulate(q,true),s=stakeholder(q,b,f);
    cells.push({n,pp,v:s.vac5_fund,c:s.fund_cum});}));
  const vs=cells.map(c=>c.v),lo=Math.min(...vs),hi=Math.max(...vs);
  const steps=["--seq1","--seq2","--seq3","--seq4","--seq5","--seq6","--seq7"];
  const curN=ns.reduce((a,b)=>Math.abs(b-p.n_rate*100)<Math.abs(a-p.n_rate*100)?b:a),curP=ps.reduce((a,b)=>Math.abs(b-p.participation*100)<Math.abs(a-p.participation*100)?b:a);
  let h=`<thead><tr><th>n% \\ 참여율</th>${ps.map(x=>`<th>${x}%</th>`).join("")}</tr></thead><tbody>`;
  ns.forEach(n=>{h+=`<tr><th>${n}%</th>`;ps.forEach(pp=>{const c=cells.find(c=>c.n===n&&c.pp===pp);
    const k=Math.round((hi-c.v)/(hi-lo||1)*(steps.length-1));const dark=k>=3;
    h+=`<td class="${n===curN&&pp===curP?"cur":""}" style="background:var(${steps[k]});color:${dark?"#fff":"#152033"}">${pct(c.v)}<br><span style="font-size:11px;opacity:.8">${fmt(c.c,0)}억</span></td>`;});h+="</tr>";});
  $("tHeat").innerHTML=h+"</tbody>";
  const c55=cells.find(c=>c.n===5&&c.pp===50);const need=cells.filter(c=>c.v<=0.20).sort((a,b)=>a.n-b.n||a.pp-b.pp)[0];
  $("insights").innerHTML=[`출자율 5%·초기 공실 면적의 50% 참여면 5년차 공실률 ${pct(c55.v)}, 누계 기금 ${fmt(c55.c,0)}억입니다.`,
    need?`공실률 20% 이하에 닿는 가장 낮은 출자율은 n ${need.n}% (참여 ${need.pp}%)입니다.`:`현재 가정에서는 표의 어떤 조합도 5년 안에 공실률 20% 이하에 닿지 않습니다. 참여율과 지원 배분을 비교하세요.`,
    `참여율은 전체 상가가 아닌 시작 시 공실 면적 기준입니다. 기부금이 없으면 자연 입점 후 출자부터 시작하며, 초기 지원 재원을 별도로 확보하는 조건도 비교해야 합니다.`].map(s=>`<li>${s}</li>`).join("");
}
function drawGrowth(p,b,f,s){
  const ll=landlord(p,b,f),C=ll[3],A=ll[0],A2=ll[1];
  const unitMonth=p.unit_area*p.rent_m2/1e4;
  const steps=[
    ["돈이 모인다",`첫해 ${fmt(s.fund_y1)}억 · 누계 ${fmt(s.fund_cum)}억`,`초기 공실 참여 공간주(면적 ${Math.round(p.participation*100)}%)가 받은 월세의 ${fmt(p.n_rate*100,1)}%를 냅니다. 가게가 비어 있는 동안은 내지 않습니다. ${s.years_active}년간 민간 기부금(연 ${fmt(p.annual_donation_eok||0,1)}억) 포함 총 ${fmt(s.fund_cum,0)}억입니다. 정부 지원금은 없습니다.`],
    ["가게와 손님에게 돌아간다",`정착금 ${fmt(s.settled_total,0)}곳`,`새로 들어오는 가게에 첫 ${p.settle_months}개월 월세의 ${Math.round(p.settle_rate*100)}%(1곳 ${fmt(s.settle_per_tenant_man,0)}만원)를 지원합니다. 손님에게는 초기 공실 참여 공간 가게에서 쓴 돈의 일부를 ${s.years_active}년간 ${fmt(s.payback_cum_eok,0)}억 돌려줍니다.`],
    ["빈 가게가 줄어든다",`${pct(s.vac5_base,1)} → ${pct(s.vac5_fund,1)}`,`5년 뒤 빈 공간 비율입니다. 펀드가 없으면 별도의 매출·입퇴점 가정에 따라 변하고, 펀드가 있으면 약 ${fmt(s.stores_gain_y5,0)}곳(가게 1곳 ${p.unit_area}㎡ 기준)이 더 채워집니다.`],
    ["채워진 가게가 다시 기금이 된다",`${fmt(s.settle_payback_years,1)}년이면 회수`,`새 가게가 월세를 내면 그 일부가 다시 기금으로 들어옵니다. 정착금 1곳에 준 ${fmt(s.settle_per_tenant_man,0)}만원은 그 가게가 내는 출자금으로 약 ${fmt(s.settle_payback_years,1)}년이면 돌아옵니다. ${s.settle_payback_years<=p.years?"입점 유지와 남은 약정기간이 충분해야 회수할 수 있습니다.":"약정 기간보다 길어서 정착금을 줄이거나 출자율을 올려야 합니다."}`]];
  $("story").innerHTML=steps.map(([t,v,d])=>`<li><span class="t">${t}</span><b>${v}</b><span class="d">${d}</span></li>`).join("");
  const diff=(C.net5-A.net5)*1e4,diff2=(C.net5-A2.net5)*1e4;
  $("ownerPlain").innerHTML=`<p><b>담보가치가 유지된다고 가정한 비교입니다.</b> 예시 건물(500㎡) 기준 담보비율 ${pct(C.ltv,0)}가 유지됩니다. 같은 건물이 월세를 30% 내리면 담보비율이 ${pct(ll[2].ltv,0)}까지 올라 은행에 ${fmt(ll[2].repay,1)}억을 더 갚으라는 요구를 받을 수 있습니다.</p>
  <p><b>출자 후 순현금은 아래 가정에 따라 달라집니다.</b> 출자금을 내더라도 빈 가게가 빨리 채워져, 5년간 이자·세금을 빼고 남는 돈이 펀드를 안 할 때보다 <b>${diff>=0?"+":""}${fmt(diff,0)}만원</b>, 같은 초기 공실 조건의 비참여 공간보다 <b>${diff2>=0?"+":""}${fmt(diff2,0)}만원</b>입니다.</p>
  <p class="note">비교 대상은 “정상 월세”가 아니라 “빈 가게”입니다. 비어 있는 가게는 0원을 벌고, 참여한 가게는 월세의 ${fmt(100-p.n_rate*100,1)}%를 법니다.</p>`;
  const cum=s.fund_cum;
  barChart($("cScale"),{labels:["첫해 기금","약정 누계"],groups:[{values:[s.fund_y1,cum],color:css("--accent")}],yMax:Math.ceil(Math.max(cum,1)*1.2/5)*5,yFmt:v=>v+"억",valFmt:v=>fmt(v,1)+"억",h:200});
  $("scaleNote").textContent="민간 상생기금의 조성 규모입니다. 정부 지원금은 포함하지 않습니다.";
}
function drawProof(){
  const g10=MC.gap["10"]*100,g90=MC.gap["90"]*100;
  $("proof").innerHTML=[
    ["빈 가게가 줄어든 횟수",`3,000번 중 ${Math.round(MC.prob_gap_pos*3000).toLocaleString()}번`,`매출 추세 0%로 고정한 가정 표본에서 펀드가 있을 때 5년 뒤 빈 가게 비율이 더 낮았습니다. 낮아진 폭은 ${fmt(g10)}~${fmt(g90)}%p입니다.`],
    ["기금이 커진 횟수",`10번 중 ${Math.round(MC.prob_grow_pos*10)}번`,`마지막 기금 유입 연도의 규모가 최초 유입 연도보다 큰 경우입니다. 시작 시 기금이 0원이므로 첫해 대비 증가율은 사용하지 않습니다.`],
    ["5년간 모이는 돈",`${fmt(MC.cum["10"],0)}~${fmt(MC.cum["90"],0)}억`,`기본 매출 추세 0%를 고정하고 나머지 가정 범위를 바꿔 계산한 재원 규모입니다. 실제 참여율·수납률·공실 변화에 따라 달라지며 사업 성공 확률이 아닙니다.`]
  ].map(([k,v,t])=>`<div class="panel"><span class="eyebrow">${k}</span><b class="big">${v}</b><span class="ink2" style="font-size:13.5px">${t}</span></div>`).join("");
}
function drawMC(){
  lineChart($("cMC"),{x:MC.year,bands:[{lo:MC.base_p10,hi:MC.base_p90,color:css("--base")},{lo:MC.fund_p10,hi:MC.fund_p90,color:css("--accent")}],
    series:[{values:MC.base_p50,color:css("--base")},{values:MC.fund_p50,color:css("--accent")}],yMin:Math.max(0,Math.floor(Math.min(...MC.base_p10,...MC.fund_p10)*10)/10),yMax:Math.ceil(Math.max(...MC.base_p90,...MC.fund_p90)*10)/10,yFmt:v=>Math.round(v*100)+"%",xFmt:v=>v+"년",
    vmarks:[{i:5,label:"약정 종료"}],
    tipRows:i=>`<b>${i}년 뒤 빈 가게 비율</b><br>펀드 없음 <span class="num">${pct(MC.base_p50[i])}</span><br>펀드 있음 <span class="num">${pct(MC.fund_p50[i])}</span>`});
  const PLAIN={eps_rent:"월세 부담이 줄 때 새 가게가 얼마나 들어오나",eps_fill:"상권 매출이 늘 때 새 가게가 얼마나 들어오나",occ_feedback:"가게가 늘면 손님도 늘어나나",eps_exit:"매출이 늘 때 문 닫는 가게가 줄어드나",lam_pb:"페이백 1원이 늘리는 매출",sales_drift:"상권 전체 경기 흐름",lam_fe:"축제 1원이 늘리는 매출",exit0:"평소 문 닫는 가게 비율",kappa_sv:"생존 지원금의 효과"};
  const top=Object.entries(MC.importance).slice(0,5);const mx=Math.max(...top.map(([,v])=>Math.abs(v)));
  $("drivers").innerHTML=top.map(([k,v],i)=>{const w=Math.abs(v)/mx*100;const lvl=w>75?"매우 큼":w>45?"큼":"보통";
    return `<div class="bar-row plainbar"><span>${PLAIN[k]||k}</span><div class="track"><span class="fill" style="left:0;width:${w}%;background:var(${i===0?"--cut":"--accent"})"></span></div><span style="text-align:right;font-size:12.5px;color:var(--ink2)">${lvl}</span></div>`;}).join("");
}

/* ---------- 라우팅 ---------- */
const VIEWS=["main", "evidence", "policy", "analysis", "simulator", "forecast", "national"];
function show(){
  let v=(location.hash||"#main").slice(1);if(!VIEWS.includes(v))v="main";
  VIEWS.forEach(k=>{$("v-"+k).hidden=k!==v;});
  document.querySelectorAll(".tabs a").forEach(a=>{if(a.dataset.v===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  if(v==="main"||v==="evidence"){drawMain();drawMainKpis();}
  if(v==="evidence")drawHyp().catch(e=>$("appStatus").textContent=e.message);
  if(v==="analysis"){drawAnalysis();}
  if(v==="simulator"){run();drawProof();drawMC();}
}
addEventListener("hashchange",()=>{show();scrollTo(0,0);});
let fundTimer;document.querySelectorAll("#ctl input").forEach(i=>i.addEventListener("input",()=>{clearTimeout(fundTimer);fundTimer=setTimeout(run,180);}));
$("cut").addEventListener("input",()=>drawHyp().catch(e=>$("appStatus").textContent=e.message));
document.querySelectorAll(".presets button").forEach(b=>b.addEventListener("click",()=>{const pr=PRESETS[b.dataset.p];for(const k in pr)$(k).value=pr[k];run();}));
buildFeatBoxes();
$("trainBtn").addEventListener("click",()=>{train().catch(e=>{$("trainMsg").textContent="학습에 실패했습니다: "+e.message;$("trainBtn").disabled=false;});});

run();show();
let rz,lastW=innerWidth;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(innerWidth!==lastW){lastW=innerWidth;show();}},150);});
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",show);}catch(e){}
new MutationObserver(show).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});

}
boot().catch(e=>document.getElementById("appStatus").textContent=e.message);
