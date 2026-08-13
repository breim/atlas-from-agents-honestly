import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Verdict, check as Check } from './start.ts';

interface Case {
  id: string;
  tool: string;
  trust: string;
  verdict: Verdict;
}

const fixture = expected<{
  chapter: string;
  grants: string[];
  tools: Record<string, string>;
  cases: Case[];
}>(import.meta.url);
const { check } = await loadImpl<{ check: typeof Check }>(import.meta.url);

const run = (entry: Case) => check(entry.tool, entry.trust, fixture.grants, fixture.tools);

const cases: Array<[string, string]> = [
  ['a-granted-read-under-a-clean-context-is-allowed', 'the ordinary path works'],
  ['a-granted-write-under-a-clean-context-is-allowed', 'a clean context can still act'],
  ['a-read-is-allowed-even-under-a-tainted-context', 'taint does not make the agent useless'],
  ['a-write-under-a-tainted-context-is-denied', 'hostile evidence cannot reach an effect'],
  ['a-write-under-a-reviewed-context-is-allowed', 'reviewed is not tainted'],
  ['an-ungranted-tool-is-denied-even-under-a-clean-context', 'a clean context is not a grant'],
  ['an-ungranted-tool-is-denied-for-the-grant-not-the-taint', 'the reason names the first gate'],
  ['an-unknown-tool-is-denied', 'a tool that does not exist is refused, not thrown'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.verdict);
  });
}

test('nothing outside the grant is ever allowed', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).allowed) continue;
    assert.ok(fixture.grants.includes(entry.tool), `${entry.id}: allowed ungranted ${entry.tool}`);
  }
});

test('no write is ever allowed from a tainted context', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).allowed) continue;
    const isWrite = fixture.tools[entry.tool] === 'write';
    assert.ok(!(isWrite && entry.trust === 'external'), `${entry.id}: a tainted write got through`);
  }
});

test('an allowed verdict carries no reason, a denial always does', () => {
  for (const entry of fixture.cases) {
    const { allowed, reason } = run(entry);
    if (allowed) assert.equal(reason, null, `${entry.id}: allowed with a reason`);
    else assert.ok(reason, `${entry.id}: denied without one`);
  }
});

test('every grant-and-trust combination is decidable without throwing', () => {
  for (const tool of [...Object.keys(fixture.tools), 'nonexistent']) {
    for (const trust of ['system', 'reviewed', 'external', 'unknown']) {
      assert.doesNotThrow(
        () => check(tool, trust, fixture.grants, fixture.tools),
        `${tool} at ${trust} threw`,
      );
    }
  }
});
