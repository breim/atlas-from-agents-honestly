import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CreditLedger,
  Inbox,
  LostResponse,
  dispatchCredit,
  filterRetrieval,
  runBoundedLoop,
  taintFrom,
  type Chunk,
  type CreditCall,
  type RunContext,
} from './core.ts';

const fixture = JSON.parse(
  readFileSync(new URL('../../shared/cases.json', import.meta.url), 'utf8'),
);

const call: CreditCall = {
  tool: 'issue_credit',
  accountId: fixture.account,
  orderId: fixture.order,
  amountCents: 5000,
};

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    runId: 'run-8823',
    tenantId: fixture.tenant,
    accountIds: new Set([fixture.account]),
    tainted: false,
    nowMs: Date.parse('2026-08-09T10:00:00Z'),
    ...overrides,
  };
}

test('effect succeeds and a lost response never creates a second credit', () => {
  const ledger = new CreditLedger();
  assert.throws(() => dispatchCredit(call, context(), ledger, true), LostResponse);

  const retry = dispatchCredit(call, context(), ledger);
  assert.equal(retry.status, 'completed');
  assert.equal(retry.duplicate, true);
  assert.equal(ledger.effects.size, 1);
});

test('duplicated webhook is persisted once', () => {
  const inbox = new Inbox();
  const event = { id: 'evt-44', sourceVersion: 7, payload: { ticket: 8823 } };

  assert.equal(inbox.receive(event), true);
  assert.equal(inbox.receive(event), false);
  assert.equal(inbox.events.size, 1);
});

test('retrieval never crosses the tenant boundary', () => {
  const chunks = [fixture.safeChunk, fixture.forbiddenChunk] as Chunk[];
  const visible = filterRetrieval(chunks, fixture.tenant);

  assert.deepEqual(visible.map((chunk) => chunk.id), [fixture.safeChunk.id]);
});

test('hostile retrieval taints the run and blocks a credit', () => {
  const chunks = [fixture.safeChunk, fixture.hostileChunk] as Chunk[];
  const visible = filterRetrieval(chunks, fixture.tenant);
  const result = dispatchCredit(call, context({ tainted: taintFrom(visible) }), new CreditLedger());

  assert.deepEqual(result, { status: 'denied', reason: 'taint_ceiling' });
});

test('approval expiry is checked at the point of effect', () => {
  const expensive = { ...call, amountCents: 9000 };
  const result = dispatchCredit(
    expensive,
    context({ approval: { actionHash: 'stale-card', expiresAtMs: Date.parse('2026-08-08T10:00:00Z') } }),
    new CreditLedger(),
  );

  assert.deepEqual(result, { status: 'denied', reason: 'approval_expired' });
});

test('an uncooperative agent still stops at the hard bound', () => {
  assert.deepEqual(runBoundedLoop(8, () => 'continue'), { status: 'bounded', steps: 8 });
});
