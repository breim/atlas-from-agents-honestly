def replay(history: list, calls: list, run) -> dict:
    recorded = list(history)
    results: list = []
    invocations = 0

    for index, activity in enumerate(calls):
        if index >= len(recorded):
            result = run(activity)
            invocations += 1
            recorded.append({"activity": activity, "result": result})
            results.append(result)
            continue

        entry = recorded[index]
        if entry["activity"] != activity:
            return {
                "results": [],
                "history": history,
                "invocations": 0,
                "error": f"non_determinism: expected {entry['activity']}, got {activity}",
            }

        results.append(entry["result"])

    return {"results": results, "history": recorded, "invocations": invocations}
