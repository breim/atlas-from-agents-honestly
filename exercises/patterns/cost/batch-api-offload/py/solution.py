def _batchable(request: dict, now: int, latency: int) -> bool:
    deadline = request["deadline"]
    return deadline is None or now + latency <= deadline


def route(requests: list, now: int, batch_latency_ms: int) -> dict:
    routing: dict = {"batch": [], "sync": []}

    for request in requests:
        lane = "batch" if _batchable(request, now, batch_latency_ms) else "sync"
        routing[lane].append(request["id"])

    return routing
