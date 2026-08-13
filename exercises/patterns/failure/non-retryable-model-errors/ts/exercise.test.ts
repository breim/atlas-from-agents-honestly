import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Outcome, call as Call } from './start.ts';

interface Case {
  id: string;
  outcomes: string[];
  result: Outcome;
}

const fixture = expected<{ chapter: string; maxAttempts: number; cases: Case[] }>(import.meta.url);
const { call } = await loadImpl<{ call: typeof Call }>(import.meta.url);

const RETRYABLE = ['rate_limit', 'server_error', 'overloaded'];

/** Counts real calls, so a "non-retryable" error that is retried anyway shows up. */
function scripted(outcomes: string[]) {
  let index = 0;
  return {
    attempt: () => outcomes[index++] ?? 'ok',
    calls: () => index,
  };
}

const run = (entry: Case) => {
  const { attempt, calls } = scripted(entry.outcomes);
  return { outcome: call(attempt, fixture.maxAttempts), calls: calls() };
};

const cases: Array<[string, string]> = [
  ['a-first-attempt-that-succeeds-costs-one-call', 'success does not retry'],
  ['a-rate-limit-is-retried', 'a rate limit is worth trying again'],
  ['a-server-error-is-retried', 'so is a server error, twice'],
  ['an-overloaded-provider-is-retried', 'so is an overloaded provider'],
  ['an-invalid-request-is-not-retried', 'a malformed request will fail identically'],
  ['a-rejected-credential-is-not-retried', 'a bad key does not become good'],
  ['a-prompt-over-the-context-limit-is-not-retried', 'the prompt will not shrink on its own'],
  ['a-non-retryable-error-after-a-retryable-one-stops-immediately', 'the ladder stops on the first fatal error'],
  ['retries-are-bounded', 'exhausted is not the same as failed'],
  ['an-unknown-error-is-treated-as-non-retryable', 'an unknown code does not multiply traffic'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry).outcome, entry.result);
  });
}

test('the reported attempt count is the real number of calls', () => {
  for (const entry of fixture.cases) {
    const { outcome, calls } = run(entry);
    assert.equal(outcome.attempts, calls, `${entry.id}: attempts is not what happened`);
  }
});

test('a non-retryable error is never called again', () => {
  for (const entry of fixture.cases) {
    const { outcome, calls } = run(entry);
    if (outcome.status !== 'failed') continue;
    assert.equal(
      entry.outcomes[calls - 1],
      outcome.lastError,
      `${entry.id}: stopped on a different error than it reported`,
    );
    assert.ok(!RETRYABLE.includes(outcome.lastError!), `${entry.id}: gave up on a retryable error`);
  }
});

test('nothing ever exceeds the attempt budget', () => {
  for (const entry of fixture.cases) {
    assert.ok(run(entry).calls <= fixture.maxAttempts, `${entry.id}: over the attempt budget`);
  }
});

test('success reports no error, failure always reports one', () => {
  for (const entry of fixture.cases) {
    const { outcome } = run(entry);
    if (outcome.status === 'ok') assert.equal(outcome.lastError, null, `${entry.id}`);
    else assert.ok(outcome.lastError, `${entry.id}: failed without naming an error`);
  }
});
