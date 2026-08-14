def authorize(token: dict, request: dict, now: int) -> dict:
    if now >= token["expiresAt"]:
        return {"ok": False, "error": "expired"}

    # A token whose audience nobody checks is a token another server can replay against you.
    if token["audience"] != request["resource"]:
        return {"ok": False, "error": "wrong_audience"}

    if request["scope"] not in token["scopes"]:
        return {"ok": False, "error": "missing_scope"}

    return {"ok": True, "subject": token["subject"]}
