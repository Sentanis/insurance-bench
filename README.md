# Insurance Bench

Insurance Bench combines source-qualified public AI benchmark observations with a separately reported synthetic insurance-workflow pilot. It includes an interactive composite score explorer, benchmark methodology, self-run results, and the historical research report.

- Site: https://insurancebench.sentanis.ai
- Benchmark source and run instructions: [insurance-bench/README.md](insurance-bench/README.md)
- Methodology and limitations: [feature specification](specs/features/insurance-bench/README.md)
- Initial matched self-run findings: [readout](insurance-bench/results/reports/2026-10-08-openai-initial-readout.md)

## Build and verify

```sh
npm ci
npm run build
npm run test:composite
```

The default build verifies the SHA-256 manifest and copies the exact published static artifacts from `public/` to `dist/`. It makes no model calls and requires no environment credentials or database. Vercel serves only `dist/`.

The source builders and synthetic harness remain available under `scripts/` and `insurance-bench/`; running provider evaluations requires separate credentials, access, and a new explicit budget. The historical session budget documented in the imported research is evidence, not authorization to spend.

## Provenance

This standalone export preserves the benchmark files from `Sentanis/sentanis-app` at commit `87a18d45746cab84156387daf07ee88b2671605c`. The published files were recovered directly from deployment `dpl_HeuGY5kCFRhGr4cLos7z1RTwM2pi`, whose metadata recorded a dirty source checkout. [publication.json](publication.json) binds every published file to that exact deployment; the source commit alone is not claimed to reproduce its self-run publication.

Historical receipts, hashes, model identities, and migration-era links are preserved as evidence. Credential-shaped synthetic database URLs in three historical verification receipts were redacted for this public export; original receipt hashes refer to the original source, not these sanitized copies. Some links refer to the original private application repository and some frozen replay procedures require its historical commit; this export does not include the application, its Git history, operator credentials, private evaluation caches, or original private cohort directories. The offline website build is fully self-contained.

The workflow cases are fictional. Reported scores are bounded pilot measurements, with coverage and source-equivalence caveats; they do not establish expert-validated insurance accuracy, legal correctness, or a safety certification. Public observations retain their attribution and source links. A public source repository does not change the deployed site's existing Vercel access policy.
