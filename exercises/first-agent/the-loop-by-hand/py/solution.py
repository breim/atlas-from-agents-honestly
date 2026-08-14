ESCALATE = "escalate_to_human"


def _run_tool(call: dict, ticket: dict, config: dict, world: dict) -> dict:
    def fail(reason: str) -> dict:
        return {
            "type": "tool_result",
            "toolUseId": call["id"],
            "content": f"Error: {reason}",
            "isError": True,
        }

    spec = next((t for t in world["catalogue"] if t["name"] == call["name"]), None)
    if spec is None:
        return fail(f"no tool named {call['name']}")

    key = call["input"].get(spec["argument"])
    if key is None:
        return fail(f"{call['name']} requires {spec['argument']}")

    record = world["records"].get(f"{call['name']}:{key}")
    if record is None:
        return fail(f"{call['name']} found no record for {key}")

    # The model chooses the arguments, so the tenancy filter lives here rather than in a prompt.
    if record["customerId"] is not None and record["customerId"] != ticket["customerId"]:
        return fail(f"{call['name']} is not authorized for {key}")

    return {
        "type": "tool_result",
        "toolUseId": call["id"],
        "content": record["data"][: config["maxResultChars"]],
    }


def _text_of(content: list) -> str:
    return "".join(block["text"] for block in content if block["type"] == "text")


def run(ticket: dict, script: list, config: dict, world: dict) -> dict:
    messages = [{"role": "user", "content": ticket["body"]}]
    trace = []
    state = {"costCents": 0, "elapsedMs": 0}

    def exit_with(status: str, **extra) -> dict:
        outcome = {
            "status": status,
            "bound": None,
            "reply": None,
            "reason": None,
            "steps": len(trace),
            "costCents": state["costCents"],
            "elapsedMs": state["elapsedMs"],
            "messages": len(messages),
            "trace": trace,
        }
        outcome.update(extra)
        return outcome

    for step in range(1, config["maxSteps"] + 1):
        # Before the call. A budget enforced after the spend is a report, not a limit.
        if state["costCents"] > config["maxCostCents"]:
            return exit_with("halted", bound="cost")
        if state["elapsedMs"] > config["deadlineMs"]:
            return exit_with("halted", bound="deadline")

        response = script[len(trace)]
        state["costCents"] += response["costCents"]
        state["elapsedMs"] += response["tookMs"]

        calls = [b for b in response["content"] if b["type"] == "tool_use"]
        entry = {
            "step": step,
            "messages": len(messages),
            "calls": [call["name"] for call in calls],
            "results": [],
        }
        trace.append(entry)
        messages.append({"role": "assistant", "content": response["content"]})

        if response["stopReason"] != "tool_use":
            return exit_with("answered", reply=_text_of(response["content"]))

        # Terminal tool. It ends the turn it was asked for in, so nothing else in that turn runs.
        handoff = next((call for call in calls if call["name"] == ESCALATE), None)
        if handoff is not None:
            return exit_with("escalated", reason=handoff["input"]["reason"])

        entry["results"] = [_run_tool(call, ticket, config, world) for call in calls]
        messages.append({"role": "user", "content": entry["results"]})

    # Not falling out with whatever text was lying around. Halting is a result.
    return exit_with("halted", bound="steps")
