# 데이터 분석·모델 원본과 분석용 앱
이 폴더는 분석 과정 재현용입니다. 최종 시연 홈페이지는 상위의 `01_홈페이지`를 사용합니다.

패널 재생성은 이 폴더에서 `python build_panel.py`, 학습 입력 생성은 `python prepare_v2.py`로 실행합니다. 생성 명령은 기존 산출물을 갱신합니다.
`local_web` 폴더에서 requirements.txt의 의존성을 설치한 뒤 `python test_services.py`로 검증합니다.
`python app.py`는 이전 분석용 웹앱을 실행합니다. 내부 예측·정책 시뮬레이터는 최종 서비스가 아닙니다.
세부 분석 당시 문서는 local_web/README.md와 발표_사용가이드.md에 보존되어 있으며 최종 시연 지침은 상위 README.md를 따릅니다.
