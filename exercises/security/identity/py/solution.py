def act(token: dict, action: dict, backends: list, agent_id: str) -> dict:
    errors = []
    backend = next((b for b in backends if b["name"] == action["backend"]), None)

    # The token must name both principals: whose rights apply, and who exercises them.
    if token["model"] == "service":
        errors.append("a service credential makes the agent a confused deputy")
    if token["model"] == "impersonation":
        errors.append(
            "impersonation gets authorization right and destroys accountability"
        )
    if token["model"] == "delegation" and not token["sub"]:
        errors.append("the delegation names no user whose rights apply")
    if token["model"] == "delegation" and not token["act"]:
        errors.append("the delegation names no agent exercising them")

    if backend is None:
        errors.append(f"{action['backend']} is not a backend")
    else:
        # Downscope on the way in. Filtering after a privileged read is a display preference.
        if backend["filtersOnRead"]:
            errors.append(
                f"{backend['name']} filters after reading, so the content was still "
                "read and logged"
            )
        for scope in backend["requiredScopes"]:
            if scope not in token["scopes"]:
                errors.append(f"the token lacks {scope} for {backend['name']}")
        for scope in token["scopes"]:
            if scope not in backend["requiredScopes"]:
                errors.append(
                    f"the token carries {scope}, which {backend['name']} does not need"
                )

    # Store the delegation reference in the run state, never the token.
    if action["storedToken"]:
        errors.append("the run stored a token rather than a delegation reference")
    if not action["delegationRef"]:
        errors.append("the run holds no delegation reference to re-derive from")

    # Re-derive at the moment of the action.
    if action["atMs"] >= token["expiresAtMs"]:
        errors.append("the delegation expired before the action")

    # A scheduled agent with no user still needs a named human owner.
    if action["scheduled"] and not action["ownerHuman"]:
        errors.append("a scheduled run names no human owner")

    log = {
        "user": token["sub"],
        "agent": token["act"] or agent_id,
        "run": action["runId"],
    }
    # Any two of the three leave "why was this allowed" unanswerable.
    for field, value in log.items():
        if not value:
            errors.append(f"the audit line names no {field}")

    return {
        "status": "refused" if errors else "allowed",
        "errors": errors,
        "log": log,
        "scopesUsed": [] if errors else sorted(token["scopes"]),
    }
