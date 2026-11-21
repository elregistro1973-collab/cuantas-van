/* Check releases without interrupting a ticket or an unfinished edit. */
(function () {
  const current=document.querySelector('meta[name="app-version"]').content;
  const button=document.getElementById('check-update'),notice=document.getElementById('update-status'),badge=document.getElementById('update-available');
  let latest=null,busy=false,lastCheck=0;
  function apply(){
    const url=new URL(location.href);url.searchParams.set('release',latest);url.searchParams.set('_refresh',Date.now());
    location.replace(url.href);
  }
  async function check(manual=false){
    if(busy||(!manual&&Date.now()-lastCheck<60000))return;
    if(manual&&latest){apply();return;}
    busy=true;lastCheck=Date.now();button.disabled=true;
    if(manual)notice.textContent='Buscando actualizaciones…';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const url=new URL('./index.html',location.href);url.searchParams.set('_check',Date.now());
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('Unavailable');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      const version=doc.querySelector('meta[name="app-version"]')?.content;
      if(!version)throw new Error('No release');
      if(version!==current){latest=version;badge.hidden=false;button.textContent='Actualizar ahora';notice.textContent='Hay una versión nueva. Guarda cualquier edición antes de actualizar.';}
      else if(manual)notice.textContent='Ya tienes la última versión.';
    }catch{if(manual)notice.textContent='No se pudo comprobar. Revisa la conexión y vuelve a intentarlo.';}
    finally{clearTimeout(timer);busy=false;button.disabled=false;}
  }
  button.onclick=()=>check(true);
  badge.onclick=()=>{if(confirm('¿Actualizar la app? Los tickets y la foto guardados se conservan. Termina primero cualquier edición pendiente.'))apply();};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
  window.addEventListener('pageshow',()=>check());window.addEventListener('online',()=>check());
  check();
})();
