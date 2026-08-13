import json

TYPES = {"string": str, "number": (int, float), "boolean": bool}


def _is(value, declared: str) -> bool:
    # bool is a subclass of int in Python, so a boolean must never satisfy "number".
    if declared == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return isinstance(value, TYPES[declared])


def parse(text: str, schema: list) -> dict:
    open_at = text.find("{")
    close_at = text.rfind("}")
    if open_at == -1 or close_at < open_at:
        return {"ok": False, "error": "no_json"}

    try:
        value = json.loads(text[open_at : close_at + 1])
    except ValueError:
        return {"ok": False, "error": "malformed_json"}

    for field in schema:
        if field["name"] not in value:
            return {"ok": False, "error": f"missing_field:{field['name']}"}

    for field in schema:
        if not _is(value[field["name"]], field["type"]):
            return {"ok": False, "error": f"wrong_type:{field['name']}"}

    known = {field["name"] for field in schema}
    extra = next((key for key in value if key not in known), None)
    if extra is not None:
        return {"ok": False, "error": f"unknown_field:{extra}"}

    return {"ok": True, "value": value}
