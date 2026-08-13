import { createHash } from 'node:crypto';

export type Trust = 'reviewed' | 'external';

export interface Chunk {
  id: string;
  tenantId: string;
  trust: Trust;
  text: string;
}

export interface RunContext {
  runId: string;
  tenantId: string;
  accountIds: ReadonlySet<string>;
  tainted: boolean;
  nowMs: number;
  approval?: { actionHash: string; expiresAtMs: number };
}

export interface CreditCall {
  tool: 'issue_credit';
  accountId: string;
  orderId: string;
  amountCents: number;
}

export interface DispatchResult {
  status: 'completed' | 'denied';
  reason?: string;
  duplicate?: boolean;
}

export class LostResponse extends Error {}

export class CreditLedger {
  readonly effects = new Map<string, number>();
  readonly completed = new Set<string>();

  issue(key: string, amountCents: number, loseResponse = false): DispatchResult {
    if (this.completed.has(key)) {
      return { status: 'completed', duplicate: true };
    }

    if (this.effects.has(key)) {
      this.completed.add(key);
      return { status: 'completed', duplicate: true };
    }

    this.effects.set(key, amountCents);
    if (loseResponse) throw new LostResponse('effect_succeeded_response_lost');

    this.completed.add(key);
    return { status: 'completed', duplicate: false };
  }
}

export function actionHash(call: CreditCall): string {
  return createHash('sha256')
    .update(JSON.stringify({
      accountId: call.accountId,
      amountCents: call.amountCents,
      orderId: call.orderId,
      tool: call.tool,
    }))
    .digest('hex');
}

export function idempotencyKey(ctx: RunContext, call: CreditCall): string {
  return createHash('sha256')
    .update(`${ctx.runId}\u0000${call.tool}\u0000${call.orderId}`)
    .digest('hex');
}

export function dispatchCredit(
  call: CreditCall,
  ctx: RunContext,
  ledger: CreditLedger,
  loseResponse = false,
): DispatchResult {
  if (ctx.tainted) return { status: 'denied', reason: 'taint_ceiling' };
  if (!ctx.accountIds.has(call.accountId)) {
    return { status: 'denied', reason: 'account_out_of_scope' };
  }

  if (call.amountCents > 5000) {
    if (!ctx.approval) return { status: 'denied', reason: 'approval_required' };
    if (ctx.approval.expiresAtMs <= ctx.nowMs) {
      return { status: 'denied', reason: 'approval_expired' };
    }
    if (ctx.approval.actionHash !== actionHash(call)) {
      return { status: 'denied', reason: 'approval_action_mismatch' };
    }
  }

  return ledger.issue(idempotencyKey(ctx, call), call.amountCents, loseResponse);
}

export function filterRetrieval(chunks: Chunk[], tenantId: string): Chunk[] {
  return chunks.filter((chunk) => chunk.tenantId === tenantId);
}

export function taintFrom(chunks: Chunk[]): boolean {
  return chunks.some((chunk) => chunk.trust === 'external');
}

export interface WebhookEvent {
  id: string;
  sourceVersion: number;
  payload: unknown;
}

export class Inbox {
  readonly events = new Map<string, WebhookEvent>();

  receive(event: WebhookEvent): boolean {
    if (this.events.has(event.id)) return false;
    this.events.set(event.id, event);
    return true;
  }
}

export function runBoundedLoop(maxSteps: number, decide: (step: number) => 'continue' | 'stop') {
  for (let step = 1; step <= maxSteps; step += 1) {
    if (decide(step) === 'stop') return { status: 'completed' as const, steps: step };
  }
  return { status: 'bounded' as const, steps: maxSteps };
}
