def serve(timeline: list, abandon_after_minutes: int) -> dict:
    buffer = []
    deliveries = []
    watching = set()
    status = "running"
    unwatched_minutes = 0

    for action in timeline:
        kind = action["kind"]

        if kind == "emit":
            if status == "running":
                buffer.append({"id": len(buffer) + 1, "text": action["text"]})

        elif kind == "connect":
            # The buffer outlives the run, so a finished run is still readable.
            since = action["lastEventId"] or 0
            deliveries.append(
                {
                    "client": action["client"],
                    "events": [e["id"] for e in buffer if e["id"] > since],
                }
            )
            watching.add(action["client"])
            unwatched_minutes = 0

        # A dropped connection means nothing knowable, so it ends nothing.
        elif kind == "disconnect":
            watching.discard(action["client"])

        elif kind == "stop":
            if status == "running":
                status = "cancelled"

        elif not watching and status == "running":
            unwatched_minutes += action["minutes"]
            if unwatched_minutes >= abandon_after_minutes:
                status = "abandoned"

    return {"status": status, "buffer": buffer, "deliveries": deliveries}
