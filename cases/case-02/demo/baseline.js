(function(root){'use strict';
const kinds={pipe:'管状落物',rod:'杆状落物',fragment:'零散碎屑',cable:'缠绕电缆'};
const families={overshot:{name:'外抓式打捞筒',en:'OVERSHOT',action:'从外部抱持',kinds:['pipe','rod'],color:'#246e73'},spear:{name:'内抓式打捞矛',en:'SPEAR',action:'从内部接合',kinds:['pipe'],color:'#4976a4'},magnet:{name:'磁力打捞器',en:'MAGNET',action:'吸附铁磁碎屑',kinds:['fragment'],color:'#b47b37'},basket:{name:'反循环打捞篮',en:'JUNK BASKET',action:'收集零散碎屑',kinds:['fragment'],color:'#746d96'}};
const tools=[
['O-94','overshot',94,60,73,35],['O-114','overshot',114,73,89,40],['O-136','overshot',136,89,108,45],
['S-68','spear',68,40,55,40],['S-84','spear',84,55,70,45],['S-100','spear',100,70,85,50],
['M-80','magnet',80,5,28,0],['M-104','magnet',104,5,40,0],['M-128','magnet',128,5,55,0],
['B-92','basket',92,5,35,0],['B-118','basket',118,5,50,0],['B-140','basket',140,5,65,0]
].map(([id,family,body,min,max,reach])=>({id,family,body,min,max,reach,...families[family]}));
const defaults={kind:'pipe',bore:142,outer:73,inner:54,exposure:80,top:'clean',open:'yes',magnetic:'yes',circulation:'yes',known:true,tolerance:1,depth:2500};
const presets=[{name:'管柱断落',note:'外径位于外抓规格边界，内抓可能更稳健。',values:{...defaults}},{name:'杆件落井',note:'实心杆不能使用内抓工具；缩小通径观察外抓路径。',values:{...defaults,kind:'rod',bore:124,outer:67,inner:0,exposure:65}},{name:'金属碎屑',note:'磁性与循环条件分别决定两类收集路径。',values:{...defaults,kind:'fragment',outer:22,inner:0,exposure:0,bore:132}},{name:'信息待核实',note:'资料不完整时，工具应停留在待核实状态。',values:{...defaults,top:'unknown',known:false,open:'unknown'}}];
let seed=2302;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const records=[];tools.forEach((tool,ti)=>{for(let i=0;i<8;i++){let kind=tool.family==='overshot'?(i%3===0?'rod':'pipe'):tool.family==='spear'?'pipe':'fragment';let size=Math.round(tool.min+rand()*(tool.max-tool.min));let inner=tool.family==='spear'?size:kind==='pipe'?Math.max(10,size-20):0;let outer=tool.family==='spear'?inner+18:size;records.push({id:'FS-'+String(ti*8+i+1).padStart(3,'0'),tool:tool.id,family:tool.family,kind,bore:tool.body+8+Math.round(rand()*35),outer,inner,depth:1500+Math.round(rand()*2000/50)*50,result:i%4===0?'需补充处理':'完成演示目标',note:i%4===0?'尺寸符合仍可能存在未建模条件；保留此记录用于复核。':'模拟完成记录，不代表真实工具效果。'});}});
function validate(q){const errors=[];if(!kinds[q.kind])errors.push('落物类型无效');for(const [key,min,max] of [['bore',70,220],['outer',5,130],['inner',0,110],['exposure',0,160],['tolerance',0,5],['depth',1000,4500]])if(typeof q[key]!=='number'||!Number.isFinite(q[key])||q[key]<min||q[key]>max)errors.push(key+' 超出教学输入范围');if(q.kind==='pipe'&&q.inner>=q.outer)errors.push('管状落物内径必须小于外径');for(const key of ['open','magnetic','circulation'])if(!['yes','no','unknown'].includes(q[key]))errors.push(key+' 状态无效');if(!['clean','deformed','unknown'].includes(q.top))errors.push('顶部状态无效');if(typeof q.known!=='boolean')errors.push('尺寸确认状态无效');return errors;}
function similarity(q,r){return 100*(.35*(q.kind===r.kind?1:0)+.25*Math.max(0,1-Math.abs(q.outer-r.outer)/100)+.15*Math.max(0,1-Math.abs(q.inner-r.inner)/80)+.15*Math.max(0,1-Math.abs(q.bore-r.bore)/150)+.1*Math.max(0,1-Math.abs(q.depth-r.depth)/3500));}
function evaluate(q,t){const u=q.tolerance,gap=q.bore-u-t.body,size=t.family==='spear'?q.inner:q.outer;const rules=[];
const add=(id,label,status,detail)=>rules.push({id,label,status,detail});
add('type','形态适用',t.kinds.includes(q.kind)?'pass':'fail',t.name+'适用于'+t.kinds.map(x=>kinds[x]).join('、'));
add('passage','通行空间',!q.known?'unknown':gap>=6?'pass':'fail',`最不利直径余量 ${gap.toFixed(1)} mm；教学要求 ≥ 6 mm`);
add('size','接合尺寸',!q.known?'unknown':size-u>=t.min&&size+u<=t.max?'pass':'fail',`${t.family==='spear'?'落物内径':q.kind==='fragment'?'碎屑包络尺寸':'落物外径'}区间 ${(size-u).toFixed(1)}–${(size+u).toFixed(1)} mm；规格范围 ${t.min}–${t.max} mm`);
if(['overshot','spear'].includes(t.family)){
add('reach','可接合长度',!q.known?'unknown':q.exposure-u>=t.reach?'pass':'fail',`确认可接合长度最不利值 ${(q.exposure-u).toFixed(1)} mm；教学要求 ≥ ${t.reach} mm`);
if(t.family==='overshot')add('surface','外部接合面',q.top==='unknown'?'unknown':q.top==='clean'?'pass':'fail','外抓需顶部外表面完整且可接近；变形或未知不能直接判定符合');
else add('open','内部可进入',q.open==='unknown'?'unknown':q.open==='yes'?'pass':'fail','内抓需确认内孔可进入且具有接合条件');
}else if(t.family==='magnet')add('magnetic','铁磁性',q.magnetic==='unknown'?'unknown':q.magnetic==='yes'?'pass':'fail','磁力路径仅对已确认铁磁性碎屑列为候选');
else add('circulation','循环条件',q.circulation==='unknown'?'unknown':q.circulation==='yes'?'pass':'fail','反循环收集需先确认循环条件满足；本例不计算流量');
const status=rules.some(r=>r.status==='fail')?'fail':rules.some(r=>r.status==='unknown')?'unknown':'pass';
const near=records.filter(r=>r.tool===t.id&&r.kind===q.kind).map(r=>({...r,similarity:similarity(q,r)})).sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id)).slice(0,5);
const rangeMargin=Math.min(size-u-t.min,t.max-size-u),clearanceMargin=gap-6;
const robustness=100*Math.max(0,Math.min(1,Math.min(rangeMargin,clearanceMargin)/10));
const evidence=near.length?near.reduce((s,r)=>s+r.similarity,0)/near.length:0;
const score=status==='pass'?.7*robustness+.3*evidence:null;
return {...t,rules,status,gap,rangeMargin,clearanceMargin,robustness,evidence,score,near};}
function analyze(q){const errors=validate(q);if(errors.length)return{errors,items:[],eligible:[],pending:[],excluded:[],warnings:errors};const items=tools.map(t=>evaluate(q,t));return{errors,items,eligible:items.filter(t=>t.status==='pass').sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),pending:items.filter(t=>t.status==='unknown'),excluded:items.filter(t=>t.status==='fail'),warnings:[...(!q.known?['尺寸未确认：图形仅展示暂填值，不用于通过几何校验。']:[]),...(q.kind==='cable'?['当前工具库未覆盖缠绕电缆，需补充落物识别与专用工具资料。']:[]),...(q.depth<1500||q.depth>3500?['当前深度超出模拟历史库的主要范围，历史参考有限。']:[])]};}
function snapshot(q,selected,baseline){const r=analyze(q);return{caseId:'fishing-tool-studio',version:'1.0.0',dataStatement:'工具规格及96条历史记录均为教学模拟；匹配分非成功概率；不提供施工参数。',inputs:{...q},selected,baseline,errors:r.errors,results:r.items};}
const api={kinds,families,tools,defaults,presets,records,validate,similarity,evaluate,analyze,snapshot};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Fishing=api;
})(typeof window!=='undefined'?window:globalThis);
