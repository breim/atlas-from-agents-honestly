import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Fact, Memory, Policy, Request, Store, remember as Remember } from './start.ts';

interface Case {
  id: string;
  request: Request;
  result: Memory;
}

interface Fixture {
  chapter: string;
  now: number;
  policy: Policy;
  store: Store;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { remember } = await loadImpl<{ remember: typeof Remember }>(import.meta.url);

const go = (entry: Case, request = entry.request, now = fixture.now) =>
  remember(request, fixture.store, fixture.policy, now);

const authorityOf = (assertedBy: string) => assertedBy.split(':')[0];

const cases: Array<[string, string]> = [
  ['the-highest-authority-wins-before-the-most-recent', 'a human beats a fresher inference'],
  ['a-superseded-fact-never-wins-however-recent', 'the append-only trap'],
  ['a-stale-fact-is-surfaced-with-its-age-not-dropped', 'as of eighteen months ago'],
  ['an-unknown-predicate-falls-back-to-the-default-expiry', 'no single expiry fits everything'],
  ['a-fact-from-another-tenant-is-never-recalled', 'leakage'],
  ['a-model-inference-is-never-written', 'conclusions belong to a run'],
  ['a-secret-is-never-written-to-memory', 'replayed verbatim, forever'],
  ['a-write-without-provenance-is-rejected', 'four fields or it is a string'],
  ['a-human-correction-supersedes-and-takes-effect-at-once', 'contradiction has an answer'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('every read gets exactly one answer, in the order asked', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.deepEqual(
      outcome.recalled.map((item) => item.predicate),
      entry.request.reads,
      `${entry.id}: reads and answers disagree`,
    );
  }
});

test('a recalled fact always belongs to the asking tenant and subject', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const pool = [...fixture.store.facts, ...entry.request.writes.filter((w) => outcome.admitted.includes(w.id))];
    for (const item of outcome.recalled) {
      if (item.value === null) continue;
      const origin = pool.find(
        (fact) => fact.predicate === item.predicate && fact.value === item.value && fact.source === item.source,
      ) as Fact;
      assert.equal(origin.tenantId, entry.request.tenantId, `${entry.id}: ${item.predicate} crossed a tenant`);
      assert.equal(origin.subject, entry.request.subject, `${entry.id}: ${item.predicate} crossed a subject`);
    }
  }
});

test('no tenant can read another tenant facts, whatever it asks for', () => {
  const entry = findCase<Case>(fixture, 'the-highest-authority-wins-before-the-most-recent');
  const predicates = [...new Set(fixture.store.facts.map((fact) => fact.predicate))];
  const stranger = { tenantId: 'no_such_tenant', subject: 'account:4471', reads: predicates, writes: [] };
  for (const item of go(entry, stranger).recalled) {
    assert.equal(item.value, null, `${item.predicate} leaked to a tenant with no facts`);
  }
});

test('a superseded fact is never the winner', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const facts = [...fixture.store.facts, ...entry.request.writes.filter((w) => outcome.admitted.includes(w.id))];
    const retired = new Set(facts.map((fact) => fact.supersedes).filter(Boolean));
    for (const item of outcome.recalled) {
      if (item.value === null) continue;
      const winner = facts.find(
        (fact) => fact.predicate === item.predicate && fact.value === item.value && fact.source === item.source,
      ) as Fact;
      assert.ok(!retired.has(winner.id), `${entry.id}: ${winner.id} was recalled after being superseded`);
    }
  }
});

test('nothing with lower authority than the winner is ever chosen', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const facts = [...fixture.store.facts, ...entry.request.writes.filter((w) => outcome.admitted.includes(w.id))];
    const retired = new Set(facts.map((fact) => fact.supersedes).filter(Boolean));
    for (const item of outcome.recalled) {
      if (item.assertedBy === null) continue;
      const rank = fixture.policy.authorityRank[authorityOf(item.assertedBy)];
      const rivals = facts.filter(
        (fact) =>
          fact.tenantId === entry.request.tenantId &&
          fact.subject === entry.request.subject &&
          fact.predicate === item.predicate &&
          !retired.has(fact.id),
      );
      for (const rival of rivals) {
        const rivalRank = fixture.policy.authorityRank[authorityOf(rival.assertedBy)];
        assert.ok(rank >= rivalRank, `${entry.id}: ${item.predicate} lost to a lower authority`);
        if (rivalRank === rank) {
          assert.ok(
            (item.assertedOnDay as number) >= rival.assertedOnDay,
            `${entry.id}: ${item.predicate} chose an older fact at equal authority`,
          );
        }
      }
    }
  }
});

test('staleness is age against the type expiry, and never deletes the value', () => {
  for (const entry of fixture.cases) {
    for (const item of go(entry).recalled) {
      if (item.value === null) {
        assert.equal(item.stale, false, `${entry.id}: an absent fact was called stale`);
        continue;
      }
      const ttl = fixture.policy.ttlDays[item.predicate] ?? fixture.policy.defaultTtlDays;
      assert.equal(item.ageDays, fixture.now - (item.assertedOnDay as number), entry.id);
      assert.equal(item.stale, (item.ageDays as number) > ttl, `${entry.id}: ${item.predicate} staled wrongly`);
    }
  }
});

test('a fact goes stale without ever disappearing', () => {
  const entry = findCase<Case>(fixture, 'the-highest-authority-wins-before-the-most-recent');
  const fresh = go(entry);
  const later = go(entry, entry.request, fixture.now + 10_000);
  assert.equal(fresh.recalled[0].stale, false);
  assert.equal(later.recalled[0].stale, true, 'time did not make the fact stale');
  assert.equal(later.recalled[0].value, fresh.recalled[0].value, 'a stale fact was dropped instead of aged');
  assert.ok((later.recalled[0].ageDays as number) > (fresh.recalled[0].ageDays as number));
});

test('every write is either admitted or rejected with a reason, never both', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const seen = [...outcome.admitted, ...outcome.rejected.map((item) => item.id)];
    assert.deepEqual(
      [...seen].sort(),
      entry.request.writes.map((write) => write.id).sort(),
      `${entry.id}: a write was lost or judged twice`,
    );
    for (const item of outcome.rejected) {
      assert.ok(item.reason.length > 0, `${entry.id}: ${item.id} was rejected without a reason`);
      assert.ok(!outcome.admitted.includes(item.id), `${entry.id}: ${item.id} was both admitted and rejected`);
    }
  }
});

test('a rejected write changes nothing that is recalled', () => {
  for (const entry of fixture.cases) {
    if (entry.request.writes.length === 0) continue;
    const outcome = go(entry);
    if (outcome.admitted.length > 0) continue;
    const without = go(entry, { ...entry.request, writes: [] });
    assert.deepEqual(outcome.recalled, without.recalled, `${entry.id}: a rejected write still moved a value`);
  }
});

test('a model inference and a secret are refused however well provenanced', () => {
  const entry = findCase<Case>(fixture, 'the-highest-authority-wins-before-the-most-recent');
  const base: Fact = {
    id: 'fact-probe',
    tenantId: 'acme',
    subject: 'account:4471',
    predicate: 'payment_terms',
    value: 'net-45',
    source: 'ticket:9000',
    assertedBy: 'human:jvega',
    assertedOnDay: 1799,
    supersedes: null,
  };
  const inference = go(entry, { ...entry.request, writes: [{ ...base, assertedBy: 'model:atlas' }] });
  assert.deepEqual(inference.admitted, [], 'a model inference was written');
  const secret = go(entry, {
    ...entry.request,
    writes: [{ ...base, predicate: fixture.policy.secretPredicates[0] }],
  });
  assert.deepEqual(secret.admitted, [], 'a secret was written');
  const good = go(entry, { ...entry.request, writes: [base] });
  assert.deepEqual(good.admitted, ['fact-probe'], 'a well-formed human assertion was refused');
});
