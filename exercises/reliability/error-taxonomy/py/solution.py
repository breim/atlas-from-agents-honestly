def _actionable(entry: dict) -> bool:
    # The model sees an error only when it is the one who can act on it.
    return (
        entry["class"] in ("policy", "budget")
        or (entry["class"] == "permanent" and entry["blame"] == "model")
    )


def route(failures: list, catalogue: dict) -> dict:
    routed = []
    for failure in failures:
        entry = catalogue[failure["code"]]
        retryable = entry["class"] == "transient"
        routed.append(
            {
                "id": failure["id"],
                "class": entry["class"],
                "blame": entry["blame"],
                "retryable": retryable,
                "escalates": entry["class"] == "policy",
                "modelFacing": failure["instruction"] if _actionable(entry) else None,
                # A schedule for a call nobody will make again is noise.
                "retryAfterMs": failure["retryAfterMs"] if retryable else None,
            }
        )

    def ids(keep) -> list:
        return [entry["id"] for entry in routed if keep(entry)]

    return {
        "routed": routed,
        "retried": ids(lambda e: e["retryable"]),
        "escalated": ids(lambda e: e["escalates"]),
        "shownToModel": ids(lambda e: e["modelFacing"] is not None),
        # One is the system working; the other never raised.
        "countedInErrorRate": ids(lambda e: e["class"] not in ("budget", "semantic")),
    }
