def order(tasks: list) -> list:
    ranked = sorted(
        enumerate(tasks), key=lambda pair: (-pair[1]["priority"], pair[0])
    )
    return [task["task"] for _, task in ranked]
