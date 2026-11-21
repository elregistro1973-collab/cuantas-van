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
    removeAttribute(){}
    addEventListener(event,handler){this[event]=handler;}
    focus(){}
    showModal(){this.open=true;}
    close(){this.open=false;}
    querySelector(){return this.children.find(x=>x.children?.some(c=>c.type==='button'))?.children.find(c=>c.type==='button')||null;}
  }
  const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  get('beer').elements=Object.fromEntries(['brand','format','cl','kcal','price'].map(name=>[name,{value:''}]));
  get('beer').checkValidity=()=>true;
  const views=['home','ticket','history','profile'].map(name=>{const panel=get('view-'+name);panel.id='view-'+name;return panel;});
  const nav=['home','ticket','history','profile'].map(name=>{const button=get('nav-'+name);button.dataset={view:name};return button;});
  const sandbox={document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:selector=>selector==='.view'?views:selector==='[data-view]'?nav:[],querySelector:()=>new Element()},localStorage:{getItem:()=>stored,setItem:(_,v)=>{stored=v;}},window:{scrollTo(){}},confirm:()=>confirmed,drawBeerPortrait:()=>'',Intl,Date};
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

function submit(a,values={}){
  for(const [name,value] of Object.entries(values))a.get('beer').elements[name].value=value;
  a.get('beer').onsubmit({preventDefault(){},target:a.get('beer')});
}
test('first tap adds a generic zero-price beer without a form; unknown volume stays unknown',()=>{
  const initial=base();initial.log=[];const a=app(initial);a.get('add').onclick();
  const entry=a.read().log[0];assert.equal(entry.brand,'Cerveza');assert.equal(entry.cents,0);assert.equal(entry.cl,null);assert.equal(entry.kcal,null);
  assert.equal(a.get('volume').textContent,'Sin datos');assert.equal(a.get('energy').textContent,'Sin datos');
});
test('blank form adds a beer and nonempty invalid fields cannot be submitted',()=>{
  const a=app(base());a.get('identify-beer').onclick();submit(a);
  assert.equal(a.read().log.length,2);assert.equal(a.read().log[1].brand,'Cerveza');assert.equal(a.read().log[1].cents,0);
  a.get('beer').checkValidity=()=>false;submit(a,{price:'-1'});assert.equal(a.read().log.length,2);
});
test('editing one ticket row preserves its timestamp, neighbours and count, and recalculates totals',()=>{
  const initial=base();initial.log.push({...initial.log[0],brand:'Otra',time:1700000001000});const a=app(initial);
  a.get('lines').children[1].children[1].onclick();submit(a,{brand:'Corregida',price:'3.45',cl:'50',kcal:'40'});
  const saved=a.read();assert.equal(saved.log.length,2);assert.equal(saved.log[0].brand,'Corregida');assert.equal(saved.log[0].cents,345);assert.equal(saved.log[0].time,initial.log[0].time);assert.deepEqual(saved.log[1],initial.log[1]);assert.match(a.get('sum').textContent,/5,95/);
  const reloaded=app(saved);assert.equal(reloaded.read().log[0].brand,'Corregida');
});
test('clearing an existing beer uses generic defaults without adding a second entry',()=>{
  const a=app(base());a.get('lines').children[0].children[1].onclick();submit(a,{brand:'  ',format:'',price:'',cl:'',kcal:''});
  assert.equal(a.read().log.length,1);assert.equal(a.read().log[0].brand,'Cerveza');assert.equal(a.read().log[0].cl,null);assert.equal(a.read().log[0].cents,0);
});
test('newly closed tickets preserve editable entries and editing them does not change the current visit',()=>{
  const a=app(base());a.get('closeVisit').onclick();a.get('add').onclick();const current=a.read().log;
  const closed=a.get('past').children[0].children[2];closed.children[1].children[0].children[1].onclick();submit(a,{brand:'Histórica',price:'4.50'});
  const saved=a.read();assert.equal(saved.past[0].cents,450);assert.equal(saved.past[0].count,1);assert.equal(saved.past[0].items[0].brand,'Histórica');assert.deepEqual(saved.log,current);
});

test('closing and reopening restores the open ticket, its venue, prices and selected beer',()=>{
  const initial=base();initial.beer={brand:'Seleccionada',format:'Lata',cl:33,kcal:43,cents:275};initial.log[0]={...initial.beer,time:initial.log[0].time};
  const a=app(initial);a.get('bar-name').value='El local';a.get('bar-name').oninput();a.get('add').onclick();a.get('nav-ticket').click();
  const saved=a.read();assert.equal(saved.view,'ticket');
  const reopened=app(saved);
  assert.equal(reopened.get('view-ticket').hidden,false);assert.equal(reopened.get('view-home').hidden,true);
  assert.equal(reopened.get('ticket-bar').textContent,'El local');assert.equal(reopened.get('lines').children.length,2);
  assert.deepEqual(reopened.read().log,saved.log);assert.deepEqual(reopened.read().beer,saved.beer);assert.match(reopened.get('sum').textContent,/5,50/);
});
test('old saved state without a screen restores its ticket data on the home screen',()=>{
  const a=app(base());assert.equal(a.get('view-home').hidden,false);assert.equal(a.get('count').textContent,1);assert.equal(a.get('lines').children.length,1);
});

test('editing the beer shown on home updates the latest ticket entry and its total',()=>{
  const a=app(base());a.get('change').onclick();submit(a,{brand:'Mahou',format:'Tercio',cl:'33',kcal:'43',price:'3'});
  assert.equal(a.read().log[0].brand,'Mahou');assert.equal(a.read().log[0].cents,300);
  assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);
  assert.equal(a.get('ticket-count').textContent,'1 cerveza');
});
test('another equal beer uses the corrected latest ticket data',()=>{
  const a=app(base());a.get('lines').children[0].children[1].onclick();submit(a,{brand:'Corregida',price:'3',cl:'33',kcal:'43'});
  a.get('add').onclick();assert.equal(a.read().log[1].brand,'Corregida');assert.equal(a.read().log[1].cents,300);
  assert.match(a.get('sum').textContent,/6,00/);assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);
});
test('add, edit, undo and navigation keep the same number of beers and totals on both screens',()=>{
  const a=app(base());a.get('add').onclick();a.get('nav-ticket').click();
  assert.equal(a.get('ticket-count').textContent,'2 cervezas');assert.equal(a.get('lines').children.length,2);
  assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);
  a.get('lines').children[0].children[1].onclick();submit(a,{price:'4'});a.get('nav-home').click();
  assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);assert.match(a.get('selection').textContent,/4,00/);
  a.get('undo').onclick();a.get('nav-ticket').click();assert.equal(a.get('ticket-count').textContent,'1 cerveza');
  assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);assert.equal(a.get('lines').children.length,1);
  assert.match(a.get('selection').textContent,/2,50/);
});
test('adding a different beer preserves earlier entries and exposes matching volume and calories',()=>{
  const a=app(base());a.get('identify-beer').onclick();submit(a,{brand:'Nueva',price:'4',cl:'50',kcal:'40'});
  assert.equal(a.read().log[0].brand,'Prueba');assert.equal(a.read().log[1].brand,'Nueva');
  assert.equal(a.get('ticket-count').textContent,'2 cervezas');assert.match(a.get('ticket-total').textContent,/6,50/);
  assert.equal(a.get('ticket-volume').textContent,a.get('volume').textContent);assert.equal(a.get('ticket-energy').textContent,a.get('energy').textContent);
  a.get('add').onclick();assert.equal(a.read().log[2].brand,'Nueva');assert.match(a.get('ticket-total').textContent,/10,50/);
  a.get('closeVisit').onclick();assert.equal(a.read().past[0].cents,1050);assert.equal(a.get('ticket-count').textContent,'0 cervezas');assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);
});
test('reset cancellation preserves the current ticket; confirmation clears only active entries',()=>{
  const initial=base();initial.bar='Mi bar';initial.beer={brand:'Elegida',format:'Lata',cl:33,kcal:null,cents:300};initial.past=[{date:1,count:1,cents:250,bar:'Anterior'}];
  const a=app(initial);a.confirm(false);a.get('reset-visit').onclick();assert.deepEqual(a.read(),initial);
  a.confirm(true);a.get('reset-visit').onclick();const saved=a.read();
  assert.deepEqual(saved.log,[]);assert.deepEqual(saved.past,initial.past);assert.deepEqual(saved.beer,initial.beer);assert.equal(saved.bar,'Mi bar');
  assert.equal(a.get('count').textContent,0);assert.equal(a.get('ticket-count').textContent,'0 cervezas');assert.equal(a.get('sum').textContent,a.get('ticket-total').textContent);assert.equal(a.get('reset-visit').disabled,true);
  const reopened=app(saved);assert.equal(reopened.get('count').textContent,0);assert.equal(reopened.read().past.length,1);
});
