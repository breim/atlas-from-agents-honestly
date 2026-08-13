import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Admission, admit as Admit } from './start.ts';

interface Case {
  id: string;
  arrivals: number[];
  result: Admission;
}

const fixture = expected<{
  chapter: string;
  capacity: number;
  refillMsPerToken: number;
  cases: Case[];
}>(import.meta.url);
const { admit } = await loadImpl<{ admit: typeof Admit }>(import.meta.url);

const run = (entry: Case) => admit(entry.arrivals, fixture.capacity, fixture.refillMsPerToken);

const cases: Array<[string, string]> = [
  ['the-bucket-starts-full', 'a cold limiter does not throttle the first request'],
  ['a-burst-past-capacity-is-shed', 'the burst allowance has an edge'],
  ['waiting-refills-the-bucket', 'a full refill period buys one request'],
  ['a-partial-refill-is-not-a-whole-token', 'half a token is not a token'],
  ['refill-is-capped-at-capacity', 'idling does not bank unlimited credit'],
  ['a-steady-rate-inside-the-limit-never-sheds', 'traffic under the rate always passes'],
  ['no-requests-are-neither-admitted-nor-shed', 'no traffic is no decisions'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every request is either admitted or shed, exactly once', () => {
  for (const entry of fixture.cases) {
    const { admitted, rejected } = run(entry);
    assert.equal(
      admitted.length + rejected.length,
      entry.arrivals.length,
      `${entry.id}: a request went unaccounted for`,
    );
  }
});

test('no window ever admits more than the bucket could hold', () => {
  for (const entry of fixture.cases) {
    const { admitted } = run(entry);
    if (admitted.length === 0) continue;
    const span = admitted.at(-1)! - admitted[0];
    const affordable = fixture.capacity + span / fixture.refillMsPerToken;
    assert.ok(
      admitted.length <= affordable,
      `${entry.id}: admitted ${admitted.length} where only ${affordable} were affordable`,
    );
  }
});

test('a stricter capacity never admits more', () => {
  for (const entry of fixture.cases) {
    const strict = admit(entry.arrivals, fixture.capacity - 1, fixture.refillMsPerToken);
    assert.ok(
      strict.admitted.length <= run(entry).admitted.length,
      `${entry.id}: a smaller bucket let more through`,
    );
  }
});
