# -*- coding: utf-8 -*-
"""
충장로 상권펀드 v2: 펀드 상품(페이백·정착금·생존지원금·출자율 인하) 동태 모델
================================================================================
기금 흐름 (해당 연도 집행, 연 단위)
  대상: 시작 시점 공실 공간만 약정에 편입. 입점 후 수납 임대료에서 출자.
  연초 임대 상태로 그 해 재원을 계산하고 입퇴점은 연말 반영.
  초기 민간 기부금이 0이면 첫해 출자·지원은 0, 자연 입점 후 다음 해부터 출자.
  유입  F_t = 초기 공실 참여면적 × 평균임대료 × 12 × 임대중비율_t × n_eff_t
        n_eff_t = n × 슬라이딩계수(공실률)   ← 건물주 페이백: 공실이 줄면 출자율이 내려감
  사용  ① 상권 페이백 포인트  : 참여 건물 입점 점포 결제액의 일부를 소비자에게 환급 → 매출↑
        ② 입점 정착금         : 신규 임차인 첫 해 월세 일부 지원 → 계약 임대료는 그대로, 실질 부담만↓
        ③ 생존 지원금         : 기존 임차인 위기 지원·리모델링 → 폐업률↓
        ④ 축제·이벤트         : 상권 전체 방문객↑
        ⑤ 실비 5%             : 결제수수료·외부감사 (유급 상근 인력 없음)
  정착금 예산이 남으면 같은 해 페이백으로 돌림(전액 소진).

반응 계수(eps_rent, eps_fill, lam_pb …)는 현재 가정값이고,
정책 인과효과를 학습한 값이 아닙니다. 시범사업으로 확인해야 합니다.
"""
from dataclasses import dataclass, asdict, replace
import numpy as np
import pandas as pd


@dataclass
class P2:
    # 상권
    n_buildings: int = 612
    avg_area_m2: float = 450.0
    rent_m2: float = 21_200.0        # 1층 30,300원/㎡(부동산원 2026Q2) × 층 평균 효용 70%(가정)
    vacancy0: float = 0.265          # 부동산원 2026Q2 금남로/충장로 중대형상가
    unit_area: float = 80.0          # 임대 1건 평균 면적(1층 점포~상층 사무실 혼합, 가정)
    # 펀드
    n_rate: float = 0.05
    participation: float = 0.50       # 시작 시점 공실 면적 중 약정 참여 비율
    annual_donation_eok: float = 0.0  # 실제 확보한 연간 민간 기부금, 억원. 약정 운영 중에만 투입
    years: int = 5
    target_vacancy: float = 0.15
    sliding: bool = True             # 공실 1%p 감소당 출자율 2% 인하(최저 0.6n)
    a_pb: float = 0.35               # 페이백 포인트
    a_st: float = 0.30               # 정착금
    a_sv: float = 0.10               # 생존 지원금
    a_fe: float = 0.20               # 축제
    a_ops: float = 0.05              # 실비
    settle_rate: float = 0.30        # 정착금: 월세의 30%
    settle_months: int = 6           #         6개월
    # 반응 (가정 → 모델로 교체)
    sales0_eok: float = 560.0
    sales_drift: float = 0.0      # 정책 시나리오 가정 (AI 예측과 별개)
    lam_pb: float = 2.0
    lam_fe: float = 1.0
    occ_feedback: float = 0.5
    exit0: float = 0.12
    eps_fill: float = 2.5
    eps_exit: float = 1.5
    eps_rent: float = 1.5            # 첫해 실질임대료 1% ↓ → 입점확률 +1.5%
    kappa_sv: float = 1.0            # 지원금/연임대료 10% → 폐업률 10% ↓
    horizon: int = 10

    @property
    def area(self):
        return self.n_buildings * self.avg_area_m2

    @property
    def fill0(self):
        return self.exit0 * (1 - self.vacancy0) / self.vacancy0


def slide(p, v):
    """건물주 페이백: 공실률이 1%p 줄 때마다 출자율 2%씩 인하 (최저 0.6n)"""
    if not p.sliding:
        return 1.0
    return float(min(1.0, max(0.6, 1 - 2 * (p.vacancy0 - v))))


def simulate(p: P2, fund_on=True):
    T = p.horizon
    # 고정 코호트: 시작 시 공실 중 참여(P), 비참여(N), 기존 임대(O).
    # 기존 임대 공간은 나중에 비더라도 자동으로 약정에 편입하지 않는다.
    sh = {"P": p.vacancy0 * p.participation,
          "N": p.vacancy0 * (1 - p.participation), "O": 1 - p.vacancy0}
    o0 = 1 - p.vacancy0
    occ = {"P": [0.0], "N": [0.0], "O": [1.0]}
    unit_rent = p.unit_area * p.rent_m2 * 12               # 점포 1곳 연 임대료(원)
    sr_eff = p.settle_rate * p.settle_months / 12          # 첫해 실질 임대료 할인율
    cost_settle = unit_rent * sr_eff                       # 정착금 1건(원)
    rec = {k: [] for k in ["vac", "vP", "vN", "vO", "fund", "n_eff", "settled", "pb", "st_used", "sv_per", "fe", "sales", "active"]}
    running = fund_on
    for t in range(T + 1):
        v = sum(sh[k] * (1 - occ[k][t]) for k in sh)
        if running and (t >= p.years or v <= p.target_vacancy):
            running = False
        ne = p.n_rate * slide(p, v) if running else 0.0
        F = p.area * sh["P"] * p.rent_m2 * 12 * occ["P"][t] * ne / 1e8 + p.annual_donation_eok if running else 0.0
        B = {k: F * getattr(p, "a_" + k) for k in ["pb", "st", "sv", "fe"]}

        def sales_idx(pb):
            # 신규 입점 수요는 상권 전체의 수요를 따른다. 공실 코호트의 현재
            # 매출이 0이라는 이유로 자연 입점 확률까지 0이 되지 않도록 구분한다.
            market = (1 + p.sales_drift) ** (t + 1) * ((1 - v) / o0) ** p.occ_feedback
            festival = B["fe"] * p.lam_fe / p.sales0_eok
            out, tot = {}, 0.0
            for k in sh:
                boost = pb * p.lam_pb if k == "P" and sh[k] > 0 else 0.0
                base = p.sales0_eok * sh[k]
                out[k] = max(1e-9, market + festival + (boost / base if base > 0 else 0.0))
                # 실제 매출은 임대 중 면적에서만 발생한다.
                organic = base * (1 + p.sales_drift) ** (t + 1) * occ[k][t] / o0
                organic *= ((1 - v) / o0) ** p.occ_feedback
                tot += organic + B["fe"] * p.lam_fe * sh[k] + boost
            return out, tot

        # 정착금 배정 → 남은 예산은 페이백으로
        idx, _ = sales_idx(B["pb"])
        fP = min(p.fill0 * idx["P"] ** p.eps_fill, 0.95)
        f_set = min(fP * (1 / (1 - sr_eff)) ** p.eps_rent, 0.95)
        VU = (1 - occ["P"][t]) * p.area * sh["P"] / p.unit_area
        demand = VU * f_set
        cap = B["st"] * 1e8 / cost_settle if cost_settle > 0 else 0.0
        phi = min(1.0, cap / demand) if demand > 0 else 0.0
        used = phi * demand * cost_settle / 1e8
        pb = B["pb"] + (B["st"] - used)
        idx, tot = sales_idx(pb)

        OU = occ["P"][t] * p.area * sh["P"] / p.unit_area
        sv_per = B["sv"] * 1e8 / OU if OU > 0 else 0.0

        for key, val in [("vac", v), ("vP", 1 - occ["P"][t]), ("vN", 1 - occ["N"][t]), ("vO", 1 - occ["O"][t]), ("fund", F), ("n_eff", ne),
                         ("settled", phi * demand), ("pb", pb), ("st_used", used), ("sv_per", sv_per),
                         ("fe", B["fe"]), ("sales", tot), ("active", running)]:
            rec[key].append(val)
        if t == T:
            break
        for k in sh:
            f = min(p.fill0 * idx[k] ** p.eps_fill, 0.95)
            e = min(p.exit0 * idx[k] ** (-p.eps_exit), 0.6)
            if k == "P" and running:
                f_s = min(f * (1 / (1 - sr_eff)) ** p.eps_rent, 0.95)
                f = f * (1 - phi) + f_s * phi
                e = e * (1 - min(0.5, p.kappa_sv * sv_per / unit_rent))
            occ[k].append(occ[k][t] - e * occ[k][t] + f * (1 - occ[k][t]))
    return pd.DataFrame(rec)


# ---------------- 건물주 (가로수길 방식: 월 순현금 = 임대수입 − 출자 − 이자 − 보유비) ----------------
@dataclass
class Bld:
    area_m2: float = 500.0
    std_vacancy: float = 0.10
    opex_ratio: float = 0.20
    cap_rate: float = 0.045
    ltv0: float = 0.60
    ltv_cov: float = 0.70
    interest: float = 0.045
    hold_cost: float = 0.004      # 재산세·관리 등 보유비 (가치 대비 연)


def appraisal(b: Bld, rent_m2, rent_factor=1.0, opex_extra=0.0):
    g = b.area_m2 * rent_m2 * 12 * (1 - b.std_vacancy)
    return (g * rent_factor * (1 - b.opex_ratio) - g * opex_extra) / b.cap_rate


def landlord(p: P2, base: pd.DataFrame, fund: pd.DataFrame, b: Bld = Bld(), years=5):
    v0 = appraisal(b, p.rent_m2)
    loan = v0 * b.ltv0
    fixed = loan * b.interest + v0 * b.hold_cost              # 연 이자 + 보유비 (원)
    full = b.area_m2 * p.rent_m2 * 12
    # 같은 초기 공실 공간을 비교한다. 월세 인하의 입점 반응도 가정값이다.
    occB = [0.0]
    for t in range(years - 1):
        idx = max(1e-9, (1 + p.sales_drift) ** (t + 1) *
                  ((1 - base["vac"].values[t]) / (1 - p.vacancy0)) ** p.occ_feedback)
        fill = min(p.fill0 * idx ** p.eps_fill * (1 / .7) ** p.eps_rent, .95)
        leave = min(p.exit0 * idx ** (-p.eps_exit), .6)
        occB.append(occB[-1] * (1 - leave) + (1 - occB[-1]) * fill)
    rows = []
    for name, occ, rf, ne, vf in [
        ("A 현상유지 (펀드 없음)", 1 - base["vP"].values[:years], 1.0, np.zeros(years), 1.0),
        ("A′ 비참여 (펀드 있음)", 1 - fund["vN"].values[:years], 1.0, np.zeros(years), 1.0),
        ("B 임대료 30% 인하", np.array(occB), 0.7, np.zeros(years), 0.7),
        ("C 펀드 참여", 1 - fund["vP"].values[:years], 1.0, fund["n_eff"].values[:years], 1.0),
    ]:
        gross = full * rf * occ
        contrib = gross * ne
        net = gross - contrib - fixed
        v = appraisal(b, p.rent_m2, vf)
        rows.append({"name": name, "net5_eok": net.sum() / 1e8, "month1_man": net[0] / 12 / 1e4,
                     "contrib5_eok": contrib.sum() / 1e8, "ltv": loan / v,
                     "repay_eok": max(0.0, loan - b.ltv_cov * v) / 1e8})
    return pd.DataFrame(rows)


def stakeholder(p: P2, base, fund):
    """세입자·소비자·건물주·상권 지표"""
    act = fund["active"].values
    yrs = int(act.sum())
    unit_rent = p.unit_area * p.rent_m2 * 12
    sr_eff = p.settle_rate * p.settle_months / 12
    cost = unit_rent * sr_eff
    n_avg = float(fund["n_eff"].values[:max(yrs, 1)].mean()) if yrs else p.n_rate
    payback_years = cost / (unit_rent * n_avg) if n_avg > 0 else float("inf")
    stores_gain = (base["vac"].values[5] - fund["vac"].values[5]) * p.area / p.unit_area
    cum = float(fund["fund"].values[:yrs].sum()) if yrs else 0.0
    positive = fund["fund"].values[:yrs]
    positive = positive[positive > 0]
    growth = float(positive[-1] / positive[0] - 1) if len(positive) > 1 else 0.0
    return {
        "participating_area": p.area * p.vacancy0 * p.participation,
        "initial_vacant_area": p.area * p.vacancy0,
        "years_active": yrs,
        "fund_y1": float(fund["fund"].values[0]),
        "fund_cum": cum,
        "fund_growth": growth,
        "growth_reference": "최초 기금 유입 연도 대비 마지막 기금 유입 연도",
        "settled_total": float(fund["settled"].values[:yrs].sum()),
        "settle_per_tenant_man": cost / 1e4,
        "first_year_rent_cut": sr_eff,
        "settle_payback_years": payback_years,
        "sv_per_store_man": float(fund["sv_per"].values[:max(yrs, 1)].mean()) / 1e4,
        "payback_cum_eok": float(fund["pb"].values[:yrs].sum()),
        "vac5_base": float(base["vac"].values[5]), "vac5_fund": float(fund["vac"].values[5]),
        "stores_gain_y5": stores_gain,
        "stores_per_eok": stores_gain / cum if cum else 0.0,
    }


UNCERTAIN = {"lam_pb": (1.0, 3.0), "lam_fe": (0.5, 1.5), "eps_fill": (1.5, 3.5), "eps_exit": (0.8, 2.0),
             "exit0": (0.10, 0.15), "occ_feedback": (0.3, 0.8),
             "eps_rent": (0.5, 2.5), "kappa_sv": (0.5, 1.5)}


def monte_carlo(p: P2, n=3000, seed=7):
    rng = np.random.default_rng(seed)
    D = {k: rng.uniform(a, b, n) for k, (a, b) in UNCERTAIN.items()}
    vb, vf, cum, gap, grow = [], [], [], [], []
    for i in range(n):
        q = replace(p, **{k: float(D[k][i]) for k in UNCERTAIN})
        b, f = simulate(q, False), simulate(q, True)
        vb.append(b["vac"].values); vf.append(f["vac"].values)
        s = stakeholder(q, b, f)
        cum.append(s["fund_cum"]); gap.append(s["vac5_base"] - s["vac5_fund"]); grow.append(s["fund_growth"])
    vb, vf = np.array(vb), np.array(vf)
    X = pd.DataFrame(D); y = np.array(gap)
    Xs = (X - X.mean()) / X.std(); ys = (y - y.mean()) / y.std()
    beta = np.linalg.lstsq(np.c_[np.ones(n), Xs.values], ys, rcond=None)[0][1:]
    pc = lambda a, q: np.percentile(a, q, axis=0).round(4).tolist()
    return {"year": list(range(p.horizon + 1)),
            "base_p10": pc(vb, 10), "base_p50": pc(vb, 50), "base_p90": pc(vb, 90),
            "fund_p10": pc(vf, 10), "fund_p50": pc(vf, 50), "fund_p90": pc(vf, 90),
            "cum": {q: float(np.percentile(cum, q)) for q in (10, 50, 90)},
            "gap": {q: float(np.percentile(gap, q)) for q in (10, 50, 90)},
            "grow": {q: float(np.percentile(grow, q)) for q in (10, 50, 90)},
            "prob_gap_pos": float((np.array(gap) > 0).mean()),
            "prob_grow_pos": float((np.array(grow) > 0).mean()),
            "importance": dict(sorted(zip(X.columns, beta.round(3)), key=lambda kv: -abs(kv[1])))}


