import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { Observation, ModelRecord } from './composite.js';

interface Projection { models: ModelRecord[]; observations: Observation[] }
interface Registration { files: Record<string, string>; nativeFiles: Record<string, string>; nativeAuditFile: string; nativeAuditSha256: string }
interface PublicReceipt { sourceReceipts: { url: string; rows: number; metric: string; benchmarkVersion: string; pageUpdated: string; projection: { modelId: string; modelLabel: string; reportedScore: number; eligible: boolean }[] }[] }
interface SupplementalReceipt {
  omnidoc: { source: string; rows: string[][]; observations: number };
  gdpval: { source: string; visualLabels: [string, number, string][]; observations: number };
  local: { file: string; sha256: string; score: number; runId: string; auditSha256: string }[];
}
interface NativeAudit {
  status: string; disposition: string; empiricalApproval: boolean; issues: unknown[]; pending: unknown[];
  counts: { terminalPanelsAudited: number; terminalEpisodesAudited: number };
  panels: { nativeRunPath: string; nativeRunSha256: string; macroTaskSuccess: number; coverage: number; completeCoverage: boolean; episodes: { status: string; allPass: boolean; criticalFailure: boolean; gradeMatch: boolean; metadataValid: boolean }[] }[];
}
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** Freeze/receipt checks precede any output mutation. No network or credentials. */
export function assertCompositeSourceAdmission(repoRoot: string): { registrationSha256: string; inputHashes: Record<string, string> } {
  const path = (relative: string): string => {
    if (!relative.startsWith('insurance-bench/') || relative.includes('..') || relative.includes('\\')) throw new Error('Invalid composite source path.');
    return resolve(repoRoot, relative);
  };
  const registrationBytes = readFileSync(path('insurance-bench/composite-registration.json'));
  const registration = JSON.parse(registrationBytes.toString()) as Registration;
  const requiredFiles = ['insurance-bench/composite-published.json', 'insurance-bench/composite-supplemental.json', 'insurance-bench/composite-docs.json', 'insurance-bench/results/meta/composite-published-source-receipt.json', 'insurance-bench/results/meta/composite-supplemental-source-receipt.json'];
  if (Object.keys(registration.files).length !== requiredFiles.length || requiredFiles.some(relative => !registration.files[relative]) || registration.nativeAuditFile !== 'insurance-bench/results/meta/v12-development-independent-audit.json') throw new Error('Incomplete or unexpected source registration.');
  const inputHashes: Record<string, string> = {};
  for (const [relative, expected] of Object.entries(registration.files)) {
    const hash = digest(readFileSync(path(relative)));
    if (hash !== expected) throw new Error(`Composite source freeze mismatch: ${relative}`);
    inputHashes[relative] = hash;
  }
  const load = <T>(relative: string): T => JSON.parse(readFileSync(path(relative), 'utf8')) as T;
  const published = load<Projection>('insurance-bench/composite-published.json');
  const supplemental = load<Projection>('insurance-bench/composite-supplemental.json');
  const publicReceipt = load<PublicReceipt>('insurance-bench/results/meta/composite-published-source-receipt.json');
  const supplementalReceipt = load<SupplementalReceipt>('insurance-bench/results/meta/composite-supplemental-source-receipt.json');
  const publicIds = new Set<string>();
  const publicContracts: Record<string, { benchmark: string; componentId: Observation['componentId'] }> = {
    'https://www.vals.ai/benchmarks/legal_bench': { benchmark: 'LegalBench (Vals)', componentId: 'legal-reasoning' },
    'https://www.vals.ai/benchmarks/hlab': { benchmark: 'Harvey LAB (Vals)', componentId: 'legal-agent' },
  };
  for (const source of publicReceipt.sourceReceipts) {
    const contract = publicContracts[source.url];
    if (!contract) throw new Error('Unexpected public benchmark source.');
    if (source.projection.length !== source.rows) throw new Error('Public receipt row count mismatch.');
    for (const row of source.projection) {
      const matches = published.observations.filter(observation => observation.sourceUrl === source.url && observation.modelId === row.modelId);
      const model = published.models.find(candidate => candidate.id === row.modelId);
      const observation = matches[0];
      if (matches.length !== 1 || !observation || model?.label !== row.modelLabel || observation.score !== row.reportedScore || observation.eligible !== row.eligible || observation.origin !== 'published' || observation.benchmark !== contract.benchmark || observation.componentId !== contract.componentId || observation.metric !== source.metric || observation.benchmarkVersion !== `${source.benchmarkVersion}; Vals snapshot ${source.pageUpdated}`) throw new Error('Public projection differs from its source receipt.');
      publicIds.add(observation.id);
    }
  }
  if (publicIds.size !== published.observations.length) throw new Error('Unreceipted public observation.');
  const verifySupplemental = (source: string, rows: { label: string; score: number }[], expectedCount: number, contract: Pick<Observation, 'benchmark' | 'componentId' | 'metric' | 'benchmarkVersion'>): void => {
    const selected = supplemental.observations.filter(observation => observation.sourceUrl === source);
    if (rows.length !== expectedCount || selected.length !== expectedCount) throw new Error('Supplemental receipt row count mismatch.');
    for (const row of rows) {
      const model = supplemental.models.find(candidate => candidate.label === row.label);
      const matches = selected.filter(observation => observation.modelId === model?.id);
      const observation = matches[0];
      if (matches.length !== 1 || !observation || observation.score !== row.score || observation.origin !== 'published' || observation.eligible !== true || observation.benchmark !== contract.benchmark || observation.componentId !== contract.componentId || observation.metric !== contract.metric || observation.benchmarkVersion !== contract.benchmarkVersion) throw new Error('Supplemental score differs from the native published metric.');
    }
  };
  verifySupplemental(supplementalReceipt.omnidoc.source, supplementalReceipt.omnidoc.rows.map(row => ({ label: row[0]!, score: Number(row[3]) })), supplementalReceipt.omnidoc.observations, {
    benchmark: 'OmniDocBench', componentId: 'documents', metric: 'Overall = ((1-text edit distance)*100 + table TEDS + formula CDM)/3', benchmarkVersion: 'v1.6_full; source f133a71e9e91c3621c7ce8994200a7b394a06eb3',
  });
  verifySupplemental(supplementalReceipt.gdpval.source, supplementalReceipt.gdpval.visualLabels.map(row => ({ label: row[0], score: row[1] })), supplementalReceipt.gdpval.observations, {
    benchmark: 'GDPval', componentId: 'knowledge-work', metric: 'Expert win-or-tie rate versus human deliverable', benchmarkVersion: 'Public gold220; September2025 paper Figure5',
  });
  if (digest(readFileSync(path(registration.nativeAuditFile))) !== registration.nativeAuditSha256) throw new Error('Native audit freeze mismatch.');
  const audit = load<NativeAudit>(registration.nativeAuditFile);
  if (audit.status !== 'final' || audit.disposition !== 'approve-engineering-only' || audit.empiricalApproval !== true || audit.issues.length !== 0 || audit.pending.length !== 0 || audit.counts.terminalPanelsAudited !== 2 || audit.counts.terminalEpisodesAudited !== 6 || audit.panels.length !== 2) throw new Error('Native audit is not final complete engineering approval.');
  if (Object.keys(registration.nativeFiles).length !== 2 || supplementalReceipt.local.length !== 2) throw new Error('Unexpected local observation panel.');
  for (const receipt of supplementalReceipt.local) {
    const expected = registration.nativeFiles[receipt.file];
    const bytes = readFileSync(path(receipt.file));
    if (!expected || expected !== receipt.sha256 || digest(bytes) !== expected || receipt.auditSha256 !== registration.nativeAuditSha256) throw new Error('Native run integrity mismatch.');
    const native = JSON.parse(bytes.toString()) as { runId: string; benchmarkScore: number; completeCoverage: boolean; coverage: number; version: string; summary: { taskCount: number } };
    const panels = audit.panels.filter(panel => panel.nativeRunPath === receipt.file);
    const panel = panels[0];
    if (panels.length !== 1 || !panel || panel.nativeRunSha256 !== expected || panel.macroTaskSuccess !== native.benchmarkScore || panel.coverage !== native.coverage || panel.completeCoverage !== native.completeCoverage || panel.episodes.length !== 3 || panel.episodes.some(episode => episode.status !== 'completed' || !episode.gradeMatch || !episode.metadataValid)) throw new Error('Native score differs from its independently approved audit panel.');
    const successful = panel.episodes.filter(episode => episode.status === 'completed' && episode.allPass && !episode.criticalFailure).length;
    if (Math.abs(successful / panel.episodes.length * 100 - native.benchmarkScore) > 1e-10) throw new Error('Native headline differs from audited episode success.');
    const observation = supplemental.observations.find(candidate => candidate.id === native.runId);
    if (!observation || observation.origin !== 'local' || observation.componentId !== 'insurance-workflows' || observation.benchmark !== 'Insurance Bench' || observation.metric !== 'Equally family-weighted completed-task all-criteria success' || observation.eligible !== true || native.completeCoverage !== true || native.coverage !== 1 || native.summary.taskCount !== 3 || receipt.runId !== native.runId || observation.score !== native.benchmarkScore || receipt.score !== native.benchmarkScore || observation.benchmarkVersion !== native.version) throw new Error('Native macro/coverage provenance mismatch.');
  }
  if (supplemental.observations.length !== supplementalReceipt.omnidoc.observations + supplementalReceipt.gdpval.observations + 2) throw new Error('Unreceipted supplemental observation.');
  return { registrationSha256: digest(registrationBytes), inputHashes };
}
