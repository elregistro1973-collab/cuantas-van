/* Local facial caricature. Never a measure of intoxication. */
(function () {
  const captions = ['Recién llegado', 'Se escapa una sonrisa', 'Esa sonrisa te delata', 'Un guiño y seguimos', 'La ceja tiene vida propia', 'La sonrisa va por libre', 'Pesan los párpados…', 'Fuera de servicio… Zzz'];
  const fallback = {left:{x:.35,y:.40,w:.18,h:.045},right:{x:.65,y:.40,w:.18,h:.045},mouth:{x:.5,y:.68,w:.30,h:.08}};
  let detectorPromise;
  const cache = new WeakMap();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const weight=(x,y,rx,ry)=>{const r=x*x/(rx*rx)+y*y/(ry*ry);return r>=1?0:(1-r)**2;};
  window.detectPortraitFace = async function(image) {
    if (!detectorPromise) detectorPromise = (async()=>{
      const root='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
      const {FilesetResolver,FaceLandmarker}=await import(root+'/vision_bundle.mjs');
      const vision=await FilesetResolver.forVisionTasks(root+'/wasm');
      return FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'IMAGE',numFaces:1});
    })().catch(e=>{detectorPromise=null;throw e;});
    const detector=await detectorPromise;
    const points=detector.detect(image).faceLandmarks[0];
    if(!points) throw new Error('No face');
    function feature(a,b,top,bottom){const p=points[a],q=points[b];return {x:(p.x+q.x)/2,y:(p.y+q.y)/2,w:Math.hypot(p.x-q.x,p.y-q.y),h:Math.max(.012,Math.hypot(points[top].x-points[bottom].x,points[top].y-points[bottom].y)/2)};}
    const eyes=[feature(33,133,159,145),feature(362,263,386,374)].sort((a,b)=>a.x-b.x);
    return {left:eyes[0],right:eyes[1],mouth:feature(61,291,13,14)};
  };
  // Inverse mapping in face coordinates. Outside each feature support it is identity.
  function sourcePoint(x,y,n,f) {
    if(!n)return [x,y];
    let sx=x,sy=y;
    const span=Math.hypot(f.right.x-f.left.x,f.right.y-f.left.y);
    const angle=Math.atan2(f.right.y-f.left.y,f.right.x-f.left.x),cos=Math.cos(angle),sin=Math.sin(angle);
    const move=(dx,dy)=>{sx+=dx*cos-dy*sin;sy+=dx*sin+dy*cos;};
    for(const [i,eye] of [f.left,f.right].entries()){
      const dx=(x-eye.x)*cos+(y-eye.y)*sin,dy=-(x-eye.x)*sin+(y-eye.y)*cos;
      const scale=([1,.94,.78,i===0?.12:.83,i===0?.65:1.12,i===0?.36:.64,.23,.035])[n];
      const rx=eye.w*.78,ry=Math.max(eye.h*3.7,span*.22),h=Math.max(eye.h,.012),a=Math.abs(dy),target=h*scale;
      const horizontal=Math.max(0,1-(dx/rx)**2)**2;
      if(Math.abs(dx)<rx && a<ry){
        const mapped=a<target?a/scale:h+(a-target)*(ry-h)/(ry-target);
        move(0,Math.sign(dy)*(mapped-a)*horizontal);
      }
      // Lift the original eyebrow, never paint a second eyebrow over it.
      const brow=weight(dx,dy+span*.23,eye.w*.8,span*.18);
      if(n>=3&&n<6)move(0,(i===1?1:-.3)*span*.12*brow);
    }
    const m=f.mouth,dx=(x-m.x)*cos+(y-m.y)*sin,dy=-(x-m.x)*sin+(y-m.y)*cos;
    const w=weight(dx,dy,m.w*.95,span*.54);
    const grin=[0,.07,.15,.18,.20,.24,.08,0][n];
    move(-dx*grin*w,Math.min(1,(dx/(m.w*.45))**2)*span*grin*w);
    if(n===5)move(0,dx*.20*w);
    if(n===7)move(dx*.18*w,-dy*.22*w);
    for(const eye of [f.left,f.right]){
      const cx=eye.x,cy=eye.y+span*.48,wx=x-cx,wy=y-cy;
      const cheek=weight(wx,wy,span*.43,span*.40)*[0,.015,.04,.045,.07,.08,.035,.01][n];
      sx-=wx*cheek;sy-=wy*cheek;
    }
    return [sx,sy];
  }
  window.BeerPortrait={sourcePoint,fallback};
  function warped(image,n,f){
    const key=JSON.stringify(f);let record=cache.get(image);
    if(!record||record.key!==key){record={key,frames:[]};cache.set(image,record);}
    if(record.frames[n])return record.frames[n];
    const size=320,tile=document.createElement('canvas');tile.width=tile.height=size;
    const ctx=tile.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,size,size);
    if(n){const src=ctx.getImageData(0,0,size,size),out=ctx.createImageData(size,size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const p=sourcePoint(x/size,y/size,n,f),px=clamp(p[0]*size,0,size-1),py=clamp(p[1]*size,0,size-1);
        const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(x0+1,size-1),y1=Math.min(y0+1,size-1),tx=px-x0,ty=py-y0,j=(y*size+x)*4;
        for(let c=0;c<3;c++)out.data[j+c]=(src.data[(y0*size+x0)*4+c]*(1-tx)+src.data[(y0*size+x1)*4+c]*tx)*(1-ty)+(src.data[(y1*size+x0)*4+c]*(1-tx)+src.data[(y1*size+x1)*4+c]*tx)*ty;
        out.data[j+3]=255;
      }ctx.putImageData(out,0,0);
    }
    record.frames[n]=tile;return tile;
  }
  window.drawBeerPortrait=function(canvas,image,count,anchors){
    const n=BeerRecognition.portraitStage(count),ctx=canvas.getContext('2d'),s=canvas.width,f=anchors||fallback;
    ctx.clearRect(0,0,s,s);ctx.save();ctx.scale(s,s);
    ctx.fillStyle='#29252a';ctx.fillRect(0,0,1,1);
    ctx.save();ctx.translate(.5,.5);ctx.rotate([0,0,-.015,.035,-.06,.075,.10,.15][n]);ctx.scale(n?1.12:1,n?1.12:1);ctx.translate(-.5,-.5);
    ctx.save();
    if(image){
      // Frame the detected face so expressions remain visible beside the counter.
      const span=Math.hypot(f.right.x-f.left.x,f.right.y-f.left.y),crop=clamp(span*3.3,.30,1);
      const cx=(f.left.x+f.right.x)/2,cy=(f.left.y+f.right.y)/2+span*.40;
      ctx.scale(1/crop,1/crop);ctx.translate(-clamp(cx-crop/2,0,1-crop),-clamp(cy-crop/2,0,1-crop));
      ctx.drawImage(warped(image,n,f),0,0,1,1);
    }
    else{
      ctx.fillStyle='#ffbc42';ctx.beginPath();ctx.ellipse(.5,.52,.36,.40,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#442b16';ctx.lineWidth=.018;ctx.lineCap='round';
      for(const [i,x] of [.36,.64].entries()){ctx.beginPath();if(n>=6||(n===3&&i===0)){ctx.moveTo(x-.055,.42);ctx.quadraticCurveTo(x,.46,x+.055,.42);}else ctx.ellipse(x,.41,.026,.035,0,0,Math.PI*2);ctx.stroke();}
      ctx.beginPath();if(n===7)ctx.ellipse(.5,.66,.035,.05,0,0,Math.PI*2);else {ctx.moveTo(.37,.62);ctx.quadraticCurveTo(.5,.70+n*.01,.63,.62);}ctx.stroke();
    }
    if(n>=2){const span=f.right.x-f.left.x;for(const e of [f.left,f.right]){
      const x=e.x,y=e.y+span*.48,r=span*.34,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,99,100,${n===7?.12:.10+n*.023})`);g.addColorStop(1,'rgba(255,99,100,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }}
    ctx.restore();ctx.restore();
    if(n===7){ctx.font='bold .13px sans-serif';ctx.fillStyle='#fff2cf';ctx.strokeStyle='#29252a';ctx.lineWidth=.014;for(const [t,x,y,k]of [['z',.72,.33,.085],['z',.80,.23,.11],['Z',.87,.12,.14]]){ctx.font=`bold ${k}px sans-serif`;ctx.strokeText(t,x,y);ctx.fillText(t,x,y);}}
    ctx.restore();canvas.setAttribute('aria-label',captions[n]);return captions[n];
  };
})();
