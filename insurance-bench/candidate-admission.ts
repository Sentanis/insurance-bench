import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export interface CandidateDispatchConfig {
  /** Canonical root derived by the caller from its own entry-script location. */
  repositoryRoot: string;
  freezeCommit: string;
  admissionPath: string;
  panelId: string;
  /** Immutable entry-point source list; never populated from command-line input. */
  sourceFiles: readonly string[];
  generation: string;
  sourceFingerprint: string;
  promptHash: string;
  fullCorpusHash: string;
  datasetHash: string;
  modelAlias: string;
  taskIds: readonly string[];
  modelConfiguration: unknown;
  variant: string;
  repeat: number;
  limits: unknown;
  harnessHash: string;
  split: "dev" | "holdout";
  releasePath?: string;
}
const fail = (): never => { throw new Error("Insurance Bench candidate dispatch admission rejected"); };
const obj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : obj(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const nonnegative = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);

/** Read-only admission; it never creates a ledger, dispatch receipt, auth session or provider call. */
export function admitCandidateDispatch(config: CandidateDispatchConfig) {
  try {
    const root = fs.realpathSync(config.repositoryRoot);
    if (root !== config.repositoryRoot || process.cwd() !== root || !/^[a-f0-9]{40}$/.test(config.freezeCommit)) fail();
    const local = (relative: unknown) => {
      if (typeof relative !== "string" || !relative || path.isAbsolute(relative) || /[\\:]/.test(relative) || [...relative].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || relative.split("/").some(p => p === ".." || p === "." || p === "")) fail();
      const target = path.resolve(root, relative as string), real = fs.realpathSync(target);
      if (!real.startsWith(root + path.sep) || real !== target || !fs.statSync(real).isFile()) fail();
      return { relative: relative as string, absolute: real, bytes: fs.readFileSync(real) };
    };
    const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
    const parse = (bytes: Buffer) => { const value: unknown = JSON.parse(bytes.toString("utf8")); if (!obj(value)) fail(); return value as Record<string, unknown>; };
    const committed = (relative: unknown) => {
      const file = local(relative);
      if (!git(["show", `${config.freezeCommit}:${file.relative}`]).equals(file.bytes)) fail();
      return file;
    };
    if (!config.sourceFiles.length || new Set(config.sourceFiles).size !== config.sourceFiles.length) fail();
    for (const source of config.sourceFiles) committed(source);
    const admission = committed(config.admissionPath), registration = parse(admission.bytes);
    if (registration.generation !== config.generation || registration.sourceFingerprint !== config.sourceFingerprint || !digest(config.sourceFingerprint) || registration.fullCorpusHash !== config.fullCorpusHash || !digest(config.fullCorpusHash) || registration.capUsd !== 75 || !nonnegative(registration.minimumReservedUsd)) fail();
    if (!Array.isArray(registration.panels) || !config.panelId || !config.taskIds.length || new Set(config.taskIds).size !== config.taskIds.length || !Number.isSafeInteger(config.repeat) || config.repeat < 1 || !digest(config.promptHash) || !digest(config.harnessHash)) fail();
    const matches = (registration.panels as unknown[]).filter(p => obj(p) && p.id === config.panelId);
    if (matches.length !== 1) fail();
    const candidate = matches[0]; if (!obj(candidate)) return fail();
    const panel = candidate;
    if (panel.split !== config.split || panel.datasetHash !== config.datasetHash || !digest(config.datasetHash) || panel.modelAlias !== config.modelAlias || !config.modelAlias || !same(panel.taskIds, config.taskIds) || !same(panel.modelConfiguration, config.modelConfiguration) || panel.variant !== config.variant || panel.repeat !== config.repeat || !same(panel.limits, config.limits) || panel.harnessHash !== config.harnessHash || (panel.promptHash ?? registration.promptHash) !== config.promptHash) fail();
    const audit = committed(registration.auditPath);
    if (!digest(registration.auditSha256) || sha(audit.bytes) !== registration.auditSha256) fail();
    const approved = parse(audit.bytes);
    if (approved.disposition !== "approve-engineering-only" || approved.sourceFingerprint !== config.sourceFingerprint) fail();
    const ledger = local(".tmp/insurance-bench/session-budget.json"), balance = parse(ledger.bytes);
    if (balance.capUsd !== 75 || !nonnegative(balance.reservedUsd) || balance.reservedUsd < (registration.minimumReservedUsd as number) || balance.reservedUsd > 75) fail();
    const dispatch = local(panel.dispatchReceiptPath);
    let tracked = true;
    try { git(["ls-files", "--error-unmatch", "--", dispatch.relative]); } catch { tracked = false; }
    if (tracked) fail();
    const receipt = parse(dispatch.bytes);
    if (receipt.status !== "dispatched" || (receipt.panelId ?? receipt.id) !== config.panelId || receipt.freezeCommit !== config.freezeCommit || receipt.sourceFingerprint !== config.sourceFingerprint || receipt.datasetHash !== config.datasetHash || receipt.modelAlias !== config.modelAlias || !same(receipt.taskIds, config.taskIds) || !same(receipt.modelConfiguration, config.modelConfiguration)) fail();
    if (config.split === "holdout") {
      if (!config.releasePath) fail();
      const release = parse(committed(config.releasePath).bytes);
      if (release.sourceFingerprint !== config.sourceFingerprint || release.harnessHash !== config.harnessHash || !same(release.taskIds, config.taskIds) || release.repeat !== config.repeat) fail();
      const developmentAudit = committed(release.developmentAuditPath);
      if (!digest(release.developmentAuditSha256) || sha(developmentAudit.bytes) !== release.developmentAuditSha256) fail();
      const reviewed = parse(developmentAudit.bytes);
      if (reviewed.disposition !== "approve-engineering-only" || reviewed.sourceFingerprint !== config.sourceFingerprint) fail();
      const devPanels = (registration.panels as unknown[]).filter(p => obj(p) && p.split === "dev");
      if (!devPanels.length || !obj(release.developmentDispatchSha256)) fail();
      for (const development of devPanels) {
        if (!obj(development) || typeof development.id !== "string") return fail();
        const original = committed(development.dispatchReceiptPath), terminal = parse(original.bytes);
        const hashes = release.developmentDispatchSha256 as Record<string, unknown>;
        if (!digest(hashes[development.id]) || sha(original.bytes) !== hashes[development.id] || terminal.status !== "terminal-native-run" || terminal.sourceFingerprint !== config.sourceFingerprint || terminal.completeCoverage !== true || terminal.processFailure || terminal.providerOrBudgetFailure || terminal.modelOrEffortMismatch || terminal.materialSpendOverrun) fail();
      }
    }
    return { ledgerPath: ledger.absolute, panel, registration, registrationSha256: sha(admission.bytes), dispatchReceiptPath: dispatch.absolute };
  } catch { return fail(); }
}

/** One-time public-CLI claim. Failure retains the claim; no retry or automatic removal. */
export function claimCandidateDispatch(admitted: ReturnType<typeof admitCandidateDispatch>) {
  const claimPath = admitted.dispatchReceiptPath + ".claim";
  let fd: number | undefined;
  try {
    fd = fs.openSync(claimPath, "wx", 0o600);
    fs.writeFileSync(fd, JSON.stringify({ registrationSha256: admitted.registrationSha256, receiptSha256: sha(fs.readFileSync(admitted.dispatchReceiptPath)), pid: process.pid, claimedAt: new Date().toISOString() }) + "\n");
  } catch { throw new Error("Insurance Bench candidate dispatch already claimed or claim unavailable"); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
