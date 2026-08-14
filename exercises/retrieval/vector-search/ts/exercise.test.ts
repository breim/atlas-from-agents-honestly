import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Chunk, Filters, Index, Query, Search, search as SearchFn } from './start.ts';

interface Case {
  id: string;
  strategy: Index['strategy'];
  query: Query;
  filters: Filters;
  k: number;
  result: Search;
}

interface Fixture {
  chapter: string;
  index: { probe: number; chunks: Chunk[] };
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { search } = await loadImpl<{ search: typeof SearchFn }>(import.meta.url);

const indexWith = (strategy: Index['strategy'], probe = fixture.index.probe): Index => ({
  ...fixture.index,
  probe,
  strategy,
});

const go = (entry: Case, strategy = entry.strategy, filters = entry.filters, k = entry.k) =>
  search(entry.query, filters, k, indexWith(strategy));

const STRATEGIES: Array<Index['strategy']> = ['post', 'pre', 'in-algorithm'];

const cases: Array<[string, string]> = [
  ['similarity-orders-and-the-filter-makes-it-correct', 'the nearest chunk is the wrong one'],
  ['the-version-filter-is-not-optional', 'applied whether or not it was asked for'],
  ['post-filtering-returns-fewer-than-k-when-the-filter-is-selective', 'top-100 yields nothing usable'],
  ['pre-filtering-finds-what-post-filtering-missed', 'full recall, no approximation'],
  ['in-algorithm-filtering-gets-faster-as-the-filter-tightens', 'the filter prunes the search'],
  ['a-loose-filter-is-where-pre-filtering-stops-scaling', 'distance to every member'],
  ['a-tenant-filter-never-leaks-another-tenants-chunk', 'the filter is what makes it correct'],
  ['no-match-is-an-empty-result-not-a-near-miss', 'nothing is not almost something'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a superseded chunk is never returned, by any strategy, under any filter', () => {
  const superseded = new Set(fixture.index.chunks.filter((c) => c.supersededAt !== null).map((c) => c.id));
  assert.ok(superseded.size > 0, 'the fixture proves nothing about supersession');
  for (const entry of fixture.cases) {
    for (const strategy of STRATEGIES) {
      for (const hit of go(entry, strategy).results) {
        assert.ok(!superseded.has(hit.id), `${entry.id}/${strategy}: returned superseded chunk ${hit.id}`);
      }
    }
  }
});

test('the nearest chunk in the corpus is not the nearest chunk that is correct', () => {
  const entry = findCase<Case>(fixture, 'similarity-orders-and-the-filter-makes-it-correct');
  const nearest = [...fixture.index.chunks].sort(
    (a, b) => Math.abs(a.embedding - entry.query.point) - Math.abs(b.embedding - entry.query.point),
  )[0];
  assert.ok(nearest.supersededAt !== null, 'the fixture no longer makes similarity and correctness disagree');
  assert.ok(
    !go(entry).results.some((hit) => hit.id === nearest.id),
    'similarity beat the version filter',
  );
});

test('every result satisfies every filter that was asked for', () => {
  for (const entry of fixture.cases) {
    for (const strategy of STRATEGIES) {
      for (const hit of go(entry, strategy).results) {
        const chunk = fixture.index.chunks.find((c) => c.id === hit.id) as Chunk;
        for (const [field, wanted] of Object.entries(entry.filters)) {
          assert.equal(chunk[field as keyof Chunk], wanted, `${entry.id}/${strategy}: ${field} was not honoured`);
        }
      }
    }
  }
});

test('no tenant filter ever returns another tenant chunk', () => {
  const entry = findCase<Case>(fixture, 'the-version-filter-is-not-optional');
  const tenants = [...new Set(fixture.index.chunks.map((chunk) => chunk.tenantId))];
  for (const tenantId of tenants) {
    for (const strategy of STRATEGIES) {
      const outcome = go(entry, strategy, { tenantId }, fixture.index.chunks.length);
      for (const hit of outcome.results) {
        const chunk = fixture.index.chunks.find((c) => c.id === hit.id) as Chunk;
        assert.equal(chunk.tenantId, tenantId, `${strategy}: ${tenantId} saw ${chunk.tenantId}`);
      }
    }
  }
});

test('results are ordered by distance, and never more than k of them', () => {
  for (const entry of fixture.cases) {
    for (const strategy of STRATEGIES) {
      const { results } = go(entry, strategy);
      assert.ok(results.length <= entry.k, `${entry.id}/${strategy}: returned more than k`);
      for (let index = 1; index < results.length; index += 1) {
        assert.ok(
          results[index].distance >= results[index - 1].distance,
          `${entry.id}/${strategy}: out of order`,
        );
      }
    }
  }
});

test('shortfall is exactly what k did not get', () => {
  for (const entry of fixture.cases) {
    for (const strategy of STRATEGIES) {
      const outcome = go(entry, strategy);
      assert.equal(outcome.shortfall, entry.k - outcome.results.length, `${entry.id}/${strategy}`);
      assert.equal(outcome.strategy, strategy, `${entry.id}: the strategy was not reported`);
    }
  }
});

test('the number of matching rows is a property of the filter, not the strategy', () => {
  for (const entry of fixture.cases) {
    const counts = STRATEGIES.map((strategy) => go(entry, strategy).filtered);
    assert.equal(new Set(counts).size, 1, `${entry.id}: strategies disagreed on what matched`);
  }
});

test('pre and in-algorithm return the same results; post may return fewer', () => {
  for (const entry of fixture.cases) {
    const pre = go(entry, 'pre');
    const exact = go(entry, 'in-algorithm');
    const post = go(entry, 'post');
    assert.deepEqual(exact.results, pre.results, `${entry.id}: the graph walk was not exact`);
    assert.ok(post.results.length <= pre.results.length, `${entry.id}: post-filtering found extra rows`);
    for (const hit of post.results) {
      assert.ok(pre.results.some((item) => item.id === hit.id), `${entry.id}: post returned a row pre did not`);
    }
  }
});

test('a selective filter makes in-algorithm cheaper and post-filtering no cheaper at all', () => {
  for (const entry of fixture.cases) {
    const post = go(entry, 'post');
    const exact = go(entry, 'in-algorithm');
    assert.equal(post.scanned, fixture.index.chunks.length, `${entry.id}: post-filtering skipped the corpus`);
    assert.ok(exact.scanned <= post.scanned, `${entry.id}: pruning cost more than scanning everything`);
    assert.ok(exact.scanned <= exact.filtered, `${entry.id}: the walk left the matching subgraph`);
  }
});

test('post-filtering can only return rows the unfiltered probe already reached', () => {
  for (const entry of fixture.cases) {
    const window = new Set(
      [...fixture.index.chunks]
        .sort(
          (a, b) =>
            Math.abs(a.embedding - entry.query.point) - Math.abs(b.embedding - entry.query.point) || a.id - b.id,
        )
        .slice(0, fixture.index.probe)
        .map((chunk) => chunk.id),
    );
    for (const hit of go(entry, 'post').results) {
      assert.ok(window.has(hit.id), `${entry.id}: post-filtering reached past its probe to ${hit.id}`);
    }
  }
});

test('the graph walk never scans more than its probe budget', () => {
  for (const entry of fixture.cases) {
    const exact = go(entry, 'in-algorithm');
    assert.ok(exact.scanned <= fixture.index.probe, `${entry.id}: the walk scanned ${exact.scanned}`);
    const pre = go(entry, 'pre');
    if (pre.filtered > fixture.index.probe) {
      assert.ok(exact.scanned < pre.scanned, `${entry.id}: pruning bought nothing on a loose filter`);
    }
  }
});

test('pre-filtering scans every matching row, however many that is', () => {
  for (const entry of fixture.cases) {
    const pre = go(entry, 'pre');
    assert.equal(pre.scanned, pre.filtered, `${entry.id}: pre-filtering skipped a member`);
  }
});

test('tightening a filter never costs in-algorithm more work', () => {
  const entry = findCase<Case>(fixture, 'the-version-filter-is-not-optional');
  const loose = go(entry, 'in-algorithm', {});
  const tight = go(entry, 'in-algorithm', { tier: 'contract', region: 'us', tenantId: 'meridian' });
  assert.ok(tight.filtered < loose.filtered, 'the fixture no longer tightens anything');
  assert.ok(tight.scanned <= loose.scanned, 'a selective filter made the walk more expensive');
  const loosePost = go(entry, 'post', {});
  const tightPost = go(entry, 'post', { tier: 'contract', region: 'us', tenantId: 'meridian' });
  assert.equal(tightPost.scanned, loosePost.scanned, 'post-filtering somehow benefited from the filter');
  assert.ok(tightPost.shortfall > loosePost.shortfall, 'post-filtering did not degrade under selectivity');
});
