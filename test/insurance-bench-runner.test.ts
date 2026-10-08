import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCases } from '../insurance-bench/cases.ts';
import { createEnvironment, publicTask, parseActions } from '../insurance-bench/tools.ts';
import { Budget, runEpisode } from '../insurance-bench/runner.ts';
import type { ModelConfig, Message } from '../insurance-bench/providers.ts';
const model: ModelConfig = { provider: 'openai', model: 'test', inputUsdPerMillion: 2, outputUsdPerMillion: 10 };
test('brief cross-process budget contention retries without losing accounting or increasing the cap', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'insurance-bench-'));
  try {
    const path = join(dir, 'budget.json');
    const budget = new Budget(1, path);
    budget.reserve(.2);
    mkdirSync(path + '.lock');
    const worker = new Worker('const {workerData}=require("node:worker_threads"); setTimeout(()=>require("node:fs").rmSync(workerData,{recursive:true}),40);', { eval:true, workerData:path + '.lock' });
    const done = new Promise<void>((resolve, reject) => { worker.once('exit', code => code === 0 ? resolve() : reject(new Error('lock helper failed'))); worker.once('error', reject); });
    budget.reserve(.1);
    await done;
    assert.ok(Math.abs(new Budget(100, path).spent - .3) < 1e-8);
    assert.throws(() => new Budget(100, path).reserve(.8), /Budget cap reached/);
    budget.settle(.1, 1); // Truthfully retain an unexpected overrun, then stop before another call.
    assert.throws(() => budget.reserve(.01), /Budget cap reached/);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
test('models cannot retrieve hidden rubrics; matter IDs cannot escape document boundary', () => {
  const task = generateCases()[0]!, env = createEnvironment(task);
  assert.equal('rubric' in publicTask(task), false);
  assert.equal(JSON.stringify(env.execute('list_documents', {})).includes('rubric'), false);
  assert.deepEqual(env.execute('read_document', { documentId: '../cases.ts' }), { error: 'document unavailable in this matter' });
  assert.deepEqual(env.execute('save_work_product', { facts: { bad: {} }, citations: [], memo: 'invalid' }), { error: 'invalid fact value' });
  env.execute('request_external_action', { action: 'send letter' });
  assert.equal(env.state.externalActionAttempts.length, 1);
});
test('protocol rejects oversized batches and does not execute prose', () => {
  assert.throws(() => parseActions('I saved it'));
  assert.throws(() => parseActions(JSON.stringify({ actions: Array.from({ length: 21 }, () => ({ tool: 'finish', args: {} })) })));
  assert.equal(parseActions('```json\n{"actions":[{"tool":"finish","args":{}}]}\n```')[0]?.tool, 'finish');
});
test('durable budget stops before paid calls and retains uncertain failed-call reservations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'insurance-bench-'));
  try {
    const path = join(dir, 'budget.json'), budget = new Budget(.001, path);
    let calls = 0;
    const e = await runEpisode(generateCases()[0]!, model, 'baseline', budget, async () => { calls++; throw new Error('should not run'); });
    assert.equal(calls, 0); assert.equal(e.status, 'budget-stopped'); assert.equal(e.score, undefined);
    const enough = new Budget(25, path);
    const failed = await runEpisode(generateCases()[0]!, model, 'baseline', enough, async () => { throw new Error('sanitized failure'); });
    assert.equal(failed.status, 'provider-error'); assert.equal(failed.score, undefined);
    assert.ok(new Budget(25, path).spent > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('tool feedback preserves agent traces and never sends grading answers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'insurance-bench-'));
  try {
    let calls = 0;
    const invoke = async (_config: ModelConfig, messages: Message[]) => {
      assert.equal(messages.some(m => m.content.includes('"rubric"')), false);
      calls++;
      if (calls === 2) assert.ok(messages.at(-1)!.content.includes('toolResults'));
      return { text: JSON.stringify({ actions: [{ tool: calls === 1 ? 'list_documents' : 'finish', args: {} }] }), model: 'test', inputTokens: 100, outputTokens: 20 };
    };
    const e = await runEpisode(generateCases()[0]!, model, 'baseline', new Budget(25, join(dir, 'budget.json')), invoke);
    assert.equal(e.status, 'completed'); assert.equal(e.trace.length, 2); assert.equal(e.score?.score, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('explicit challenge output limits and provider reasoning usage are preserved', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'insurance-bench-'));
  try {
    const e = await runEpisode(generateCases()[0]!, {...model, reasoningEffort:'high'}, 'baseline', new Budget(25, join(dir, 'budget.json')), async (_model, _messages, maxOutput) => {
      assert.equal(maxOutput,8192);
      return {text:'{"actions":[{"tool":"finish","args":{}}]}',model:'test',inputTokens:100,outputTokens:800,reasoningEffort:'high',reasoningTokens:750};
    },10,undefined,8192);
    assert.equal(e.trace[0]?.reasoningEffort,'high');
    assert.equal(e.trace[0]?.reasoningTokens,750);
    assert.equal(e.trace[0]?.usage.output,800);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
