import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Replay, Request, replay as ReplayFn } from './start.ts';

interface Case {
  id: string;
  requests: Request[];
  result: Replay;
}

const fixture = expected<{
  chapter: string;
  minCacheTokens: number;
  ttlMs: number;
  cases: Case[];
}>(import.meta.url);
const { replay } = await loadImpl<{ replay: typeof ReplayFn }>(import.meta.url);

const run = (entry: Case) => replay(entry.requests, fixture.minCacheTokens, fixture.ttlMs);

const cases: Array<[string, string]> = [
  ['the-first-request-always-misses', 'a cold cache cannot hit'],
  ['an-identical-prefix-hits', 'the same prefix twice hits'],
  ['a-prefix-below-the-floor-is-never-cached', 'small prompts get no caching at all'],
  ['exactly-at-the-floor-is-cached', 'the minimum is inclusive'],
  ['a-changed-prefix-misses-and-becomes-the-new-entry', 'a prompt change costs one request'],
  ['an-idle-entry-expires', 'a quiet prefix falls out'],
  ['exactly-at-the-ttl-is-expired', 'the TTL comparison is strict'],
  ['traffic-keeps-an-entry-alive-past-its-ttl', 'the TTL measures idle time, not age'],
  ['no-requests-have-no-rate', 'no traffic is a rate of zero'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every request is a hit or a miss, exactly once', () => {
  for (const entry of fixture.cases) {
    const { hits, misses } = run(entry);
    assert.deepEqual(
      [...hits, ...misses].sort((a, b) => a - b),
      entry.requests.map((_, index) => index),
      `${entry.id}: a request went unaccounted for`,
    );
  }
});

test('the first request is never a hit', () => {
  for (const entry of fixture.cases) {
    if (entry.requests.length === 0) continue;
    assert.ok(!run(entry).hits.includes(0), `${entry.id}: hit on a cold cache`);
  }
});

test('nothing below the token floor ever hits', () => {
  for (const entry of fixture.cases) {
    for (const index of run(entry).hits) {
      assert.ok(
        entry.requests[index].prefixTokens >= fixture.minCacheTokens,
        `${entry.id}: request ${index} hit below the floor`,
      );
    }
  }
});

test('a hit always follows a request with the same prefix', () => {
  for (const entry of fixture.cases) {
    for (const index of run(entry).hits) {
      assert.equal(
        entry.requests[index - 1]?.prefix,
        entry.requests[index].prefix,
        `${entry.id}: request ${index} hit an entry nothing wrote`,
      );
    }
  }
});

test('the rate matches the hits', () => {
  for (const entry of fixture.cases) {
    const { hits, hitRateBps } = run(entry);
    const rate =
      entry.requests.length === 0
        ? 0
        : Math.floor((hits.length * 10000) / entry.requests.length + 0.5);
    assert.equal(hitRateBps, rate, `${entry.id}: the rate does not match the hits`);
  }
});
