const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const sandbox={window:{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../portrait.js'),'utf8'),sandbox);
const {sourcePoint,fallback:f}=sandbox.window.BeerPortrait;
test('portrait mapping preserves original at zero and pixels away from the face',()=>{
  for(let n=0;n<8;n++)for(const [x,y] of [[0,0],[1,1],[0,1],[1,0]]) assert.deepEqual(Array.from(sourcePoint(x,y,n,f)),[x,y]);
  for(let y=0;y<=1;y+=.1)for(let x=0;x<=1;x+=.1)assert.deepEqual(Array.from(sourcePoint(x,y,0,f)),[x,y]);
});
test('sleep compresses eye pixels and undo restores deterministic expression',()=>{
  const e=f.left,p=[e.x,e.y+.001];
  const sleeping=sourcePoint(...p,7,f),awake=sourcePoint(...p,1,f);
  assert.ok(sleeping[1]-e.y>(awake[1]-e.y)*10);
  assert.deepEqual(sourcePoint(...p,6,f),sourcePoint(...p,6,f));
});
test('all stages produce finite coordinates for tilted off-centre faces',()=>{
  const face={left:{x:.25,y:.3,w:.12,h:.02},right:{x:.5,y:.37,w:.13,h:.02},mouth:{x:.35,y:.57,w:.21,h:.03}};
  for(let n=0;n<8;n++)for(let y=0;y<=1;y+=.025)for(let x=0;x<=1;x+=.025)assert.ok(sourcePoint(x,y,n,face).every(Number.isFinite));
});
