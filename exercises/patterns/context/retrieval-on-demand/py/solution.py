def run(turns: list, corpus: dict) -> dict:
    fetches: list = []
    cache: dict = {}
    results: list = []

    for turn in turns:
        if "ask" not in turn:
            results.append(turn["say"])
            continue

        query = turn["ask"]
        if query not in cache:
            fetches.append(query)
            cache[query] = corpus.get(query)
        results.append(cache[query])

    return {"fetches": fetches, "results": results}
