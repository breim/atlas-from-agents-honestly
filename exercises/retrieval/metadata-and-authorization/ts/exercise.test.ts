import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Index, Principal, Query, Retrieval, retrieve as Retrieve } from './start.ts';

interface Case {
  id: string;
  principal: string | null;
  config?: Config;
  query: Query;
  result: Retrieval;
}

interface Fixture {
  chapter: string;
  index: Index;
  config: Config;
  principals: Record<string, Principal>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { retrieve } = await loadImpl<{ retrieve: typeof Retrieve }>(import.meta.url);

const principalOf = (entry: Case) => (entry.principal === null ? null : fixture.principals[entry.principal]);
const configOf = (entry: Case) => entry.config ?? fixture.config;
const go = (entry: Case, principal = principalOf(entry), config = configOf(entry), query = entry.query) =>
  retrieve(query, principal, fixture.index, config);

const PRINCIPALS = Object.values(fixture.principals);
const chunkOf = (id: number) => fixture.index.chunks.find((chunk) => chunk.id === id)!;

const cases: Array<[string, string]> = [
  ['the-hr-document-is-never-a-candidate', 'the leak that is laundered by generation'],
  ['post-filtering-reads-restricted-content-out-of-storage', 'not a security boundary'],
  ['a-chunk-with-no-tenant-tag-is-invisible-not-public', 'deny by default'],
  ['membership-comes-from-the-request-not-the-index', 'read live, every request'],
  ['the-model-cannot-influence-the-filter', 'it chooses what, not what it may'],
  ['late-binding-drops-a-permission-revoked-since-ingestion', 'one extra round trip, exact'],
  ['the-index-still-grants-what-the-source-has-revoked', 'the window you chose to accept'],
  ['a-principal-removed-from-every-group-retrieves-nothing', 'revocation that actually happened'],
  ['retrieval-without-a-principal-returns-nothing-and-says-why', 'no path retrieves anonymously'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('no principal ever receives a chunk belonging to another tenant', () => {
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      for (const hit of go(entry, principal).results) {
        assert.equal(chunkOf(hit.id).tenantId, principal.tenantId, `${entry.id}: ${principal.id} crossed a tenant`);
      }
    }
  }
});

test('no principal ever receives a chunk none of its groups may read', () => {
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      for (const hit of go(entry, principal).results) {
        const chunk = chunkOf(hit.id);
        assert.ok(
          chunk.acl.some((group) => principal.groups.includes(group)),
          `${entry.id}: ${principal.id} read ${chunk.documentId} with groups ${principal.groups}`,
        );
      }
    }
  }
});

test('an untagged chunk is unreachable by every principal, every strategy', () => {
  const untagged = fixture.index.chunks.filter((chunk) => chunk.tenantId === null);
  assert.ok(untagged.length > 0, 'the fixture no longer has an untagged chunk');
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      for (const enforcement of ['in-query', 'post'] as const) {
        const outcome = go(entry, principal, { ...configOf(entry), enforcement });
        for (const hit of outcome.results) {
          assert.ok(!untagged.some((chunk) => chunk.id === hit.id), `${entry.id}: an untagged chunk was returned`);
        }
      }
    }
  }
});

test('the tenant asked for in the query is never the tenant that is used', () => {
  const entry = findCase<Case>(fixture, 'the-hr-document-is-never-a-candidate');
  const tenants = [...new Set(fixture.index.chunks.map((chunk) => chunk.tenantId))];
  for (const principal of PRINCIPALS) {
    const honest = go(entry, principal, configOf(entry), entry.query);
    for (const tenantId of tenants) {
      const asked = go(entry, principal, configOf(entry), { ...entry.query, tenantId: tenantId as string });
      assert.deepEqual(asked, honest, `${principal.id}: the model moved the filter by asking for ${tenantId}`);
    }
  }
});

test('a superseded chunk is out of scope for everyone', () => {
  const superseded = fixture.index.chunks.filter((chunk) => chunk.supersededAt !== null).map((chunk) => chunk.id);
  assert.ok(superseded.length > 0, 'the fixture no longer has a superseded chunk');
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      for (const hit of go(entry, principal).results) {
        assert.ok(!superseded.includes(hit.id), `${entry.id}: returned superseded chunk ${hit.id}`);
      }
    }
  }
});

test('in-query enforcement exposes nothing; post-filtering exposes what it read', () => {
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      const inQuery = go(entry, principal, { ...configOf(entry), enforcement: 'in-query' });
      assert.deepEqual(inQuery.exposed, [], `${entry.id}: the query leaked a candidate`);

      const post = go(entry, principal, { ...configOf(entry), enforcement: 'post' });
      for (const documentId of post.exposed) {
        assert.ok(
          !post.results.some((hit) => hit.documentId === documentId),
          `${entry.id}: ${documentId} was both exposed and returned`,
        );
      }
    }
  }
});

test('post-filtering never returns more than in-query enforcement, and often less', () => {
  const entry = findCase<Case>(fixture, 'the-hr-document-is-never-a-candidate');
  let sawFewer = false;
  for (const principal of PRINCIPALS) {
    const inQuery = go(entry, principal, { ...configOf(entry), enforcement: 'in-query' });
    const post = go(entry, principal, { ...configOf(entry), enforcement: 'post' });
    assert.ok(post.results.length <= inQuery.results.length, `${principal.id}: post-filtering found extra rows`);
    for (const hit of post.results) {
      assert.ok(inQuery.results.some((item) => item.id === hit.id), `${principal.id}: post returned an unauthorized row`);
    }
    if (post.results.length < inQuery.results.length) {
      sawFewer = true;
      assert.ok(post.exposed.length > 0, `${principal.id}: dropped a result without reading anything`);
    }
  }
  assert.ok(sawFewer, 'the fixture no longer shows post-filtering losing a result');
});

test('late binding only ever removes, and names what it removed', () => {
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      const loose = go(entry, principal, { ...configOf(entry), lateBinding: false });
      const bound = go(entry, principal, { ...configOf(entry), lateBinding: true });
      assert.deepEqual(loose.revoked, [], `${entry.id}: revoked was populated without late binding`);
      assert.ok(bound.results.length <= loose.results.length, `${entry.id}: late binding added a result`);
      for (const hit of bound.results) {
        const live = fixture.index.liveAcls[hit.documentId] ?? [];
        assert.ok(
          live.some((group) => principal.groups.includes(group)),
          `${entry.id}: ${hit.documentId} survived late binding without a live grant`,
        );
      }
    }
  }
});

test('the audit names the principal and exactly what it received', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const principal = principalOf(entry);
    assert.equal(outcome.audit.principalId, principal?.id ?? null, `${entry.id}: the audit lost the principal`);
    assert.equal(outcome.audit.tenantId, principal?.tenantId ?? null, entry.id);
    assert.deepEqual(
      outcome.audit.retrieved,
      outcome.results.map((hit) => hit.documentId),
      `${entry.id}: the audit disagrees with what was returned`,
    );
  }
});

test('a request with no principal returns nothing and reads nothing', () => {
  for (const entry of fixture.cases) {
    for (const enforcement of ['in-query', 'post'] as const) {
      const outcome = go(entry, null, { ...configOf(entry), enforcement });
      assert.deepEqual(outcome.results, [], `${entry.id}: an anonymous request retrieved something`);
      assert.deepEqual(outcome.exposed, [], `${entry.id}: an anonymous request read something`);
      assert.ok(outcome.errors.length > 0, `${entry.id}: an anonymous request failed silently`);
    }
  }
});

test('nothing is ever returned that k did not ask for', () => {
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      const outcome = go(entry, principal);
      assert.ok(outcome.results.length <= entry.query.k, `${entry.id}: returned more than k`);
      const ids = outcome.results.map((hit) => hit.id);
      assert.equal(new Set(ids).size, ids.length, `${entry.id}: a chunk was returned twice`);
    }
  }
});
