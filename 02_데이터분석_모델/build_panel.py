# -*- coding: utf-8 -*-
"""R-ONE 상업용부동산 임대동향(상권별) 원자료 → 분석용 패널
입력: data/rone_panel_long.csv (cate1, cate2, cate3, quarter, 변수들)
출력: data/panel.csv  (sido, area, quarter, vac_mid, vac_small, rent_mid, rentidx, inc_ret, cap_ret, inv_ret)
  - 상권 = cate3, 시도 = 공실률·임대료 표의 cate1
  - 시도·권역 합계 행 제외 (다른 행의 상위 분류로 쓰이는 이름)
  - 임대가격지수 표는 시도 구분이 달라(예: 전남광주) 상권 이름으로 붙임
"""
import pandas as pd

p = pd.read_csv("data/rone_panel_long.csv")
SIDO = {"서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"}
# 2024년 3분기 이후 표는 '전남광주'처럼 묶인 권역을 쓰므로 cate2를 시도로 사용
p["sido"] = p["cate1"].where(p["cate1"].isin(SIDO | {"전국"}), p["cate2"])
parents = set(p.loc[p["cate2"] != p["cate3"], "cate2"])                  # 하위 상권을 가진 권역 이름
is_sido = p["cate3"].isin(SIDO | {"전국"})
is_grp = p["cate3"].isin(parents) & (p["cate2"] == p["cate3"]) & ~p["sido"].eq(p["cate3"])
vals = ["vac_mid", "vac_small", "rent_mid", "inc_ret", "cap_ret", "inv_ret", "rentidx_mid"]
panel = p[~is_sido & ~is_grp].groupby(["sido", "cate3", "quarter"])[vals].mean().reset_index() \
    .rename(columns={"cate3": "area", "rentidx_mid": "rentidx"})
# 시도 합계 행 → 지역 평균 대비 프리미엄 계산용
sido_avg = p[is_sido].groupby(["cate3", "quarter"])[["vac_mid", "rent_mid"]].mean().reset_index() \
    .rename(columns={"cate3": "sido", "vac_mid": "sido_vac", "rent_mid": "sido_rent"})
panel = panel.merge(sido_avg, on=["sido", "quarter"], how="left")
panel = panel.sort_values(["area", "quarter"]).reset_index(drop=True)
panel.to_csv("data/panel.csv", index=False, encoding="utf-8-sig")
print(panel.shape, panel["area"].nunique(), "상권", panel["quarter"].min(), "~", panel["quarter"].max())
print(panel.notna().mean().round(2).to_dict())
