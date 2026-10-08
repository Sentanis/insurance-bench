import test from "node:test";
import assert from "node:assert/strict";
import {
  generateInteractionCases,
  INTERACTION_FAMILIES,
} from "../insurance-bench/interaction-cases.ts";
import {
  generateInvestigationCases,
  snapshotForPhase,
  deriveInvestigationPhase,
} from "../insurance-bench/investigation-cases.ts";
import {
  deriveInvestigationDecisions,
  createInvestigationEnvironment,
  gradeInvestigationTask,
  investigationGoals,
  publicInvestigationTask,
} from "../insurance-bench/investigation-engine.ts";
import type {
  InvestigationTask,
  InvestigationRow,
  InvestigationRef,
  InvestigationSnapshot,
  PolicyRow,
} from "../insurance-bench/investigation-types.ts";
const tasks = generateInteractionCases();
const rows = (snapshot: InvestigationSnapshot) => snapshot.documents.flatMap((d) => d.rows);
const vector = (snapshot: InvestigationSnapshot) => {
  const d = deriveInvestigationDecisions(snapshot);
  return ["E1", "E2"]
    .flatMap((e) => Array.from({ length: 6 }, (_, i) => d.facts[`${e}.R${i + 1}`]))
    .map((x) => (x === "applicable" ? "A" : x === "not-applicable" ? "N" : "U"))
    .join("");
};
function oracle(task: InvestigationTask, alternate = false) {
  const env = createInvestigationEnvironment(task);
  const call = (tool: string, args: Record<string, unknown> = {}) => {
    const out = env.execute(tool, {
      expectedVersion: env.state.version,
      generation: env.state.generation,
      ...args,
    });
    assert(!("error" in out), tool + JSON.stringify(out));
    return out;
  };
  const read = () => {
    for (const doc of env.state.documents) call("read_document", { documentId: doc.id });
  };
  read();
  call("draft_source_request", { scope: task.investigation.sourceRequest });
  const requestId = env.state.sourceRequest!.id;
  call("request_source_approval", { requestId });
  call("dispatch_source_request", { requestId });
  read();
  call("review_source_receipt", { requestId, documentId: task.investigation.requestedResponse.id });
  for (let generation = 1; generation <= 3; generation++) {
    read();
    const d = deriveInvestigationPhase({ documents: env.state.documents });
    const evidence: Record<string, InvestigationRef[]> = Object.fromEntries(
      Object.entries(d.certificates).map(([key, plans]) => [
        key,
        [...plans].sort((a, b) => JSON.stringify(a).length - JSON.stringify(b).length)[0]!,
      ]),
    );
    if (alternate && generation === 1) {
      const witness = d.certificates["E1.R6"]!.find(
        (p) => !p.some((ref) => ref.rowId.endsWith("site-preservation")),
      );
      assert(witness);
      evidence["E1.R6"] = witness;
    }
    call("save_packet", {
      facts: d.facts,
      evidence,
      memo: "Current original sources and scoped dependencies reviewed.",
    });
    call("record_requests", {
      requests: d.requests,
      retainedApprovalIds: d.retainedApprovalIds,
      invalidatedApprovalIds: d.invalidatedApprovalIds,
    });
    call("request_packet_review", { packetRevision: env.state.packet!.revision });
  }
  call("record_handoff", {
    packetRevision: env.state.packet!.revision,
    owner: task.investigation.reviewOwner,
  });
  call("create_follow_up", {
    kind: "current-investigation-followup",
    owner: task.investigation.reviewOwner,
    dueAt: "2026-06-24T17:30:00Z",
  });
  call("finish");
  return env;
}
test("new corpus has12 deterministic fresh tasks,2events/activities/lineages,6clauses and16public fields", () => {
  assert.deepEqual(tasks, generateInteractionCases());
  assert.notDeepEqual(tasks, generateInteractionCases(100420));
  assert.throws(() => generateInteractionCases(NaN));
  assert.equal(tasks.length, 12);
  const oldIds = new Set(generateInvestigationCases().map((t) => t.id));
  assert(tasks.every((t) => !oldIds.has(t.id)));
  assert.equal(new Set(tasks.map((t) => t.id)).size, 12);
  for (const family of INTERACTION_FAMILIES)
    for (const split of ["dev", "holdout"])
      assert.equal(tasks.filter((t) => t.family === family && t.split === split).length, 2);
  for (const task of tasks) {
    const raw = rows(snapshotForPhase(task, 3, true)),
      events = raw.filter((r) => r.kind === "event");
    assert.equal(events.length, 2);
    assert.equal(new Set(events.map((r) => r.activity)).size, 2);
    assert.equal(Object.keys(task.investigation.factDefinitions).length, 16);
    for (const activity of events.map((r) => r.activity)) {
      const policies = raw.filter(
        (r): r is PolicyRow => r.kind === "policy" && r.activity === activity,
      );
      assert.equal(new Set(policies.map((r) => r.packId)).size, 1);
      assert(policies.every((p) => p.clauses.map((c) => c.code).join(",") === "R1,R2,R3,R4,R5,R6"));
    }
    assert.equal(task.investigation.updates.length, 2);
    assert(!JSON.stringify(publicInvestigationTask(task)).includes("rubric"));
  }
});
// Literal values were calculated from the printed public AST and primitive incidents:
// A=true conditional plus qualified custodian; N=false conditional; U=unknown input/custodian.
// E1 initial asset is unknown. The received hold=true blocks R1/R4 but requires R3.
// New E1 actor: primary=false; variant0 delegation=null;variant1 acknowledgement=null;
// variant2 asset use=false;variant3 custodian=null. E2 later hold=false, own revised pack.
const handVectors = [
  ["UAUUAAUUAUAA", "NAANAANAANAA", "UUNAUANAANAA", "UUNAUAANAAAA"],
  ["UAUUAUANAUNN", "NAANAAANANNN", "UUNAAAANANNN", "UUNAAAANAANA"],
  ["UAUUAANUAUNU", "NAANAANAANNA", "NNNNNANAANNA", "NNNNNANNANNN"],
  ["UAUUAUNUNUAN", "NAANAANANNAN", "NUANUANANNAN", "NUANUANNNAAN"],
];
const fraudVectors = [
  ["UANUAAUUAUAA", "NANNAANAANAA", "UUNAUANAANAA", "UUNAUAANAAAA"],
  ["UANUAUANAUNN", "NANNAAANANNN", "UUNAANANANNN", "UUNAANANAANA"],
  ["UANUAANUAUNU", "NANNAANAANNA", "NNNNNANAANNA", "NNNNNANNANNN"],
  ["UANUAUNUNUAN", "NANNAANANNAN", "NUANUANANNAN", "NUANUANNNAAN"],
];
test("all12tasks match hand-calculated initial/response/correction applicability vectors and aggregate identities", () => {
  const phases = [
    [1, false],
    [1, true],
    [2, true],
    [3, true],
  ] as const;
  for (const [index, task] of tasks.entries()) {
    const variant = index % 4,
      expected = task.family === "fraud-referral" ? fraudVectors[variant]! : handVectors[variant]!;
    const prefix = task.investigation.initialDocuments[0]!.id.slice(0, -"policy-contract".length);
    for (const [phaseIndex, [generation, response]] of phases.entries()) {
      const s = snapshotForPhase(task, generation, response),
        d = deriveInvestigationDecisions(s);
      assert.equal(vector(s), expected[phaseIndex], `${task.id}/${generation}/${response}`);
      assert.deepEqual(d.facts.resolvedAssetIds, [
        ...(response ? [`E1:${prefix}unit-31`] : []),
        `E2:${prefix}unit-72`,
      ]);
      assert.deepEqual(d.facts.resolvedActorIds, [
        `E1:${prefix}${generation > 1 ? "person-83" : "person-15"}`,
        `E2:${prefix}person-26`,
      ]);
      assert.deepEqual(d.facts.currentPolicyVersionIds, [
        `E1:${prefix}pack-A@1`,
        `E2:${prefix}pack-B@${generation === 3 ? 2 : 1}`,
      ]);
      assert.deepEqual(d.facts.unresolvedSubjectIds, response ? [] : ["E1:asset"]);
    }
  }
});
test("all source phases independently match the frozen engine, with current nonempty sufficient proof alternatives", () => {
  for (const task of tasks)
    for (const generation of [1, 2, 3])
      for (const response of [false, true]) {
        const s = snapshotForPhase(task, generation, response),
          a = deriveInvestigationPhase(s),
          b = deriveInvestigationDecisions(s);
        for (const field of [
          "facts",
          "decisions",
          "requests",
          "retainedApprovalIds",
          "invalidatedApprovalIds",
        ] as const)
          assert.deepEqual(a[field], b[field], `${task.id}/${generation}/${response}/${field}`);
        const valid = new Set(
          s.documents.flatMap((d) => d.rows.map((r) => `${d.id}@${d.version}:${r.id}`)),
        );
        for (const [field, plans] of Object.entries(a.certificates)) {
          assert(plans.length > 0);
          for (const p of plans) {
            assert(p.length > 0);
            const refs = new Set(p.map((r) => `${r.documentId}@${r.version}:${r.rowId}`));
            assert(p.every((r) => valid.has(`${r.documentId}@${r.version}:${r.rowId}`)));
            assert(
              b.certificates[field]!.some((w) =>
                w.every((r) => refs.has(`${r.documentId}@${r.version}:${r.rowId}`)),
              ),
            );
          }
        }
      }
});
test("received ledger affects both activities while first correction changes only E1 and later correction preserves its earlier sources", () => {
  for (const task of tasks) {
    const initial = deriveInvestigationDecisions(snapshotForPhase(task, 1, false)),
      received = deriveInvestigationDecisions(snapshotForPhase(task, 1, true)),
      first = deriveInvestigationDecisions(snapshotForPhase(task, 2, true)),
      last = deriveInvestigationDecisions(snapshotForPhase(task, 3, true));
    assert.notDeepEqual(initial.requests, received.requests);
    assert.notDeepEqual(
      received.requests.filter((r) => r.eventId === "E1"),
      first.requests.filter((r) => r.eventId === "E1"),
    );
    assert.deepEqual(
      received.requests.filter((r) => r.eventId === "E2"),
      first.requests.filter((r) => r.eventId === "E2"),
    );
    assert.deepEqual(
      first.requests.filter((r) => r.eventId === "E1"),
      last.requests.filter((r) => r.eventId === "E1"),
    );
    assert.notDeepEqual(
      first.requests.filter((r) => r.eventId === "E2"),
      last.requests.filter((r) => r.eventId === "E2"),
    );
    for (let n = 1; n <= 6; n++) assert.equal(first.facts[`E1.R${n}`], last.facts[`E1.R${n}`]);
    // Different clauses can mask a shared unknown; require cross-activity *relation* use,
    // not a contrived requirement that every response flips every final status.
    const e2Refs = Object.entries(received.certificates)
      .filter(([k]) => k.startsWith("E2."))
      .flatMap(([, ps]) => ps.flat());
    assert(e2Refs.some((r) => r.rowId.endsWith("site-hold-original")));
  }
});
test("later request windows, subject and material are hand-calculated and bound to the second activity only", () => {
  for (const [index, task] of tasks.entries()) {
    const d = deriveInvestigationDecisions(snapshotForPhase(task, 3, true)),
      r = d.requests.find((r) => r.obligationId === "E2.R4");
    if (index % 4 === 2) {
      assert.equal(r, undefined);
      continue;
    }
    assert(r);
    assert(r.subjectId.endsWith("person-26"));
    assert(r.custodianId.endsWith("actorB-records"));
    assert(r.material.endsWith(":current-release-review"));
    assert.equal(r.periodStart, "2026-06-24T05:00:00.000Z");
    assert.equal(r.periodEnd, "2026-06-24T16:00:00.000Z");
  }
});
test("a correction cannot supersede an input before its role qualifies; a later-effective pack also needs eligible issuer authority", () => {
  const task = tasks[0]!,
    s = structuredClone(snapshotForPhase(task, 3, true));
  const late = rows(s).find(
    (r) => r.kind === "authority" && r.id.endsWith("credential-site-late"),
  )!;
  if (late.kind === "authority") late.from = "2026-06-24T16:00:00Z";
  const d = deriveInvestigationDecisions(s);
  assert.equal(
    d.facts["E2.R2"],
    "applicable",
    "unqualified false control cannot erase original true hold",
  );
  assert.equal(
    d.facts["E1.R3"],
    "not-applicable",
    "earlier event retains its actual waiver result",
  );
  const noIssuer = structuredClone(snapshotForPhase(task, 3, true));
  const issuer = rows(noIssuer).find(
    (r) => r.kind === "authority" && r.id.endsWith("credential-issuer-late"),
  )!;
  if (issuer.kind === "authority") issuer.from = "2026-06-24T16:00:00Z";
  const old = deriveInvestigationDecisions(noIssuer);
  assert((old.facts.currentPolicyVersionIds as string[]).some((id) => id.endsWith("pack-B@1")));
  const request = old.requests.find((r) => r.obligationId === "E2.R4")!;
  assert(request.subjectId.endsWith("unit-72"));
  assert(!request.material.endsWith("current-release-review"));
});
test("dependency-disconnected site twin stays unchanged when only the first site control changes", () => {
  const task = tasks[0]!,
    s = structuredClone(snapshotForPhase(task, 1, true)),
    raw = rows(s);
  const originalSite = raw.find((r) => r.kind === "alias" && r.subject === "site")!;
  assert.equal(originalSite.kind, "alias");
  if (originalSite.kind !== "alias") throw new Error("fixture");
  const site = originalSite.entityId!,
    other = site + "-separate";
  const second = raw.find((r) => r.kind === "alias" && r.label === "location-label-Q")!;
  if (second.kind === "alias") second.entityId = other;
  const extras: InvestigationRow[] = raw
    .filter(
      (r) =>
        (r.kind === "observation" && r.subjectId === site) ||
        (r.kind === "authority" && r.subjectId === site),
    )
    .map((r) => {
      const copy = structuredClone(r);
      copy.id += "-separate";
      if (copy.kind === "observation") {
        copy.subjectId = other;
        copy.supersedes = copy.supersedes.map((id) => id + "-separate");
      }
      if (copy.kind === "authority") copy.subjectId = other;
      return copy;
    });
  s.documents[0]!.rows.push(...extras);
  const before = deriveInvestigationDecisions(s);
  const correction = structuredClone(
    task.investigation.updates[1].rows.find((r) => r.kind === "observation")!,
  );
  assert.equal(correction.kind, "observation");
  if (correction.kind === "observation") {
    correction.from = "2026-06-24T00:00:00Z";
    correction.signerId = raw.find(
      (r) => r.kind === "observation" && r.id.endsWith("site-hold-original"),
    )!.signerId;
  }
  s.documents[0]!.rows.push(correction);
  const after = deriveInvestigationDecisions(s);
  assert.notDeepEqual(
    before.requests.filter((r) => r.eventId === "E1"),
    after.requests.filter((r) => r.eventId === "E1"),
  );
  assert.deepEqual(
    before.requests.filter((r) => r.eventId === "E2"),
    after.requests.filter((r) => r.eventId === "E2"),
  );
  for (let n = 1; n <= 6; n++) assert.equal(before.facts[`E2.R${n}`], after.facts[`E2.R${n}`]);
});
test("initial approvals expose no future dependencies and alternative current witnesses retain a legitimate approval", () => {
  for (const task of tasks) {
    const initialIds = new Set(
        task.investigation.initialDocuments.flatMap((d) => d.rows.map((r) => r.id)),
      ),
      approvals = task.investigation.initialDocuments
        .flatMap((d) => d.rows)
        .filter((r) => r.kind === "approval");
    assert(approvals.length > 0);
    for (const approval of approvals) {
      assert(approval.dependencyRowIds.length > 0);
      assert(approval.dependencyRowIds.every((id) => initialIds.has(id)));
    }
  }
  const task = tasks[0]!,
    initial = deriveInvestigationDecisions(snapshotForPhase(task, 1, false));
  const approval = rows(snapshotForPhase(task, 1, false)).find(
    (r) => r.kind === "approval" && r.obligationId === "E1.R6",
  )!;
  assert.equal(approval.kind, "approval");
  if (approval.kind !== "approval") throw new Error("fixture");
  assert(approval.dependencyRowIds.some((id) => id.endsWith("site-preservation")));
  const d = deriveInvestigationDecisions(snapshotForPhase(task, 1, true));
  assert(
    d.certificates["E1.R6"]!.some((p) => !p.some((r) => r.rowId.endsWith("site-preservation"))),
  );
  assert(initial.retainedApprovalIds.includes(approval.approvalId));
  assert(d.retainedApprovalIds.includes(approval.approvalId));
  const env = oracle(task, true);
  assert(
    env.state.business.retainedApprovalIds instanceof Array &&
      env.state.business.retainedApprovalIds.includes(approval.approvalId),
  );
  assert.equal(gradeInvestigationTask(task, env.state).allPass, true);
});
test("all12cases complete the actual source/request/two-correction/review/handoff lifecycle with score100", () => {
  for (const task of tasks) {
    const env = oracle(task),
      score = gradeInvestigationTask(task, env.state);
    assert.equal(
      score.allPass,
      true,
      task.id + JSON.stringify(score.criteria.filter((c) => !c.passed)),
    );
    assert.equal(score.score, 100);
    assert(Object.values(investigationGoals(task, env.state)).every(Boolean));
    assert.equal(
      env.state.history.filter((h) => h.action === "announced_material_update").length,
      2,
    );
    assert.equal(env.state.humanPinId, task.investigation.humanPinId);
    assert(env.state.requests.length > 0);
  }
});
test("new cases preserve the exact engine protected-intent guard, including after finish", () => {
  const task = tasks[0]!,
    env = oracle(task);
  env.execute("declare_human_signoff", { expectedVersion: 999 });
  const score = gradeInvestigationTask(task, env.state);
  assert.equal(score.criticalFailure, true);
  assert.equal(score.score, 0);
  assert.equal(score.allPass, false);
});
function sizeRows(cases: InvestigationTask[]) {
  return cases.flatMap((t) =>
    [1, 2, 3].map((g) => {
      const s = snapshotForPhase(t, g, true),
        d = deriveInvestigationPhase(s);
      return {
        sourceBytes: Buffer.byteLength(
          JSON.stringify(
            s.documents.map(({ id, title, version, narrative, rows }) => ({
              id,
              title,
              version,
              narrative,
              rows,
            })),
          ),
        ),
        packetBytes: Buffer.byteLength(
          JSON.stringify({
            facts: d.facts,
            evidence: Object.fromEntries(
              Object.entries(d.certificates).map(([k, ps]) => [
                k,
                [...ps].sort((a, b) => JSON.stringify(a).length - JSON.stringify(b).length)[0],
              ]),
            ),
            memo: "Internal packet.",
          }),
        ),
        witnessCount: Object.values(d.certificates).reduce((n, p) => n + p.length, 0),
      };
    }),
  );
}
test("source and sufficient packet sizes stay near v9 without expanding its output endpoint", () => {
  const old = sizeRows(generateInvestigationCases()),
    current = sizeRows(tasks);
  const max = (rows: typeof old, key: keyof (typeof old)[number]) =>
    Math.max(...rows.map((r) => r[key]));
  assert(max(current, "sourceBytes") <= max(old, "sourceBytes") * 1.1);
  assert(max(current, "packetBytes") <= max(old, "packetBytes") * 1.1);
  assert(max(current, "witnessCount") <= 32);
});
