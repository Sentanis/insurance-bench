import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { admitCandidateDispatch, claimCandidateDispatch, type CandidateDispatchConfig } from "../insurance-bench/candidate-admission.ts";
const h = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

test("candidate admission is read-only and binds exact synthetic Git/ledger/controller conditions", () => {
  const previous = process.cwd(), root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ib-admission-")));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  const write = (p: string, v: unknown) => { fs.mkdirSync(path.dirname(path.join(root, p)), {recursive:true}); fs.writeFileSync(path.join(root,p), typeof v === "string" ? v : JSON.stringify(v)); };
  const read = (p: string) => fs.readFileSync(path.join(root,p));
  const commit = () => { git("add", "source.ts", "registration.json", "audit.json", "development.json", "release.json", "dev-terminal.json"); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "synthetic fixture"); return git("rev-parse","HEAD"); };
  const fp=h("source"), prompt=h("prompt"), harness=h("harness"), corpus=h("full corpus"), dataset=h("selected raw task contents");
  const model={provider:"openai",model:"synthetic-exact",reasoningEffort:"low"};
  const audit={disposition:"approve-engineering-only",sourceFingerprint:fp};
  const panel={id:"synthetic-dev",datasetHash:dataset,modelAlias:"synthetic-low",split:"dev",taskIds:["synthetic-case"],modelConfiguration:model,variant:"baseline",repeat:1,limits:{maxTurns:20,maxOutputTokens:16384,transportDeadlineMs:600000},harnessHash:harness,dispatchReceiptPath:"dispatch.json"};
  const registration={generation:"synthetic-generation",sourceFingerprint:fp,fullCorpusHash:corpus,promptHash:prompt,capUsd:75,minimumReservedUsd:10,auditPath:"audit.json",auditSha256:h(JSON.stringify(audit)),panels:[panel]};
  const devTerminal={status:"terminal-native-run",sourceFingerprint:fp,completeCoverage:true};
  const release={developmentDispatchSha256:{"synthetic-dev":h(JSON.stringify(devTerminal))},sourceFingerprint:fp,harnessHash:harness,taskIds:panel.taskIds,repeat:1,developmentAuditPath:"development.json",developmentAuditSha256:h(JSON.stringify(audit))};
  try {
    git("init","--quiet");
    write("source.ts","export const synthetic = true;\n"); write("registration.json",registration); write("audit.json",audit); write("development.json",audit); write("release.json",release);write("dev-terminal.json",devTerminal);
    const frozen = commit();
    const cfg: CandidateDispatchConfig={repositoryRoot:root,freezeCommit:frozen,admissionPath:"registration.json",panelId:panel.id,sourceFiles:["source.ts"],generation:registration.generation,sourceFingerprint:fp,fullCorpusHash:corpus,datasetHash:dataset,modelAlias:panel.modelAlias,promptHash:prompt,taskIds:panel.taskIds,modelConfiguration:model,variant:panel.variant,repeat:1,limits:panel.limits,harnessHash:harness,split:"dev"};
    const receipt=()=>({id:cfg.panelId,status:"dispatched",freezeCommit:cfg.freezeCommit,sourceFingerprint:fp,datasetHash:dataset,modelAlias:panel.modelAlias,taskIds:panel.taskIds,modelConfiguration:model});
    write(".tmp/insurance-bench/session-budget.json",{capUsd:75,reservedUsd:12});write("dispatch.json",receipt());
    process.chdir(root);
    const beforeLedger=read(".tmp/insurance-bench/session-budget.json"), beforeReceipt=read("dispatch.json");
    const ok=admitCandidateDispatch(cfg);assert.equal(ok.ledgerPath,path.join(root,".tmp/insurance-bench/session-budget.json"));assert.deepEqual(ok.panel,panel);
    assert.deepEqual(read(".tmp/insurance-bench/session-budget.json"),beforeLedger);assert.deepEqual(read("dispatch.json"),beforeReceipt);
    const deny=(changes:Partial<CandidateDispatchConfig>={})=>assert.throws(()=>admitCandidateDispatch({...cfg,...changes}),/^Error: Insurance Bench candidate dispatch admission rejected$/);
    process.chdir(previous);deny();process.chdir(root);
    const ledgerPath=path.join(root,".tmp/insurance-bench/session-budget.json");fs.unlinkSync(ledgerPath);deny();assert.equal(fs.existsSync(ledgerPath),false);
    for(const ledger of [{capUsd:25,reservedUsd:12},{capUsd:75,reservedUsd:9},{capUsd:75,reservedUsd:-1},{capUsd:75,reservedUsd:76},{capUsd:75,reservedUsd:"12"}]) {write(".tmp/insurance-bench/session-budget.json",ledger);deny();}
    fs.writeFileSync(ledgerPath,beforeLedger);
    deny({panelId:"unregistered"});deny({freezeCommit:"main"});deny({sourceFiles:["../source.ts"]});deny({admissionPath:path.join(root,"registration.json")});deny({sourceFiles:["source.ts","source.ts"]});
    for(const change of [{fullCorpusHash:h("wrong corpus")},{datasetHash:h("wrong raw task")},{modelAlias:"wrong-alias"},{variant:"other"},{repeat:2},{promptHash:h("wrong")},{harnessHash:h("wrong")},{generation:"wrong"},{taskIds:["wrong"]},{modelConfiguration:{...model,reasoningEffort:"high"}},{limits:{maxTurns:10}}])deny(change);
    write("source.ts","changed source with private-looking test text");deny();write("source.ts","export const synthetic = true;\n");
    write("audit.json",{...audit,disposition:"pending"});deny();write("audit.json",audit);
    write("dispatch.json",{...receipt(),status:"terminal-native-run"});deny();write("dispatch.json",{...receipt(),freezeCommit:"f".repeat(40)});deny();write("dispatch.json",receipt());
    write("registration.json",{...registration,panels:[panel,panel]});deny();write("registration.json",registration);
    // Committed bad audit/hash still cannot admit, rather than merely failing working-tree equality.
    write("audit.json",{...audit,disposition:"pending"});write("registration.json",{...registration,auditSha256:h(JSON.stringify({...audit,disposition:"pending"}))});cfg.freezeCommit=commit();write("dispatch.json",receipt());deny();
    write("audit.json",audit);write("registration.json",registration);cfg.freezeCommit=commit();write("dispatch.json",receipt());assert.ok(admitCandidateDispatch(cfg));
    // Symlink traversal is denied without reading or creating any real repository ledger.
    fs.symlinkSync(path.join(root,"source.ts"),path.join(root,"alias.ts"));deny({sourceFiles:["alias.ts"]});
    // New synthetic holdout requires committed release + independently approved development audit.
    const holdPanel={...panel,id:"synthetic-hold",split:"holdout"};write("registration.json",{...registration,panels:[{...panel,dispatchReceiptPath:"dev-terminal.json"},holdPanel]});cfg.panelId=holdPanel.id;cfg.freezeCommit=commit();cfg.split="holdout";write("dispatch.json",receipt());deny();
    assert.ok(admitCandidateDispatch({...cfg,releasePath:"release.json"}));
    write("development.json",{...audit,sourceFingerprint:h("other")});deny({releasePath:"release.json"});write("development.json",audit);
    write("release.json",{...release,taskIds:["other"]});cfg.freezeCommit=commit();write("dispatch.json",receipt());deny({releasePath:"release.json"});
    write("release.json",release);cfg.freezeCommit=commit();write("dispatch.json",receipt());assert.ok(admitCandidateDispatch({...cfg,releasePath:"release.json"}));
    const holdAdmission=admitCandidateDispatch({...cfg,releasePath:"release.json"});
    claimCandidateDispatch(holdAdmission);
    assert.throws(()=>claimCandidateDispatch(holdAdmission), /already claimed/);
    assert.deepEqual(read(".tmp/insurance-bench/session-budget.json"),beforeLedger);
    write("dev-terminal.json",{...devTerminal,completeCoverage:false});deny({releasePath:"release.json"});write("dev-terminal.json",devTerminal);
    write("release.json",{...release,developmentDispatchSha256:{}});cfg.freezeCommit=commit();write("dispatch.json",receipt());deny({releasePath:"release.json"});
    write("release.json",release);cfg.freezeCommit=commit();write("dispatch.json",receipt());
    // A rewritten tracked receipt cannot serve as the prospective controller admission.
    git("add","dispatch.json");git("-c","user.name=Fixture","-c","user.email=fixture@example.invalid","commit","--quiet","-m","tracked receipt");deny({releasePath:"release.json"});
  } finally {process.chdir(previous);fs.rmSync(root,{recursive:true,force:true});}
});
