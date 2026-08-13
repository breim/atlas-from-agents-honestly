def next_batch(items: list, size: int, cursor) -> dict:
    start = items.index(cursor) + 1 if cursor in items else 0
    batch = items[start : start + size]

    return {
        "batch": batch,
        "cursor": batch[-1] if batch else cursor,
        "done": start + len(batch) >= len(items),
    }
