def _deny(reason: str, alerted: bool) -> dict:
    return {
        "allowed": False,
        "reason": reason,
        "alerted": alerted,
        "deliveredBytes": 0,
        "truncated": False,
    }


def handle(request: dict, scope: dict, policy: dict) -> dict:
    # There is no get_secret. It was never implemented, and asking is a signal.
    if request["kind"] == "secret":
        return _deny("no_such_capability", True)

    if request["kind"] == "egress":
        # Default deny. A blocked connection to an unexpected host is the detection.
        if request["host"] not in policy["egressAllow"]:
            return _deny("egress_denied", True)
    else:
        # The same authorization the tool dispatcher runs, so generated code reaches
        # nothing the model could not have called directly.
        tool = policy["catalogue"].get(request["op"])
        if tool is None:
            return _deny("unknown_operation", False)
        if tool["class"] > scope["maxClass"]:
            return _deny("not_authorized", False)
        if (
            request["orderId"] != scope["orderId"]
            or request["amountCents"] > scope["capCents"]
        ):
            return _deny("out_of_scope", False)

    # Output becomes tool results, which become prompt text. Clip it here.
    truncated = request["outputBytes"] > policy["maxOutputBytes"]

    return {
        "allowed": True,
        "reason": None,
        "alerted": False,
        "deliveredBytes": policy["maxOutputBytes"] if truncated else request["outputBytes"],
        "truncated": truncated,
    }
