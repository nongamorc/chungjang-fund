"""실제 인증키 없이 검증 가능한 요청·변환·키 비저장 테스트."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from services import kosis

class KosisTest(unittest.TestCase):
    def row(self, **extra):
        return dict(TBL_ID=kosis.TABLE,TBL_NM='중대형상가 공실률',ITM_ID='V',ITM_NM='공실률',UNIT_NM='%',PRD_SE='Q',PRD_DE='202602',C1='G',C1_NM='금남로/충장로',DT='26.5',**extra)
    def test_parameters(self):
        p=kosis.parameters({'apiKey':'test-key'})
        self.assertEqual(p['tblId'],kosis.TABLE)
        self.assertEqual(p['newEstPrdCnt'],'4')
        p=kosis.parameters({'apiKey':'separate','query':kosis.ENDPOINT+'?apiKey=ignored&orgId=408&tblId='+kosis.TABLE+'&objL1=11%2B12&startPrdDe=202501&endPrdDe=202602'})
        self.assertEqual(p['apiKey'],'separate');self.assertEqual(p['objL1'],'11+12');self.assertNotIn('newEstPrdCnt',p)
        for b in [{},{'apiKey':'x','query':'https://other.example/?a=b'},{'apiKey':'x','query':'tblId=other'},{'apiKey':'x','query':'prdSe=Y'}]:
            with self.assertRaises(ValueError):kosis.parameters(b)
    def test_normalize(self):
        raw=self.row();raw['apiKey']='secret';obj=kosis.normalize([raw]);self.assertEqual(obj['rows'][0]['value'],26.5);self.assertNotIn('secret',json.dumps(obj))
        raw['DT']='-';self.assertIsNone(kosis.normalize([raw])['rows'][0]['value'])
        raw['DT']='0';self.assertEqual(kosis.normalize([raw])['rows'][0]['value'],0)
        for raw in [[],{'err':'20','message':'secret'},[{'TBL_ID':'other'}]]:
            with self.assertRaises(ValueError):kosis.normalize(raw)
    def test_cache_without_key(self):
        resp=MagicMock();resp.__enter__.return_value.read.return_value=json.dumps([self.row()]).encode()
        opener=MagicMock();opener.open.return_value=resp
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as temp,patch.object(kosis,'CACHE',Path(temp)/'cache.json'),patch.object(kosis,'build_opener',return_value=opener):
            result=kosis.fetch({'apiKey':'private-test-key'});self.assertEqual(kosis.snapshot(),result);self.assertNotIn('private-test-key',kosis.CACHE.read_text(encoding="utf-8"))

if __name__=='__main__':unittest.main()

