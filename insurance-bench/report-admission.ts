import path from 'node:path';
import type { Run } from './runner.ts';

interface RegisteredPanel {
 id: string; modelConfiguration: Run['model']; split: string; variant: Run['variant'];
 taskIds: string[]; datasetHash: string; repeat: number;
 limits: NonNullable<Run['limits']> & {transportDeadlineMs?: number};
 harnessHash: string; dispatchReceiptPath?: string; promptHash?: string;
}
interface Registration {
 generation: string; sourceFingerprint: string; fullCorpusHash: string;
 responseFormat?: string; panels: RegisteredPanel[];
}
interface AuditedPanel {
 id?: string; panelId?: string; receiptPath: string; receiptSha256: string;
 nativeRunPath: string; nativeRunSha256: string; completeCoverage: boolean;
 freezeCommit?: string; episodes: {taskId: string}[];
}
interface NativeAudit {
 disposition: string; registrationPath: string; registrationSha256: string;
 sourceFingerprint: string; fullCorpusHash?: string; freezeCommit?: string;
 releasePath?: string; releaseSha256?: string; releaseCommit?: string;
 developmentAuditPath?: string; developmentAuditSha256?: string;
 issues: unknown[]; pending?: unknown[]; panels: AuditedPanel[];
 counts: {pendingPanels: number; terminalPanelsAudited: number; terminalEpisodesAudited: number};
}
interface Receipt extends Omit<RegisteredPanel, 'split'> {
 status: string; panelId?: string; sourceFingerprint: string; freezeCommit: string;
 nativeRunPath: string; nativeRunSha256: string;
 limits: NonNullable<Run['limits']> & {transportDeadlineMs?: number};
}
export interface ReportBuilderIO {
 readJson(p: string): unknown;
 sha(p: string): string;
 exists(p: string): boolean;
 listRuns(): string[];
}
const base='insurance-bench/results/',meta=base+'meta/';
const normalized=(value: unknown): unknown=>value && typeof value==='object'
 ? Array.isArray(value) ? value.map(normalized)
 : Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalized((value as Record<string, unknown>)[k])])) : value;
const canonical=(value: unknown): string=>JSON.stringify(normalized(value));
const same=(a: unknown,b: unknown)=>canonical(a)===canonical(b);
const ensure: (condition: unknown)=>asserts condition=(condition)=>{if(!condition)throw new Error('Report admission binding failed');};
const resultPath=(p: unknown): string=>{
 ensure(typeof p==='string' && p.startsWith(base) && !p.split('/').includes('..') && !path.isAbsolute(p));
 return p as string;
};
/** V9's source freeze and separately committed held dispatch release are distinct. */
function legacyHoldoutCommit(registrationPath: string, registration: Registration,
 panel: RegisteredPanel, audited: AuditedPanel, audit: NativeAudit, io: ReportBuilderIO): string {
 const releasePath=meta+'v09-holdout-release.json', developmentPath=meta+'investigation-development-independent-audit-v0.9.json';
 ensure(typeof audit.freezeCommit==='string' && /^[a-f0-9]{40}$/.test(audit.freezeCommit) &&
  typeof audit.releaseCommit==='string' && /^[a-f0-9]{40}$/.test(audit.releaseCommit) &&
  (audited.freezeCommit===undefined || audited.freezeCommit===audit.releaseCommit));
 ensure(audit.releasePath===releasePath && io.exists(releasePath) &&
  typeof audit.releaseSha256==='string' && /^[a-f0-9]{64}$/.test(audit.releaseSha256) && io.sha(releasePath)===audit.releaseSha256);
 const release=io.readJson(releasePath) as {
  status?: string; sourceFingerprint?: string; fullCorpusHash?: string; harnessHash?: string;
  taskIds?: string[]; repeat?: number; developmentAuditPath?: string; developmentAuditSha256?: string;
  developmentDispatchSha256?: Record<string,string>;
 };
 ensure(release.status==='fresh-holdout-release-no-held-output-read' &&
  release.sourceFingerprint===registration.sourceFingerprint && release.harnessHash===panel.harnessHash &&
  same(release.taskIds,panel.taskIds) && release.repeat===panel.repeat &&
  (release.fullCorpusHash===undefined || release.fullCorpusHash===registration.fullCorpusHash));
 ensure(release.developmentAuditPath===developmentPath && audit.developmentAuditPath===developmentPath &&
  io.exists(developmentPath) && typeof release.developmentAuditSha256==='string' &&
  /^[a-f0-9]{64}$/.test(release.developmentAuditSha256) &&
  release.developmentAuditSha256===audit.developmentAuditSha256 && io.sha(developmentPath)===release.developmentAuditSha256);
 const development=io.readJson(developmentPath) as NativeAudit;
 // Its exact registration SHA binds the full corpus when the original audit omits fullCorpusHash.
 ensure(development.disposition==='approve-engineering-only' && development.registrationPath===registrationPath &&
  development.registrationSha256===io.sha(registrationPath) && development.sourceFingerprint===registration.sourceFingerprint &&
  typeof development.freezeCommit==='string' && /^[a-f0-9]{40}$/.test(development.freezeCommit) &&
  development.freezeCommit===audit.freezeCommit &&
  (development.fullCorpusHash===undefined || development.fullCorpusHash===registration.fullCorpusHash) &&
  Array.isArray(development.issues) && development.issues.length===0 &&
  Array.isArray(development.pending) && development.pending.length===0);
 const devPanels=registration.panels.filter(p=>p.split==='dev'), dispatch=release.developmentDispatchSha256;
 ensure(dispatch && same(Object.keys(dispatch).sort(),devPanels.map(p=>p.id).sort()));
 for(const p of devPanels){const receiptPath=resultPath(p.dispatchReceiptPath??meta+'v09-dispatch-'+p.id+'.json');
  ensure(io.exists(receiptPath) && typeof dispatch[p.id]==='string' && /^[a-f0-9]{64}$/.test(dispatch[p.id]!) && io.sha(receiptPath)===dispatch[p.id]);}
 return audit.releaseCommit;
}
/** Only terminal native paths covered by the exact independent audit are admitted.
 * Legacy v9 audits omit fullCorpusHash: exact registration SHA binds the full corpus.
 * New candidate audits must also explicitly bind fullCorpusHash.
 */
export function admitRegisteredReportPanels(registrationPath: string, auditPaths: string[], io: ReportBuilderIO,
 legacyV9=false): Run[] {
 const registration=io.readJson(resultPath(registrationPath)) as Registration;
 ensure(Array.isArray(registration.panels) && registration.panels.length>0 &&
  typeof registration.fullCorpusHash==='string' && /^[a-f0-9]{64}$/.test(registration.fullCorpusHash) &&
  typeof registration.sourceFingerprint==='string' && /^[a-f0-9]{64}$/.test(registration.sourceFingerprint));
 const auditPanels=new Map<string, {panel: AuditedPanel; audit: NativeAudit}>();
 for(const auditPath of auditPaths){
  const audit=io.readJson(resultPath(auditPath)) as NativeAudit;
  ensure(audit.disposition==='approve-engineering-only' && audit.registrationPath===registrationPath &&
   audit.registrationSha256===io.sha(registrationPath) && audit.sourceFingerprint===registration.sourceFingerprint &&
   Array.isArray(audit.issues) && audit.issues.length===0 &&
   (audit.pending===undefined || (Array.isArray(audit.pending) && audit.pending.length===0)) &&
   audit.counts?.pendingPanels===0 && Array.isArray(audit.panels) &&
   audit.counts.terminalPanelsAudited===audit.panels.length);
  ensure(legacyV9 ? audit.fullCorpusHash===undefined || audit.fullCorpusHash===registration.fullCorpusHash
   : audit.fullCorpusHash===registration.fullCorpusHash);
  const auditedEpisodeCount=audit.panels.reduce((count: number,p: AuditedPanel)=>count+(p.episodes?.length??0),0);
  ensure(audit.counts.terminalEpisodesAudited===auditedEpisodeCount);
  for(const panel of audit.panels){
   const id=panel.id??panel.panelId;
   ensure(typeof id==='string' && !auditPanels.has(id) && (panel.id===undefined || panel.panelId===undefined || panel.id===panel.panelId));
   auditPanels.set(id,{panel,audit});
  }
 }
 ensure(auditPanels.size===registration.panels.length && new Set(registration.panels.map((p: RegisteredPanel)=>p.id)).size===registration.panels.length);
 // Admission of all receipt/audit bindings precedes loading any native body.
 const bindings=registration.panels.map((p: RegisteredPanel)=>{
  const entry=auditPanels.get(p.id);ensure(entry);const {panel: audited,audit}=entry!;
  ensure(typeof p.id==='string' && /^[a-zA-Z0-9-]+$/.test(p.id) &&
   Array.isArray(p.taskIds) && p.taskIds.length>0 && new Set(p.taskIds).size===p.taskIds.length &&
   Number.isInteger(p.repeat) && p.repeat>0);
  const receiptPath=resultPath(p.dispatchReceiptPath??(legacyV9 ? meta+'v09-dispatch-'+p.id+'.json' : undefined));
  ensure(audited.receiptPath===receiptPath && audited.receiptSha256===io.sha(receiptPath));
  const receipt=io.readJson(receiptPath) as Receipt;
  const auditFreeze=legacyV9 && p.split==='holdout'
   ? legacyHoldoutCommit(registrationPath,registration,p,audited,audit,io)
   : audited.freezeCommit??audit.freezeCommit;
  ensure(typeof auditFreeze==='string' && /^[a-f0-9]{40}$/.test(auditFreeze));
  ensure(receipt.status==='terminal-native-run' && receipt.id===p.id &&
   (receipt.panelId===undefined || receipt.panelId===p.id) && receipt.sourceFingerprint===registration.sourceFingerprint &&
   receipt.freezeCommit===auditFreeze &&
   receipt.nativeRunPath===audited.nativeRunPath && receipt.nativeRunSha256===audited.nativeRunSha256);
  ensure(same(receipt.modelConfiguration,p.modelConfiguration) && receipt.variant===p.variant && receipt.repeat===p.repeat &&
   same(receipt.taskIds,p.taskIds) && receipt.datasetHash===p.datasetHash && receipt.harnessHash===p.harnessHash &&
   receipt.limits?.maxTurns===p.limits?.maxTurns && receipt.limits?.maxOutputTokens===p.limits?.maxOutputTokens &&
   (p.limits.transportDeadlineMs===undefined
    ? receipt.limits.transportDeadlineMs===undefined || receipt.limits.transportDeadlineMs===600000
    : receipt.limits.transportDeadlineMs===p.limits.transportDeadlineMs && receipt.limits.transportDeadlineMs===600000) &&
   (p.promptHash===undefined || receipt.promptHash===p.promptHash));
  const nativePath=resultPath(receipt.nativeRunPath);
  ensure(io.sha(nativePath)===receipt.nativeRunSha256 && Array.isArray(audited.episodes) &&
   audited.episodes.length<=p.taskIds.length*p.repeat);
  return {p,audited,nativePath};
 });
 return bindings.map(({p,audited,nativePath}: {p: RegisteredPanel;audited: AuditedPanel;nativePath: string})=>{
  const run=io.readJson(nativePath) as Run & {responseFormat?: string};
  ensure(run.version===registration.generation && run.datasetHash===p.datasetHash && run.harnessHash===p.harnessHash &&
   same(run.model,p.modelConfiguration) && run.variant===p.variant && run.repeat===p.repeat && same(run.taskIds,p.taskIds) &&
   run.limits?.maxTurns===p.limits.maxTurns && run.limits?.maxOutputTokens===p.limits.maxOutputTokens &&
   run.responseFormat===registration.responseFormat && run.completeCoverage===audited.completeCoverage &&
   run.episodes.length===audited.episodes.length && run.episodes.length<=p.taskIds.length*p.repeat &&
   run.episodes.every(e=>p.taskIds.includes(e.taskId) && e.split===p.split) &&
   audited.episodes.every(e=>p.taskIds.includes(e.taskId)));
  if(run.completeCoverage)ensure(run.episodes.length===p.taskIds.length*p.repeat && run.episodes.every(e=>e.score));
  for(const taskId of p.taskIds){
   const nativeEpisodes=run.episodes.filter(e=>e.taskId===taskId);
   const auditedEpisodes=audited.episodes.filter((e: {taskId: string})=>e.taskId===taskId);
   ensure(nativeEpisodes.length===auditedEpisodes.length && nativeEpisodes.length<=p.repeat);
   if(run.completeCoverage)ensure(nativeEpisodes.length===p.repeat);
  }
  return run;
 });
}
