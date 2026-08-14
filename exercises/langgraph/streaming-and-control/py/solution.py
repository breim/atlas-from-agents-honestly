def assemble(chunks: list) -> dict:
    text = ""
    complete = False
    open_call = None
    tool_calls: list = []

    for chunk in chunks:
        kind = chunk["type"]
        if kind == "text":
            text += chunk.get("value", "")
        elif kind == "tool_start":
            open_call = {"name": chunk.get("value", ""), "args": ""}
        elif kind == "tool_arg" and open_call:
            open_call["args"] += chunk.get("value", "")
        elif kind == "tool_end" and open_call:
            # Only a closed call is real; an open one at the end is dropped.
            tool_calls.append(open_call)
            open_call = None
        elif kind == "done":
            complete = True

    return {"text": text, "toolCalls": tool_calls, "complete": complete}
