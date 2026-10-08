import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { gradeSyntheticSelfRun, gradeLegalSelfRunBatch, gradeHarveyJury, nativeSelfRunTasks, prepareSelfRun, validateSelfRunFreeze, runSelfRun, runNativeSelfRunEpisode, SELF_RUN_PROFILES, selfRunStatus, uniqueSelfRunRequests, selfRunTaskKey, selfRunHash, admitSelfRunPublication, type SelfRunRegistration } from '../insurance-bench/selfrun-coordinator.ts';
import { generateSyntheticSelfRunTasks } from '../insurance-bench/selfrun-synthetic.ts';
import { loadPublicSelfRunTasks, type PublicSelfRunTask } from '../insurance-bench/selfrun-public-sources.ts';
import type { CodexSubagentRequest, CodexSubagentResult } from '../insurance-bench/selfrun-transport.ts';

const completed = (text: string, model = 'gpt-6.1-sol', effort: CodexSubagentRequest['effort'] = 'high'): CodexSubagentResult => ({ status: 'completed', text, requestedModel: model, requestedEffort: effort, observedModel: null, usage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 4 }, elapsedMs: 3, eventsPath: '', errorCode: null, terminationConfirmed: true });
function fixtures(): PublicSelfRunTask[] {
  const receipt = JSON.parse(readFileSync(new URL('../insurance-bench/selfrun-source-receipt.json', import.meta.url), 'utf8'));
  return [...Array.from({ length: 18 }, (_, index) => ({ id: `legalbench-insurance-policy-${receipt.legalbenchSelectedIds[index]}`, componentId: 'legal-reasoning' as const, instruction: `Fictional classification ${index}`, sourceTexts: [{ id: 'source', text: 'public source without target label' }], answerFormat: { label: 'A|B|C' }, expected: { label: ['A', 'B', 'C'][index % 3]! }, source: { name: 'test fixture', commit: 'test', url: 'https://example.invalid/', license: 'CC BY 4.0', attribution: 'Test only', modificationNotice: 'Offline mock', inputSha256: {} } })),
    ...[38, 39, 40].map((count, index) => ({ id: `harvey-lab-${receipt.harveyTasks[index]}`, componentId: 'legal-agent' as const, instruction: 'Create a complete fictional document', sourceTexts: [], answerFormat: { artifactName: `document-${index}.docx`, documentText: 'complete text' }, expected: { artifactName: `document-${index}.docx` }, criteriaCount: count, rubric: Array.from({ length: count }, (_, index) => ({ match_criteria: `PRIVATE_TEST_CRITERION_${index}` })), source: { name: 'test fixture', commit: 'test', url: 'https://example.invalid/', license: 'MIT', attribution: 'Test only', modificationNotice: 'Offline mock', inputSha256: {} } }))];
}
async function prepared(realPublicSources = false, profileIds?: readonly string[]): Promise<SelfRunRegistration> {
  const root = await mkdtemp(join(tmpdir(), 'insurance-selfrun-test-'));
  return prepareSelfRun({ root, ...(profileIds ? { profileIds } : {}), cliVersion: 'offline-cli-test', loadTasks: realPublicSources ? () => loadPublicSelfRunTasks() : async () => fixtures(), mitNotice: 'OFFLINE TEST FULL MIT NOTICE', renderImages: async outputDir => {
    await mkdir(outputDir, { recursive: true });
    const images: Record<string, string[]> = {};
    for (const task of generateSyntheticSelfRunTasks()) if (task.images?.length) {
      images[task.id] = [];
      for (const image of task.images) { const path = join(outputDir, `${task.id}-${image.id}.png`); await writeFile(path, `OFFLINE TEST RASTER ${task.id} ${image.id}`); images[task.id]!.push(path); }
    }
    return images;
  } });
}
async function clean(registration: SelfRunRegistration) { await Promise.all([rm(registration.artifactRoot, { recursive: true, force: true }), rm(registration.outputDir, { recursive: true, force: true })]); }

test('synthetic grading enforces complete exact key/type/order contract and numeric equivalence', () => {
  const gold = { numeric: 12.25, ordered: ['A', 'B'], flag: true, text: 'exact' };
  assert.equal(gradeSyntheticSelfRun(gold, { ...gold, numeric: 12.250000001 }).score, 100);
  assert.equal(gradeSyntheticSelfRun(gold, { ...gold, numeric: '12.25' }).score, 0);
  assert.equal(gradeSyntheticSelfRun(gold, { ...gold, ordered: ['B', 'A'] }).score, 0);
  assert.equal(gradeSyntheticSelfRun(gold, { ...gold, extra: true }).score, 0);
  assert.equal(gradeSyntheticSelfRun(gold, { ...gold, numeric: 12.251 }).score, 0);
  assert.equal(gradeSyntheticSelfRun(gold, null).score, 0);
});
test('LegalBench batch counts absent/invalid labels wrong and rejects duplicate/unexpected IDs', () => {
  const tasks = [{ id: 'a', expected: { label: 'A' } }, { id: 'b', expected: { label: 'B' } }];
  assert.deepEqual(gradeLegalSelfRunBatch(tasks, { answers: [{ id: 'a', label: ' a ' }, { id: 'b', label: 'wrong' }] }), { a: 100, b: 0 });
  assert.deepEqual(gradeLegalSelfRunBatch(tasks, { answers: [{ id: 'a', label: 'A' }] }), { a: 100, b: 0 });
  assert.deepEqual(gradeLegalSelfRunBatch(tasks, { answers: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A' }] }), { a: 0, b: 0 });
  assert.deepEqual(gradeLegalSelfRunBatch(tasks, { answers: [{ id: 'a', label: 'A' }, { id: 'outside', label: 'B' }] }), { a: 0, b: 0 });
});
test('jury grading requires original complete indexed boolean criteria with evidence, aggregates all-pass', () => {
  assert.equal(gradeHarveyJury(2, { criteria: [{ index: 1, pass: true, evidence: 'clause 2' }, { index: 0, pass: true, evidence: 'clause 1' }] })?.score, 100);
  assert.equal(gradeHarveyJury(2, { criteria: [{ index: 0, pass: false, evidence: 'omitted' }, { index: 1, pass: true, evidence: 'clause' }] })?.score, 0);
  assert.equal(gradeHarveyJury(2, { criteria: [{ index: 0, pass: true, evidence: 'clause' }] }), null);
  assert.equal(gradeHarveyJury(1, { criteria: [{ index: 0, pass: 'true', evidence: 'clause' }] }), null);
});
test('shared batch telemetry is deduplicated and conflicting exclusive request receipts fail closed', () => {
  const request = { ...completed('A'), requestId: 'batch-unique', requestPayloadSha256: 'frozen-input', eventsPath: '/private/batch/events.jsonl' };
  assert.equal(uniqueSelfRunRequests(Array.from({ length: 18 }, () => ({ ...request }))).length, 1);
  assert.throws(() => uniqueSelfRunRequests([request, { ...request, text: 'conflicting response' }]), /Conflicting telemetry/);
});
test('native coordinator advances only through executed tools and records phase/revision hashes', async () => {
  const task = nativeSelfRunTasks()[0]!;
  const trace: unknown[] = [];
  let turnCount = 0;
  const result = await runNativeSelfRunEpisode(task, async (messages, turn) => {
    turnCount++;
    assert.equal(messages[0]?.role, 'system');
    assert.deepEqual(JSON.parse(messages[1]!.content), { id: task.id, family: task.family, instruction: task.instruction, clock: task.clock });
    assert.equal(messages.length, 2 + (turn - 1) * 2);
    if (turn === 1) return completed(JSON.stringify({ actions: [{ tool: 'ask_customer', args: { topic: task.workflow.customerTopic, scope: task.workflow.customerScope, expectedSessionRevision: 0 } }] }));
    if (turn === 2) {
      const doc = task.workflow.phases[1].documents[0]!;
      const sources = [{ documentId: doc.id, revision: doc.revision, rowId: doc.rows[0]!.id }];
      return completed(JSON.stringify({ actions: [{ tool: 'read_document', args: { documentId: doc.id } }, { tool: 'build_packet', args: { sources, expectedMaterialRevision: 2, expectedSessionRevision: 2 } }, { tool: 'save_work_product', args: { sources, facts: {}, memo: 'A deliberately incomplete test draft still records a real lifecycle mutation.', expectedMaterialRevision: 2, expectedSessionRevision: 3 } }] }));
    }
    return completed(JSON.stringify({ actions: [{ tool: 'finish', args: {} }] }));
  }, entry => { trace.push(entry); });
  assert.equal(turnCount, 3); assert.equal(result.score, 0);
  const phases = trace as { before: { phase: number; stateSha256: string }; after: { phase: number; materialRevision: number; draftRevision: number | null; stateSha256: string } }[];
  assert.equal(phases[0]!.before.phase, 0); assert.equal(phases[0]!.after.phase, 1);
  assert.equal(phases[1]!.after.phase, 2); assert.equal(phases[1]!.after.materialRevision, 3); assert.equal(phases[1]!.after.draftRevision, 1);
  assert.notEqual(phases[0]!.before.stateSha256, phases[0]!.after.stateSha256);
});
test('native 20 valid turns are measured resource failure; transport failure is a gap', async () => {
  let requests = 0;
  const resource = await runNativeSelfRunEpisode(nativeSelfRunTasks()[0]!, async () => { requests++; return completed('{"actions":[{"tool":"read_record","args":{}}]}'); });
  assert.equal(requests, 20); assert.equal(resource.score, 0); assert.equal(resource.status, 'resource-budget-failure');
  const gap = await runNativeSelfRunEpisode(nativeSelfRunTasks()[0]!, async () => ({ ...completed(''), status: 'timeout', text: null, errorCode: 'PROCESS_DEADLINE' }));
  assert.equal(gap.score, null); assert.equal(gap.status, 'transport-gap');
  const mismatch = await runNativeSelfRunEpisode(nativeSelfRunTasks()[0]!, async () => ({ ...completed('{"actions":[{"tool":"finish","args":{}}]}'), observedModel: 'wrong-model' }));
  assert.equal(mismatch.score, null);
});
test('prepare exports only public packet; immutable actor and private grader hashes reject tampering', async () => {
  const registration = await prepared();
  try {
    assert.equal(registration.profiles.length, 18); assert.equal(registration.taskIds.length, 32);
    await validateSelfRunFreeze(registration.artifactRoot);
    const packetText = await readFile(join(registration.actorDir, 'public-packet.json'), 'utf8');
    assert.ok(!packetText.includes('PRIVATE_TEST_CRITERION'));
    assert.ok(!packetText.includes('"expected"')); assert.ok(!packetText.includes('"rubric"'));
    assert.ok(!packetText.includes('optimalPlans'));
    assert.ok(!packetText.includes(registration.actorDir));
    const native = JSON.parse(packetText).tasks.filter((task: { assignment?: unknown }) => task.assignment);
    assert.equal(native.length, 3); assert.ok(native.every((task: { assignment: object }) => Object.keys(task.assignment).sort().join(',') === 'clock,family,id,instruction'));
    await assert.rejects(prepareSelfRun({ root: registration.artifactRoot, cliVersion: 'offline-cli-test' }), /EEXIST/);
    const path = join(registration.actorDir, 'public-packet.json');
    await writeFile(path, packetText + ' ');
    await assert.rejects(validateSelfRunFreeze(registration.artifactRoot), /Frozen actor input changed/);
    await writeFile(path, packetText);
    const privatePath = join(registration.outputDir, 'private-tasks.json');
    const tasks = JSON.parse(await readFile(privatePath, 'utf8'));
    tasks[0].public.instruction = 'Tampered prompt may not bypass actor packet freeze';
    await writeFile(privatePath, JSON.stringify(tasks));
    await assert.rejects(validateSelfRunFreeze(registration.artifactRoot), /Frozen grader/);
  } finally { await clean(registration); }
});
test('a frozen run may select an exact canonical profile subset and never dispatch omitted efforts', async () => {
  const selected = ['gpt-6-sol-high', 'gpt-6-astra-high'];
  const registration = await prepared(false, selected);
  let calls = 0;
  try {
    assert.deepEqual(registration.profiles.map(profile => profile.id), selected);
    await validateSelfRunFreeze(registration.artifactRoot);
    const transport = async (request: CodexSubagentRequest) => { calls++; return { ...completed('', request.model, request.effort), status: 'unavailable' as const, text: null, errorCode: 'MODEL_OR_CONFIGURATION_UNAVAILABLE' }; };
    const result = await runSelfRun({ root: registration.artifactRoot, transport });
    assert.equal(calls, selected.length);
    assert.deepEqual(result.registeredProfiles.map(profile => profile.id), selected);
    assert.ok(result.profiles.every(profile => profile.effort === 'high' && profile.status === 'stopped-access'));
    await assert.rejects(prepareSelfRun({ root: join(registration.artifactRoot, 'unknown'), profileIds: ['gpt-7.0-high'], cliVersion: 'offline-cli-test', loadTasks: async () => fixtures(), mitNotice: 'OFFLINE TEST FULL MIT NOTICE', renderImages: async () => ({}) }), /unknown profile/);
  } finally { await clean(registration); }
});
test('access failures stop each profile with null scores, bounded concurrency, no resume retry', async () => {
  const registration = await prepared();
  let calls = 0, active = 0, maximum = 0;
  try {
    const transport = async (request: CodexSubagentRequest) => { calls++; active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 2)); active--; return { ...completed('', request.model, request.effort), status: 'unavailable' as const, text: null, errorCode: 'MODEL_OR_CONFIGURATION_UNAVAILABLE' }; };
    const result = await runSelfRun({ root: registration.artifactRoot, parallel: 3, transport });
    assert.equal(calls, 18); assert.ok(maximum <= 3);
    assert.ok(result.profiles.every(profile => profile.score === null && profile.status === 'stopped-access' && profile.coverage === 0));
    const resumed = await runSelfRun({ root: registration.artifactRoot, transport });
    assert.equal(calls, 18); assert.equal(resumed.profiles.length, SELF_RUN_PROFILES.length);
  } finally { await clean(registration); }
});
test('full mocked matrix has fixed weights, independent blinded juries, honest native failures and separate usage', async () => {
  const registration = await prepared();
  const expected = new Map(generateSyntheticSelfRunTasks().map(task => [task.id, task.expected]));
  let calls = 0;
  try {
    const transport = async (request: CodexSubagentRequest) => {
      calls++;
      const payload = JSON.parse(request.prompt.slice(request.prompt.indexOf('\n') + 1));
      let answer: unknown;
      if (request.requestId === 'legalbench-batch') answer = { answers: fixtures().filter(task => task.componentId === 'legal-reasoning').map(task => ({ id: task.id, label: task.expected!.label })) };
      else if (request.requestId.includes('-jury-')) {
        assert.ok(!request.prompt.includes('requestedModel')); assert.ok(!request.prompt.includes('gpt-5.6'));
        assert.equal(request.effort, 'high');
        answer = { criteria: payload.originalCriteria.map((_: unknown, index: number) => ({ index, pass: true, evidence: `Artifact clause ${index} establishes the criterion` })) };
      } else if (request.requestId.includes('-turn-')) answer = { actions: [{ tool: 'finish', args: {} }] };
      else if (payload.componentId === 'legal-agent') answer = { artifactName: payload.answerFormat.artifactName, documentText: 'A complete fictional work product used only by the injected mock judge.' };
      else answer = expected.get(payload.id);
      return completed(JSON.stringify(answer), request.model, request.effort);
    };
    const result = await runSelfRun({ root: registration.artifactRoot, transport });
    assert.equal(calls, 18 * 21);
    assert.ok(result.profiles.every(profile => profile.score === 80 && profile.coverage === 1 && profile.status === 'completed'));
    assert.equal(result.profiles[0]!.tokenUsage?.inputTokens, 15 * 10);
    assert.equal(result.profiles[0]!.judgeTokenUsage?.inputTokens, 6 * 10);
    assert.equal(result.profiles[0]!.costUsd, null);
    assert.equal(result.profiles[0]!.components['insurance-workflows'].score, 0);
    assert.equal(result.profiles[0]!.attempts.requestStarted, 21);
    const filenames = await readdir(join(registration.outputDir, SELF_RUN_PROFILES[0]!.id));
    assert.equal(filenames.filter(path => path.endsWith('.result.json')).length, 32);
    await runSelfRun({ root: registration.artifactRoot, transport }); assert.equal(calls, 18 * 21);
    assert.equal((await selfRunStatus(registration.artifactRoot)).sourceSha, registration.sourceSha);
  } finally { await clean(registration); }
});
test('canonical protocol fields cannot be changed by rehashing both registration copies', async () => {
  const registration = await prepared();
  try {
    for (const change of [ { juries: [{ model: 'gpt-6-luna', effort: 'low' }, { model: 'gpt-6-luna', effort: 'low' }] }, { weights: { ...registration.weights, documents: 21 } }, { contextPolicy: 'changed context' }, { nativeSeed: 1 }, { publicSourceReceiptSha256: '0'.repeat(64) } ]) {
      const { sourceSha: _old, ...body } = { ...registration, ...change };
      const altered = { ...body, sourceSha: selfRunHash(body) };
      await Promise.all([writeFile(join(registration.artifactRoot, 'registration.json'), JSON.stringify(altered)), writeFile(join(registration.outputDir, 'registration.json'), JSON.stringify(altered))]);
      await assert.rejects(validateSelfRunFreeze(registration.artifactRoot), /Canonical protocol/);
    }
  } finally { await clean(registration); }
});
test('publication regrades raw receipts, ignores fabricated summaries, rejects edited task scores, retains interrupted usage', async () => {
  const registration = await prepared(true);
  const original = await loadPublicSelfRunTasks();
  let first = true;
  try {
    await runSelfRun({ root: registration.artifactRoot, parallel: 1, transport: async request => {
      const result = first ? completed(JSON.stringify({ answers: original.filter(task => task.componentId === 'legal-reasoning').map(task => ({ id: task.id, label: task.expected!.label })) }), request.model, request.effort) : { ...completed('', request.model, request.effort), status: 'unavailable' as const, text: null, usage: null, errorCode: 'MODEL_OR_CONFIGURATION_UNAVAILABLE' };
      first = false;
      const directory = join(request.outputDir, request.requestId); await mkdir(directory, { recursive: true });
      const raw = { ...result, eventsPath: join(directory, 'events.jsonl') };
      const events = [{ type: 'transport.started', requestedModel: request.model, requestedEffort: request.effort }, ...(raw.status === 'completed' ? [{ type: 'item.completed', item: { type: 'agent_message', text: raw.text } }, { type: 'turn.completed', usage: raw.usage, observedModel: raw.observedModel }] : []), { type: 'transport.finished', status: raw.status, errorCode: raw.errorCode, elapsedMs: raw.elapsedMs, terminationConfirmed: raw.terminationConfirmed }];
      await writeFile(raw.eventsPath, events.map(event => JSON.stringify(event)).join('\n') + '\n');
      await writeFile(join(directory, 'result.json'), JSON.stringify(raw));
      return raw;
    } });
    await writeFile(join(registration.outputDir, 'summary.json'), JSON.stringify({ fabricatedScore: 100 }));
    const admitted = await admitSelfRunPublication(registration.artifactRoot);
    assert.equal(admitted.profiles[0]!.components['legal-reasoning'].score, 100); assert.equal(admitted.profiles[0]!.score, null);
    assert.equal(admitted.admission!.requestCount, 19);
    const profileDir = join(registration.outputDir, SELF_RUN_PROFILES[0]!.id);
    const resultPath = join(profileDir, `${selfRunTaskKey(original[0]!.id)}.result.json`);
    const stored = JSON.parse(await readFile(resultPath, 'utf8'));
    await writeFile(resultPath, JSON.stringify({ ...stored, score: 99 }));
    await assert.rejects(admitSelfRunPublication(registration.artifactRoot), /Stored task score/);
    await rm(resultPath);
    const partial = await admitSelfRunPublication(registration.artifactRoot);
    assert.equal(partial.profiles[0]!.tokenUsage, null); // unavailable next request keeps total usage unknown
    assert.equal(partial.profiles[0]!.knownTokenUsage?.inputTokens, 10);
    assert.equal(partial.profiles[0]!.components['legal-reasoning'].score, null);
    // Crash window: raw result survives, coordinator response and event chain do not.
    for (const task of original.filter(task => task.componentId === 'legal-reasoning')) await rm(join(profileDir, `${selfRunTaskKey(task.id)}.result.json`), { force: true });
    await rm(join(profileDir, 'legalbench-batch.response.json'));
    await rm(join(profileDir, 'requests/legalbench-batch/events.jsonl'));
    const missingChain = await admitSelfRunPublication(registration.artifactRoot);
    assert.equal(missingChain.profiles[0]!.components['legal-reasoning'].score, null);
    assert.equal(missingChain.profiles[0]!.tokenUsage, null);
    assert.equal(missingChain.profiles[0]!.knownTokenUsage, null);
  } finally { await clean(registration); }
});
