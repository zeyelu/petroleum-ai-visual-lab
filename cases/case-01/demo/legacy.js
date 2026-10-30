/* Workover Studio · deterministic teaching model, no network or external dependencies. */
(function(root){
  'use strict';
  const faults={sand:'砂卡',scale:'结垢',casing:'套管损伤'};
  const equipment={ct:'连续油管设备',rig:'修井机',log:'井筒检测设备'};
  const plans=[
    {id:'sand-flush',fault:'sand',name:'连续油管清砂路径',short:'清砂',tool:'连续油管清砂工具',needs:['ct'],hours:22,success:8,kind:'恢复通道',steps:['确认砂堵位置','评估循环与返出条件','清砂路径复核','效果验证'],why:'针对砂粒沉积造成的通道阻塞，利用历史清砂案例提供候选路径。',limit:'本演示不计算循环参数；漏失、井控和返出条件需另行专业核验。'},
    {id:'sand-release',fault:'sand',name:'起出管柱检修路径',short:'管柱检修',tool:'管柱检修工具组',needs:['rig'],hours:39,success:9,kind:'检查与处理',steps:['核实卡点与管柱状态','准备起出与检修方案','处理受影响部件','复核通道与完整性'],why:'在需要检查管柱状态的砂卡情境中，参考起出检修案例。',limit:'不能据此确定解卡载荷或执行顺序；这里只比较方案类别。'},
    {id:'scale-chemical',fault:'scale',name:'相容性确认后的化学清垢路径',short:'化学清垢',tool:'清垢处理设备',needs:['ct'],chemical:true,hours:18,success:8,kind:'恢复通道',steps:['确认垢样与材质','完成相容性试验','审查清垢候选路径','验证清垢效果'],why:'只有相容性试验已确认时，才允许把化学清垢列入候选。',limit:'不提供药剂配方、浓度或施工参数；未确认相容性时必须排除。'},
    {id:'scale-mechanical',fault:'scale',name:'机械清垢检修路径',short:'机械清垢',tool:'机械清垢工具组',needs:['rig'],hours:32,success:9,kind:'机械处理',steps:['识别结垢与通径变化','检查工具与井筒匹配','审查机械清垢路径','检测处理后状态'],why:'把机械去除或检修作为另一类处理路径，并检查现场资源条件。',limit:'未建模工具磨损、材料强度和具体通径，匹配不等于可直接施工。'},
    {id:'casing-repair',fault:'casing',name:'检测后局部修复评估路径',short:'局部修复评估',tool:'井筒检测与修复工具组',needs:['log','rig'],diagnosis:true,hours:48,success:8,kind:'完整性评估',steps:['复核损伤位置与类型','检查诊断证据','评估局部修复可行性','复核完整性结果'],why:'损伤诊断已确认且资源满足时，才比较局部修复候选。',limit:'不计算承压能力；不是井筒完整性验收结论。'},
    {id:'casing-diagnose',fault:'casing',name:'补充检测与重新评估路径',short:'补充检测',tool:'井筒检测工具组',needs:['log'],hours:14,success:9,kind:'补充信息',steps:['整理已有检测记录','补充关键检测信息','重新判定损伤边界','再进入修复方案评估'],why:'诊断信息不足时，优先识别需要补齐的信息。该路径不等于完成修复。',limit:'历史完成率只指完成该路径目标，不能与修复成功率混为一谈。'}
  ];
  let seed=2301;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const records=[];
  plans.forEach((p,pi)=>{for(let i=0;i<12;i++){
    records.push({id:'HX-'+String(pi*12+i+1).padStart(3,'0'),well:'教学井 '+String(pi*12+i+1).padStart(2,'0'),plan:p.id,fault:p.fault,depth:Math.round((1600+rand()*2200)/50)*50,angle:Math.round(rand()*65),severity:1+Math.floor(rand()*3),hours:Math.round(p.hours*(0.78+rand()*0.5)),outcome:i<p.success?'完成目标':'需追加评估',note:'程序生成的教学记录，无真实油田对应关系。'});
  }});
  const defaults={fault:'sand',depth:2600,angle:35,severity:2,ct:true,rig:true,log:true,chemical:false,diagnosis:false,efficiency:45};
  const examples=[
    {name:'HX-23 · 砂卡情境',text:'教学井 HX-23：井深 2600 m，井斜 35°，砂卡程度中等。连续油管设备可用，修井机可用，检测设备可用。目标是在满足条件的候选中比较工时与案例依据。'},
    {name:'HX-08 · 结垢情境',text:'教学井 HX-08：井深 2200 m，井斜 18°，结垢程度中等。连续油管设备可用，修井机可用，检测设备可用。相容性未确认，先查看哪些路径需要排除。'},
    {name:'HX-41 · 损伤待核实',text:'教学井 HX-41：井深 3100 m，井斜 48°，套管损伤程度严重。连续油管设备不可用，修井机可用，检测设备可用。损伤诊断未确认，需要补充证据。'}
  ];
  function parse(text){
    const fields={},spans=[];
    function pick(key,re,convert){const m=re.exec(text);if(m){fields[key]=convert(m);spans.push({start:m.index,end:m.index+m[0].length,key,text:m[0]});}}
    pick('fault',/(砂卡|结垢|套管损伤)/,m=>Object.keys(faults).find(k=>faults[k]===m[1]));
    pick('depth',/井深\s*(\d+(?:\.\d+)?)\s*(?:m|米)/i,m=>+m[1]);
    pick('angle',/井斜\s*(\d+(?:\.\d+)?)\s*(?:°|度)/,m=>+m[1]);
    pick('severity',/程度(轻微|中等|严重)/,m=>({轻微:1,中等:2,严重:3})[m[1]]);
    [['ct','连续油管设备'],['rig','修井机'],['log','检测设备']].forEach(([key,label])=>pick(key,new RegExp(label+'(不可用|可用)'),m=>m[1]==='可用'));
    pick('chemical',/相容性(未确认|已确认)/,m=>m[1]==='已确认');
    pick('diagnosis',/损伤诊断(未确认|已确认)/,m=>m[1]==='已确认');
    const errors=[];
    if(!fields.fault)errors.push('未识别故障类型');
    if(fields.depth===undefined||fields.depth<1000||fields.depth>5000)errors.push('井深须在教学范围 1000–5000 m 内');
    if(fields.angle===undefined||fields.angle<0||fields.angle>85)errors.push('井斜须在教学范围 0–85° 内');
    if(!fields.severity)errors.push('未识别程度');
    ['ct','rig','log'].forEach(k=>{if(fields[k]===undefined)errors.push('未识别'+equipment[k]+'状态');});
    return {fields,spans:spans.sort((a,b)=>a.start-b.start),errors};
  }
  function similarity(q,r){return 100*(0.4*(q.fault===r.fault?1:0)+0.25*Math.max(0,1-Math.abs(q.depth-r.depth)/2500)+0.2*Math.max(0,1-Math.abs(q.angle-r.angle)/85)+0.15*(1-Math.abs(q.severity-r.severity)/2));}
  function constraints(q,p){
    const checks=[{label:'故障类型一致',pass:q.fault===p.fault,reason:'面向'+faults[p.fault]+'，当前为'+faults[q.fault]}];
    p.needs.forEach(k=>checks.push({label:equipment[k]+'可用',pass:!!q[k],reason:'需要'+equipment[k]}));
    if(p.chemical)checks.push({label:'相容性已确认',pass:!!q.chemical,reason:'相容性尚未确认'});
    if(p.diagnosis)checks.push({label:'损伤诊断已确认',pass:!!q.diagnosis,reason:'损伤诊断证据尚未确认'});
    return checks;
  }
  function recommend(q){
    const weights={similarity:0.55,evidence:0.30*(1-q.efficiency/100),time:0.30*q.efficiency/100,support:0.15};
    const items=plans.map(p=>{
      const checks=constraints(q,p),history=records.filter(r=>r.plan===p.id).map(r=>({...r,similarity:similarity(q,r)})).sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id));
      const near=history.slice(0,5),denom=near.reduce((a,r)=>a+r.similarity,0);
      const hours=near.reduce((a,r)=>a+r.hours*r.similarity,0)/denom;
      const completed=near.filter(r=>r.outcome==='完成目标').length;
      const values={similarity:near.reduce((a,r)=>a+r.similarity,0)/near.length,evidence:completed/near.length*100,time:Math.max(0,Math.min(100,(65-hours)/55*100)),support:Math.min(100,history.filter(r=>r.similarity>=80).length/8*100)};
      const parts=Object.keys(weights).map(key=>({key,weight:weights[key],value:values[key],points:weights[key]*values[key]}));
      return {...p,checks,eligible:checks.every(c=>c.pass),history,near,hours,completed,parts,score:parts.reduce((a,x)=>a+x.points,0)};
    });
    const eligible=items.filter(p=>p.eligible).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const warnings=[];
    if(q.depth<1600||q.depth>3800||q.angle>65)warnings.push('当前井况超出模拟历史库的主要范围，排序依据较弱，应补充案例与专业判断。');
    if(eligible[0]&&eligible[0].near[0].similarity<80)warnings.push('最相似记录的匹配度仍偏低，请补充信息后再比较。');
    if(q.fault==='casing')warnings.push('“补充检测”与“局部修复”目标不同：排名仅用于比较教学候选，不能把检测完成等同于修复完成。');
    return {items,eligible,weights,warnings};
  }
  const api={faults,equipment,plans,records,defaults,examples,parse,similarity,constraints,recommend};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.Workover=api;
})(typeof window==='undefined'?{}:window);
