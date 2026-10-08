import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateSyntheticSelfRunTasks, renderSyntheticTaskImages, syntheticPublicPacket, type SyntheticSelfRunTask } from '../insurance-bench/selfrun-synthetic.ts';

const tasks = generateSyntheticSelfRunTasks();
function task(id: string): SyntheticSelfRunTask {
  const found = tasks.find((candidate) => candidate.id === id);
  assert.ok(found, `Missing task ${id}`);
  return found;
}
function lines(id: string): string[] {
  return task(id).images!.flatMap((image) => [...image.svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map((match) => match[1]!.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"')));
}
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

test('original packet is deterministic, separated, complete and has no text substitute for raster content', () => {
  assert.deepEqual(generateSyntheticSelfRunTasks(), tasks);
  assert.equal(new Set(tasks.map((entry) => entry.id)).size, 8);
  assert.equal(tasks.filter((entry) => entry.componentId === 'documents').length, 4);
  assert.equal(tasks.filter((entry) => entry.componentId === 'knowledge-work').length, 4);
  assert.equal(tasks.reduce((sum, entry) => sum + Object.keys(entry.expected).length, 0), 66);
  for (const entry of tasks) {
    assert.deepEqual(Object.keys(entry.expected).sort(), Object.keys(entry.answerFormat).sort());
    if (entry.componentId === 'documents') {
      assert.equal(entry.images!.length, 2);
      assert.deepEqual(entry.sourceTexts, []);
      assert.throws(() => syntheticPublicPacket(entry), /Missing raster pages/);
      assert.ok(entry.images!.every((image) => /^page-[12]$/.test(image.id)));
    }
    const packet = syntheticPublicPacket(entry, entry.images?.map((_, index) => `/public/${entry.id}-page-${index + 1}.png`) ?? []);
    assert.deepEqual(Object.keys(packet).sort(), ['answerFormat', 'componentId', 'id', 'images', 'instruction', 'sourceTexts']);
    assert.equal(JSON.stringify(packet).includes('<svg'), false);
    assert.equal(JSON.stringify(packet).includes('"expected"'), false);
    assert.ok(packet.images.every((image) => Object.keys(image).sort().join(',') === 'id,path'));
    if (entry.componentId === 'documents') {
      assert.equal(JSON.stringify(packet).includes('Receipt R-204:'), false);
      assert.equal(JSON.stringify(packet).includes('149.50'), false);
      assert.equal(JSON.stringify(packet).includes('202.60'), false);
      assert.equal(JSON.stringify(packet).includes('19.75'), false);
    }
  }
  const cloned = syntheticPublicPacket(task('original-work-01'));
  cloned.sourceTexts[0]!.text = 'tampered';
  cloned.answerFormat.may_expense_usd = 'tampered';
  assert.notEqual(task('original-work-01').sourceTexts[0]!.text, 'tampered');
  assert.notEqual(task('original-work-01').answerFormat.may_expense_usd, 'tampered');
});

test('purchase oracle is recomputed from the actual rendered PO, invoice and receipt rows', () => {
  const text = lines('original-documents-01');
  const orders = new Map<string, { quantity: number; price: number }>();
  const bills = new Map<string, number>();
  const receipt = new Map<string, number>();
  let invoice = false;
  for (const line of text) {
    if (line.startsWith('Invoice I-908')) invoice = true;
    const row = /^(AX7|BX2|CX8)\s+(\d+)\s+(\d+\.\d+)$/.exec(line);
    if (row) {
      if (invoice) bills.set(row[1]!, Number(row[2]));
      else orders.set(row[1]!, { quantity: Number(row[2]), price: Number(row[3]) });
    }
    const receiving = /^Receipt R-204: (\w+) \| delivered (\d+) \| returned (\d+)$/.exec(line);
    if (receiving) receipt.set(receiving[1]!, Number(receiving[2]) - Number(receiving[3]));
  }
  assert.equal(orders.size, 3);
  assert.equal(bills.size, 3);
  assert.equal(receipt.size, 3);
  let subtotal = 0;
  const quantities: Record<string, number> = {};
  const rejected: string[] = [];
  for (const [sku, order] of orders) {
    const accepted = Math.min(order.quantity, bills.get(sku)!, receipt.get(sku)!);
    quantities[`${sku.toLowerCase()}_quantity`] = accepted;
    subtotal += accepted * order.price;
    if (bills.get(sku)! > accepted) rejected.push(`${sku}:${bills.get(sku)! - accepted}`);
  }
  subtotal = roundCents(subtotal);
  const discount = roundCents(subtotal * 0.02);
  const tax = roundCents((subtotal - discount) * 0.08);
  const receiptLine = text.find((line) => line.startsWith('Receipt R-204: CX8'));
  assert.equal(receiptLine, 'Receipt R-204: CX8 | delivered 2 | returned 0');
  assert.deepEqual(task('original-documents-01').expected, {
    ...quantities, rejected_billed: rejected.sort(), goods_subtotal_usd: subtotal,
    discount_usd: discount, tax_usd: tax, payable_usd: roundCents(subtotal - discount + tax + 12), receipt_line: receiptLine,
  });
});

test('manifest oracle joins seals/releases, applies signed overrides and includes equality boundary', () => {
  const text = lines('original-documents-02');
  const crates = text.flatMap((line) => {
    const match = /^(M\d+)\s+(EAST|WEST)\s+([\d.]+)\s+([\d.]+)\s+(YES|NO)\s+(\w+)$/.exec(line);
    return match ? [{ id: match[1]!, destination: match[2], gross: Number(match[3]), tare: Number(match[4]), sealed: match[5] === 'YES', seal: match[6] }] : [];
  });
  assert.equal(crates.length, 5);
  const releases = new Map(text.flatMap((line) => {
    const match = /^(M\d+)\s+(\w+)\s+(\d\d:\d\d:\d\d)\s+(APPROVED|NOT APPROVED)$/.exec(line);
    return match ? [[match[1]!, { seal: match[2], time: match[3]!, approved: match[4] === 'APPROVED' }] as const] : [];
  }));
  const withdrawals = new Set(text.flatMap((line) => /WITHDRAW (M\d+)/.exec(line)?.[1] ?? []));
  const correction = text.map((line) => /Correct (M\d+) gross mass to ([\d.]+) kg/.exec(line)).find(Boolean)!;
  const loaded = crates.filter((crate) => {
    const release = releases.get(crate.id)!;
    return crate.destination === 'EAST' && crate.sealed && release.approved && release.seal === crate.seal && release.time <= '09:00:00' && !withdrawals.has(crate.id);
  });
  const currentGross = (crate: typeof crates[number]) => crate.id === correction[1] ? Number(correction[2]) : crate.gross;
  assert.deepEqual(task('original-documents-02').expected, {
    loaded_crates: loaded.map((crate) => crate.id).sort(),
    loaded_gross_kg: roundCents(loaded.reduce((sum, crate) => sum + currentGross(crate), 0)),
    loaded_net_kg: roundCents(loaded.reduce((sum, crate) => sum + currentGross(crate) - crate.tare, 0)),
    excluded_east_crates: crates.filter((crate) => crate.destination === 'EAST' && !loaded.includes(crate)).map((crate) => crate.id).sort(),
    exact_boundary_release_allowed: text.some((line) => line.includes('Exact equality is allowed.')),
    departure_utc: text.join('\n').match(/Departure: (\S+)\./)![1],
  });
});

test('calibration oracle recomputes signed corrections before tolerance and percent rounding', () => {
  const text = lines('original-documents-03');
  const points = text.flatMap((line) => {
    const match = /^([A-E])\s+([\d.]+)\s+([\d.]+)\s+([+-][\d.]+)$/.exec(line);
    return match ? [{ id: match[1]!, reference: Number(match[2]), raw: Number(match[3]), correction: Number(match[4]) }] : [];
  });
  assert.equal(points.length, 5);
  for (const line of text) {
    const replace = /^Point ([A-E]): replace (raw reading|correction) [+-]?[\d.]+ g with ([+-]?[\d.]+) g\.$/.exec(line);
    if (replace) {
      const point = points.find((candidate) => candidate.id === replace[1])!;
      if (replace[2] === 'raw reading') point.raw = Number(replace[3]);
      else point.correction = Number(replace[3]);
    }
  }
  const percent = (point: typeof points[number]) => Math.abs(point.raw + point.correction - point.reference) / point.reference * 100;
  const pass = points.filter((point) => Math.abs(point.raw + point.correction - point.reference) <= point.reference / 100);
  const fail = points.filter((point) => !pass.includes(point));
  assert.equal(points.find((point) => point.id === 'E')!.reference / 100, 20);
  assert.deepEqual(task('original-documents-03').expected, {
    passed_points: pass.map((point) => point.id).sort(), failed_points: fail.map((point) => point.id).sort(),
    adjusted_d_grams: points.find((point) => point.id === 'D')!.raw + points.find((point) => point.id === 'D')!.correction,
    adjusted_e_grams: points.find((point) => point.id === 'E')!.raw + points.find((point) => point.id === 'E')!.correction,
    maximum_error_percent: roundCents(Math.max(...points.map(percent))), release_allowed: fail.length === 0,
  });
});

test('expense oracle derives caps, duplicate rejection and refund from rendered evidence', () => {
  const text = lines('original-documents-04').join('\n');
  const money = (pattern: RegExp) => Number(text.match(pattern)![1]);
  const taxi = money(/E01\s+Taxi\s+([\d.]+)/);
  const mealPaid = money(/E02\s+Meal for 3 authorized people\s+([\d.]+)/);
  const people = money(/Meal for (\d+) authorized people/);
  const mealCap = money(/Meal limit is USD ([\d.]+)/);
  const railPaid = money(/E03\s+Rail ticket\s+([\d.]+)/);
  const refund = money(/refunded USD ([\d.]+)/);
  const nights = money(/Rooms: (\d+) nights/);
  const roomPrice = money(/nights x USD ([\d.]+)/);
  const roomCap = money(/Hotel room limit is USD ([\d.]+)/);
  const fee = money(/Mandatory municipal fee: USD ([\d.]+)/);
  const meal = Math.min(mealPaid, people * mealCap);
  const rail = railPaid - refund;
  const hotel = nights * Math.min(roomPrice, roomCap) + fee;
  assert.match(text, /E05\s+Parking\s+18.00\s+UNSIGNED/);
  assert.match(text, /E06: Taxi USD 42.60; signed duplicate copy of receipt E01/);
  assert.deepEqual(task('original-documents-04').expected, {
    allowed_meal_usd: roundCents(meal), allowed_train_usd: roundCents(rail), allowed_hotel_usd: roundCents(hotel),
    reimbursement_usd: roundCents(taxi + meal + rail + hotel), refund_usd: refund, excluded_receipts: ['E05', 'E06'],
  });
});

test('ledger oracle reconciles the control account and accrual true-up independently', () => {
  const text = task('original-work-01').sourceTexts[1]!.text;
  const number = (pattern: RegExp) => Number(text.match(pattern)![1]);
  const opening = number(/control USD (\d+)/);
  const priorEstimate = number(/April estimate EST-APR USD (\d+)/);
  const accrual = number(/S-MAY service May 31 USD (\d+)/);
  const currentInvoice = number(/I-MAY service May 28 USD (\d+)/);
  const credit = number(/CM-MAY credit USD (\d+)/);
  const prepaid = number(/ADV-JUN paid USD (\d+)/);
  const finalPrior = number(/FINAL-APR invoice June 2 USD (\d+)/);
  const payment = number(/PAY-OLD payment May 12 USD (\d+)/);
  const entries = [-priorEstimate, finalPrior, currentInvoice, -credit, accrual, -payment];
  const expense = accrual + currentInvoice - credit + finalPrior - priorEstimate;
  assert.equal(opening + entries.reduce((sum, value) => sum + value, 0) - expense, 2000);
  assert.deepEqual(task('original-work-01').expected, {
    may_expense_usd: expense, ending_payable_and_accrual_usd: opening + entries.reduce((sum, value) => sum + value, 0),
    june_prepaid_asset_usd: prepaid, prior_estimate_reversal_usd: -priorEstimate,
    april_trueup_expense_usd: finalPrior - priorEstimate, unbilled_may_accrual_usd: accrual,
    may_expense_evidence: ['CM-MAY', 'EST-APR', 'FINAL-APR', 'I-MAY', 'S-MAY'],
  });
});

test('vendor oracle independently prices required scope, tax bases and qualification', () => {
  const quotes = task('original-work-02').sourceTexts[1]!.text;
  const records = [...quotes.matchAll(/(Amber|Birch|Cedar): seat USD ([\d.]+) per seat\/month; setup USD (\d+); support USD (\d+) total; conversion USD (\d+) total; (?:one-time software )?credit USD (\d+); response (\d+) hours; launch (\d+) working days\./g)].map((match) => {
    const seat = Number(match[2]) * 100 * 6;
    const setup = Number(match[3]);
    const support = Number(match[4]);
    const conversion = Number(match[5]);
    const credit = Number(match[6]);
    const tax = roundCents((seat + setup - credit) / 10);
    return { name: match[1]!, tax, total: seat + setup + support + conversion - credit + tax, eligible: Number(match[7]) <= 4 && Number(match[8]) <= 12 };
  });
  assert.equal(records.length, 3);
  const eligible = records.filter((record) => record.eligible).sort((a, b) => a.total - b.total || a.name.localeCompare(b.name));
  const expected: SyntheticSelfRunTask['expected'] = {};
  for (const record of records) {
    expected[`${record.name.toLowerCase()}_total_usd`] = record.total;
    expected[`${record.name.toLowerCase()}_tax_usd`] = record.tax;
  }
  expected.eligible_order = eligible.map((record) => record.name);
  expected.ineligible_vendors = records.filter((record) => !record.eligible).map((record) => record.name).sort();
  expected.selected_vendor = eligible[0]!.name;
  expected.runner_up_gap_usd = eligible[1]!.total - eligible[0]!.total;
  assert.deepEqual(task('original-work-02').expected, expected);
});

test('schedule oracle enumerates every integer-hour allocation until the first feasible horizon', () => {
  const jobs = task('original-work-03').sourceTexts[1]!.text.split('\n').flatMap((line) => {
    const row = /^([A-F]) \| (\d+) \| (none|[A-F,]+) \| (YES|NO)$/.exec(line);
    return row ? [{ id: row[1]!, duration: Number(row[2]), predecessors: row[3] === 'none' ? [] : row[3]!.split(','), rig: row[4] === 'YES' }] : [];
  });
  assert.equal(jobs.length, 6);
  let best: number[] | undefined;
  let foundHorizon = 0;
  for (let horizon = 1; horizon <= 12 && !best; horizon++) {
    const crewUsage = Array<number>(horizon).fill(0);
    const rigUsage = Array<number>(horizon).fill(0);
    const starts: number[] = [];
    const search = (index: number): void => {
      if (index === jobs.length) {
        if (!best || starts.some((value, position) => value !== best![position] && starts.slice(0, position).every((prefix, p) => prefix === best![p]) && value < best![position]!)) best = [...starts];
        return;
      }
      const job = jobs[index]!;
      const earliest = Math.max(0, ...job.predecessors.map((id) => {
        const predecessor = jobs.findIndex((candidate) => candidate.id === id);
        return starts[predecessor]! + jobs[predecessor]!.duration;
      }));
      for (let start = earliest; start + job.duration <= horizon; start++) {
        const slots = Array.from({ length: job.duration }, (_, offset) => start + offset);
        if (slots.some((slot) => crewUsage[slot]! >= 2 || (job.rig && rigUsage[slot]! >= 1))) continue;
        for (const slot of slots) { crewUsage[slot] = crewUsage[slot]! + 1; if (job.rig) rigUsage[slot] = rigUsage[slot]! + 1; }
        starts.push(start); search(index + 1); starts.pop();
        for (const slot of slots) { crewUsage[slot] = crewUsage[slot]! - 1; if (job.rig) rigUsage[slot] = rigUsage[slot]! - 1; }
      }
    };
    search(0);
    if (best) foundHorizon = horizon;
  }
  assert.ok(best);
  const completion = Math.max(...jobs.map((job, index) => best![index]! + job.duration));
  assert.equal(completion, foundHorizon);
  const expected: SyntheticSelfRunTask['expected'] = Object.fromEntries(jobs.map((job, index) => [`start_${job.id.toLowerCase()}`, best![index]!]));
  expected.completion_hour = completion;
  expected.completion_utc = new Date(Date.parse('2027-07-12T08:00:00Z') + completion * 3600000).toISOString().replace('.000Z', 'Z');
  expected.rig_order = jobs.filter((job) => job.rig).sort((a, b) => best![jobs.indexOf(a)]! - best![jobs.indexOf(b)]!).map((job) => job.id);
  assert.deepEqual(task('original-work-03').expected, expected);
});

test('forecast oracle recomputes the signed bridge and complete unit/cost roll-forward', () => {
  const text = task('original-work-04').sourceTexts[1]!.text;
  const value = (pattern: RegExp) => Number(text.match(pattern)![1]);
  const aprilUnits = value(/April actual finished units (\d+)/);
  const mayUnits = value(/May actual finished units (\d+)/);
  const april = value(/April.*?reported cost USD (\d+)/) - value(/deposit USD (\d+)/);
  const may = value(/May actual.*?reported cost USD (\d+)/) - value(/supplier credit USD (\d+)/);
  const capacity = value(/June internal capacity (\d+)/);
  const demand = value(/The (\d+)-unit June demand/);
  const internalRate = value(/internal forecast cost USD (\d+)/);
  const externalRate = value(/outsourcing cost USD (\d+)/);
  const standard = Number(task('original-work-04').sourceTexts[0]!.text.match(/standard cost USD (\d+)/)![1]);
  const monthlyBudget = Number(task('original-work-04').sourceTexts[0]!.text.match(/Budget is (\d+) units/)![1]);
  const internal = Math.min(capacity, demand);
  const outsourced = demand - internal;
  const june = internal * internalRate + outsourced * externalRate;
  const volume = (aprilUnits + mayUnits - monthlyBudget * 2) * standard;
  const price = april + may - (aprilUnits + mayUnits) * standard;
  const quarter = april + may + june;
  assert.equal(volume + price, april + may - monthlyBudget * 2 * standard);
  assert.equal(aprilUnits + mayUnits + internal + outsourced, monthlyBudget * 3);
  assert.deepEqual(task('original-work-04').expected, {
    corrected_april_cost_usd: april, corrected_may_cost_usd: may, corrected_actual_cost_usd: april + may,
    through_may_budget_cost_usd: monthlyBudget * 2 * standard, volume_variance_usd: volume,
    price_variance_usd: price, actual_budget_variance_usd: volume + price, june_internal_units: internal,
    june_outsourced_units: outsourced, june_forecast_cost_usd: june,
    quarter_forecast_units: aprilUnits + mayUnits + demand, quarter_forecast_cost_usd: quarter,
    quarter_forecast_variance_usd: quarter - monthlyBudget * 3 * standard,
  });
});

test('local SVG-to-PNG rendering produces all eight readable-sized pages deterministically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'original-selfrun-raster-'));
  try {
    const first = await renderSyntheticTaskImages(join(directory, 'first'));
    const second = await renderSyntheticTaskImages(join(directory, 'second'));
    assert.equal(Object.keys(first).length, 4);
    for (const entry of tasks.filter((candidate) => candidate.componentId === 'documents')) {
      assert.equal(first[entry.id]!.length, 2);
      for (let index = 0; index < 2; index++) {
        const bytes = await readFile(first[entry.id]![index]!);
        assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        assert.equal(bytes.readUInt32BE(16), 1500);
        assert.equal(bytes.readUInt32BE(20), 1900);
        assert.ok(bytes.length > 20000);
        assert.equal(sha256(bytes), sha256(await readFile(second[entry.id]![index]!)));
      }
      assert.ok(syntheticPublicPacket(entry, first[entry.id]).images.every((image) => image.path.endsWith('.png')));
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
