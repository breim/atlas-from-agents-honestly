import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Call, Dispatch, Policy, Tool, dispatch as DispatchFn } from './start.ts';

interface Case { id: string; calls: Call[]; result: Dispatch }
interface Fixture { chapter: string; policy: Policy; catalogue: Tool[]; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { dispatch } = await loadImpl<{ dispatch: typeof DispatchFn }>(import.meta.url);

const go = (entry: Case, calls = entry.calls) => dispatch(calls, fixture.catalogue, fixture.policy);
const toolOf = (name: string) => fixture.catalogue.find((tool) => tool.name === name);

const cases: Array<[string, string]> = [
  ['reads-run-together-and-writes-run-one-at-a-time', 'different risk, different dispatch'],
  ['a-write-that-fails-stops-the-writes-behind-it', 'a state no tool_result describes'],
  ['a-read-that-fails-does-not-stop-the-other-reads', 'a wrong read costs a turn'],
  ['a-write-that-takes-a-filter-is-refused', 'a filter is a program'],
  ['an-amount-over-the-ceiling-is-refused-by-the-handler', 'maximum is prose, code is a bound'],
  ['only-a-pure-read-is-cacheable-and-freely-retriable', 'the axis is who else has seen it'],
  ['a-catalogue-names-its-disguises-whether-or-not-anything-is-called', 'read the handlers'],
  ['a-tool-that-is-not-in-the-catalogue-is-refused-without-blocking-anything', 'unknown is not a write'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('every read is attempted, whatever any other read did', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const call of entry.calls) {
      const rank = toolOf(call.name)?.class ?? 0;
      if (rank > 2) continue;
      assert.ok(outcome.order.includes(call.id), `${entry.id}: ${call.id} was a read and was not attempted`);
      assert.ok(!outcome.skipped.includes(call.id), `${entry.id}: a read was skipped`);
    }
  }
});

test('every read runs before every write', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const rankOf = (id: string) => outcome.results.find((item) => item.id === id)!.class;
    const positions = outcome.order.map((id) => (rankOf(id) >= 3 ? 1 : 0));
    assert.deepEqual([...positions].sort(), positions, `${entry.id}: a write was dispatched before a read`);
  }
});

test('no write is ever marked parallel, and every pure read is', () => {
  for (const entry of fixture.cases) {
    for (const outcome of go(entry).results) {
      assert.equal(outcome.parallel, outcome.class >= 1 && outcome.class <= 2, `${entry.id}: ${outcome.id} parallelism`);
      if (outcome.class >= 3) assert.equal(outcome.parallel, false, `${entry.id}: a write was run in parallel`);
    }
  }
});

test('after a write fails, no later write is attempted', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const failed = outcome.results.find((item) => item.status === 'error' && item.class >= 3);
    const writes = entry.calls.filter((call) => (toolOf(call.name)?.class ?? 0) >= 3);
    if (!failed) {
      assert.deepEqual(outcome.skipped, [], `${entry.id}: something was skipped without a failure`);
      continue;
    }
    const after = writes.slice(writes.findIndex((call) => call.id === failed.id) + 1).map((call) => call.id);
    assert.deepEqual(outcome.skipped, after, `${entry.id}: the wrong writes were skipped`);
    for (const id of after) {
      assert.ok(!outcome.order.includes(id), `${entry.id}: ${id} was attempted after a failure`);
    }
  }
});

test('a failing read never stops anything', () => {
  const entry = findCase<Case>(fixture, 'a-read-that-fails-does-not-stop-the-other-reads');
  const outcome = go(entry);
  assert.ok(outcome.results.some((item) => item.status === 'error'), 'the fixture no longer fails a read');
  assert.deepEqual(outcome.skipped, [], 'a failing read skipped something');
  assert.equal(outcome.order.length, entry.calls.length, 'a failing read stopped a sibling');
});

test('every call is attempted or skipped, exactly once', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.deepEqual(
      [...outcome.order, ...outcome.skipped].sort(),
      entry.calls.map((call) => call.id).sort(),
      `${entry.id}: a call was lost or handled twice`,
    );
    assert.deepEqual(outcome.results.map((item) => item.id), outcome.order, `${entry.id}: results disagree with order`);
  }
});

test('a write that names a filter is always refused, whatever it is called', () => {
  const filtered = fixture.catalogue.filter(
    (tool) => tool.class >= 3 && tool.arguments.some((argument) => argument.kind === 'filter'),
  );
  assert.ok(filtered.length > 0, 'the fixture no longer has a filter-taking write');
  const entry = fixture.cases[0];
  for (const tool of filtered) {
    const outcome = go(entry, [{ id: 'probe', name: tool.name, input: {} }]);
    assert.equal(outcome.results[0].status, 'error', `${tool.name} accepted a filter`);
    assert.ok(outcome.results[0].reason!.includes('filter'), `${tool.name} was refused without saying why`);
  }
});

test('the ceiling is enforced at the boundary, not one either side of it', () => {
  const entry = fixture.cases[0];
  const bounded = fixture.catalogue.find((tool) => tool.ceiling !== undefined)!;
  const amount = bounded.arguments.find((argument) => argument.kind === 'amount')!;
  for (const value of [bounded.ceiling! - 1, bounded.ceiling!, bounded.ceiling! + 1]) {
    const input: Record<string, string | number> = { [amount.name]: value };
    for (const other of bounded.arguments) if (other.kind === 'identifier') input[other.name] = 'x';
    const outcome = go(entry, [{ id: 'probe', name: bounded.name, input }]);
    assert.equal(
      outcome.results[0].status === 'error',
      value > bounded.ceiling!,
      `${value} against a ceiling of ${bounded.ceiling} was judged wrongly`,
    );
  }
});

test('only a pure read is cacheable, and retry follows the class', () => {
  for (const entry of fixture.cases) {
    for (const outcome of go(entry).results) {
      assert.equal(outcome.cacheable, outcome.class === 1, `${entry.id}: ${outcome.id} cacheability`);
      const tool = toolOf(outcome.name);
      const owed = outcome.class === 1 ? true : outcome.class <= 2 ? false : tool?.idempotent === true;
      assert.equal(outcome.retriable, owed, `${entry.id}: ${outcome.id} retriability`);
      if (outcome.class === 2) assert.equal(outcome.retriable, false, `${entry.id}: an observed read was retriable`);
    }
  }
});

test('the audit names every read-shaped tool that is not a pure read', () => {
  for (const entry of fixture.cases) {
    const owed = fixture.catalogue
      .filter((tool) => tool.class >= 2 && fixture.policy.readPrefixes.some((prefix) => tool.name.startsWith(prefix)))
      .map((tool) => tool.name);
    assert.deepEqual(go(entry).mislabelled, owed, `${entry.id}: the disguise audit was wrong`);
    assert.ok(owed.length > 0, 'the fixture no longer has a disguised tool');
  }
});

test('the audit is a property of the catalogue, not of the calls', () => {
  const audits = fixture.cases.map((entry) => JSON.stringify(go(entry).mislabelled));
  assert.equal(new Set(audits).size, 1, 'the disguise audit moved with the calls');
});
