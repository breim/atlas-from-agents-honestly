import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Admission, Candidate, admit as Admit } from './start.ts';

interface Case {
  id: string;
  candidate: Candidate;
  result: Admission;
}

const fixture = expected<{
  chapter: string;
  trusted: string[];
  pinned: Record<string, string>;
  cases: Case[];
}>(import.meta.url);
const { admit } = await loadImpl<{ admit: typeof Admit }>(import.meta.url);

const run = (entry: Case) => admit(entry.candidate, fixture.pinned, fixture.trusted);

const cases: Array<[string, string]> = [
  ['a-fact-from-trusted-sources-is-admitted', 'well-sourced facts become memory'],
  ['a-fact-derived-from-an-external-source-is-refused', 'retrieved text does not become belief'],
  ['one-external-source-among-many-is-still-a-refusal', 'there is no scoring, only every'],
  ['a-fact-contradicting-a-pinned-value-is-refused', 'pinned values are pinned'],
  ['restating-a-pinned-value-is-admitted', 'agreement is not contradiction'],
  ['an-untrusted-source-is-reported-before-a-contradiction', 'the reason names the first gate'],
  ['a-fact-with-no-sources-is-refused', 'unattributed is untrusted'],
  ['an-unrecognised-source-marking-is-untrusted', 'an unnameable marking fails closed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('nothing with an untrusted source is ever admitted', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).admitted) continue;
    for (const source of entry.candidate.sources) {
      assert.ok(fixture.trusted.includes(source), `${entry.id}: admitted from ${source}`);
    }
  }
});

test('nothing contradicting a pinned value is ever admitted', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).admitted) continue;
    const pin = fixture.pinned[entry.candidate.key];
    if (pin === undefined) continue;
    assert.equal(pin, entry.candidate.value, `${entry.id}: admitted a contradiction`);
  }
});

test('adding an untrusted source always flips an admission to a refusal', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).admitted) continue;
    const tainted = { ...entry.candidate, sources: [...entry.candidate.sources, 'external'] };
    assert.deepEqual(
      admit(tainted, fixture.pinned, fixture.trusted),
      { admitted: false, reason: 'untrusted_source' },
      `${entry.id}: one hostile source did not taint the fact`,
    );
  }
});

test('an admission carries no reason and a refusal always does', () => {
  for (const entry of fixture.cases) {
    const { admitted, reason } = run(entry);
    if (admitted) assert.equal(reason, null, `${entry.id}`);
    else assert.ok(reason, `${entry.id}: refused without a reason`);
  }
});
