import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Saga, Step, Tool, run as RunFn } from './start.ts';

interface Case { id: string; plan: Step[]; catalogue: Tool[]; world: Record<string, string>; config: Config; result: Saga }
interface Fixture { chapter: string; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { run } = await loadImpl<{ run: typeof RunFn }>(import.meta.url);

const go = (entry: Case, plan = entry.plan, world = entry.world, config = entry.config) =>
  run(plan, entry.catalogue, world, config);
const toolOf = (entry: Case, name: string) => entry.catalogue.find((tool) => tool.name === name);

const cases: Array<[string, string]> = [
  ['every-step-succeeds-and-nothing-is-unwound', 'the happy path leaves no trace'],
  ['a-failure-before-the-pivot-unwinds-in-reverse', 'reverse order, only what ran'],
  ['a-failure-after-the-pivot-finishes-forward', 'past the pivot, finish'],
  ['a-business-rejection-does-not-burn-the-retry-budget', 'not transient, not retried'],
  ['a-compensation-that-fails-raises-an-incident-and-the-rest-still-run', 'a human owns it by name'],
  ['a-reversible-write-with-no-compensation-cannot-take-part', 'checkable, not discovered'],
  ['an-irreversible-step-before-the-pivot-is-a-design-error', 'order by reversibility'],
  ['a-tool-that-is-not-in-the-catalogue-is-refused', 'compensations attach to tools'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('an invalid plan runs nothing at all', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'invalid') continue;
    assert.deepEqual(outcome.applied, [], `${entry.id}: an invalid plan applied a step`);
    assert.deepEqual(outcome.unwound, [], `${entry.id}: an invalid plan unwound something`);
    assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('only steps that actually succeeded are unwound, in reverse', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'unwound') continue;
    const succeeded = outcome.applied.slice(0, -1).map((item) => item.tool);
    assert.deepEqual(
      outcome.unwound.map((item) => item.step),
      [...succeeded].reverse(),
      `${entry.id}: the unwind order or set is wrong`,
    );
    const failed = outcome.applied.at(-1)!.tool;
    assert.ok(!outcome.unwound.some((item) => item.step === failed), `${entry.id}: unwound a step that failed`);
  }
});

test('nothing after the failure was ever applied', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'invalid' || outcome.status === 'completed') continue;
    assert.equal(outcome.applied.length, entry.plan.findIndex((step) => step.outcome !== 'ok') + 1, `${entry.id}`);
  }
});

test('a business rejection is attempted once and a transient one is retried to the cap', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const item of outcome.applied) {
      const step = entry.plan.find((candidate) => candidate.tool === item.tool)!;
      if (step.outcome === 'rejected') assert.equal(item.attempts, 1, `${entry.id}: a rejection was retried`);
      if (step.outcome === 'transient') {
        assert.equal(item.attempts, entry.config.maxAttempts, `${entry.id}: a transient failure gave up early`);
      }
      if (step.outcome === 'ok') assert.equal(item.attempts, 1, `${entry.id}: a success was repeated`);
    }
  }
});

test('a failure past the pivot never reverses anything', () => {
  const entry = findCase<Case>(fixture, 'a-failure-after-the-pivot-finishes-forward');
  const outcome = go(entry);
  assert.equal(outcome.status, 'forward-only');
  assert.deepEqual(outcome.unwound, [], 'a run past the pivot tried to reverse');
  assert.deepEqual(outcome.incidents, [], 'a run past the pivot raised an incident instead of finishing');
});

test('the pivot decides the direction, wherever it sits', () => {
  const entry = findCase<Case>(fixture, 'a-failure-before-the-pivot-unwinds-in-reverse');
  const before = go(entry);
  assert.equal(before.status, 'unwound');
  const moved = go(entry, entry.plan, entry.world, { ...entry.config, pivot: 'hold_funds' });
  assert.equal(moved.status, 'forward-only', 'moving the pivot did not change the direction');
});

test('a failed compensation is an incident and never stops the others', () => {
  const entry = findCase<Case>(fixture, 'a-compensation-that-fails-raises-an-incident-and-the-rest-still-run');
  const outcome = go(entry);
  const failed = outcome.unwound.filter((item) => item.status === 'failed');
  assert.ok(failed.length > 0, 'the fixture no longer fails a compensation');
  assert.ok(outcome.unwound.some((item) => item.status === 'compensated'), 'a failure stopped the rest');
  for (const item of failed) {
    assert.ok(
      outcome.incidents.some((incident) => incident.includes(item.step)),
      `${item.step} failed to compensate without naming an owner`,
    );
  }
});

test('every compensation named is the one the catalogue declares', () => {
  for (const entry of fixture.cases) {
    for (const item of go(entry).unwound) {
      const tool = toolOf(entry, item.step)!;
      assert.equal(item.compensation, tool.compensation ?? '', `${entry.id}: ${item.step} used the wrong compensation`);
      if (!tool.compensation) assert.equal(item.status, 'none', `${entry.id}: reversed something with no compensation`);
    }
  }
});

test('a reversible write with no compensation is refused before anything runs', () => {
  const entry = findCase<Case>(fixture, 'every-step-succeeds-and-nothing-is-unwound');
  const orphan = entry.catalogue.find((tool) => tool.reversibility === 'reversible' && !tool.compensation)!;
  const outcome = go(entry, [{ tool: orphan.name, outcome: 'ok' }, ...entry.plan]);
  assert.equal(outcome.status, 'invalid', 'an uncompensatable write was allowed into the saga');
  assert.ok(outcome.errors.some((error) => error.includes(orphan.name)), 'it was refused without saying which tool');
});

test('anything not reversible before the pivot is a design error', () => {
  const entry = findCase<Case>(fixture, 'every-step-succeeds-and-nothing-is-unwound');
  for (const tool of entry.catalogue) {
    if (tool.reversibility === 'reversible') continue;
    if (tool.name === entry.config.pivot) continue;
    const outcome = go(entry, [{ tool: tool.name, outcome: 'ok' }, { tool: entry.config.pivot, outcome: 'ok' }]);
    assert.equal(outcome.status, 'invalid', `${tool.name} was allowed before the pivot`);
    assert.ok(outcome.errors.some((error) => error.includes(tool.name)), `${tool.name} was refused silently`);
  }
});
