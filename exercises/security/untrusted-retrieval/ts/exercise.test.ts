import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Chunk, Policy, Retrieved, Task, retrieve as RetrieveFn } from './start.ts';

interface Case { id: string; chunks: Chunk[]; task: Task; policy: Policy; result: Retrieved }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { retrieve } = await loadImpl<{ retrieve: typeof RetrieveFn }>(import.meta.url);
const go = (entry: Case, chunks = entry.chunks, task = entry.task, policy = entry.policy) =>
  retrieve(chunks, task, policy);

const cases: Array<[string, string]> = [
  ['a-low-authority-task-reads-the-mixed-corpus-and-is-tainted', 'the merge of every writer'],
  ['a-high-authority-task-never-reads-attacker-writable-text', 'the trifecta, broken where it counts'],
  ['a-high-authority-task-on-a-first-party-split-is-served', 'split by trust, route by task'],
  ['the-ratio-is-against-what-competes-for-the-query-not-the-corpus', 'five documents in millions'],
  ['a-source-that-changed-since-ingestion-is-refused', 'a vendor page that turned hostile'],
  ['provenance-inferred-from-content-is-refused', 'a column, not a guess'],
  ['a-first-party-only-corpus-is-not-tainted', 'taint follows provenance'],
  ['nothing-competes-so-there-is-nothing-to-cite', 'citations that resolve to chunk ids'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a refused retrieval hands over nothing', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'refused') continue;
    assert.deepEqual(outcome.chunks, [], `${entry.id}: a refusal returned chunks`);
    assert.deepEqual(outcome.citations, [], `${entry.id}: a refusal returned citations`);
    assert.equal(outcome.tainted, false, `${entry.id}: a refusal tainted the run`);
    assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('a high-authority task refuses every provenance the policy does not allow', () => {
  const entry = findCase<Case>(fixture, 'a-low-authority-task-reads-the-mixed-corpus-and-is-tainted');
  const provenances = [...new Set(entry.chunks.map((chunk) => chunk.provenance))];
  for (const provenance of provenances) {
    if (provenance === 'inferred') continue;
    const only = entry.chunks
      .filter((chunk) => chunk.competesFor.includes(entry.task.query))
      .map((chunk) => ({ ...chunk, provenance }));
    const high = go(entry, only, { ...entry.task, authority: 'high' });
    const allowed = entry.policy.highAuthorityProvenance.includes(provenance);
    assert.equal(high.status === 'served', allowed, `high authority on ${provenance}`);
    const low = go(entry, only, { ...entry.task, authority: 'low' });
    assert.equal(low.status, 'served', `low authority refused ${provenance}`);
  }
});

test('the same corpus is safe for one task and refused for another', () => {
  const entry = findCase<Case>(fixture, 'a-high-authority-task-never-reads-attacker-writable-text');
  const high = go(entry);
  const low = go(entry, entry.chunks, { ...entry.task, authority: 'low' });
  assert.equal(high.status, 'refused', 'a high-authority task read attacker-writable text');
  assert.equal(low.status, 'served', 'a low-authority task was refused the same corpus');
  assert.equal(low.tainted, true, 'reading attacker-writable text left the run untainted');
});

test('the poison ratio ignores everything that does not compete for the query', () => {
  const entry = findCase<Case>(fixture, 'the-ratio-is-against-what-competes-for-the-query-not-the-corpus');
  const small = findCase<Case>(fixture, 'a-low-authority-task-reads-the-mixed-corpus-and-is-tainted');
  const padded = go(entry);
  const bare = go(small);
  assert.ok(entry.chunks.length > small.chunks.length * 5, 'the fixture no longer pads the corpus');
  assert.equal(padded.poisonRatioBps, bare.poisonRatioBps, 'padding the corpus moved the ratio');
  assert.equal(padded.competingForQuery, bare.competingForQuery, 'padding changed what competes');
});

test('the ratio is poisoned over competing, in basis points', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'served') continue;
    const competing = entry.chunks.filter((chunk) => chunk.competesFor.includes(entry.task.query));
    const poisoned = competing.filter((chunk) => chunk.provenance === 'customer-writable').length;
    const owed = competing.length === 0 ? 0 : Math.floor((poisoned * 10000) / competing.length + 0.5);
    assert.equal(outcome.poisonRatioBps, owed, `${entry.id}: the ratio is wrong`);
  }
});

test('a run is tainted exactly when something not first-party is served', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'served') continue;
    const served = entry.chunks.filter((chunk) => outcome.chunks.includes(chunk.id));
    assert.equal(
      outcome.tainted,
      served.some((chunk) => chunk.provenance !== 'first-party'),
      `${entry.id}: taint disagrees with provenance`,
    );
  }
});

test('a source that drifted since ingestion is always refused, and named', () => {
  const entry = findCase<Case>(fixture, 'a-first-party-only-corpus-is-not-tainted');
  for (const chunk of entry.chunks) {
    const drifted = entry.chunks.map((item) =>
      item.id === chunk.id ? { ...item, contentHash: `${item.ingestedHash}-changed` } : item,
    );
    const outcome = go(entry, drifted);
    assert.equal(outcome.status, 'refused', `${chunk.id} changed and was served`);
    assert.deepEqual(outcome.drifted, [chunk.id], `${chunk.id} was not named as drifted`);
  }
});

test('provenance inferred from content is refused wherever it appears', () => {
  const entry = findCase<Case>(fixture, 'a-first-party-only-corpus-is-not-tainted');
  for (const chunk of entry.chunks) {
    const guessed = entry.chunks.map((item) =>
      item.id === chunk.id ? { ...item, provenance: 'inferred' as const } : item,
    );
    const outcome = go(entry, guessed);
    assert.equal(outcome.status, 'refused', `${chunk.id} inferred its provenance and was served`);
    assert.ok(outcome.errors.some((error) => error.includes(chunk.id)), `${chunk.id} was refused silently`);
  }
});

test('every served chunk is cited, and every citation resolves', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.deepEqual(outcome.citations, outcome.chunks, `${entry.id}: citations and chunks disagree`);
    for (const id of outcome.citations) {
      assert.ok(entry.chunks.some((chunk) => chunk.id === id), `${entry.id}: ${id} resolves to nothing`);
    }
  }
});

test('the writer list is every writer behind what was served', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'served') continue;
    const owed = [...new Set(entry.chunks.filter((chunk) => outcome.chunks.includes(chunk.id)).flatMap((chunk) => chunk.writers))].sort();
    assert.deepEqual(outcome.writers, owed, `${entry.id}: the writer audit is wrong`);
  }
});

test('a task with no competing chunks cannot satisfy a citation requirement', () => {
  const entry = findCase<Case>(fixture, 'nothing-competes-so-there-is-nothing-to-cite');
  assert.equal(go(entry).status, 'refused', 'an uncitable answer was served');
  const relaxed = go(entry, entry.chunks, entry.task, { ...entry.policy, requireCitations: false });
  assert.equal(relaxed.status, 'served', 'dropping the citation requirement changed nothing');
  assert.deepEqual(relaxed.chunks, [], 'chunks appeared from nowhere');
});
