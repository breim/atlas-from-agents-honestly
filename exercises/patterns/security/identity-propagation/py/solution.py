def act(user, need: str, service: dict) -> dict:
    if user is None:
        return {"allowed": False, "principal": None, "reason": "no_identity"}

    if need not in user["scopes"]:
        return {"allowed": False, "principal": user["principal"], "reason": "outside_user_scope"}
    if need not in service["scopes"]:
        return {
            "allowed": False,
            "principal": user["principal"],
            "reason": "outside_service_scope",
        }

    return {"allowed": True, "principal": user["principal"], "reason": None}
