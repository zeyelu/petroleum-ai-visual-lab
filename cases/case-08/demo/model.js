(function(g){'use strict';
const node=typeof module==='object',D=node?require('./data.js'):PublicData,C=node?require('./core.js'):g.NeuralCore,tf=C.tf(),kind=D.kind,flat=a=>a.flat(),clamp=C.clamp,mean=C.mean;
const trainRows=kind==='inverse'?D.items.flatMap(w=>w.rows).filter(r=>r.split==='train'):[];
const stats=kind==='inverse'?{mu:Array.from({length:15},(_,j)=>mean(trainRows.map(r=>r.x[j]))),sd:Array.from({length:15},(_,j)=>Math.max(.05,Math.sqrt(mean(trainRows.map(r=>(r.x[j]-mean(trainRows.map(a=>a.x[j])))**2)))))}:null;
const norm=r=>r.x.map((x,j)=>(x-stats.mu[j])/stats.sd[j]);
function patch(a,H,W,y,x,k=7){const v=[],r=(k-1)/2;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)v.push(a[clamp(y+dy,0,H-1)][clamp(x+dx,0,W-1)]);return v;}
function noise(w,sigma=.16,coherent=.05,seed=2206){const rng=C.rng(seed),a=w.amplitude.map(row=>row.slice());for(let y=0;y<w.H;y++)for(let x=0;x<w.W;x++){let n=0;for(let i=0;i<12;i++)n+=rng();a[y][x]+=sigma*(n-6)+coherent*Math.sin(y*.5+x*.3);}return a;}
function sample(split){const xs=[],ys=[];
 if(kind==='inverse'){for(const w of D.items)for(const r of w.rows)if(r.split===split){xs.push(norm(r));ys.push([r.phi/.45]);}return{xs,ys};}
 if(kind==='denoise'){for(const w of D.items.filter(w=>w.split===split)){const n=noise(w,.16,.05,100+Number(w.id.replace(/\D/g,'')));for(let y=0;y<=w.H-16;y+=16)for(let x=0;x<=w.W-16;x+=16){xs.push(n.slice(y,y+16).flatMap(r=>r.slice(x,x+16)));ys.push(w.amplitude.slice(y,y+16).flatMap(r=>r.slice(x,x+16)));}}return{xs,ys};}
 const count=kind==='fault'?2:6,buckets=Array.from({length:count},()=>[]),rnd=C.rng(1066);
 for(const w of D.items.filter(w=>w.split===split))for(let y=4;y<w.H-4;y+=2)for(let x=4;x<w.W-4;x+=2){if(kind==='fault'&&!w.known[y][x])continue;const label=w.truth[y][x];buckets[label].push([w,y,x]);}
 buckets.forEach((b,k)=>{for(let i=b.length-1;i>0;i--){let j=Math.floor(rnd()*(i+1));[b[i],b[j]]=[b[j],b[i]];}b.slice(0,split==='train'?220:100).forEach(([w,y,x])=>{xs.push(patch(w.amplitude,w.H,w.W,y,x));ys.push(kind==='fault'?[k]:Array.from({length:6},(_,i)=>+(i===k)));});});
 // Deterministically mix classes so each mini-batch is not a single class.
 for(let i=xs.length-1;i>0;i--){let j=Math.floor(rnd()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]];[ys[i],ys[j]]=[ys[j],ys[i]];}return{xs,ys};
}
function create(){let seed=3306;const init=()=>tf.initializers.glorotUniform({seed:seed++});const m=tf.sequential();
 if(kind==='inverse'){m.add(tf.layers.dense({inputShape:[15],units:20,activation:'relu',kernelInitializer:init()}));m.add(tf.layers.dense({units:10,activation:'relu',kernelInitializer:init()}));m.add(tf.layers.dense({units:1,activation:'sigmoid',kernelInitializer:init()}));}
 else if(kind==='denoise'){m.add(tf.layers.conv2d({inputShape:[null,null,1],kernelSize:3,filters:4,padding:'same',activation:'relu',kernelInitializer:init()}));m.add(tf.layers.conv2d({kernelSize:3,filters:4,padding:'same',activation:'relu',kernelInitializer:init()}));m.add(tf.layers.conv2d({kernelSize:3,filters:1,padding:'same',kernelInitializer:init()}));}
 else{m.add(tf.layers.conv2d({inputShape:[7,7,1],filters:6,kernelSize:3,activation:'relu',kernelInitializer:init()}));m.add(tf.layers.flatten());m.add(tf.layers.dense({units:16,activation:'relu',kernelInitializer:init()}));m.add(tf.layers.dense({units:kind==='fault'?1:6,activation:kind==='fault'?'sigmoid':'softmax',kernelInitializer:init()}));}return m;}
function tensors(a){return kind==='inverse'?[tf.tensor2d(a.xs),tf.tensor2d(a.ys)]:kind==='denoise'?[tf.tensor4d(a.xs.flat(),[a.xs.length,16,16,1]),tf.tensor4d(a.ys.flat(),[a.ys.length,16,16,1])]:[tf.tensor4d(a.xs.flat(),[a.xs.length,7,7,1]),tf.tensor2d(a.ys)];}
async function train(options={}){const m=create(),tr=sample('train'),va=sample('validation'),a=tensors(tr),b=tensors(va);const info=await C.train(tf,m,...a,...b,{epochs:kind==='inverse'?70:kind==='denoise'?14:22,batchSize:32,lr:kind==='inverse'?.003:.002,loss:kind==='fault'?'binaryCrossentropy':kind==='facies'?'categoricalCrossentropy':'meanSquaredError',...options});return{model:m,info:{...info,trainSamples:tr.xs.length,validationSamples:va.xs.length}};}
function infer(m,w,options={}){return tf.tidy(()=>{
 if(kind==='inverse')return Array.from(m.predict(tf.tensor2d(w.rows.map(norm))).dataSync()).map(x=>x*.45);
 if(kind==='denoise'){const a=options.input||noise(w,options.sigma??.16,options.coherent??.05);return Array.from(m.predict(tf.tensor4d(a.flat(),[1,w.H,w.W,1])).dataSync());}
 const stride=kind==='facies'?3:2,coords=[],xs=[];for(let y=0;y<w.H;y+=stride)for(let x=0;x<w.W;x+=stride){coords.push([y,x]);xs.push(patch(w.amplitude,w.H,w.W,y,x));}
 const probs=Array.from(m.predict(tf.tensor4d(xs.flat(),[xs.length,7,7,1])).dataSync()),out=new Array(w.H*w.W),unc=new Array(w.H*w.W),all=[];
 coords.forEach(([y,x],i)=>{const p=kind==='fault'?[probs[i]]:probs.slice(i*6,i*6+6),label=kind==='fault'?p[0]:p.indexOf(Math.max(...p)),u=kind==='fault'?1-Math.abs(2*p[0]-1):-p.reduce((s,v)=>s+v*Math.log(Math.max(1e-9,v)),0)/Math.log(6);for(let dy=0;dy<stride&&y+dy<w.H;dy++)for(let dx=0;dx<stride&&x+dx<w.W;dx++){let j=(y+dy)*w.W+x+dx;out[j]=label;unc[j]=u;all[j]=p;}});return{values:out,uncertainty:unc,probabilities:all};
});}
function baseline(w,input){if(kind==='inverse'){const v=mean(trainRows.map(r=>r.phi));return w.rows.map(()=>v);}if(kind==='denoise'){const a=input||noise(w);return a.flatMap((row,y)=>row.map((v,x)=>(row[Math.max(0,x-1)]+v+row[Math.min(w.W-1,x+1)])/3));}if(kind==='facies')return Array(w.H*w.W).fill(2);return w.amplitude.flatMap((row,y)=>row.map((v,x)=>Math.min(1,Math.abs(row[Math.max(0,x-1)]-row[Math.min(w.W-1,x+1)])*2)));}
function metrics(w,p,threshold=.5){if(kind==='fault'){let tp=0,fp=0,fn=0,tn=0;flat(w.truth).forEach((t,i)=>{if(!flatKnown(w)[i])return;const b=p[i]>=threshold;if(t&&b)tp++;else if(b)fp++;else if(t)fn++;else tn++;});return{tp,fp,fn,tn,iou:tp/(tp+fp+fn||1),precision:tp/(tp+fp||1),recall:tp/(tp+fn||1)};}
 if(kind==='facies'){const cm=Array.from({length:6},()=>Array(6).fill(0));flat(w.truth).forEach((t,i)=>cm[t][p[i]]++);return{accuracy:cm.reduce((s,r,i)=>s+r[i],0)/p.length,macroRecall:mean(cm.filter(r=>r.reduce((a,b)=>a+b,0)>0).map(r=>r[cm.indexOf(r)]/r.reduce((a,b)=>a+b,0))),confusion:cm};}
 const truth=kind==='inverse'?w.rows.map(r=>r.phi):flat(w.amplitude),mse=mean(p.map((v,i)=>(v-truth[i])**2)),mae=mean(p.map((v,i)=>Math.abs(v-truth[i])));return{mae,rmse:Math.sqrt(mse),snr:10*Math.log10(mean(truth.map(v=>v*v))/Math.max(1e-12,mse))};}
const knownCache=new WeakMap();function flatKnown(w){if(!knownCache.has(w))knownCache.set(w,flat(w.known));return knownCache.get(w);}
function evaluate(m){return D.items.filter(w=>kind==='inverse'?w.id==='Volve-A':w.split==='test').map(w=>{const p=infer(m,w);return{id:w.id,neural:metrics(w,Array.isArray(p)?p:p.values),baseline:metrics(w,baseline(w))};});}
const api={D,C,tf,kind,stats,sample,create,train,infer,noise,baseline,metrics,evaluate,patch};if(node)module.exports=api;else g.PublicModel=api;
})(globalThis);
