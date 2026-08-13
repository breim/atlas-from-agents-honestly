import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Authorisation, Signed, authorise as Authorise } from './start.ts';

interface Case {
  id: string;
  approvals: Signed[];
  verdict: Authorisation;
}

const fixture = expected<{
  chapter: string;
  request: Signed;
  required: number;
  cases: Case[];
}>(import.meta.url);
const { authorise } = await loadImpl<{ authorise: typeof Authorise }>(import.meta.url);

const run = (entry: Case) => authorise(fixture.request, entry.approvals, fixture.required);

const cases: Array<[string, string]> = [
  ['two-distinct-approvers-authorise-the-action', 'two people is two people'],
  ['one-approval-is-not-enough', 'one signature does not clear a two-person gate'],
  ['the-same-person-twice-is-not-two-people', 'distinct identities, not events'],
  ['the-requester-cannot-approve-their-own-request', 'dual control excludes the requester'],
  ['an-approval-for-a-different-action-does-not-count', 'signatures bind to an exact action'],
  ['extra-approvals-do-not-hurt', 'more than enough is still enough'],
  ['no-approvals-authorise-nothing', 'nothing signed is nothing authorised'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.verdict);
  });
}

test('the requester never appears among the approvers', () => {
  for (const entry of fixture.cases) {
    assert.ok(
      !run(entry).approvers.includes(fixture.request.by),
      `${entry.id}: the requester signed their own request`,
    );
  }
});

test('approvers are distinct', () => {
  for (const entry of fixture.cases) {
    const { approvers } = run(entry);
    assert.equal(new Set(approvers).size, approvers.length, `${entry.id}: a duplicate counted`);
  }
});

test('every approver actually signed this exact action', () => {
  for (const entry of fixture.cases) {
    for (const approver of run(entry).approvers) {
      const signed = entry.approvals.some(
        (approval) => approval.by === approver && approval.action === fixture.request.action,
      );
      assert.ok(signed, `${entry.id}: ${approver} never signed this action`);
    }
  }
});

test('authorisation happens exactly when enough distinct approvers signed', () => {
  for (const entry of fixture.cases) {
    const { authorised, approvers, reason } = run(entry);
    assert.equal(authorised, approvers.length >= fixture.required, `${entry.id}`);
    assert.equal(reason === null, authorised, `${entry.id}: reason disagrees with the verdict`);
  }
});
