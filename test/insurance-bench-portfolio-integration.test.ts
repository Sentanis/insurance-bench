import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePortfolioCases } from '../insurance-bench/portfolio-cases.ts';
import { createEnvironment, publicTask } from '../insurance-bench/tools.ts';
import { gradeTask } from '../insurance-bench/score.ts';
import { solvePlanning } from '../insurance-bench/planning.ts';

test('portfolio outcomes require actual reservations, never a prose claim of completion', () => {
  const task = generatePortfolioCases()[0]!, env = createEnvironment(task);
  assert.equal('planning' in publicTask(task), false);
  assert.equal('rubric' in publicTask(task), false);
  for (const source of task.documents) env.execute('read_document', { documentId: source.id });
  const citations = Object.entries(task.rubric.facts).flatMap(([factKey, fact]) => {
    const documents = new Set(fact.evidence.map((proof) => proof.documentId));
    return [...documents].map((documentId) => ({ factKey, documentId,
      quote: task.documents.find((source) => source.id === documentId)!.text }));
  });
  env.execute('save_work_product', { facts: Object.fromEntries(Object.entries(task.rubric.facts).map(([key, value]) => [key, value.value])), citations,
    memo: 'This deadline portfolio is fully reserved according to the source constraints. It still requires human review before any insurance decision or external action occurs.' });
  env.execute('create_follow_up', task.rubric.followUp);
  env.execute('propose_workflow', { ...task.rubric.workflow, reason: 'The source-defined critical review plan requires human review and signed authority.' });
  assert.equal(gradeTask(task, env.state).score, 0);
  const optimum = solvePlanning(task.planning);
  for (const booking of optimum.bookings) assert.equal('error' in (env.execute('schedule_review', booking) as object), false);
  assert.equal(gradeTask(task, env.state).score, 100);
  assert.equal(gradeTask(task, env.state).allPass, true);
  const before = structuredClone(env.state.reviewBookings);
  const rejected = env.execute('schedule_review', { jobId: task.planning.jobs[0]!.id, reviewer: 'outsider', startSlot: 0 });
  assert.ok('error' in (rejected as object));
  assert.deepEqual(env.state.reviewBookings, before);
  assert.equal(gradeTask(task, env.state).score, 100);
  const snapshot = JSON.stringify(env.execute('list_schedule', {}));
  assert.equal(snapshot.includes('optimalValue'), false);
});
