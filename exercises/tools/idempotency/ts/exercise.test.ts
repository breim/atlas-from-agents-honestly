import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Attempt, Config, Ledger, Run, dispatch as DispatchFn, idempotencyKey as KeyFn } from './start.ts';

interface Case { id: string; attempts: Attempt[]; result: Run }
interface Fixture { chapter: string; config: Config; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const impl = await loadImpl<{ dispatch: typeof DispatchFn; idempotencyKey: typeof KeyFn }>(import.meta.url);
const { dispatch, idempotencyKey } = impl;

const empty = (): Ledger => ({ entries: {} });
const go = (entry: Case, attempts = entry.attempts, ledger = empty()) => dispatch(attempts, ledger, fixture.config);

const cases: Array<[string, string]> = [
  ['a-timeout-then-a-retry-moves-the-money-once', 'the third outcome is the common one'],
  ['the-model-repeating-itself-is-told-that-nothing-changed', 'never silent, for the model'],
  ['argument-order-does-not-change-the-key', 'an unstable serialization is an unstable key'],
  ['a-different-amount-is-a-different-operation', 'different, not repeated'],
  ['the-same-arguments-under-a-different-tool-are-a-different-operation', 'the tool name is in the key'],
  ['a-different-run-never-reuses-another-runs-key', 'scoped to one job'],
  ['a-rejected-call-records-nothing-so-a-corrected-one-proceeds', 'nothing happened, nothing recorded'],
  ['a-key-supplied-by-the-model-is-refused', 'keys come from your code'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('however many times it is asked for, each operation lands exactly once', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const landed = outcome.results.filter((result) => result.status === 'applied' || result.status === 'unknown');
    assert.equal(outcome.effects, landed.length, `${entry.id}: the effect count disagrees with the results`);
    assert.equal(
      Object.keys(outcome.ledger.entries).length,
      outcome.effects,
      `${entry.id}: the ledger disagrees with the effects`,
    );
    const keys = landed.map((result) => result.key);
    assert.equal(new Set(keys).size, keys.length, `${entry.id}: the same key landed twice`);
  }
});

test('repeating an attempt any number of times never adds an effect', () => {
  for (const entry of fixture.cases) {
    const once = go(entry);
    const thrice = go(entry, [...entry.attempts, ...entry.attempts, ...entry.attempts]);
    assert.equal(thrice.effects, once.effects, `${entry.id}: repetition moved the world again`);
    assert.deepEqual(thrice.ledger, once.ledger, `${entry.id}: repetition changed the ledger`);
  }
});

test('a repeat is told it was already applied, and is never silent', () => {
  for (const entry of fixture.cases) {
    for (const result of go(entry, [...entry.attempts, ...entry.attempts]).results) {
      if (result.status !== 'already-applied') continue;
      assert.ok(result.note !== null && result.note.length > 0, `${entry.id}: a dedup told the model nothing`);
      assert.ok(result.key !== null, `${entry.id}: a dedup reported no key`);
    }
  }
});

test('a timeout is recorded as landed, because that is the way it leans', () => {
  const entry = findCase<Case>(fixture, 'a-timeout-then-a-retry-moves-the-money-once');
  const outcome = go(entry);
  assert.equal(outcome.results[0].status, 'unknown', 'a timeout reported a certainty it does not have');
  assert.ok(outcome.results[0].key! in outcome.ledger.entries, 'a timeout was treated as if nothing happened');
  assert.equal(outcome.results[1].status, 'already-applied', 'the retry moved the money a second time');
  assert.equal(outcome.effects, 1, 'the money moved more than once');
});

test('the key is a function of the run, the tool and the arguments, and nothing else', () => {
  const base = { runId: 'run-1', tool: 'issue_credit', args: { accountId: '4471', amountCents: 100 } };
  const key = () => idempotencyKey(base.runId, base.tool, base.args, fixture.config.keyLength);
  assert.equal(key(), key(), 'the key is not stable');
  assert.equal(
    idempotencyKey(base.runId, base.tool, { amountCents: 100, accountId: '4471' }, fixture.config.keyLength),
    key(),
    'argument order changed the key',
  );
  assert.notEqual(idempotencyKey('run-2', base.tool, base.args, fixture.config.keyLength), key(), 'the run is not in the key');
  assert.notEqual(idempotencyKey(base.runId, 'reverse_credit', base.args, fixture.config.keyLength), key(), 'the tool is not in the key');
  assert.notEqual(
    idempotencyKey(base.runId, base.tool, { accountId: '4471', amountCents: 101 }, fixture.config.keyLength),
    key(),
    'the arguments are not in the key',
  );
  assert.equal(key().length, fixture.config.keyLength, 'the key is the wrong length');
});

test('every genuinely different operation gets its own key and its own effect', () => {
  for (const id of [
    'a-different-amount-is-a-different-operation',
    'the-same-arguments-under-a-different-tool-are-a-different-operation',
    'a-different-run-never-reuses-another-runs-key',
  ]) {
    const entry = findCase<Case>(fixture, id);
    const outcome = go(entry);
    assert.equal(outcome.effects, entry.attempts.length, `${id}: a distinct operation was deduplicated`);
    const keys = outcome.results.map((result) => result.key);
    assert.equal(new Set(keys).size, keys.length, `${id}: two distinct operations shared a key`);
  }
});

test('a call that never happened records nothing', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const result of outcome.results) {
      if (result.status !== 'rejected') continue;
      assert.ok(!(result.key! in outcome.ledger.entries), `${entry.id}: a rejected call took a key`);
    }
  }
});

test('a rejection leaves the key free, so the identical call may still land', () => {
  const entry = findCase<Case>(fixture, 'a-rejected-call-records-nothing-so-a-corrected-one-proceeds');
  const attempt = entry.attempts[0];
  const outcome = go(entry, [attempt, { ...attempt, id: 'again', transport: 'ok' as const }]);
  assert.equal(outcome.results[0].status, 'rejected');
  assert.equal(outcome.results[1].status, 'applied', 'a rejection consumed the key it never used');
  assert.equal(outcome.effects, 1);
  assert.equal(outcome.results[0].key, outcome.results[1].key, 'the same operation derived two keys');
});

test('a model-supplied key is refused and changes nothing', () => {
  const entry = findCase<Case>(fixture, 'a-key-supplied-by-the-model-is-refused');
  for (const reserved of fixture.config.reservedArgs) {
    const poisoned = entry.attempts.map((attempt) => ({ ...attempt, args: { ...attempt.args, [reserved]: 'made-up' } }));
    const outcome = go(entry, poisoned);
    assert.equal(outcome.effects, 0, `${reserved} was accepted and something happened`);
    for (const result of outcome.results) {
      assert.equal(result.status, 'refused', `${reserved} was accepted as an argument`);
      assert.equal(result.key, null, 'a refused call was given a key');
      assert.ok(
        fixture.config.reservedArgs.some((name) => result.note!.includes(name)),
        'the refusal did not name the offending argument',
      );
    }
  }
});

test('an existing ledger is honoured, so a second process cannot repeat the effect', () => {
  const entry = findCase<Case>(fixture, 'the-model-repeating-itself-is-told-that-nothing-changed');
  const first = go(entry, [entry.attempts[0]]);
  const second = go(entry, entry.attempts, first.ledger);
  assert.equal(second.effects, 0, 'a second process re-applied the effect');
  for (const result of second.results) {
    assert.equal(result.status, 'already-applied', 'a resumed run did not recognise its own work');
  }
});

test('the ledger only ever grows, and every entry names its run and tool', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const [key, record] of Object.entries(outcome.ledger.entries)) {
      assert.ok(key.length === fixture.config.keyLength, `${entry.id}: a key is the wrong length`);
      assert.ok(record.runId.length > 0 && record.tool.length > 0, `${entry.id}: an entry lost its provenance`);
      const owed = idempotencyKey(
        record.runId,
        record.tool,
        entry.attempts.find((attempt) => idempotencyKey(attempt.runId, attempt.tool, attempt.args, fixture.config.keyLength) === key)!.args,
        fixture.config.keyLength,
      );
      assert.equal(owed, key, `${entry.id}: an entry is filed under a key it does not derive`);
    }
  }
});
