def run_loop(script: list, tools: dict, max_steps: int) -> dict:
    trace: list[dict] = []

    for step in range(1, max_steps + 1):
        if step > len(script):
            break
        turn = script[step - 1]

        if "text" in turn:
            return {
                "status": "completed",
                "steps": step,
                "answer": turn["text"],
                "trace": trace,
            }

        trace.append({"tool": turn["tool"], "ok": turn["tool"] in tools})

    return {
        "status": "bounded",
        "steps": min(max_steps, len(script)),
        "answer": None,
        "trace": trace,
    }
