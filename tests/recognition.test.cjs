const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../recognition-core.js');

test('container sizes normalize to cl, without nutrition or ambiguous sizes', () => {
  for (const [text, expected] of [['330 ml',33],['33 cl',33],['0,5 L',50],['6 x 330 ml',33],['33 cl · por 100 ml',33],['por 100 ml',null],['330 ml / 500 ml',null],['500 g',null],['330 ml (1,98 L)',null]]) assert.equal(core.volumeCl(text),expected,text);
  assert.equal(core.volumeCl('A'.repeat(200)+' 330 ml'),33);
});
test('GTIN validation and QR handling never navigate or interpret arbitrary URLs as product data', () => {
  assert.equal(core.barcode('3017624010701'),'3017624010701');
  assert.equal(core.barcode('3017624010702'),null);
  assert.deepEqual(core.codePayload('https://example.com/01/03017624010701'),{code:'03017624010701'});
  assert.deepEqual(core.codePayload('https://example.com/menu'),{unsupported:true});
  assert.deepEqual(core.codePayload('javascript:alert(1)'),{unsupported:true});
  assert.deepEqual(core.codePayload('{"marca":"Cerveza prueba","volumen":"330 ml"}'),{fields:{brand:'Cerveza prueba',format:'',cl:33}});
  assert.deepEqual(core.codePayload('null'),{unsupported:true});
});
test('OCR proposes visible data only and leaves unknown format empty', () => {
  assert.deepEqual(core.labelFields('ESTRELLA GALICIA\nEspecial\n330 ml\npor 100 ml\n43 kcal'),{brand:'Estrella Galicia',cl:33,format:''});
  assert.deepEqual(core.labelFields('123\n4,5%'),{brand:'',cl:null,format:''});
  assert.equal(core.labelFields('Cerveza Artesana\nBotella\n50 cl').format,'Botella');
});
test('catalog mapping does not import multipack total, bar price, or kcal per 100g as per 100ml', () => {
  const p = core.productFields({brands:'Marca',product_name:'Especial',quantity:'6 x 330 ml',product_quantity:1980,product_quantity_unit:'ml',nutriments:{'energy-kcal_100g':43},packaging:'en:cans'});
  assert.deepEqual(p,{brand:'Marca · Especial',cl:33,format:'Lata',kcal:null});
  assert.equal(core.productFields({quantity:'6 x 330 ml (1.98 l)',product_quantity:1980,product_quantity_unit:'ml'}).cl,null);
});
test('portrait caps at sleep on 7, and undo returns to the prior stage', () => {
  assert.deepEqual([0,1,2,3,4,5,6,7,8,99,6].map(core.portraitStage),[0,1,2,3,4,5,6,7,7,7,6]);
  const context = new Proxy({}, {get:(_,key)=> key==='createRadialGradient' ? ()=>({addColorStop(){}}) : ()=>{},set:()=>true});
  const canvas={width:192,getContext:()=>context,setAttribute(_,v){this.label=v;}};
  const sandbox={window:{},BeerRecognition:core};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../portrait.js'),'utf8'),sandbox);
  for (const photo of [null,{}]) for (let i=0;i<=9;i++) {sandbox.window.drawBeerPortrait(canvas,photo,i);assert.ok(canvas.label);if(i>=7)assert.match(canvas.label,/Zzz/);}
});
function setup(fetchImpl) {
  const nodes = new Map();
  const get = id => {
    if(!nodes.has(id)) nodes.set(id,{value:'',textContent:'',hidden:false,disabled:false,open:true,files:[],listeners:{},setAttribute(){},querySelectorAll(){return[];},focus(){},addEventListener(e,fn){this.listeners[e]=fn;}});
    return nodes.get(id);
  };
  get('beer').elements=Object.fromEntries(['brand','format','cl','kcal','price'].map(k=>[k,{value:'old',focus(){}}]));
  const sandbox={BeerRecognition:core,document:{getElementById:get,head:{append(){throw Error('Unexpected CDN load');}},addEventListener(){}},window:{addEventListener(){}},fetch:fetchImpl,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,URL,TypeError};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../recognition.js'),'utf8'),sandbox);
  return {get,sandbox};
}
test('successful lookup clears the old price and unknown fields before review', async()=>{
  const {get}=setup(async()=>({ok:true,json:async()=>({status:1,product:{brands:'Nueva',quantity:'330 ml'}})}));
  get('barcode-number').value='3017624010701';await get('lookup-code').onclick();
  assert.equal(get('beer').elements.brand.value,'Nueva');assert.equal(get('beer').elements.cl.value,33);
  assert.equal(get('beer').elements.price.value,'');assert.equal(get('beer').elements.format.value,'');
  assert.match(get('scan-status').textContent,/Open Food Facts/);assert.equal(get('saveBeer').disabled,false);
});
test('unknown product preserves current form and returns a useful error',async()=>{
  const {get}=setup(async()=>({ok:true,json:async()=>({status:0})}));
  get('barcode-number').value='3017624010701';await get('lookup-code').onclick();
  assert.equal(get('beer').elements.brand.value,'old');assert.match(get('scan-status').textContent,/No encontramos/);
});
test('closing the editor ignores an outstanding lookup',async()=>{
  let deliver;const {get}=setup(()=>new Promise(resolve=>{deliver=resolve;}));
  get('barcode-number').value='3017624010701';const lookup=get('lookup-code').onclick();
  get('editor').open=false;get('editor').listeners.close();
  deliver({ok:true,json:async()=>({status:1,product:{brands:'Late'}})});await lookup;
  assert.equal(get('beer').elements.brand.value,'old');assert.equal(get('saveBeer').disabled,false);
});
test('QR data is reviewed without fetching any URL',async()=>{
  const {get}=setup(()=>{throw Error('Must not fetch');});
  get('barcode-number').value='{"brand":"Local","cl":33}';await get('lookup-code').onclick();
  assert.equal(get('beer').elements.brand.value,'Local');assert.equal(get('beer').elements.price.value,'');
});
test('camera unavailability leaves photo and manual entry available',async()=>{
  const {get}=setup(()=>{});await get('scan-camera').onclick();
  assert.match(get('scan-status').textContent,/no está disponible/);assert.equal(get('saveBeer').disabled,false);
});
test('photo barcode decoding stops and clears its reader',async()=>{
  const {get,sandbox}=setup(async()=>({ok:true,json:async()=>({status:1,product:{brands:'Foto',quantity:'33 cl'}})}));
  let cleared=0;
  class Reader {async scanFile(){return '3017624010701';}clear(){cleared++;}}
  sandbox.window.Html5Qrcode=sandbox.Html5Qrcode=Reader;
  get('code-photo').onchange({target:{files:[{}],value:'photo'}});
  for(let i=0;i<20&&get('saveBeer').disabled;i++) await new Promise(r=>setTimeout(r,1));
  assert.equal(get('beer').elements.brand.value,'Foto');assert.equal(cleared,1);
});
test('closing while camera permission is pending releases the stream once it starts',async()=>{
  const {get,sandbox}=setup(()=>{});let start,stopped=0,cleared=0;
  class Reader {isScanning=false;start(){return new Promise(resolve=>{start=()=>{this.isScanning=true;resolve();};});}async stop(){this.isScanning=false;stopped++;}clear(){cleared++;}}
  sandbox.window.isSecureContext=true;sandbox.navigator={mediaDevices:{getUserMedia(){}}};
  sandbox.window.Html5Qrcode=sandbox.Html5Qrcode=Reader;
  const running=get('scan-camera').onclick();await Promise.resolve();
  get('editor').open=false;get('editor').listeners.close();start();await running;
  assert.equal(stopped,1);assert.equal(cleared,1);assert.equal(get('saveBeer').disabled,false);
});
test('label OCR receives the local file and releases its worker',async()=>{
  const {get,sandbox}=setup(()=>{throw Error('Photo must not be fetched');});let terminated=0,received;
  sandbox.window.Tesseract=sandbox.Tesseract={async createWorker(){return{async recognize(file){received=file;return{data:{text:'MAHOU\nLata\n330 ml'}};},async terminate(){terminated++;}};}};
  const file={name:'label.jpg'};get('label-photo').onchange({target:{files:[file],value:'photo'}});
  for(let i=0;i<20&&get('saveBeer').disabled;i++) await new Promise(r=>setTimeout(r,1));
  assert.equal(received,file);assert.equal(get('beer').elements.brand.value,'Mahou');assert.equal(get('beer').elements.cl.value,33);
  assert.equal(terminated,1);assert.equal(get('label-result').hidden,false);
});
