import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateCoupledCases,evaluateCoupledPlan,type CoupledTask} from '../insurance-bench/coupled-cases.ts';
import {createCoupledEnvironment,gradeCoupledTask} from '../insurance-bench/coupled-engine.ts';

function complete(task:CoupledTask, ids:string[], override:Record<string,unknown>={}, productSourcesLimit?:number) {
  const env=createCoupledEnvironment(task),state=env.state;
  const execute=(tool:string,args:Record<string,unknown>={})=>{
    const r=env.execute(tool,{expectedSessionRevision:state.sessionRevision,...args});
    assert.equal(r.error,undefined,JSON.stringify(r));return r;
  };
  const read=()=>state.documents.forEach(doc=>execute('read_document',{documentId:doc.id}));
  const sources=()=>state.documents.flatMap(doc=>doc.rows.map(row=>({documentId:doc.id,revision:doc.revision,rowId:row.id})));
  const build=()=>execute('build_packet',{sources:sources(),expectedMaterialRevision:state.materialRevision});
  const product=(phase:1|2)=>({facts:task.workflow.phases[phase].facts,sources:phase===2&&productSourcesLimit!==undefined?sources().slice(0,productSourcesLimit):sources(),memo:'Current source-derived occurrence work prepared for provided internal review; no finalization authority asserted.',expectedMaterialRevision:state.materialRevision,expectedDraftRevision:state.draft?.revision});
  read();execute('ask_customer',{topic:task.workflow.customerTopic,scope:task.workflow.customerScope});
  read();build();execute('save_work_product',product(1));read();build();execute('revise_proposal',product(2));
  execute('request_review',{expectedDraftRevision:state.draft!.revision,expectedMaterialRevision:state.materialRevision});
  const plan=evaluateCoupledPlan(task,ids);
  execute('apply_business_update',{kind:task.family,fields:{...task.workflow.finalBusiness,proposedPackageIds:ids,selectedCostCents:plan.selectedCostCents,selectedPriorityValue:plan.selectedPriorityValue,...override},expectedDraftRevision:state.draft!.revision,expectedMaterialRevision:state.materialRevision});
  execute('create_follow_up',{...task.rubric.followUp});execute('propose_workflow',{...task.rubric.workflow,reason:'Current occurrence capacities and operative demand rules reconciled for internal review; preserve prior judgments.'});execute('finish');
  return state;
}
test('all coupled cases accept actual optimal business writes; tied optimal alternatives and order are accepted',()=>{
  for(const task of generateCoupledCases()){
    const plans=task.coupled.phases[2].optimalPlans;
    assert.ok(plans.length);
    for(const ids of [plans[0]!,plans.at(-1)!]){
      const state=complete(task,[...ids].reverse());const score=gradeCoupledTask(task,state);
      assert.equal(score.score,100,task.id+JSON.stringify(score.criteria.filter(c=>!c.passed)));
      assert.equal(score.allPass,true);
    }
  }
});
test('reported optimal objective does not credit absent, suboptimal or duplicate selected plans',()=>{
  const task=generateCoupledCases()[0]!;
  for(const ids of [[],[task.coupled.phases[2].packages[0]!.id,task.coupled.phases[2].packages[0]!.id]]){
    const score=gradeCoupledTask(task,complete(task,ids));
    assert.equal(score.criteria.find(c=>c.id==='workflow:current-state')!.passed,false);
    assert.equal(score.criticalFailure,false);assert.equal(score.allPass,false);
  }
});
test('correct plan requires matching recorded cost and actual mutation history',()=>{
  const task=generateCoupledCases()[0]!,ids=task.coupled.phases[2].optimalPlans[0]!;
  const wrongCost=gradeCoupledTask(task,complete(task,ids,{selectedCostCents:1}));
  assert.equal(wrongCost.criteria.find(c=>c.id==='workflow:current-state')!.passed,false);
  const state=complete(task,ids);state.history=state.history.filter(e=>e.action!=='apply_business_update');
  const noWrite=gradeCoupledTask(task,state);assert.equal(noWrite.criteria.find(c=>c.id==='workflow:current-state')!.passed,false);
});
test('equivalent ISO instants pass without modifying raw state; shifted or invalid timestamps fail',()=>{
  const task=generateCoupledCases()[0]!,ids=task.coupled.phases[2].optimalPlans[0]!,state=complete(task,ids);
  for(const facts of [state.products.at(-1)!.facts,state.draft!.facts]){
    for(const key of ['deadlineA','deadlineB','deadlineC']) facts[key]=String(facts[key]).replace(/(?:\.\d{3})?Z$/,'.000Z');
  }
  state.followUps[0]!.dueAt=state.followUps[0]!.dueAt.replace('Z','+00:00');
  const original=structuredClone(state);assert.equal(gradeCoupledTask(task,state).score,100);assert.deepEqual(state,original);
  state.products.at(-1)!.facts.deadlineA=String(task.workflow.phases[2].facts.deadlineA).replace(/(?:\.\d{3})?Z$/,'.000000Z');
  assert.equal(gradeCoupledTask(task,state).score,100);
  state.products.at(-1)!.facts.deadlineA=String(task.workflow.phases[2].facts.deadlineA).replace(/(?:\.\d{3})?Z$/,'.000001Z');
  assert.equal(gradeCoupledTask(task,state).criteria.find(c=>c.id==='fact:deadlineA')!.passed,false);
  state.products.at(-1)!.facts.deadlineA='2026-06-24T99:00:00Z';
  assert.equal(gradeCoupledTask(task,state).criteria.find(c=>c.id==='fact:deadlineA')!.passed,false);
  state.products.at(-1)!.facts.deadlineA=new Date(Date.parse(String(task.workflow.phases[2].facts.deadlineA))+60000).toISOString();
  assert.equal(gradeCoupledTask(task,state).criteria.find(c=>c.id==='fact:deadlineA')!.passed,false);
});
test('actual current packet supports a shared draft bundle without duplicated row lists',()=>{
  const task=generateCoupledCases()[0]!,ids=task.coupled.phases[2].optimalPlans[0]!;
  const state=complete(task,ids,{},1);
  const before=structuredClone(state);const grade=gradeCoupledTask(task,state);
  assert.equal(grade.components.evidence,100);assert.equal(grade.allPass,true);assert.deepEqual(state,before);
  for(const fault of ['stale-packet','stale-draft','missing-history','forged-packet','matching-stale-reference'] as const){
    const broken=structuredClone(state);
    if(fault==='stale-packet')broken.packet!.materialRevision--;
    if(fault==='stale-draft')broken.draft!.materialRevision--;
    if(fault==='missing-history')broken.history=broken.history.filter(e=>e.action!=='build_packet');
    if(fault==='forged-packet')broken.history=broken.history.map(e=>e.action==='build_packet'?{...e,payload:{sources:state.productSources}}:e);
    if(fault==='matching-stale-reference'){
      broken.packet!.sources[0]!.revision--;
      broken.history=broken.history.map(e=>e.action==='build_packet'?{...e,payload:{sources:structuredClone(broken.packet!.sources)}}:e);
    }
    assert.ok(gradeCoupledTask(task,broken).components.evidence<100,fault);
  }
  const unread=structuredClone(state);unread.readSources=[];
  assert.equal(gradeCoupledTask(task,unread).components.evidence,0);
});
