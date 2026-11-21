# 과거 탐색분석 재현 및 원도심 목록 출처. 현재 학습은 local_web/services/prediction.py를 사용합니다.
# 이 파일의 2분할/노트북 결과는 현재 독립 test 성능으로 사용하지 않습니다.
# -*- coding: utf-8 -*-
"""
한국부동산원 상업용부동산 임대동향(상권별, 2013Q1~2026Q2) 실데이터 분석
 1) 탐색: 금남로/충장로의 전국 내 위치, 추세
 2) 가설 검정 H1~H5 (분기 고정효과, 상권 군집 표준오차)
 3) 피처 선정: p<0.05 ∩ 순열중요도>0 ∩ VIF<10
 4) 모델: 직전값 / 릿지 / 랜덤포레스트 / 그래디언트부스팅, 시간순 검증 (학습 ~2024Q2 기준시점, 검증 2024Q3~)
 5) 금남로/충장로 4분기 후 예측 (분위 회귀 10·50·90)
 6) 시뮬레이터 계수: 임대료 프리미엄 → 공실 반응
출력: out/rone_analysis.json, out/ml_data.json(브라우저 학습용)
"""
import json, re, warnings
from pathlib import Path
Path("out").mkdir(exist_ok=True)
import numpy as np, pandas as pd
import statsmodels.formula.api as smf
import statsmodels.api as sm
from scipy import stats
warnings.filterwarnings("ignore")

OLD = ["금남로/충장로", "동성로", "동성로중심", "동성로외곽", "남포동", "신포동", "청주성안길", "대전원도심", "원도심", "춘천명동", "경주도심",
       "포항중앙", "포항원도심", "포항도심", "진주중앙시장", "제천중앙", "충주자유시장", "팔달문로터리", "군산구도심", "군산원도심", "목포구도심",
       "순천원도심", "여수원도심", "안동구도심", "양산구도심", "밀양원도심/삼문동", "하남원도심", "서귀포도심", "나주구시가지", "성남구시가지",
       "광주시가지", "중구시장", "서문시장/청라언덕", "마산동서동", "창원시 마산 동서동", "강릉중부", "원주중앙/일산", "정읍중심", "영주중앙",
       "전주동부", "삼척중앙시장", "속초중앙시장", "태백중앙시장", "김제시장", "예산시장", "안성시장", "용문/한민시장"]
TGT = "금남로/충장로"

p = pd.read_csv("data/panel.csv")
p["qp"] = pd.PeriodIndex(p["quarter"], freq="Q")
p = p.sort_values(["area", "qp"]).reset_index(drop=True)
g = p.groupby("area")
p["vac"] = p["vac_mid"]
p["rent_prem"] = p["rent_mid"] / p["sido_rent"] - 1
p["d_rent4"] = g["rentidx"].pct_change(4) * 100
p["d_rent1"] = g["rentidx"].pct_change(1) * 100
p["vac_l1"] = g["vac"].shift(1)
p["d_vac4"] = p["vac"] - g["vac"].shift(4)
p["vac_f4"] = g["vac"].shift(-4)
p["dvac_f4"] = p["vac_f4"] - p["vac"]
p["old_dt"] = p["area"].isin(OLD).astype(int)
p["q"] = p["quarter"]
# 연속성: 분기 간격이 1이 아닌 경우(표본 개편으로 끊긴 상권) 차분값 제거
gap = g["qp"].diff().apply(lambda x: x.n if pd.notna(x) else np.nan)
p.loc[gap != 1, ["vac_l1", "d_rent1"]] = np.nan

R = {"data": {"rows": int(len(p)), "areas": int(p["area"].nunique()), "from": p["quarter"].min(), "to": p["quarter"].max(),
              "old_areas": int(p.loc[p.old_dt == 1, "area"].nunique()),
              "source": "한국부동산원 R-ONE 상업용부동산 임대동향조사 (지역별 공실률·임대료·수익률·임대가격지수, 중대형/소규모 상가)"}}

# ---------------------------------------------------------------- 1. 탐색
last = p[p.quarter == p.quarter.max()].dropna(subset=["vac"])
t = last[last.area == TGT].iloc[0]
R["eda"] = {
    "asof": p.quarter.max(), "n_last": int(len(last)),
    "tgt_vac": float(t.vac), "tgt_rank": int((last.vac > t.vac).sum() + 1), "tgt_pct": float((last.vac < t.vac).mean()),
    "nat_median": float(last.vac.median()), "gj_avg": float(t.sido_vac),
    "tgt_rent": float(t.rent_mid), "gj_rent": float(t.sido_rent), "tgt_prem": float(t.rent_prem),
    "tgt_small": float(t.vac_small), "tgt_capret": float(t.cap_ret), "tgt_incret": float(t.inc_ret),
}
ts = p[p.area == TGT][["quarter", "vac", "vac_small", "rentidx", "cap_ret", "inc_ret", "sido_vac"]]
nat = p.groupby("quarter")["vac"].median().rename("nat_med")
ts = ts.merge(nat, on="quarter")
R["eda"]["series"] = {c: [None if pd.isna(v) else round(float(v), 2) for v in ts[c]] for c in ts.columns if c != "quarter"}
R["eda"]["series"]["quarter"] = ts["quarter"].tolist()
first = ts.iloc[0]; lastr = ts.iloc[-1]
R["eda"]["change"] = {"vac_from": float(first.vac), "vac_to": float(lastr.vac), "ri_from": float(first.rentidx), "ri_to": float(lastr.rentidx)}
R["eda"]["dist"] = [round(float(v), 1) for v in last["vac"].tolist()]
# 상위 공실 상권
top = last.sort_values("vac", ascending=False).head(12)[["sido", "area", "vac", "rent_prem", "old_dt"]]
R["eda"]["top"] = top.round(3).to_dict("records")
cor = p[["vac", "vac_small", "rent_prem", "d_rent4", "inc_ret", "cap_ret", "dvac_f4"]].corr().round(2)
R["eda"]["corr"] = {"cols": cor.columns.tolist(), "m": cor.values.tolist()}

# ---------------------------------------------------------------- 2. 가설 검정
def fit(formula, d):
    cols = [c for c in re.findall(r"[A-Za-z_][A-Za-z_0-9]*", formula) if c in d.columns]
    d = d.dropna(subset=cols)
    m = smf.ols(formula, d).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(d["area"])[0]})
    return m, len(d), d["area"].nunique()

H = {}
# H1 임대료 하방경직성
d = p.copy(); d["up"] = d["d_vac4"].clip(lower=0); d["down"] = d["d_vac4"].clip(upper=0)
m, n, na = fit("d_rent4 ~ up + down + C(q)", d)
w = m.wald_test("up = down", scalar=True)
sub = d.dropna(subset=["d_vac4", "d_rent4"])
rose = sub[sub.d_vac4 >= 3]
H["H1"] = {"title": "임대료 하방경직성", "q": "공실이 늘어도 임대료는 덜 내려가는가",
           "method": "Δ임대가격지수(4분기, %) = β₊·공실 상승폭 + β₋·공실 하락폭 + 분기 고정효과",
           "n": n, "areas": na, "b_up": m.params["up"], "p_up": m.pvalues["up"], "b_down": m.params["down"], "p_down": m.pvalues["down"],
           "wald_p": float(w.pvalue),
           "share_no_cut": float((rose.d_rent4 > -1).mean()), "n_rose": int(len(rose)),
           "supported": bool(abs(m.params["up"]) < abs(m.params["down"]) or (rose.d_rent4 > -1).mean() > 0.5)}
# H2 고임대료 → 이후 공실 증가
m, n, na = fit("dvac_f4 ~ rent_prem + vac + C(q) + C(sido)", p)
m2, n2, _ = fit("dvac_f4 ~ rent_prem + vac + C(q) + C(area)", p)
H["H2"] = {"title": "고임대료가 이후 공실을 키운다", "q": "같은 시도 평균보다 임대료가 비싼 상권은 1년 뒤 공실이 더 늘어나는가",
           "method": "4분기 후 공실 변화(%p) = β·임대료 프리미엄 + 현재 공실 + 분기·시도 고정효과",
           "n": n, "areas": na, "b": m.params["rent_prem"], "p": m.pvalues["rent_prem"], "ci": m.conf_int().loc["rent_prem"].tolist(),
           "b_fe": m2.params["rent_prem"], "p_fe": m2.pvalues["rent_prem"],
           "supported": bool(m.pvalues["rent_prem"] < 0.05 and m.params["rent_prem"] > 0)}
# H3 임대료 → 자본가치
m, n, na = fit("cap_ret ~ d_rent1 + inc_ret + C(q)", p)
H["H3"] = {"title": "임대료가 자산가치를 움직인다", "q": "임대가격지수가 1% 내리면 같은 분기 자본수익률(가치 변화)도 내려가는가",
           "method": "자본수익률(%) = β·Δ임대가격지수(1분기, %) + 소득수익률 + 분기 고정효과",
           "n": n, "areas": na, "b": m.params["d_rent1"], "p": m.pvalues["d_rent1"], "ci": m.conf_int().loc["d_rent1"].tolist(),
           "supported": bool(m.pvalues["d_rent1"] < 0.05 and m.params["d_rent1"] > 0)}
p["cap4"] = p.groupby("area")["cap_ret"].transform(lambda s: s.rolling(4).sum())
p["cap_f4"] = p.groupby("area")["cap4"].shift(-4)
mb, nb, _ = fit("cap4 ~ d_vac4 + d_rent4 + C(q)", p)
mc, nc, _ = fit("cap_f4 ~ vac + C(q)", p)
H["H3"].update({"b_rent4": mb.params["d_rent4"], "p_rent4": mb.pvalues["d_rent4"], "b_vac4": mb.params["d_vac4"], "p_vac4": mb.pvalues["d_vac4"], "n_b": nb,
                "b_vac_future": mc.params["vac"], "p_vac_future": mc.pvalues["vac"], "n_c": nc})
# H4 원도심 구조적 공실
rec = p[p.qp >= p.qp.max() - 7].groupby("area").agg(v=("vac", "mean"), old=("old_dt", "max")).dropna()
pre = p[(p.quarter >= "2018Q1") & (p.quarter <= "2019Q4")].groupby("area")["vac"].mean()
rec["chg"] = rec["v"] - pre.reindex(rec.index)
a, b = rec.loc[rec.old == 1, "v"], rec.loc[rec.old == 0, "v"]
tt = stats.ttest_ind(a, b, equal_var=False); mw = stats.mannwhitneyu(a, b, alternative="greater")
ca, cb = rec.loc[rec.old == 1, "chg"].dropna(), rec.loc[rec.old == 0, "chg"].dropna()
tc = stats.ttest_ind(ca, cb, equal_var=False)
H["H4"] = {"title": "원도심 공실은 구조적으로 높다", "q": "원도심 상권의 최근 2년 평균 공실률이 다른 상권보다 높은가",
           "method": "원도심 47곳 지정, 최근 8분기 평균 공실률 비교 (Welch t-검정, Mann-Whitney U)",
           "n_old": int(len(a)), "n_other": int(len(b)), "mean_old": a.mean(), "mean_other": b.mean(), "t_p": float(tt.pvalue), "mw_p": float(mw.pvalue),
           "chg_old": ca.mean(), "chg_other": cb.mean(), "chg_p": float(tc.pvalue),
           "supported": bool(mw.pvalue < 0.05 and a.mean() > b.mean())}
# H5 지속성
m, n, na = fit("vac ~ vac_l1 + C(q)", p)
rho = float(m.params["vac_l1"])
mo, _, _ = fit("vac ~ vac_l1 + C(q)", p[p.old_dt == 1])
H["H5"] = {"title": "공실은 스스로 회복되지 않는다", "q": "한 번 오른 공실률이 다음 분기에도 얼마나 남는가",
           "method": "공실률(t) = ρ·공실률(t−1) + 분기 고정효과, 반감기 = ln0.5/lnρ",
           "n": n, "areas": na, "rho": rho, "p": m.pvalues["vac_l1"], "half_life_q": float(np.log(0.5) / np.log(rho)),
           "rho_old": float(mo.params["vac_l1"]), "half_life_old": float(np.log(0.5) / np.log(mo.params["vac_l1"])),
           "supported": bool(rho > 0.8)}
R["tests"] = H

# ---------------------------------------------------------------- 3~5. 피처 선정 · 모델
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor, GradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from statsmodels.stats.outliers_influence import variance_inflation_factor

CANDS = ["vac", "d_vac4", "vac_small", "rent_prem", "d_rent4", "inc_ret", "cap_ret", "old_dt"]
LABEL = {"vac": "현재 공실률", "d_vac4": "1년간 공실 변화", "vac_small": "소규모상가 공실률", "rent_prem": "시도 대비 임대료 프리미엄",
         "d_rent4": "1년간 임대가격지수 변화", "inc_ret": "소득수익률", "cap_ret": "자본수익률", "old_dt": "원도심 여부"}
d = p.dropna(subset=CANDS + ["vac_f4"]).copy()
cut = pd.Period("2024Q2", "Q")      # 기준시점 ~2024Q2 학습(목표 ~2025Q2), 2024Q3~ 검증(목표 2025Q3~2026Q2)
tr, te = d[d.qp <= cut - 4], d[d.qp > cut]    # 학습 목표값이 검증 기간과 겹치지 않도록 4분기 간격
X = sm.add_constant(tr[CANDS])
ols = sm.OLS(tr["vac_f4"], X).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(tr["area"])[0]})
Z = tr[CANDS].values
vif = {c: float(variance_inflation_factor(np.c_[np.ones(len(Z)), Z], i + 1)) for i, c in enumerate(CANDS)}
gb0 = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, random_state=0).fit(tr[CANDS], tr["vac_f4"])
pi = permutation_importance(gb0, te[CANDS], te["vac_f4"], n_repeats=15, random_state=0)
ftab = []
for i, c in enumerate(CANDS):
    sel = bool(ols.pvalues[c] < 0.05 and pi.importances_mean[i] > 0 and vif[c] < 10)
    ftab.append({"f": c, "label": LABEL[c], "coef": float(ols.params[c]), "p": float(ols.pvalues[c]), "vif": vif[c],
                 "perm": float(pi.importances_mean[i]), "sel": sel})
FEATS = [r["f"] for r in ftab if r["sel"]]
if "vac" not in FEATS:
    FEATS = ["vac"] + FEATS

def sc(y, yh):
    e = y - yh
    return {"MAE": float(np.mean(np.abs(e))), "RMSE": float(np.sqrt(np.mean(e ** 2))), "R2": float(1 - np.sum(e ** 2) / np.sum((y - y.mean()) ** 2))}

models = {"직전값 유지(기준선)": None, "릿지 회귀": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
          "랜덤포레스트": RandomForestRegressor(n_estimators=400, min_samples_leaf=20, random_state=0, n_jobs=-1),
          "그래디언트 부스팅": HistGradientBoostingRegressor(max_iter=300, learning_rate=0.03, max_leaf_nodes=8, min_samples_leaf=40, l2_regularization=1.0, random_state=0)}
res, fitted = [], {}
for nm, mdl in models.items():
    if mdl is None:
        yh = te["vac"].values
    elif nm == "릿지 회귀":
        mdl.fit(tr[FEATS], tr["vac_f4"]); yh = mdl.predict(te[FEATS]); fitted[nm] = mdl
    else:   # 트리 모델은 '변화량'을 학습해 현재 공실률에 더함
        mdl.fit(tr[FEATS], tr["dvac_f4"]); yh = te["vac"].values + mdl.predict(te[FEATS]); fitted[nm] = mdl
    res.append({"model": nm, **sc(te["vac_f4"].values, yh)})
for r in res:
    r["gain"] = 1 - r["MAE"] / res[0]["MAE"]
best = min(res[1:], key=lambda r: r["MAE"])
bm = fitted[best["model"]]
class _Wrap:
    def __init__(s, m, delta): s.m, s.delta = m, delta
    def fit(s, X, y): return s
    def predict(s, X): return (X["vac"].values + s.m.predict(X)) if s.delta else s.m.predict(X)
bw = _Wrap(bm, best["model"] != "릿지 회귀")
from sklearn.metrics import mean_absolute_error
def _perm(model, X, y, reps=15, seed=0):
    rng = np.random.default_rng(seed); base = mean_absolute_error(y, model.predict(X)); out = []
    for c in X.columns:
        inc = []
        for _ in range(reps):
            X2 = X.copy(); X2[c] = rng.permutation(X2[c].values); inc.append(mean_absolute_error(y, model.predict(X2)) - base)
        out.append(float(np.mean(inc)))
    return out
class _PI: pass
pi2 = _PI(); pi2.importances_mean = _perm(bw, te[FEATS], te["vac_f4"])
imp = sorted([{"f": f, "label": LABEL[f], "imp": float(v)} for f, v in zip(FEATS, pi2.importances_mean)], key=lambda r: -r["imp"])

# 부분의존: 임대료 프리미엄
pdp = None
if "rent_prem" in FEATS:
    grid = np.round(np.linspace(-0.3, 0.6, 10), 3)
    vals = []
    for gv in grid:
        X2 = te[FEATS].copy(); X2["rent_prem"] = gv; vals.append(float(bw.predict(X2).mean()))
    pdp = {"grid": grid.tolist(), "y": vals, "slope": float(np.polyfit(grid, vals, 1)[0])}

# 금남로/충장로 예측
full = p.dropna(subset=FEATS)
now = full[(full.area == TGT)].sort_values("qp").iloc[-1]
alld = d  # 전체 기간으로 분위 모델 학습
qpred = {}
for a_ in (0.1, 0.5, 0.9):
    qm = GradientBoostingRegressor(loss="quantile", alpha=a_, n_estimators=300, max_depth=3, learning_rate=0.05, random_state=0)
    qm.fit(alld[FEATS], alld["vac_f4"]); qpred[str(a_)] = float(qm.predict(now[FEATS].to_frame().T.astype(float))[0])
xnow = now[FEATS].to_frame().T.astype(float)
if best["model"] == "릿지 회귀":
    point = float(make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(alld[FEATS], alld["vac_f4"]).predict(xnow)[0])
else:
    point = float(now["vac"] + type(bm)(**bm.get_params()).fit(alld[FEATS], alld["dvac_f4"]).predict(xnow)[0])
bm_full = None
# 시나리오: 실질 임대료 부담 15% 인하(정착금 효과) → 프리미엄 하락
scen = None
if "rent_prem" in FEATS:
    x2 = now[FEATS].to_frame().T.astype(float).copy()
    base_p = float(x2["rent_prem"].iloc[0])
    x2["rent_prem"] = (1 + base_p) * 0.85 - 1
    scen = {"prem_now": base_p, "prem_after": float(x2["rent_prem"].iloc[0]), "pred_now": point}

# 검증 산점도·시계열 (충장로 검증 구간 실제 vs 예측)
te2 = te.assign(pred=bw.predict(te[FEATS]))
err = te2["vac_f4"] - te2["pred"]
sample = te2.sample(min(500, len(te2)), random_state=1)[["vac_f4", "pred"]].round(2)
R["ml"] = {"target": "4분기 후 중대형상가 공실률(%)", "n_train": int(len(tr)), "n_test": int(len(te)),
           "split": f"기준시점 {tr.quarter.min()}~{tr.quarter.max()} 학습 · {te.quarter.min()}~{te.quarter.max()} 검증",
           "features_table": ftab, "features": FEATS, "models": res, "best": best["model"], "importance": imp, "pdp": pdp,
           "forecast": {"asof": now.quarter, "now": float(now.vac), "target_q": str(now.qp + 4), "point": point, "q": qpred,
                        "pi80": [point + float(err.quantile(0.1)), point + float(err.quantile(0.9))]},
           "scenario": scen, "scatter": {"y": sample.vac_f4.tolist(), "p": sample.pred.tolist()}}

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
dd = d.copy(); dd["y"] = (dd["dvac_f4"] >= 2).astype(int); cv = []
for ty in range(2018, 2026):
    t0 = pd.Period(f"{ty}Q1", "Q"); a_tr = dd[dd.qp <= t0 - 5]; a_te = dd[(dd.qp >= t0 - 4) & (dd.qp <= t0 - 1)]
    lg = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=500)).fit(a_tr[CANDS], a_tr["y"])
    cv.append({"year": ty, "n": int(len(a_te)), "auc": float(roc_auc_score(a_te["y"], lg.predict_proba(a_te[CANDS])[:, 1])), "prev": float(a_te["y"].mean())})
R["ml"]["risk_cv"] = cv
lg = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=500)).fit(dd[CANDS], dd["y"])
R["ml"]["risk_now"] = float(lg.predict_proba(now[CANDS].to_frame().T.astype(float))[:, 1][0])
R["ml"]["risk_prev"] = float(dd["y"].mean())

# 시뮬레이터 계수: 임대료 프리미엄 1(=100%) 당 4분기 후 공실 변화(%p) → eps_rent
beta = (pdp["slope"] if pdp else H["H2"]["b"]) / 100           # %p → 비율
v0 = 0.273
R["sim_coef"] = {"beta_pp_per_prem": beta * 100, "eps_rent": float(max(0.0, beta / (v0 * (1 - v0)))),
                 "beta_h2_pp": float(H["H2"]["b"]), "note": "Δ공실 ≈ −v(1−v)·eps·할인율 ⇒ eps = β/(v(1−v))"}

json.dump(R, open("out/rone_analysis.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=float)

# 브라우저 학습용 데이터 (후보 피처 전부 + 목표 + 메타)
md = d[["area", "sido", "quarter"] + CANDS + ["vac_f4"]].copy()
md["split"] = np.where(d.qp <= cut - 4, "tr", np.where(d.qp > cut, "te", "gap"))
md = md[md.split != "gap"]
areas = sorted(md.area.unique().tolist())
ai = {a: i for i, a in enumerate(areas)}
ml_data = {"cols": CANDS, "labels": [LABEL[c] for c in CANDS], "areas": areas, "target_area": TGT,
           "rows": [[ai[r["area"]], r["quarter"], int(r["split"] == "te")] + [round(float(r[c]), 4) for c in CANDS] + [round(float(r["vac_f4"]), 2)]
                    for _, r in md.iterrows()],
           "now": {"quarter": now.quarter, "x": [round(float(now[c]), 4) for c in CANDS]}}
json.dump(ml_data, open("out/ml_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# 출력 요약
print(json.dumps(R["data"], ensure_ascii=False))
print("EDA", {k: v for k, v in R["eda"].items() if k not in ("series", "top", "corr")})
for k, v in H.items():
    print(k, v["title"], "→", "지지" if v["supported"] else "기각", {kk: (round(vv, 4) if isinstance(vv, float) else vv) for kk, vv in v.items() if kk not in ("title", "q", "method")})
print("features", [(r["f"], round(r["p"], 4), round(r["vif"], 1), round(r["perm"], 3), r["sel"]) for r in ftab])
print("models", [(r["model"], round(r["MAE"], 3), round(r["RMSE"], 3), round(r["R2"], 3), round(r["gain"], 3)) for r in res])
print("best", best["model"], "imp", [(r["f"], round(r["imp"], 3)) for r in imp])
print("pdp", pdp and [round(x, 2) for x in pdp["y"]], pdp and pdp["slope"])
print("forecast", R["ml"]["forecast"], "scenario", scen)
print("sim", R["sim_coef"])
print("ml rows", len(ml_data["rows"]))
