"""공식 공실률의 내부 적재·기초 분석. 웹페이지와 인증키 입력을 분리한다."""
import argparse
import csv
import getpass
import json
import os
from pathlib import Path
from services import kosis


def analyze(dataset):
    groups = {}
    for r in dataset['rows']:
        if '공실' not in r['ITM_NM']+' '+r['TBL_NM'] or not any(s in r['UNIT_NM'] for s in ['%','퍼센트']):
            continue
        key = tuple([r['ITM_ID']]+[r.get('C'+str(i),'') for i in range(1,9)])
        groups.setdefault(key,[]).append(r)
    clean=[];summary=[]
    for rows in groups.values():
        periods=[r['PRD_DE'] for r in rows]
        if len(periods)!=len(set(periods)):
            raise ValueError('동일 계열·분기에 중복 자료가 있어 적재를 중단했습니다.')
        rows.sort(key=lambda r:r['PRD_DE']);latest=rows[-1];prev=rows[-2] if len(rows)>1 else None
        change=latest['value']-prev['value'] if prev and latest['value'] is not None and prev['value'] is not None else None
        label=' / '.join([latest.get('C'+str(i)+'_NM','') for i in range(1,9) if latest.get('C'+str(i)+'_NM')]+[latest['ITM_NM']])
        summary.append(dict(series=label,period=latest['PRD_DE'],vacancy=latest['value'],previous_period=prev['PRD_DE'] if prev else None,change_pp=change))
        for r in rows:clean.append(dict(series=label,period=r['PRD_DE'],vacancy=r['value'],unit=r['UNIT_NM'],table_id=r['TBL_ID']))
    if not clean:raise ValueError('공실률(%)로 확인할 수 있는 자료가 없습니다. 분류·항목을 확인하세요.')
    return clean,dict(source=dataset['source'],fetchedAt=dataset['fetchedAt'],series=summary,note='전기차는 조회된 직전 시점과의 차이이며, 분류·조사 기준이 다른 계열은 합산하지 않음')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--query-file',type=Path);args=parser.parse_args()
    key=os.environ.get('KOSIS_API_KEY') or getpass.getpass('KOSIS 인증키 (화면에 표시·저장하지 않음): ')
    query=args.query_file.read_text(encoding='utf-8-sig').strip() if args.query_file else ''
    dataset=kosis.fetch(dict(apiKey=key,query=query));clean,summary=analyze(dataset)
    root=Path(__file__).resolve().parent/'data'
    with (root/'kosis_vacancy_clean.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=['series','period','vacancy','unit','table_id']);writer.writeheader();writer.writerows(clean)
    (root/'kosis_analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print('공식 공실률',len(clean),'행 적재 /',len(summary['series']),'개 계열 분석 완료. 인증키는 저장하지 않았습니다.')

if __name__=='__main__':
    try:main()
    except (ValueError,OSError) as e:raise SystemExit(str(e)) from None
