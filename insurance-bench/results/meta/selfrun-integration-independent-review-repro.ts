import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareSelfRun, validateSelfRunFreeze, selfRunHash, selfRunTaskKey, runSelfRun, admitSelfRunPublication, SELF_RUN_PROFILES } from '../../selfrun-coordinator.ts';
import { DEFAULT_PUBLIC_SOURCE_CACHE, readPublicSourceReceipt, loadPublicSelfRunTasks } from '../../selfrun-public-sources.ts';
import { generateSyntheticSelfRunTasks } from '../../selfrun-synthetic.ts';
import { publicSelfRunData, renderSelfRunPage } from '../../selfrun-site.ts';
import type { CodexSubagentRequest, CodexSubagentResult } from '../../selfrun-transport.ts';

// Offline, public cached sources and new synthetic data only. Never dispatch a model.
const receipt = await readPublicSourceReceipt();
for (const source of receipt.files) await access(join(DEFAULT_PUBLIC_SOURCE_CACHE, source.path));
const originals = await loadPublicSelfRunTasks();
const root = await mkdtemp(join(tmpdir(), 'selfrun-integration-review-'));
const registration = await prepareSelfRun({ root, cliVersion: 'offline-independent-review', renderImages: async directory => {
  await mkdir(directory, { recursive: true });
  const images: Record<string, string[]> = {};
  for (const task of generateSyntheticSelfRunTasks()) if (task.images?.length) {
    images[task.id] = [];
    for (const image of task.images) { const path = join(directory, `${task.id}-${image.id}.png`); await writeFile(path, 'offline raster placeholder'); images[task.id]!.push(path); }
  }
  return images;
} });
const findings: Record<string, unknown> = {};
const reject = async (label: string, action: () => Promise<unknown>) => {
  try { await action(); findings[label] = { rejected: false }; }
  catch (error) { findings[label] = { rejected: true, error: (error as Error).message }; }
};
try {
  assert((await admitSelfRunPublication(root)).profiles.every(profile => profile.score === null));
  findings.emptyCohortComposites = 0;
  const changed = structuredClone(registration);
  changed.juries = [{ model: 'gpt-6-luna', effort: 'low' }, { model: 'gpt-6-luna', effort: 'low' }] as unknown as typeof changed.juries;
  const { sourceSha: _old, ...body } = changed; changed.sourceSha = selfRunHash(body);
  await writeFile(join(root, 'registration.json'), JSON.stringify(changed));
  await writeFile(join(registration.outputDir, 'registration.json'), JSON.stringify(changed));
  await reject('changedJuries', () => validateSelfRunFreeze(root));
  await writeFile(join(root, 'registration.json'), JSON.stringify(registration));
  await writeFile(join(registration.outputDir, 'registration.json'), JSON.stringify(registration));
  let calls = 0;
  const synthetic = new Map(generateSyntheticSelfRunTasks().map(task => [task.id, task.expected]));
  const transport = async (request: CodexSubagentRequest) => {
    calls++;
    assert.match(request.requestId, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
    const payload = JSON.parse(request.prompt.slice(request.prompt.indexOf('\n') + 1));
    const answer = request.requestId === 'legalbench-batch' ? { answers: originals.filter(task => task.componentId === 'legal-reasoning').map(task => ({ id: task.id, label: task.expected!.label })) }
      : request.requestId.includes('-jury-') ? { criteria: payload.originalCriteria.map((_: unknown, index: number) => ({ index, pass: true, evidence: `OFFLINE mechanical jury fixture ${index}` })) }
      : request.requestId.includes('-turn-') ? { actions: [{ tool: 'finish', args: {} }] }
      : payload.componentId === 'legal-agent' ? { artifactName: payload.answerFormat.artifactName, documentText: 'OFFLINE fictional artifact; this mock measures no professional ability.' }
      : synthetic.get(payload.id);
    const raw: CodexSubagentResult = { status: 'completed', text: JSON.stringify(answer), requestedModel: request.model, requestedEffort: request.effort, observedModel: null, usage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 4 }, elapsedMs: 3, eventsPath: join(request.outputDir, request.requestId, 'events.jsonl'), errorCode: null, terminationConfirmed: true };
    await mkdir(join(request.outputDir, request.requestId), { recursive: true });
    const events = [{ type: 'transport.started', requestedModel: request.model, requestedEffort: request.effort }, { type: 'item.completed', item: { type: 'agent_message', text: raw.text } }, { type: 'turn.completed', usage: raw.usage, observedModel: raw.observedModel }, { type: 'transport.finished', status: raw.status, errorCode: raw.errorCode, elapsedMs: raw.elapsedMs, terminationConfirmed: raw.terminationConfirmed }];
    await writeFile(raw.eventsPath, events.map(event => JSON.stringify(event)).join('\n') + '\n');
    await writeFile(join(request.outputDir, request.requestId, 'result.json'), JSON.stringify(raw));
    return raw;
  };
  await runSelfRun({ root, parallel: 3, transport });
  assert.equal(calls, 378);
  const admitted = await admitSelfRunPublication(root);
  assert(admitted.profiles.every(profile => profile.score === 80 && profile.coverage === 1 && profile.components['insurance-workflows'].score === 0));
  assert.equal(admitted.profiles[0]!.tokenUsage?.inputTokens, 150);
  assert.equal(admitted.profiles[0]!.judgeTokenUsage?.inputTokens, 60);
  findings.fullExactPublicIdMatrix = { tasks: 32, profiles: 18, offlineRequests: calls, admittedComposite: 80, actualAbilityMeasured: false, candidateInput: 150, juryInput: 60, latency: admitted.profiles[0]!.elapsedMs };
  await runSelfRun({ root, transport }); assert.equal(calls, 378); findings.resumeRequests = 0;
  await writeFile(join(registration.outputDir, 'summary.json'), '{"fabricatedScore":100}');
  assert.equal((await admitSelfRunPublication(root)).profiles[0]!.score, 80); findings.fabricatedSummaryIgnored = true;
  const profileDir = join(registration.outputDir, SELF_RUN_PROFILES[0]!.id);
  const docTask = generateSyntheticSelfRunTasks()[0]!;
  const docPath = join(profileDir, `${selfRunTaskKey(docTask.id)}.result.json`);
  const stored = await readFile(docPath, 'utf8');
  await writeFile(docPath, JSON.stringify({ ...JSON.parse(stored), score: 99 }));
  await reject('alteredStoredSyntheticScore', () => admitSelfRunPublication(root)); await writeFile(docPath, stored);
  const harvey = originals.find(task => task.componentId === 'legal-agent')!;
  const juryPath = join(profileDir, `${selfRunTaskKey(harvey.id)}-jury-0.response.json`);
  const juryStored = await readFile(juryPath, 'utf8');
  await writeFile(juryPath, JSON.stringify({ ...JSON.parse(juryStored), requestedEffort: 'low' }));
  await reject('alteredJuryResponse', () => admitSelfRunPublication(root)); await writeFile(juryPath, juryStored);
  const tasks = JSON.parse(await readFile(join(registration.outputDir, 'private-tasks.json'), 'utf8')) as { id: string; kind: string }[];
  const native = tasks.find(task => task.kind === 'native')!;
  const tracePath = join(profileDir, `${selfRunTaskKey(native.id)}-trace-1.json`);
  const traceStored = await readFile(tracePath, 'utf8');
  const trace = JSON.parse(traceStored); trace.after.phase = 999;
  await writeFile(tracePath, JSON.stringify(trace));
  await reject('alteredNativeTrace', () => admitSelfRunPublication(root)); await writeFile(tracePath, traceStored);
  const legalTask = originals.find(task => task.componentId === 'legal-reasoning')!;
  const legalPath = join(profileDir, `${selfRunTaskKey(legalTask.id)}.result.json`);
  const legalStored = await readFile(legalPath, 'utf8');
  await writeFile(legalPath, JSON.stringify({ ...JSON.parse(legalStored), score: null, status: 'interrupted-gap', candidateRequests: [] }));
  const partial = await admitSelfRunPublication(root);
  assert.equal(partial.profiles[0]!.score, null); assert.equal(partial.profiles[0]!.components['legal-reasoning'].score, null);
  assert.equal(partial.profiles[0]!.tokenUsage?.inputTokens, 150);
  findings.partialInterruption = { composite: null, knownCandidateInput: partial.profiles[0]!.knownTokenUsage?.inputTokens, totalCandidateInput: partial.profiles[0]!.tokenUsage?.inputTokens };
  await writeFile(legalPath, legalStored);
  const batchResponse = join(profileDir, 'legalbench-batch.response.json');
  const batchEvents = join(profileDir, 'requests/legalbench-batch/events.jsonl');
  const responseStored = await readFile(batchResponse, 'utf8'), eventsStored = await readFile(batchEvents, 'utf8');
  await rm(batchResponse); await rm(batchEvents);
  await reject('missingEventsAndEnrichedResponse', () => admitSelfRunPublication(root));
  await writeFile(batchResponse, responseStored); await writeFile(batchEvents, eventsStored);
  const pub = publicSelfRunData(admitted);
  assert(!JSON.stringify(pub).includes('documentText')); assert(!JSON.stringify(pub).includes('criteria')); assert(!renderSelfRunPage(pub).includes('OFFLINE'));
  findings.privatePublicationFieldsExcluded = true;
  const tiny = structuredClone(admitted); tiny.limits = { ...tiny.limits, candidateTasks: 5 } as unknown as typeof tiny.limits;
  try { publicSelfRunData(tiny); findings.fiveTaskProtocolRejected = false; } catch { findings.fiveTaskProtocolRejected = true; }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), providerCalls: 0, findings }, null, 2));
} finally { await Promise.all([rm(root, { recursive: true, force: true }), rm(registration.outputDir, { recursive: true, force: true })]); }
