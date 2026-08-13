def order(blocks: list) -> dict:
    stable = [block for block in blocks if not block["volatile"]]
    volatile = [block for block in blocks if block["volatile"]]

    return {
        "ordered": [block["id"] for block in [*stable, *volatile]],
        "prefixTokens": sum(block["tokens"] for block in stable),
    }
