END = "END"


def _validate(graph: dict, config: dict) -> list:
    errors = []

    for router in graph["routers"]:
        targets = (
            [b["to"] for b in router["branches"]]
            + ([router["otherwise"]] if router.get("otherwise") else [])
            + router.get("fanOut", [])
        )
        for target in targets:
            # The declared list is what makes the graph statically analysable.
            if target not in router["destinations"]:
                errors.append(
                    f"router at {router['from']} may return only "
                    f"{', '.join(router['destinations'])} — not {target}"
                )
        for branch in router["branches"]:
            # A conditional edge reads decision state and nothing else.
            if branch["when"]["field"] in config["transcriptFields"]:
                errors.append(
                    f"router at {router['from']} reads {branch['when']['field']}, "
                    "which is transcript state"
                )

    loop = graph["loop"]
    if loop:
        owed = loop["bound"] * loop["superStepsPerPass"]
        # The backstop counts super-steps, so it has to sit above the bound you wrote.
        if owed >= config["backstop"]:
            errors.append(
                f"the backstop at {config['backstop']} fires before the semantic bound "
                f"at {owed} super-steps"
            )

    return errors


def _holds(predicate: dict, state: dict) -> bool:
    value = state.get(predicate["field"])
    if "atLeast" in predicate:
        return (
            isinstance(value, int)
            and not isinstance(value, bool)
            and value >= predicate["atLeast"]
        )
    return value == predicate.get("equals")


def _merge(state: dict, update: dict, reducers: dict) -> dict:
    merged = dict(state)
    for field, value in update.items():
        reducer = reducers.get(field)
        if reducer == "sum":
            merged[field] = merged.get(field, 0) + value
        elif reducer == "concat":
            merged[field] = list(merged.get(field, [])) + list(value)
        else:
            merged[field] = value
    return merged


def run(graph: dict, input_state: dict, updates: dict, sub_updates: dict, config: dict) -> dict:
    errors = _validate(graph, config)
    if errors:
        return {
            "status": "invalid",
            "errors": errors,
            "path": [],
            "superSteps": 0,
            "state": input_state,
            "views": [],
        }

    remaining = {name: list(items) for name, items in updates.items()}
    remaining_sub = {name: list(items) for name, items in sub_updates.items()}

    state = dict(input_state)
    path = []
    views = []
    position = graph["entry"]
    counter = {"superSteps": 0}

    def node_of(name: str):
        return next((n for n in graph["nodes"] if n["name"] == name), None)

    def visit(name: str) -> None:
        nonlocal state
        path.append(name)
        counter["superSteps"] += 1
        state = _merge(state, {"step": state.get("step", 0) + 1}, graph["reducers"])

        node = node_of(name)
        if node and node["kind"] == "subgraph":
            shared = node.get("mode") == "shared"
            # Transformed: the subgraph cannot see the parent's transcript, it isn't in its state.
            passed = (
                dict(state)
                if shared
                else {field: state.get(field) for field in node.get("passes", [])}
            )
            pending = remaining_sub.get(node["graph"])
            update = pending.pop(0) if pending else {}
            produced = _merge(passed, update, graph["reducers"])
            returned = (
                list(update.keys())
                if shared
                else [f for f in node.get("returns", []) if f in produced]
            )
            for field in returned:
                state[field] = produced[field]
            views.append(
                {
                    "node": name,
                    "saw": sorted(passed.keys()),
                    "returned": sorted(returned),
                }
            )
            return

        pending = remaining.get(name)
        if pending:
            state = _merge(state, pending.pop(0), graph["reducers"])

    while counter["superSteps"] < config["backstop"]:
        visit(position)
        # The semantic bound produces a result you can report, not a stack trace.
        if position == "halt":
            return {
                "status": "halted",
                "errors": [],
                "path": path,
                "superSteps": counter["superSteps"],
                "state": state,
                "views": views,
            }

        router = next((r for r in graph["routers"] if r["from"] == position), None)
        if router and router.get("fanOut"):
            for branch in router["fanOut"]:
                visit(branch)
            position = router["join"]
            continue

        if router:
            taken = next(
                (b for b in router["branches"] if _holds(b["when"], state)), None
            )
            following = taken["to"] if taken else router["otherwise"]
        else:
            edge = next((e for e in graph["edges"] if e["from"] == position), None)
            following = edge["to"] if edge else END

        if following == END:
            return {
                "status": "completed",
                "errors": [],
                "path": path,
                "superSteps": counter["superSteps"],
                "state": state,
                "views": views,
            }
        position = following

    # Hitting the framework limit is an exception, not an outcome.
    return {
        "status": "crashed",
        "errors": [f"backstop fired after {counter['superSteps']} super-steps"],
        "path": path,
        "superSteps": counter["superSteps"],
        "state": state,
        "views": views,
    }
