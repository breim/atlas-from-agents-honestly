import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Run, Trace, record as RecordFn } from './start.ts';

interface Case { id: string; run: Run; drawBps: number; policy: Policy; result: Trace }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { record } = await loadImpl<{ record: typeof RecordFn }>(import.meta.url);
const go = (entry: Case, run = entry.run, draw = entry.drawBps, policy = entry.policy) => record(run, policy, draw);

const cases: Array<[string, string]> = [
  ['a-trace-that-answers-all-eight-questions', 'why, not just that it was wrong'],
  ['a-trace-missing-the-window-cannot-explain-the-decision', 'the expensive question'],
  ['a-truncation-flag-with-no-boundary-is-warned', 'a tool bug or a prompt bug'],
  ['a-payload-with-no-hash-neither-joins-nor-verifies', 'the join key and the integrity check'],
  ['a-run-with-no-correlation-id-joins-to-nothing', 'the business entity'],
  ['an-escalation-is-always-kept', 'keep the interesting'],
  ['an-outlier-is-always-kept', 'the same stratification as online evals'],
  ['a-boring-run-is-usually-dropped', 'sample the boring'],
  ['a-boring-run-inside-the-sample-is-kept', 'a small draw of the rest'],
  ['hundreds-of-spans-blow-the-backend-budget', 'an order of magnitude more'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('every one of the eight questions is required on its own', () => {
  const entry = findCase<Case>(fixture, 'a-trace-that-answers-all-eight-questions');
  for (const question of entry.policy.questions) {
    const stripped = entry.run.spans.map((span) => ({
      ...span,
      fields: Object.fromEntries(Object.entries(span.fields).filter(([name]) => name !== question)),
    }));
    const outcome = go(entry, { ...entry.run, spans: stripped });
    assert.equal(outcome.status, 'incomplete', `a trace with no ${question} was called answerable`);
    assert.deepEqual(outcome.unanswered, [question], `${question} was not the one reported`);
  }
});

test('an incomplete trace names exactly what it cannot answer', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const present = new Set(entry.run.spans.flatMap((span) => Object.keys(span.fields)));
    assert.deepEqual(
      outcome.unanswered,
      entry.policy.questions.filter((question) => !present.has(question)),
      `${entry.id}: the unanswered list is wrong`,
    );
    assert.equal(outcome.status === 'incomplete', outcome.unanswered.length > 0, entry.id);
  }
});

test('anything interesting is kept regardless of the draw', () => {
  const entry = findCase<Case>(fixture, 'a-boring-run-is-usually-dropped');
  for (const outcome of entry.policy.alwaysKeep) {
    for (const draw of [0, 5000, 9999]) {
      const kept = go(entry, { ...entry.run, outcome: outcome as Run['outcome'] }, draw);
      assert.equal(kept.sampled, true, `${outcome} was dropped at draw ${draw}`);
      assert.equal(kept.keptBecause, outcome, `${outcome} was kept for the wrong reason`);
    }
  }
});

test('an outlier is kept at the boundary, and a fast run is not', () => {
  const entry = findCase<Case>(fixture, 'a-boring-run-is-usually-dropped');
  const limit = entry.policy.outlierLatencyMs;
  for (const latencyMs of [limit - 1, limit, limit + 1]) {
    const outcome = go(entry, { ...entry.run, latencyMs }, 9999);
    assert.equal(outcome.sampled, latencyMs > limit, `latency ${latencyMs} against ${limit}`);
    if (latencyMs > limit) assert.equal(outcome.keptBecause, 'outlier', 'kept for the wrong reason');
  }
});

test('a boring run is kept exactly when the draw falls inside the rate', () => {
  const entry = findCase<Case>(fixture, 'a-boring-run-is-usually-dropped');
  const rate = entry.policy.sampleBps;
  for (const drawBps of [0, rate - 1, rate, rate + 1, 9999]) {
    const outcome = go(entry, entry.run, drawBps);
    assert.equal(outcome.sampled, drawBps < rate, `draw ${drawBps} against a rate of ${rate}`);
    assert.equal(outcome.keptBecause, drawBps < rate ? 'sampled' : 'dropped', `draw ${drawBps}`);
  }
});

test('sampling never changes whether the trace could answer the questions', () => {
  for (const entry of fixture.cases) {
    const kept = go(entry, entry.run, 0);
    const dropped = go(entry, entry.run, 9999);
    assert.deepEqual(kept.unanswered, dropped.unanswered, `${entry.id}: sampling moved the questions`);
    assert.equal(kept.status, dropped.status, `${entry.id}: sampling moved the status`);
  }
});

test('a truncation flag without a boundary is warned about, and with one is not', () => {
  const entry = findCase<Case>(fixture, 'a-truncation-flag-with-no-boundary-is-warned');
  const outcome = go(entry);
  assert.ok(outcome.warnings.some((warning) => warning.includes('truncated')), 'the missing boundary was silent');
  const bounded = entry.run.spans.map((span) =>
    span.fields.resultTruncated === true ? { ...span, fields: { ...span.fields, truncatedAtBytes: 4000 } } : span,
  );
  assert.deepEqual(go(entry, { ...entry.run, spans: bounded }).warnings, [], 'a bounded truncation still warned');
});

test('every stored payload carries a hash, and an empty one needs none', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const span of entry.run.spans) {
      const owed = span.payloadBytes > 0 && span.contentHash === null;
      assert.equal(
        outcome.warnings.some((warning) => warning.startsWith(`${span.id} stores a payload`)),
        owed,
        `${entry.id}: ${span.id} hash warning`,
      );
    }
  }
});

test('the backend holds metadata and the payload store holds the bytes', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const owed = entry.run.spans.reduce((total, span) => total + span.payloadBytes, 0);
    assert.equal(outcome.payloadBytes, owed, `${entry.id}: the payload total is wrong`);
    assert.equal(outcome.backendBytes, entry.run.spans.length * 200, `${entry.id}: the backend total is wrong`);
    if (owed > 0) assert.ok(outcome.payloadBytes > outcome.backendBytes, `${entry.id}: the split bought nothing`);
  }
});

test('a run with no correlation id is flagged, and one with an id is not', () => {
  const entry = findCase<Case>(fixture, 'a-run-with-no-correlation-id-joins-to-nothing');
  assert.ok(go(entry).warnings.some((warning) => warning.includes('correlation id')), 'the missing id was silent');
  const joined = go(entry, { ...entry.run, correlationId: 'ticket:8823' });
  assert.deepEqual(joined.warnings, [], 'a correlated run still warned');
});
