"""민간 기금의 기본 경로·정책 경로·이해관계자 결과를 한 묶음으로 계산."""
from dataclasses import fields
import math
from .fund_model import P2, simulate, stakeholder, landlord

def calculate(raw):
    allowed={f.name for f in fields(P2)}
    if set(raw)-allowed: raise ValueError('지원하지 않는 기금 입력입니다. 정부 매칭은 허용하지 않습니다.')
    for k,v in raw.items():
        if not isinstance(v,(int,float,bool)) or not math.isfinite(v): raise ValueError('기금 입력은 유한한 숫자여야 합니다.')
    p=P2(**raw)
    if not (1 <= p.n_buildings <= 100000 and int(p.n_buildings) == p.n_buildings):
        raise ValueError('건물 수는 1~100000 사이의 정수여야 합니다.')
    if not 0<=p.annual_donation_eok<=1000: raise ValueError('민간 기부금은 연 0~1000억원 범위로 입력하세요.')
    if not (0.001<=p.vacancy0<=.9 and .01<=p.participation<=1 and .01<=p.n_rate<=.5 and
            1<=p.years<=20 and int(p.years)==p.years and
            max(10,p.years)<=p.horizon<=30 and int(p.horizon)==p.horizon and
            0<=p.target_vacancy<=.5 and 50<=p.avg_area_m2<=3000 and 5000<=p.rent_m2<=100000 and
            0<=p.settle_rate<=.9 and 1<=p.settle_months<=12 and int(p.settle_months)==p.settle_months and
            0<=p.settle_rate*p.settle_months/12<1 and -.2<=p.sales_drift<=.2 and
            0<=p.eps_rent<=5 and 0<=p.lam_pb<=10):
        raise ValueError('기금 입력 범위를 확인하세요.')
    allocations=[p.a_pb,p.a_st,p.a_sv,p.a_fe,p.a_ops]
    if min(allocations)<0 or abs(sum(allocations)-1)>1e-6: raise ValueError('배분 합계는 100%여야 합니다.')
    b,f=simulate(p,False),simulate(p,True)
    ll=landlord(p,b,f).rename(columns={'net5_eok':'net5','month1_man':'month1','contrib5_eok':'contrib5','repay_eok':'repay'})
    return dict(base=b.to_dict('list'),fund=f.to_dict('list'),stakeholder=stakeholder(p,b,f),landlord=ll.to_dict('records'))
