def place(runtime: dict, shape: str, policy: dict) -> dict:
    errors = []
    warnings = []

    # The SDK is TypeScript-only, which is why most systems split the two languages.
    if runtime["language"] != "typescript":
        errors.append(
            "the AI SDK is typescript-only; the interface layer cannot be python"
        )

    # One loop, and it lives wherever durability lives.
    loops = runtime["loops"]
    if not loops:
        errors.append("no loop owns the run")
    if len(loops) > 1:
        errors.append(
            f"{len(loops)} loops means {len(loops)} step counters that disagree"
        )
    owner = loops[0]["owner"] if len(loops) == 1 else None
    if owner and runtime["durabilityLives"] != "none" and owner != runtime["durabilityLives"]:
        errors.append(
            f"the loop lives in {owner} and durability lives in {runtime['durabilityLives']}"
        )

    suggested = next(s for s in policy["shapes"] if s["name"] == shape)

    for loop in loops:
        # A tool-augmented chat loops without an explicit stop condition.
        if not loop["stopConditions"]:
            errors.append(f"{loop['owner']} declares no stop condition")
        if loop["maxSteps"] is None:
            errors.append(f"{loop['owner']} declares no step cap")
        elif loop["maxSteps"] > suggested["suggestedMaxSteps"]:
            warnings.append(
                f"{loop['owner']} allows {loop['maxSteps']} steps for a {shape} shape"
            )

    # Only step count and a terminal tool call ship. Cost and deadline remain yours.
    seen = []
    for loop in loops:
        for condition in loop["stopConditions"]:
            if condition not in seen:
                seen.append(condition)
    owned = sorted(c for c in seen if c in policy["firstPartyStopConditions"])
    yours = sorted(policy["boundsYouOwn"])
    for bound in yours:
        if any(bound in loop["stopConditions"] for loop in loops):
            continue
        warnings.append(
            f"{bound} is not a first-party stop condition and nothing here bounds it"
        )

    if runtime["usesDeprecatedObjectApi"]:
        warnings.append(
            "generateObject and streamObject are deprecated in v6; structured output "
            "moved onto generation"
        )

    return {
        "status": "unsound" if errors else "sound",
        "errors": errors,
        "warnings": warnings,
        "loopOwner": None if errors else owner,
        "boundsOwned": owned,
        "boundsYours": yours,
    }
