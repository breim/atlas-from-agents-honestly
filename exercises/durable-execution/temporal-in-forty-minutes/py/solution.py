def run(program: list, history: list, world: dict, config: dict) -> dict:
    recorded = {event["step"]: event for event in history}
    pending = {name: list(items) for name, items in world["results"].items()}

    executed = []
    replayed = []
    attempts = []
    produced = list(history)
    result = None

    def fail(status: str, error: str) -> dict:
        return {
            "status": status,
            "error": error,
            "executed": executed,
            "replayed": replayed,
            "attempts": attempts,
            "history": produced,
            "result": None,
        }

    for index, step in enumerate(program):
        if step["kind"] == "workflow":
            # Orchestration is replayed freely, so it may not read anything that can change.
            uses = step.get("uses")
            if uses and uses in config["nondeterministic"]:
                return fail(
                    "nondeterministic",
                    f"{step['name']} uses {uses} in workflow code; that is an activity",
                )
            continue

        # The unit of memoization is the effect. A completed activity is never run again.
        already = recorded.get(index)
        if already:
            replayed.append(step["name"])
            result = already["value"]
            continue

        outcomes = pending.get(step["name"], [])
        backoff_ms = []
        count = 0
        landed = None

        while count < config["retry"]["maximumAttempts"]:
            count += 1
            outcome = outcomes.pop(0) if outcomes else {"status": "fail"}
            if outcome["status"] == "ok":
                landed = outcome["value"]
                break
            if count < config["retry"]["maximumAttempts"]:
                backoff_ms.append(
                    config["retry"]["initialIntervalMs"]
                    * config["retry"]["backoffCoefficient"] ** (count - 1)
                )

        executed.append(step["name"])
        attempts.append({"name": step["name"], "count": count, "backoffMs": backoff_ms})

        if landed is None:
            return fail("failed", f"{step['name']} failed after {count} attempts")

        produced.append(
            {
                "type": "activity-completed",
                "step": index,
                "name": step["name"],
                "value": landed,
            }
        )
        result = landed

    return {
        "status": "completed",
        "error": None,
        "executed": executed,
        "replayed": replayed,
        "attempts": attempts,
        "history": produced,
        "result": result,
    }
