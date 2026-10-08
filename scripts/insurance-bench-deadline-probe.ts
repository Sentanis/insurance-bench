import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { selfRunHash, selfRunTaskKey, validateSelfRunFreeze, type SelfRunTaskResult } from '../insurance-bench/selfrun-coordinator.ts';
import { runCodexSubagent, type CodexSubagentRequest } from '../insurance-bench/selfrun-transport.ts';

// H5 is a separate transport feasibility experiment. Never edit/retry a parent
// claim, import its response as a parent score, or select among measured answers.
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--root') throw new Error('Usage: insurance-bench-deadline-probe --root FROZEN_COHORT');
  const parent = await validateSelfRunFreeze(resolve(args[1]!));
  if (execFileSync('codex', ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim() !== parent.cliVersion) throw new Error('Parent CLI changed');
  const profileId = 'gpt-6.1-sol-max';
  const intendedTaskId = 'harvey-lab-insurance/compare-commercial-property-policy-form-against-state-regulatory-requirements';
  const intendedPromptSha256 = 'cc72c5ffb682cd7d75cee0f44bb6d7185cf2f828a8d94a9c5dec746d56995992';
  const directory = join(parent.outputDir, profileId);
  const files = (await readdir(directory)).filter(file => file.endsWith('.result.json')).sort();
  let chosen: { task: SelfRunTaskResult; input: CodexSubagentRequest } | undefined;
  const packet = JSON.parse(await readFile(join(parent.actorDir, 'public-packet.json'), 'utf8')) as { tasks: { id: string }[] };
  for (const file of files) {
    const task = JSON.parse(await readFile(join(directory, file), 'utf8')) as SelfRunTaskResult;
    const response = task.candidateRequests[0];
    if (task.taskId !== intendedTaskId || task.componentId !== 'legal-agent' || task.status !== 'transport-gap' || task.score !== null || response?.status !== 'timeout' || response.errorCode !== 'PROCESS_DEADLINE' || response.text !== null || response.terminationConfirmed !== true) continue;
    if (response.requestedModel !== 'gpt-6.1-sol' || response.requestedEffort !== 'max' || !response.requestId?.startsWith(profileId + '-')) throw new Error('Parent request mismatch');
    const suffix = response.requestId.slice(profileId.length + 1);
    if (suffix !== selfRunTaskKey(intendedTaskId) || file !== suffix + '.result.json') throw new Error('Invalid candidate key');
    const enriched = JSON.parse(await readFile(join(directory, suffix + '.response.json'), 'utf8')) as typeof response;
    if (selfRunHash(enriched) !== selfRunHash(response)) throw new Error('Embedded response differs from durable receipt');
    const { requestId, requestPayloadSha256, ...body } = enriched;
    const raw = JSON.parse(await readFile(join(directory, 'requests', suffix, 'result.json'), 'utf8')) as typeof body;
    if (selfRunHash(body) !== selfRunHash(raw) || raw.eventsPath !== join(directory, 'requests', suffix, 'events.jsonl')) throw new Error('Raw timeout receipt mismatch');
    const events = (await readFile(raw.eventsPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
    const starts = events.filter(event => event.type === 'transport.started');
    const ends = events.filter(event => event.type === 'transport.finished');
    if (starts.length !== 1 || starts[0]?.requestedModel !== 'gpt-6.1-sol' || starts[0]?.requestedEffort !== 'max' || ends.length !== 1 || ends[0]?.status !== 'timeout' || ends[0]?.errorCode !== 'PROCESS_DEADLINE' || ends[0]?.terminationConfirmed !== true || ends[0]?.elapsedMs !== raw.elapsedMs) throw new Error('Durable timeout event mismatch');
    const recorded = JSON.parse(await readFile(join(directory, suffix + '.request.json'), 'utf8')) as CodexSubagentRequest & { promptSha256: string };
    const { promptSha256, ...input } = recorded;
    const assignment = packet.tasks.find(item => item.id === task.taskId);
    const prompt = 'Complete only the supplied public assignment. Return only the requested JSON answer. Do not grade yourself. No tools or source files.\n' + JSON.stringify(assignment);
    if (!assignment || input.prompt !== prompt || promptSha256 !== intendedPromptSha256 || promptSha256 !== selfRunHash(prompt) || response.requestPayloadSha256 !== selfRunHash(input) || input.actorDir !== parent.actorDir || input.timeoutMs !== parent.limits.requestTimeoutMs || input.model !== 'gpt-6.1-sol' || input.effort !== 'max') throw new Error('Parent public prompt mismatch');
    chosen = { task, input }; break;
  }
  if (!chosen) throw new Error('No eligible censored legal candidate; no provider invoked');
  const timeoutMs = 3_600_000;
  const experimentId = 'deadline-h5-' + selfRunHash([parent.sourceSha, profileId, timeoutMs]).slice(0, 20);
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const base = join(repository, '.tmp/insurance-bench/deadline-probes');
  await mkdir(base, { mode: 0o700, recursive: true });
  if (await realpath(base) !== base) throw new Error('Probe output base contains a symlink');
  const outputDir = join(base, experimentId);
  const contained = (child: string, parentPath: string) => { const rel = relative(parentPath, child); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };
  if ([parent.actorDir, parent.outputDir].some(path => contained(outputDir, path) || contained(path, outputDir))) throw new Error('Probe output overlaps parent');
  await mkdir(outputDir, { mode: 0o700 }); // Exclusive cohort-wide H5 claim, task-independent.
  if (await realpath(outputDir) !== outputDir) throw new Error('Probe output contains a symlink');
  const request: CodexSubagentRequest = { ...chosen.input, timeoutMs, outputDir: join(outputDir, 'requests'), requestId: 'candidate' };
  const registration = { version: 'deadline-feasibility-h5-v1', experimentId, parentCohortId: parent.cohortId, parentSourceSha: parent.sourceSha, taskId: chosen.task.taskId, profileId, timeoutMs, promptSha256: selfRunHash(request.prompt), publicInputSha256: parent.publicInputSha256, sourceSha256: selfRunHash(await readFile(new URL(import.meta.url))), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), registeredAt: new Date().toISOString(), hypothesis: 'A longer transport deadline may yield a final answer for the censored max-effort legal request.', interpretation: 'Separate feasibility observation only. Parent grade/claims remain unchanged; concurrent baseline and cache effects prevent a latency or causal reasoning comparison. No API fallback, jury, score or invoice.' };
  await writeFile(join(outputDir, 'registration.json'), JSON.stringify(registration, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const result = await runCodexSubagent(request);
  // Final text is retained only in the private transport output.
  const summary = { ...registration, status: result.status, errorCode: result.errorCode, elapsedMs: result.elapsedMs, usage: result.usage, observedModel: result.observedModel, terminationConfirmed: result.terminationConfirmed, costUsd: null };
  await writeFile(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}
main().catch(error => { process.stderr.write((error instanceof Error ? error.message : 'Deadline probe failed') + '\n'); process.exitCode = 1; });
