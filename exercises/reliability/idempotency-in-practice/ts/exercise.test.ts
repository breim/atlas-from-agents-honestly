import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Attempt, Config, Outcome, Store, attempt as AttemptFn } from './start.ts';

interface Case { id: string; request: Attempt; store: Store; config: Config; result: Outcome }
interface Fixture { chapter: string; config: Config; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { attempt } = await loadImpl<{ attempt: typeof AttemptFn }>(import.meta.url);
const go = (entry: Case, request = entry.request, store = entry.store, config = entry.config) =>
  attempt(request, store, config);

const cases: Array<[string, string]> = [
  ['a-first-attempt-lands-the-effect-and-the-record-together', 'one transaction'],
  ['a-repeat-of-a-done-key-changes-nothing', 'effectively once'],
  ['a-concurrent-duplicate-waits-on-the-in-flight-row', 'three states, not two'],
  ['an-expired-lease-lets-the-next-worker-proceed', 'a dead worker must not deadlock the key'],
  ['a-failure-provably-before-the-effect-is-retryable', 'provably before'],
  ['a-timeout-is-not-provably-before-the-effect', 'the paired read, or escalate'],
  ['a-timeout-now-records-that-the-effect-may-have-landed', 'unknown leans toward it happened'],
  ['a-rejection-before-the-effect-leaves-the-key-retryable', 'nothing happened, nothing consumed'],
  ['an-external-effect-goes-through-the-outbox', 'commit the intent with the record'],
  ['a-window-shorter-than-the-approval-pause-is-unsound', 'the window is the bug'],
  ['a-lease-shorter-than-the-slowest-call-is-unsound', 'expiring early causes the duplicate'],
  ['a-store-that-is-not-durable-is-unsound', 'more durable than what repeats the call'],
  ['a-marker-and-a-write-in-different-stores-is-unsound', 'the crash gap, reintroduced'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('an unsound store never touches the world', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'unsound') continue;
    assert.equal(outcome.effects, 0, `${entry.id}: an unsound store applied an effect`);
    assert.deepEqual(outcome.outbox, [], `${entry.id}: an unsound store queued an intent`);
    assert.deepEqual(outcome.store.rows, entry.store.rows, `${entry.id}: an unsound store wrote a row`);
  }
});

test('the window must outlast the approval pause, at the boundary', () => {
  const entry = findCase<Case>(fixture, 'a-first-attempt-lands-the-effect-and-the-record-together');
  const pause = entry.config.approvalPauseMs;
  for (const windowMs of [pause - 1, pause, pause + 1]) {
    const outcome = go(entry, entry.request, { ...entry.store, windowMs });
    assert.equal(outcome.status === 'unsound', windowMs < pause, `window ${windowMs} against pause ${pause}`);
  }
  const day = go(entry, entry.request, { ...entry.store, windowMs: 86_400_000 });
  assert.equal(day.status, 'unsound', 'the 24-hour convention was accepted for a three-day pause');
});

test('the lease must outlast the slowest call, at the boundary', () => {
  const entry = findCase<Case>(fixture, 'a-first-attempt-lands-the-effect-and-the-record-together');
  const lease = entry.config.leaseMs;
  for (const slowestCallMs of [lease - 1, lease, lease + 1]) {
    const outcome = go(entry, { ...entry.request, slowestCallMs });
    assert.equal(outcome.status === 'unsound', slowestCallMs > lease, `call ${slowestCallMs} against lease ${lease}`);
  }
});

test('durability and atomicity are both required', () => {
  const entry = findCase<Case>(fixture, 'a-first-attempt-lands-the-effect-and-the-record-together');
  for (const field of ['durable', 'transactional'] as const) {
    const outcome = go(entry, entry.request, { ...entry.store, [field]: false });
    assert.equal(outcome.status, 'unsound', `a store that is not ${field} was accepted`);
    assert.equal(outcome.effects, 0, `a store that is not ${field} still applied`);
  }
});

test('a done key never applies again, whatever arrives', () => {
  const entry = findCase<Case>(fixture, 'a-repeat-of-a-done-key-changes-nothing');
  for (const outcomeKind of ['ok', 'timeout', 'rejected-before-effect'] as const) {
    const result = go(entry, { ...entry.request, outcome: outcomeKind });
    assert.equal(result.status, 'deduplicated', `${outcomeKind} got past a DONE row`);
    assert.equal(result.effects, 0, `${outcomeKind} applied against a DONE row`);
  }
});

test('an in-flight row makes a duplicate wait until the lease expires', () => {
  const entry = findCase<Case>(fixture, 'a-concurrent-duplicate-waits-on-the-in-flight-row');
  const until = entry.store.rows[entry.request.key].leaseUntilMs;
  for (const atMs of [until - 1, until, until + 1]) {
    const outcome = go(entry, { ...entry.request, atMs });
    assert.equal(outcome.status === 'waited', atMs < until, `at ${atMs} against a lease to ${until}`);
    assert.equal(outcome.effects, atMs < until ? 0 : 1, `at ${atMs}: effects`);
  }
});

test('a failed row is retried only when the failure was provably before the effect', () => {
  const entry = findCase<Case>(fixture, 'a-failure-provably-before-the-effect-is-retryable');
  for (const failedBefore of [true, false]) {
    const store = {
      ...entry.store,
      rows: { [entry.request.key]: { ...entry.store.rows[entry.request.key], failedBefore } },
    };
    const outcome = go(entry, entry.request, store);
    assert.equal(outcome.status, failedBefore ? 'applied' : 'escalated', `failedBefore ${failedBefore}`);
    assert.equal(outcome.effects, failedBefore ? 1 : 0, `failedBefore ${failedBefore}: effects`);
  }
});

test('a timeout records that the effect may have landed, and never claims it did not', () => {
  const entry = findCase<Case>(fixture, 'a-timeout-now-records-that-the-effect-may-have-landed');
  const outcome = go(entry);
  const row = outcome.store.rows[entry.request.key];
  assert.equal(row.state, 'FAILED', 'a timeout was recorded as done');
  assert.equal(row.failedBefore, false, 'a timeout claimed the effect did not land');
  assert.equal(outcome.effects, 1, 'a timeout was counted as no effect');
  const retried = go(entry, { ...entry.request, atMs: 999_999 }, { ...entry.store, rows: outcome.store.rows });
  assert.equal(retried.status, 'escalated', 'a timed-out key was retried automatically');
});

test('a rejection before the effect leaves the key free to try again', () => {
  const entry = findCase<Case>(fixture, 'a-rejection-before-the-effect-leaves-the-key-retryable');
  const outcome = go(entry);
  assert.equal(outcome.effects, 0, 'a rejection applied something');
  assert.equal(outcome.store.rows[entry.request.key].failedBefore, true, 'a rejection was recorded as uncertain');
  const again = go(entry, { ...entry.request, atMs: 999_999, outcome: 'ok' }, { ...entry.store, rows: outcome.store.rows });
  assert.equal(again.status, 'applied', 'a corrected retry was refused');
  assert.equal(again.effects, 1, 'a corrected retry did nothing');
});

test('an external effect commits an intent rather than the effect', () => {
  const entry = findCase<Case>(fixture, 'an-external-effect-goes-through-the-outbox');
  const outcome = go(entry);
  assert.equal(outcome.effects, 0, 'an external effect was applied inside the transaction');
  assert.deepEqual(outcome.outbox, [`${entry.request.key}:${entry.request.effect}`], 'the intent was not queued');
  assert.equal(outcome.store.rows[entry.request.key].state, 'IN_FLIGHT', 'the outbox row was marked done');
  const local = go(entry, { ...entry.request, external: false });
  assert.equal(local.effects, 1, 'a local effect went through the outbox');
  assert.deepEqual(local.outbox, [], 'a local effect queued an intent');
});

test('every path leaves exactly one row for the key, in a legal state', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'unsound' || outcome.status === 'deduplicated' || outcome.status === 'waited') continue;
    const row = outcome.store.rows[entry.request.key];
    assert.ok(row, `${entry.id}: no row was written`);
    assert.ok(['IN_FLIGHT', 'DONE', 'FAILED'].includes(row.state), `${entry.id}: illegal state ${row.state}`);
    assert.equal(row.key, entry.request.key, `${entry.id}: the row is filed under the wrong key`);
  }
});
