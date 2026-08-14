def orchestrate(kind: str, handlers: list, outcomes: dict) -> dict:
    capable = [handler for handler in handlers if kind in handler["handles"]]
    if not capable:
        return {
            "status": "unroutable",
            "answeredBy": None,
            "dispatched": [],
            "failedBy": None,
        }

    dispatched: list = []
    for handler in capable:
        dispatched.append(handler["name"])
        outcome = outcomes.get(handler["name"])

        if outcome == "ok":
            return {
                "status": "answered",
                "answeredBy": handler["name"],
                "dispatched": dispatched,
                "failedBy": None,
            }
        # An error is a fault, not a routing signal: it stops rather than hands on.
        if outcome == "error":
            return {
                "status": "failed",
                "answeredBy": None,
                "dispatched": dispatched,
                "failedBy": handler["name"],
            }

    return {
        "status": "unhandled",
        "answeredBy": None,
        "dispatched": dispatched,
        "failedBy": None,
    }
