APPROVAL = {
    "gate": "pending",
    "approve_submitted": "submitted",
    "approve_accepted": "accepted",
    "approve_rejected": "rejected",
}


def render(events: list, config: dict) -> dict:
    frames = []
    card = None

    for index, event in enumerate(events):
        kind = event["kind"]

        if kind == "gate":
            # Rendered once, at the moment the gate fires. Every surface shows these bytes.
            card = {
                "tool": event["tool"],
                "subject": event["subject"],
                "placement": "inline"
                if event["approver"] == config["driver"]
                else "queue",
                "frame": index,
            }

        if kind in APPROVAL:
            frames.append(
                {
                    "state": kind,
                    "component": "ApprovalCard",
                    "detail": card["subject"] if card else None,
                    "spinner": False,
                    "status": APPROVAL[kind],
                }
            )
            continue

        # The result component appears when the result does, and not one frame earlier.
        if kind == "output_available":
            registered = config["registry"].get(event["tool"])
            component = registered["component"] if registered else config["fallback"]
        elif kind == "error":
            component = "ErrorState"
        else:
            component = "StatusLine"

        frames.append(
            {
                "state": kind,
                "component": component,
                "detail": event.get("subject"),
                "spinner": event.get("elapsedMs", 0) >= config["spinnerAfterMs"],
                "status": None,
            }
        )

    return {"frames": frames, "card": card}
