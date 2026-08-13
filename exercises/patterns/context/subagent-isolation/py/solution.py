def _pick(source: dict, keys: list) -> dict:
    return {key: source[key] for key in keys if key in source}


def isolate(parent: dict, allow: list) -> dict:
    return _pick(parent, allow)


def merge(parent: dict, result: dict, expose: list) -> dict:
    return {**parent, **_pick(result, expose)}
