import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Design, Endpoint, Policy, Surface, surface as SurfaceFn } from './start.ts';

interface Case {
  id: string;
  design: Design[];
  result: Surface;
}

interface Fixture {
  chapter: string;
  policy: Policy;
  endpoints: Endpoint[];
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { surface } = await loadImpl<{ surface: typeof SurfaceFn }>(import.meta.url);

const go = (entry: Case, design = entry.design, policy = fixture.policy) =>
  surface(fixture.endpoints, design, policy);

const cases: Array<[string, string]> = [
  ['a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip', 'a tool is a job, not an endpoint'],
  ['an-identity-argument-is-rejected-however-it-is-named', 'the rule that has no exceptions'],
  ['a-field-no-endpoint-in-the-job-produces-is-rejected', 'a tool cannot return what it never fetched'],
  ['a-description-too-thin-to-route-on-is-rejected', 'the description is the interface'],
  ['a-tool-that-states-no-boundary-is-warned-not-rejected', 'say what it is not for'],
  ['wrapping-every-endpoint-one-to-one-buys-nothing', 'the step to skip'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a curated tool is never more expensive than the endpoints behind it', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.ok(outcome.curated.tokens <= outcome.generated.tokens, `${entry.id}: curation added tokens`);
    assert.ok(outcome.curated.roundTrips <= outcome.generated.roundTrips, `${entry.id}: curation added round trips`);
  }
});

test('consolidating a chain trades endpoints for round trips', () => {
  const entry = findCase<Case>(fixture, 'a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip');
  const outcome = go(entry);
  const tool = outcome.tools[0];
  assert.equal(tool.roundTrips, 1, 'a consolidated tool cost more than one round trip');
  assert.ok(tool.endpoints > 1, 'the fixture no longer consolidates anything');
  assert.ok(outcome.curated.tokens * 10 < outcome.generated.tokens, 'consolidation barely saved anything');
});

test('every tool costs exactly one round trip, however many endpoints it covers', () => {
  for (const entry of fixture.cases) {
    for (const tool of go(entry).tools) {
      assert.equal(tool.roundTrips, 1, `${entry.id}: ${tool.name} cost ${tool.roundTrips} round trips`);
      assert.ok(tool.endpoints >= 1, `${entry.id}: ${tool.name} covers no endpoint`);
    }
  }
});

test('no accepted tool takes an identity argument, under any policy', () => {
  for (const entry of fixture.cases) {
    for (const identity of fixture.policy.identityFields) {
      const poisoned = entry.design.map((design) => ({ ...design, args: [...design.args, identity] }));
      const outcome = go(entry, poisoned);
      assert.deepEqual(outcome.tools, [], `${entry.id}: ${identity} was accepted as an argument`);
      assert.equal(outcome.rejected.length, entry.design.length, `${entry.id}: a tool survived the identity check`);
      for (const rejection of outcome.rejected) {
        assert.ok(
          fixture.policy.identityFields.some((field) => rejection.reason.includes(field)),
          `${entry.id}: rejected without naming the offending identity field`,
        );
      }
    }
  }
});

test('an accepted tool only ever returns fields its own job produces', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const tool of outcome.tools) {
      const design = entry.design.find((item) => item.name === tool.name)!;
      const available = new Set(design.job.flatMap((id) => Object.keys(fixture.endpoints.find((e) => e.id === id)!.fields)));
      for (const field of tool.returns) {
        assert.ok(available.has(field), `${entry.id}: ${tool.name} returns ${field}, which it never fetched`);
      }
    }
  }
});

test('a tool is accepted or rejected, never both, and always exactly once', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const seen = [...outcome.tools.map((tool) => tool.name), ...outcome.rejected.map((item) => item.name)];
    assert.deepEqual(
      [...seen].sort(),
      entry.design.map((design) => design.name).sort(),
      `${entry.id}: a proposed tool was lost or judged twice`,
    );
    for (const item of outcome.rejected) {
      assert.ok(item.reason.length > 0, `${entry.id}: ${item.name} was rejected without a reason`);
      assert.ok(!outcome.tools.some((tool) => tool.name === item.name), `${entry.id}: ${item.name} was both`);
    }
  }
});

test('the totals are exactly the accepted tools, and nothing else', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.curated.toolCount, outcome.tools.length, entry.id);
    assert.equal(
      outcome.curated.tokens,
      outcome.tools.reduce((total, tool) => total + tool.tokens, 0),
      `${entry.id}: the curated total disagrees with its tools`,
    );
    const everything = fixture.endpoints.reduce(
      (total, endpoint) => total + Object.values(endpoint.fields).reduce((sum, cost) => sum + cost, 0),
      0,
    );
    assert.equal(outcome.generated.tokens, everything, `${entry.id}: the generated total is not the whole API`);
    assert.equal(outcome.generated.toolCount, fixture.endpoints.length, entry.id);
  }
});

test('the generated surface does not depend on what you designed', () => {
  const totals = fixture.cases.map((entry) => JSON.stringify(go(entry).generated));
  assert.equal(new Set(totals).size, 1, 'the auto-generated baseline moved with the design');
});

test('a thin description is rejected at exactly the declared threshold', () => {
  const entry = findCase<Case>(fixture, 'a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip');
  const { minDescriptionWords } = fixture.policy;
  for (const words of [minDescriptionWords - 1, minDescriptionWords, minDescriptionWords + 1]) {
    const design = entry.design.map((item) => ({ ...item, description: Array(words).fill('word').join(' ') }));
    const outcome = go(entry, design);
    assert.equal(
      outcome.rejected.length > 0,
      words < minDescriptionWords,
      `a ${words}-word description against a threshold of ${minDescriptionWords} was judged wrongly`,
    );
  }
});

test('a missing boundary warns and a stated one does not', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const design of entry.design) {
      const warned = outcome.warnings.some((warning) => warning.startsWith(`${design.name} states no boundary`));
      const accepted = outcome.tools.some((tool) => tool.name === design.name);
      assert.equal(warned, accepted && !design.notFor, `${entry.id}: ${design.name} was warned wrongly`);
    }
  }
});

test('a surface past the live budget is warned about by name', () => {
  const entry = findCase<Case>(fixture, 'wrapping-every-endpoint-one-to-one-buys-nothing');
  const outcome = go(entry);
  assert.ok(outcome.tools.length > fixture.policy.maxLiveTools, 'the fixture no longer exceeds the budget');
  assert.ok(
    outcome.warnings.some((warning) => warning.includes(`${outcome.tools.length} tools`)),
    'going over the live budget was not reported',
  );
  const roomy = go(entry, entry.design, { ...fixture.policy, maxLiveTools: outcome.tools.length });
  assert.ok(!roomy.warnings.some((warning) => warning.includes('live budget')), 'a surface within budget was warned');
});
