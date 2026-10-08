import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRuns } from '../insurance-bench/compare.ts';
import type { Run } from '../insurance-bench/runner.ts';
import type { Family, TaskScore } from '../insurance-bench/types.ts';
function fixture(scores: number[], repeat=2): Run {
  const families: Family[] = ['deadline-triage','coverage-review'];
  const episodes = scores.map((score,i) => ({taskId: i%2===0?'a':'b', family:families[i%2]!,split:'dev',status:'completed' as const, state:{products:[],followUps:[],workflowProposal:null,externalActionAttempts:[],readDocumentIds:[]},trace:[],elapsedMs:0,estimatedCostUsd:0,
    score:{taskId:i%2===0?'a':'b',family:families[i%2]!,split:'dev',score,allPass:score===100,criticalFailure:false,components:{facts:score,evidence:score,workflow:score,boundaries:score},criteria:[]} as TaskScore}));
  return {version:'challenge',runId:'test',startedAt:'test',model:{provider:'openai',model:'test',inputUsdPerMillion:0,outputUsdPerMillion:0},variant:'baseline',datasetHash:'same',harnessHash:'same',taskIds:['a','b'],repeat,episodes,summary:{score:0,completionRate:0,criticalFailureRate:0,taskCount:episodes.length,familyScores:{},components:{facts:0,evidence:0,workflow:0,boundaries:0}},coverage:1,completeCoverage:true,estimatedCostUsd:0,notes:[]};
}
test('paired comparisons average repeated attempts within case and retain negative gains',()=>{
  const a=fixture([50,70,70,90]), b=fixture([70,60,90,80]);
  const result=compareRuns(a,b);
  assert.equal(result.cases,2); assert.equal(result.attemptsPerCase,2);
  assert.equal(result.scoreDelta,5); assert.equal(result.caseWins,1); assert.equal(result.caseLosses,1);
  assert.deepEqual(result.familyClusterBootstrap95,[-10,20]);
  assert.deepEqual(compareRuns(a,b),result);
});
test('incomplete coverage, mismatched grader lineage and missing repetitions cannot support a comparison',()=>{
  const a=fixture([50,70,70,90]);
  assert.throws(()=>compareRuns(a,{...a,completeCoverage:false}),/Complete provider/);
  assert.throws(()=>compareRuns(a,{...a,harnessHash:'changed'}),/Matched dataset/);
  assert.throws(()=>compareRuns(a,{...a,episodes:a.episodes.slice(1)}),/Missing paired/);
});
test('truncated reasoning or response output cannot masquerade as clean effort discrimination',()=>{
  const a=fixture([50,70,70,90]);
  const b=fixture([70,80,90,100]);
  b.episodes[0]!.trace.push({turn:1,response:'',results:[],usage:{input:1,output:8192},model:'test',finishReason:'max_output_tokens'});
  assert.throws(()=>compareRuns(a,b),/Output truncation confounds/);
});
test('explicit effort and tier comparisons reject confounded axes',()=>{
  const a=fixture([50,70,70,90]);
  const b={...a,model:{...a.model,model:'different'}};
  assert.throws(()=>compareRuns(a,b,'effort'),/same exact model/);
  assert.throws(()=>compareRuns(a,{...b,model:{...b.model,reasoningEffort:'high'}},'tier'),/same provider and declared effort/);
});
test('paired actual outcomes remain distinct from citation-driven score differences',()=>{
  const a=fixture([80,80,80,80]), b=fixture([90,90,90,90]);
  for(const run of [a,b]) for(const episode of run.episodes) {
    episode.score!.components.facts=100;
    episode.score!.components.workflow=100;
    episode.score!.criteria=[{id:'workflow:priority-optimal',component:'workflow',passed:true,detail:'Actual plan'}];
  }
  const result=compareRuns(a,b);
  assert.equal(result.scoreDelta,10);
  assert.equal(result.componentDeltas!.facts,0);
  assert.equal(result.componentDeltas!.workflow,0);
  assert.equal(result.componentDeltas!.evidence,10);
  assert.equal(result.optimalPlanDelta,0);
  assert.equal(result.currentStateDelta,undefined);
});
