#!/usr/bin/env python3.11
"""Runs the kernel labs and every exercise's Python test.

`unittest discover` imports test files by module name, and every exercise names
its test file the same thing, so discovery would collide on the second one.
Loading each file by path under a unique module name is the whole reason this
script exists — and it keeps the repository free of a test dependency.

The kernel labs stay runnable the way the book documents them:

    cd py && python3.11 -m unittest discover -s tests -v
"""

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "py"))


def load(path: Path) -> unittest.TestSuite:
    slug = path.relative_to(ROOT).with_suffix("").as_posix().replace("/", "_").replace("-", "_")
    spec = importlib.util.spec_from_file_location(slug, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return unittest.defaultTestLoader.loadTestsFromModule(module)


def main() -> int:
    files = sorted((ROOT / "py" / "tests").glob("test_*.py"))
    if (ROOT / "exercises").is_dir():
        files += sorted((ROOT / "exercises").glob("**/py/test_*.py"))

    suite = unittest.TestSuite(load(path) for path in files)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
