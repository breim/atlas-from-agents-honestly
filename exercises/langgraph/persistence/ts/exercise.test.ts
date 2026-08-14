import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Graph, Run, Store, Thread, execute as Execute } from './start.ts';

interface Case {
  id: string;
  graph: string;
  config?: Config;
  thread: Thread;
  result: Run;
}

interface Fixture {
  chapter: string;
  config: Config;
  graphs: Record<string, Graph>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { execute } = await loadImpl<{ execute: typeof Execute }>(import.meta.url);

const graphOf = (entry: Case) => fixture.graphs[entry.graph];
const configOf = (entry: Case) => entry.config ?? fixture.config;
const empty = (): Store => ({ effects: {} });
const go = (entry: Case, thread = entry.thread, store = empty(), config = configOf(entry)) =>
  execute(graphOf(entry), thread, store, config);

const cases: Array<[string, string]> = [
  ['a-crash-mid-node-re-runs-every-effect-in-it', 'the checkpoint boundary is the node boundary'],
  ['a-random-key-generated-inside-the-node-defeats-the-mechanism', 'two refunds'],
  ['an-interrupt-re-executes-everything-else-in-the-node', 'the double-execution problem'],
  ['one-call-per-node-means-a-resume-cannot-double-fire-anything-else', 'the cheap structural fix'],
  ['a-checkpoint-is-written-between-nodes-not-inside-them', 'earlier nodes are not re-run'],
  ['a-crashed-run-nobody-resumes-is-durable-and-permanently-stopped', 'durable is not finished'],
  ['a-worker-without-the-lease-does-not-resume-the-thread', 'yours to build'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a crash re-runs the whole node it crashed in, from the first effect', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const crash of entry.thread.crashes) {
      if (outcome.status === 'stopped') continue;
      const visits = outcome.path.filter((name) => name === crash.node).length;
      assert.ok(visits >= 2, `${entry.id}: ${crash.node} crashed and was never re-entered`);
      const first = graphOf(entry).nodes.find((node) => node.name === crash.node)!.effects[0];
      const ran = outcome.applied.filter((item) => item.node === crash.node && item.effect === first.name).length;
      assert.ok(ran >= 2, `${entry.id}: the node resumed part-way instead of from the top`);
    }
  }
});

test('a node that completed before the crash is never re-entered', () => {
  const entry = findCase<Case>(fixture, 'a-checkpoint-is-written-between-nodes-not-inside-them');
  const outcome = go(entry);
  const crashed = entry.thread.crashes[0].node;
  for (const node of graphOf(entry).nodes) {
    if (node.name === crashed) continue;
    assert.equal(
      outcome.path.filter((name) => name === node.name).length,
      1,
      `${node.name} re-ran even though its checkpoint had landed`,
    );
  }
});

test('a checkpoint exists for every node that finished, and for none that did not', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(new Set(outcome.checkpoints).size, outcome.checkpoints.length, `${entry.id}: a node checkpointed twice`);
    for (const name of outcome.checkpoints) {
      assert.ok(outcome.path.includes(name), `${entry.id}: checkpointed a node that never ran`);
    }
    if (outcome.status === 'stopped') {
      assert.ok(!outcome.checkpoints.includes(outcome.path.at(-1) as string), `${entry.id}: checkpointed the crash`);
    }
    if (outcome.status === 'completed') {
      assert.equal(outcome.checkpoints.length, graphOf(entry).nodes.length, `${entry.id}: a node never checkpointed`);
    }
  }
});

test('a deterministic key survives replay and a random one does not', () => {
  const keyed = findCase<Case>(fixture, 'a-crash-mid-node-re-runs-every-effect-in-it');
  const random = findCase<Case>(fixture, 'a-random-key-generated-inside-the-node-defeats-the-mechanism');
  const safe = go(keyed);
  const unsafe = go(random);

  assert.deepEqual(safe.duplicated, [], 'a deterministic key still duplicated an effect');
  assert.deepEqual(unsafe.duplicated, ['post_refund'], 'a random key did not duplicate anything');

  const refunds = (outcome: Run) => Object.keys(outcome.store.effects).filter((key) => key.includes('post_refund'));
  assert.equal(refunds(safe).length, 1, 'the payments provider saw more than one refund');
  assert.equal(refunds(unsafe).length, 2, 'the fixture no longer shows the random key failing');
  assert.deepEqual(
    safe.path,
    unsafe.path,
    'the two runs took different paths, so the keys are not the only difference',
  );
});

test('no effect that landed twice is missing from duplicated', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const landed = outcome.applied.filter((item) => !item.deduped && item.key !== null);
    for (const item of landed) {
      const times = landed.filter((other) => other.effect === item.effect).length;
      assert.equal(
        times > 1,
        outcome.duplicated.includes(item.effect),
        `${entry.id}: ${item.effect} landed ${times} times and duplicated says otherwise`,
      );
    }
  }
});

test('a deduped effect never reaches the store a second time', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const count of Object.values(outcome.store.effects)) {
      assert.equal(count, 1, `${entry.id}: an idempotency key was applied more than once`);
    }
    const landed = outcome.applied.filter((item) => !item.deduped && item.key !== null).length;
    assert.equal(
      Object.keys(outcome.store.effects).length,
      landed,
      `${entry.id}: the store disagrees with what was applied`,
    );
  }
});

test('a read-only effect re-runs freely and never counts as a duplicate', () => {
  for (const entry of fixture.cases) {
    const graph = graphOf(entry);
    const readOnly = graph.nodes.flatMap((node) => node.effects.filter((effect) => effect.readOnly).map((e) => e.name));
    const outcome = go(entry);
    for (const name of readOnly) {
      assert.ok(!outcome.duplicated.includes(name), `${entry.id}: ${name} was counted as a duplicate`);
      for (const item of outcome.applied.filter((entry_) => entry_.effect === name)) {
        assert.equal(item.key, null, `${entry.id}: a read-only effect took an idempotency key`);
      }
    }
  }
});

test('an interrupt re-runs its node, and one call per node makes that harmless', () => {
  const inline = findCase<Case>(fixture, 'an-interrupt-re-executes-everything-else-in-the-node');
  const isolated = findCase<Case>(fixture, 'one-call-per-node-means-a-resume-cannot-double-fire-anything-else');
  const messy = go(inline);
  const clean = go(isolated);

  const approvals = (outcome: Run) => outcome.applied.filter((item) => item.key === null && item.effect.includes('approval'));
  assert.equal(approvals(messy).filter((item) => !item.deduped).length, 1, 'the approval was asked for twice');
  assert.equal(approvals(clean).filter((item) => !item.deduped).length, 1, 'the approval was asked for twice');

  assert.ok(messy.duplicated.length > 0, 'the inline approval no longer double-fires anything');
  assert.deepEqual(clean.duplicated, [], 'isolating the approval still double-fired something');
});

test('an approval is only ever answered once, however many times its node runs', () => {
  for (const entry of fixture.cases) {
    const graph = graphOf(entry);
    const approvals = graph.nodes.flatMap((node) => node.effects.filter((effect) => effect.approval).map((e) => e.name));
    const outcome = go(entry);
    for (const name of approvals) {
      const asked = outcome.applied.filter((item) => item.effect === name && !item.deduped).length;
      assert.equal(asked, 1, `${entry.id}: ${name} was asked ${asked} times`);
    }
  }
});

test('a refused run touches nothing at all', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry, { ...entry.thread, holdsLease: false }, empty(), {
      ...configOf(entry),
      requireLease: true,
    });
    assert.equal(outcome.status, 'refused', `${entry.id}: a leaseless worker resumed the thread`);
    assert.deepEqual(outcome.applied, [], `${entry.id}: a refused run applied an effect`);
    assert.deepEqual(outcome.path, [], `${entry.id}: a refused run entered a node`);
    assert.deepEqual(outcome.store.effects, {}, `${entry.id}: a refused run wrote to the store`);
  }
});

test('two workers sharing a store cannot land the same keyed effect twice', () => {
  const entry = findCase<Case>(fixture, 'a-crash-mid-node-re-runs-every-effect-in-it');
  const first = go(entry, { ...entry.thread, crashes: [] });
  const second = go(entry, { ...entry.thread, crashes: [] }, first.store);
  for (const count of Object.values(second.store.effects)) {
    assert.equal(count, 1, 'a concurrent resume applied a keyed effect twice');
  }
  assert.ok(
    second.applied.filter((item) => item.key !== null).every((item) => item.deduped),
    'the second worker re-applied an effect the first had already landed',
  );
});

test('a stopped run leaves its work half done and says so', () => {
  const entry = findCase<Case>(fixture, 'a-crashed-run-nobody-resumes-is-durable-and-permanently-stopped');
  const stopped = go(entry);
  const resumed = go(entry, entry.thread, empty(), { ...configOf(entry), autoResume: true });
  assert.equal(stopped.status, 'stopped');
  assert.equal(resumed.status, 'completed');
  assert.ok(stopped.checkpoints.length < resumed.checkpoints.length, 'a stopped run checkpointed everything');
  assert.ok(stopped.applied.length < resumed.applied.length, 'a stopped run did all the work anyway');
  assert.deepEqual(stopped.duplicated, [], 'stopping duplicated something');
});
