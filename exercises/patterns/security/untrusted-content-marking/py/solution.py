def ceiling(sources: list, order: list) -> str:
    def level(source: str) -> int:
        """An unrecognised marking ranks at the bottom of the order, not off it."""
        return order.index(source) if source in order else 0

    lowest = min([level(source) for source in sources], default=len(order) - 1)

    return order[lowest]
