const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function setup(version,ok=true){
 const nodes=Object.fromEntries(['check-update','update-status','update-available'].map(id=>[id,{hidden:true}])),listeners={},navigations=[];
 const sandbox={URL,Date,AbortController,setTimeout,clearTimeout,confirm:()=>true,location:{href:'https://example.org/app/?foo=bar',replace:u=>navigations.push(u)},document:{querySelector:()=>({content:'1'}),getElementById:id=>nodes[id],addEventListener:(e,f)=>listeners[e]=f,visibilityState:'visible'},window:{addEventListener:(e,f)=>listeners[e]=f},fetch:async()=>({ok,text:async()=>version}),DOMParser:class{parseFromString(s){return{querySelector:()=>s?{content:s}:null}}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../updates.js'),'utf8'),sandbox);
 await new Promise(r=>setImmediate(r));return {nodes,navigations,listeners};
}
test('new release is offered without interrupting current work; update stays on same origin and path',async()=>{
 const {nodes,navigations}=await setup('2');assert.equal(nodes['update-available'].hidden,false);assert.equal(navigations.length,0);
 await nodes['check-update'].onclick();const url=new URL(navigations[0]);assert.equal(url.origin,'https://example.org');assert.equal(url.pathname,'/app/');assert.equal(url.searchParams.get('release'),'2');assert.equal(url.searchParams.get('foo'),'bar');
});
test('same release does not offer a reload',async()=>{const {nodes,navigations}=await setup('1');await nodes['check-update'].onclick();assert.match(nodes['update-status'].textContent,/última versión/);assert.equal(nodes['update-available'].hidden,true);assert.equal(navigations.length,0);});
test('offline or invalid response keeps app usable and manual retry available',async()=>{const {nodes,navigations}=await setup('',false);await nodes['check-update'].onclick();assert.match(nodes['update-status'].textContent,/conexión/);assert.equal(nodes['check-update'].disabled,false);assert.equal(navigations.length,0);});
