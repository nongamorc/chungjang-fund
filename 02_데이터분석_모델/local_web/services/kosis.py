"""KOSIS 공식 통계 조회. 인증키를 디스크·로그·응답에 남기지 않는다."""
import json
import math
import re
from datetime import datetime, timezone
from urllib.parse import urlencode, urlsplit, parse_qs
from urllib.request import urlopen, Request, HTTPRedirectHandler, build_opener
from urllib.error import URLError
from pathlib import Path

TABLE = 'DT_40801_N420201_05'
SOURCE = 'https://kosis.kr/statHtml/statHtml.do?orgId=408&tblId=' + TABLE
CACHE = Path(__file__).resolve().parents[1] / 'data' / 'kosis_vacancy.json'
ENDPOINT = 'https://kosis.kr/openapi/Param/statisticsParameterData.do'

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def parameters(body):
    key = body.get('apiKey', '')
    if not isinstance(key, str) or not 1 <= len(key.strip()) <= 1024:
        raise ValueError('KOSIS 인증키를 입력하세요.')
    p = dict(method='getList', orgId='408', tblId=TABLE, format='json', jsonVD='Y',
             prdSe='Q', newEstPrdCnt='4', itmId='ALL', objL1='ALL')
    custom = body.get('query', '').strip()
    if custom:
        if len(custom) > 20000:
            raise ValueError('조회 설정이 너무 깁니다.')
        if custom.startswith('https://'):
            url = urlsplit(custom)
            if url.hostname != 'kosis.kr' or url.path != '/openapi/Param/statisticsParameterData.do':
                raise ValueError('KOSIS 통계표선택 API의 URL만 사용할 수 있습니다.')
            custom = url.query
        values = {k: v[-1] for k, v in parse_qs(custom, keep_blank_values=True).items()}
        if values.get('tblId', TABLE) != TABLE or values.get('orgId', '408') != '408':
            raise ValueError('연결 대상은 기관 408의 지정 공실률 통계표입니다.')
        for k, v in values.items():
            if k in {'itmId', 'prdSe', 'startPrdDe', 'endPrdDe', 'newEstPrdCnt', 'prdInterval'} or re.fullmatch(r'objL[1-8]', k):
                if len(v) > 5000 or not re.fullmatch(r'[A-Za-z0-9_+* .-]*', v):
                    raise ValueError('조회 조건 형식을 확인하세요.')
                p[k] = v
        if p['prdSe'] != 'Q':
            raise ValueError('공실률은 분기 자료로 조회하세요.')
        if p.get('startPrdDe') or p.get('endPrdDe'):
            p.pop('newEstPrdCnt', None)
    p['apiKey'] = key.strip()
    return p

def normalize(raw):
    if isinstance(raw, dict):
        code = str(raw.get('err', raw.get('errCode', '')))
        # 외부 오류 원문에는 키가 포함될 수 있어 표시하지 않는다.
        raise ValueError('KOSIS가 자료를 반환하지 않았습니다. 인증키·조회 조건을 확인하세요.' + (' 오류 코드: ' + code if code.isdigit() else ''))
    if not isinstance(raw, list) or not raw:
        raise ValueError('조회된 자료가 없습니다. 분류·항목 설정을 확인하세요.')
    if len(raw) > 40000:
        raise ValueError('4만 셀을 초과했습니다. 조회 범위를 줄이세요.')
    rows = []
    for item in raw:
        if not isinstance(item, dict) or str(item.get('TBL_ID', '')) != TABLE:
            raise ValueError('예상한 통계표 응답이 아닙니다.')
        row = {k: str(item.get(k, '')) for k in ['TBL_ID','TBL_NM','ITM_ID','ITM_NM','UNIT_NM','PRD_SE','PRD_DE','LST_CHN_DE']}
        for i in range(1, 9):
            for suffix in ['', '_NM', '_OBJ_NM']:
                row[f'C{i}{suffix}'] = str(item.get(f'C{i}{suffix}', ''))
        raw_value = str(item.get('DT', '')).replace(',', '').strip()
        try:
            v = float(raw_value)
            if not math.isfinite(v) or not 0 <= v <= 100:
                v = None
        except ValueError:
            v = None
        row['value'] = v
        row['DT'] = str(item.get('DT', ''))
        rows.append(row)
    return {'source': SOURCE, 'tableId': TABLE, 'fetchedAt': datetime.now(timezone.utc).isoformat(), 'rows': rows}

def fetch(body):
    params = parameters(body)
    request = Request(ENDPOINT + '?' + urlencode(params), headers={'Accept':'application/json'})
    try:
        with build_opener(NoRedirect).open(request, timeout=25) as response:
            payload = response.read(12_000_001)
        if len(payload) > 12_000_000:
            raise ValueError('응답이 너무 큽니다. 조회 범위를 줄이세요.')
        result = normalize(json.loads(payload.decode('utf-8-sig')))
    except (URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError):
        raise ValueError('KOSIS 연결에 실패했습니다. 인증키·연결 상태·API 조회 설정을 확인하세요.') from None
    temp = CACHE.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temp.replace(CACHE)
    return result

def snapshot():
    if not CACHE.exists():
        return {'source': SOURCE, 'tableId': TABLE, 'fetchedAt': None, 'rows': []}
    return json.loads(CACHE.read_text(encoding='utf-8'))
