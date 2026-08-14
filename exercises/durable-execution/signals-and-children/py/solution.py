def _validate(state: dict, message: dict, limit: int):
    if state["phase"] != "awaiting-approval":
        return "invalid_phase"
    if message.get("amountCents", 0) > limit:
        return "above_limit"
    return None


def apply(messages: list, limit: int) -> dict:
    state = {"started": False, "phase": None, "approvedCents": None}
    history = []
    responses = []

    for message in messages:
        if message["kind"] == "signal_with_start" and not state["started"]:
            state["started"] = True
            state["phase"] = "awaiting-approval"
            history.append("started")

        if not state["started"]:
            responses.append({"ok": False, "error": "not_running"})
            continue

        # A getter: no mutation, and nothing written down, which is what makes polling cheap.
        if message["kind"] == "query":
            responses.append({"ok": True, "value": state["phase"]})
            continue

        if message["kind"] == "update":
            # Read-only, and it runs before anything is recorded.
            error = _validate(state, message, limit)
            if error:
                responses.append({"ok": False, "error": error})
                continue
            history.append(f"update:{message['name']}")
            state["phase"] = "issuing"
            state["approvedCents"] = message["amountCents"]
            responses.append({"ok": True, "value": state["phase"]})
            continue

        history.append(f"signal:{message['name']}")
        if message["name"] == "timer_expired" and state["phase"] == "awaiting-approval":
            state["phase"] = "escalated"
        # Acknowledged either way. The caller cannot learn which of those two things happened.
        responses.append({"ok": True})

    return {"state": state, "history": history, "responses": responses}
