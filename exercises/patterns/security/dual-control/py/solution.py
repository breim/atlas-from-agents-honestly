def authorise(request: dict, approvals: list, required: int) -> dict:
    approvers: list = []
    self_approval = False
    duplicate = False

    for approval in approvals:
        if approval["action"] != request["action"]:
            continue
        if approval["by"] == request["by"]:
            self_approval = True
            continue
        if approval["by"] in approvers:
            duplicate = True
            continue
        approvers.append(approval["by"])

    if len(approvers) >= required:
        return {"authorised": True, "reason": None, "approvers": approvers}

    if self_approval:
        reason = "self_approval"
    elif duplicate:
        reason = "duplicate_approver"
    else:
        reason = "insufficient_approvals"

    return {"authorised": False, "reason": reason, "approvers": approvers}
