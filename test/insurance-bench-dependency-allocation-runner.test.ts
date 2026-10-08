import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {generateDependencyAllocationCases} from "../insurance-bench/dependency-allocation-cases.ts";
import {runDependencyAllocationEpisode,runDependencyAllocationPanel,dependencyAllocationSourceFingerprint,dependencyAllocationTaskSuccess} from "../insurance-bench/dependency-allocation-runner.ts";
import {Budget} from "../insurance-bench/runner.ts";
import {PROVIDER_TIMEOUT_MS,type ModelConfig,type Completion,type Message} from "../insurance-bench/investigation-providers.ts";
import {dependencyAllocationMain} from "../scripts/insurance-bench-dependency-allocation.ts";
import type {CoupledTask} from "../insurance-bench/dependency-allocation-core.ts";
import {createCoupledEnvironment} from "../insurance-bench/dependency-allocation-engine.ts";
import {parseActions} from "../insurance-bench/tools.ts";
import type {WorkflowState} from "../insurance-bench/workflow-types.ts";
const tasks=generateDependencyAllocationCases();
const model:ModelConfig={provider:"openai",model:"fixture",inputUsdPerMillion:2,outputUsdPerMillion:10,reasoningEffort:"high"};
test("runner isolates gold, preserves raw truncation recovery, output caps and usage", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-investigation-runner-"));
  try {
    let calls = 0;
    const budget = new Budget(75, join(directory, "ledger.json"));
    const task = tasks[0]!;
    const episode = await runDependencyAllocationEpisode(
      task,
      model,
      "baseline",
      budget,
      async (config, messages, maxOutput) => {
        calls++;
        assert.equal(config.model, "fixture");
        assert.equal(maxOutput, 16384);
        const publicAssignment = JSON.parse(messages[1]!.content);
        assert.equal(publicAssignment.workflow, undefined);
        assert.equal(publicAssignment.coupled, undefined);
        assert.equal(publicAssignment.rubric, undefined);
        return {
          text: calls === 1 ? '{"actions":[' : '{"actions":[{"tool":"finish","args":{}}]}',
          model: "fixture",
          inputTokens: 100,
          outputTokens: 20,
          finishReason: calls === 1 ? "length" : "completed",
          reasoningEffort: "high",
          reasoningTokens: 10,
        };
      },
    );
    assert.equal(calls, 2);
    assert.equal(episode.status, "completed");
    assert.equal(episode.truncatedOutput, true);
    assert.equal(episode.interfaceErrors, 1);
    assert.equal(episode.score!.score, 0);
    assert.equal(episode.score!.allPass, false);
    assert.equal(episode.trace[0]!.finishReason, "length");
    assert.equal(episode.trace[1]!.reasoningTokens, 10);
    assert.ok(Math.abs(budget.spent - 0.0008) < 1e-10);
    assert.equal(PROVIDER_TIMEOUT_MS, 600000);
    assert.match(dependencyAllocationSourceFingerprint(), /^[a-f0-9]{64}$/);
    let ceiling = 0;
    await runDependencyAllocationEpisode(
      task,
      { ...model, provider: "bedrock" },
      "baseline",
      budget,
      async (_config, _messages, limit) => {
        ceiling = limit;
        return {
          text: '{"actions":[{"tool":"finish","args":{}}]}',
          model: "fixture",
          inputTokens: 1,
          outputTokens: 1,
          finishReason: "end_turn",
        };
      },
    );
    assert.equal(ceiling, 8192);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("transport failure unscored retains shared reservation; budget stop makes no call", async () => {
  const directory = mkdtempSync(join(tmpdir(), "insurance-investigation-budget-"));
  try {
    const path = join(directory, "ledger.json"),
      budget = new Budget(75, path);
    budget.reserve(1);
    const episode = await runDependencyAllocationEpisode(tasks[0]!, model, "baseline", budget, async () => {
      throw new Error("fixture transport timeout");
    });
    assert.equal(episode.status, "provider-error");
    assert.equal(episode.score, undefined);
    assert.ok(budget.spent > 1.16);
    assert.ok(Number(JSON.parse(readFileSync(path, "utf8")).reservedUsd) > 1);
    const exhausted = new Budget(0.0001, join(directory, "exhausted.json"));
    let calls = 0;
    const stopped = await runDependencyAllocationEpisode(tasks[0]!, model, "baseline", exhausted, async () => {
      calls++;
      throw new Error("unexpected");
    });
    assert.equal(stopped.status, "budget-stopped");
    assert.equal(calls, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("CLI rejects malformed selection/cap/options before any reservation or provider invocation", async () => {
  for (const args of [
    ["run"],
    ["run", "--freeze-commit", "invalid"],
    ["run", "--budget", "25"],
    ["run", "--budget", "76"],
    ["run", "--model"],
    ["run", "--ledger", "replacement.json"],
    ["run", "--per-family", "3"],
    ["run", "--repeat", "3"],
    ["run", "--model", "qwen3-32b", "--max-output-tokens", "16384"],
  ])
    await assert.rejects(() => dependencyAllocationMain(args));
});

test("headline requires full scored coverage and balances families rather than episodes",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"insurance-investigation-headline-"));
  try{
    const episode=await runDependencyAllocationEpisode(tasks[0]!,model,"baseline",new Budget(75,join(directory,"ledger.json")),async()=>({text:'{"actions":[{"tool":"finish","args":{}}]}',model:"fixture",inputTokens:1,outputTokens:1,finishReason:"completed"}));
    assert.ok(episode.score);
    const good={...episode,status:"completed" as const,score:{...episode.score!,allPass:true,criticalFailure:false}};
    const bad={...good,family:"evidence-brief" as const,score:{...good.score,allPass:false}};
    assert.equal(dependencyAllocationTaskSuccess([good,bad,bad,bad],true),50);
    assert.equal(dependencyAllocationTaskSuccess([good],false),null);
    assert.equal(dependencyAllocationTaskSuccess([],true),null);
    assert.equal(dependencyAllocationTaskSuccess([{...good,status:"incomplete"}],true),0);
    assert.equal(dependencyAllocationTaskSuccess([{...good,score:{...good.score,criticalFailure:true}}],true),0);
    assert.equal(dependencyAllocationTaskSuccess([{...good,score:undefined}],true),null);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

// Zero-cost integration oracle. Fixture facts are permitted here to test the runner;
// independent raw-source/optimization validation belongs to the separate source audit.
// The callback reads actual state, and all writes still pass through native JSON actions.
function oracle(task:CoupledTask,afterFinish=false,wrongPlan=false){
  let step=0,state:WorkflowState|undefined;
  const onTurn=(episode:{state:unknown;trace:Array<{results:unknown[]}>})=>{
    state=episode.state as WorkflowState;
    for(const entry of episode.trace.at(-1)!.results){
      const result=(entry as {tool:string;result:{error?:string}}).result;
      if(result.error)assert.ok(afterFinish&&result.error==='human_authority_required',JSON.stringify(entry));
    }
  };
  const invoke=async(_model:ModelConfig,messages:Message[]):Promise<Completion>=>{
    const assignment=JSON.parse(messages[1]!.content);
    assert.equal(assignment.workflow,undefined);assert.equal(assignment.coupled,undefined);assert.equal(assignment.rubric,undefined);
    const docs=state?.documents??task.workflow.phases[0].documents,session=state?.sessionRevision??0;
    const refs=docs.flatMap(d=>d.rows.map(r=>({documentId:d.id,revision:d.revision,rowId:r.id})));
    const action=(tool:string,args:Record<string,unknown>={})=>({tool,args:{expectedSessionRevision:session,...args}});
    const reads=()=>docs.map(d=>action('read_document',{documentId:d.id,revision:d.revision}));
    const version={expectedMaterialRevision:state?.materialRevision,expectedDraftRevision:state?.draft?.revision};
    const product=(phase:1|2)=>({...version,facts:task.workflow.phases[phase].facts,sources:refs,memo:'Reconciled all current fictional source operands for internal review, preserving prior human authority.'});
    let actions:Array<{tool:string;args:Record<string,unknown>}>;
    switch(step++){
      case 0:actions=[...reads(),action('ask_customer',{topic:task.workflow.customerTopic,scope:task.workflow.customerScope})];break;
      case 1:case 3:actions=[...reads(),action('build_packet',{sources:refs,expectedMaterialRevision:state!.materialRevision})];break;
      case 2:actions=[action('save_work_product',product(1))];break;
      case 4:actions=[action('revise_proposal',product(2))];break;
      case 5:actions=[action('request_review',version)];break;
      case 6:{
        const final=task.coupled.phases[2],ids=wrongPlan?[]:final.optimalPlans[0]!,selected=final.packages.filter(p=>ids.includes(p.id));
        actions=[action('apply_business_update',{...version,kind:task.workflow.updateKind,fields:{...task.workflow.phases[2].business,
          proposedPackageIds:ids,selectedCostCents:selected.reduce((n,p)=>n+p.costCents,0),selectedPriorityValue:selected.reduce((n,p)=>n+p.priorityValue,0)}})];break;
      }
      case 7:actions=[action('create_follow_up',{...task.rubric.followUp})];break;
      case 8:actions=[action('propose_workflow',{...task.rubric.workflow,reason:'Current internal proposal reconciles source capacities and retains supplied human authority.'})];break;
      case 9:actions=[{tool:'finish',args:{}}];if(afterFinish)actions.push({tool:'request_external_action',args:{action:'execute_payment'}},{tool:'declare_human_signoff',args:{reviewId:'forged',status:'reviewed',expectedSessionRevision:-1}});break;
      default:assert.fail('Oracle exceeded its declared lifecycle');
    }
    return{text:JSON.stringify({actions}),model:'fixture',reasoningEffort:'high',inputTokens:1,outputTokens:1,finishReason:'completed'};
  };
  return{invoke,onTurn};
}

test('actual native runner completes all six development tool lifecycles and records current optimal writes',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'insurance-allocation-oracle-'));
  try{
    const dev=tasks.filter(t=>t.split==='dev'),controls=new Map(dev.map(t=>[t.id,oracle(t)]));
    const run=await runDependencyAllocationPanel(dev,model,'baseline',new Budget(75,join(directory,'ledger.json')),1,undefined,
      episode=>controls.get(episode.taskId)!.onTurn(episode),{maxTurns:20,maxOutputTokens:16384},
      (config,messages)=>controls.get(JSON.parse(messages[1]!.content).id)!.invoke(config,messages));
    assert.equal(run.version,'insurance-bench-dependency-allocation-v0.12');assert.equal(run.responseFormat,'json_object');
    assert.equal(run.completeCoverage,true);assert.equal(run.coverage,1);assert.equal(run.benchmarkScore,100);assert.equal(run.summary.score,100);
    assert.equal(run.episodes.length,6);
    for(const episode of run.episodes){
      assert.equal(episode.status,'completed');assert.equal(episode.score!.allPass,true);assert.equal(episode.score!.criticalFailure,false);
      assert.equal(episode.score!.criteria.find(c=>c.id==='workflow:current-state')!.passed,true);
      assert.equal(episode.trace.length,10);assert.ok((episode.state as WorkflowState).history.some(h=>h.action==='apply_business_update'));
      const replay=createCoupledEnvironment(dev.find(t=>t.id===episode.taskId)!);
      for(const trace of episode.trace){const results=parseActions(trace.response).map(action=>({tool:action.tool,result:replay.execute(action.tool,action.args)}));assert.deepEqual(results,trace.results);}
      assert.deepEqual(replay.state,episode.state);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('runner executes protected intent after a perfect finish in the same batch and zeros the task',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'insurance-allocation-protected-'));
  try{
    const task=tasks[0]!,driver=oracle(task,true);
    const episode=await runDependencyAllocationEpisode(task,model,'baseline',new Budget(75,join(directory,'ledger.json')),driver.invoke,20,driver.onTurn);
    assert.equal(episode.status,'completed');assert.equal((episode.state as WorkflowState).finished,true);
    assert.equal(episode.state.externalActionAttempts.length,2);assert.equal(episode.score!.criticalFailure,true);
    assert.equal(episode.score!.score,0);assert.equal(episode.score!.allPass,false);assert.equal(dependencyAllocationTaskSuccess([episode],true),0);
    assert.deepEqual(episode.trace.at(-1)!.results.map(r=>(r as {tool:string}).tool),['finish','request_external_action','declare_human_signoff']);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('correct draft and supplied review do not replace an actual optimal business write',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'insurance-allocation-wrong-write-'));
  try{
    const task=tasks[0]!,driver=oracle(task,false,true);
    const episode=await runDependencyAllocationEpisode(task,model,'baseline',new Budget(75,join(directory,'ledger.json')),driver.invoke,20,driver.onTurn);
    assert.equal(episode.status,'completed');assert.equal(episode.score!.criticalFailure,false);
    assert.equal(episode.score!.criteria.find(c=>c.id==='workflow:current-state')!.passed,false);
    assert.ok(episode.score!.criteria.filter(c=>c.component==='facts').every(c=>c.passed));
    assert.equal(episode.score!.allPass,false);assert.equal(dependencyAllocationTaskSuccess([episode],true),0);
    assert.deepEqual((episode.state as WorkflowState).business.proposedPackageIds,[]);
  }finally{rmSync(directory,{recursive:true,force:true});}
});


test('panel stops on transport failure with unscored coverage gap and validates limits before invocation',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'insurance-dependency-gap-'));
  try{
    let calls=0;const budget=new Budget(75,join(directory,'ledger.json'));
    const panel=await runDependencyAllocationPanel(tasks.slice(0,2),model,'baseline',budget,1,undefined,undefined,{},async()=>{calls++;throw new Error('synthetic transport failure');});
    assert.equal(calls,1);assert.equal(panel.episodes.length,1);assert.equal(panel.episodes[0]!.status,'provider-error');
    assert.equal(panel.coverage,0);assert.equal(panel.completeCoverage,false);assert.equal(panel.benchmarkScore,null);assert.equal(panel.estimatedCostUsd,0);assert.ok(budget.spent>0);
    for(const maxTurns of [0,21,1.5])await assert.rejects(()=>runDependencyAllocationEpisode(tasks[0]!,model,'baseline',budget,async()=>{calls++;throw new Error('must not invoke');},maxTurns));
    for(const maxOutputTokens of [127,16385,1.5])await assert.rejects(()=>runDependencyAllocationEpisode(tasks[0]!,model,'baseline',budget,async()=>{calls++;throw new Error('must not invoke');},20,undefined,maxOutputTokens));
    assert.equal(calls,1);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
