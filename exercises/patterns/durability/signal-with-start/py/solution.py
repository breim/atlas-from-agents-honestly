def signal_with_start(running: list, signals: list) -> dict:
    live = set(running)
    delivery: dict = {"started": [], "workflows": {}}

    for signal in signals:
        workflow_id = signal["workflowId"]
        if workflow_id not in live:
            live.add(workflow_id)
            delivery["started"].append(workflow_id)

        delivery["workflows"].setdefault(workflow_id, []).append(signal["payload"])

    return delivery
