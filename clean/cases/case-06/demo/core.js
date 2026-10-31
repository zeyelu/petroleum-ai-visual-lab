(function(g){'use strict';
const C={clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),mean:a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),sigmoid:x=>1/(1+Math.exp(-x))};
C.rng=s=>()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
C.quantile=(a,p)=>{a=[...a].sort((x,y)=>x-y);const z=(a.length-1)*p,i=Math.floor(z);return a[i]+(a[Math.min(a.length-1,i+1)]-a[i])*(z-i)};
C.groups=(n,seed,ratios=[.6,.2])=>{const a=Array.from({length:n},(_,i)=>i),r=C.rng(seed);for(let i=n-1;i;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}const result=[];a.forEach((v,i)=>result[v]=i<n*ratios[0]?'train':i<n*(ratios[0]+ratios[1])?'validation':'test');return result};
C.pack=async(model,meta={})=>{let a;await model.save({save:async x=>{a=x;return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}}}});const bytes=new Uint8Array(a.weightData);let b64;if(typeof Buffer!=='undefined')b64=Buffer.from(bytes).toString('base64');else{let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);b64=btoa(s);}return {...meta,artifact:{modelTopology:a.modelTopology,weightSpecs:a.weightSpecs,base64:b64}}};
C.load=async(tf,p)=>{const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(p.artifact.base64,'base64')):Uint8Array.from(atob(p.artifact.base64),c=>c.charCodeAt(0));return tf.loadLayersModel(tf.io.fromMemory({modelTopology:p.artifact.modelTopology,weightSpecs:p.artifact.weightSpecs,weightData:bytes.buffer}));};
C.train=async(tf,model,x,y,vx,vy,{epochs=40,batchSize=32,lr=.004,loss='binaryCrossentropy',progress=()=>{},stop=()=>false}={})=>{
 const opt=tf.train.adam(lr);model.compile({optimizer:opt,loss});let best=Infinity,bestEpoch=0,weights=null;const history=[];
 try{await model.fit(x,y,{epochs,batchSize,shuffle:false,validationData:[vx,vy],yieldEvery:'epoch',callbacks:{onEpochEnd:async(e,l)=>{history.push({epoch:e+1,train:l.loss,validation:l.val_loss});if(l.val_loss<best){best=l.val_loss;bestEpoch=e+1;if(weights)weights.forEach(t=>t.dispose());weights=model.getWeights().map(t=>t.clone());}await progress(history);if(stop())model.stopTraining=true;}}});if(weights)model.setWeights(weights);return {history,bestEpoch,epochs:history.length,parameters:model.countParams(),initialization:"固定逐层种子；见 model.js"};}finally{if(weights)weights.forEach(t=>t.dispose());[x,y,vx,vy].flat().forEach(t=>t.dispose());opt.dispose();}
};
C.binary=(ys,ps)=>({brier:C.mean(ps.map((p,i)=>(p-ys[i])**2)),accuracy:C.mean(ps.map((p,i)=>+(+(p>=.5)===ys[i])))});
C.tf=()=>typeof module==='object'?require('./vendor/tf.min.js'):g.tf;
if(typeof module==='object')module.exports=C;else g.NeuralCore=C;
})(globalThis);
