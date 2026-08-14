import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Reduced, State, Update, reduce as Reduce } from './start.ts';

interface Case {
  id: string;
  updates: Update[];
  result: Reduced;
}

const fixture = expected<{
  chapter: string;
  schema: Record<string, string>;
  state: State;
  cases: Case[];
}>(import.meta.url);
const { reduce } = await loadImpl<{ reduce: typeof Reduce }>(import.meta.url);

const run = (entry: Case) => reduce(fixture.state, entry.updates, fixture.schema);

const cases: Array<[string, string]> = [
  ['a-last-write-channel-takes-the-newest-value', 'last-write overwrites'],
  ['an-append-channel-accumulates', 'append adds rather than replaces'],
  ['two-parallel-writes-to-an-append-channel-both-survive', 'a superstep keeps both messages'],
  ['two-parallel-writes-to-a-last-channel-keep-the-newest', 'the same concurrency, the other answer'],
  ['a-max-channel-ignores-a-smaller-write', 'max does not go backwards'],
  ['a-write-to-an-undeclared-channel-is-rejected', 'the schema is a schema'],
  ['a-rejected-write-does-not-stop-the-others', 'one bad key is not a failed superstep'],
  ['no-updates-leave-the-state-alone', 'an empty superstep changes nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the input state is never mutated', () => {
  const snapshot = structuredClone(fixture.state);
  for (const entry of fixture.cases) run(entry);
  assert.deepEqual(fixture.state, snapshot);
});

test('no rejected channel ever appears in the new state', () => {
  for (const entry of fixture.cases) {
    const { state, rejected } = run(entry);
    for (const channel of rejected) {
      assert.ok(!(channel in state), `${entry.id}: ${channel} was rejected and written anyway`);
    }
  }
});

test('an untouched channel keeps its value', () => {
  for (const entry of fixture.cases) {
    const written = new Set(entry.updates.map((update) => update.channel));
    const { state } = run(entry);
    for (const channel of Object.keys(fixture.schema)) {
      if (written.has(channel)) continue;
      assert.deepEqual(state[channel], fixture.state[channel], `${entry.id}: ${channel} drifted`);
    }
  }
});

test('an append channel never loses a write', () => {
  for (const entry of fixture.cases) {
    const appended = entry.updates.filter((u) => fixture.schema[u.channel] === 'append');
    const { state } = run(entry);
    for (const update of appended) {
      const channel = state[update.channel] as unknown[];
      assert.ok(channel.includes(update.value), `${entry.id}: lost ${update.value}`);
    }
  }
});

test('a max channel never decreases', () => {
  for (const entry of fixture.cases) {
    const { state } = run(entry);
    for (const [channel, reducer] of Object.entries(fixture.schema)) {
      if (reducer !== 'max') continue;
      assert.ok(
        (state[channel] as number) >= (fixture.state[channel] as number),
        `${entry.id}: ${channel} went backwards`,
      );
    }
  }
});
