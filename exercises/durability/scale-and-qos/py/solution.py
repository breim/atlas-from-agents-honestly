def _round_robin(level: list, weights: dict) -> list:
    turns = list(dict.fromkeys(task["tenant"] for task in level))
    backlogs = {
        tenant: [task for task in level if task["tenant"] == tenant] for tenant in turns
    }
    dispatched = []

    while len(dispatched) < len(level):
        for tenant in turns:
            backlog = backlogs[tenant]
            # A tenant with nothing left is skipped, not waited for.
            for _ in range(weights.get(tenant, 1)):
                if not backlog:
                    break
                dispatched.append(backlog.pop(0)["id"])

    return dispatched


def dispatch(tasks: list, weights: dict) -> list:
    levels = sorted({task["priority"] for task in tasks})
    return [
        task_id
        for priority in levels
        for task_id in _round_robin(
            [task for task in tasks if task["priority"] == priority], weights
        )
    ]
