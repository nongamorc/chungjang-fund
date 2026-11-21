"""학습에 쓰는 기존 자료와 화면용 분석 스냅샷을 분리해 읽는다."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(name):
    return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8'))

def split(data):
    groups = {key: [] for key in ('train', 'valid', 'test')}
    for row in data['rows']:
        q = row[1]
        key = ('train' if q <= '2021Q2' else 'valid' if '2022Q3' <= q <= '2023Q2'
               else 'test' if '2024Q3' <= q <= '2025Q2' else None)
        if key:
            groups[key].append(row)
    return groups
