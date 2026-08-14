def reduce(state: dict, updates: list, schema: dict) -> dict:
    nxt = dict(state)
    rejected: list = []

    for update in updates:
        reducer = schema.get(update["channel"])
        if reducer is None:
            rejected.append(update["channel"])
            continue

        channel = update["channel"]
        if reducer == "append":
            nxt[channel] = [*nxt[channel], update["value"]]
        elif reducer == "max":
            nxt[channel] = max(nxt[channel], update["value"])
        else:
            nxt[channel] = update["value"]

    return {"state": nxt, "rejected": rejected}
