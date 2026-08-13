def render(writes: list) -> str:
    """Assigning an existing dict key updates in place and keeps its insertion position."""
    pad: dict[str, str] = {}
    for write in writes:
        pad[write["key"]] = write["value"]

    return "\n".join(f"{key}={value}" for key, value in pad.items())
