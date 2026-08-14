def attempt(request: dict, store: dict, config: dict) -> dict:
    errors = []
    alerts = []

    # The record must be more durable than whatever would repeat the call.
    if not store["durable"]:
        errors.append(
            "the dedup record is less durable than the thing that would repeat the call"
        )
    # A marker in one store and the write in another reintroduces the crash gap.
    if not store["transactional"]:
        errors.append("the effect and the record do not commit together")
    # The window must exceed the longest interval over which the same call could be attempted.
    if store["windowMs"] < config["approvalPauseMs"]:
        errors.append(
            f"a {store['windowMs']}ms window is shorter than a "
            f"{config['approvalPauseMs']}ms approval pause"
        )
    # Expiring the lease early causes the exact duplicate it prevents.
    if config["leaseMs"] < request["slowestCallMs"]:
        errors.append(
            f"a {config['leaseMs']}ms lease is shorter than the slowest legitimate call"
        )

    if errors:
        return {
            "status": "unsound",
            "errors": errors,
            "alerts": alerts,
            "effects": 0,
            "store": store,
            "outbox": [],
        }

    rows = dict(store["rows"])
    existing = rows.get(request["key"])
    outbox = []

    def land(state, **extra):
        rows[request["key"]] = {
            "key": request["key"],
            "state": state,
            "leaseUntilMs": request["atMs"] + config["leaseMs"],
            **extra,
        }

    def done(status, effects):
        return {
            "status": status,
            "errors": errors,
            "alerts": alerts,
            "effects": effects,
            "store": {**store, "rows": rows},
            "outbox": outbox,
        }

    if existing:
        if existing["state"] == "DONE":
            return done("deduplicated", 0)
        # IN_FLIGHT is what makes a concurrent duplicate wait instead of double-executing.
        if existing["state"] == "IN_FLIGHT" and request["atMs"] < existing["leaseUntilMs"]:
            return done("waited", 0)
        # A FAILED row is retryable only when the failure was provably before the effect.
        if existing["state"] == "FAILED" and existing.get("failedBefore") is not True:
            alerts.append(f"{request['key']} failed after the effect may have landed")
            return done("escalated", 0)

    # Alert when a key expires while its run is still alive.
    if (
        existing
        and request["atMs"] - (existing["leaseUntilMs"] - config["leaseMs"])
        > store["windowMs"]
        and request["runAliveUntilMs"] > request["atMs"]
    ):
        alerts.append(f"{request['key']} expired while its run was still alive")

    if request["outcome"] == "rejected-before-effect":
        land("FAILED", failedBefore=True)
        return done("retried", 0)

    if request["outcome"] == "timeout":
        land("FAILED", failedBefore=False)
        return done("escalated", 1)

    # An external effect cannot join the transaction, so commit the intent with the record.
    if request["external"]:
        land("IN_FLIGHT")
        outbox.append(f"{request['key']}:{request['effect']}")
        return done("applied", 0)

    land("DONE", result=request["effect"])
    return done("applied", 1)
