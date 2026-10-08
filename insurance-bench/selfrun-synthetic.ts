import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** Original fictional tasks; these are not scores or replicas of a public benchmark. */
export interface SyntheticSelfRunTask {
  id: string;
  componentId: 'documents' | 'knowledge-work';
  instruction: string;
  sourceTexts: { id: string; text: string }[];
  /** Author-side rendering input. NEVER serialize this field into an actor prompt. */
  images?: { id: string; svg: string }[];
  answerFormat: Record<string, string>;
  /** Private grading data. NEVER serialize this field into an actor prompt. */
  expected: Record<string, string | number | boolean | string[]>;
}

export interface SyntheticPublicPacket {
  id: string;
  componentId: SyntheticSelfRunTask['componentId'];
  instruction: string;
  sourceTexts: { id: string; text: string }[];
  images: { id: string; path: string }[];
  answerFormat: Record<string, string>;
}

const documentInstruction = 'Use only the attached fictional raster pages. Apply the authority and precedence rules printed on those pages. Return one JSON object with exactly the answerFormat keys. Monetary and weight answers are JSON numbers in the stated units, rounded to two decimal places with decimal half-up rounding. Arrays must use the order specified by the field. Do not infer missing facts.';

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Deterministic original page layout, intentionally never shipped as actor text. */
function page(title: string, pageNumber: number, lines: string[]): { id: string; svg: string } {
  if (lines.length > 32 || lines.some((line) => line.length > 84)) throw new Error('Page text exceeds its readable layout');
  const body = lines.map((line, i) => {
    const section = line.startsWith('# ');
    return `<text xml:space="preserve" x="92" y="${250 + i * 43}" font-size="${section ? 29 : 25}" font-weight="${section ? 'bold' : 'normal'}" fill="${section ? '#183d4b' : '#20272b'}">${xml(section ? line.slice(2) : line)}</text>`;
  }).join('');
  return {
    id: `page-${pageNumber}`,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1900" viewBox="0 0 1500 1900"><rect width="1500" height="1900" fill="#eeeae2"/><rect x="48" y="46" width="1404" height="1808" fill="#fffef9" stroke="#b9b7ac" stroke-width="2"/><g font-family="Andale Mono, monospace"><text x="92" y="116" font-size="22" fill="#746b5f">ORIGINAL FICTIONAL TRAINING DOCUMENT / NO REAL ORGANIZATION</text><text x="92" y="172" font-size="35" font-weight="bold" fill="#183d4b">${xml(title)}</text><path d="M92 205 H1406" stroke="#183d4b" stroke-width="3"/>${body}<path d="M92 1718 H1406" stroke="#b9b7ac"/><text x="92" y="1770" font-size="22" fill="#746b5f">Fictional authority: Lumen Harbor Operations Office</text><text x="1250" y="1770" font-size="22" fill="#746b5f">Page ${pageNumber}</text></g></svg>`,
  };
}

export function generateSyntheticSelfRunTasks(): SyntheticSelfRunTask[] {
  return [
    {
      id: 'original-documents-01', componentId: 'documents', sourceTexts: [],
      instruction: `${documentInstruction} Reconcile the purchase packet: report accepted quantities, the rejected billed quantities, the authorized goods subtotal, discount, tax, and payable total. Also transcribe the requested receipt line exactly.`,
      images: [page('PURCHASE CONTROL / PURCHASE ORDER', 1, [
        '# Approved purchase order P-731 / revision 2',
        'Approved 2027-02-08 14:10 UTC by Mara Venn (fictional controller).',
        'Revision 2 overrides every earlier price and order quantity.',
        'SKU      Ordered quantity       Current unit price (USD)',
        'AX7      8                      14.25',
        'BX2      5                      33.40',
        'CX8      3                      19.80',
        '# Invoice I-908 / received 2027-02-10',
        'SKU      Billed quantity        Printed unit price (USD)',
        'AX7      8                      14.25',
        'BX2      5                      35.40',
        'CX8      3                      19.80',
        'Printed invoice BX2 price uses obsolete PO revision 1.',
        '# Controller payment rule',
        'Pay only net received quantity, capped by ordered and billed quantity.',
        'Net received = delivered minus returned; no later delivery is assumed.',
        'Use current PO prices. Discount = 2% of authorized goods subtotal.',
        'Round discount first; tax = 8% of subtotal less rounded discount.',
        'Round tax next; add USD 12.00 shipping after tax. Shipping is not taxed.',
      ]), page('PURCHASE CONTROL / RECEIPT AND RETURN', 2, [
        '# Warehouse receipt R-204 / final signed record',
        'Signed 2027-02-10 16:40 UTC by Ivo Bell (fictional receiving lead).',
        'Receipt R-204: AX7 | delivered 7 | returned 1',
        'Receipt R-204: BX2 | delivered 5 | returned 0',
        'Receipt R-204: CX8 | delivered 2 | returned 0',
        '# Corrections and exclusions',
        'The AX7 return is already part of this receipt. Do not subtract twice.',
        'An unsigned packing slip claimed CX8 delivered 3; it is superseded.',
        'No replacement AX7 or CX8 shipment has arrived as of this approval.',
        'Rejected billed quantity means billed quantity less accepted quantity.',
        'For the transcription field, copy the complete CX8 receipt line above.',
      ])],
      answerFormat: { ax7_quantity: 'integer units', bx2_quantity: 'integer units', cx8_quantity: 'integer units', rejected_billed: 'array of SKU:quantity strings, SKU ascending; nonzero only', goods_subtotal_usd: 'number USD', discount_usd: 'number USD', tax_usd: 'number USD', payable_usd: 'number USD', receipt_line: 'exact CX8 receipt line including spaces and punctuation' },
      expected: { ax7_quantity: 6, bx2_quantity: 5, cx8_quantity: 2, rejected_billed: ['AX7:2', 'CX8:1'], goods_subtotal_usd: 292.10, discount_usd: 5.84, tax_usd: 22.90, payable_usd: 321.16, receipt_line: 'Receipt R-204: CX8 | delivered 2 | returned 0' },
    },
    {
      id: 'original-documents-02', componentId: 'documents', sourceTexts: [],
      instruction: `${documentInstruction} Determine the crates authorized for the scheduled East departure. Report their sorted IDs, combined gross and net mass, the excluded East IDs, and the release-time boundary result.`,
      images: [page('DEPARTURE MANIFEST / FINAL REVISION', 1, [
        '# Manifest MF-62 / revision 2 / signed 2027-02-11 08:40 UTC',
        'Departure: 2027-02-11T09:00:00Z. Destination required: EAST.',
        'Revision 2 replaces revision 1, which listed M16 gross mass as 145.50 kg.',
        'Crate   Destination   Gross kg   Tare kg   Sealed?   Seal',
        'M12     EAST          128.40     18.40     YES       S001',
        'M13     WEST           97.20     12.20     YES       S002',
        'M14     EAST          156.80     26.80     YES       S004',
        'M15     EAST           82.50      7.50     NO        NONE',
        'M16     EAST          145.50     15.50     YES       S005',
        '# Dispatch rule / fictional supervisor Nera Vale',
        'Load only EAST crates with YES sealed and matching approved release seal.',
        'Release time must be at or before departure. Exact equality is allowed.',
        'A withdrawal overrides approval. Signed correction overrides manifest.',
        'Net mass = current gross mass minus tare mass. Units: kilograms.',
      ]), page('RELEASE DESK / CORRECTION BULLETIN', 2, [
        '# Release register / all times UTC on 2027-02-11',
        'Crate   Seal    Release time           Action',
        'M12     S001    08:55:00               APPROVED',
        'M13     S002    08:52:00               APPROVED',
        'M14     S004    08:57:00               APPROVED',
        'M15     NONE    08:58:00               NOT APPROVED',
        'M16     S005    09:00:00               APPROVED',
        '# Signed overrides / fictional supervisor Nera Vale',
        '08:59:00: WITHDRAW M14; its earlier release is void.',
        '08:59:30: Correct M16 gross mass to 149.50 kg; tare stays 15.50 kg.',
        'Both overrides were signed before departure and are authoritative.',
        'M16 release remains approved under seal S005 at exactly departure.',
        'List excluded EAST crates only; do not include WEST crates in that list.',
      ])],
      answerFormat: { loaded_crates: 'array of crate IDs ascending', loaded_gross_kg: 'number kilograms', loaded_net_kg: 'number kilograms', excluded_east_crates: 'array of crate IDs ascending', exact_boundary_release_allowed: 'boolean under the printed rule', departure_utc: 'ISO instant exactly as printed' },
      expected: { loaded_crates: ['M12', 'M16'], loaded_gross_kg: 277.90, loaded_net_kg: 244.00, excluded_east_crates: ['M14', 'M15'], exact_boundary_release_allowed: true, departure_utc: '2027-02-11T09:00:00Z' },
    },
    {
      id: 'original-documents-03', componentId: 'documents', sourceTexts: [],
      instruction: `${documentInstruction} Audit the instrument certificate after the signed addendum. Report pass/fail point IDs, the requested corrected readings, maximum absolute percentage error, and whether the instrument may be released.`,
      images: [page('INSTRUMENT CERTIFICATE / OBSERVATIONS', 1, [
        '# Fictional instrument CAL-83 / bench test 2027-03-04',
        'Readings and references are in grams. Signed by tester Sela Orin.',
        'Point   Reference g   Raw reading g   Correction g',
        'A        100.00        100.80         -0.20',
        'B        200.00        202.60         -0.40',
        'C        500.00        494.50         +1.50',
        'D       1000.00       1012.00         -2.00',
        'E       2000.00       1974.00         +1.00',
        '# Printed lab method',
        'Adjusted reading = raw reading + signed correction.',
        'Absolute error = absolute(adjusted reading minus reference).',
        'A point passes if absolute error is <= 1.00% of its reference.',
        'An exactly equal error passes; evaluate before rounding.',
        'Percent error = 100 * absolute error / reference.',
        'Release only if every point passes the current method.',
      ]), page('INSTRUMENT CERTIFICATE / SIGNED ADDENDUM', 2, [
        '# Addendum AD-83 / signed 2027-03-04 17:15 UTC',
        'Fictional lab director Elan Moss approves the following changes only:',
        'Point D: replace raw reading 1012.00 g with 1009.50 g.',
        'Point E: replace correction +1.00 g with +6.00 g.',
        'All other raw readings, corrections, references and rules stay current.',
        '# Superseded draft / do not use',
        'Unsigned draft AD-83a proposed a 1.50% tolerance; it was REJECTED.',
        'The signed addendum above is the only authority after the base record.',
        'Report maximum percent error to two decimals, using current readings.',
        'Pass/fail arrays must contain every point exactly once, IDs ascending.',
      ])],
      answerFormat: { passed_points: 'array of point IDs ascending', failed_points: 'array of point IDs ascending', adjusted_d_grams: 'number grams', adjusted_e_grams: 'number grams', maximum_error_percent: 'number percentage points, two decimal rounding', release_allowed: 'boolean' },
      expected: { passed_points: ['A', 'C', 'D', 'E'], failed_points: ['B'], adjusted_d_grams: 1007.50, adjusted_e_grams: 1980.00, maximum_error_percent: 1.10, release_allowed: false },
    },
    {
      id: 'original-documents-04', componentId: 'documents', sourceTexts: [],
      instruction: `${documentInstruction} Reconcile the employee expense packet under its printed fictional policy. Report allowed meal, train and hotel amounts, total reimbursement, refund amount, and excluded receipt IDs.`,
      images: [page('TRAVEL CLAIM / RECEIPT REGISTER', 1, [
        '# Fictional employee Dara Finch / travel close 2027-04-15',
        'All amounts are USD and already include applicable taxes.',
        'Receipt   Item                         Paid USD    Evidence',
        'E01       Taxi                          42.60      SIGNED',
        'E02       Meal for 3 authorized people   95.40      SIGNED',
        'E03       Rail ticket                   68.20      SIGNED',
        'E04       Hotel / two nights           245.00      SIGNED',
        'E05       Parking                       18.00      UNSIGNED',
        '# E04 itemized hotel receipt',
        'Rooms: 2 nights x USD 115.00 = USD 230.00.',
        'Mandatory municipal fee: USD 15.00 total; already in paid amount.',
        '# Fictional finance authority / Rhea Sol',
        'Require signed evidence. Taxi reimburses actual cost once.',
        'Meal limit is USD 28.00 per authorized person, including tax.',
        'Rail reimburses paid ticket less refunds; do not reimburse a refund.',
        'Hotel room limit is USD 110.00 per night; mandatory fee is allowed.',
      ]), page('TRAVEL CLAIM / DUPLICATE AND REFUND REVIEW', 2, [
        '# Signed review memo / fictional finance authority Rhea Sol',
        'E06: Taxi USD 42.60; signed duplicate copy of receipt E01.',
        'Do not reimburse E06 in addition to E01.',
        'E03: Rail operator refunded USD 19.75 before this close.',
        'The rail receipt still shows its original USD 68.20 paid amount.',
        'E05 has no signed evidence and is not reimbursable at this close.',
        'E04 municipal fee is charged once per stay, not once per night.',
        'No other advances, refunds or currency conversions apply.',
        'Excluded IDs mean rejected receipts; the partly allowed E02/E04 stay in.',
      ])],
      answerFormat: { allowed_meal_usd: 'number USD', allowed_train_usd: 'number USD', allowed_hotel_usd: 'number USD', reimbursement_usd: 'number USD', refund_usd: 'number USD', excluded_receipts: 'array of rejected receipt IDs ascending' },
      expected: { allowed_meal_usd: 84.00, allowed_train_usd: 48.45, allowed_hotel_usd: 235.00, reimbursement_usd: 410.05, refund_usd: 19.75, excluded_receipts: ['E05', 'E06'] },
    },
    {
      id: 'original-work-01', componentId: 'knowledge-work',
      instruction: 'Prepare the fictional May close under the supplied controller policy, using all evidence available by close preparation. Return exactly the answerFormat keys as a JSON object. USD amounts are JSON numbers; amounts are already tax exclusive. Positive balances represent liabilities or assets, and the accrual reversal field must be signed. Do not apply external accounting rules.',
      sourceTexts: [{ id: 'controller-policy', text: 'Fictional controller Una Reed closes May as of 2027-05-31T23:59:59Z, prepared 2027-06-03T18:00:00Z. Expense follows service date, not invoice or payment date. A final invoice replacing a prior-month estimate reverses that estimate in May and books the complete final invoice in May; their net is May expense. Credit memos reduce the linked service-period expense and liability. June service paid in May is a prepaid asset, not May expense and not a liability. The payable-and-accrual control includes both invoiced and unbilled service liabilities. Payment of opening invoices reduces this control but is not May expense. No other entries exist.' },
        { id: 'opening-and-evidence', text: 'Opening May payable-and-accrual control USD 2900: April estimate EST-APR USD 2000 plus older invoiced liability OLD-9 USD 900. Evidence by close: S-MAY service May 31 USD 1850, invoice June 2, unpaid; I-MAY service May 28 USD 1200, invoice May 29, unpaid; CM-MAY credit USD 150 issued June 1 against I-MAY; ADV-JUN paid USD 500 on May 30 for June 1 service only; FINAL-APR invoice June 2 USD 2150 final total for the service covered by EST-APR, unpaid; PAY-OLD payment May 12 USD 900 settles OLD-9. No cash was paid on FINAL-APR, S-MAY or I-MAY by May 31. The ADV-JUN cash payment does not pass through the liability control.' }],
      answerFormat: { may_expense_usd: 'number USD', ending_payable_and_accrual_usd: 'number USD', june_prepaid_asset_usd: 'number USD', prior_estimate_reversal_usd: 'signed number USD', april_trueup_expense_usd: 'signed number USD', unbilled_may_accrual_usd: 'number USD', may_expense_evidence: 'array of evidence IDs alphabetically; include both reversal and final invoice IDs' },
      expected: { may_expense_usd: 3050, ending_payable_and_accrual_usd: 5050, june_prepaid_asset_usd: 500, prior_estimate_reversal_usd: -2000, april_trueup_expense_usd: 150, unbilled_may_accrual_usd: 1850, may_expense_evidence: ['CM-MAY', 'EST-APR', 'FINAL-APR', 'I-MAY', 'S-MAY'] },
    },
    {
      id: 'original-work-02', componentId: 'knowledge-work',
      instruction: 'Compare all three fictional vendors under the purchasing policy. Calculate the complete six-month cost of the required scope even for an ineligible vendor, determine eligibility, and choose the lowest eligible total. Return exactly the answerFormat keys as JSON. Amounts are USD numbers with decimal half-up rounding to two decimals; arrays are alphabetic unless their field specifies cost order.',
      sourceTexts: [{ id: 'purchasing-policy', text: 'Fictional procurement owner Bren Ota requires 100 seats for 6 months, setup, support and data conversion. Scope is identical across quotes. Software seat charges and setup are taxable at 10%; support and conversion are not taxable. A one-time software credit reduces the taxable seat base before tax. Sum all charges less credit, then add rounded tax. Eligibility requires support response <=4 hours AND launch <=12 working days. The supplied lead times are already working days; no calendar conversion. Choose minimum total among eligible vendors; break a cost tie by alphabetical vendor name. The runner-up gap is second-lowest eligible total minus winning total.' },
        { id: 'quotes', text: 'Amber: seat USD 18.00 per seat/month; setup USD 1400; support USD 900 total; conversion USD 350 total; one-time software credit USD 500; response 4 hours; launch 10 working days. Birch: seat USD 17.00 per seat/month; setup USD 900; support USD 800 total; conversion USD 800 total; credit USD 0; response 2 hours; launch 14 working days. Cedar: seat USD 16.50 per seat/month; setup USD 2000; support USD 1500 total; conversion USD 500 total; one-time software credit USD 300; response 3 hours; launch 8 working days. No charges recur other than seats; all quoted charges exclude tax. These quotes are fictional.' }],
      answerFormat: { amber_total_usd: 'number USD', birch_total_usd: 'number USD', cedar_total_usd: 'number USD', amber_tax_usd: 'number USD', birch_tax_usd: 'number USD', cedar_tax_usd: 'number USD', eligible_order: 'array of eligible vendor names by increasing total cost', ineligible_vendors: 'array of names alphabetically', selected_vendor: 'exact vendor name', runner_up_gap_usd: 'number USD' },
      expected: { amber_total_usd: 14120, birch_total_usd: 13810, cedar_total_usd: 14760, amber_tax_usd: 1170, birch_tax_usd: 1110, cedar_tax_usd: 1160, eligible_order: ['Amber', 'Cedar'], ineligible_vendors: ['Birch'], selected_vendor: 'Amber', runner_up_gap_usd: 640 },
    },
    {
      id: 'original-work-03', componentId: 'knowledge-work',
      instruction: 'Produce the optimal fictional installation schedule under the supplied resource rules. Return exactly the answerFormat keys as a JSON object with integer hours relative to the stated origin. First minimize completion hour, then break ties by lexicographically minimizing the vector of start hours in A,B,C,D,E,F order. This makes the requested answer unique.',
      sourceTexts: [{ id: 'schedule-authority', text: 'Fictional operations lead Cyra Elm authorizes two interchangeable crews and one shared test rig. Every job needs one crew for its entire duration; B,D,F also need the shared rig for their entire duration. A crew may perform any job. Jobs cannot be interrupted, and may start only at nonnegative integer hours. Finish equals start plus duration. Intervals are half-open [start,finish), so a resource can move to a new job exactly when a previous job finishes. All predecessors must finish before the successor starts. There are no travel/setup times, holidays, breaks or other constraints. Origin hour 0 is 2027-07-12T08:00:00Z, timezone UTC.' },
        { id: 'job-table', text: 'Job | Duration hours | Predecessors | Rig needed\nA | 2 | none | NO\nB | 3 | A | YES\nC | 2 | A | NO\nD | 2 | C | YES\nE | 3 | B,C | NO\nF | 1 | D,E | YES\nCompletion is the latest finish of any job. The public requirement is to perform all six jobs.' }],
      answerFormat: { start_a: 'integer hour', start_b: 'integer hour', start_c: 'integer hour', start_d: 'integer hour', start_e: 'integer hour', start_f: 'integer hour', completion_hour: 'integer hour', completion_utc: 'ISO timestamp YYYY-MM-DDTHH:mm:ssZ', rig_order: 'array of rig job IDs in execution order' },
      expected: { start_a: 0, start_b: 2, start_c: 2, start_d: 5, start_e: 5, start_f: 8, completion_hour: 9, completion_utc: '2027-07-12T17:00:00Z', rig_order: ['B', 'D', 'F'] },
    },
    {
      id: 'original-work-04', componentId: 'knowledge-work',
      instruction: 'Reconcile the fictional quarter forecast and April-May variance bridge under the supplied analyst definitions. Return exactly the answerFormat keys as a JSON object. USD answers are signed numeric amounts where specified, rounded decimal half-up to two decimals. A positive cost variance is unfavorable. Unit answers are integers. Do not substitute external variance conventions.',
      sourceTexts: [{ id: 'forecast-authority', text: 'Fictional finance analyst Tavi Noor uses standard cost USD 80 per finished unit. Budget is 300 units per month for April, May and June 2027, all in UTC calendar months. April-May budget cost = budget units through May times standard. Correct actual cost by removing refundable deposits and deducting service-linked supplier credits not yet posted. Volume variance = (actual April-May units minus budget April-May units) times standard. Price variance = corrected actual April-May cost minus actual April-May units times standard. Actual-versus-budget variance = volume plus price; positive is unfavorable. June demand is 330 units. Use internal capacity first; outsource the rest to fulfill all demand. Quarter forecast cost = corrected actual April-May cost plus June forecast cost. Quarter forecast variance is quarter forecast cost minus complete quarter budget cost. All amounts are USD excluding tax; no other adjustments.' },
        { id: 'actual-and-forecast-table', text: 'April actual finished units 260; reported cost USD 21450 includes a refundable nonexpense equipment deposit USD 600. May actual finished units 310; reported cost USD 26040 does not yet include a supplier credit USD 240 for May services. June internal capacity 310 units; internal forecast cost USD 83 per unit; outsourcing cost USD 92 per unit. The 330-unit June demand includes 20 units above internal capacity. Outsourced units count as finished units. Deposits do not consume units, the May supplier credit does not change units, and no supplier credit relates to June.' }],
      answerFormat: { corrected_april_cost_usd: 'number USD', corrected_may_cost_usd: 'number USD', corrected_actual_cost_usd: 'number USD', through_may_budget_cost_usd: 'number USD', volume_variance_usd: 'signed number USD', price_variance_usd: 'signed number USD', actual_budget_variance_usd: 'signed number USD', june_internal_units: 'integer units', june_outsourced_units: 'integer units', june_forecast_cost_usd: 'number USD', quarter_forecast_units: 'integer units', quarter_forecast_cost_usd: 'number USD', quarter_forecast_variance_usd: 'signed number USD' },
      expected: { corrected_april_cost_usd: 20850, corrected_may_cost_usd: 25800, corrected_actual_cost_usd: 46650, through_may_budget_cost_usd: 48000, volume_variance_usd: -2400, price_variance_usd: 1050, actual_budget_variance_usd: -1350, june_internal_units: 310, june_outsourced_units: 20, june_forecast_cost_usd: 27570, quarter_forecast_units: 900, quarter_forecast_cost_usd: 74220, quarter_forecast_variance_usd: 2220 },
    },
  ];
}

/** Explicit allow-list prevents accidental exposure of private expected values or SVG text. */
export function syntheticPublicPacket(task: SyntheticSelfRunTask, imagePaths: readonly string[] = []): SyntheticPublicPacket {
  if (imagePaths.length !== (task.images?.length ?? 0)) throw new Error(`Missing raster pages for ${task.id}`);
  return {
    id: task.id, componentId: task.componentId, instruction: task.instruction,
    sourceTexts: task.sourceTexts.map((source) => ({ ...source })),
    images: imagePaths.map((path, index) => ({ id: task.images![index]!.id, path })),
    answerFormat: { ...task.answerFormat },
  };
}

export interface SyntheticRasterRenderer {
  (input: Buffer): { png(options: { compressionLevel: number; adaptiveFiltering: boolean }): { toFile(path: string): Promise<unknown> } };
}

/** Bundled-runtime fallback is explicit; consumers normally use the frozen PNGs. */
export function resolveSyntheticRenderer(modulePath?: string): SyntheticRasterRenderer {
  const require = createRequire(import.meta.url);
  if (modulePath) return require(modulePath) as SyntheticRasterRenderer;
  try { return require('sharp') as SyntheticRasterRenderer; } catch {
    return require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')) as SyntheticRasterRenderer;
  }
}

/** Original SVG content is rendered locally; no solver, network, imagegen or app database. */
export async function renderSyntheticTaskImages(outputDir: string, renderer: SyntheticRasterRenderer = resolveSyntheticRenderer()): Promise<Record<string, string[]>> {
  const directory = resolve(outputDir);
  await mkdir(directory, { recursive: true });
  const paths: Record<string, string[]> = {};
  for (const task of generateSyntheticSelfRunTasks()) {
    if (!task.images?.length) continue;
    paths[task.id] = [];
    for (const image of task.images) {
      const path = join(directory, `${task.id}-${image.id}.png`);
      await renderer(Buffer.from(image.svg, 'utf8')).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(path);
      paths[task.id]!.push(path);
    }
  }
  return paths;
}
