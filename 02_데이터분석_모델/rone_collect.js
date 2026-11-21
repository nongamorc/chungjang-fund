/*
 * 한국부동산원 R-ONE 상업용부동산 임대동향조사 · 상권별 원자료 수집 스크립트
 * 실행 위치: 브라우저에서 https://www.reb.or.kr/r-one/portal/stat/easyStatPage/TT244763134428698.do 를 연 뒤
 *            개발자 도구 콘솔에 붙여넣어 실행 (같은 출처에서만 동작)
 * 실행일: 2026-10-27
 * 결과: rone_commercial_panel.csv (var, table_id, cate1, cate2, cate3, cate4, quarter, item, value)
 *       → data/rone_panel_long.csv 로 정리 (build_panel.py 입력)
 * 조회 경로: R-ONE 통계조회 화면이 쓰는 /r-one/portal/stat/sttsDataPreviewList.do (POST)
 * 수익률 표 item: 100001 투자수익률, 100002 소득수익률, 100003 자본수익률
 */
async function get(id, y0, y1) {
  const body = `statblId=${id}&dtacycleCd=QY&wrttimeStartYear=${y0}&wrttimeStartQt=01&wrttimeEndYear=${y1}&wrttimeEndQt=04` +
    `&wrttimeType=B&wrttimeOrder=A&viewLocOpt=B&optST=H&optSC=L&optSI=H&dtadvsVal=OD&hasClsAllChk=Y&hasItmAllChk=Y&hasGrpAllChk=Y&callSheet=IB8&tabTreeClsExpnOptCbo=00`;
  const r = await fetch('/r-one/portal/stat/sttsDataPreviewList.do', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest'},
    body
  });
  return (await r.json()).DATA || [];
}
const TABLES = {
  vac_mid:   [['A_2024_00239',2013,2016],['A_2024_00242',2017,2018],['A_2024_00245',2019,2019],['A_2024_00248',2020,2020],['A_2024_00251',2021,2021],['A_2024_00254',2022,2024],['T249633134845544',2024,2026]],
  vac_small: [['A_2024_00240',2013,2016],['A_2024_00243',2017,2018],['A_2024_00246',2019,2019],['A_2024_00249',2020,2020],['A_2024_00252',2021,2021],['A_2024_00255',2022,2024],['T241833134686576',2024,2026]],
  rent_mid:  [['A_2024_00258',2013,2016],['A_2024_00262',2017,2018],['A_2024_00266',2019,2019],['A_2024_00270',2020,2020],['A_2024_00274',2021,2021],['A_2024_00278',2022,2024],['T244363134858603',2024,2026]],
  ret_mid:   [['A_2024_00347',2013,2016],['A_2024_00351',2017,2018],['A_2024_00355',2019,2019],['A_2024_00359',2020,2020],['A_2024_00363',2021,2021],['A_2024_00367',2022,2024],['T242083134887473',2024,2026]],
  rentidx_mid: [['TT248473134635539',2013,2026]]
};
(async () => {
  const rows = [], log = [];
  for (const [v, list] of Object.entries(TABLES)) {
    for (const [id, y0, y1] of list) {
      const d = await get(id, y0, y1); let n = 0;
      for (const r of d) for (const [k, val] of Object.entries(r)) {
        const m = k.match(/^COL_(\d{4})(\d{2})(\d+)OD$/);
        if (!m || val === '' || val == null) continue;
        rows.push([v, id, r.CATE1, r.CATE2, r.CATE3, r.CATE4 || '', m[1] + 'Q' + (+m[2]), m[3], val]); n++;
      }
      log.push(`${v} ${id} ${y0}-${y1}: ${d.length}행 ${n}값`);
    }
  }
  console.log(log.join('\n') + '\n총 ' + rows.length + '값');   // 2026-10-27 실행: 총 78,694값
  const csv = '﻿var,table_id,cate1,cate2,cate3,cate4,quarter,item,value\n' +
    rows.map(r => r.map(x => /[,"]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = 'rone_commercial_panel.csv'; a.click();
})();
