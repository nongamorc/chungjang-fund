"""원자료의 동일한 상권 단위로 광주·전국 평균/중앙값을 재현한다.

실행: local_web에서 python -m services.vacancy_comparison
면적 가중 지역 공식 집계가 아닌, 관측된 상권 공실률의 대표값이다.
"""
import csv
import hashlib
import json
from collections import defaultdict
from statistics import mean, median
from .data import ROOT, load


def build(source):
    groups=defaultdict(lambda: {'national': [], 'gwangju': []})
    seen=set()
    with source.open(encoding='utf-8-sig',newline='') as f:
        for row in csv.DictReader(f):
            key=(row['sido'],row['area'],row['quarter'])
            if key in seen: raise ValueError(f'중복 상권·분기: {key}')
            seen.add(key)
            if not row['vac_mid'].strip(): continue
            v=float(row['vac_mid'])
            if not 0<=v<=100: raise ValueError('공실률 범위 오류')
            groups[row['quarter']]['national'].append(v)
            if row['sido']=='광주': groups[row['quarter']]['gwangju'].append(v)
    def summary(values):
        return dict(n=len(values),mean=mean(values) if values else None,
                    median=median(values) if values else None)
    return dict(method='상권별 동일 가중 중앙값; 결측 제외, 실제 0 포함; 각 분기 관측 상권, 금남로/충장로 포함',
                source='data/panel.csv',sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                quarters={q:{k:summary(v) for k,v in groups[q].items()} for q in sorted(groups)})


if __name__=='__main__':
    report=build(ROOT.parent/'data/panel.csv')
    an=load('an.json'); e=an['eda']; qs=e['series']['quarter']
    e['series']['gj_med']=[report['quarters'][q]['gwangju']['median'] for q in qs]
    e['series']['nat_med']=[report['quarters'][q]['national']['median'] for q in qs]
    latest=report['quarters'][e['asof']]
    e['gj_median']=latest['gwangju']['median']
    e['nat_median']=latest['national']['median']
    e['vacancy_comparison']=report
    (ROOT/'data/an.json').write_text(json.dumps(an,ensure_ascii=False),encoding='utf-8')
    (ROOT/'data/vacancy_comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(latest,ensure_ascii=False))
