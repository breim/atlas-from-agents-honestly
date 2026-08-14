# Slowness is deliberately absent: it is a property of one run, not of replay.
GROUNDS = (
    ("hasSideEffect", "side_effect"),
    ("needsResumption", "resumption"),
    ("observedSeparately", "observability"),
)


def decide(step: dict) -> dict:
    reasons = [reason for field, reason in GROUNDS if step[field]]

    return {"verdict": "node" if reasons else "function", "reasons": reasons}
