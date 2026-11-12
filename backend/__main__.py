from __future__ import annotations

from pathlib import Path

from cidian.db import DictionaryBuilder
from cidian.gui import launch


DB_FILE = Path("dictionary.sqlite3")


def main() -> int:
    if not DB_FILE.exists():
        DictionaryBuilder(DB_FILE).create_database()
    return launch(DB_FILE)


if __name__ == "__main__":
    raise SystemExit(main())
