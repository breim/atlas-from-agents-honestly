import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Exchange, Shadow, shadow as ShadowFn } from './start.ts';

interface Case {
  id: string;
  traffic: Exchange[];
  result: Shadow;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { shadow } = await loadImpl<{ shadow: typeof ShadowFn }>(import.meta.url);

const run = (entry: Case) => shadow(entry.traffic);

const cases: Array<[string, string]> = [
  ['agreement-serves-production-and-records-nothing', 'agreement is uneventful'],
  ['a-divergence-is-recorded-and-production-still-serves', 'disagreement is recorded, not served'],
  ['a-better-looking-candidate-answer-still-does-not-reach-the-user', 'being right is not a licence to serve'],
  ['a-candidate-that-fails-does-not-affect-the-user', 'a broken candidate is invisible to users'],
  ['mixed-traffic-reports-a-partial-agreement-rate', 'the rate reflects the mix'],
  ['no-traffic-agrees-vacuously', 'no traffic is total agreement'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the user always receives production, on every single request', () => {
  for (const entry of fixture.cases) {
    const { served } = run(entry);
    for (const exchange of entry.traffic) {
      assert.equal(
        served[exchange.id],
        exchange.production,
        `${entry.id}: ${exchange.id} was served something other than production`,
      );
    }
  }
});

test('the candidate output never appears in what was served', () => {
  for (const entry of fixture.cases) {
    const { served } = run(entry);
    for (const exchange of entry.traffic) {
      if (exchange.candidate === exchange.production) continue;
      assert.notEqual(served[exchange.id], exchange.candidate, `${entry.id}: candidate leaked`);
    }
  }
});

test('divergences are exactly the requests where the two disagreed', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      run(entry).divergences,
      entry.traffic.filter((exchange) => exchange.candidate !== exchange.production),
      `${entry.id}: the divergence list is wrong`,
    );
  }
});

test('agreement and divergences describe the same traffic', () => {
  for (const entry of fixture.cases) {
    const { divergences, agreement } = run(entry);
    if (entry.traffic.length === 0) continue;
    const agreed = entry.traffic.length - divergences.length;
    assert.equal(
      agreement,
      Math.floor((agreed / entry.traffic.length) * 10000 + 0.5) / 10000,
      `${entry.id}: the rate does not match the divergences`,
    );
  }
});
