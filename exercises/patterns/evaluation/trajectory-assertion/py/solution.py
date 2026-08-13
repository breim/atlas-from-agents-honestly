def assert_path(steps: list, spec: dict) -> dict:
    violations: list = []

    for step in spec["requires"]:
        if step not in steps:
            violations.append(f"missing:{step}")

    # Only steps that are actually present can be out of order; the rest are already missing.
    cursor = 0
    for step in [required for required in spec["requires"] if required in steps]:
        rest = steps[cursor:]
        if step in rest:
            cursor += rest.index(step) + 1
        else:
            violations.append(f"out_of_order:{step}")

    for step in spec["forbids"]:
        if step in steps:
            violations.append(f"forbidden:{step}")

    return {"passed": not violations, "violations": violations}
