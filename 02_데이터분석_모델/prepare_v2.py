"""기존 panel.csv만 사용. 정확한 분기 조인으로 1년 변화/목표를 생성한다."""
import ast
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def quarter(q):
    return int(q[:4]) * 4 + int(q[-1]) - 1

def build():
    tree = ast.parse((ROOT / 'analysis_rone.py').read_text(encoding='utf-8-sig'))
    old = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
               and any(isinstance(t, ast.Name) and t.id == 'OLD' for t in n.targets))
    rows = list(csv.DictReader((ROOT / 'data/panel.csv').open(encoding='utf-8-sig')))
    lookup = {(r['sido'], r['area'], quarter(r['quarter'])): r for r in rows}
    assert len(lookup) == len(rows), '시도·상권·분기 중복'
    areas = sorted({r['sido'] + ' / ' + r['area'] for r in rows})
    cols = ['vac', 'd_vac4', 'd_rent4', 'old_dt']
    samples, latest = [], []
    asof = max(r['quarter'] for r in rows)
    for r in rows:
        key = (r['sido'], r['area'])
        q = quarter(r['quarter'])
        prev, future = lookup.get((*key, q - 4)), lookup.get((*key, q + 4))
        try:
            v = float(r['vac_mid'])
            change = v - float(prev['vac_mid'])
            rent_change = (float(r['rentidx']) / float(prev['rentidx']) - 1) * 100
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        x = [v, change, rent_change, int(r['area'] in old)]
        name = r['sido'] + ' / ' + r['area']
        if r['quarter'] == asof:
            latest.append({'area': name, 'quarter': asof, 'x': x})
        if future and future['vac_mid']:
            samples.append([areas.index(name), r['quarter'], 0, *x, float(future['vac_mid'])])
    now = next(r for r in latest if r['area'] == '광주 / 금남로/충장로')
    data = {'cols': cols, 'labels': ['현재 공실률(%)', '1년 공실 변화(%p)', '1년 임대가격지수 변화(%)', '원도심 여부(0/1)'],
            'areas': areas, 'target_area': now['area'], 'rows': samples, 'now': now, 'latest': latest,
            'scope': '기존 전국 상권 패널. 네 피처 고정, 결측 관측 제외. 과거에 열람한 데이터의 회고적 평가이며 신규 외부 검증이 아님.'}
    values = sorted(r['x'][0] for r in latest)
    n = len(values)
    threshold = (values[(n-1)//2] + values[n//2]) / 2
    for r in latest:
        r['type'] = ('고공실' if r['x'][0] >= threshold else '저공실') + ('·상승' if r['x'][1] > 0 else '·비상승')
    data['type_rule'] = {'vacancy_median': threshold, 'asof': asof, 'n': n,
                         'note': '필수 피처가 있는 최신 상권의 중앙값 기준. 정책 임계값이나 인과적 유형이 아닌 설명용 분류.'}
    (ROOT / 'local_web/data/ml.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print(f'prepared {len(samples)} labeled rows; {n} latest areas; median {threshold}%')

if __name__ == '__main__':
    build()
