def resolve(spec: dict, event: dict, policy: dict) -> dict:
    # Every gate answers three questions. Fewer than three is an undefined state.
    errors = []
    if spec["onSilence"] is None:
        errors.append(f"{spec['id']} does not say what happens if nobody responds")
    if spec["backup"] is None:
        errors.append(f"{spec['id']} names no backup")
    if spec["expiresAfterMs"] is None:
        errors.append(f"{spec['id']} never expires")
    # Fail closed: silence is denial, never approval.
    if spec["onSilence"] == "approve":
        errors.append(f"{spec['id']} approves on silence, which fails open")

    if errors:
        return {
            "status": "undefined-gate",
            "errors": errors,
            "outcome": "none",
            "queued": False,
            "record": None,
        }

    answered = event["kind"] == "answered"
    outcome = "approved" if answered and event.get("answer") == "approve" else "denied"

    # A timeout denial and a judgement denial are different events; say which.
    if outcome == "approved":
        denial_kind = None
    elif event["kind"] == "timeout":
        denial_kind = "timeout"
    elif answered:
        denial_kind = "judgement"
    else:
        denial_kind = "fault"

    record = {
        "gate": spec["id"],
        "outcome": outcome,
        "denialKind": denial_kind,
        "reviewer": event.get("reviewer") or spec["backup"],
        "reasoning": event.get("reasoning")
        or f"no reviewer response: {event['kind']}",
        # The rendered card as bytes. Re-rendering later produces a different card.
        "card": event.get("card") or "",
        "control": event.get("control") or "hard",
        # Retention is a decision, and keeping everything forever is a liability.
        "retentionDays": min(policy["retentionDays"], policy["maxRetentionDays"]),
    }

    if record["card"] == "":
        errors.append(
            f"{spec['id']} recorded no rendered card, so nothing proves what was shown"
        )

    return {
        "status": "recorded",
        "errors": errors,
        "outcome": outcome,
        # Auto-deny is not the end of the case. It routes to a human.
        "queued": outcome == "denied" and denial_kind != "judgement",
        "record": record,
    }
