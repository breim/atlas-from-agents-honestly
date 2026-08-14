import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Run, Step, run as RunFn } from './start.ts';

interface Case {
  id: string;
  program?: Step[];
  journal: Step[];
  crashAfter: number;
  result: Run;
}

const fixture = expected<{ chapter: string; program: Step[]; cases: Case[] }>(import.meta.url);
const { run } = await loadImpl<{ run: typeof RunFn }>(import.meta.url);

const programOf = (entry: Case) => entry.program ?? fixture.program;
const execute = (entry: Case) => run(programOf(entry), entry.journal, entry.crashAfter);
const names = (steps: Step[]) => steps.map((step) => step.name);

const cases: Array<[string, string]> = [
  ['a-first-run-executes-every-step', 'an empty journal means everything runs'],
  ['a-crash-keeps-the-effects-that-completed', 'the journal outlives the process'],
  ['recovery-does-not-re-run-a-journalled-effect', 'the credit is not issued twice'],
  ['a-full-journal-makes-no-calls-at-all', 'catching up is free'],
  ['a-journal-that-does-not-match-the-code-is-a-replay-error', 'the runtime lost its place'],
  ['a-crash-before-the-first-effect-journals-nothing', 'nothing happened, so nothing is recorded'],
  ['a-crash-mid-recovery-only-journals-the-new-effect', 'replay writes nothing; execution does'],
  ['a-program-with-no-effects-completes-immediately', 'no effects, no journal'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(execute(entry), entry.result);
  });
}

test('a step already in the journal is never executed', () => {
  for (const entry of fixture.cases) {
    const recorded = new Set(names(entry.journal));
    for (const name of execute(entry).executed) {
      assert.ok(!recorded.has(name), `${entry.id}: ${name} ran a second time`);
    }
  }
});

test('the journal is only ever appended to', () => {
  for (const entry of fixture.cases) {
    const after = execute(entry).journal;
    assert.deepEqual(after.slice(0, entry.journal.length), entry.journal, `${entry.id}: history was rewritten`);
  }
});

test('the journal that comes out is the one that went in plus what executed', () => {
  for (const entry of fixture.cases) {
    const { journal, executed } = execute(entry);
    assert.deepEqual(names(journal), [...names(entry.journal), ...executed], entry.id);
  }
});

test('a run that did not complete returns nothing', () => {
  for (const entry of fixture.cases) {
    const result = execute(entry);
    if (result.status === 'completed') continue;
    assert.deepEqual(result.results, [], `${entry.id}: a dead run returned a value`);
  }
});

test('a completed run returns one result per step, whatever it replayed', () => {
  for (const entry of fixture.cases) {
    const result = execute(entry);
    if (result.status !== 'completed') continue;
    assert.deepEqual(result.results, programOf(entry).map((step) => step.result), entry.id);
  }
});

test('a divergent journal is left exactly as it was found', () => {
  for (const entry of fixture.cases) {
    const result = execute(entry);
    if (result.status !== 'non_determinism') continue;
    assert.deepEqual(result.journal, entry.journal, `${entry.id}: a lost execution wrote to the journal`);
    assert.deepEqual(result.executed, [], `${entry.id}: a lost execution ran an effect`);
  }
});

test('replaying a completed run executes nothing', () => {
  for (const entry of fixture.cases) {
    const first = execute(entry);
    if (first.status !== 'completed') continue;
    const again = run(programOf(entry), first.journal, entry.crashAfter);
    assert.deepEqual(again.executed, [], `${entry.id}: a replay called out to the world`);
    assert.deepEqual(again.results, first.results, entry.id);
  }
});

test('crashing after every single effect still runs each effect exactly once', () => {
  for (const entry of fixture.cases) {
    const clean = run(programOf(entry), [], programOf(entry).length);
    if (clean.status !== 'completed') continue;

    const executed: string[] = [];
    let journal: Step[] = [];
    let attempt = run(programOf(entry), journal, 1);
    for (let recovery = 0; recovery <= programOf(entry).length && attempt.status === 'crashed'; recovery += 1) {
      executed.push(...attempt.executed);
      journal = attempt.journal;
      attempt = run(programOf(entry), journal, 1);
    }
    executed.push(...attempt.executed);

    assert.equal(attempt.status, 'completed', `${entry.id}: crash-resume never converged`);
    assert.deepEqual(attempt.results, clean.results, `${entry.id}: recovery changed the answer`);
    assert.deepEqual(executed, names(programOf(entry)), `${entry.id}: an effect ran twice, or not at all`);
  }
});
