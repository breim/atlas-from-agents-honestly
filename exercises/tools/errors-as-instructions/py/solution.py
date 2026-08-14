# Nobody described this failure, so nobody can promise a retry would clear it.
UNKNOWN = {
    "message": "The tool failed for a reason the agent cannot act on. Report it and stop.",
    "retryable": False,
    "fields": [],
}


def instruct(code: str, catalogue: dict) -> dict:
    entry = catalogue.get(code)
    if entry is None:
        return dict(UNKNOWN)

    return {
        "message": entry["instruction"],
        "retryable": entry["retryable"],
        "fields": entry["fields"],
    }
