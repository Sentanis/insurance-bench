import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { appendFileSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SelfRunEffort = 'low' | 'high' | 'max';
export interface CodexSubagentRequest {
  model: string; effort: SelfRunEffort; prompt: string; imagePaths?: string[];
  timeoutMs?: number; actorDir: string; outputDir: string; requestId: string;
}
export interface CodexSubagentResult {
  status: 'completed' | 'unavailable' | 'failed' | 'timeout' | 'tool-violation';
  text: string | null; requestedModel: string; requestedEffort: SelfRunEffort;
  observedModel: string | null;
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens?: number } | null;
  elapsedMs: number; eventsPath: string; errorCode: string | null;
  /** True only after child close; false means process cleanup remains pending. */
  terminationConfirmed: boolean | null;
}
export interface CodexTransportDependencies {
  spawn?: (command: string, args: string[], options: {
    cwd: string; env: NodeJS.ProcessEnv; stdio: 'pipe'; detached: true;
  }) => ChildProcessWithoutNullStreams;
  env?: NodeJS.ProcessEnv;
  maxOutputBytes?: number;
  killGraceMs?: number;
}
const DISABLED_FEATURES = [
  'shell_tool', 'unified_exec', 'multi_agent', 'multi_agent_v2', 'apps', 'browser_use',
  'browser_use_external', 'browser_use_full_cdp_access', 'computer_use', 'view_image',
  'code_mode', 'hooks', 'memories', 'goals', 'plugins', 'remote_plugin',
  'skill_search', 'image_generation', 'sleep_tool', 'in_app_browser', 'in_app_chat',
  'in_app_local_automation', 'in_app_voice', 'workspace_dependencies',
] as const;
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(value);
const inside = (child: string, parent: string) => { const rel = relative(parent, child); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
// Only ordinary process/login location variables survive: provider keys, base URLs,
// profiles, app-injected transport overrides and AWS credentials never enter the child.
export function codexChildEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key, value]) => value !== undefined &&
    (['HOME', 'PATH', 'CODEX_HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'TERM'].includes(key) || /^LC_[A-Z_]+$/.test(key))));
}
export function codexSubagentArgs(request: CodexSubagentRequest): string[] {
  return ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--json',
    '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '-m', request.model,
    '-c', `model_reasoning_effort="${request.effort}"`, '-c', 'model_provider="openai"',
    '-c', 'forced_login_method="chatgpt"', '-c', 'web_search="disabled"',
    '-c', 'project_doc_max_bytes=0', '-c', 'suppress_unstable_features_warning=true',
    // This CLI needs the host to bootstrap even with Code Mode disabled. It does
    // not authorize tool use: code_mode stays off and tool events still reject.
    '--enable', 'code_mode_host', '--enable', 'skip_host_skill_discovery',
    ...DISABLED_FEATURES.flatMap(feature => ['--disable', feature]),
    ...(request.imagePaths ?? []).flatMap(path => ['--image', path]), '-'];
}
function errorCode(message: unknown): string {
  const text = typeof message === 'string' ? message : '';
  if (/usage limit|quota|rate limit|too many requests/i.test(text)) return 'USAGE_UNAVAILABLE';
  if (/not supported|unsupported|not available|not found|does not exist|unknown model|invalid model/i.test(text)) return 'MODEL_OR_CONFIGURATION_UNAVAILABLE';
  if (/sign in|log in|login|authenticat|unauthorized|invalid.*key|401|403/i.test(text)) return 'AUTH_UNAVAILABLE';
  return 'CLI_ERROR';
}
/** One guard for every persisted request/metadata/answer value; never redact silently. */
function privacySafe(value: unknown): boolean {
  if (typeof value === 'string') {
    if (/\b(?:sk-[A-Za-z0-9_-]{4,}|AKIA[A-Z0-9]{16}|Bearer\s+[A-Za-z0-9_.-]{8,})|https?:\/\/[^\s/]+:[^\s/]+@|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/i.test(value)) return false;
    if (/\b(?:access[_-]?token|refresh[_-]?token|api[_-]?key|password|client[_-]?secret|private[_-]?key)["']?\s*[:=]\s*["']?[^\s"',}]+/i.test(value)) return false;
    if (/^\s*[\[{]/.test(value)) {
      try { return privacySafe(JSON.parse(value)); } catch { /* Plain answers still receive the string guard. */ }
    }
    return true;
  }
  if (Array.isArray(value)) return value.every(privacySafe);
  if (object(value)) return Object.entries(value).every(([key, entry]) => {
    if (/^(?:accesstoken|refreshtoken|apikey|password|clientsecret|privatekey|authorization)$/.test(key.replace(/[_-]/g, '').toLowerCase()) && entry !== null && entry !== '' && entry !== undefined) return false;
    return privacySafe(key) && privacySafe(entry);
  });
  return true;
}

/** Blind, single-attempt subscription transport. No API client, auth reads, ledger or fallback. */
export async function runCodexSubagent(request: CodexSubagentRequest, dependencies: CodexTransportDependencies = {}): Promise<CodexSubagentResult> {
  if (!identifier(request.model) || !privacySafe(request.model) || !['low', 'high', 'max'].includes(request.effort) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(request.requestId) || !privacySafe(request.requestId) || typeof request.prompt !== 'string' ||
    !request.prompt.trim() || Buffer.byteLength(request.prompt) > 2_000_000) throw new Error('Invalid blind transport request');
  const timeoutMs = request.timeoutMs ?? 600_000, maxBytes = dependencies.maxOutputBytes ?? 2_000_000;
  const killGraceMs = dependencies.killGraceMs ?? 250;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000 ||
    !Number.isSafeInteger(maxBytes) || maxBytes < 128 || maxBytes > 16_000_000 ||
    !Number.isSafeInteger(killGraceMs) || killGraceMs < 1 || killGraceMs > 5000) throw new Error('Invalid transport limits');
  const actorDir = realpathSync(request.actorDir);
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (inside(actorDir, repository) || inside(repository, actorDir)) throw new Error('Actor directory must be outside the grader repository');
  mkdirSync(request.outputDir, { recursive: true, mode: 0o700 });
  const outputDir = realpathSync(request.outputDir);
  if (inside(outputDir, actorDir) || inside(actorDir, outputDir)) throw new Error('Actor and output directories must be separate');
  const images = (request.imagePaths ?? []).map(path => realpathSync(path));
  if (images.some(path => !inside(path, actorDir))) throw new Error('Images must belong to the blind actor directory');
  const requestDir = resolve(outputDir, request.requestId);
  mkdirSync(requestDir, { mode: 0o700 }); // Exclusive request claim; never overwrite a prior attempt.
  const eventsPath = resolve(requestDir, 'events.jsonl');
  if (!privacySafe(eventsPath)) throw new Error('Unsafe transport output path');
  writeFileSync(eventsPath, '', { flag: 'wx', mode: 0o600 });
  const startedAt = Date.now();
  const result: CodexSubagentResult = { status: 'failed', text: null, requestedModel: request.model,
    requestedEffort: request.effort, observedModel: null, usage: null, elapsedMs: 0, eventsPath, errorCode: null, terminationConfirmed: null };
  const record = (event: Record<string, unknown>) => {
    if (!privacySafe(event)) throw new Error('Unsafe transport record');
    appendFileSync(eventsPath, JSON.stringify(event) + '\n');
  };
  record({ type: 'transport.started', requestedModel: request.model, requestedEffort: request.effort });
  return new Promise((resolveResult, rejectResult) => {
    let child: ChildProcessWithoutNullStreams | undefined, pending = '', totalBytes = 0;
    let terminal = false, done = false, closed = false, finalText: string | null = null;
    let pendingOutcome: { status: CodexSubagentResult['status']; code: string } | null = null;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (!child || closed) return;
      // Signal delivery is not termination evidence. Only close confirms cleanup.
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch { try { child.kill('SIGKILL'); } catch { /* Bounded grace records unconfirmed termination. */ } }
    };
    const finish = (status: CodexSubagentResult['status'], code: string | null = null) => {
      if (done) return;
      done = true; clearTimeout(timer); clearTimeout(killTimer);
      result.status = status; result.errorCode = code; result.elapsedMs = Date.now() - startedAt;
      result.terminationConfirmed = child ? closed : null;
      result.text = status === 'completed' && closed ? finalText : null;
      try {
        if (child && !closed) record({ type: 'transport.termination-unconfirmed', cleanupStatus: 'pending' });
        record({ type: 'transport.finished', status, errorCode: code, elapsedMs: result.elapsedMs,
          terminationConfirmed: result.terminationConfirmed });
        if (!privacySafe(result)) throw new Error('Unsafe transport result');
        writeFileSync(resolve(requestDir, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      } catch { rejectResult(new Error('Transport result persistence failed')); return; }
      resolveResult(result);
    };
    const reject = (status: CodexSubagentResult['status'], code: string) => {
      if (done || pendingOutcome) return;
      pendingOutcome = { status, code };
      if (!child || closed) { finish(status, code); return; }
      killTimer = setTimeout(() => finish(status, code), killGraceMs);
      stop();
    };
    const settlePending = () => {
      const outcome = pendingOutcome;
      if (!outcome) return false;
      finish(outcome.status, outcome.code); return true;
    };
    const timer = setTimeout(() => reject('timeout', 'PROCESS_DEADLINE'), timeoutMs);
    const observe = (event: Record<string, unknown>) => {
      if (event.model !== undefined) {
        if (!identifier(event.model) || !privacySafe(event.model)) {
          reject('failed', 'INVALID_MODEL_METADATA'); return;
        }
        if (event.model !== request.model) { reject('failed', 'MODEL_MISMATCH'); return; }
        result.observedModel = event.model;
      }
    };
    const line = (raw: string) => {
      if (done || pendingOutcome || !raw.trim()) return;
      let event: unknown;
      try { event = JSON.parse(raw); } catch { reject('failed', 'INVALID_JSONL'); return; }
      if (!object(event) || typeof event.type !== 'string') { reject('failed', 'INVALID_EVENT'); return; }
      if (event.type === 'thread.started' || event.type === 'turn.started') {
        observe(event); if (!done && !pendingOutcome) record({ type: event.type, ...(result.observedModel ? { model: result.observedModel } : {}) });
      } else if (event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed') {
        // Native CLI errors are transport failures, never solver tool attempts.
        // No warning exception is inferred merely because a later turn starts.
        if (object(event.item) && event.item.type === 'error') {
          const failure = errorCode(event.item.message);
          record({ type: 'item.error', errorCode: failure });
          reject(failure === 'CLI_ERROR' ? 'failed' : 'unavailable', failure); return;
        }
        if (!object(event.item) || !['agent_message', 'reasoning'].includes(String(event.item.type))) {
          record({ type: 'tool.rejected' }); reject('tool-violation', 'DISALLOWED_TOOL_EVENT'); return;
        }
        if (event.item.type === 'agent_message' && event.item.phase !== undefined && event.item.phase !== 'final_answer') {
          reject('failed', 'NONFINAL_MESSAGE_PHASE'); return;
        }
        if (event.item.type === 'agent_message' && event.type === 'item.completed') {
          if (terminal || finalText !== null || typeof event.item.text !== 'string' || !privacySafe(event.item.text)) {
            reject('failed', 'INVALID_OR_SENSITIVE_FINAL'); return;
          }
          if (/max[_ -]?(?:output[_ -]?)?tokens|length|incomplete/i.test(String(event.item.finish_reason ?? event.item.status ?? ''))) {
            reject('failed', 'TRUNCATED_OUTPUT'); return;
          }
          finalText = event.item.text;
          record({ type: 'item.completed', item: { type: 'agent_message', text: finalText } });
        }
      } else if (event.type === 'turn.completed') {
        if (terminal) { reject('failed', 'DUPLICATE_TERMINAL'); return; }
        if (/max[_ -]?(?:output[_ -]?)?tokens|length|incomplete/i.test(String(event.finish_reason ?? event.status ?? ''))) {
          reject('failed', 'TRUNCATED_OUTPUT'); return;
        }
        observe(event); if (done || pendingOutcome) return;
        terminal = true;
        if (object(event.usage) && count(event.usage.input_tokens) && count(event.usage.cached_input_tokens) && count(event.usage.output_tokens) && event.usage.cached_input_tokens <= event.usage.input_tokens) {
          result.usage = { inputTokens: event.usage.input_tokens, cachedInputTokens: event.usage.cached_input_tokens,
            outputTokens: event.usage.output_tokens, ...(count(event.usage.reasoning_tokens) ? { reasoningTokens: event.usage.reasoning_tokens } : {}) };
        }
        record({ type: 'turn.completed', usage: result.usage, observedModel: result.observedModel });
      } else if (event.type === 'error' || event.type === 'turn.failed') {
        const failure = errorCode(event.message ?? (object(event.error) ? event.error.message : undefined));
        record({ type: event.type, errorCode: failure });
        reject(failure === 'CLI_ERROR' ? 'failed' : 'unavailable', failure);
      } else { reject('failed', 'UNKNOWN_EVENT'); }
    };
    try {
      child = (dependencies.spawn ?? spawn)('codex', codexSubagentArgs({ ...request, imagePaths: images }), {
        cwd: actorDir, env: codexChildEnvironment(dependencies.env ?? process.env), stdio: 'pipe', detached: true,
      });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        if (done || pendingOutcome) return;
        totalBytes += Buffer.byteLength(chunk);
        if (totalBytes > maxBytes) { reject('failed', 'OUTPUT_LIMIT'); return; }
        pending += chunk;
        let newline: number;
        while (!done && !pendingOutcome && (newline = pending.indexOf('\n')) !== -1) {
          const next = pending.slice(0, newline); pending = pending.slice(newline + 1);
          try { line(next); } catch { reject('failed', 'EVENT_PROCESSING_FAILED'); }
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (done || pendingOutcome) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) reject('failed', 'OUTPUT_LIMIT'); // Never retain stderr/error bodies.
      });
      child.stdin.on('error', () => { if (!done) reject('failed', 'STDIN_FAILED'); });
      child.on('error', (error: NodeJS.ErrnoException) => reject(error.code === 'ENOENT' ? 'unavailable' : 'failed', error.code === 'ENOENT' ? 'CLI_UNAVAILABLE' : 'SPAWN_FAILED'));
      child.on('close', (exitCode: number | null) => {
        closed = true;
        if (done) return;
        if (settlePending()) return;
        if (pending.trim()) { try { line(pending); } catch { reject('failed', 'EVENT_PROCESSING_FAILED'); } }
        if (done) return;
        if (settlePending()) return;
        if (exitCode !== 0) { reject('failed', 'CLI_EXIT_NONZERO'); return; }
        if (!terminal || finalText === null) { reject('failed', 'INCOMPLETE_JSONL'); return; }
        finish('completed');
      });
      child.stdin.end(request.prompt);
    } catch { reject('failed', 'SPAWN_FAILED'); }
  });
}
