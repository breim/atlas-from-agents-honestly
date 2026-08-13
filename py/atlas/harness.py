"""Loading half of an exercise, and the fixture both language tracks share."""

import importlib.util
import json
import os
from pathlib import Path
from types import ModuleType


class Unimplemented(Exception):
    def __init__(self, what: str) -> None:
        super().__init__(f"{what} is not implemented yet")


def load_impl(test_file: str) -> ModuleType:
    """Import this exercise's `start.py`, or `solution.py` when ATLAS_SOLUTIONS is set."""
    name = "solution" if os.environ.get("ATLAS_SOLUTIONS") else "start"
    path = Path(test_file).resolve().with_name(f"{name}.py")
    module_name = f"atlas_exercise_{path.parent.parent.name.replace('-', '_')}_{name}"

    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expected(test_file: str) -> dict:
    return json.loads((Path(test_file).resolve().parent.parent / "expected.json").read_text())


def case(fixture: dict, case_id: str) -> dict:
    for entry in fixture["cases"]:
        if entry["id"] == case_id:
            return entry
    raise KeyError(f"no case {case_id!r} in {fixture['chapter']}")
