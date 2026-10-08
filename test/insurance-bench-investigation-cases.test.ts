import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  deriveInvestigationPhase,
  generateInvestigationCases,
  INVESTIGATION_FAMILIES,
  INVESTIGATION_RULES,
  snapshotForPhase,
} from "../insurance-bench/investigation-cases.ts";
import type {
  AliasRow,
  InvestigationDocument,
  InvestigationRow,
  InvestigationSnapshot,
  InvestigationTask,
  ObservationRow,
  PolicyRow,
} from "../insurance-bench/investigation-types.ts";

const tasks = generateInvestigationCases();
const clone = <T>(value: T): T => structuredClone(value);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rows = (snapshot: InvestigationSnapshot) =>
  snapshot.documents.flatMap((document) => document.rows);
const codes = (task: InvestigationTask, generation = 1) => {
  const result = deriveInvestigationPhase(snapshotForPhase(task, generation, true));
  return ["E1", "E2"].flatMap((event) =>
    Array.from({ length: 6 }, (_, i) => result.facts[`${event}.R${i + 1}`]),
  );
};
function replaceRow(
  snapshot: InvestigationSnapshot,
  rowId: string,
  edit: (row: InvestigationRow) => InvestigationRow,
) {
  const copy = clone(snapshot);
  let found = false;
  for (const document of copy.documents)
    document.rows = document.rows.map((row) => {
      if (row.id !== rowId) return row;
      found = true;
      return edit(row);
    });
  assert.ok(found, rowId);
  return copy;
}
function observation(
  snapshot: InvestigationSnapshot,
  suffix: string,
  predicate: string,
): ObservationRow {
  const row = rows(snapshot).find(
    (row) =>
      row.kind === "observation" && row.subjectId.endsWith(suffix) && row.predicate === predicate,
  );
  assert.equal(row?.kind, "observation");
  return row as ObservationRow;
}
function policies(snapshot: InvestigationSnapshot): PolicyRow[] {
  return rows(snapshot).filter((row): row is PolicyRow => row.kind === "policy");
}

test("12 fresh deterministic cases use three distinct conditional source mechanics without final gold flags", () => {
  assert.equal(tasks.length, 12);
  assert.deepEqual(generateInvestigationCases(), tasks);
  assert.notDeepEqual(generateInvestigationCases(90420), tasks);
  assert.throws(() => generateInvestigationCases(NaN));
  assert.equal(new Set(tasks.map((task) => task.id)).size, 12);
  assert.equal(new Set(tasks.map((task) => task.investigation.mechanic)).size, 3);
  for (const family of INVESTIGATION_FAMILIES)
    for (const split of ["dev", "holdout"])
      assert.equal(
        tasks.filter((task) => task.family === family && task.split === split).length,
        2,
      );
  for (const task of tasks) {
    assert.equal(Object.keys(task.investigation.factDefinitions).length, 16);
    assert.equal(Object.keys(task.rubric.facts).length, 0, "no static final labels");
    assert.ok(task.investigation.initialDocuments.length >= 10);
    const publicRows = task.investigation.initialDocuments.flatMap((d) => d.rows);
    for (const row of publicRows) {
      assert.equal(Object.hasOwn(row, "facts"), false);
      assert.equal(Object.hasOwn(row, "certificates"), false);
      assert.equal(Object.hasOwn(row, "status"), false);
    }
    assert.ok(INVESTIGATION_RULES.includes("including a newly received response"));
    assert.ok(INVESTIGATION_RULES.includes("empty proof is insufficient"));
  }
});

test("six independent literal hand calculations cover all development family mechanisms", () => {
  const A = "applicable",
    N = "not-applicable",
    U = "unresolved";
  // Explicit raw inputs in each development case are checked independently against these
  // manually evaluated conjunction/exception results after the registry response, before changes.
  const expected = [
    [A, N, A, N, A, N, N, N, N, A, N, A],
    [N, A, N, N, A, N, U, N, N, A, N, U],
    [A, A, N, N, A, A, N, A, N, A, A, N],
    [A, A, U, N, N, A, N, A, N, A, A, A],
    [A, N, A, N, N, A, A, N, N, A, N, A],
    [A, N, U, U, N, A, A, N, N, A, N, A],
  ];
  const dev = tasks.filter((task) => task.split === "dev");
  assert.equal(dev.length, 6);
  dev.forEach((task, index) => assert.deepEqual(codes(task), expected[index], task.id));
});

test("all 72 full-source snapshots have substantive current requests and actual source proof rows", () => {
  for (const task of tasks)
    for (const responseAvailable of [false, true])
      for (const generation of [1, 2, 3]) {
        const snapshot = snapshotForPhase(task, generation, responseAvailable),
          before = digest(snapshot);
        const derived = deriveInvestigationPhase(snapshot);
        assert.equal(digest(snapshot), before, "resolver does not mutate sources");
        assert.deepEqual(
          Object.keys(derived.facts).sort(),
          Object.keys(task.investigation.factDefinitions).sort(),
        );
        if (responseAvailable) assert.ok(derived.requests.length > 0, `${task.id}/${generation}`);
        const keys = new Set(
          snapshot.documents.flatMap((d) => d.rows.map((r) => `${d.id}@${d.version}:${r.id}`)),
        );
        for (const [field, alternatives] of Object.entries(derived.certificates)) {
          assert.ok(alternatives.length > 0, field);
          assert.ok(
            alternatives.every((proof) => proof.length > 0),
            field,
          );
          for (const proof of alternatives)
            for (const ref of proof)
              assert.ok(keys.has(`${ref.documentId}@${ref.version}:${ref.rowId}`), field);
        }
        for (const request of derived.requests) {
          assert.ok(request.obligationId.startsWith(`${request.eventId}.`));
          assert.equal(derived.facts[request.obligationId], "applicable");
          assert.ok(Date.parse(request.periodStart) < Date.parse(request.periodEnd));
          assert.ok(request.material && request.subjectId && request.custodianId);
        }
      }
});

test("newly supplied registry response resolves current dependencies, while corrections remain scoped", () => {
  for (const task of tasks) {
    const missing = deriveInvestigationPhase(snapshotForPhase(task, 1, false));
    const original = deriveInvestigationPhase(snapshotForPhase(task, 1, true));
    const first = deriveInvestigationPhase(snapshotForPhase(task, 2, true));
    const final = deriveInvestigationPhase(snapshotForPhase(task, 3, true));
    assert.ok((missing.facts.unresolvedSubjectIds as string[]).includes("E1:asset"));
    assert.ok(!(original.facts.unresolvedSubjectIds as string[]).includes("E1:asset"));
    assert.notDeepEqual(missing.requests, original.requests, task.id);
    assert.notDeepEqual(original.requests, first.requests, task.id);
    assert.notDeepEqual(first.requests, final.requests, task.id);
    for (let i = 1; i <= 6; i++) {
      assert.equal(
        first.facts[`E2.R${i}`],
        original.facts[`E2.R${i}`],
        "first correction cannot rewrite second incident",
      );
      assert.equal(
        final.facts[`E1.R${i}`],
        first.facts[`E1.R${i}`],
        "later-effective pack cannot rewrite first incident",
      );
    }
    assert.deepEqual(
      final.requests.filter((r) => r.eventId === "E1"),
      first.requests.filter((r) => r.eventId === "E1"),
    );
    assert.notDeepEqual(final.facts.currentPolicyVersionIds, first.facts.currentPolicyVersionIds);
  }
});

test("wrong branch and null source are materially different, and any short circuit accepts minimal alternatives", () => {
  const task = tasks[0]!,
    snapshot = snapshotForPhase(task, 1, true);
  const permission = observation(snapshot, "party-A", "permitted");
  const noPermission = replaceRow(
    snapshot,
    permission.id,
    (row) => ({ ...row, value: false }) as ObservationRow,
  );
  const unknownPermission = replaceRow(
    snapshot,
    permission.id,
    (row) => ({ ...row, value: null }) as ObservationRow,
  );
  const known = deriveInvestigationPhase(noPermission),
    unknown = deriveInvestigationPhase(unknownPermission);
  assert.equal(known.facts["E1.R1"], "not-applicable");
  assert.equal(known.facts["E1.R2"], "applicable");
  assert.equal(unknown.facts["E1.R1"], "unresolved");
  assert.equal(unknown.facts["E1.R2"], "unresolved");
  const substitute = observation(snapshot, "party-A", "substitute");
  const both = replaceRow(
    noPermission,
    substitute.id,
    (row) => ({ ...row, value: true }) as ObservationRow,
  );
  const result = deriveInvestigationPhase(both);
  assert.equal(result.facts["E1.R2"], "applicable");
  assert.ok(
    result.certificates["E1.R2"]!.length >= 2,
    "either true disjunct can certify the clause",
  );
  assert.ok(
    result.certificates["E1.R2"]!.some((p) => !p.some((ref) => ref.rowId === permission.id)),
  );
  assert.ok(
    result.certificates["E1.R2"]!.some((p) => !p.some((ref) => ref.rowId === substitute.id)),
  );
});

test("wrong role, hearsay and interval boundaries cannot supply a known substantive input", () => {
  const task = tasks[0]!,
    snapshot = snapshotForPhase(task, 1, true);
  const input = observation(snapshot, "party-A", "permitted");
  const custodian = observation(snapshot, "party-A", "recordCustodian");
  const badRole = replaceRow(
    snapshot,
    input.id,
    (row) => ({ ...row, signerId: custodian.signerId }) as ObservationRow,
  );
  const expired = replaceRow(
    snapshot,
    input.id,
    (row) => ({ ...row, to: "2026-06-23T08:00:00Z" }) as ObservationRow,
  );
  const hearsay = replaceRow(
    snapshot,
    input.id,
    (row) => ({ ...row, firstHand: false }) as ObservationRow,
  );
  for (const invalid of [badRole, expired, hearsay]) {
    const result = deriveInvestigationPhase(invalid);
    assert.equal(result.facts["E1.R1"], "unresolved");
    assert.ok(
      result.certificates["E1.R1"]!.every((proof) =>
        proof.some((ref) => ref.rowId.endsWith("inventory-observations")),
      ),
    );
  }
  const exactStart = replaceRow(
    snapshot,
    input.id,
    (row) => ({ ...row, from: "2026-06-23T08:00:00Z" }) as ObservationRow,
  );
  assert.equal(deriveInvestigationPhase(exactStart).facts["E1.R1"], "applicable");
});

test("policy version uses effective instant and signed eligible highest revision, not newest copy", () => {
  const task = tasks[0]!,
    snapshot = snapshotForPhase(task, 3, true);
  const original = deriveInvestigationPhase(snapshot);
  assert.ok(
    (original.facts.currentPolicyVersionIds as string[]).some(
      (id) => id.startsWith("E1:") && id.endsWith("@1"),
    ),
  );
  assert.ok(
    (original.facts.currentPolicyVersionIds as string[]).some(
      (id) => id.startsWith("E2:") && id.endsWith("@2"),
    ),
  );
  const current = policies(snapshot).find((p) => p.revision === 2)!;
  const later = replaceRow(
    snapshot,
    current.id,
    (row) => ({ ...row, effectiveFrom: "2026-06-23T17:00:00.001Z" }) as PolicyRow,
  );
  assert.ok(
    (deriveInvestigationPhase(later).facts.currentPolicyVersionIds as string[]).some(
      (id) => id.startsWith("E2:") && id.endsWith("@1"),
    ),
  );
  const backdated = replaceRow(
    snapshot,
    current.id,
    (row) => ({ ...row, effectiveFrom: "2026-06-22T00:00:00Z" }) as PolicyRow,
  );
  assert.ok(
    (deriveInvestigationPhase(backdated).facts.currentPolicyVersionIds as string[]).every((id) =>
      id.endsWith("@2"),
    ),
  );
  const missing = clone(snapshot);
  for (const d of missing.documents) d.rows = d.rows.filter((row) => row.kind !== "policy");
  const result = deriveInvestigationPhase(missing);
  assert.equal(result.facts["E1.R1"], "unresolved");
  assert.ok(
    result.certificates["E1.R1"]!.every((proof) =>
      proof.some((ref) => ref.rowId.endsWith("inventory-policies")),
    ),
  );
});

test("holdout mechanisms include reused-label time joins, equal-scope conflict, and scoped correction", () => {
  const reused = tasks.find(
    (t) => t.investigation.mechanic === "fleet-assignment" && t.id.includes("holdout-1"),
  )!;
  const events = rows(snapshotForPhase(reused, 1, true)).filter((row) => row.kind === "event");
  assert.equal(events[0]!.assetLabel, events[1]!.assetLabel);
  const mapping = deriveInvestigationPhase(snapshotForPhase(reused, 1, true)).facts
    .resolvedAssetIds as string[];
  assert.ok(mapping[0]!.endsWith("asset-A") && mapping[1]!.endsWith("asset-B"));
  const conflict = tasks.find(
    (t) => t.investigation.mechanic === "premises-chronology" && t.id.includes("holdout-2"),
  )!;
  const before = deriveInvestigationPhase(snapshotForPhase(conflict, 2, true)),
    after = deriveInvestigationPhase(snapshotForPhase(conflict, 3, true));
  assert.ok((before.facts.unresolvedSubjectIds as string[]).includes("E2:site"));
  assert.ok(!(after.facts.unresolvedSubjectIds as string[]).includes("E2:site"));
  const wrongTarget = clone(snapshotForPhase(conflict, 3, true));
  const correcting = rows(wrongTarget).find((row) =>
    row.id.endsWith("site-correction"),
  ) as AliasRow;
  const updated = replaceRow(
    wrongTarget,
    correcting.id,
    (row) => ({ ...row, subject: "actor" }) as AliasRow,
  );
  assert.ok(
    (deriveInvestigationPhase(updated).facts.unresolvedSubjectIds as string[]).includes("E2:site"),
    "cross-kind/key supersedes cannot retire original",
  );
});

test("equivalent policy copies have alternate witnesses and conflicting policies require issuer proof", () => {
  const snapshot = clone(snapshotForPhase(tasks[0]!, 3, true));
  const policy = policies(snapshot).find((row) => row.revision === 2)!;
  const document = snapshot.documents.find((d) => d.rows.some((row) => row.id === policy.id))!;
  const copy = { ...clone(policy), id: `${policy.id}-equivalent-copy` };
  document.rows.push(copy);
  const actual = deriveInvestigationPhase(snapshot);
  assert.equal(actual.facts["E2.R4"], "applicable");
  assert.ok(
    actual.certificates["E2.R4"]!.some((proof) => proof.some((ref) => ref.rowId === copy.id)),
  );
  copy.clauses[3]!.material = "a-conflicting-scope";
  const conflict = deriveInvestigationPhase(snapshot);
  assert.equal(conflict.facts["E2.R4"], "unresolved");
  assert.ok(
    conflict.certificates["E2.R4"]!.every((proof) =>
      proof.some((ref) => ref.rowId.endsWith("auth-policy")),
    ),
  );
});

test("missing custodian blocks actual request; historical approval requires current exact-obligation proof", () => {
  const task = tasks[0]!,
    snapshot = snapshotForPhase(task, 1, true);
  const custodian = observation(snapshot, "asset-A", "recordCustodian");
  const missing = replaceRow(
    snapshot,
    custodian.id,
    (row) => ({ ...row, value: null }) as ObservationRow,
  );
  const result = deriveInvestigationPhase(missing);
  assert.equal(result.facts["E1.R1"], "unresolved");
  assert.equal(
    result.requests.some((request) => request.obligationId === "E1.R1"),
    false,
  );
  const old = deriveInvestigationPhase(snapshot),
    final = deriveInvestigationPhase(snapshotForPhase(task, 3, true));
  assert.ok(old.retainedApprovalIds.length > 0);
  assert.ok(final.invalidatedApprovalIds.length > 0);
  for (const id of final.retainedApprovalIds) assert.ok(old.retainedApprovalIds.includes(id));
});

test("equivalent source order and document IDs preserve values and request semantics", () => {
  for (const task of tasks) {
    const snapshot = snapshotForPhase(task, 3, true),
      expected = deriveInvestigationPhase(snapshot);
    const reordered: InvestigationSnapshot = {
      documents: [...snapshot.documents].reverse().map((d, i): InvestigationDocument => ({
        ...clone(d),
        id: `renamed-${i}`,
        rows: [...d.rows].reverse(),
      })),
    };
    const actual = deriveInvestigationPhase(reordered);
    assert.deepEqual(actual.facts, expected.facts);
    assert.deepEqual(actual.requests, expected.requests);
    assert.deepEqual(actual.retainedApprovalIds, expected.retainedApprovalIds);
  }
});

test("initial historical approval provenance cannot expose withheld response or update rows", () => {
  for (const task of tasks) {
    const initialRows = new Set(task.investigation.initialDocuments.flatMap(document => document.rows.map(row => row.id)));
    const withheldRows = new Set([task.investigation.requestedResponse, ...task.investigation.updates].flatMap(document => document.rows.map(row => row.id)));
    const initial = deriveInvestigationPhase(snapshotForPhase(task, 1, false));
    for (const document of task.investigation.initialDocuments)
      for (const row of document.rows) {
        if (row.kind !== "approval") continue;
        assert.equal(initial.facts[row.obligationId], "applicable", `${task.id}/${row.approvalId}`);
        assert.ok(row.dependencyRowIds.length > 0);
        for (const dependency of row.dependencyRowIds) {
          assert.ok(initialRows.has(dependency), `${task.id}: dependency must already be public`);
          assert.equal(withheldRows.has(dependency), false, `${task.id}: withheld source provenance leaked`);
        }
      }
  }
});
