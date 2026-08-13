MISSING = "error: no such action"


def react(script: list, observations: dict, max_steps: int) -> dict:
    transcript: list = []

    for step in script[:max_steps]:
        if "action" not in step:
            transcript.append({"thought": step["thought"]})
            return {
                "status": "answered",
                "answer": step.get("answer"),
                "transcript": transcript,
            }

        transcript.append(
            {
                "thought": step["thought"],
                "action": step["action"],
                "observation": observations.get(step["action"], MISSING),
            }
        )

    return {"status": "bounded", "answer": None, "transcript": transcript}
