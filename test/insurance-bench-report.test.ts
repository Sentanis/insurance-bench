import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildReport } from '../insurance-bench/report.ts';
import type { Run } from '../insurance-bench/runner.ts';
import {emptyState} from '../insurance-bench/types.ts';
import { admitRegisteredReportPanels, type ReportBuilderIO } from '../insurance-bench/report-admission.ts';
type TaskSuccessRun = Run & { headlineMetric: 'macro-task-success'; benchmarkScore: number | null };
const fixture = (completeCoverage: boolean): Run => ({ version:'test',runId:'test',startedAt:'2026-10-03',model:{provider:'openai',model:'<script>bad</script>',inputUsdPerMillion:2,outputUsdPerMillion:10},variant:'baseline',datasetHash:'test',harnessHash:'test',taskIds:['one','two'],repeat:1,episodes:[],summary:{score:100,completionRate:100,criticalFailureRate:0,taskCount:1,familyScores:{},components:{facts:100,evidence:100,workflow:100,boundaries:100}},coverage:.5,completeCoverage,estimatedCostUsd:0,notes:[] });
const comparisonRun = (runId: string): Run => {
 const base=fixture(true);
 return {...base,runId,summary:{...base.summary,taskCount:2},coverage:1,episodes:base.taskIds.map((taskId,index)=>({
  taskId,family:index ? 'deadline-triage':'coverage-review',split:'dev',status:'completed',state:emptyState(),
  trace:[],elapsedMs:1,estimatedCostUsd:0,score:{taskId,family:index ? 'deadline-triage':'coverage-review',split:'dev',
  score:100,allPass:true,criticalFailure:false,components:base.summary.components,criteria:[]},
 }))};
};
test('incomplete coverage suppresses all three headline capability and risk metrics', () => {
  const html = buildReport([fixture(false)]);
  assert.equal((html.match(/Unavailable/g) ?? []).length, 3);
  assert.ok(html.includes('1/2'));
  assert.ok(!html.includes('<td>100.0%</td>'));
  assert.ok(!html.includes('<script>bad'));
  assert.ok(html.includes('&lt;script&gt;bad'));
  assert.ok(!html.includes('· undefined'));
});
test('report renders complete results and explicit bounded-reasoning limitation', () => {
  const html = buildReport([fixture(true)]);
  assert.ok(html.includes('<td>100.0%</td>'));
  assert.ok(html.includes('4096-token output ceiling'));
  assert.ok(html.includes('different internal reasoning behavior'));
});
test('same-model effort labels and paired uncertainty remain visible without hiding losses',()=>{
  const low={...comparisonRun('low'),model:{...fixture(true).model,reasoningEffort:'low' as const}};
  const high={...comparisonRun('high'),model:{...fixture(true).model,reasoningEffort:'high' as const}};
  const html=buildReport([low,high],{generation:'v0.3',comparisons:[{baselineRunId:'low',treatmentRunId:'high',cases:2,attemptsPerCase:1,scoreDelta:-2,completionDelta:-16.67,caseWins:1,caseTies:0,caseLosses:1,familyClusterBootstrap95:[-12,8],families:[],caveat:'test'}]});
  assert.ok(html.includes('effort low')); assert.ok(html.includes('effort high'));
  assert.ok(html.includes('-2.00 pp')); assert.ok(html.includes('-12.00 to 8.00 pp'));
  assert.ok(html.includes('1 / 0 / 1')); assert.ok(html.includes('16384-token output ceiling'));
});
test('report infers generation from selected runs when context metadata is absent',()=>{
  const html=buildReport([{...fixture(true),version:'insurance-bench-challenge-v0.3'}]);
  assert.ok(html.includes('Synthetic research pilot · insurance-bench-challenge-v0.3'));
});
test('invalidated measurement candidates retain raw evidence but suppress all headline metrics',()=>{
 const run=fixture(true);
 const html=buildReport([run],{invalidRunIds:['test']});
 assert.equal((html.match(/Superseded<\/td>/g)??[]).length,3);
 assert.ok(html.includes('raw values are retained'));
 assert.ok(!html.includes('<td>100.0%</td>'));
});

test('optimal-plan outcome stays visible independently of weighted citation performance',()=>{
 const run:Run={...fixture(true),version:'insurance-bench-frontier-v0.5',summary:{...fixture(true).summary,score:50},episodes:[true,false].map((passed,index)=>({taskId:String(index),family:'deadline-triage',split:'dev',status:'completed',state:emptyState(),trace:[],elapsedMs:1,estimatedCostUsd:0,score:{taskId:String(index),family:'deadline-triage',split:'dev',score:50,allPass:false,criticalFailure:false,components:fixture(true).summary.components,criteria:[{id:'workflow:priority-optimal',component:'workflow',passed,detail:'Actual reserved plan'}]}}))};
 const html=buildReport([run]);
  assert.ok(html.includes('<th>Actual outcome</th>'));
  assert.ok(html.includes('50.0%<small>Optimal reserved plan</small>'));
 assert.ok(html.includes('independently of citation and memo credit'));
 const invalid=buildReport([run],{invalidRunIds:['test']});
 assert.equal((invalid.match(/Superseded<\/td>/g)??[]).length,4);
});
test('changing-record outcomes show recorded business state rather than static optimization',()=>{
 const base=fixture(true);
 const run:Run={...base,version:'insurance-bench-workflows-v0.6',episodes:[{taskId:'state',family:'deadline-triage',split:'holdout',status:'completed',state:emptyState(),trace:[],elapsedMs:1,estimatedCostUsd:0,score:{taskId:'state',family:'deadline-triage',split:'holdout',score:90,allPass:false,criticalFailure:false,components:base.summary.components,criteria:[{id:'workflow:current-state',component:'workflow',passed:true,detail:'Recorded current state'}]}}]};
 const html=buildReport([run]);
 assert.ok(html.includes('100.0%<small>Current business state</small>'));
 assert.ok(!html.includes('100.0%<small>Optimal reserved plan</small>'));
});

test('different corpora and harness limits are visibly separated from matched panels', () => {
  const base = fixture(true);
  const alternateCorpus = { ...base, runId: 'corpus', datasetHash: 'different-corpus' };
  const alternateLimits = { ...base, runId: 'limits', harnessHash: 'different-limits' };
  const matched = { ...base, runId: 'matched' };
  const html = buildReport([base, alternateCorpus, alternateLimits, matched]);
  assert.equal((html.match(/Scores in different panels/g) ?? []).length, 3);
  assert.ok(html.includes('Dataset different-corpus'));
  assert.ok(html.includes('Harness different-limits'));
});

test('documented provider condition caveats remain visible and escaped', () => {
  const html = buildReport([fixture(true)], {
    conditionWarnings: { test: 'Requested output exceeds advertised limit <8K>; exact failure cause unknown.' },
  });
  assert.ok(html.includes('Condition caveat:'));
  assert.ok(html.includes('&lt;8K&gt;'));
  assert.ok(!html.includes('<8K>'));
});

test('semantic evidence handoffs remain structural outcomes with disclosed score dependence', () => {
  const base = fixture(true);
  const run: Run = { ...base, version: 'insurance-bench-evidence-v0.8', episodes: [{
    taskId: 'handoff', family: 'evidence-brief', split: 'dev', status: 'completed',
    state: emptyState(), trace: [], elapsedMs: 1, estimatedCostUsd: 0,
    score: { taskId: 'handoff', family: 'evidence-brief', split: 'dev', score: 40,
      allPass: false, criticalFailure: false, components: base.summary.components,
      criteria: [{ id: 'workflow:current-state', component: 'workflow', passed: true,
        detail: 'Current structural handoff; some labels incorrect' }] },
  }] };
  const html = buildReport([run]);
  assert.ok(html.includes('100.0%<small>Current internally reviewed handoff</small>'));
  assert.ok(html.includes('does not duplicate an all-facts-correct gate'));
  assert.ok(html.includes('facts and evidence remain dependent'));
  assert.ok(html.includes('Three correlated narrative evidence task families'));
});

test('repetitions, mixed splits and missing primary selections are explicit', () => {
  const base = fixture(true);
  const repeated = { ...base, runId: 'repeated', repeat: 2 };
  assert.equal((buildReport([base, repeated]).match(/Scores in different panels/g) ?? []).length, 2);
  assert.ok(buildReport([repeated]).includes('2 attempt(s) per case'));
  const mixed: Run = { ...base, episodes: ['dev', 'holdout'].map(split => ({
    taskId: split, family: 'coverage-review', split: split as 'dev' | 'holdout',
    status: 'incomplete', state: emptyState(), trace: [], elapsedMs: 0, estimatedCostUsd: 0,
  })) };
  assert.ok(buildReport([mixed]).includes('dev + holdout panel'));
  const missing = buildReport([base], { primaryRunIds: ['absent<script>'] });
  assert.ok(missing.includes('No selected primary runs are available'));
  assert.ok(missing.includes('Missing selected primary runs:'));
  assert.ok(missing.includes('absent&lt;script&gt;'));
  assert.ok(missing.includes('Development and historical runs (1)'));
  assert.ok(!missing.includes('No real provider runs recorded yet'));
});

test('new evidence headline preserves diagnostic partial credit and older metric definitions', () => {
  const base = fixture(true);
  const evidence = { ...base, runId: 'evidence', version: 'insurance-bench-evidence-v0.8',
    headlineMetric: 'macro-task-success', benchmarkScore: 50,
    summary: { ...base.summary, score: 94.5 } };
  const html = buildReport([evidence, base]);
  assert.ok(html.includes('50.0<small>Task success /100</small>'));
  assert.ok(html.includes('Diagnostic partial credit 94.5 /100'));
  assert.ok(html.includes('Earlier generations retain their original weighted score'));
  assert.ok(html.includes('<td class="score">100.0</td>'));
  const missingMetric = { ...evidence, benchmarkScore: null };
  assert.ok(buildReport([missingMetric]).includes('Missing task-success metric'));
  assert.ok(buildReport([{ ...evidence, completeCoverage: false }]).includes('<td class="score">Unavailable</td>'));
});

test('investigation headline uses task success and labels a structural handoff separately from semantics', () => {
  const base = fixture(true);
  const episode = (taskId: string, solved: boolean): Run['episodes'][number] => ({
    taskId, family: 'coverage-review', split: 'dev', status: 'completed', state: emptyState(),
    trace: [], elapsedMs: 1, estimatedCostUsd: 0,
    score: { taskId, family: 'coverage-review', split: 'dev', score: solved ? 100 : 84,
      allPass: solved, criticalFailure: false, components: base.summary.components,
      criteria: [
        { id: 'workflow:handoff', component: 'workflow', passed: true, detail: 'Actual current reviewed write' },
        { id: 'workflow:currentRequests', component: 'workflow', passed: solved, detail: 'Scoped requests' },
        { id: 'fact:obligation', component: 'facts', passed: solved, detail: 'Semantic decision' },
        // This unrelated criterion must not be used for investigation outcomes.
        { id: 'workflow:current-state', component: 'workflow', passed: solved, detail: 'Other generation' },
      ] },
  });
  const investigation: TaskSuccessRun = { ...base, version: 'insurance-bench-investigation-v0.9',
    headlineMetric: 'macro-task-success', benchmarkScore: 50,
    summary: { ...base.summary, score: 92, completionRate: 50 },
    episodes: [episode('one', true), episode('two', false)] };
  const html = buildReport([investigation]);
  assert.ok(html.includes('50.0<small>Task success /100</small>'));
  assert.ok(html.includes('Diagnostic partial credit 92.0 /100'));
  assert.ok(html.includes('100.0%<small>Current structural investigation handoff</small>'));
  assert.ok(!html.includes('100.0%<small>Optimal current proposal plan</small>'));
  assert.ok(html.includes('Three conditional investigation task families'));
  assert.ok(html.includes('currentRequests criterion separately checks'));
  assert.ok(html.includes('does not certify all semantic facts'));
  assert.ok(html.includes('600-second provider deadline'));
  assert.ok(html.includes('Diagnostic weighted family scores below'));
  const limitedEpisode = { ...investigation.episodes[1]!, truncatedOutput: true };
  const limitedRun: TaskSuccessRun = { ...investigation, episodes: [investigation.episodes[0]!, limitedEpisode] };
  const limited = buildReport([limitedRun]);
  assert.ok(limited.includes('output truncation observed'));
  assert.ok(limited.includes('50.0<small>Task success /100</small>'));
  const missingMetric: TaskSuccessRun = { ...investigation, benchmarkScore: null };
  const missing = buildReport([missingMetric]);
  assert.ok(missing.includes('Missing task-success metric'));
  assert.ok(!missing.includes('<td class="score">92.0</td>'));
  const partial = buildReport([{ ...investigation, completeCoverage: false }]);
  assert.ok(partial.includes('<td class="score">Unavailable</td>'));
  const invalid = buildReport([investigation], { invalidRunIds: [investigation.runId] });
  assert.equal((invalid.match(/Superseded<\/td>/g) ?? []).length, 4);
  assert.ok(!invalid.includes('<td class="score">50.0'));
});

test('investigation treatment, harness and corpus panels do not imply a common comparison', () => {
  const baseline = { ...fixture(true), version: 'insurance-bench-investigation-v0.9',
    headlineMetric: 'macro-task-success', benchmarkScore: 50 };
  const reminder = { ...baseline, runId: 'reminder', variant: 'verify-before-finish' as const };
  const harness = { ...baseline, runId: 'harness', harnessHash: 'different-harness' };
  const corpus = { ...baseline, runId: 'corpus', datasetHash: 'different-corpus' };
  const html = buildReport([baseline, reminder, harness, corpus]);
  assert.equal((html.match(/Scores in different panels/g) ?? []).length, 4);
  assert.ok(html.includes('verify-before-finish'));
  assert.ok(html.includes('No professional prose assessment or insurance validity is implied'));
});


test('interaction and native JSON ablation preserve task-success metric and current handoff without pooling generations', () => {
  const base = fixture(true);
  const episodes: Run['episodes'] = base.taskIds.map(taskId => ({ taskId, family: 'coverage-review', split: 'dev', status: 'completed', state: emptyState(), trace: [], elapsedMs: 1, estimatedCostUsd: 0, score: { taskId, family: 'coverage-review', split: 'dev', score: 95, allPass: false, criticalFailure: false, components: base.summary.components, criteria: [{ id: 'workflow:handoff', component: 'workflow', passed: true, detail: 'current saved internal handoff' }] } }));
  const interaction: TaskSuccessRun & { responseFormat: string } = { ...base, episodes, runId: 'interaction', version: 'insurance-bench-interaction-v0.10', responseFormat: 'json_object', headlineMetric: 'macro-task-success', benchmarkScore: 0, summary: { ...base.summary, score: 95 } };
  const json: TaskSuccessRun = { ...interaction, runId: 'json-object', version: 'insurance-bench-investigation-v0.9j-json-object' };
  const html = buildReport([interaction, json]);
  assert.equal((html.match(/0.0<small>Task success \/100<\/small>/g) ?? []).length, 2);
  assert.ok(html.includes('Diagnostic partial credit 95.0 /100'));
  assert.ok(html.includes('Current structural investigation handoff'));
  assert.ok(html.includes('syntactic validity does not establish correct decisions'));
  assert.ok(html.includes('Action transport: json_object'));
  assert.equal((html.match(/Scores in different panels/g) ?? []).length, 2);
  const missing: TaskSuccessRun = { ...interaction, benchmarkScore: null };
  assert.ok(buildReport([missing]).includes('Missing task-success metric'));
  assert.ok(buildReport([{ ...json, completeCoverage: false }]).includes('<td class="score">Unavailable</td>'));
});


test('allocation interaction uses native task success and actual optimal current write independently', () => {
  const base = fixture(true);
  const run: TaskSuccessRun & { responseFormat: string } = {...base, version:'insurance-bench-allocation-interaction-v0.11',headlineMetric:'macro-task-success',benchmarkScore:50,responseFormat:'json_object',summary:{...base.summary,score:92},episodes:[true,false].map((passed,index)=>({taskId:String(index),family:'coverage-review',split:'dev',status:'completed',state:emptyState(),trace:[],elapsedMs:1,estimatedCostUsd:0,score:{taskId:String(index),family:'coverage-review',split:'dev',score:92,allPass:passed,criticalFailure:false,components:base.summary.components,criteria:[{id:'workflow:current-state',component:'workflow',passed,detail:'Actual optimal current proposal'}]}}))};
  const html=buildReport([run]);
  assert.ok(html.includes('50.0<small>Task success /100</small>'));
  assert.ok(html.includes('Diagnostic partial credit92.0') || html.includes('Diagnostic partial credit 92.0'));
  assert.ok(html.includes('50.0%<small>Optimal current proposal plan</small>'));
  assert.ok(html.includes('Action transport: json_object'));
  assert.ok(html.includes('larger search is not evidence of greater difficulty'));
  const incomplete=buildReport([{...run,completeCoverage:false}]);
  assert.ok(!incomplete.includes('50.0<small>Task success /100</small>'));
  const invalid=buildReport([run],{invalidRunIds:[run.runId]});
  assert.ok(!invalid.includes('50.0<small>Task success /100</small>'));
});

test('copied contrasts fail closed while native scores remain visible', () => {
 const baseline=comparisonRun('baseline'), treatment=comparisonRun('treatment');
 const comparison={baselineRunId:baseline.runId,treatmentRunId:treatment.runId,cases:2,attemptsPerCase:1,
  scoreDelta:12.34,completionDelta:50,caseWins:2,caseTies:0,caseLosses:0,
  familyClusterBootstrap95:[1,20] as [number,number],families:[],caveat:'Original stored interval'};
 assert.ok(buildReport([baseline,treatment],{comparisons:[comparison]}).includes('12.34 pp'));
 assert.ok(buildReport([baseline,treatment],{comparisons:[{...comparison,caseWins:3}]}).includes('comparison case counts do not match coverage'));
 const mutations: Array<[Run[],string[] | undefined,string]> = [
  [[baseline],undefined,'missing or ambiguous'],
  [[baseline,treatment],[treatment.runId],'superseded'],
  [[baseline,{...treatment,completeCoverage:false}],undefined,'incomplete provider'],
  [[baseline,{...treatment,episodes:treatment.episodes.map(e=>({...e,truncatedOutput:true}))}],undefined,'cumulative output'],
  [[baseline,{...treatment,episodes:treatment.episodes.map(e=>({...e,trace:[{turn:1,response:'recovered',results:[],usage:{input:1,output:1},model:'fixture',finishReason:'max_output_tokens'}]}))}],undefined,'cumulative output'],
  [[baseline,{...treatment,harnessHash:'unmatched<script>'}],undefined,'unmatched frozen'],
  [[baseline,{...treatment,taskIds:[...treatment.taskIds].reverse()}],undefined,'unmatched frozen'],
  [[baseline,{...treatment,episodes:treatment.episodes.map(e=>({...e,split:'holdout' as const}))}],undefined,'unmatched family/split'],
 ];
 for(const [runs,invalidRunIds,reason] of mutations){
  const html=buildReport(runs,{comparisons:[comparison],invalidRunIds});
  assert.ok(html.includes('Unavailable clean comparisons'));
  assert.ok(html.includes(reason));
  assert.ok(!html.includes('12.34 pp'));
 }
 const missing=buildReport([baseline],{comparisons:[{...comparison,treatmentRunId:'<script>missing'}]});
 assert.ok(missing.includes('&lt;script&gt;missing'));assert.ok(!missing.includes('<script>missing'));
});

function admissionFixture(legacy=false){
 const root='insurance-bench/results/',meta=root+'meta/';
 const registrationPath=meta+(legacy?'v09':'v11')+'-registration.json';
 const auditPath=meta+'fixture-audit.json', receiptPath=meta+(legacy?'v09-dispatch-panel-dev.json':'fixture-dispatch.json');
 const nativePath=root+'fixture-native.json';
 const source='a'.repeat(64),corpus='b'.repeat(64),digest='c'.repeat(64);
 const run={...comparisonRun('native'),version:'candidate-v1',limits:{maxTurns:20,maxOutputTokens:16384},responseFormat:legacy?undefined:'json_object'};
 const panel={id:'panel-dev',modelAlias:'fixture',modelConfiguration:run.model,split:'dev',variant:run.variant,
  taskIds:run.taskIds,datasetHash:run.datasetHash,repeat:run.repeat,limits:{...run.limits,...(legacy?{transportDeadlineMs:600000}:{})},harnessHash:run.harnessHash,
  ...(legacy?{}:{dispatchReceiptPath:receiptPath,promptHash:'prompt'})};
 const registration={generation:run.version,sourceFingerprint:source,fullCorpusHash:corpus,
  responseFormat:run.responseFormat,panels:[panel]};
 const receipt={id:panel.id,status:'terminal-native-run',sourceFingerprint:source,freezeCommit:'d'.repeat(40),
  modelConfiguration:panel.modelConfiguration,variant:panel.variant,repeat:panel.repeat,taskIds:panel.taskIds,
  datasetHash:panel.datasetHash,harnessHash:panel.harnessHash,limits:{...panel.limits,transportDeadlineMs:600000},
  promptHash:'prompt',nativeRunPath:nativePath,nativeRunSha256:digest};
 const audited={panelId:panel.id,receiptPath,receiptSha256:digest,nativeRunPath:nativePath,nativeRunSha256:digest,
  completeCoverage:true,episodes:run.episodes};
 const audit={disposition:'approve-engineering-only',registrationPath,registrationSha256:digest,
  sourceFingerprint:source,freezeCommit:'d'.repeat(40),...(legacy?{}:{fullCorpusHash:corpus}),issues:[] as string[],pending:[] as string[],
  counts:{pendingPanels:0,terminalPanelsAudited:1,terminalEpisodesAudited:2},panels:[audited]};
 const data:Record<string,unknown>={[registrationPath]:registration,[receiptPath]:receipt,[nativePath]:run,[auditPath]:audit};
 const reads:string[]=[];
 const io:ReportBuilderIO={readJson:p=>{reads.push(p);assert.ok(p in data);return data[p];},sha:()=>digest,
  exists:p=>p in data,listRuns:()=>{throw new Error('No corpus discovery allowed in guard test');}};
 return {registrationPath,auditPath,receiptPath,nativePath,registration,receipt,run,audit,audited,io,reads,data};
}

function legacyReleasedHoldoutFixture(){
 const f=admissionFixture(true),meta='insurance-bench/results/meta/';
 const releasePath=meta+'v09-holdout-release.json',developmentPath=meta+'investigation-development-independent-audit-v0.9.json';
 const panel=f.registration.panels[0]!;panel.split='holdout';
 f.run.episodes=f.run.episodes.map(e=>({...e,split:'holdout' as const}));f.audited.episodes=f.run.episodes;
 f.receipt.freezeCommit='e'.repeat(40);
 const audit=Object.assign(f.audit,{releasePath,releaseSha256:'',releaseCommit:f.receipt.freezeCommit,
  developmentAuditPath:developmentPath,developmentAuditSha256:''});
 const development={disposition:'approve-engineering-only',registrationPath:f.registrationPath,registrationSha256:'',
  freezeCommit:f.audit.freezeCommit as string|undefined,
  sourceFingerprint:f.registration.sourceFingerprint,fullCorpusHash:undefined as string|undefined,issues:[],pending:[]};
 const release={status:'fresh-holdout-release-no-held-output-read',sourceFingerprint:f.registration.sourceFingerprint,
  harnessHash:panel.harnessHash,taskIds:panel.taskIds,repeat:panel.repeat,developmentAuditPath:developmentPath,
  developmentAuditSha256:'',developmentDispatchSha256:{} as Record<string,string>,fullCorpusHash:undefined as string|undefined};
 const devRun=structuredClone(f.run);devRun.runId='development-parent';
 devRun.episodes=devRun.episodes.map(e=>({...e,split:'dev' as const}));
 const devPanel={...panel,id:'parent-dev',split:'dev'},devReceiptPath=meta+'v09-dispatch-parent-dev.json';
 const devNativePath='insurance-bench/results/development-parent.json';
 const devReceipt={...f.receipt,id:devPanel.id,freezeCommit:f.audit.freezeCommit,nativeRunPath:devNativePath};
 const devAudited={...f.audited,panelId:devPanel.id,receiptPath:devReceiptPath,nativeRunPath:devNativePath,episodes:devRun.episodes};
 f.registration.panels.push(devPanel);f.audit.panels.push(devAudited);
 f.audit.counts.terminalPanelsAudited=2;f.audit.counts.terminalEpisodesAudited=4;
 f.data[devReceiptPath]=devReceipt;f.data[devNativePath]=devRun;
 f.data[releasePath]=release;f.data[developmentPath]=development;
 f.io.sha=p=>crypto.createHash('sha256').update(JSON.stringify(f.data[p])).digest('hex');
 const seal=()=>{
  audit.registrationSha256=f.io.sha(f.registrationPath);development.registrationSha256=audit.registrationSha256;
  f.receipt.nativeRunSha256=f.io.sha(f.nativePath);f.audited.nativeRunSha256=f.receipt.nativeRunSha256;
  f.audited.receiptSha256=f.io.sha(f.receiptPath);
  devReceipt.nativeRunSha256=f.io.sha(devNativePath);devAudited.nativeRunSha256=devReceipt.nativeRunSha256;
  devAudited.receiptSha256=f.io.sha(devReceiptPath);release.developmentDispatchSha256[devPanel.id]=devAudited.receiptSha256;
  release.developmentAuditSha256=f.io.sha(developmentPath);audit.developmentAuditSha256=release.developmentAuditSha256;
  audit.releaseSha256=f.io.sha(releasePath);
 };
 seal();return {...f,audit,release,development,releasePath,developmentPath,devReceiptPath,devNativePath,devRun,seal};
}

test('legacy v9 holdout binds its separately audited release commit without changing source freeze',()=>{
 for(const panelFreeze of [false,true]){
  const f=legacyReleasedHoldoutFixture();
  if(panelFreeze)Object.assign(f.audited,{freezeCommit:f.audit.releaseCommit});
  assert.notEqual(f.audit.freezeCommit,f.receipt.freezeCommit);
  assert.deepEqual(admitRegisteredReportPanels(f.registrationPath,[f.auditPath],f.io,true),[f.run,f.devRun]);
 }
});

test('legacy holdout missing or mismatched release and development bindings fail before native reads',()=>{
 const faults:Array<(f:ReturnType<typeof legacyReleasedHoldoutFixture>)=>void>=[
  f=>{delete f.data[f.releasePath];},f=>{f.audit.releasePath='insurance-bench/results/meta/other.json';},
  f=>{f.audit.releaseSha256='f'.repeat(64);},f=>{f.audit.releaseCommit='f'.repeat(40);},
  f=>{f.audit.releaseCommit='not-a-commit';},f=>{Object.assign(f.audited,{freezeCommit:f.audit.freezeCommit});},
  f=>{f.release.status='unreleased';f.seal();},f=>{f.release.sourceFingerprint='f'.repeat(64);f.seal();},
  f=>{f.release.fullCorpusHash='f'.repeat(64);f.seal();},f=>{f.release.harnessHash='other';f.seal();},
  f=>{f.release.taskIds=[...f.release.taskIds].reverse();f.seal();},f=>{f.release.repeat=2;f.seal();},
  f=>{delete f.data[f.developmentPath];},f=>{f.audit.developmentAuditSha256='f'.repeat(64);},
  f=>{f.development.sourceFingerprint='f'.repeat(64);f.seal();},
  f=>{f.development.fullCorpusHash='f'.repeat(64);f.seal();},
  f=>{f.development.freezeCommit=undefined;f.seal();},
  f=>{f.audit.freezeCommit='f'.repeat(40);f.seal();},
  f=>{f.release.developmentDispatchSha256.extra='f'.repeat(64);f.seal();},
  f=>{delete f.release.developmentDispatchSha256['parent-dev'];f.audit.releaseSha256=f.io.sha(f.releasePath);},
  f=>{f.release.developmentDispatchSha256['parent-dev']='f'.repeat(64);f.audit.releaseSha256=f.io.sha(f.releasePath);},
 ];
 for(const fault of faults){const f=legacyReleasedHoldoutFixture();fault(f);
  assert.throws(()=>admitRegisteredReportPanels(f.registrationPath,[f.auditPath],f.io,true),/Report admission binding failed/);
  assert.ok(!f.reads.includes(f.nativePath));}
 const drift=legacyReleasedHoldoutFixture();drift.development.registrationSha256='f'.repeat(64);
 drift.release.developmentAuditSha256=drift.io.sha(drift.developmentPath);
 drift.audit.developmentAuditSha256=drift.release.developmentAuditSha256;
 drift.audit.releaseSha256=drift.io.sha(drift.releasePath);
 assert.throws(()=>admitRegisteredReportPanels(drift.registrationPath,[drift.auditPath],drift.io,true));
});

test('report builder binds exact terminal audits and original v9 registration corpus fallback without side effects',()=>{
 for(const legacy of [false,true]){
  const f=admissionFixture(legacy);
  assert.deepEqual(admitRegisteredReportPanels(f.registrationPath,[f.auditPath],f.io,legacy),[f.run]);
  assert.equal(f.reads.filter(p=>p===f.nativePath).length,1);
  if(legacy){const missing=admissionFixture(true);delete (missing.receipt.limits as {transportDeadlineMs?:number}).transportDeadlineMs;assert.throws(()=>admitRegisteredReportPanels(missing.registrationPath,[missing.auditPath],missing.io,true));}
 }
});

test('stale or incomplete audits fail before any native body is read',()=>{
 const mutations: Array<(f:ReturnType<typeof admissionFixture>)=>void>=[
  f=>{f.audit.registrationSha256='stale';},f=>{f.audit.sourceFingerprint='stale';},
  f=>{f.audit.fullCorpusHash='stale';},f=>{f.audit.fullCorpusHash=undefined;},f=>{f.audit.issues=['finding'];},f=>{f.audit.pending=['panel'];},
  f=>{f.audit.counts.pendingPanels=1;},f=>{f.audit.panels=[];},
  f=>{f.audited.receiptSha256='stale';},f=>{f.audited.nativeRunSha256='stale';},
  f=>{f.receipt.status='dispatched';},f=>{f.receipt.freezeCommit='e'.repeat(40);},f=>{f.receipt.sourceFingerprint='stale';},
  f=>{f.receipt.modelConfiguration={...f.receipt.modelConfiguration,reasoningEffort:'high'};},
  f=>{f.receipt.taskIds=[...f.receipt.taskIds].reverse();},f=>{f.receipt.limits.transportDeadlineMs=300000;},
 ];
 for(const mutate of mutations){
  const f=admissionFixture();mutate(f);
  assert.throws(()=>admitRegisteredReportPanels(f.registrationPath,[f.auditPath],f.io),/Report admission binding failed/);
  assert.ok(!f.reads.includes(f.nativePath));
 }
});

test('native model, format, task order, limit and split must match the audited frozen panel',()=>{
 const mutations:Array<(f:ReturnType<typeof admissionFixture>)=>void>=[
  f=>{f.run.model={...f.run.model,reasoningEffort:'high'};},f=>{f.run.responseFormat='text';},
  f=>{f.run.taskIds=[...f.run.taskIds].reverse();},f=>{f.run.limits.maxOutputTokens=8192;},
  f=>{f.run.episodes=f.run.episodes.map(e=>({...e,split:'holdout' as const}));},
 ];
 for(const mutate of mutations){const f=admissionFixture();mutate(f);
  assert.throws(()=>admitRegisteredReportPanels(f.registrationPath,[f.auditPath],f.io),/Report admission binding failed/);}
});

test('fully audited terminal panels retain genuine partial and zero provider coverage as unavailable rows',()=>{
 for(const count of [0,1]){
  const f=admissionFixture();
  f.run.episodes=f.run.episodes.slice(0,count).map(e=>({...e,status:'provider-error',score:undefined}));
  f.run.completeCoverage=false;f.run.coverage=0;
  f.run.summary={...f.run.summary,taskCount:0,score:0,completionRate:0};
  f.audited.completeCoverage=false;f.audited.episodes=f.run.episodes;
  f.audit.counts.terminalEpisodesAudited=count;
  const admitted=admitRegisteredReportPanels(f.registrationPath,[f.auditPath],f.io);
  assert.equal(admitted.length,1);assert.equal(admitted[0]!.episodes.length,count);
  const html=buildReport(admitted);assert.ok(html.includes('<td class="score">Unavailable</td>'));
  assert.ok(html.includes('0/2'));
 }
 const incompleteClaim=admissionFixture();incompleteClaim.run.episodes=incompleteClaim.run.episodes.slice(0,1);
 incompleteClaim.audited.episodes=incompleteClaim.run.episodes;incompleteClaim.audit.counts.terminalEpisodesAudited=1;
 assert.throws(()=>admitRegisteredReportPanels(incompleteClaim.registrationPath,[incompleteClaim.auditPath],incompleteClaim.io));
});

test('recorded costs and criterion all-pass do not imply billed success or completed-task success',()=>{
 const baseline:TaskSuccessRun={...comparisonRun('baseline'),version:'insurance-bench-allocation-interaction-v0.11',
  headlineMetric:'macro-task-success',benchmarkScore:0,estimatedCostUsd:1.25,
  episodes:comparisonRun('baseline').episodes.map(episode=>({...episode,status:'incomplete'}))};
 const treatment={...baseline,runId:'treatment'};
 const html=buildReport([baseline,treatment],{comparisons:[{
  baselineRunId:baseline.runId,treatmentRunId:treatment.runId,cases:2,attemptsPerCase:1,
  scoreDelta:0,completionDelta:0,caseWins:0,caseTies:2,caseLosses:0,
  familyClusterBootstrap95:[0,0],families:[],caveat:'Original criteria-all-pass diagnostic',
 }]});
 assert.ok(html.includes('Recorded run cost estimates'));
 assert.ok(html.includes('failed-call reservations and overlapping archived experiments'));
 assert.ok(html.includes('not the authoritative current session ledger or an invoice'));
 assert.ok(!html.includes('Estimated successful inference cost'));
 assert.equal((html.match(/0.0<small>Task success \/100<\/small>/g)??[]).length,2);
 assert.ok(html.includes('<td>100.0%</td>'));
 assert.ok(html.includes('All-pass differences count existing criterion passes'));
 assert.ok(html.includes('completed-task headline additionally requires a completed episode'));
 assert.ok(html.includes('0.00 pp'));
});

test('prospective dependency allocation retains macro and optimal-write metrics in a separate generation',()=>{
 const base=comparisonRun('allocation');
 const allocation:TaskSuccessRun={...base,version:'insurance-bench-allocation-interaction-v0.11',
  headlineMetric:'macro-task-success',benchmarkScore:50,summary:{...base.summary,score:92},
  episodes:base.episodes.map((episode,index)=>({...episode,score:{...episode.score!,criteria:[{
   id:'workflow:current-state',component:'workflow',passed:index===0,detail:'Actual optimal current proposal',
  }]}}))};
 const dependency:TaskSuccessRun={...allocation,runId:'dependency',version:'insurance-bench-dependency-allocation-v0.12'};
 const html=buildReport([allocation,dependency]);
 assert.equal((html.match(/50.0<small>Task success \/100<\/small>/g)??[]).length,2);
 assert.equal((html.match(/Diagnostic partial credit 92.0 \/100/g)??[]).length,2);
 assert.equal((html.match(/50.0%<small>Optimal current proposal plan<\/small>/g)??[]).length,2);
 assert.equal((html.match(/Scores in different panels/g)??[]).length,2);
 assert.ok(html.includes('source-qualified dependencies, exclusions and cycles'));
 assert.ok(html.includes('source and macro metric definition alone do not establish empirical difficulty'));
 assert.ok(buildReport([{...dependency,completeCoverage:false}]).includes('<td class="score">Unavailable</td>'));
});
