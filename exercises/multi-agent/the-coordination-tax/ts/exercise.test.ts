import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Agent, Baseline, Config, Priced, Topology, price as Price } from './start.ts';

interface Case {
  id: string;
  topology: Topology;
  result: Priced;
}

interface Fixture {
  chapter: string;
  config: Config;
  baseline: Baseline;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { price } = await loadImpl<{ price: typeof Price }>(import.meta.url);

const run = (topology: Topology) => price(topology, fixture.baseline, fixture.config);

const cases: Array<[string, string]> = [
  ['one-agent-pays-no-tax', 'nothing crossed a boundary'],
  ['two-agents-are-two-quadratics-not-one-halved', 'splitting multiplies the contexts'],
  ['fan-out-buys-latency-and-changes-no-tokens', 'the only refund available'],
  ['a-thin-margin-cannot-absorb-the-multiplier', 'parallel and still not worth it'],
  ['isolation-is-a-reason-that-does-not-need-parallelism', 'a security property, bought with tokens'],
  ['a-narrow-worker-cuts-the-multiplier', 'the catalogue it never uses'],
  ['a-topology-with-no-agents-costs-nothing', 'no agents, no tax'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.topology), entry.result);
  });
}

test('the totals are the sum of the agents', () => {
  for (const entry of fixture.cases) {
    const result = run(entry.topology);
    assert.equal(result.inputTokens, result.perAgent.reduce((sum, a) => sum + a.inputTokens, 0), entry.id);
    assert.equal(result.outputTokens, result.perAgent.reduce((sum, a) => sum + a.outputTokens, 0), entry.id);
    assert.equal(result.totalTokens, result.inputTokens + result.outputTokens, entry.id);
  }
});

test('an inbound summary is paid on every turn of the receiver', () => {
  for (const entry of fixture.cases) {
    entry.topology.agents.forEach((agent, index) => {
      const fatter = entry.topology.agents.map((candidate, position) =>
        position === index ? { ...candidate, inboundSummaryTokens: candidate.inboundSummaryTokens + 1000 } : candidate,
      );
      const after = run({ ...entry.topology, agents: fatter }).perAgent[index].inputTokens;
      const before = run(entry.topology).perAgent[index].inputTokens;
      assert.equal(after - before, 1000 * agent.turns, `${entry.id}: ${agent.name} read it once`);
    });
  }
});

test('an outbound summary is written once', () => {
  for (const entry of fixture.cases) {
    entry.topology.agents.forEach((agent, index) => {
      const wordier = entry.topology.agents.map((candidate, position) =>
        position === index
          ? { ...candidate, outboundSummaryTokens: candidate.outboundSummaryTokens + 1000 }
          : candidate,
      );
      const after = run({ ...entry.topology, agents: wordier }).perAgent[index];
      const before = run(entry.topology).perAgent[index];
      assert.equal(after.outputTokens - before.outputTokens, 1000, `${entry.id}: ${agent.name}`);
      assert.equal(after.inputTokens, before.inputTokens, `${entry.id}: writing it cost the writer input`);
    });
  }
});

test('adding an agent never lowers the bill', () => {
  for (const entry of fixture.cases) {
    const extra: Agent = {
      name: 'extra',
      prefixTokens: 5000,
      turns: 3,
      outputPerTurn: 100,
      inboundSummaryTokens: 400,
      outboundSummaryTokens: 200,
    };
    const bigger = run({ ...entry.topology, agents: [...entry.topology.agents, extra] });
    assert.ok(bigger.totalTokens > run(entry.topology).totalTokens, `${entry.id}: a free agent`);
  }
});

test('the token bill does not depend on whether the agents ran in parallel', () => {
  for (const entry of fixture.cases) {
    const serial = run({ ...entry.topology, parallel: false });
    const concurrent = run({ ...entry.topology, parallel: true });
    assert.equal(concurrent.totalTokens, serial.totalTokens, `${entry.id}: parallelism moved the tokens`);
    assert.equal(concurrent.costMicros, serial.costMicros, entry.id);
    assert.ok(concurrent.latencyMs <= serial.latencyMs, `${entry.id}: fan-out cost time`);
  }
});

test('the multiplier is the total against the stated baseline', () => {
  for (const entry of fixture.cases) {
    const { totalTokens, baselineTokens, multiplierBps } = run(entry.topology);
    const owed = baselineTokens === 0 ? 0 : Math.floor((totalTokens * 10000) / baselineTokens + 0.5);
    assert.equal(multiplierBps, owed, `${entry.id}: the comparison does not hold`);
  }
});

test('narrowing a prefix never raises the bill', () => {
  for (const entry of fixture.cases) {
    const lean = entry.topology.agents.map((agent) => ({ ...agent, prefixTokens: 0 }));
    assert.ok(
      run({ ...entry.topology, agents: lean }).totalTokens <= run(entry.topology).totalTokens,
      `${entry.id}: a smaller catalogue cost more`,
    );
  }
});

test('a single agent is always worth it, and more than one needs both conditions', () => {
  for (const entry of fixture.cases) {
    const result = run(entry.topology);
    if (entry.topology.agents.length <= 1) {
      assert.equal(result.worthIt, true, `${entry.id}: a lone agent was charged a tax`);
      assert.deepEqual(result.reasons, [], entry.id);
      continue;
    }
    const affordable = entry.topology.taskValueMicros >= result.costMicros;
    const justified = entry.topology.parallel || entry.topology.isolationRequired;
    assert.equal(result.worthIt, affordable && justified, `${entry.id}: ${result.reasons.join(', ')}`);
  }
});

test('both conditions are reported when both fail', () => {
  for (const entry of fixture.cases) {
    if (entry.topology.agents.length <= 1) continue;
    const doomed = run({ ...entry.topology, parallel: false, isolationRequired: false, taskValueMicros: 0 });
    assert.deepEqual(doomed.reasons, ['value_below_cost', 'not_parallel_and_no_isolation'], entry.id);
    assert.equal(doomed.worthIt, false, entry.id);
  }
});
