/* Neural Workover Lab — deterministic synthetic data and real multi-task learning.
 * No operational oilfield data or engineering parameters. See README for equations.
 */
(function(root){
'use strict';
const old=typeof module==='object'?require('./legacy.js'):root.Workover;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-35,35)));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const plans=old.plans.map((p,i)=>({...p,index:i,goal:i===5?'补充信息':'处理与评估'}));
function generate(){
 const random=rng(231028), rows=[], ids=Array.from({length:1500},(_,i)=>i);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 const splits={};ids.forEach((id,i)=>splits[id]=i<900?'train':i<1200?'validation':'test');
 for(let i=0;i<1500;i++){
  const fault=['sand','scale','casing'][i%3],depth=Math.round((1200+random()*3000)/10)*10,angle=Math.round(random()*70),severity=1+Math.floor(random()*3);
  const common=(random()+random()+random()-1.5)*.10;
  plans.filter(p=>p.fault===fault).forEach(p=>{
   const d=(depth-1200)/3000,a=angle/70,s=severity-1,k=p.index;
   const logits=[2.7-1.05*s-.55*d-.65*a-.6*d*a,2.25-.35*s-.30*d-.30*a,2.8-.95*s-.4*d-.6*a-.5*a*s,2.35-.4*s-.3*d-.35*a,2.35-.65*s-.6*d-.65*a,2.65-.25*s-.2*d-.2*a];
   const probability=sigmoid(logits[k]);
   const noise=(random()+random()+random()-1.5)*.14+common;
   const hours=+(p.hours*(.62+.44*d+.20*a+.23*s+.23*d*a+(k%2===0?.12*s*a:0))*Math.exp(noise)).toFixed(2);
   rows.push({id:'SIM-'+String(i+1).padStart(4,'0')+'-'+(k+1),well:'W'+String(i+1).padStart(4,'0'),split:splits[i],fault,depth,angle,severity,plan:p.id,completed:random()<probability?1:0,hours});
  });
 }
 return rows;
}
const rows=generate(),trainRows=rows.filter(r=>r.split==='train'),validationRows=rows.filter(r=>r.split==='validation'),testRows=rows.filter(r=>r.split==='test');
function normOf(data){
 const stats=key=>{const a=data.map(key),m=mean(a);return {mean:m,sd:Math.max(.0001,Math.sqrt(mean(a.map(v=>(v-m)**2))))};};
 return {depth:stats(r=>r.depth),angle:stats(r=>r.angle),severity:stats(r=>r.severity),logHours:stats(r=>Math.log(r.hours))};
}
const norm=normOf(trainRows);
function encode(q,plan,n=norm){return [...['sand','scale','casing'].map(f=>+(f===q.fault)),...plans.map(p=>+(p.id===plan)),...['depth','angle','severity'].map(k=>(q[k]-n[k].mean)/n[k].sd)];}
function dense(x,w,b,relu){return b.map((v,j)=>{let s=v;for(let i=0;i<x.length;i++)s+=x[i]*w[i*b.length+j];return relu?Math.max(0,s):s;});}
function predict(model,q,plan){
 const x=encode(q,plan,model.norm),w=model.weights;
 const h1=dense(x,w[0].values,w[1].values,true),h2=dense(h1,w[2].values,w[3].values,true);
 const probability=sigmoid(dense(h2,w[4].values,w[5].values,false)[0]);
 const log=dense(h2,w[6].values,w[7].values,false)[0]*model.norm.logHours.sd+model.norm.logHours.mean;
 return {probability,hours:Math.exp(clamp(log,-5,10)),activations:[x,h1,h2]};
}
function distance(q,r){return Math.sqrt(['depth','angle','severity'].reduce((s,k)=>s+((q[k]-r[k])/norm[k].sd)**2,0)/3);}
function neighbors(q,plan,k=15){return trainRows.filter(r=>r.plan===plan).map(r=>({...r,distance:distance(q,r)})).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,k);}
function knn(q,plan){const near=neighbors(q,plan),ws=near.map(r=>1/(.2+r.distance)**2),den=ws.reduce((a,b)=>a+b,0);return {probability:near.reduce((s,r,i)=>s+r.completed*ws[i],0)/den,hours:near.reduce((s,r,i)=>s+r.hours*ws[i],0)/den,near};}
const prior={};plans.forEach(p=>{const r=trainRows.filter(r=>r.plan===p.id);prior[p.id]={probability:mean(r.map(x=>x.completed)),hours:mean(r.map(x=>x.hours))};});
function metrics(data,predictor){
 const points=data.map(r=>({...r,...predictor(r,r.plan)}));
 const bins=Array.from({length:5},(_,i)=>{const b=points.filter(r=>Math.min(4,Math.floor(r.probability*5))===i);return {lo:i*.2,hi:(i+1)*.2,n:b.length,p:b.length?mean(b.map(r=>r.probability)):null,y:b.length?mean(b.map(r=>r.completed)):null};});
 return {n:data.length,brier:mean(points.map(r=>(r.probability-r.completed)**2)),mae:mean(points.map(r=>Math.abs(r.hours-data.find(x=>x.id===r.id).hours))),bins,
 points:points.map((r,i)=>({id:r.id,plan:r.plan,actual:data[i].hours,predicted:r.hours,probability:r.probability,completed:r.completed}))};
}
function assess(model){return {neural:metrics(testRows,(q,p)=>predict(model,q,p)),knn:metrics(testRows,knn),prior:metrics(testRows,(q,p)=>prior[p])};}
function constraints(q,p){return old.constraints(q,p);}
function recommend(model,q){return plans.filter(p=>p.fault===q.fault).map(p=>{const checks=constraints(q,p),eligible=checks.every(c=>c.pass);return {...p,checks,eligible,...(eligible?predict(model,q,p.id):{}),reference:eligible?knn(q,p.id):null};});}
// Accept either a plan object or id at the public boundary.
const rawPredict=predict;predict=function(m,q,p){return rawPredict(m,q,typeof p==='string'?p:p.id);};
function valid(q){return ['sand','scale','casing'].includes(q.fault)&&Number.isFinite(q.depth)&&q.depth>=1000&&q.depth<=5000&&Number.isFinite(q.angle)&&q.angle>=0&&q.angle<=85&&[1,2,3].includes(q.severity);}
function outOfRange(q){return q.depth<1200||q.depth>4200||q.angle>70;}
async function fit(tf,options={},progress=()=>{},shouldStop=()=>false){
 const width=options.width||24,epochs=options.epochs||90,seed=options.seed||2301;
 await tf.setBackend('cpu');await tf.ready();
 const input=tf.input({shape:[12]}),h1=tf.layers.dense({units:width,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed}),name:'hidden1'}).apply(input);
 const h2=tf.layers.dense({units:12,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:seed+1}),name:'hidden2'}).apply(h1);
 const probability=tf.layers.dense({units:1,activation:'sigmoid',kernelInitializer:tf.initializers.glorotUniform({seed:seed+2}),name:'completion'}).apply(h2);
 const logHours=tf.layers.dense({units:1,kernelInitializer:tf.initializers.glorotUniform({seed:seed+3}),name:'duration'}).apply(h2);
 const model=tf.model({inputs:input,outputs:[probability,logHours]}),optimizer=tf.train.adam(.006);
 model.compile({optimizer,loss:['binaryCrossentropy',(y,p)=>tf.losses.meanSquaredError(y,p).mul(.5)]});
 const tensorize=data=>[tf.tensor2d(data.map(r=>encode(r,r.plan))),tf.tensor2d(data.map(r=>[r.completed])),tf.tensor2d(data.map(r=>[(Math.log(r.hours)-norm.logHours.mean)/norm.logHours.sd]))];
 const tr=tensorize(trainRows),va=tensorize(validationRows),history=[];let best=null,bestLoss=Infinity,bestEpoch=0;
 const snapshot=()=>model.getWeights().map(t=>({shape:t.shape,values:Array.from(t.dataSync())}));
 try{
 await model.fit(tr[0],[tr[1],tr[2]],{epochs,batchSize:64,shuffle:false,validationData:[va[0],[va[1],va[2]]],yieldEvery:'epoch',callbacks:{onEpochEnd:async(epoch,logs)=>{
  const row={epoch:epoch+1,train:logs.loss,validation:logs.val_loss};history.push(row);
  if(row.validation<bestLoss){bestLoss=row.validation;best=snapshot();bestEpoch=epoch+1;}
  await progress({...row,history});if(shouldStop())model.stopTraining=true;
 }}});
 return {version:'3.0.0',dataVersion:'synthetic-231028-v1',seed,width,epochs:history.length,bestEpoch,bestLoss,norm,weights:best,history,training:{wells:900,rows:1800,validationWells:300,validationRows:600,testWells:300,testRows:600},architecture:[12,width,12,1,1]};
 }finally{[...tr,...va].forEach(t=>t.dispose());model.dispose();optimizer.dispose();}
}
const api={plans,rows,trainRows,validationRows,testRows,norm,rng,generate,encode,predict,fit,assess,metrics,prior,neighbors,knn,recommend,constraints,valid,outOfRange,mean,clamp};
if(typeof module==='object')module.exports=api;else root.NeuralLab=api;
})(typeof window==='undefined'?{}:window);
