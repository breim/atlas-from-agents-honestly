def select(run: dict, profiles: dict, catalogue: dict, config: dict) -> dict:
    def profile_for(category: str) -> dict:
        return profiles.get(category, profiles["default"])

    chosen = profile_for(run["category"])

    def prefix_of(profile: dict) -> int:
        return (
            catalogue["systemTokens"]
            + sum(catalogue["tools"][tool] for tool in profile["tools"])
            + sum(catalogue["instructions"][name] for name in profile["instructions"])
        )

    offered = []
    used = []
    refused = []
    loadable = set()
    steps = []
    previous_prefix = None

    for index, step in enumerate(run["steps"]):
        # Per conversation, the profile is decided once at triage and held.
        profile = (
            profile_for(step.get("category", run["category"]))
            if config["selectPerRequest"]
            else chosen
        )
        for tool in profile["tools"]:
            if tool not in loadable:
                loadable.add(tool)
                offered.append(tool)

        # Surfaced mid-run, an addition lands after the breakpoint rather than at position zero.
        addition_tokens = 0
        for tool in step["additions"]:
            addition_tokens += catalogue["tools"][tool]
            if tool not in loadable:
                loadable.add(tool)
                offered.append(tool)

        prefix_tokens = prefix_of(profile)
        cached = previous_prefix is not None and previous_prefix == prefix_tokens
        variable_tokens = step["variableTokens"] + addition_tokens
        prefix_cost = (
            int(prefix_tokens * config["cacheReadBps"] / 10000 + 0.5)
            if cached
            else prefix_tokens
        )

        step_refused = []
        for call in step["calls"]:
            # A tool that is not loaded cannot be called.
            if call not in loadable:
                step_refused.append(call)
                if call not in refused:
                    refused.append(call)
                continue
            if call not in used:
                used.append(call)

        steps.append(
            {
                "step": index + 1,
                "prefixTokens": prefix_tokens,
                "variableTokens": variable_tokens,
                "cached": cached,
                "billedTokens": prefix_cost + variable_tokens,
                "refused": step_refused,
            }
        )
        previous_prefix = prefix_tokens

    return {
        "namespace": chosen["namespace"],
        "steps": steps,
        "billedTokens": sum(step["billedTokens"] for step in steps),
        "offered": offered,
        "used": used,
        "neverCalled": [tool for tool in offered if tool not in used],
        "refused": refused,
    }
