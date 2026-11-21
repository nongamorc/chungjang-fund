/* KOSIS 조회 UI: 외부 응답은 textContent로만 출력한다. */
(()=>{
 const $=id=>document.getElementById(id);
 let snapshot=null, groups=new Map(), current=[];
 const period=r=>r.PRD_SE==='Q' && /^\d{6}$/.test(r.PRD_DE)?r.PRD_DE.slice(0,4)+'년 '+Number(r.PRD_DE.slice(4))+'분기':r.PRD_DE;
 const names=r=>Array.from({length:8},(_,i)=>r['C'+(i+1)+'_NM']).filter(Boolean);
 const label=r=>[...names(r),r.ITM_NM,r.UNIT_NM].filter(Boolean).join(' / ');
 const eligible=r=>r && r.PRD_SE==='Q' && r.value>0 && r.value<100 && /%|퍼센트/.test(r.UNIT_NM) && /충장로/.test(label(r)) && /중대형/.test(label(r)+' '+r.TBL_NM) && /공실/.test(r.ITM_NM+' '+r.TBL_NM);
 function selected(){
   current=(groups.get($('kosisSeries').value)||[]).slice().sort((a,b)=>a.PRD_DE.localeCompare(b.PRD_DE));
   const latest=current[current.length-1];
   $('kosisMetric').textContent=latest?`${latest.value===null?'결측':latest.value} ${latest.UNIT_NM} · ${period(latest)}`:'';
   $('kosisTable').replaceChildren();
   const head=document.createElement('tr');['분기','지역·유형·항목','수치','단위'].forEach(t=>{const e=document.createElement('th');e.textContent=t;head.append(e);});$('kosisTable').append(head);
   $('kosisChart').replaceChildren();
   current.forEach(r=>{
     const tr=document.createElement('tr');[period(r),label(r),r.value===null?r.DT:r.value,r.UNIT_NM].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.append(td);});$('kosisTable').append(tr);
     const bar=document.createElement('div');bar.className='kosis-bar';const n=document.createElement('b');n.textContent=r.value===null?'결측':r.value;const i=document.createElement('i');i.style.height=(r.value===null?0:r.value*1.5)+'px';const q=document.createElement('small');q.textContent=period(r);bar.append(n,i,q);$('kosisChart').append(bar);
   });
   $('kosisApply').disabled=!eligible(latest);
   $('kosisProvenance').textContent=snapshot&&latest?`출처: KOSIS / 한국부동산원 · ${latest.TBL_NM} · 표 ${snapshot.tableId} · 가져온 시각 ${new Date(snapshot.fetchedAt).toLocaleString('ko-KR')} · 원표 수정일 ${latest.LST_CHN_DE||'미제공'}. 충장로 중대형상가 공실률(%)인 경우에만 계산에 적용할 수 있습니다.`:'';
 }
 function render(data){
   snapshot=data;groups=new Map();
   data.rows.forEach(r=>{const key=JSON.stringify([r.ITM_ID,...Array.from({length:8},(_,i)=>r['C'+(i+1)])]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
   $('kosisSeries').replaceChildren();let preferred='';
   groups.forEach((rows,key)=>{const opt=document.createElement('option');opt.value=key;opt.textContent=label(rows[0]);$('kosisSeries').append(opt);if(eligible(rows[rows.length-1]))preferred=key;});
   if(preferred)$('kosisSeries').value=preferred;
   $('kosisStatus').textContent=data.rows.length?`공식 통계 ${data.rows.length.toLocaleString()}셀 · ${groups.size}개 계열 (마지막 조회 결과)`:'아직 KOSIS에서 가져온 자료가 없습니다. 인증키 입력 후 조회하세요.';
   selected();
 }
 $('kosisSeries').addEventListener('change',selected);
 $('kosisForm').addEventListener('submit',async e=>{
   e.preventDefault();const key=$('kosisKey').value.trim();if(!key){$('kosisStatus').textContent='발급받은 KOSIS 인증키를 입력하세요.';return;}
   let query=$('kosisQuery').value.trim();
   // 생성 URL에 포함된 인증키도 입력칸에 남겨두지 않는다.
   query=query.replace(/([?&])apiKey=[^&]*/gi,'$1').replace(/\?&/g,'?');
   $('kosisQuery').value=query;$('kosisKey').value='';$('kosisFetch').disabled=true;$('kosisStatus').textContent='KOSIS 공식 통계를 조회하고 있습니다…';
   try{const response=await fetch('/api/kosis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,query})});const data=await response.json();if(!response.ok)throw Error(data.error||'조회 실패');render(data);}
   catch(err){$('kosisStatus').textContent=err.message+' 기존 조회 결과는 유지합니다.';}
   finally{$('kosisFetch').disabled=false;}
 });
 $('kosisApply').addEventListener('click',()=>{
   const r=current[current.length-1];if(!eligible(r))return;
   const field=$('vac0');field.min=Math.min(Number(field.min),r.value);field.max=Math.max(Number(field.max),r.value);field.value=r.value;field.dispatchEvent(new Event('input',{bubbles:true}));
   $('coefChip').textContent=`초기 공실률: KOSIS ${period(r)} ${r.value}% · ${label(r)} / 나머지 사업 조건은 가정`;
   $('kosisStatus').textContent=`${period(r)} 충장로 공실률 ${r.value}%를 시뮬레이터에 적용했습니다. AI 학습 데이터는 별도입니다.`;location.hash='#simulator';
 });
 fetch('/api/kosis').then(r=>{if(!r.ok)throw Error();return r.json();}).then(render).catch(()=>{$('kosisStatus').textContent='공식 통계 기능을 사용하려면 서버를 재시작하세요.';});
})();
