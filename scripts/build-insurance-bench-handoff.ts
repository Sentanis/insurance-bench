import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { buildSelfRunHandoff, writeHandoffTemplates, validateHandoffReturn, type SelfRunHandoff } from '../insurance-bench/selfrun-handoff.ts';

const args = process.argv.slice(2);
if (args.length % 2 || args.some((arg, i) => i % 2 === 0 && !['--root', '--out', '--manifest', '--return'].includes(arg)) || new Set(args.filter((_, i) => i % 2 === 0)).size !== args.length / 2) throw new Error('Use --root FROZEN_ARTIFACT_ROOT --out FROZEN_ARTIFACT_ROOT/handoff/NEW_DIRECTORY; omit --root for generic repo templates only');
const options = new Map(args.filter((_, i) => i % 2 === 0).map((key, i) => [key, args[i * 2 + 1]!]));
if (options.has('--manifest') || options.has('--return')) {
  if (!options.has('--manifest') || !options.has('--return') || options.has('--root') || options.has('--out')) throw new Error('Structural return validation uses exactly --manifest and --return');
  const manifest = JSON.parse(await readFile(resolve(options.get('--manifest')!), 'utf8')) as SelfRunHandoff;
  const accepted = validateHandoffReturn(manifest, JSON.parse(await readFile(resolve(options.get('--return')!), 'utf8')) as unknown);
  process.stdout.write(JSON.stringify({ mode: 'structural-return-validation-only', status: accepted.evidence.status, staticRequests: accepted.evidence.results.length, modelReportsConsistent: accepted.modelReportsConsistent, effortEvidencePresent: accepted.effortEvidencePresent, effortMappingVerified: false, nativeControllerRequired: true, matchedCohortAdmitted: false, providerCalls: 0 }) + '\n');
  process.exit(0);
}
const out = resolve(options.get('--out') ?? (options.has('--root') ? resolve(options.get('--root')!, 'handoff', 'package') : 'insurance-bench/handoff/templates'));
if (options.has('--root')) {
  const bundle = await buildSelfRunHandoff(resolve(options.get('--root')!), out);
  process.stdout.write(JSON.stringify({ mode: 'frozen-answer-free-static-package', profiles: bundle.profiles.length, staticRequests: bundle.requests.length, nativeControllerTasks: bundle.nativeTaskIds.length, bundleSha256: bundle.bundleSha256, providerCalls: 0 }) + '\n');
} else {
  await writeHandoffTemplates(out);
  process.stdout.write(JSON.stringify({ mode: 'templates-only-no-task-execution', providerCalls: 0 }) + '\n');
}
