import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Escalation, Rung, escalate as Escalate } from './start.ts';

interface Case {
  id: string;
  kind: string;
  outcomes: string[];
  result: Escalation;
}

const fixture = expected<{ chapter: string; ladder: Rung[]; cases: Case[] }>(import.meta.url);
const { escalate } = await loadImpl<{ escalate: typeof Escalate }>(import.meta.url);

const run = (entry: Case) => escalate(entry.kind, fixture.ladder, entry.outcomes);

const cases: Array<[string, string]> = [
  ['enters-at-the-cheapest-capable-rung', 'the cheapest thing that could work goes first'],
  ['skips-rungs-that-cannot-handle-the-request', 'an incapable rung is skipped, not failed'],
  ['climbs-one-rung-on-failure', 'a failure escalates by exactly one'],
  ['climbs-until-something-resolves', 'the ladder keeps climbing while it can'],
  ['the-top-rung-failing-ends-unresolved', 'the top rung has nowhere to escalate'],
  ['every-rung-failing-ends-unresolved', 'failed attempts still cost what they cost'],
  ['a-request-nothing-handles-never-starts', 'no capable rung means no attempt'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the path never descends the ladder', () => {
  const order = new Map(fixture.ladder.map((rung, index) => [rung.rung, index]));
  for (const entry of fixture.cases) {
    const path = run(entry).path;
    for (let i = 1; i < path.length; i += 1) {
      assert.ok(order.get(path[i])! > order.get(path[i - 1])!, `${entry.id}: the ladder descended`);
    }
  }
});

test('every rung on the path can actually handle the request', () => {
  for (const entry of fixture.cases) {
    for (const name of run(entry).path) {
      const rung = fixture.ladder.find((candidate) => candidate.rung === name)!;
      assert.ok(rung.handles.includes(entry.kind), `${entry.id}: ${name} cannot handle ${entry.kind}`);
    }
  }
});

test('cost is the sum of every rung attempted', () => {
  for (const entry of fixture.cases) {
    const { path, cost } = run(entry);
    const expectedCost = path.reduce(
      (sum, name) => sum + fixture.ladder.find((rung) => rung.rung === name)!.cost,
      0,
    );
    assert.equal(cost, expectedCost, `${entry.id}: cost does not match the path`);
  }
});
