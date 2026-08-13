def _canonical(action: dict) -> str:
    return f"{action['tool']}|{action['account']}|{action['cents']}"


def gate(action: dict, approval, now: int) -> dict:
    if approval is None:
        return {"allowed": False, "reason": "approval_required"}
    if approval["hash"] != _canonical(action):
        return {"allowed": False, "reason": "action_mismatch"}
    if now >= approval["expiresAt"]:
        return {"allowed": False, "reason": "approval_expired"}

    return {"allowed": True, "reason": None}
