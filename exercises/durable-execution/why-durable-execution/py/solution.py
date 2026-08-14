def run(program: list, journal: list, crash_after: int) -> dict:
    log = list(journal)
    results = []
    executed = []

    for index, step in enumerate(program):
        if index < len(journal):
            recorded = journal[index]
            # Replay compares the sequence of effects. A different name at this position
            # means the runtime can no longer tell where in the code this execution is.
            if recorded["name"] != step["name"]:
                return {
                    "status": "non_determinism",
                    "results": [],
                    "executed": [],
                    "journal": journal,
                }
            results.append(recorded["result"])
            continue

        if len(executed) >= crash_after:
            return {
                "status": "crashed",
                "results": [],
                "executed": executed,
                "journal": log,
            }

        executed.append(step["name"])
        log.append({"name": step["name"], "result": step["result"]})
        results.append(step["result"])

    return {
        "status": "completed",
        "results": results,
        "executed": executed,
        "journal": log,
    }
