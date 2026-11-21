'use strict';
const $=id=>document.getElementById(id), money=c=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(c/100), fmt=v=>v.toLocaleString('es-ES',{maximumFractionDigits:3});
const key='cuantas-van-v1', blank=()=>({beer:null,log:[],past:[],photo:'',bar:''});
let state=blank(), first=false, img=null;
try{state=JSON.parse(localStorage.getItem(key))||blank()}catch{$('notice').textContent='El almacenamiento local no está disponible.'}
function persist(){try{localStorage.setItem(key,JSON.stringify(state))}catch{$('notice').textContent='El navegador no pudo guardar los cambios. Esta visita queda en memoria.'}}
function save(){persist();render()}
function total(){return state.log.reduce((s,b)=>s+b.cents,0)}
function line(id,text){let li=document.createElement('li');li.textContent=text;$(id).append(li)}
function portrait(){
  drawBeerPortrait($('face'), img, state.log.length);
  $('portrait-hint').textContent = img ? 'Mi foto ↗' : '＋ Tu foto';
  previewPortrait();
}
function previewPortrait(){
  const n = +$('preview-level').value;
  $('preview-count').textContent = n + (n === 1 ? ' cerveza' : ' cervezas');
  $('preview-caption').textContent = drawBeerPortrait($('face-preview'), img, n);
}
function loadPhoto(){img=null;portrait();if(!state.photo)return;const src=state.photo,pic=new Image();pic.onload=()=>{if(state.photo===src){img=pic;portrait()}};pic.src=src}
function render(){const n=state.log.length,b=state.beer;$('count').textContent=n;$('unit').textContent=n===1?'cerveza':'cervezas';$('sum').textContent=money(total());$('volume').textContent=fmt(state.log.reduce((s,v)=>s+v.cl,0)/100)+' L';$('energy').textContent=state.log.some(v=>v.kcal===null)?'Sin datos':'≈ '+Math.round(state.log.reduce((s,v)=>s+v.cl*v.kcal/10,0))+' kcal';
$('quip').textContent=['El posavasos está en blanco.','Una. Me acuerdo hasta yo.','La sonrisa ya sale sola.','Mi ceja tiene sus propios planes.','El retrato se ha venido arriba.','La gravedad empieza a opinar.','Mi foto está cerrando las persianas.','Zzz… Mi foto ya ha pedido un taxi.'][Math.min(n,7)];
$('selection').textContent=b?b.brand+' · '+b.format+' · '+fmt(b.cl)+' cl · '+money(b.cents):'Elige tu primera cerveza';$('add').textContent=n?'＋ Otra igual':'＋ Anotar la primera';for(const id of ['closeVisit','undo','check'])$(id).disabled=!n;
$('lines').replaceChildren();if(!n)line('lines','Aquí aparecerá la hora de cada cerveza.');for(const v of [...state.log].reverse())line('lines',new Date(v.time).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+' · '+v.brand+' · '+v.format+' '+fmt(v.cl)+' cl · '+money(v.cents));renderHistory();$('bar-name').value=state.bar||'';$('ticket-bar').textContent=state.bar||'Tu visita, cerveza a cerveza.';$('remove').disabled=!state.photo;portrait()}
function edit(andAdd){window.resetRecognition?.();first=andAdd;let b=state.beer||{},f=$('beer').elements;for(const field of ['brand','format','cl','kcal'])f[field].value=b[field]??'';f.price.value=b.cents==null?'':b.cents/100;$('saveBeer').textContent=andAdd?'Anotar cerveza':'Guardar';$('editor').showModal()}
function add(){state.log.push({...state.beer,time:Date.now()});save()}
$('add').onclick=()=>state.beer?add():edit(true);$('change').onclick=()=>edit(false);$('undo').onclick=()=>{state.log.pop();save()};
$('beer').onsubmit=e=>{e.preventDefault();const f=e.target.elements;if(!f.brand.value.trim()||!f.format.value.trim())return;state.beer={brand:f.brand.value.trim(),format:f.format.value.trim(),cl:+f.cl.value,kcal:f.kcal.value===''?null:+f.kcal.value,cents:Math.round(+f.price.value*100)};$('editor').close();if(first)add();else save()};
document.querySelectorAll('.cancel').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('check').onclick=()=>{$('compare').reset();$('result').textContent='';$('receipt').showModal()};
$('compare').onsubmit=e=>{e.preventDefault();const f=e.target.elements,units=+f.units.value,delta=Math.round(+f.amount.value*100)-total();$('result').textContent='Anotaste '+state.log.length+' · Ticket: '+units+'. '+(units===state.log.length?'Coinciden las unidades.':Math.abs(units-state.log.length)+' ud. '+(units>state.log.length?'de más.':'de menos.'))+' '+(delta===0?'El importe cuadra.':money(Math.abs(delta))+(delta>0?' de más.':' de menos.'))};
$('closeVisit').onclick=()=>{if(!confirm('¿Cerrar esta visita y guardar el resumen?'))return;state.past.push({date:Date.now(),count:state.log.length,cents:total(),bar:(state.bar||'').trim()});state.log=[];state.bar='';save()};
const selectPortrait=async e=>{const file=e.target.files[0];if(!file)return;const url=URL.createObjectURL(file);try{const pic=new Image();pic.src=url;await pic.decode();const tile=document.createElement('canvas');tile.width=tile.height=192;const size=Math.min(pic.width,pic.height);tile.getContext('2d').drawImage(pic,(pic.width-size)/2,(pic.height-size)/2,size,size,0,0,192,192);state.photo=tile.toDataURL('image/jpeg',.88);loadPhoto();save()}catch{$('notice').textContent='Prueba con una foto JPEG o PNG.'}finally{URL.revokeObjectURL(url);e.target.value=''}};
$('photo').onchange=selectPortrait;
$('selfie').onchange=selectPortrait;
$('remove').onclick=()=>{state.photo='';loadPhoto();save()};loadPhoto();render();

// Navegación de la app: mantiene el estado de la visita entre pantallas.
document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach(view => {
      view.hidden = view.id !== `view-${button.dataset.view}`;
    });
    document.querySelectorAll('[data-view]').forEach(item => {
      if (item === button) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
});

$('identify-beer').onclick=()=>edit(true);
$('portrait-button').onclick=()=>document.querySelector('[data-view="profile"]').click();
$('preview-level').oninput=previewPortrait;

// The venue belongs to this visit; historical visits keep their own snapshot.
$('bar-name').oninput=()=>{
  state.bar=$('bar-name').value.slice(0,80);
  $('ticket-bar').textContent=state.bar.trim()||'Tu visita, cerveza a cerveza.';
  persist();
};
function renderHistory(){
  $('past').replaceChildren();
  if(!state.past.length){line('past','Aún no has cerrado ninguna visita.');return;}
  for(const visit of [...state.past].reverse()){
    const item=document.createElement('li');item.className='history-item';
    const info=document.createElement('div');info.className='history-info';
    const name=document.createElement('strong');name.textContent=visit.bar||'Bar sin nombre';
    const date=document.createElement('small');date.textContent=new Date(visit.date).toLocaleString('es-ES');
    const summary=document.createElement('span');summary.textContent=visit.count+' uds. · '+money(visit.cents);
    info.append(name,date,summary);
    const remove=document.createElement('button');remove.type='button';remove.className='delete-ticket';remove.textContent='Borrar';
    remove.setAttribute('aria-label','Borrar ticket de '+(visit.bar||'bar sin nombre')+' del '+date.textContent);
    remove.onclick=()=>{
      if(!confirm('¿Borrar el ticket de '+(visit.bar||'bar sin nombre')+' del '+date.textContent+'? No se puede deshacer.'))return;
      const index=state.past.indexOf(visit);
      if(index<0)return;
      state.past.splice(index,1);save();
      // Keep keyboard focus in the history after removing its focused button.
      const next=$('past').querySelector('button');
      if(next)next.focus();
      else document.querySelector('[data-view="history"]').focus();
    };
    item.append(info,remove);$('past').append(item);
  }
}
