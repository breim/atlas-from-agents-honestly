def route(tasks: list, queues: list) -> dict:
    routing: dict = {"routed": {}, "unroutable": []}

    for task in tasks:
        queue = next(
            (q for q in queues if all(need in q["provides"] for need in task["needs"])),
            None,
        )

        if queue is None:
            routing["unroutable"].append(task["task"])
            continue

        routing["routed"].setdefault(queue["name"], []).append(task["task"])

    return routing
