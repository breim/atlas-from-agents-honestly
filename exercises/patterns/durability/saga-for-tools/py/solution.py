def run_saga(steps: list, fail_at) -> dict:
    completed: list = []

    for step in steps:
        if step == fail_at:
            return {"ok": False, "completed": completed, "compensated": completed[::-1]}
        completed.append(step)

    return {"ok": True, "completed": completed, "compensated": []}
