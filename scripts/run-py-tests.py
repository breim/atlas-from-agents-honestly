#!/usr/bin/env python3.11
"""Runs every exercise's Python test.

`unittest discover` imports test files by module name, and every exercise names
its test file the same thing, so discovery would collide on the second one.
Loading each file by path under a unique module name is the whole reason this
script exists — and it keeps the repository free of a test dependency.
"""

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "py"))


def load(path: Path) -> unittest.TestSuite:
    slug = path.relative_to(ROOT).parent.parent.as_posix().replace("/", "_").replace("-", "_")
    spec = importlib.util.spec_from_file_location(f"exercise_{slug}", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return unittest.defaultTestLoader.loadTestsFromModule(module)


def main() -> int:
    files = sorted((ROOT / "exercises").glob("**/py/test_*.py"))
    if not files:
        print("no exercise tests yet")
        return 0

    suite = unittest.TestSuite(load(path) for path in files)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
