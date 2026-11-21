const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function app(initial){
  let stored=JSON.stringify(initial),confirmed=true;
  class Element{
    constructor(){this.children=[];this.value='0';this.textContent='';}
    append(...items){this.children.push(...items);}
    replaceChildren(){this.children=[];}
    setAttribute(){}
    focus(){}
    querySelector(){return this.children.find(x=>x.children?.some(c=>c.type==='button'))?.children.find(c=>c.type==='button')||null;}
  }
  const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const sandbox={document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>[],querySelector:()=>new Element()},localStorage:{getItem:()=>stored,setItem:(_,v)=>{stored=v;}},window:{},confirm:()=>confirmed,drawBeerPortrait:()=>'',Intl,Date};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),sandbox);
  return{get,read:()=>JSON.parse(stored),confirm:value=>{confirmed=value;}};
}
const base=()=>({beer:null,log:[{brand:'Prueba',format:'Lata',cl:33,kcal:null,cents:250,time:1700000000000}],past:[],photo:''});
test('venue survives reload, is copied into a closed visit and resets for the next',()=>{
  const a=app(base());a.get('bar-name').value='La Barra';a.get('bar-name').oninput();
  assert.equal(a.read().bar,'La Barra');assert.equal(a.get('ticket-bar').textContent,'La Barra');
  const reloaded=app(a.read());assert.equal(reloaded.get('bar-name').value,'La Barra');
  reloaded.get('closeVisit').onclick();const saved=reloaded.read();
  assert.equal(saved.past[0].bar,'La Barra');assert.equal(saved.past[0].cents,250);assert.equal(saved.bar,'');assert.equal(saved.log.length,0);
});
test('deletion cancellation preserves history; confirmation removes only the selected closed ticket',()=>{
  const initial=base();initial.past=[{date:1,count:1,cents:250,bar:'Uno'},{date:1,count:2,cents:500,bar:'Dos'}];
  const a=app(initial);const remove=a.get('past').children[0].children[1];
  a.confirm(false);remove.onclick();assert.equal(a.read().past.length,2);
  a.confirm(true);remove.onclick();assert.equal(a.read().past.length,1);assert.equal(a.read().past[0].bar,'Uno');assert.deepEqual(a.read().log,initial.log);
  const reloaded=app(a.read());assert.equal(reloaded.get('past').children.length,1);
});
test('old history without venue remains usable and deleting its last ticket displays the empty state',()=>{
  const initial=base();initial.past=[{date:1,count:1,cents:100}];
  const a=app(initial);assert.equal(a.get('bar-name').value,'');assert.equal(a.get('past').children[0].children[0].children[0].textContent,'Bar sin nombre');
  a.get('past').children[0].children[1].onclick();assert.equal(a.read().past.length,0);assert.match(a.get('past').children[0].textContent,/Aún no/);
});
