from math import floor


def drift(recorded: str, requested: str) -> int:
    a, b = set(recorded.split()), set(requested.split())
    shared = len(a & b)
    union = len(a | b)
    return 0 if union == 0 else 10000 - floor(shared * 10000 / union + 0.5)


def replay(recording: dict, requests: list, config: dict) -> dict:
    # Once, and exactly. A model upgrade alters no prompt text and stales everything.
    if recording["serving"] != config["serving"]:
        return {"status": "stale", "responses": [], "consumed": 0, "driftBps": []}

    responses = []
    drift_bps = []

    for requested in requests:
        if len(responses) >= len(recording["events"]):
            return {
                "status": "exhausted",
                "responses": responses,
                "consumed": len(responses),
                "driftBps": drift_bps,
            }
        event = recording["events"][len(responses)]

        # Per step, and tolerantly. A rebuilt prompt makes the recorded answer irrelevant.
        delta = drift(event["prompt"], requested)
        drift_bps.append(delta)
        if delta > config["thresholdBps"]:
            return {
                "status": "diverged",
                "responses": responses,
                "consumed": len(responses),
                "driftBps": drift_bps,
            }

        responses.append(event["response"])

    return {
        "status": "replayed",
        "responses": responses,
        "consumed": len(responses),
        "driftBps": drift_bps,
    }
