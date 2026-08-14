from math import floor


def _rate(part: int, whole: int, empty: int) -> int:
    return empty if whole == 0 else floor(part * 10000 / whole + 0.5)


def _first(calls: list, tool: str) -> int:
    return next((i for i, call in enumerate(calls) if call["tool"] == tool), -1)


def score(calls: list, spec: dict) -> dict:
    # Which tools, not in what order. The order a run visited them in is not a fact.
    called = list(dict.fromkeys(call["tool"] for call in calls))
    matched = sum(1 for tool in spec["required"] if tool in called)
    needed = sum(1 for tool in called if tool in spec["required"])

    seen = set()
    repeats = 0
    for call in calls:
        key = (call["tool"], call["args"], call["error"])
        # A repeated success is waste; a repeated failure is a control-flow signal.
        if call["error"] is not None and key in seen:
            repeats += 1
        seen.add(key)

    violations = []
    for before, after in spec["orderPolicy"]:
        decision, effect = _first(calls, before), _first(calls, after)
        if effect != -1 and (decision == -1 or decision > effect):
            violations.append(f"{before}->{after}")

    wasted = sum(1 for call in calls if not call["contributed"])

    return {
        "recallBps": _rate(matched, len(spec["required"]), 10000),
        "precisionBps": _rate(needed, len(called), 10000),
        "stepEfficiencyBps": min(10000, _rate(spec["minimumSteps"], len(calls), 0)),
        "redundantBps": _rate(wasted, len(calls), 0),
        "loopEscapeBps": 10000 - _rate(repeats, len(calls), 0),
        "policyViolations": violations,
    }
