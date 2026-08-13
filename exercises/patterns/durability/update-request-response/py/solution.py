def _reject(state: dict, update: dict):
    """Runs before any mutation, so a refusal never leaves a half-applied update behind."""
    if update["kind"] not in ("credit", "close"):
        return "unknown_update"
    if state["status"] == "closed":
        return "workflow_closed"
    if update["kind"] == "credit" and update["cents"] <= 0:
        return "cents_must_be_positive"
    return None


def apply_updates(initial: dict, updates: list) -> dict:
    state = dict(initial)
    responses: list = []

    for update in updates:
        error = _reject(state, update)
        if error:
            responses.append({"ok": False, "error": error})
            continue

        if update["kind"] == "close":
            state["status"] = "closed"
        else:
            state["creditCents"] += update["cents"]

        responses.append({"ok": True, "value": state["creditCents"]})

    return {"state": state, "responses": responses}
