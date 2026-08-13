def drain(queue: list, process, threshold: int) -> dict:
    result: dict = {"processed": [], "quarantined": [], "attempts": 0}

    for item in queue:
        tries = 0
        ok = False

        while tries < threshold and not ok:
            tries += 1
            result["attempts"] += 1
            ok = process(item)

        result["processed" if ok else "quarantined"].append(item)

    return result
