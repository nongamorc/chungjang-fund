"""실제 Python 학습·기금 계산·입력 검증을 확인하고 현재 결과를 저장한다."""
import json
from dataclasses import asdict
import numpy as np
from services import data, prediction, fund
from services.fund_model import P2

def rejected(fn):
    try: fn()
    except ValueError: return
    raise AssertionError('잘못된 입력을 거부하지 않음')

parts=data.split(data.load('ml.json'))
assert [len(parts[k]) for k in ['train','valid','test']]==[2806,920,956]
assert max(r[1] for r in parts['train'])=='2021Q2'
assert min(r[1] for r in parts['valid'])=='2022Q3'
assert max(r[1] for r in parts['valid'])=='2023Q2'
assert min(r[1] for r in parts['test'])=='2024Q3'
t=prediction.train({});s=prediction.session(t['token']);chosen=s['chosen']
rejected(lambda:prediction.predict(dict(token=t['token'],x=[26.5,1.2,-1.02,1],quarter='2026Q2')))
evaluation=prediction.evaluate(t['token'])
assert chosen==s['chosen']
x_test,y_test=prediction.values(parts['test'])
assert evaluation['baseline']['model']=='현재값 유지'
assert abs(evaluation['baseline']['MAE']-np.mean(np.abs(y_test-x_test[:,0])))<1e-12
assert abs(evaluation['baseline']['MAE']-2.7685146443514643)<1e-9
assert abs(evaluation['improvement_pct']-0.66004)<0.001
assert evaluation['linear_baseline']['model']=='선형회귀'
assert evaluation['change_r2']<0

row=next(r for r in data.load('ml.json')['latest'] if r['area']==data.load('ml.json')['target_area'])
pred=prediction.predict(dict(token=t['token'],x=row['x'],quarter=row['quarter']))
rejected(lambda:prediction.predict(dict(token=t['token'],x=[101,0,0,1],quarter='2026Q2')))
rejected(lambda:prediction.predict(dict(token=t['token'],x=row['x'],quarter='2020Q2')))
# test 정답을 변조해도 train/valid 학습과 선택은 바뀌지 않는다.
original=prediction.load
def perturbed(name):
    obj=original(name)
    for r in obj['rows']:
        if '2024Q3'<=r[1]<='2025Q2': r[7]+=20
    return obj
prediction.load=perturbed
t2=prediction.train({});prediction.load=original
assert t['chosen']==t2['chosen'] and t['models']==t2['models']
metrics=prediction.metrics([10,20,30],[12,18,31]);assert abs(metrics['R2']-.955)<1e-12
p=asdict(P2());f=fund.calculate(p)
# 시작 시 대상은 빈 점포이므로 임대수입에 따른 출자는 아직 없다.
assert f['fund']['fund'][0]==0
assert any(v>0 for v in f['fund']['fund'][1:p['years']])
don=fund.calculate({**p,'annual_donation_eok':1})
assert abs(don['fund']['fund'][0]-f['fund']['fund'][0]-1)<1e-10
assert don['base']==f['base']
assert all(v==0 for v in don['fund']['fund'][p['years']:])
rejected(lambda:fund.calculate({**p,'match_ratio':.5}))
rejected(lambda:fund.calculate({**p,'annual_donation_eok':-1}))
report=dict(passed=True,checks=['현재값 유지 기준 및 0.66% 개선 재현','시간 분할','test 이전 예측 차단','test 정답 변조 독립성','공실률 R² 계산','공공 매칭 거부','민간 기부금 유입·종료','잘못된 입력 거부'],
 implementation='Python scikit-learn',train=t, test={k:v for k,v in evaluation.items() if k not in ['y','pred']},prediction=pred)
report['train'].pop('token')
(data.ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'selected':t['chosen'],'test':evaluation['selected'],'prediction':pred['point']},ensure_ascii=False))
