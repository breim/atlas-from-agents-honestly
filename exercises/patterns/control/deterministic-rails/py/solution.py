def handle(request: dict, rails: list, model) -> dict:
    rail = next((r for r in rails if r["when"] == request.get("intent")), None)
    if rail is not None:
        return {"answer": rail["answer"], "source": "rail", "modelCalls": 0}

    return {"answer": model(request), "source": "model", "modelCalls": 1}
