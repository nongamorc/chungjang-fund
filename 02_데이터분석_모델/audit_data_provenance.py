"""학습 JSON의 피처·목표를 원 패널의 정확한 시점과 독립 대조한다."""
import csv
import json
import math
from pathlib import Path

root = Path(__file__).resolve().parent
data = json.loads((root / 'local_web/data/ml.json').read_text(encoding='utf-8'))
def qn(q):
    return int(q[:4]) * 4 + int(q[-1]) - 1
raw = list(csv.DictReader((root / 'data/panel.csv').open(encoding='utf-8-sig')))
index = {(r['sido'] + ' / ' + r['area'], qn(r['quarter'])): r for r in raw}
assert len(index) == len(raw)
def check(area, q, x, y=None):
    now, prev = index[area, q], index[area, q-4]
    expected = [float(now['vac_mid']), float(now['vac_mid'])-float(prev['vac_mid']),
                (float(now['rentidx'])/float(prev['rentidx'])-1)*100]
    assert all(math.isclose(a,b,abs_tol=1e-10) for a,b in zip(x[:3], expected))
    assert x[3] in (0, 1)
    if y is not None:
        assert y == float(index[area, q+4]['vac_mid'])
for row in data['rows']:
    check(data['areas'][row[0]], qn(row[1]), row[3:7], row[7])
for row in data['latest']:
    check(row['area'], qn(row['quarter']), row['x'])
report = {'passed': True, 'labeled_rows_checked': len(data['rows']), 'latest_inputs_checked': len(data['latest']),
          'checks': ['수치 피처는 당기·전년 동분기 값만 사용',
                     '목표는 정확히 4분기 후 공실률', '시도·상권·분기 중복 없음'],
          'limits': '현재 보관된 개정 데이터 기준. 최초 공표시점 자료가 아니므로 개정정보 누출 가능성은 배제하지 못함. 원도심 목록 정의도 기존 연구에서 승계.'}
(root/'local_web/data/data_provenance_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(report)
