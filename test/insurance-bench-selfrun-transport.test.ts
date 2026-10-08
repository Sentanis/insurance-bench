import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { runCodexSubagent, codexSubagentArgs, codexChildEnvironment, type CodexSubagentRequest, type CodexTransportDependencies } from '../insurance-bench/selfrun-transport.ts';

const completed = (model?: string) => [
  { type: 'thread.started', ...(model ? { model } : {}) }, { type: 'turn.started' },
  { type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE_REASONING' } },
  { type: 'item.completed', item: { type: 'agent_message', text: '{"answer":42}' } },
  { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 12, reasoning_tokens: 5 } },
];
function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'selfrun-test-'));
  const actorDir = resolve(root, 'actor'), outputDir = resolve(root, 'output'); mkdirSync(actorDir);
  const request: CodexSubagentRequest = { actorDir, outputDir, requestId: 'request-1', model: 'gpt-6.1-sol', effort: 'high', prompt: 'Return only the answer JSON.' };
  return { root, request, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
function fakeTransport(events: unknown[] | string, exitCode = 0, error?: string): { spawn: NonNullable<CodexTransportDependencies['spawn']>; calls: { args: string[]; env: NodeJS.ProcessEnv; cwd: string; input: string }[] } {
  const calls: { args: string[]; env: NodeJS.ProcessEnv; cwd: string; input: string }[] = [];
  return { calls, spawn: (_command, args, options) => {
    const process = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
    const call = { args, env: options.env, cwd: options.cwd, input: '' }; calls.push(call);
    process.stdin.on('data', data => { call.input += data.toString(); });
    queueMicrotask(() => {
      if (error) { process.emit('error', Object.assign(new Error('SECRET_ERROR_BODY'), { code: error })); return; }
      process.stderr.write('SECRET_STDERR');
      const body = typeof events === 'string' ? events : events.map(event => JSON.stringify(event)).join('\n') + '\n';
      // Deliberately split a JSON token across chunks.
      process.stdout.write(body.slice(0, 8)); process.stdout.write(body.slice(8));
      process.emit('close', exitCode);
    });
    return process as unknown as ChildProcessWithoutNullStreams;
  } };
}
test('blind CLI returns actual usage, checks observed identity and never retains reasoning/stderr', async () => {
  const f = fixture(); try {
    const fake = fakeTransport(completed('gpt-6.1-sol'));
    const result = await runCodexSubagent(f.request, { spawn: fake.spawn });
    assert.equal(result.status, 'completed'); assert.equal(result.text, '{"answer":42}');
    assert.equal(result.requestedModel, 'gpt-6.1-sol'); assert.equal(result.observedModel, 'gpt-6.1-sol'); assert.equal(result.terminationConfirmed, true);
    assert.deepEqual(result.usage, { inputTokens: 100, cachedInputTokens: 20, outputTokens: 12, reasoningTokens: 5 });
    assert.equal(fake.calls[0]?.input, f.request.prompt); assert.equal(fake.calls[0]?.cwd, realpathSync(f.request.actorDir));
    const stored = readFileSync(result.eventsPath, 'utf8'); assert.ok(!stored.includes('PRIVATE_REASONING')); assert.ok(!stored.includes('SECRET_STDERR'));
    assert.ok(readFileSync(resolve(f.request.outputDir, f.request.requestId, 'result.json'), 'utf8').includes('inputTokens'));
  } finally { f.cleanup(); }
});
test('no model identity or malformed/missing usage stays unknown rather than copying requested values or inventing zeroes', async () => {
  for (const usage of [undefined, { input_tokens: -1, output_tokens: 9 }, { input_tokens: 8, cached_input_tokens: '0', output_tokens: 1 }]) {
    const f = fixture(); try {
      const events = completed().map(event => event.type === 'turn.completed' ? { type: 'turn.completed', usage } : event);
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
      assert.equal(result.status, 'completed'); assert.equal(result.observedModel, null); assert.equal(result.usage, null);
    } finally { f.cleanup(); }
  }
});
test('tool events fail closed and no solver fallback is dispatched', async () => {
  for (const type of ['command_execution', 'mcp_tool_call', 'web_search', 'file_change', 'code_mode', 'code_mode_host', 'future_tool']) {
    const f = fixture(); try {
      const fake = fakeTransport([{ type: 'item.completed', item: { type, command: 'SECRET_COMMAND' } }, ...completed()]);
      const result = await runCodexSubagent(f.request, { spawn: fake.spawn });
      assert.equal(result.status, 'tool-violation'); assert.equal(result.text, null); assert.equal(fake.calls.length, 1);
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('SECRET_COMMAND'));
    } finally { f.cleanup(); }
  }
});
test('quota/auth/model availability errors are reduced to codes without error bodies', async () => {
  for (const [message, code] of [['usage limit SECRET', 'USAGE_UNAVAILABLE'], ['model not supported SECRET', 'MODEL_OR_CONFIGURATION_UNAVAILABLE'], ['authentication failed SECRET', 'AUTH_UNAVAILABLE']]) {
    const f = fixture(); try {
      const fake = fakeTransport([{ type: 'turn.failed', error: { message } }], 1);
      const result = await runCodexSubagent(f.request, { spawn: fake.spawn });
      assert.equal(result.status, 'unavailable'); assert.equal(result.errorCode, code); assert.equal(result.text, null);
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('SECRET')); assert.equal(fake.calls.length, 1);
    } finally { f.cleanup(); }
  }
});
test('missing binary returns unavailable without leaking exception body', async () => {
  const f = fixture(); try {
    const result = await runCodexSubagent(f.request, { spawn: fakeTransport([], 1, 'ENOENT').spawn });
    assert.equal(result.status, 'unavailable'); assert.equal(result.errorCode, 'CLI_UNAVAILABLE');
    assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('SECRET_ERROR_BODY'));
  } finally { f.cleanup(); }
});
test('invalid, truncated, nonterminal and nonzero-exit outputs cannot become completed answers', async () => {
  for (const [events, exitCode, code] of [
    ['{"type":', 0, 'INVALID_JSONL'], [[{ type: 'item.completed', item: { type: 'agent_message', text: 'answer' } }], 0, 'INCOMPLETE_JSONL'],
    [completed(), 1, 'CLI_EXIT_NONZERO'], [[{ type: 'unexpected' }], 0, 'UNKNOWN_EVENT'],
  ] as const) {
    const f = fixture(); try {
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(typeof events === 'string' ? events : [...events], exitCode).spawn });
      assert.equal(result.status, 'failed'); assert.equal(result.errorCode, code); assert.equal(result.text, null);
    } finally { f.cleanup(); }
  }
});
test('output byte ceiling rejects rather than slicing a usable-looking answer', async () => {
  const f = fixture(); try {
    const result = await runCodexSubagent(f.request, { spawn: fakeTransport(completed()).spawn, maxOutputBytes: 128 });
    assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'OUTPUT_LIMIT'); assert.equal(result.text, null);
  } finally { f.cleanup(); }
});
test('deadline terminates a hanging child and writes terminal receipt', async () => {
  const f = fixture(); let killed = false; try {
    const result = await runCodexSubagent({ ...f.request, timeoutMs: 10 }, { spawn: () => Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => { killed = true; return true; },
    }) as unknown as ChildProcessWithoutNullStreams });
    assert.equal(result.status, 'timeout'); assert.equal(result.errorCode, 'PROCESS_DEADLINE'); assert.equal(killed, true);
  } finally { f.cleanup(); }
});
test('request files are exclusively claimed and cannot overwrite an earlier run', async () => {
  const f = fixture(); try {
    const fake = fakeTransport(completed()); await runCodexSubagent(f.request, { spawn: fake.spawn });
    await assert.rejects(runCodexSubagent(f.request, { spawn: fake.spawn })); assert.equal(fake.calls.length, 1);
  } finally { f.cleanup(); }
});
test('configuration uses exact model/effort and removes keys, URLs, provider and child overrides', () => {
  const args = codexSubagentArgs({ model: 'gpt-6-astra', effort: 'max', prompt: '', actorDir: '', outputDir: '', requestId: '' });
  for (const value of ['--ignore-user-config', '--ephemeral', '--json', '--sandbox', 'read-only', 'model_reasoning_effort="max"', 'model_provider="openai"', 'forced_login_method="chatgpt"', 'web_search="disabled"', 'project_doc_max_bytes=0', 'suppress_unstable_features_warning=true']) assert.ok(args.includes(value));
  for (const feature of ['shell_tool', 'unified_exec', 'multi_agent', 'apps', 'browser_use', 'computer_use', 'view_image', 'code_mode', 'hooks', 'memories', 'goals']) assert.ok(args.some((arg, i) => arg === '--disable' && args[i + 1] === feature));
  assert.ok(args.some((arg, i) => arg === '--enable' && args[i + 1] === 'code_mode_host'));
  assert.ok(!args.some((arg, i) => arg === '--disable' && args[i + 1] === 'code_mode_host'));
  assert.deepEqual(codexChildEnvironment({ HOME: '/home/operator', PATH: '/bin', CODEX_HOME: '/auth/location', LANG: 'en_US',
    OPENAI_API_KEY: 'SECRET', OPENAI_BASE_URL: 'https://provider', CODEX_API_KEY: 'SECRET', AWS_PROFILE: 'production',
    ANTHROPIC_API_KEY: 'SECRET', CODEX_RS_PROXY: 'SECRET' }), { HOME: '/home/operator', PATH: '/bin', CODEX_HOME: '/auth/location', LANG: 'en_US' });
});
test('repository actor directories, nonblind attachments and unsafe identifiers are rejected before dispatch', async () => {
  const f = fixture(); const fake = fakeTransport(completed()); try {
    await assert.rejects(runCodexSubagent({ ...f.request, actorDir: process.cwd() }, { spawn: fake.spawn }), /grader repository/);
    await assert.rejects(runCodexSubagent({ ...f.request, requestId: '../escape' }, { spawn: fake.spawn }));
    await assert.rejects(runCodexSubagent({ ...f.request, model: 'model" injected' }, { spawn: fake.spawn }));
    assert.equal(fake.calls.length, 0);
  } finally { f.cleanup(); }
});

test('explicit truncation and sensitive final output are rejected without retained answer bytes', async () => {
  const secret = 'sk-' + 'secretcredential'.repeat(3);
  const variants = [
    [{ type: 'item.completed', item: { type: 'agent_message', text: secret } }, { type: 'turn.completed' }],
    [{ type: 'item.completed', item: { type: 'agent_message', text: 'partial', finish_reason: 'max_output_tokens' } }, { type: 'turn.completed' }],
    completed().map(event => event.type === 'turn.completed' ? { ...event, finish_reason: 'length' } : event),
  ];
  for (const events of variants) {
    const f = fixture(); try {
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
      assert.equal(result.status, 'failed'); assert.equal(result.text, null);
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes(secret));
    } finally { f.cleanup(); }
  }
});
test('duplicate terminal events and inconsistent model observations cannot pass', async () => {
  for (const events of [[...completed(), { type: 'turn.completed' }],
    [{ type: 'thread.started', model: 'first-model' }, ...completed('second-model')]]) {
    const f = fixture(); try {
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
      assert.equal(result.status, 'failed'); assert.equal(result.text, null);
    } finally { f.cleanup(); }
  }
});

test('observed model must match the exact requested model without aliases', async () => {
  const f = fixture(); try {
    const result = await runCodexSubagent(f.request, { spawn: fakeTransport(completed('gpt-6-luna')).spawn });
    assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'MODEL_MISMATCH');
    assert.equal(result.observedModel, null); assert.equal(result.text, null); assert.equal(result.terminationConfirmed, true);
    assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('gpt-6-luna'));
  } finally { f.cleanup(); }
});
test('requested and observed metadata cannot persist credential-shaped identifiers', async () => {
  const f = fixture(); const secret = 'sk-secretcredential0123456789'; try {
    const fake = fakeTransport(completed(secret));
    await assert.rejects(runCodexSubagent({ ...f.request, model: secret }, { spawn: fake.spawn }), /Invalid blind/);
    assert.equal(fake.calls.length, 0);
    const result = await runCodexSubagent(f.request, { spawn: fake.spawn });
    assert.equal(result.status, 'failed'); assert.equal(result.observedModel, null);
    assert.ok(!readFileSync(result.eventsPath, 'utf8').includes(secret));
    assert.ok(!readFileSync(resolve(f.request.outputDir, f.request.requestId, 'result.json'), 'utf8').includes(secret));
  } finally { f.cleanup(); }
});
test('JWTs and secret-valued JSON fields cannot persist in final answer artifacts', async () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvcGVyYXRvciJ9.signature123456789';
  for (const text of [jwt, ...['access_token', 'refresh_token', 'api_key', 'password', 'accessToken'].map(key => JSON.stringify({ [key]: 'SECRET_VALUE_123' })),
    JSON.stringify({ nested: { access_token: jwt } })]) {
    const f = fixture(); try {
      const events = [{ type: 'item.completed', item: { type: 'agent_message', text } }, { type: 'turn.completed' }];
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
      assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'INVALID_OR_SENSITIVE_FINAL');
      assert.equal(result.text, null);
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('SECRET_VALUE'));
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes(jwt));
      const stored = readFileSync(resolve(f.request.outputDir, f.request.requestId, 'result.json'), 'utf8');
      assert.ok(!stored.includes('SECRET_VALUE')); assert.ok(!stored.includes(jwt));
    } finally { f.cleanup(); }
  }
});
test('synchronous stdin failure kills the spawned child and waits for its close', async () => {
  const f = fixture(); let killCalls = 0; try {
    const result = await runCodexSubagent(f.request, { spawn: () => {
      const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
        kill: () => { killCalls++; queueMicrotask(() => child.emit('close', null)); return true; } });
      child.stdin.end = (() => { throw new Error('SECRET_THROW_BODY'); }) as typeof child.stdin.end;
      return child as unknown as ChildProcessWithoutNullStreams;
    } });
    assert.equal(result.status, 'failed'); assert.equal(killCalls, 1); assert.equal(result.terminationConfirmed, true);
    assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('SECRET_THROW_BODY'));
  } finally { f.cleanup(); }
});
test('failed kill without close records cleanup pending within bounded grace', async () => {
  const f = fixture(); let killCalls = 0; try {
    const result = await runCodexSubagent({ ...f.request, timeoutMs: 5 }, { killGraceMs: 5, spawn: () => Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => { killCalls++; return false; },
    }) as unknown as ChildProcessWithoutNullStreams });
    assert.equal(result.status, 'timeout'); assert.equal(result.errorCode, 'PROCESS_DEADLINE');
    assert.equal(result.terminationConfirmed, false); assert.equal(killCalls, 1); assert.ok(result.elapsedMs < 1000);
    assert.ok(readFileSync(result.eventsPath, 'utf8').includes('transport.termination-unconfirmed'));
    assert.ok(readFileSync(result.eventsPath, 'utf8').includes('"cleanupStatus":"pending"'));
  } finally { f.cleanup(); }
});

test('explicit commentary, analysis and unknown phases cannot become final answers', async () => {
  for (const phase of ['commentary', 'analysis', 'unknown-phase']) {
    const f = fixture(); try {
      const events = [{ type: 'item.completed', item: { type: 'agent_message', phase, text: '{"answer":42,"partial":true}' } },
        { type: 'turn.completed' }];
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
      assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'NONFINAL_MESSAGE_PHASE');
      assert.equal(result.text, null); assert.equal(result.terminationConfirmed, true);
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('partial'));
    } finally { f.cleanup(); }
  }
});
test('explicit final_answer is accepted and still requires process close', async () => {
  const f = fixture(); try {
    const events = completed().map(event => event.type === 'item.completed' && event.item?.type === 'agent_message'
      ? { ...event, item: { ...event.item, phase: 'final_answer' } } : event);
    const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
    assert.equal(result.status, 'completed'); assert.equal(result.text, '{"answer":42}');
    assert.equal(result.terminationConfirmed, true);
  } finally { f.cleanup(); }
});
test('multiple unphased messages remain ambiguous rather than selecting or concatenating the last message', async () => {
  const f = fixture(); try {
    const events = [{ type: 'item.completed', item: { type: 'agent_message', text: 'commentary' } }, ...completed()];
    const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
    assert.equal(result.status, 'failed'); assert.equal(result.text, null); assert.equal(result.terminationConfirmed, true);
    assert.equal(result.errorCode, 'INVALID_OR_SENSITIVE_FINAL');
  } finally { f.cleanup(); }
});

test('native error items before turn startup are sanitized transport errors, never tool violations', async () => {
  const f = fixture(); try {
    const events = [{ type: 'thread.started', thread_id: 'synthetic-thread' },
      { type: 'item.completed', item: { id: 'item-1', type: 'error', message: 'startup transport problem SECRET_BODY_1' } },
      { type: 'item.completed', item: { id: 'item-2', type: 'error', message: 'startup transport problem SECRET_BODY_2' } },
      { type: 'turn.started' }, ...completed()];
    const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
    assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'CLI_ERROR');
    assert.equal(result.text, null); assert.equal(result.usage, null); assert.equal(result.terminationConfirmed, true);
    const stored = readFileSync(result.eventsPath, 'utf8');
    assert.ok(stored.includes('"type":"item.error"')); assert.ok(!stored.includes('SECRET_BODY'));
    assert.ok(!stored.includes('tool.rejected')); assert.ok(!stored.includes('DISALLOWED_TOOL_EVENT'));
  } finally { f.cleanup(); }
});
test('native availability error items use sanitized codes and cannot be ignored after successful-looking output', async () => {
  for (const [message, code] of [['usage limit SECRET', 'USAGE_UNAVAILABLE'], ['authentication failed SECRET', 'AUTH_UNAVAILABLE'],
    ['model not supported SECRET', 'MODEL_OR_CONFIGURATION_UNAVAILABLE']]) {
    const f = fixture(); try {
      const events = [{ type: 'item.completed', item: { id: 'synthetic', type: 'error', message } }, ...completed()];
      const result = await runCodexSubagent(f.request, { spawn: fakeTransport(events).spawn });
      assert.equal(result.status, 'unavailable'); assert.equal(result.errorCode, code);
      assert.equal(result.text, null); assert.equal(result.terminationConfirmed, true);
      assert.ok(!readFileSync(result.eventsPath, 'utf8').includes('SECRET'));
    } finally { f.cleanup(); }
  }
});
