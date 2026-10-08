import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createSelfRunHandoff, buildSelfRunHandoff, writeHandoffTemplates, HANDOFF_PROFILES, handoffPromptTemplate, validateHandoffReturn, runNativeHandoffBridge, type NativeHandoffBinding, type SelfRunHandoff } from '../insurance-bench/selfrun-handoff.ts';
import { SELF_RUN_LIMITS, SELF_RUN_WEIGHTS, SELF_RUN_PROFILES, SELF_RUN_JURIES, SELF_RUN_CONTEXT_POLICY, nativeSelfRunTasks, type SelfRunRegistration } from '../insurance-bench/selfrun-coordinator.ts';

const sha = (value: string | object): string => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
function fixture() {
  const task = (id: string, componentId: string) => ({ id, componentId, instruction: `Public fictional task ${id}`, sourceTexts: [{ id: 'source', text: 'A public source; no hidden expected field' }], answerFormat: { value: 'Requested JSON value' },
    ...(componentId === 'documents' ? { images: [{ id: 'page', path: `images/${id}.png` }] } : {}) });
  const tasks = [...Array.from({ length: 18 }, (_, i) => task(`legal-${i}`, 'legal-reasoning')),
    ...Array.from({ length: 3 }, (_, i) => task(`harvey-${i}`, 'legal-agent')),
    ...Array.from({ length: 4 }, (_, i) => task(`document-${i}`, 'documents')),
    ...Array.from({ length: 4 }, (_, i) => task(`professional-${i}`, 'knowledge-work')),
    ...Array.from({ length: 3 }, (_, i) => ({ assignment: { id: `native-${i}`, instruction: 'Current initial assignment only' }, system: 'Public tool interface' }))];
  const packet = { version: 'matched-selfrun-v1', contextPolicy: SELF_RUN_CONTEXT_POLICY, tasks };
  const packetText = JSON.stringify(packet, null, 2) + '\n';
  const notices = { 'HARVEY-MIT-LICENSE.txt': 'Full opaque MIT notice fixture\nCopyright\nPermission\nWarranty disclaimer\n', 'LEGALBENCH-CC-BY-NOTICE.txt': 'Full CC BY attribution, source license link and modifications fixture\n' };
  const imageSha256 = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`images/document-${i}.png`, sha(`FIXTURE RASTER ${i}`)]));
  const registration: SelfRunRegistration = { schemaVersion: 1, cohortId: 'test-handoff-cohort', createdAt: '2026-10-07T00:00:00Z', artifactRoot: 'not-exported-private-root', actorDir: 'not-exported-actor-path', outputDir: 'not-exported-private-output', profiles: SELF_RUN_PROFILES, juries: SELF_RUN_JURIES,
    limits: SELF_RUN_LIMITS, weights: SELF_RUN_WEIGHTS, contextPolicy: SELF_RUN_CONTEXT_POLICY, cliVersion: 'offline', sourceFiles: {}, publicInputSha256: sha(packet), privateGraderSha256: sha('PRIVATE_GRADER_SENTINEL'), imageSha256,
    actorFileSha256: { 'public-packet.json': sha(packetText), ...Object.fromEntries(Object.entries(notices).map(([key, value]) => [key, sha(value)])), ...imageSha256 }, taskIds: tasks.map(t => 'id' in t ? t.id : t.assignment.id), nativeSeed: 202610071, publicSourceReceiptSha256: sha('public source'), sourceSha: sha('test frozen source'), qualifications: [] };
  return { registration, packet, packetText, notices };
}
function completed(bundle: SelfRunHandoff) {
  return { schemaVersion: 1, protocol: 'matched-selfrun-v1-handoff-return', bundleSha256: bundle.bundleSha256, profileId: HANDOFF_PROFILES[0]!.id, status: 'completed', requestedNativeModelId: 'verified-external-model-id', nativeEffort: { parameter: 'effort', value: 'low', evidence: 'configured' },
    results: bundle.requests.map(request => ({ requestId: request.id, observedModelId: 'verified-external-model-id', finalText: '{"raw":"ungraded candidate response"}', elapsedMs: null, usage: null, costUsd: null })) };
}

test('exact frozen actor projection yields one legal batch and eleven independent static requests, no native transcript/gold', () => {
  const { registration, packet } = fixture(); const bundle = createSelfRunHandoff(registration, packet);
  assert.equal(bundle.requests.length, 12); assert.equal(bundle.requests.flatMap(r => r.taskIds).length, 29); assert.deepEqual(bundle.nativeTaskIds, ['native-0', 'native-1', 'native-2']);
  const legal = bundle.requests[0]!; assert.equal(legal.taskIds.length, 18); assert.match(legal.prompt, /Keep original order/);
  assert.deepEqual(JSON.parse(legal.prompt.slice(legal.prompt.indexOf('\n') + 1)), packet.tasks.slice(0, 18));
  for (const request of bundle.requests.slice(1)) assert.equal(request.taskIds.length, 1);
  const serialized = JSON.stringify(bundle); assert.doesNotMatch(serialized, /privateGraderSha256|not-exported-|PRIVATE_GRADER_SENTINEL|Current initial assignment only|Public tool interface/);
  assert.equal(Object.hasOwn(bundle, 'contextPolicy'), false); assert.equal(bundle.contextPolicySha256, sha(SELF_RUN_CONTEXT_POLICY));
});
test('private expected/rubric/SVG or transcript fields fail closed even with a newly recomputed public hash', () => {
  for (const key of ['expected', 'rubric', 'svg', 'transcript', 'privateTasks']) {
    const { registration, packet } = fixture(); (packet.tasks[0] as unknown as Record<string, unknown>)[key] = 'PRIVATE_SENTINEL'; registration.publicInputSha256 = sha(packet);
    assert.throws(() => createSelfRunHandoff(registration, packet), /Private grading/);
  }
});
test('changed order/count, mismatched freeze and unbound raster paths cannot become packages', () => {
  let { registration, packet } = fixture(); packet.tasks.reverse(); registration.publicInputSha256 = sha(packet); assert.throws(() => createSelfRunHandoff(registration, packet), /count\/order/);
  ({ registration, packet } = fixture()); registration.publicInputSha256 = sha('wrong'); assert.throws(() => createSelfRunHandoff(registration, packet), /identity mismatch/);
  ({ registration, packet } = fixture()); const doc = packet.tasks[21]!; assert.ok('images' in doc); doc.images![0]!.path = '../private-tasks.json'; registration.publicInputSha256 = sha(packet); assert.throws(() => createSelfRunHandoff(registration, packet), /actor-relative/);
  ({ registration, packet } = fixture()); delete registration.actorFileSha256['HARVEY-MIT-LICENSE.txt']; assert.throws(() => createSelfRunHandoff(registration, packet), /Missing frozen notice/);
});
test('six exact target labels have eighteen distinct effort templates; Gemini3.8 independent max is explicitly unsupported', () => {
  assert.equal(HANDOFF_PROFILES.length, 18); assert.equal(new Set(HANDOFF_PROFILES.map(p => p.id)).size, 18);
  for (const profile of HANDOFF_PROFILES) { const template = handoffPromptTemplate(profile); assert.match(template, new RegExp(profile.targetModelLabel.replaceAll('.', '\\.'))); assert.match(template, /Exact native model identifier is UNBOUND/); assert.match(template, /separately registered coordinator cohort/); }
  const max = HANDOFF_PROFILES.find(p => p.id === 'google-gemini3.8flash-max')!; assert.equal(max.effortSupport, 'unsupported-independent-max'); assert.match(handoffPromptTemplate(max), /high-equivalent.*different label/);
});
test('static returned evidence preserves unknown telemetry and cannot claim matched cohort or native execution', () => {
  const { registration, packet } = fixture(), bundle = createSelfRunHandoff(registration, packet); const accepted = validateHandoffReturn(bundle, completed(bundle));
  assert.equal(accepted.modelReportsConsistent, true); assert.equal(accepted.effortEvidencePresent, true); assert.equal(accepted.effortMappingVerified, false); assert.equal(accepted.matchedCohortAdmitted, false); assert.equal(accepted.nativeControllerRequired, true);
  assert.equal(accepted.evidence.results[0]!.usage, null); assert.equal(accepted.evidence.results[0]!.costUsd, null);
  const unknown = completed(bundle); unknown.requestedNativeModelId = null as unknown as string; unknown.nativeEffort = null as unknown as typeof unknown.nativeEffort; unknown.results.forEach(r => { r.observedModelId = null as unknown as string; });
  const unverified = validateHandoffReturn(bundle, unknown); assert.equal(unverified.modelReportsConsistent, false); assert.equal(unverified.effortEvidencePresent, false);
});
test('duplicate/foreign/native requests, substitutions, invalid telemetry and incomplete static coverage are rejected', () => {
  const { registration, packet } = fixture(), bundle = createSelfRunHandoff(registration, packet);
  for (const mutate of [
    (value: ReturnType<typeof completed>) => { value.results[1]!.requestId = value.results[0]!.requestId; },
    (value: ReturnType<typeof completed>) => { value.results[0]!.requestId = 'native-0'; },
    (value: ReturnType<typeof completed>) => { value.results[0]!.observedModelId = 'silent-substitution'; },
    (value: ReturnType<typeof completed>) => { value.results.pop(); },
    (value: ReturnType<typeof completed>) => { value.results[0]!.costUsd = -1 as unknown as null; },
  ]) { const value = completed(bundle); mutate(value); assert.throws(() => validateHandoffReturn(bundle, value)); }
  const tampered = structuredClone(bundle); tampered.nativeTaskIds.push('future-gold-task'); assert.throws(() => validateHandoffReturn(tampered, completed(bundle)), /manifest changed/);
});
test('unsupported independent max cannot be submitted as high and unknown/additional/credential-like return fields are rejected', () => {
  const { registration, packet } = fixture(), bundle = createSelfRunHandoff(registration, packet); const value = completed(bundle); value.profileId = 'google-gemini3.8flash-max'; assert.throws(() => validateHandoffReturn(bundle, value), /Unsupported/);
  assert.equal(validateHandoffReturn(bundle, { ...value, status: 'unsupported', results: [] }).matchedCohortAdmitted, false);
  assert.throws(() => validateHandoffReturn(bundle, { ...completed(bundle), scores: [100] }), /Unexpected/);
  const unsafe = completed(bundle); unsafe.results[0]!.finalText = 'https://operator:fictional-password@example.invalid'; assert.throws(() => validateHandoffReturn(bundle, unsafe), /Credential-like/);
});
test('templates-only builder never includes task data or notices and claims output directory exclusively', async () => {
  const out = resolve('insurance-bench/handoff', `.test-${randomUUID()}`);
  try { await writeHandoffTemplates(out); const names = await readdir(out); assert.equal(names.length, 19); assert.ok(names.includes('README.md')); assert.ok(!names.includes('manifest.json')); await assert.rejects(writeHandoffTemplates(out), /EEXIST/); }
  finally { await rm(out, { recursive: true, force: true }); }
});
test('package uses exact frozen notices/PNG bytes only; changed public bytes or symlink output cannot leak', async () => {
  const stem = randomUUID(), fixtureRoot = resolve(tmpdir(), `insurance-handoff-offline-${stem}`), actor = resolve(fixtureRoot, 'actor'), out = resolve(fixtureRoot, 'handoff', 'package');
  const { registration, packetText, notices } = fixture(); registration.actorDir = actor; registration.artifactRoot = fixtureRoot;
  try {
    await mkdir(resolve(actor, 'images'), { recursive: true }); await writeFile(resolve(actor, 'public-packet.json'), packetText);
    for (const [path, bytes] of Object.entries(notices)) await writeFile(resolve(actor, path), bytes);
    for (let i = 0; i < 4; i++) await writeFile(resolve(actor, 'images', `document-${i}.png`), `FIXTURE RASTER ${i}`);
    const bundle = await buildSelfRunHandoff('offline-fixture', out, { validateFreeze: async () => registration });
    assert.equal(bundle.requests.length, 12); assert.equal(await readFile(resolve(out, 'HARVEY-MIT-LICENSE.txt'), 'utf8'), notices['HARVEY-MIT-LICENSE.txt']); assert.equal(await readFile(resolve(out, 'LEGALBENCH-CC-BY-NOTICE.txt'), 'utf8'), notices['LEGALBENCH-CC-BY-NOTICE.txt']);
    assert.ok(!(await readdir(out)).includes('public-packet.json')); assert.ok(!(await readdir(out)).includes('private-tasks.json'));
    await writeFile(resolve(actor, 'public-packet.json'), packetText + ' '); await assert.rejects(buildSelfRunHandoff('offline-fixture', out + '-changed', { validateFreeze: async () => registration }), /packet bytes changed/);
    await writeFile(resolve(actor, 'public-packet.json'), packetText);
    await assert.rejects(buildSelfRunHandoff('offline-fixture', resolve('insurance-bench/handoff', `.inputs-${stem}`), { validateFreeze: async () => registration }), /user-local/);
    const linked = out + '-linked'; await symlink(actor, linked); await assert.rejects(buildSelfRunHandoff('offline-fixture', resolve(linked, 'escape'), { validateFreeze: async () => registration }), /real directory/); await rm(linked);
  } finally { await rm(fixtureRoot, { recursive: true, force: true }); }
});

function nativeBinding(registration: SelfRunRegistration): NativeHandoffBinding {
  const body = { schemaVersion: 1 as const, externalCohortId: `offline-${randomUUID()}`, registeredAt: '2026-01-01T00:00:00Z', sourceRegistrationSha256: registration.sourceSha,
    profileId: 'google-gemini3.8flash-high', nativeModelId: 'offline-exact-native-model', nativeModelLabel: 'Google Gemini3.8Flash', modelMappingVerified: true as const, contextPolicySha256: sha(registration.contextPolicy), nativeEffort: { parameter: 'thinkingLevel', value: 'high', evidence: 'configured' as const }, effortMappingVerified: true as const };
  return { ...body, bindingSha256: sha(body) };
}
test('native bridge exchanges actual chronological tools with phases and keeps raw/grading receipts out of public handoff', async () => {
  const { registration } = fixture(), task = nativeSelfRunTasks()[0]!; registration.taskIds.push(task.id);
  const binding = nativeBinding(registration), outputDir = resolve('.tmp/insurance-bench/external-selfrun', `offline-${randomUUID()}`);
  let calls = 0;
  try {
    const receipt = await runNativeHandoffBridge({ root: 'offline-fixture', taskId: task.id, profileId: binding.profileId, binding, outputDir, transport: async request => {
      calls++; assert.equal(request.model, binding.nativeModelId); assert.equal(request.effort, 'high'); assert.equal(request.timeoutMs, 600_000);
      const conversation = JSON.parse(request.prompt.slice(request.prompt.indexOf('\n') + 1)) as { role: string; phase?: string }[];
      assert.equal(conversation.length, calls === 1 ? 2 : 4); if (calls === 2) { assert.equal(conversation[2]!.phase, 'final_answer'); assert.equal(conversation[3]!.role, 'user'); }
      const dir = resolve(request.outputDir, request.requestId); await mkdir(dir); const eventsPath = resolve(dir, 'events.jsonl'); await writeFile(eventsPath, JSON.stringify({ type: 'offline-test-final', phase: 'final_answer' }) + '\n');
      return { status: 'completed', text: JSON.stringify({ actions: [{ tool: calls === 1 ? 'list_documents' : 'finish', args: {} }] }), requestedModel: request.model, requestedEffort: request.effort, observedModel: request.model, usage: null, elapsedMs: 0, eventsPath, errorCode: null, terminationConfirmed: true, nativeEffort: binding.nativeEffort };
    } }, { validateFreeze: async () => registration });
    assert.equal(calls, 2); assert.equal(receipt.result.score, 0); assert.equal(receipt.publicationAdmitted, false);
    assert.ok((await readdir(outputDir)).includes('turn-2.controller-trace.json')); assert.equal((JSON.parse(await readFile(resolve(outputDir, 'native-result.json'), 'utf8')) as { taskId: string }).taskId, task.id);
    await assert.rejects(runNativeHandoffBridge({ root: 'offline-fixture', taskId: task.id, profileId: binding.profileId, binding, outputDir, transport: async () => { throw new Error('Should not execute duplicate episode'); } }, { validateFreeze: async () => registration }), /EEXIST/);
  } finally { await rm(outputDir, { recursive: true, force: true }); }
});
test('missing effort/identity evidence stays a native transport gap; unsupported max and active cohort output fail before dispatch', async () => {
  const { registration } = fixture(), task = nativeSelfRunTasks()[0]!; registration.taskIds.push(task.id); const binding = nativeBinding(registration), outputDir = resolve('.tmp/insurance-bench/external-selfrun', `offline-${randomUUID()}`);
  try {
    const receipt = await runNativeHandoffBridge({ root: 'offline-fixture', taskId: task.id, profileId: binding.profileId, binding, outputDir, transport: async request => ({ status: 'completed', text: '{"actions":[{"tool":"finish","args":{}}]}', requestedModel: request.model, requestedEffort: request.effort, observedModel: null, usage: null, elapsedMs: 0, eventsPath: '', errorCode: null, terminationConfirmed: true }) }, { validateFreeze: async () => registration });
    assert.equal(receipt.result.score, null); assert.equal(receipt.result.status, 'transport-gap');
    await assert.rejects(runNativeHandoffBridge({ root: 'offline-fixture', taskId: task.id, profileId: 'google-gemini3.8flash-max', binding, outputDir: outputDir + '-max', transport: async () => { throw new Error('No actual provider call'); } }, { validateFreeze: async () => registration }), /unsupported/);
    await assert.rejects(runNativeHandoffBridge({ root: 'offline-fixture', taskId: task.id, profileId: binding.profileId, binding, outputDir: resolve('.tmp/insurance-bench/selfrun/active-study'), transport: async () => { throw new Error('No actual provider call'); } }, { validateFreeze: async () => registration }), /separate private/);
  } finally { await rm(outputDir, { recursive: true, force: true }); }
});
