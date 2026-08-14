def execute(graph: dict, thread: dict, store: dict, config: dict) -> dict:
    # Nothing in a checkpointer coordinates two workers. The lease is yours to build.
    if config["requireLease"] and not thread["holdsLease"]:
        return {
            "status": "refused",
            "path": [],
            "checkpoints": [],
            "applied": [],
            "duplicated": [],
            "store": store,
        }

    effects = dict(store["effects"])
    crashes = list(thread["crashes"])
    answered = set()
    path = []
    checkpoints = []
    applied = []
    nonce = 0
    index = 0
    status = "completed"

    while index < len(graph["nodes"]):
        # A hard backstop on node entries. A correct run never comes near it.
        if len(path) >= config["maxNodeEntries"]:
            status = "stopped"
            break
        node = graph["nodes"][index]
        path.append(node["name"])
        crashed = False
        paused = False

        for position, effect in enumerate(node["effects"]):
            if effect.get("approval"):
                # The interrupted call returns its recorded result; everything else runs again.
                marker = f"{node['name']}:{effect['name']}"
                if marker in answered:
                    applied.append(
                        {
                            "node": node["name"],
                            "effect": effect["name"],
                            "key": None,
                            "deduped": True,
                        }
                    )
                    continue
                applied.append(
                    {
                        "node": node["name"],
                        "effect": effect["name"],
                        "key": None,
                        "deduped": False,
                    }
                )
                answered.add(marker)
                paused = True
                break

            # Derived from the thread, so a replay produces the same key. A random one does not.
            if effect.get("readOnly"):
                key = None
            elif effect.get("random"):
                key = f"{thread['id']}:{node['name']}:{effect['name']}:rnd-{nonce}"
                nonce += 1
            else:
                key = (
                    f"{thread['id']}:{node['name']}:{effect['name']}:"
                    f"{effect['discriminator']}"
                )

            deduped = key is not None and key in effects
            if key is not None and not deduped:
                effects[key] = 1
            applied.append(
                {
                    "node": node["name"],
                    "effect": effect["name"],
                    "key": key,
                    "deduped": deduped,
                }
            )

            crash = crashes[0] if crashes else None
            if crash and crash["node"] == node["name"] and crash["afterEffect"] == position:
                crashes.pop(0)
                crashed = True
                break

        # No checkpoint was written, so a resume restarts at the beginning of the node.
        if crashed:
            if not config["autoResume"]:
                status = "stopped"
                break
            continue
        if paused:
            continue

        checkpoints.append(node["name"])
        index += 1

    landed = [
        item["effect"]
        for item in applied
        if not item["deduped"] and item["key"] is not None
    ]
    duplicated = []
    for name in landed:
        if landed.count(name) > 1 and name not in duplicated:
            duplicated.append(name)

    return {
        "status": status,
        "path": path,
        "checkpoints": checkpoints,
        "applied": applied,
        "duplicated": duplicated,
        "store": {"effects": effects},
    }
