import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Action, Approval, Verdict, gate as Gate } from './start.ts';

interface Case {
  id: string;
  approval: Approval | null;
  verdict: Verdict;
}

const fixture = expected<{ chapter: string; action: Action; now: number; cases: Case[] }>(
  import.meta.url,
);
const { gate } = await loadImpl<{ gate: typeof Gate }>(import.meta.url);

const run = (entry: Case) => gate(fixture.action, entry.approval, fixture.now);

const cases: Array<[string, string]> = [
  ['no-approval-is-a-denial-not-a-pass', 'a missing approval fails closed'],
  ['a-matching-unexpired-approval-allows-the-effect', 'the exact approved action goes through'],
  ['an-approval-for-a-different-amount-is-refused', 'approving 500 does not approve 9000'],
  ['an-approval-for-a-different-account-is-refused', 'the account is part of what was approved'],
  ['an-approval-for-a-different-tool-is-refused', 'so is the tool'],
  ['an-expired-approval-is-refused', 'consent has a shelf life'],
  ['expiry-is-exclusive-at-the-boundary', 'at the expiry moment it is already dead'],
  ['a-mismatched-approval-is-refused-for-the-mismatch-not-the-expiry', 'the reason names the real problem'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.verdict);
  });
}

test('an allowed verdict never carries a reason, a denial always does', () => {
  for (const entry of fixture.cases) {
    const { allowed, reason } = run(entry);
    if (allowed) assert.equal(reason, null, `${entry.id}: allowed with a reason`);
    else assert.ok(reason, `${entry.id}: denied without a reason`);
  }
});

test('nothing is allowed without an approval that matches the action exactly', () => {
  const { tool, account, cents } = fixture.action;
  for (const entry of fixture.cases) {
    if (!run(entry).allowed) continue;
    assert.equal(
      entry.approval?.hash,
      `${tool}|${account}|${cents}`,
      `${entry.id}: allowed on a hash that is not this action`,
    );
  }
});

test('nothing is allowed once the approval has expired', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).allowed) continue;
    assert.ok(fixture.now < entry.approval!.expiresAt, `${entry.id}: allowed an expired approval`);
  }
});
