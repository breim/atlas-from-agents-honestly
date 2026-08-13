def plan(sections: list, max_output: int, window_tokens: int) -> dict:
    total_input = sum(section["tokens"] for section in sections)
    headroom = window_tokens - total_input - max_output

    return {
        "input": total_input,
        "reserved": max_output,
        "headroom": headroom,
        "fits": headroom >= 0,
        "overBy": max(0, -headroom),
    }
