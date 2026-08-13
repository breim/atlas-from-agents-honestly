import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Claim, ground as Ground } from './start.ts';

interface Case {
  id: string;
  claims: Claim[];
  grounded: Claim[];
}

const fixture = expected<{ chapter: string; sources: string[]; cases: Case[] }>(import.meta.url);
const { ground } = await loadImpl<{ ground: typeof Ground }>(import.meta.url);

const run = (entry: Case) => ground(entry.claims, fixture.sources);

const cases: Array<[string, string]> = [
  ['a-cited-claim-survives', 'a properly cited claim is returned untouched'],
  ['an-uncited-claim-is-dropped', 'a claim with no citation does not survive'],
  ['a-claim-citing-only-unknown-sources-is-dropped', 'stripping citations must also drop the claim'],
  ['unknown-citations-are-stripped-from-a-valid-claim', 'an invented citation is removed'],
  ['duplicate-citations-collapse', 'the same source is cited once'],
  ['citations-keep-the-order-they-were-given', 'citation order is not sorted'],
  ['surviving-claims-keep-their-order', 'dropping a claim does not reorder the rest'],
  ['nothing-in-nothing-out', 'no claims is an empty list'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.grounded);
  });
}

test('every surviving claim carries at least one citation', () => {
  for (const entry of fixture.cases) {
    for (const claim of run(entry)) {
      assert.ok(claim.cites.length > 0, `${entry.id}: "${claim.text}" survived ungrounded`);
    }
  }
});

test('no citation names a source that was never retrieved', () => {
  const retrieved = new Set(fixture.sources);
  for (const entry of fixture.cases) {
    for (const claim of run(entry)) {
      for (const cite of claim.cites) {
        assert.ok(retrieved.has(cite), `${entry.id}: cited ${cite}, which was never retrieved`);
      }
    }
  }
});

test('claim text is never edited', () => {
  for (const entry of fixture.cases) {
    const original = new Set(entry.claims.map((claim) => claim.text));
    for (const claim of run(entry)) {
      assert.ok(original.has(claim.text), `${entry.id}: claim text was rewritten`);
    }
  }
});
