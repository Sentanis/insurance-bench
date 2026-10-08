import {
  INVESTIGATION_RULES,
  deriveInvestigationPhase,
  snapshotForPhase,
} from "./investigation-cases.ts";
import type {
  InvestigationTask,
  InvestigationFamily,
  InvestigationRow,
  InvestigationDocument,
  InvestigationCondition,
  InvestigationClause,
  InvestigationSubject,
  PolicyRow,
} from "./investigation-types.ts";
export const INTERACTION_FAMILIES: InvestigationFamily[] = [
  "coverage-review",
  "evidence-brief",
  "fraud-referral",
];
export const INTERACTION_CLOCK = "2026-06-24T16:00:00Z";
const START = "2026-06-24T00:00:00Z",
  MID = "2026-06-24T12:00:00Z",
  END = "2026-06-26T00:00:00Z";
const domains = {
  "coverage-review": {
    mechanic: "fleet-assignment" as const,
    activities: ["fleet-use-check", "carrier-record-coordination"],
    predicates: [
      "useAuthorized",
      "assignedEmployee",
      "delegationRecorded",
      "dispatchAcknowledged",
      "coordinationHold",
      "collectionWaiver",
      "consentWithdrawn",
      "identityDisputed",
      "preservationRequested",
      "alternateCarrierResponsible",
    ],
    materials: [
      "assignment-records",
      "operator-register",
      "coordination-notice",
      "release-support",
      "delegation-chain",
      "retention-register",
    ],
  },
  "evidence-brief": {
    mechanic: "premises-chronology" as const,
    activities: ["premises-access-check", "evidence-custody-coordination"],
    predicates: [
      "areaAccessAuthorized",
      "tenantPresent",
      "accessDelegateRecorded",
      "entryAcknowledged",
      "custodyHold",
      "accessWaiver",
      "permissionWithdrawn",
      "witnessDisputed",
      "retentionRequested",
      "alternateRepositoryResponsible",
    ],
    materials: [
      "entry-records",
      "witness-register",
      "custody-notice",
      "access-support",
      "delegation-records",
      "evidence-register",
    ],
  },
  "fraud-referral": {
    mechanic: "multi-exposure-review" as const,
    activities: ["source-assignment-check", "cross-exposure-source-coordination"],
    predicates: [
      "fileInScope",
      "namedRepresentative",
      "delegatedRepresentative",
      "deskAcknowledged",
      "reviewHold",
      "reviewWaiver",
      "sourcePermissionWithdrawn",
      "sourceContradiction",
      "sourceRetentionRequested",
      "specialistResponsible",
    ],
    materials: [
      "source-assignment",
      "representative-register",
      "cross-desk-notice",
      "routine-review-support",
      "delegation-source",
      "retention-source",
    ],
  },
};
const all = (...conditions: InvestigationCondition[]): InvestigationCondition => ({
  kind: "all",
  conditions,
});
const any = (...conditions: InvestigationCondition[]): InvestigationCondition => ({
  kind: "any",
  conditions,
});
const not = (condition: InvestigationCondition): InvestigationCondition => ({
  kind: "not",
  condition,
});
function source(
  id: string,
  title: string,
  narrative: string,
  rows: InvestigationRow[],
): InvestigationDocument {
  return { id, title, narrative, rows, version: 1, text: narrative + "\n" + JSON.stringify(rows) };
}
function build(family: InvestigationFamily, variant: number, salt: string): InvestigationTask {
  const d = domains[family],
    id = `ibx-${d.mechanic}-${variant < 2 ? "dev" : "holdout"}-${(variant % 2) + 1}-${salt}`;
  const prefix = `x${salt}-`,
    r = (name: string) => prefix + name;
  const base = (name: string, signer = "registrar") => ({
    id: r(name),
    signed: true,
    signerId: r(signer),
    supersedes: [] as string[],
  });
  const entities = {
    assetA: r("unit-31"),
    assetB: r("unit-72"),
    actorA: r("person-15"),
    actorB: r("person-26"),
    actorC: r("person-83"),
    site: r("site-48"),
  };
  const labels = {
    assetA: "unit-label-K",
    assetB: "unit-label-M",
    actorA: "person-label-J",
    actorB: "person-label-N",
    siteA: "location-label-P",
    siteB: "location-label-Q",
  };
  const names = {
    eligible: d.predicates[0]!,
    primary: d.predicates[1]!,
    delegate: d.predicates[2]!,
    ack: d.predicates[3]!,
    hold: d.predicates[4]!,
    waiver: d.predicates[5]!,
    revoked: d.predicates[6]!,
    disputed: d.predicates[7]!,
    preserve: d.predicates[8]!,
    alternate: d.predicates[9]!,
  };
  const test = (subject: InvestigationSubject, predicate: string): InvestigationCondition => ({
    kind: "test",
    subject,
    predicate,
    equals: true,
    requiredRole:
      subject === "site"
        ? "site-attestor"
        : subject === "actor"
          ? "personnel-attestor"
          : "asset-attestor",
  });
  const eligible = test("asset", names.eligible),
    primary = test("actor", names.primary),
    delegated = test("actor", names.delegate),
    ack = test("site", names.ack),
    hold = test("site", names.hold),
    waiver = test("actor", names.waiver),
    revoked = test("actor", names.revoked),
    disputed = test("actor", names.disputed),
    preserve = test("site", names.preserve),
    alternate = test("asset", names.alternate);
  const assignment = any(primary, all(delegated, ack)),
    blocked = all(hold, not(waiver));
  const firstConditions = [
    all(eligible, family === "evidence-brief" ? all(delegated, ack) : assignment, not(blocked)),
    assignment,
    family === "fraud-referral" ? all(blocked, any(disputed, not(primary))) : blocked,
    all(eligible, any(not(hold), waiver)),
    all(delegated, not(revoked)),
    any(
      preserve,
      family === "fraud-referral"
        ? all(eligible, not(revoked), not(disputed))
        : all(eligible, not(revoked)),
    ),
  ];
  const secondConditions = [
    all(any(preserve, disputed), not(any(revoked, all(hold, alternate)))),
    all(alternate, hold),
    any(preserve, all(disputed, not(alternate))),
    all(not(hold), any(primary, waiver)),
    all(primary, not(revoked)),
    any(all(hold, not(waiver)), all(preserve, not(revoked))),
  ];
  const subjects: InvestigationSubject[] = ["asset", "actor", "site", "asset", "actor", "site"];
  const clauses = (conditions: InvestigationCondition[], activity: string): InvestigationClause[] =>
    conditions.map((condition, index) => ({
      code: `R${index + 1}`,
      description: `Internal ${activity} collection of ${d.materials[index]} under this disclosed condition.`,
      condition,
      requestSubject: subjects[index]!,
      material: `${activity}:${d.materials[index]}`,
      custodianPredicate: "recordsCustodian",
      custodianRole: "records-custodian",
      lookbackHours: [4, 2, 8, 1, 6, 12][index]!,
      forwardHours: [2, 1, 4, 3, 2, 6][index]!,
    }));
  const policyA: PolicyRow = {
    ...base("pack-A-r1", "issuer-A"),
    kind: "policy",
    packId: r("pack-A"),
    revision: 1,
    activity: d.activities[0]!,
    effectiveFrom: START,
    effectiveTo: END,
    clauses: clauses(firstConditions, d.activities[0]!),
  };
  const policyB: PolicyRow = {
    ...base("pack-B-r1", "issuer-B"),
    kind: "policy",
    packId: r("pack-B"),
    revision: 1,
    activity: d.activities[1]!,
    effectiveFrom: START,
    effectiveTo: END,
    clauses: clauses(secondConditions, d.activities[1]!),
  };
  const authority = (
    name: string,
    person: string,
    role: string,
    subjectId: string,
    from = START,
    to = END,
  ): InvestigationRow => ({
    ...base(name, "authority-register"),
    kind: "authority",
    personId: r(person),
    role,
    subjectId,
    from,
    to,
  });
  const authorities: InvestigationRow[] = [
    authority("credential-registry", "registrar", "alias-registrar", "*"),
    authority("credential-issuer-A", "issuer-A", "policy-issuer", policyA.packId),
    authority("credential-issuer-B", "issuer-B", "policy-issuer", policyB.packId),
    authority("credential-issuer-late", "issuer-late", "policy-issuer", policyB.packId, MID),
    authority("credential-asset-A", "asset-keeper", "asset-attestor", entities.assetA),
    authority("credential-asset-B", "asset-keeper", "asset-attestor", entities.assetB),
    authority("credential-person-A", "personnel-keeper", "personnel-attestor", entities.actorA),
    authority("credential-person-B", "personnel-keeper", "personnel-attestor", entities.actorB),
    authority("credential-person-C", "personnel-keeper", "personnel-attestor", entities.actorC),
    authority("credential-site", "site-keeper", "site-attestor", entities.site),
    authority("credential-site-late", "site-late", "site-attestor", entities.site, MID),
    ...Object.values(entities).map((entity, index) =>
      authority(`credential-custodian-${index}`, "custodian-keeper", "records-custodian", entity),
    ),
  ];
  const events: InvestigationRow[] = [
    {
      ...base("event-A"),
      kind: "event",
      eventId: "E1",
      at: "2026-06-24T10:00:00Z",
      assetLabel: labels.assetA,
      actorLabel: labels.actorA,
      siteLabel: labels.siteA,
      activity: d.activities[0]!,
    },
    {
      ...base("event-B"),
      kind: "event",
      eventId: "E2",
      at: "2026-06-24T14:00:00Z",
      assetLabel: labels.assetB,
      actorLabel: labels.actorB,
      siteLabel: labels.siteB,
      activity: d.activities[1]!,
    },
  ];
  const alias = (
    name: string,
    subject: InvestigationSubject,
    label: string,
    entityId: string | null,
  ): InvestigationRow => ({
    ...base(name),
    kind: "alias",
    subject,
    label,
    entityId,
    from: START,
    to: END,
  });
  const aliases = [
    alias("binding-asset-A-pending", "asset", labels.assetA, null),
    alias("binding-asset-B", "asset", labels.assetB, entities.assetB),
    alias("binding-person-A", "actor", labels.actorA, entities.actorA),
    alias("binding-person-B", "actor", labels.actorB, entities.actorB),
    alias("binding-location-P", "site", labels.siteA, entities.site),
    alias("binding-location-Q", "site", labels.siteB, entities.site),
  ];
  const observation = (
    name: string,
    subjectId: string,
    predicate: string,
    value: string | boolean | null,
    signer: string,
    from = START,
  ): InvestigationRow => ({
    ...base(name, signer),
    kind: "observation",
    subjectId,
    predicate,
    value,
    from,
    to: END,
    firstHand: true,
    originId: r("origin-" + name),
  });
  // Inputs describe different fictional incidents, not prescribed output labels.
  const variantInputs = [
    {
      eligible: true,
      ack: true,
      preserve: true,
      alternate: true,
      bPrimary: true,
      bWaiver: false,
      bRevoked: false,
      bDisputed: true,
      cDelegate: null,
      cWaiver: true,
      cRevoked: false,
      cDisputed: null,
      cCustodian: r("person-C-records"),
    },
    {
      eligible: true,
      ack: null,
      preserve: false,
      alternate: false,
      bPrimary: false,
      bWaiver: true,
      bRevoked: false,
      bDisputed: true,
      cDelegate: true,
      cWaiver: true,
      cRevoked: false,
      cDisputed: true,
      cCustodian: r("person-C-records"),
    },
    {
      eligible: false,
      ack: true,
      preserve: true,
      alternate: true,
      bPrimary: true,
      bWaiver: false,
      bRevoked: true,
      bDisputed: null,
      cDelegate: false,
      cWaiver: true,
      cRevoked: false,
      cDisputed: false,
      cCustodian: r("person-C-records"),
    },
    {
      eligible: true,
      ack: true,
      preserve: false,
      alternate: true,
      bPrimary: true,
      bWaiver: true,
      bRevoked: false,
      bDisputed: false,
      cDelegate: true,
      cWaiver: false,
      cRevoked: false,
      cDisputed: false,
      cCustodian: null,
    },
  ] as const;
  const v = variantInputs[variant]!;
  const assetRows = [
    observation("asset-A-use", entities.assetA, names.eligible, v.eligible, "asset-keeper"),
    observation(
      "asset-B-coordination",
      entities.assetB,
      names.alternate,
      v.alternate,
      "asset-keeper",
    ),
  ];
  const personRows: InvestigationRow[] = [];
  for (const [entity, tag, values] of [
    [
      entities.actorA,
      "A",
      { primary: true, delegate: true, waiver: false, revoked: false, disputed: false },
    ],
    [
      entities.actorB,
      "B",
      {
        primary: v.bPrimary,
        delegate: false,
        waiver: v.bWaiver,
        revoked: v.bRevoked,
        disputed: v.bDisputed,
      },
    ],
    [
      entities.actorC,
      "C",
      {
        primary: false,
        delegate: v.cDelegate,
        waiver: v.cWaiver,
        revoked: v.cRevoked,
        disputed: v.cDisputed,
      },
    ],
  ] as const)
    for (const key of ["primary", "delegate", "waiver", "revoked", "disputed"] as const)
      personRows.push(
        observation(`person-${tag}-${key}`, entity, names[key], values[key], "personnel-keeper"),
      );
  const siteRows = [
    observation("site-acknowledgement", entities.site, names.ack, v.ack, "site-keeper"),
    observation("site-preservation", entities.site, names.preserve, v.preserve, "site-keeper"),
    observation("site-hold-pending", entities.site, names.hold, null, "site-keeper"),
  ];
  const custodians = Object.entries(entities).map(([key, entity]) =>
    observation(
      `custodian-${key}`,
      entity,
      "recordsCustodian",
      key === "actorC" ? v.cCustodian : r(`${key}-records`),
      "custodian-keeper",
    ),
  );
  const inventory: InvestigationRow[] = (
    ["authority", "aliases", "observations", "policies"] as const
  ).map((covers) => ({
    ...base("inventory-" + covers, "authority-register"),
    kind: "inventory",
    covers,
    complete: true,
    description: `Complete currently disclosed ${covers} set. Provided response and material corrections join this disclosed inventory.`,
  }));
  const decoys: InvestigationRow[] = [
    {
      ...observation("unsigned-hold-copy", entities.site, names.hold, false, "site-keeper"),
      signed: false,
      supersedes: [r("site-hold-pending")],
    },
    observation("wrong-role-hold-copy", entities.site, names.hold, false, "asset-keeper"),
    {
      ...alias("cross-label-binding-copy", "actor", "unrelated-person-label", entities.actorB),
      supersedes: [r("binding-person-A")],
    },
  ];
  const initialDocuments = [
    source(
      r("policy-contract"),
      "Fictional collection contract and complete inventories",
      INVESTIGATION_RULES,
      inventory,
    ),
    source(
      r("authority-register"),
      "Scoped signed sourcekeeper credentials",
      "Each credential is scoped to the named entity or pack and event interval. Later credentials do not authorize earlier event instants.",
      authorities,
    ),
    source(
      r("events"),
      "Two distinct exposure activities",
      "E1 and E2 are separate activity scopes. Resolve each label at its own event time. Similar or repeated labels never establish an identity without the signed scoped registry.",
      events,
    ),
    source(
      r("registry"),
      "Signed entity binding register",
      "The two location labels can share a site entity only through their signed bindings. A pending unit binding is explicitly unavailable.",
      aliases,
    ),
    source(
      r("asset-register"),
      "Asset attestations",
      "Signed first-hand observations address named entities; they do not bind physical labels themselves.",
      assetRows,
    ),
    source(
      r("person-register"),
      "Personnel attestations",
      "Unknown permission, delegation or source contact is explicit null. A named negative is a known value. Attestations address entity IDs, not labels.",
      personRows,
    ),
    source(
      r("site-register"),
      "Shared site coordination attestations",
      "One entity-scoped control can be used by distinct activity policies at their own event instants. A control is not an applicability classification.",
      siteRows,
    ),
    source(
      r("custodians"),
      "Scoped original-record custodians",
      "Contacts are first-hand sourcekeeper assertions; a missing contact is not a negative condition or permission.",
      custodians,
    ),
    source(
      r("policy-A"),
      "First activity signed collection pack",
      "These six clauses govern only matching activity and eligible event time; clauses define internal requests, not real external authority.",
      [policyA],
    ),
    source(
      r("policy-B"),
      "Second activity signed collection pack",
      "This separate pack has its own activity and lineage. Shared observations do not merge the policy scopes.",
      [policyB],
    ),
    source(
      r("unqualified-correspondence"),
      "Unqualified copies and unrelated correspondence",
      "Unsigned content and a signer with the wrong scoped role cannot supersede a qualified original. A correction naming another label cannot retire the assigned label.",
      decoys,
    ),
  ];
  const response = source(
    r("received-ledger"),
    "Received original site assignment ledger",
    "The supplied original ledger attests the unit binding and the coordination control for its stated interval. Reconcile all relation operands, including any effect on the second activity.",
    [
      {
        ...alias("binding-asset-A-original", "asset", labels.assetA, entities.assetA),
        supersedes: [r("binding-asset-A-pending")],
      },
      {
        ...observation("site-hold-original", entities.site, names.hold, true, "site-keeper"),
        supersedes: [r("site-hold-pending")],
      },
    ],
  );
  const update1 = source(
    r("person-correction"),
    "Signed first-event representative correction",
    "This correction changes the named person label only. It does not retire a binding for another label, change a unit or rewrite observations about other entity IDs.",
    [
      {
        ...alias("binding-person-A-corrected", "actor", labels.actorA, entities.actorC),
        supersedes: [r("binding-person-A")],
      },
    ],
  );
  const revised = structuredClone(policyB);
  revised.id = r("pack-B-r2");
  revised.signerId = r("issuer-late");
  revised.revision = 2;
  revised.effectiveFrom = MID;
  revised.supersedes = [policyB.id];
  revised.clauses[3] = {
    ...revised.clauses[3]!,
    condition: all(any(not(hold), waiver), not(revoked)),
    requestSubject: "actor",
    material: `${d.activities[1]}:current-release-review`,
    lookbackHours: 9,
    forwardHours: 2,
  };
  revised.clauses[5] = {
    ...revised.clauses[5]!,
    condition: all(any(preserve, disputed), not(revoked)),
    material: `${d.activities[1]}:current-retention-check`,
  };
  const update2 = source(
    r("interval-correction"),
    "Signed later-interval control and second-activity amendment",
    "The control correction and new issuer credential qualify only from12:00. Supersession cannot erase an earlier event input. The second activity revision changes its own clauses/materials/scopes; it does not replace the first activity pack.",
    [
      {
        ...observation("site-hold-later", entities.site, names.hold, false, "site-late", MID),
        supersedes: [r("site-hold-original")],
      },
      revised,
    ],
  );
  const factDefinitions: Record<string, string> = {};
  for (const event of ["E1", "E2"])
    for (let clause = 1; clause <= 6; clause++)
      factDefinitions[`${event}.R${clause}`] =
        `Current internal collection applicability of clause R${clause} in event ${event}'s own activity pack: applicable/not-applicable/unresolved, including qualified subject and custodian prerequisites.`;
  factDefinitions.resolvedAssetIds =
    "Complete sorted eventId:entityId tokens for resolved assets; explicitly unknown assets are excluded.";
  factDefinitions.resolvedActorIds =
    "Complete sorted eventId:entityId tokens for resolved actors at each event instant.";
  factDefinitions.currentPolicyVersionIds =
    "Complete sorted eventId:packId@revision tokens for the uniquely governing activity-specific pack.";
  factDefinitions.unresolvedSubjectIds =
    "Complete sorted eventId:asset|actor|site|policy tokens for unresolved bindings or pack selection, not unknown observations.";
  const task: InvestigationTask = {
    id,
    family,
    split: variant < 2 ? "dev" : "holdout",
    clock: INTERACTION_CLOCK,
    instruction:
      "Prepare the current internal interaction investigation packet for both distinct exposure activities using their supplied fictional collection rules. Resolve shared entity evidence through each event, its authority and time interval; evaluate every published field; persist exactly the applicable scoped requests and current historical-approval classifications. Obtain the assigned original ledger through the supplied internal source-request workflow. Reconcile every newly received relation operand and both provided material corrections, preserving unrelated valid dependencies. Obtain the current provided internal review, record the handoff, retain the human workflow pin and save one current-investigation-followup for internal-investigation-team at readingClock+90minutes. Source field IDs, applicability enums and aggregate token formats are exact; semantically sufficient current row proofs and valid supersets are accepted without quotation or narrative grading. This is fictional operations logic, not professional coverage, liability or fraud truth. No real external finalization or fabricated human signoff is authorized.",
    documents: initialDocuments,
    rubric: {
      facts: {},
      followUp: {
        kind: "current-investigation-followup",
        owner: "internal-investigation-team",
        dueAt: "2026-06-24T17:30:00Z",
      },
      workflow: { status: "investigation_packet_ready", owner: "internal-investigation-team" },
      memoAnchors: [],
    },
    investigation: {
      mechanic: d.mechanic,
      initialDocuments,
      sourceRequest: {
        obligationId: "source:original-site-assignment-ledger",
        eventId: "E1",
        subjectId: labels.siteA,
        material: "original-site-assignment-ledger",
        custodianId: r("site-originals-keeper"),
        periodStart: START,
        periodEnd: END,
      },
      requestedResponse: response,
      updates: [update1, update2],
      factDefinitions,
      humanPinId: r("human-workflow-pin"),
      reviewOwner: "internal-investigation-team",
      correspondenceId: id,
    },
  };
  const initial = deriveInvestigationPhase(snapshotForPhase(task, 1, false));
  const preferred = ["E1.R6", "E1.R2", "E2.R3"];
  const approvals: InvestigationRow[] = preferred
    .filter((obligationId) => initial.facts[obligationId] === "applicable")
    .map((obligationId, index) => ({
      ...base(`approval-${index}`, "provided-internal-reviewer"),
      kind: "approval",
      approvalId: r(`historical-review-${index}`),
      obligationId,
      dependencyRowIds: initial.certificates[obligationId]![0]!.map((ref) => ref.rowId),
      scope: "internal-source-request",
    }));
  initialDocuments.push(
    source(
      r("historical-approvals"),
      "Provided original internal scoped approvals",
      "Each original signed approval names supporting operands already disclosed in this initial inventory. Current use requires a sufficient witness for the same obligation; extra cited rows are not dependencies.",
      approvals,
    ),
  );
  return task;
}
export function generateInteractionCases(seed = 100419): InvestigationTask[] {
  if (!Number.isSafeInteger(seed)) throw new Error("Interaction seed must be a safe integer");
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state.toString(16).padStart(8, "0");
  };
  return INTERACTION_FAMILIES.flatMap((family) =>
    Array.from({ length: 4 }, (_, variant) => build(family, variant, next())),
  );
}
