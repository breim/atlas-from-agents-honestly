import hashlib


def canonical(args: dict) -> str:
    """Sorted keys and a flat shape: an unstable serialization is an unstable key."""
    return "&".join(f"{name}={args[name]}" for name in sorted(args))


def idempotency_key(run_id: str, tool: str, args: dict, length: int) -> str:
    payload = f"{run_id}|{tool}|{canonical(args)}"
    return hashlib.sha256(payload.encode()).hexdigest()[:length]


def dispatch(attempts: list, ledger: dict, config: dict) -> dict:
    entries = dict(ledger["entries"])
    results = []
    effects = 0

    for attempt in attempts:
        # The key comes from your code. Asking the model for one asks it to know it repeats.
        reserved = next(
            (n for n in attempt["args"] if n in config["reservedArgs"]), None
        )
        if reserved:
            results.append(
                {
                    "id": attempt["id"],
                    "key": None,
                    "status": "refused",
                    "note": f"{reserved} is not an argument the model may supply",
                }
            )
            continue

        key = idempotency_key(
            attempt["runId"], attempt["tool"], attempt["args"], config["keyLength"]
        )

        if key in entries:
            # Never silent: the model has to learn that its repeat was already applied.
            results.append(
                {
                    "id": attempt["id"],
                    "key": key,
                    "status": "already-applied",
                    "note": "this operation was already applied; nothing changed",
                }
            )
            continue

        if attempt["transport"] == "rejected":
            # Nothing happened, so nothing is recorded and a corrected call may proceed.
            results.append(
                {
                    "id": attempt["id"],
                    "key": key,
                    "status": "rejected",
                    "note": "the request was refused before anything happened",
                }
            )
            continue

        # A timeout usually happens on the response: the work landed, the answer was lost.
        entries[key] = {"tool": attempt["tool"], "runId": attempt["runId"]}
        effects += 1
        if attempt["transport"] == "ok":
            results.append(
                {"id": attempt["id"], "key": key, "status": "applied", "note": None}
            )
        else:
            results.append(
                {
                    "id": attempt["id"],
                    "key": key,
                    "status": "unknown",
                    "note": "no response; the operation may or may not have landed",
                }
            )

    return {"results": results, "ledger": {"entries": entries}, "effects": effects}
