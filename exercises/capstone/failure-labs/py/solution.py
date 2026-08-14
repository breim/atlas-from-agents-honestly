def assess(labs: list, policy: dict) -> dict:
    verdicts = []

    for lab in labs:
        errors = []

        # Define fault, window, invariant and evidence before injecting anything.
        for field in policy["required"]:
            if not lab.get(field):
                errors.append(f"{lab['name']} declares no {field}")
        if not lab["evidence"]:
            errors.append(f"{lab['name']} collects no evidence")

        # Inspect effect state, not only return status.
        if lab["inspects"] != "effect-state":
            errors.append(f"{lab['name']} inspects only the return status")

        # Assert tenant isolation before reranking, prompt assembly and every graph hop.
        for checkpoint in policy["isolationCheckpoints"]:
            if checkpoint not in lab["assertsBefore"]:
                errors.append(
                    f"{lab['name']} does not assert isolation before {checkpoint}"
                )

        # Every bound needs a terminal business policy.
        if not lab["boundHasTerminalPolicy"]:
            errors.append(f"{lab['name']} bounds something with no terminal policy")

        # Promote each finding to the lowest layer that can prevent it.
        if not lab["promotedTo"]:
            errors.append(f"{lab['name']} promotes its finding nowhere")
        elif lab["promotedTo"] not in policy["layers"]:
            errors.append(f"{lab['name']} promotes to an unknown layer")

        # Preserve the failed artifacts before cleanup or re-run.
        if not lab["artifactsPreserved"]:
            errors.append(f"{lab['name']} cleans up before preserving its artifacts")

        verdicts.append(
            {
                "lab": lab["name"],
                "status": "invalid" if errors else "valid",
                "errors": errors,
                "promotedTo": None if errors else lab["promotedTo"],
            }
        )

    # Separate attempted bypass from admitted bypass.
    attempted = [lab["name"] for lab in labs if lab["bypass"] == "attempted"]
    admitted = [lab["name"] for lab in labs if lab["bypass"] == "admitted"]

    incomplete = any(v["status"] == "invalid" for v in verdicts) or bool(admitted)

    return {
        "status": "incomplete" if incomplete else "complete",
        "verdicts": verdicts,
        "admittedBypasses": admitted,
        "attemptedBypasses": attempted,
    }
