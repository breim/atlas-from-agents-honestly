def process(items: list, checkpoint, fail_at) -> dict:
    resume_from = items.index(checkpoint) if checkpoint in items else -1
    mark = checkpoint if resume_from >= 0 else None
    processed: list = []

    for item in items[resume_from + 1 :]:
        if item == fail_at:
            return {"ok": False, "processed": processed, "checkpoint": mark}
        processed.append(item)
        mark = item

    return {"ok": True, "processed": processed, "checkpoint": mark}
