"""Python 회귀 학습. valid로 선택하고 test는 선택 후 한 번 평가한다."""
import re
import uuid
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.inspection import permutation_importance
from .data import load, split

SESSIONS = {}

def metrics(y, p):
    return dict(MAE=float(mean_absolute_error(y,p)), RMSE=float(mean_squared_error(y,p)**.5), R2=float(r2_score(y,p)))

def values(rows):
    a=np.array([r[3:] for r in rows],dtype=float)
    return a[:,:4],a[:,4]

def forecast(model,x):
    return np.clip(x[:,0]+model.predict(x),0,100)

def train(settings):
    rounds=int(settings.get('rounds',250)); depth=int(settings.get('depth',3)); lr=float(settings.get('lr',.04))
    if not 50<=rounds<=500 or not 1<=depth<=5 or not .01<=lr<=.2:
        raise ValueError('학습 설정 범위를 확인하세요.')
    data=load('ml.json'); parts=split(data)
    x,y=values(parts['train']); vx,vy=values(parts['valid'])
    # 표준화는 train에만 fit한다. 목표는 1년 변화폭이다.
    candidates=[('선형회귀',make_pipeline(StandardScaler(),LinearRegression())),
      ('릿지',make_pipeline(StandardScaler(),Ridge(alpha=10))),
      ('랜덤포레스트',RandomForestRegressor(n_estimators=80,max_depth=6,min_samples_leaf=15,max_features=2,random_state=731,n_jobs=1)),
      # Extra Trees는 전체 train 표본에서 피처와 분할 임계값을 무작위로 고른다.
      # 나무의 잎은 정답 변화폭의 평균, 숲의 답은 80개 나무 예측의 평균이다.
      ('Extra Trees',ExtraTreesRegressor(n_estimators=80,max_depth=6,min_samples_leaf=15,max_features=2,bootstrap=False,random_state=919,n_jobs=1)),
      ('부스팅',GradientBoostingRegressor(n_estimators=rounds,learning_rate=lr,max_depth=depth,min_samples_leaf=40,random_state=42))]
    rows=[]
    for name,model in candidates:
        model.fit(x,y-x[:,0]); rows.append(dict(model=name,**metrics(vy,forecast(model,vx))))
    chosen=min(range(len(rows)),key=lambda i:rows[i]['MAE'])
    model=candidates[chosen][1]
    # 중요도는 선택 후 설명용. valid에서 피처를 섞고 공실률 오차 증가를 측정한다.
    scorer=lambda estimator,xx,yy:-mean_absolute_error(yy,forecast(estimator,xx))
    imp=permutation_importance(model,vx,vy,scoring=scorer,n_repeats=3,random_state=31)
    token=uuid.uuid4().hex
    if len(SESSIONS)>=16:
        SESSIONS.pop(next(iter(SESSIONS)))
    SESSIONS[token]=dict(models=candidates,chosen=chosen,rows=rows,parts=parts,
       residual=vy-forecast(model,vx),tested=False,x=x)
    return dict(token=token,chosen=candidates[chosen][0],models=rows,importance=imp.importances_mean.tolist(),counts={k:len(v) for k,v in parts.items()})

def session(token):
    if token not in SESSIONS: raise ValueError('서버가 재시작되었거나 학습이 만료됐습니다. 다시 학습하세요.')
    return SESSIONS[token]

def evaluate(token):
    s=session(token)
    if 'evaluation' in s: return s['evaluation']
    x,y=values(s['parts']['test'])
    rows=[dict(model=n,**metrics(y,forecast(m,x))) for n,m in s['models']]
    s['tested']=True
    s['evaluation']=dict(models=rows,selected=rows[s['chosen']],baseline=dict(model='현재값 유지', **metrics(y,x[:,0])),linear_baseline=rows[0],
        improvement_pct=(metrics(y,x[:,0])['MAE']-rows[s['chosen']]['MAE'])/metrics(y,x[:,0])['MAE']*100,
        change_r2=float(r2_score(y-x[:,0],forecast(s['models'][s['chosen']][1],x)-x[:,0])),n=len(y),y=y.tolist(),pred=forecast(s['models'][s['chosen']][1],x).tolist())
    return s['evaluation']

def predict(payload):
    s=session(payload['token'])
    if not s['tested']: raise ValueError('먼저 test 평가를 완료하세요.')
    x=np.asarray(payload['x'],dtype=float)
    q=payload['quarter']
    if x.shape!=(4,) or not np.isfinite(x).all(): raise ValueError('유효한 피처 네 개를 입력하세요.')
    if not re.fullmatch(r'\d{4}Q[1-4]',q) or q<'2026Q2': raise ValueError('기준분기는 2026Q2 이후여야 합니다.')
    if not (0<=x[0]<=100 and 0<=x[0]-x[1]<=100 and x[2]>-100 and x[3] in (0,1)):
        raise ValueError('공실률 0~100%, 지수 변화 -100% 초과, 원도심 0/1을 확인하세요.')
    preds=[float(forecast(m,x[None,:])[0]) for _,m in s['models']]
    point=preds[s['chosen']]; lo,hi=np.clip(point+np.quantile(s['residual'],[.1,.9]),0,100)
    return dict(point=point,lo=float(lo),hi=float(hi),predictions=preds,
      target=str(int(q[:4])+1)+q[4:],outside=bool(((x<s['x'].min(axis=0))|(x>s['x'].max(axis=0))).any()))
