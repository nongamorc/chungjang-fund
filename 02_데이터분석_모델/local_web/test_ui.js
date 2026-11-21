// 브라우저가 아닌 최소 DOM 대역에서 HTML 스크립트·이벤트 흐름을 검사한다. 시각 검증 아님.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
let html=fs.readFileSync(path.join(__dirname,'templates/index.html'),'utf8');
for(const part of ['main', 'evidence', 'map', 'policy', 'analysis', 'simulator', 'forecast', 'national'])html=html.replace('{{'+part+'}}',fs.readFileSync(path.join(__dirname,'templates/'+part+'.html'),'utf8'));
const elements=new Map();
function node(){return {_value:'',get value(){return this._value;},set value(v){this._value=String(v);},textContent:'',innerHTML:'',style:{},dataset:{},children:[],classList:{add(){},remove(){},toggle(){}},clientWidth:640,
 appendChild(n){this.children.push(n);return n;},append(n){this.children.push(n);},setAttribute(){},removeAttribute(){},addEventListener(){},querySelector(selector){return selector==="tbody"?node():null;},querySelectorAll(){return [];},getBoundingClientRect(){return {width:640,height:240,left:0,top:0};}};}
for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const n=node();n.value=/\bvalue="([^"]*)"/.exec(m[0])?.[1]||'';n.checked=/\bchecked\b/.test(m[0]);elements.set(m[1],n);}
const document={getElementById(id){assert(elements.has(id),'Missing DOM ID: '+id);return elements.get(id);},querySelectorAll(){return [];},createElement:node,createElementNS:node,documentElement:node()};
const context=vm.createContext({fetch:(url,opts)=>fetch("http://127.0.0.1:8001"+url,opts),document,console,setTimeout,clearTimeout,performance,location:{hash:'#main'},innerWidth:1200,addEventListener(){},scrollTo(){},getComputedStyle(){return {getPropertyValue(){return '#888';}};},matchMedia(){return {matches:false,addEventListener(){}};},MutationObserver:class{observe(){}},Blob,URL});

const {spawn}=require('child_process');
const server=spawn('python',[path.join(__dirname,'app.py'),'--port','8001'],{windowsHide:true});
const ready=new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
(async()=>{
 await ready;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'static/fund.js'),'utf8'),context);
 let js=fs.readFileSync(path.join(__dirname,'static/app.js'),'utf8');
 js=js.replace('buildFeatBoxes();','globalThis.testHooks={train,testSelected,predictReal,run,show,params};buildFeatBoxes();');
 js=js.replace('boot().catch(e=>document.getElementById("appStatus").textContent=e.message);','globalThis.ready=boot();');
 vm.runInContext(js,context);await context.ready;
 await context.testHooks.run();
 const initial=elements.get('kF1').textContent;
 elements.get('buildings').value='306';await context.testHooks.run();
 assert.notStrictEqual(elements.get('kF1').textContent,initial,'건물 수 변경 시 기금 갱신');
 elements.get('buildings').value='612';await context.testHooks.run();
 assert(html.indexOf('id="v-policy"')<html.indexOf('id="v-simulator"'));
 assert(html.indexOf('45.2%')<html.indexOf('충장로 1~3가'));
 assert(html.includes('31.4%p') && html.includes('NISX20260226_0003527153'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'중복 DOM ID 없음');
 for(const view of ['main', 'evidence', 'map', 'policy', 'analysis', 'simulator', 'forecast', 'national']){context.location.hash='#'+view;context.testHooks.show();}
 await context.testHooks.train();
 assert(elements.get('trainMsg').textContent.includes('선택'),elements.get('trainMsg').textContent);
 await context.testHooks.testSelected();await context.testHooks.predictReal();
 assert(elements.get('tTest').innerHTML.includes('Extra Trees'));
 assert(elements.get('trainFc').textContent.includes('예상 공실률'));
 assert(!elements.has('match'));
 assert(elements.get('appStatus').textContent==='');
 console.log(elements.get('trainFc').textContent);
 console.log('Local Python API + frontend flow: passed (DOM stub, not visual browser test)');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.kill());
