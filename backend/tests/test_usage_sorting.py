from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from fastapi.testclient import TestClient

from cidian.api import create_app
from cidian.db import DictionaryBuilder, DictionaryRepository
from cidian.db.dictionary_database import ensure_usage_ranks


class UsageSortingTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.db = self.root / "dictionary.sqlite3"
        self.char_file = self.root / "dictionary_char_2025-12-27.jsonl"
        self.word_file = self.root / "dictionary_word_2025-12-27.jsonl"
        records = [
            {"char": "世", "statistics": {"movieCharRank": 340}},
            {"char": "事", "statistics": {"movieCharRank": 20, "bookCharRank": 500}},
            {"char": "尸"},
            {"char": "市", "statistics": {"bookCharRank": 100}},
            {"char": "史", "statistics": {"movieCharRank": 0, "bookCharRank": 100}},
        ]
        # 事 matches English only through a word; it must still rank first.
        for record in records:
            record.update(pinyin="shì", gloss="affair" if record["char"] != "事" else "matter")
        self.char_file.write_text("\n".join(json.dumps(record) for record in records))
        self.word_file.write_text(json.dumps({"simp": "世事", "trad": "世事", "gloss": "affair"}))
        DictionaryBuilder(self.db, self.char_file, self.word_file).create_database()

    def test_ranks_all_matches_before_limiting_in_both_modes(self):
        repository = DictionaryRepository(self.db)
        self.addCleanup(repository.close)
        for search in (repository.search_characters, repository.search_characters_by_translation):
            query = "shi" if search == repository.search_characters else "affair"
            self.assertEqual([row[0] for row in search(query)], ["事", "史", "市", "世", "尸"])
            self.assertEqual([row[0] for row in search(query, limit=1)], ["事"])

    def test_startup_backfills_legacy_database_and_preserves_entries(self):
        with closing(sqlite3.connect(self.db)) as conn, conn:
            before = conn.execute("SELECT id, char, gloss, pinyin_text FROM characters").fetchall()
            conn.execute("ALTER TABLE characters DROP COLUMN usage_rank")
        app = create_app(self.db, resources=self.root, frontend=self.root / "no-build")
        with TestClient(app) as client:
            for mode, query in [("character", "shi"), ("translation", "affair")]:
                response = client.get("/api/dictionary/search", params={"q": query, "mode": mode, "limit": 1})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["results"][0]["character"], "事")
        with closing(sqlite3.connect(self.db)) as conn, conn:
            self.assertEqual(conn.execute("SELECT id, char, gloss, pinyin_text FROM characters").fetchall(), before)
        modified = self.db.stat().st_mtime_ns
        ensure_usage_ranks(self.db, self.char_file)
        self.assertEqual(self.db.stat().st_mtime_ns, modified)

    def test_failed_backfill_rolls_back_schema_and_can_be_retried(self):
        with closing(sqlite3.connect(self.db)) as conn, conn:
            conn.execute("ALTER TABLE characters DROP COLUMN usage_rank")
        with self.assertRaises(FileNotFoundError):
            ensure_usage_ranks(self.db, self.root / "missing.jsonl")
        with closing(sqlite3.connect(self.db)) as conn, conn:
            self.assertNotIn("usage_rank", [r[1] for r in conn.execute("PRAGMA table_info(characters)")])
        ensure_usage_ranks(self.db, self.char_file)
        with closing(sqlite3.connect(self.db)) as conn, conn:
            self.assertEqual(conn.execute("SELECT usage_rank FROM characters WHERE char = '事'").fetchone()[0], 20)
