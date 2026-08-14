import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Outcome, Response, Ticket, ToolUseBlock, World, run as Run } from './start.ts';

interface Case {
  id: string;
  config?: Config;
  ticket: Ticket;
  script: Response[];
  result: Outcome;
}

interface Fixture {
  chapter: string;
  config: Config;
  world: World;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

const configOf = (entry: Case) => entry.config ?? fixture.config;
const go = (entry: Case, config = configOf(entry), script = entry.script) =>
  run(entry.ticket, script, config, fixture.world);

const cases: Array<[string, string]> = [
  ['four-steps-and-an-answer', 'the step the model chose for itself'],
  ['an-answer-on-the-first-step-needs-no-tool-at-all', 'one call, no loop, still an outcome'],
  ['the-model-declares-it-cannot-finish', 'a deliberate, structured handoff'],
  ['a-terminal-tool-cancels-the-turn-it-was-in', 'nothing else in that turn runs'],
  ['the-step-cap-halts-a-loop-that-will-not-converge', 'a bound you own'],
  ['a-budget-is-checked-before-the-call-not-after', 'a limit, not a report'],
  ['the-deadline-halts-a-run-that-is-merely-slow', 'cheap and still too slow'],
  ['an-error-is-still-a-message-and-the-loop-continues', 'a failure the model reads and recovers from'],
  ['a-tool-refuses-data-that-belongs-to-another-customer', 'the filter is a parameter, not a prompt'],
  ['a-long-result-is-truncated-not-dropped', 'a blunt cut, and the field that mattered'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a halted run never carries an answer', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'halted') continue;
    assert.equal(outcome.reply, null, `${entry.id}: a halt returned a reply`);
    assert.equal(outcome.reason, null, `${entry.id}: a halt returned a reason`);
    assert.ok(outcome.bound !== null, `${entry.id}: a halt named no bound`);
  }
});

test('only a halt names a bound, and only the model answers or escalates', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.ok(['answered', 'escalated', 'halted'].includes(outcome.status), `${entry.id}: unknown status`);
    if (outcome.status === 'answered') {
      assert.ok(typeof outcome.reply === 'string', `${entry.id}: answered without a reply`);
      assert.equal(outcome.bound, null, entry.id);
    }
    if (outcome.status === 'escalated') {
      assert.ok(typeof outcome.reason === 'string', `${entry.id}: escalated without a reason`);
      assert.equal(outcome.reply, null, entry.id);
      assert.equal(outcome.bound, null, entry.id);
    }
  }
});

test('no step is ever started once a bound is already crossed', () => {
  for (const entry of fixture.cases) {
    const config = configOf(entry);
    const outcome = go(entry);
    let cost = 0;
    let elapsed = 0;
    for (let index = 0; index < outcome.steps; index += 1) {
      assert.ok(cost <= config.maxCostCents, `${entry.id}: step ${index + 1} began at ${cost} cents`);
      assert.ok(elapsed <= config.deadlineMs, `${entry.id}: step ${index + 1} began at ${elapsed}ms`);
      cost += entry.script[index].costCents;
      elapsed += entry.script[index].tookMs;
    }
    assert.equal(outcome.costCents, cost, `${entry.id}: cost disagrees with the script`);
    assert.equal(outcome.elapsedMs, elapsed, `${entry.id}: elapsed disagrees with the script`);
  }
});

test('the step cap is never exceeded and every step is one model call', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.ok(outcome.steps <= configOf(entry).maxSteps, `${entry.id}: ran ${outcome.steps} steps`);
    assert.equal(outcome.trace.length, outcome.steps, `${entry.id}: the trace disagrees with the count`);
    outcome.trace.forEach((step, index) => assert.equal(step.step, index + 1, `${entry.id}: step numbers skipped`));
  }
});

test('the history grows by two messages per tool step and is resent whole', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    outcome.trace.forEach((step, index) => {
      assert.equal(step.messages, index * 2 + 1, `${entry.id}: step ${step.step} sent ${step.messages} messages`);
    });
    const last = outcome.trace.at(-1);
    if (last) assert.ok(outcome.messages > last.messages, `${entry.id}: the final turn was never recorded`);
  }
});

test('a terminal tool ends the turn before any other call in it runs', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const step of outcome.trace) {
      if (!step.calls.includes('escalate_to_human')) continue;
      assert.equal(outcome.status, 'escalated', `${entry.id}: escalation was ignored`);
      assert.deepEqual(step.results, [], `${entry.id}: a tool ran alongside the handoff`);
      assert.equal(step.step, outcome.steps, `${entry.id}: the loop continued past the handoff`);
    }
  }
});

test('every tool call that ran produced exactly one result', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const step of outcome.trace) {
      if (step.results.length === 0) continue;
      assert.equal(step.results.length, step.calls.length, `${entry.id}: step ${step.step} lost a result`);
      for (const result of step.results) {
        assert.equal(result.isError ?? false, result.content.startsWith('Error: '), `${entry.id}: mislabelled`);
      }
    }
  }
});

test('no result is ever longer than the cap', () => {
  for (const entry of fixture.cases) {
    const { maxResultChars } = configOf(entry);
    for (const step of go(entry).trace) {
      for (const result of step.results) {
        assert.ok(result.content.length <= maxResultChars, `${entry.id}: ${result.toolUseId} was not truncated`);
      }
    }
  }
});

test('a tool never returns another customer data, however the model asks', () => {
  const entry = findCase<Case>(fixture, 'four-steps-and-an-answer');
  const stranger = { ...entry.ticket, customerId: 'northwind' };
  const outcome = run(stranger, entry.script, configOf(entry), fixture.world);
  const owned = outcome.trace.flatMap((step) => step.results).filter((result) => !result.isError);
  for (const result of owned) {
    assert.ok(
      Object.values(fixture.world.records).some(
        (record) => record.customerId === null && record.data.startsWith(result.content),
      ),
      `acme data reached northwind: ${result.content}`,
    );
  }
});

test('a model that never stops is stopped by the cap, not by running out of script', () => {
  const entry = findCase<Case>(fixture, 'the-step-cap-halts-a-loop-that-will-not-converge');
  const insatiable = Array.from({ length: 40 }, () => entry.script[0]);
  const outcome = go(entry, { ...configOf(entry), maxSteps: 5 }, insatiable);
  assert.equal(outcome.status, 'halted');
  assert.equal(outcome.bound, 'steps');
  assert.equal(outcome.steps, 5);
  assert.equal(outcome.reply, null);
});

test('an unreachable answer is never reached', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'halted') continue;
    assert.ok(outcome.steps < entry.script.length, `${entry.id}: the fixture proves nothing about halting`);
    const unread = entry.script.slice(outcome.steps);
    assert.ok(
      unread.some((response) => response.stopReason === 'end_turn'),
      `${entry.id}: no answer was left on the table`,
    );
  }
});
