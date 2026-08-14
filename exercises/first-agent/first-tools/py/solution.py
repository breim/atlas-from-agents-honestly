def _run(block: dict, catalogue: list, world: dict) -> dict:
    def fail(reason: str) -> dict:
        return {
            "type": "tool_result",
            "toolUseId": block["id"],
            "content": f"Error: {reason}",
            "isError": True,
        }

    spec = next((tool for tool in catalogue if tool["name"] == block["name"]), None)
    if spec is None:
        return fail(f"no tool named {block['name']}")

    key = block["input"].get(spec["argument"])
    if key is None:
        return fail(f"{block['name']} requires {spec['argument']}")

    record = world.get(f"{block['name']}:{key}")
    if record is None:
        return fail(f"{block['name']} found no record for {key}")

    return {"type": "tool_result", "toolUseId": block["id"], "content": record}


def _text_of(content: list) -> str:
    return "".join(block["text"] for block in content if block["type"] == "text")


def answer(ticket: dict, script: list, catalogue: list, world: dict) -> dict:
    transcript = [{"role": "user", "content": ticket["body"]}]
    requests = []

    # Every request resends the whole history. Recording its size is the only way the
    # multiplier is visible from outside.
    def ask() -> dict:
        requests.append(len(transcript))
        return script[len(requests) - 1]

    response = ask()
    rounds = 0

    # An `if`, not a `while`. The model chooses once, and only once.
    if response["stopReason"] == "tool_use":
        # The model has no memory of asking; the request is the memory. Echo it verbatim.
        transcript.append({"role": "assistant", "content": response["content"]})

        results = [
            _run(block, catalogue, world)
            for block in response["content"]
            if block["type"] == "tool_use"
        ]

        # Every result for the turn, in one user message. Rows enter the transcript in the
        # same slot as the customer's words.
        transcript.append({"role": "user", "content": results})
        rounds = 1
        response = ask()

    if response["stopReason"] == "tool_use":
        return {
            "transcript": transcript,
            "requests": requests,
            "rounds": rounds,
            "answer": None,
            "outcome": "unresolved",
        }

    transcript.append({"role": "assistant", "content": response["content"]})
    return {
        "transcript": transcript,
        "requests": requests,
        "rounds": rounds,
        "answer": _text_of(response["content"]),
        "outcome": "answered",
    }
