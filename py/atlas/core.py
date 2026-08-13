from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
import json
from typing import Any, Callable, Literal

Trust = Literal["reviewed", "external"]


@dataclass(frozen=True)
class Chunk:
    id: str
    tenant_id: str
    trust: Trust
    text: str


@dataclass(frozen=True)
class Approval:
    action_hash: str
    expires_at_ms: int


@dataclass(frozen=True)
class RunContext:
    run_id: str
    tenant_id: str
    account_ids: frozenset[str]
    tainted: bool
    now_ms: int
    approval: Approval | None = None


@dataclass(frozen=True)
class CreditCall:
    account_id: str
    order_id: str
    amount_cents: int
    tool: Literal["issue_credit"] = "issue_credit"


@dataclass(frozen=True)
class DispatchResult:
    status: Literal["completed", "denied"]
    reason: str | None = None
    duplicate: bool | None = None


class LostResponse(RuntimeError):
    pass


@dataclass
class CreditLedger:
    effects: dict[str, int] = field(default_factory=dict)
    completed: set[str] = field(default_factory=set)

    def issue(self, key: str, amount_cents: int, lose_response: bool = False) -> DispatchResult:
        if key in self.completed:
            return DispatchResult(status="completed", duplicate=True)

        if key in self.effects:
            self.completed.add(key)
            return DispatchResult(status="completed", duplicate=True)

        self.effects[key] = amount_cents
        if lose_response:
            raise LostResponse("effect_succeeded_response_lost")

        self.completed.add(key)
        return DispatchResult(status="completed", duplicate=False)


def action_hash(call: CreditCall) -> str:
    canonical = json.dumps(
        {
            "accountId": call.account_id,
            "amountCents": call.amount_cents,
            "orderId": call.order_id,
            "tool": call.tool,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    return sha256(canonical.encode()).hexdigest()


def idempotency_key(ctx: RunContext, call: CreditCall) -> str:
    value = f"{ctx.run_id}\0{call.tool}\0{call.order_id}"
    return sha256(value.encode()).hexdigest()


def dispatch_credit(
    call: CreditCall,
    ctx: RunContext,
    ledger: CreditLedger,
    lose_response: bool = False,
) -> DispatchResult:
    if ctx.tainted:
        return DispatchResult(status="denied", reason="taint_ceiling")
    if call.account_id not in ctx.account_ids:
        return DispatchResult(status="denied", reason="account_out_of_scope")

    if call.amount_cents > 5000:
        if ctx.approval is None:
            return DispatchResult(status="denied", reason="approval_required")
        if ctx.approval.expires_at_ms <= ctx.now_ms:
            return DispatchResult(status="denied", reason="approval_expired")
        if ctx.approval.action_hash != action_hash(call):
            return DispatchResult(status="denied", reason="approval_action_mismatch")

    return ledger.issue(idempotency_key(ctx, call), call.amount_cents, lose_response)


def filter_retrieval(chunks: list[Chunk], tenant_id: str) -> list[Chunk]:
    return [chunk for chunk in chunks if chunk.tenant_id == tenant_id]


def taint_from(chunks: list[Chunk]) -> bool:
    return any(chunk.trust == "external" for chunk in chunks)


@dataclass(frozen=True)
class WebhookEvent:
    id: str
    source_version: int
    payload: Any


@dataclass
class Inbox:
    events: dict[str, WebhookEvent] = field(default_factory=dict)

    def receive(self, event: WebhookEvent) -> bool:
        if event.id in self.events:
            return False
        self.events[event.id] = event
        return True


def run_bounded_loop(
    max_steps: int,
    decide: Callable[[int], Literal["continue", "stop"]],
) -> tuple[Literal["completed", "bounded"], int]:
    for step in range(1, max_steps + 1):
        if decide(step) == "stop":
            return "completed", step
    return "bounded", max_steps
