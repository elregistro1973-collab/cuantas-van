'use strict';
const $=id=>document.getElementById(id), money=c=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(c/100), fmt=v=>v.toLocaleString('es-ES',{maximumFractionDigits:3});
const key='cuantas-van-v1', blank=()=>({beer:null,log:[],past:[],photo:'',bar:'',view:'home'});
let state=blank(), first=false, img=null, editingEntry=null, editingVisit=null;
const defaultBeer=()=>({brand:"Cerveza",format:"",cl:null,kcal:null,cents:0});
const beerDescription=b=>[b.brand,b.format,b.cl==null?null:fmt(b.cl)+" cl",money(b.cents)].filter(Boolean).join(" · ");
try{state=JSON.parse(localStorage.getItem(key))||blank()}catch{$('notice').textContent='El almacenamiento local no está disponible.'}
function persist(candidate=state){try{localStorage.setItem(key,JSON.stringify(candidate));return true}catch{$('notice').textContent='No se pudo guardar en este dispositivo. No cierres la app: los cambios pendientes solo están en memoria.';return false}}
function save(){persist();render()}
function visitSummary(entries){
  return {
    count:entries.length,
    cents:entries.reduce((sum,entry)=>sum+entry.cents,0),
    volume:entries.some(entry=>entry.cl==null)?'Sin datos':fmt(entries.reduce((sum,entry)=>sum+entry.cl,0)/100)+' L',
    energy:entries.some(entry=>entry.cl==null||entry.kcal==null)?'Sin datos':'≈ '+Math.round(entries.reduce((sum,entry)=>sum+entry.cl*entry.kcal/10,0))+' kcal'
  };
}
function total(){return visitSummary(state.log).cents}
function line(id,text){let li=document.createElement('li');li.textContent=text;$(id).append(li)}
function portrait(){
  drawBeerPortrait($('face'), img, state.log.length, state.faceAnchors);
  $('portrait-hint').textContent = img ? 'Mi foto ↗' : '＋ Tu foto';
  previewPortrait();
}
function previewPortrait(){
  const n = +$('preview-level').value;
  $('preview-count').textContent = n + (n === 1 ? ' cerveza' : ' cervezas');
  $('preview-caption').textContent = drawBeerPortrait($('face-preview'), img, n, state.faceAnchors);
}
function loadPhoto(){img=null;portrait();if(!state.photo)return;const src=state.photo,pic=new Image();pic.onload=()=>{if(state.photo===src){img=pic;portrait();if(!state.faceAnchors)fitPortrait(pic,src)}};pic.src=src}
function render(){
const summary=visitSummary(state.log),n=summary.count,b=state.log.at(-1)||state.beer||defaultBeer();
$('count').textContent=n;$('unit').textContent=n===1?'cerveza':'cervezas';
$('sum').textContent=$('ticket-total').textContent=money(summary.cents);
$('volume').textContent=$('ticket-volume').textContent=summary.volume;
$('energy').textContent=$('ticket-energy').textContent=summary.energy;
$('ticket-count').textContent=n+(n===1?' cerveza':' cervezas');
$('selection-label').textContent=n?'ÚLTIMA ANOTADA':'TU CERVEZA';
$('change').textContent=n?'Editar última':'Elegir';
$('change').setAttribute('aria-label',n?'Editar la última cerveza anotada':'Elegir cerveza');
$('quip').textContent=['El posavasos está en blanco.','Una. Me acuerdo hasta yo.','La sonrisa ya sale sola.','Mi ceja tiene sus propios planes.','El retrato se ha venido arriba.','La gravedad empieza a opinar.','Mi foto está cerrando las persianas.','Zzz… Mi foto ya ha pedido un taxi.'][Math.min(n,7)];
$('selection').textContent=beerDescription(b||defaultBeer());$('add').textContent=n?'＋ Otra igual':'＋ Añadir cerveza';for(const id of ['closeVisit','undo','check','reset-visit'])$(id).disabled=!n;
renderEntries($('lines'),state.log);renderHistory();$('bar-name').value=state.bar||'';$('ticket-bar').textContent=state.bar||'Tu visita, cerveza a cerveza.';$('remove').disabled=!state.photo;portrait()}
function edit(andAdd,entry=null,visit=null,scan=false){
  window.resetRecognition?.();first=andAdd;editingEntry=entry;editingVisit=visit;
  const b=entry||state.beer||{},f=$('beer').elements;
  for(const field of ['brand','format','cl','kcal'])f[field].value=b[field]??'';
  f.price.value=b.cents==null?'':b.cents/100;
  $('saveBeer').textContent=entry?'Guardar cambios':andAdd?'Anotar cerveza':'Guardar';
  $('beer-editor-title').textContent=entry?'Editar cerveza':'Tu cerveza';
  $('recognition-panel').open=scan;
  $('editor').showModal();
}
function add(beer=state.log.at(-1)||state.beer||defaultBeer()){
  state.beer={...beer};delete state.beer.time;
  state.log.push({...state.beer,time:Date.now()});save();
}
$('add').onclick=()=>add();
$('change').onclick=()=>edit(false,state.log.at(-1)||null);
$('undo').onclick=()=>{
  state.log.pop();
  if(state.log.length){state.beer={...state.log.at(-1)};delete state.beer.time;}
  save();
};
$('reset-visit').onclick=()=>{
  if(!state.log.length)return;
  if(!confirm('¿Poner a cero la visita actual? Se borrarán sus cervezas sin guardarlas en el historial. Los tickets cerrados se conservarán.'))return;
  state.log=[];
  save();
};
$('beer').onsubmit=e=>{
  e.preventDefault();
  if(!e.target.checkValidity())return;
  const f=e.target.elements;
  const beer={brand:f.brand.value.trim()||'Cerveza',format:f.format.value.trim(),cl:f.cl.value===''?null:+f.cl.value,kcal:f.kcal.value===''?null:+f.kcal.value,cents:f.price.value===''?0:Math.round(+f.price.value*100)};
  if(editingEntry){
    const entries=editingVisit?editingVisit.items:state.log;
    if(!entries.includes(editingEntry))return;
    Object.assign(editingEntry,beer);
    if(!editingVisit&&editingEntry===state.log.at(-1))state.beer={...beer};
    if(editingVisit){editingVisit.cents=entries.reduce((sum,item)=>sum+item.cents,0);editingVisit.count=entries.length;}
    $('editor').close();save();
  }else{
    state.beer=beer;$('editor').close();if(first)add(beer);else save();
  }
};
function renderEntries(target,entries,visit=null){
  target.replaceChildren();
  if(!entries.length){const empty=document.createElement('li');empty.textContent='Aquí aparecerá la hora de cada cerveza.';target.append(empty);return;}
  for(const entry of [...entries].reverse()){
    const row=document.createElement('li');row.className='ticket-entry';
    const info=document.createElement('div');info.className='ticket-entry-info';
    const title=document.createElement('strong');title.textContent=entry.brand;
    const detail=document.createElement('small');detail.textContent=[new Date(entry.time).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),entry.format,entry.cl==null?'Volumen sin indicar':fmt(entry.cl)+' cl',money(entry.cents)].filter(Boolean).join(' · ');
    info.append(title,detail);
    const button=document.createElement('button');button.type='button';button.className='edit-entry';button.textContent='Editar';button.setAttribute('aria-label','Editar '+entry.brand+' de las '+new Date(entry.time).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}));
    button.onclick=()=>edit(false,entry,visit);
    row.append(info,button);target.append(row);
  }
}
document.querySelectorAll('.cancel').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('check').onclick=()=>{$('compare').reset();$('result').textContent='';$('receipt').showModal()};
$('compare').onsubmit=e=>{e.preventDefault();const f=e.target.elements,units=+f.units.value,delta=Math.round(+f.amount.value*100)-total();$('result').textContent='Anotaste '+state.log.length+' · Ticket: '+units+'. '+(units===state.log.length?'Coinciden las unidades.':Math.abs(units-state.log.length)+' ud. '+(units>state.log.length?'de más.':'de menos.'))+' '+(delta===0?'El importe cuadra.':money(Math.abs(delta))+(delta>0?' de más.':' de menos.'))};
$('closeVisit').onclick=()=>{
  if(!state.log.length||!confirm('¿Cerrar el ticket y guardarlo en este dispositivo?'))return;
  const visit={date:Date.now(),count:state.log.length,cents:total(),bar:(state.bar||'').trim(),items:state.log.map(entry=>({...entry}))};
  const next={...state,past:[...state.past,visit],log:[],bar:'',view:'history'};
  // One atomic localStorage write: never discard the open ticket if saving fails.
  if(!persist(next)){
    $('notice').textContent='No se pudo guardar el ticket en este dispositivo. Sigue abierto; vuelve a intentarlo antes de cerrar la app.';
    return;
  }
  state=next;render();showView('history',false);
  $('notice').textContent='Ticket guardado en este dispositivo. Lo encontrarás en Visitas al volver a abrir la app.';
};
let photoSelection=0, calibration=[];
async function fitPortrait(pic,src){
  $('face-status').textContent='Localizando ojos y boca en tu dispositivo…';
  try{
    const anchors=await detectPortraitFace(pic);
    if(state.photo!==src||img!==pic||state.faceAnchors)return;
    state.faceAnchors=anchors;persist();portrait();
    $('face-status').textContent='Rasgos detectados. Prueba tu nueva cara con el deslizador.';
  }catch{
    if(state.photo!==src||img!==pic||state.faceAnchors)return;
    $('face-status').textContent='No he podido localizar la cara. Pulsa «Ajustar rasgos» para colocar el efecto.';
  }
}
const selectPortrait=async e=>{
  const file=e.target.files[0];if(!file)return;
  const selection=++photoSelection,url=URL.createObjectURL(file);
  try{
    const pic=new Image();pic.src=url;await pic.decode();if(selection!==photoSelection)return;
    const tile=document.createElement('canvas');tile.width=tile.height=512;
    const size=Math.min(pic.width,pic.height);
    tile.getContext('2d').drawImage(pic,(pic.width-size)/2,(pic.height-size)/2,size,size,0,0,512,512);
    state.photo=tile.toDataURL('image/jpeg',.90);state.faceAnchors=null;calibration=[];$('face-calibration').hidden=true;
    loadPhoto();save();
  }catch{$('face-status').textContent='Prueba con una foto JPEG o PNG.'}
  finally{URL.revokeObjectURL(url);e.target.value='';}
};
$('adjust-face').onclick=()=>{
  if(!img){$('face-status').textContent='Primero elige una foto.';return;}
  calibration=[];$('face-calibration').hidden=false;
  const c=$('face-calibration');c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  $('face-status').textContent='Toca el centro del ojo que ves a la izquierda.';
};
$('face-calibration').onclick=e=>{
  if(!img)return;const c=$('face-calibration'),r=c.getBoundingClientRect();
  calibration.push({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});
  const ctx=c.getContext('2d'),p=calibration.at(-1);ctx.fillStyle='#ffbc42';ctx.beginPath();ctx.arc(p.x*c.width,p.y*c.height,5,0,Math.PI*2);ctx.fill();
  if(calibration.length<3){$('face-status').textContent=calibration.length===1?'Ahora toca el centro del otro ojo.':'Por último, toca el centro de la boca.';return;}
  const [left,right,mouth]=calibration,span=Math.hypot(right.x-left.x,right.y-left.y);
  if(span<.08||left.x>=right.x){calibration=[];$('face-status').textContent='Los ojos están demasiado juntos o invertidos. Vuelve a pulsar «Ajustar rasgos».';return;}
  state.faceAnchors={left:{...left,w:span*.55,h:span*.10},right:{...right,w:span*.55,h:span*.10},mouth:{...mouth,w:span*.95,h:span*.10}};
  $('face-calibration').hidden=true;$('face-status').textContent='Rasgos ajustados. Ya puedes probar las expresiones.';save();
};
$('photo').onchange=selectPortrait;
$('selfie').onchange=selectPortrait;
$('remove').onclick=()=>{++photoSelection;state.photo='';state.faceAnchors=null;calibration=[];$('face-calibration').hidden=true;$('face-status').textContent='';loadPhoto();save()};loadPhoto();render();

// Every change is saved immediately, including the last screen visited.
function showView(requested,remember=true){
  const view=['home','ticket','history','profile'].includes(requested)?requested:'home';
  document.querySelectorAll('.view').forEach(panel=>{panel.hidden=panel.id!==`view-${view}`;});
  document.querySelectorAll('[data-view]').forEach(button=>{
    if(button.dataset.view===view)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  state.view=view;
  if(remember){persist();window.scrollTo({top:0,behavior:'instant'});}
}
document.querySelectorAll('[data-view]').forEach(button=>{
  button.addEventListener('click',()=>showView(button.dataset.view));
});
showView(state.view||'home',false);

$('identify-beer').onclick=()=>edit(true,null,null,true);
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
    item.append(info,remove);
    if(Array.isArray(visit.items)){
      const details=document.createElement('details');details.className='closed-ticket';details.open=visit===editingVisit;
      const heading=document.createElement('summary');heading.textContent='Ver y editar cervezas';
      const entries=document.createElement('ul');renderEntries(entries,visit.items,visit);
      details.append(heading,entries);item.append(details);
    }else{
      const note=document.createElement('small');note.className='legacy-ticket-note';note.textContent='Ticket antiguo: solo se guardó el resumen.';item.append(note);
    }
    $('past').append(item);
  }
}
