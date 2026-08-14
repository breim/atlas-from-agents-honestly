def config_key(bundle: dict) -> str:
    # Content-addressed: the fields sorted by name, so two deploys producing the same
    # bundle are the same configuration whatever the git history says.
    return "|".join(f"{name}={bundle[name]}" for name in sorted(bundle))


def _active_at(environments: list, at: int) -> dict:
    return [entry for entry in environments if entry["at"] <= at][-1]


def execute(run: dict, environments: list) -> dict:
    # Resolved once, at run start, and carried for the whole run.
    carried = config_key(_active_at(environments, run["startedAt"])["bundle"])

    return {
        "configKey": carried,
        "actions": [
            {
                "name": action["name"],
                "at": action["at"],
                "configKey": carried,
                # Policy is the exception: it resolves at the moment of the action, or a
                # run that paused on Friday acts on Friday's permissions.
                "policy": _active_at(environments, action["at"])["policyVersion"],
            }
            for action in run["actions"]
        ],
    }
