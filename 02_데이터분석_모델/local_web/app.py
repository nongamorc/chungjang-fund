"""로컬 전용 웹서버. python app.py 로 실행하고 http://127.0.0.1:8000 접속."""
import argparse
import json
import sys
import threading
import webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit
try:
    from services import data, fund
except ModuleNotFoundError as exc:
    raise SystemExit(f'필요한 Python 패키지가 없습니다: {exc.name}\n'
                     f'다음 명령으로 설치하세요:\n"{sys.executable}" -m pip install -r requirements.txt')

class Handler(BaseHTTPRequestHandler):
    def reply(self,payload,status=200):
        body=json.dumps(payload,ensure_ascii=False,allow_nan=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

    def do_GET(self):
        path=urlsplit(self.path).path
        if path=='/maps/chungjang.html' and self.headers.get('Host','').split(':')[0]=='127.0.0.1':
            self.send_response(302)
            self.send_header('Location',f'http://localhost:{self.server.server_port}/maps/chungjang.html')
            self.end_headers();return
        if path=='/api/data':
            ml=data.load('ml.json')
            # 화면에는 학습 원본 행을 보내지 않는다. 학습은 서버에서만 실행한다.
            ml.pop('rows',None)
            self.reply(dict(ML=ml,**{k.upper():data.load(k+'.json') for k in ['an','qa','mc']}));return
        if path=='/api/health': self.reply({'status':'ok','app':'청충어람','funding':'private-only'});return
        paths={'/maps/chungjang.html':('static/chungjang_map.html','text/html'),'/':('templates/index.html','text/html'),'/static/style.css':('static/style.css','text/css'),
               '/static/fund.js':('static/fund.js','text/javascript'),'/static/app.js':('static/app.js','text/javascript')}
        if path not in paths: self.reply({'error':'찾을 수 없습니다.'},404);return
        name,mime=paths[path];body=(data.ROOT/name).read_bytes()
        if path=='/':
            page=body.decode('utf-8')
            for part in ['main', 'evidence', 'policy', 'analysis', 'simulator', 'forecast', 'national']:
                page=page.replace('{{'+part+'}}',(data.ROOT/'templates'/f'{part}.html').read_text(encoding='utf-8'))
            body=page.encode('utf-8')
        self.send_response(200);self.send_header('Content-Type',mime+'; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

    def do_POST(self):
        # 로컬 웹페이지의 동일 출처 요청만 허용한다. 파일/외부 사이트에서 호출 불가.
        origin=self.headers.get('Origin')
        if origin and origin!=f'http://{self.headers.get("Host")}': self.reply({'error':'다른 출처의 요청은 허용하지 않습니다.'},403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=200000: raise ValueError('요청 크기가 허용 범위를 벗어났습니다.')
            body=json.loads(self.rfile.read(size))
            # 모델 패키지는 학습 요청 때 읽어 서버와 첫 화면의 시작을 지연하지 않는다.
            if self.path in {'/api/train','/api/test','/api/predict'}:
                from services import prediction
            if self.path=='/api/appraisal':
                from services.fund_model import Bld, appraisal
                rent=float(body['rent']);cut=float(body['cut'])
                if not 0<rent<1000000 or not 0<=cut<=.9: raise ValueError('임대료·인하율 범위 오류')
                b=Bld();v0=appraisal(b,rent);loan=v0*b.ltv0;v=appraisal(b,rent,1-cut)
                xs=list(range(0,51,5))
                result=dict(v0=v0,loan=loan,v=v,ltv=loan/v,rep=max(0,loan-b.ltv_cov*v),xs=xs,ys=[loan/appraisal(b,rent,1-c/100) for c in xs])
            elif self.path=='/api/train': result=prediction.train(body)
            elif self.path=='/api/test': result=prediction.evaluate(body['token'])
            elif self.path=='/api/predict': result=prediction.predict(body)
            elif self.path=='/api/fund':
                if not isinstance(body['params'],list) or not 1<=len(body['params'])<=50: raise ValueError('시나리오는 1~50개까지입니다.')
                result=[fund.calculate(p) for p in body['params']]
            else: self.reply({'error':'없는 API입니다.'},404);return
            self.reply(result)
        except (ValueError,KeyError,TypeError,OverflowError) as e: self.reply({'error':str(e)},400)
        except Exception:
            import traceback;traceback.print_exc();self.reply({'error':'서버 처리 중 오류가 발생했습니다. 터미널을 확인하세요.'},500)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--open-browser',action='store_true',help='서버 실행 후 브라우저 열기')
    parser.add_argument('--auto-port',action='store_true',help='포트 사용 중이면 다음 포트로 실행')
    args=parser.parse_args()
    if not 1024<=args.port<=65525: parser.error('포트는 1024~65525 범위여야 합니다.')
    server=None
    for port in range(args.port,args.port+(11 if args.auto_port else 1)):
        try:
            server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
            break
        except OSError as exc:
            if not args.auto_port:
                raise SystemExit(f'{port}번 포트를 열 수 없습니다. 다른 서버가 사용 중인지 확인하세요.\n'
                                 f'다른 포트로 실행: python app.py --port {port+1} --open-browser\n{exc}')
    if server is None:raise SystemExit('사용 가능한 포트를 찾지 못했습니다.')
    address=f'http://127.0.0.1:{server.server_port}/'
    print(f'청충어람 실행 완료: {address}',flush=True)
    print('이 창을 열어 둔 상태로 위 주소를 이용하세요. 종료하려면 Ctrl+C를 누르세요.',flush=True)
    if args.open_browser:
        opener=threading.Timer(.5,webbrowser.open,args=[address]);opener.daemon=True;opener.start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
