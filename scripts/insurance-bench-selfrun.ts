import { prepareSelfRun, runSelfRun, selfRunStatus, admitSelfRunPublication } from '../insurance-bench/selfrun-coordinator.ts';

async function main() {
  const [operation, ...args] = process.argv.slice(2);
  const option = (name: string) => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1]; };
  const root = option('root');
  if (!root || !['prepare', 'run', 'status', 'admit'].includes(operation ?? '') || args.some((arg, index) => index % 2 === 0 && !['--root', '--parallel', '--profiles'].includes(arg)) || (option('profiles') && operation !== 'prepare')) throw new Error('Self-run: prepare --root OUTSIDE_REPO [--profiles id,id] | run --root OUTSIDE_REPO [--parallel 1|2|3] | status --root OUTSIDE_REPO | admit --root OUTSIDE_REPO');
  const profileIds = option('profiles')?.split(',').map(id => id.trim()).filter(Boolean);
  const result = operation === 'prepare' ? await prepareSelfRun({ root, ...(profileIds ? { profileIds } : {}) }) : operation === 'run' ? await runSelfRun({ root, parallel: Number(option('parallel') ?? 3), onProgress: summary => { const complete = summary.profiles.filter(profile => profile.status === 'completed').length; process.stderr.write(`${summary.cohortId}: ${complete}/${summary.registeredProfiles.length} profiles complete\n`); } }) : operation === 'admit' ? await admitSelfRunPublication(root) : await selfRunStatus(root);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main().catch(error => { process.stderr.write((error instanceof Error ? error.message : 'Self-run failed') + '\n'); process.exitCode = 1; });
