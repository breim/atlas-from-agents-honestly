END = "END"


def _targets_of(spec: dict, name: str) -> list:
    conditional = next(
        (e for e in spec["conditionalEdges"] if e["from"] == name), None
    )
    if conditional:
        return [b["to"] for b in conditional["branches"]] + [conditional["otherwise"]]
    edge = next((e for e in spec["edges"] if e["from"] == name), None)
    return [edge["to"]] if edge else []


def _validate(spec: dict) -> list:
    """compile() runs before anything executes: the bugs a while loop could not detect."""
    names = {node["name"] for node in spec["nodes"]}

    def known(name: str) -> bool:
        return name == END or name in names

    dangling = []
    for edge in spec["edges"]:
        if not known(edge["to"]):
            dangling.append(
                f"edge {edge['from']} -> {edge['to']} names a node that does not exist"
            )
    for edge in spec["conditionalEdges"]:
        for target in [b["to"] for b in edge["branches"]] + [edge["otherwise"]]:
            if not known(target):
                dangling.append(
                    f"edge {edge['from']} -> {target} names a node that does not exist"
                )
    if dangling:
        return dangling

    errors = []
    reachable = set()

    def walk(name: str) -> None:
        if name == END or name in reachable:
            return
        reachable.add(name)
        for target in _targets_of(spec, name):
            walk(target)

    walk(spec["entry"])

    for node in spec["nodes"]:
        if node["name"] not in reachable:
            errors.append(f"node {node['name']} is unreachable from {spec['entry']}")

    ends = set()
    grew = True
    while grew:
        grew = False
        for node in spec["nodes"]:
            if node["name"] in ends:
                continue
            if any(
                target == END or target in ends
                for target in _targets_of(spec, node["name"])
            ):
                ends.add(node["name"])
                grew = True
    for node in spec["nodes"]:
        if node["name"] not in ends:
            errors.append(f"node {node['name']} has no path to END")

    return errors


def _holds(predicate: dict, state: dict) -> bool:
    """A plain predicate over state. There is nowhere in here for a model to sit."""
    value = state.get(predicate["field"])
    if "atLeast" in predicate:
        return isinstance(value, int) and not isinstance(value, bool) and value >= predicate["atLeast"]
    return value == predicate.get("equals")


def _next_of(spec: dict, name: str, state: dict) -> str:
    conditional = next(
        (e for e in spec["conditionalEdges"] if e["from"] == name), None
    )
    if conditional:
        taken = next(
            (b for b in conditional["branches"] if _holds(b["when"], state)), None
        )
        return taken["to"] if taken else conditional["otherwise"]
    edge = next((e for e in spec["edges"] if e["from"] == name), None)
    return edge["to"] if edge else END


def execute(spec: dict, input_state: dict, updates: dict, limits: dict) -> dict:
    errors = _validate(spec)
    if errors:
        return {
            "status": "invalid",
            "errors": errors,
            "path": [],
            "position": spec["entry"],
            "state": input_state,
        }

    remaining = {name: list(items) for name, items in updates.items()}

    state = dict(input_state)
    path = []
    position = spec["entry"]

    for _ in range(limits["maxSteps"]):
        path.append(position)
        # A node returns the keys it changed, and the framework merges them in.
        pending = remaining.get(position)
        if pending:
            state = {**state, **pending.pop(0)}

        following = _next_of(spec, position, state)
        if following == END:
            return {
                "status": "completed",
                "errors": [],
                "path": path,
                "position": END,
                "state": state,
            }
        position = following

    return {
        "status": "halted",
        "errors": [],
        "path": path,
        "position": position,
        "state": state,
    }
