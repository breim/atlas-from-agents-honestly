import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assessment, Call, Posture, Reversibility, Tool, assess as Assess } from './start.ts';

interface Case {
  id: string;
  calls: Call[];
  result: Assessment;
}

interface Fixture {
  chapter: string;
  capacity: number;
  catalogue: Record<string, Tool>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { assess } = await loadImpl<{ assess: typeof Assess }>(import.meta.url);

const run = (calls: Call[], catalogue = fixture.catalogue) => assess(calls, catalogue, fixture.capacity);
const rank: Record<Posture, number> = { auto: 0, notify: 1, approve: 2, dual: 3 };
const stricter: Record<Reversibility, Reversibility> = {
  reversible: 'costly',
  costly: 'irreversible',
  irreversible: 'irreversible',
};
const postureOf = (call: Call, catalogue = fixture.catalogue) => run([call], catalogue).decisions[0].posture;

const cases: Array<[string, string]> = [
  ['a-read-runs-autonomously', 'four hundred reads cost nobody anything'],
  ['a-small-refund-needs-one-approval', 'irreversible and small is still irreversible'],
  ['a-larger-refund-at-the-same-tool-needs-two-people', 'risk is the cell, not the tool'],
  ['the-amount-threshold-is-inclusive', 'exactly at the line is over it'],
  ['a-template-changes-the-action-not-the-tool', 'the redesign, in one case'],
  ['publishing-widely-costs-more-than-reading', 'blast radius comes from the arguments'],
  ['the-costly-row-escalates-with-scope', 'one row, three postures'],
  ['the-blast-radius-is-capped-at-large', 'there is nothing above large'],
  ['gating-every-reply-does-not-fit-the-day', 'the arithmetic nobody runs'],
  ['redesigning-the-action-fits-the-same-day', 'change the action, not the bar'],
  ['an-atlas-day-fits-inside-the-budget', 'a whole day, inside the ceiling'],
  ['a-day-with-no-calls-costs-nothing', 'no calls, no attention'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.calls), entry.result);
  });
}

test('one decision per call, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry.calls).decisions.map((d) => d.tool), entry.calls.map((c) => c.tool), entry.id);
  }
});

test('the model never decides — the same axes always give the same posture', () => {
  const seen = new Map<string, Posture>();
  for (const entry of fixture.cases) {
    const decisions = run(entry.calls).decisions;
    entry.calls.forEach((call, index) => {
      const tool = fixture.catalogue[call.tool];
      const reversibility =
        call.templated && tool.templatedReversibility ? tool.templatedReversibility : tool.reversibility;
      const radius = Math.min(tool.radiusThresholds.filter((edge) => call.scope >= edge).length, 2);
      const key = `${reversibility}:${radius}`;
      const previous = seen.get(key);
      if (previous) assert.equal(decisions[index].posture, previous, `${entry.id}: ${key} moved`);
      seen.set(key, decisions[index].posture);
    });
  }
});

test('a less reversible action never gets a laxer posture', () => {
  for (const entry of fixture.cases) {
    for (const call of entry.calls) {
      const tool = fixture.catalogue[call.tool];
      const harder = {
        ...fixture.catalogue,
        [call.tool]: { ...tool, reversibility: stricter[tool.reversibility] },
      };
      assert.ok(
        rank[postureOf(call, harder)] >= rank[postureOf(call)],
        `${entry.id}: ${call.tool} got easier by getting harder to undo`,
      );
    }
  }
});

test('a wider blast radius never gets a laxer posture', () => {
  for (const entry of fixture.cases) {
    for (const call of entry.calls) {
      const wider = { ...call, scope: call.scope + 1_000_000 };
      assert.ok(
        rank[postureOf(wider)] >= rank[postureOf(call)],
        `${entry.id}: ${call.tool} got easier by touching more`,
      );
    }
  }
});

test('sending an approved template is never stricter than sending prose', () => {
  for (const entry of fixture.cases) {
    for (const call of entry.calls) {
      const templated = rank[postureOf({ ...call, templated: true })];
      const freeText = rank[postureOf({ ...call, templated: false })];
      assert.ok(templated <= freeText, `${entry.id}: ${call.tool} punished the safer shape`);
    }
  }
});

test('only approve and dual spend a reviewer decision', () => {
  for (const entry of fixture.cases) {
    const { decisions, approvals } = run(entry.calls);
    const spent = decisions.reduce((total, decision, index) => {
      const cost = decision.posture === 'approve' ? 1 : decision.posture === 'dual' ? 2 : 0;
      return total + cost * entry.calls[index].count;
    }, 0);
    assert.equal(approvals, spent, `${entry.id}: the budget does not match the postures`);
  }
});

test('affordable is exactly whether the decisions fit the capacity', () => {
  for (const entry of fixture.cases) {
    const { approvals, affordable } = run(entry.calls);
    assert.equal(affordable, approvals <= fixture.capacity, `${entry.id}: the arithmetic disagrees`);
  }
});

test('more of the same calls never asks for fewer decisions', () => {
  for (const entry of fixture.cases) {
    const busier = entry.calls.map((call) => ({ ...call, count: call.count * 2 }));
    assert.ok(run(busier).approvals >= run(entry.calls).approvals, `${entry.id}: volume went the wrong way`);
  }
});
