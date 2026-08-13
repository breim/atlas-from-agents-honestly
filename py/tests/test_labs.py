from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
import json
from pathlib import Path
import unittest

from atlas.core import (
    Approval,
    Chunk,
    CreditCall,
    CreditLedger,
    Inbox,
    LostResponse,
    RunContext,
    WebhookEvent,
    dispatch_credit,
    filter_retrieval,
    run_bounded_loop,
    taint_from,
)

FIXTURE = json.loads(
    (Path(__file__).parents[2] / "shared" / "cases.json").read_text()
)


def epoch_ms(value: str) -> int:
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


def chunk(value: dict[str, str]) -> Chunk:
    return Chunk(
        id=value["id"],
        tenant_id=value["tenantId"],
        trust=value["trust"],
        text=value["text"],
    )


CALL = CreditCall(
    account_id=FIXTURE["account"],
    order_id=FIXTURE["order"],
    amount_cents=5000,
)


def context(**overrides: object) -> RunContext:
    base = RunContext(
        run_id="run-8823",
        tenant_id=FIXTURE["tenant"],
        account_ids=frozenset([FIXTURE["account"]]),
        tainted=False,
        now_ms=epoch_ms("2026-08-09T10:00:00Z"),
    )
    return replace(base, **overrides)


class AtlasFailureLabs(unittest.TestCase):
    def test_lost_response_never_creates_a_second_credit(self) -> None:
        ledger = CreditLedger()
        with self.assertRaises(LostResponse):
            dispatch_credit(CALL, context(), ledger, lose_response=True)

        retry = dispatch_credit(CALL, context(), ledger)
        self.assertEqual(retry.status, "completed")
        self.assertTrue(retry.duplicate)
        self.assertEqual(len(ledger.effects), 1)

    def test_duplicated_webhook_is_persisted_once(self) -> None:
        inbox = Inbox()
        event = WebhookEvent(id="evt-44", source_version=7, payload={"ticket": 8823})

        self.assertTrue(inbox.receive(event))
        self.assertFalse(inbox.receive(event))
        self.assertEqual(len(inbox.events), 1)

    def test_retrieval_never_crosses_tenant_boundary(self) -> None:
        visible = filter_retrieval(
            [chunk(FIXTURE["safeChunk"]), chunk(FIXTURE["forbiddenChunk"])],
            FIXTURE["tenant"],
        )
        self.assertEqual([item.id for item in visible], [FIXTURE["safeChunk"]["id"]])

    def test_hostile_retrieval_taints_and_blocks_credit(self) -> None:
        visible = filter_retrieval(
            [chunk(FIXTURE["safeChunk"]), chunk(FIXTURE["hostileChunk"])],
            FIXTURE["tenant"],
        )
        result = dispatch_credit(
            CALL,
            context(tainted=taint_from(visible)),
            CreditLedger(),
        )
        self.assertEqual(result.reason, "taint_ceiling")

    def test_approval_expiry_is_checked_at_effect_time(self) -> None:
        expensive = replace(CALL, amount_cents=9000)
        result = dispatch_credit(
            expensive,
            context(
                approval=Approval(
                    action_hash="stale-card",
                    expires_at_ms=epoch_ms("2026-08-08T10:00:00Z"),
                )
            ),
            CreditLedger(),
        )
        self.assertEqual(result.reason, "approval_expired")

    def test_uncooperative_agent_stops_at_hard_bound(self) -> None:
        self.assertEqual(run_bounded_loop(8, lambda _: "continue"), ("bounded", 8))


if __name__ == "__main__":
    unittest.main()
