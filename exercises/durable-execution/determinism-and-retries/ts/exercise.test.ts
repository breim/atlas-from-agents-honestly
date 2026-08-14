import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Execution, Outcome, Policy, execute as Execute } from './start.ts';

interface Case {
  id: string;
  policy: string;
  outcomes: Outcome[];
  result: Execution;
}

interface Fixture {
  chapter: string;
  policies: Record<string, Policy>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { execute } = await loadImpl<{ execute: typeof Execute }>(import.meta.url);

const policyFor = (entry: Case) => fixture.policies[entry.policy];
const run = (entry: Case) => execute(policyFor(entry), entry.outcomes);
const spent = (entry: Case, attempts: number) =>
  entry.outcomes.slice(0, attempts).reduce((sum, outcome) => sum + outcome.durationMs, 0);

const cases: Array<[string, string]> = [
  ['an-attempt-that-succeeds-costs-no-retries', 'a first-try success stops there'],
  ['a-transient-failure-is-retried', 'a timeout gets another go, after a wait'],
  ['the-wait-doubles-between-attempts', 'the backoff compounds'],
  ['the-wait-stops-doubling-at-the-maximum', 'the interval cap holds the wait down'],
  ['a-business-rejection-is-not-retried', 'the credit limit will be exceeded next time too'],
  ['an-infrastructure-failure-in-the-same-place-is-retried', 'the taxonomy decides, not the call site'],
  ['the-attempt-cap-ends-the-retrying', 'a bounded policy eventually gives up'],
  ['a-cap-of-one-means-no-retries-at-all', 'one attempt is one attempt'],
  ['the-deadline-refuses-a-retry-it-cannot-fit', 'no point waiting past the deadline'],
  ['an-unlimited-policy-never-fails-and-never-finishes', 'the execution reads RUNNING the whole time'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a bounded policy never makes more attempts than it allows', () => {
  for (const entry of fixture.cases) {
    const { maximumAttempts } = policyFor(entry);
    if (maximumAttempts === 0) continue;
    assert.ok(run(entry).attempts <= maximumAttempts, `${entry.id}: the cap was overrun`);
  }
});

const firstBlocked = (entry: Case, blocked: string[]) =>
  entry.outcomes.findIndex((outcome) => outcome.error !== null && blocked.includes(outcome.error));

test('an error the policy calls non-retryable is never attempted twice', () => {
  for (const entry of fixture.cases) {
    const first = firstBlocked(entry, policyFor(entry).nonRetryable);
    if (first === -1) continue;
    const result = run(entry);
    assert.equal(result.status, 'non_retryable', `${entry.id}: a certain failure was not reported as one`);
    assert.equal(result.attempts, first + 1, `${entry.id}: attempts were spent on a certain failure`);
  }
});

test('marking any error non-retryable makes it terminal', () => {
  for (const entry of fixture.cases) {
    const failure = entry.outcomes.find((outcome) => outcome.error !== null)?.error;
    if (!failure) continue;
    const policy = { ...policyFor(entry), nonRetryable: [failure] };
    const result = execute(policy, entry.outcomes);
    assert.equal(result.status, 'non_retryable', `${entry.id}: the policy was not consulted`);
    assert.equal(result.attempts, firstBlocked(entry, [failure]) + 1, entry.id);
    assert.equal(result.lastError, failure, entry.id);
  }
});

test('marking an error non-retryable never buys more attempts', () => {
  for (const entry of fixture.cases) {
    const before = run(entry);
    if (before.lastError === null) continue;
    const policy = { ...policyFor(entry), nonRetryable: [...policyFor(entry).nonRetryable, before.lastError] };
    const after = execute(policy, entry.outcomes);
    assert.ok(after.attempts <= before.attempts, `${entry.id}: narrowing the policy widened the retrying`);
  }
});

test('completed means the last attempt made is the one that succeeded', () => {
  for (const entry of fixture.cases) {
    const { status, attempts, lastError } = run(entry);
    const succeeded = entry.outcomes[attempts - 1]?.error === null;
    assert.equal(status === 'completed', succeeded, `${entry.id}: the status disagrees with the attempt`);
    if (status === 'completed') assert.equal(lastError, null, `${entry.id}: a success carried an error`);
  }
});

test('the elapsed time covers at least the attempts that ran', () => {
  for (const entry of fixture.cases) {
    const { attempts, elapsedMs } = run(entry);
    assert.ok(elapsedMs >= spent(entry, attempts), `${entry.id}: time went missing`);
  }
});

test('the waiting never exceeds one maximum interval per gap', () => {
  for (const entry of fixture.cases) {
    const { attempts, elapsedMs } = run(entry);
    const waited = elapsedMs - spent(entry, attempts);
    assert.ok(waited <= attempts * policyFor(entry).maximumIntervalMs, `${entry.id}: waited past the cap`);
  }
});

test('retrying means every attempt made failed, and none was certain to fail again', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (result.status !== 'retrying') continue;
    assert.equal(result.attempts, entry.outcomes.length, `${entry.id}: gave up while still retrying`);
    for (const outcome of entry.outcomes) {
      assert.notEqual(outcome.error, null, `${entry.id}: retried past a success`);
      assert.ok(!policyFor(entry).nonRetryable.includes(outcome.error!), entry.id);
    }
  }
});

test('a tighter deadline never buys more attempts', () => {
  for (const entry of fixture.cases) {
    const policy = policyFor(entry);
    const tighter = { ...policy, scheduleToCloseMs: Math.floor(policy.scheduleToCloseMs / 2) };
    assert.ok(
      execute(tighter, entry.outcomes).attempts <= run(entry).attempts,
      `${entry.id}: less time allowed more work`,
    );
  }
});

test('a larger attempt cap never buys fewer attempts', () => {
  for (const entry of fixture.cases) {
    const policy = policyFor(entry);
    if (policy.maximumAttempts === 0) continue;
    const looser = { ...policy, maximumAttempts: policy.maximumAttempts + 1 };
    assert.ok(
      execute(looser, entry.outcomes).attempts >= run(entry).attempts,
      `${entry.id}: a bigger cap did less work`,
    );
  }
});
