import { main } from '../insurance-bench/cli.ts';
main().catch(error => { console.error(error instanceof Error ? error.message : 'Insurance Bench failed'); process.exitCode = 1; });
