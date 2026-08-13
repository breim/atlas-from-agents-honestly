def monitor(started_at: int, beats: list, finished_at: int, timeout: int) -> dict:
    previous = started_at

    for beat in [*beats, finished_at]:
        if beat - previous > timeout:
            return {"alive": False, "declaredDeadAt": previous + timeout}
        previous = beat

    return {"alive": True, "declaredDeadAt": None}
