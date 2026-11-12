import json
from contextlib import closing
import sqlite3
from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient

from cidian.api import create_app


class WordSearchTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / "dictionary_char_2025-12-27.jsonl").write_text("")
        self.words = self.root / "dictionary_word_2025-12-27.jsonl"
        records = [{
            "simp": "世界", "trad": "世界", "gloss": "world",
            "items": [{"pinyin": "shì jiè", "definitions": ["world"]}],
            "pinyinSearchString": "shìjiè shi4jie4 shijie",
            "statistics": {"movieWordRank": 301},
        }, {
            "simp": "电脑", "trad": "電腦", "gloss": "computer",
            "items": [{"source": "cedict", "pinyin": "diàn\u200bnǎo", "definitions": ["computer", "PC"]}],
            "pinyinSearchString": "diànnǎo dian4nao3 diannao",
            "statistics": {"bookWordRank": 500},
        }, {
            "simp": "绿茶", "trad": "綠茶", "gloss": "green tea",
            "items": [{"pinyin": "lǜ\u200bchá", "definitions": ["green tea"]}],
            "pinyinSearchString": "lǜchá lv4cha2 lvcha",
        }, {
            "simp": "事界", "trad": "事界", "gloss": "world",
            "items": [{"pinyin": "shì jiè", "definitions": ["world"]}],
            "statistics": {"movieWordRank": 900},
        }]
        self.words.write_text("\n".join(json.dumps(record) for record in records))
        self.app = create_app(self.root / "dictionary.sqlite3", resources=self.root,
                              frontend=self.root / "no-build")

    def test_search_finds_whole_word_by_chinese_and_pinyin(self):
        with TestClient(self.app) as client:
            for query in ["世界", "shijie", "shi jie", "shi4jie4", "shi4 jie4", "shì jiè", "shìjiè"]:
                with self.subTest(query=query):
                    response = client.get("/api/dictionary/search", params={"q": query})
                    self.assertEqual(response.status_code, 200)
                    self.assertIn("世界", [entry["character"] for entry in response.json()["results"]])

    def test_traditional_forms_umlaut_and_whole_phrase_matching(self):
        with TestClient(self.app) as client:
            for query, expected in [("電腦", "电脑"), ("diàn nǎo", "电脑"), ("dian4 nao3", "电脑"),
                                    ("lvcha", "绿茶"), ("lü cha", "绿茶"), ("lǜ chá", "绿茶"), ("lv4cha2", "绿茶")]:
                with self.subTest(query=query):
                    results = client.get("/api/dictionary/search", params={"q": query}).json()["results"]
                    self.assertIn(expected, [r["character"] for r in results])
            for query in ["shi", "shi4", "shi1jie4", "nǎo"]:
                self.assertEqual(client.get("/api/dictionary/search", params={"q": query}).json()["results"], [])

    def test_frequency_order_and_limits_include_words_and_translation(self):
        with TestClient(self.app) as client:
            for mode, query in [("character", "shijie"), ("translation", "world")]:
                results = client.get("/api/dictionary/search", params={"q": query, "mode": mode}).json()["results"]
                self.assertEqual([r["character"] for r in results], ["世界", "事界"])
                self.assertTrue(all(r["kind"] == "word" for r in results))
                limited = client.get("/api/dictionary/search", params={"q": query, "mode": mode, "limit": 1}).json()
                self.assertEqual([r["character"] for r in limited["results"]], ["世界"])

    def test_word_detail_uses_dictionary_record_and_handles_missing_word(self):
        with TestClient(self.app) as client:
            response = client.get("/api/dictionary/words/電腦")
            self.assertEqual(response.status_code, 200)
            detail = response.json()
            self.assertEqual(detail["character"], "电脑")
            self.assertEqual(detail["traditional"], "電腦")
            self.assertEqual(detail["readings"], ["diàn nǎo"])
            self.assertEqual(detail["definitions"], ["computer", "PC"])
            self.assertEqual(detail["characters"], ["电", "脑"])
            self.assertEqual(detail["sources"], ["cedict"])
            self.assertEqual(client.get("/api/dictionary/words/不存在的词").status_code, 404)

    def test_upgrades_existing_database_transactionally_and_preserves_words(self):
        from cidian.db.dictionary_database import ensure_word_search
        with TestClient(self.app):
            pass
        database = self.root / "dictionary.sqlite3"
        with closing(sqlite3.connect(database)) as conn, conn:
            before = conn.execute("SELECT id, simp, trad, pinyin_text FROM words").fetchall()
            conn.execute("DROP TABLE word_lookup_terms")
            conn.execute("ALTER TABLE words DROP COLUMN source_json")
            conn.execute("ALTER TABLE words DROP COLUMN usage_rank")
        original = self.words.read_text()
        self.words.write_text("invalid json")
        with self.assertRaises(json.JSONDecodeError):
            ensure_word_search(database, self.words)
        with closing(sqlite3.connect(database)) as conn:
            self.assertNotIn("source_json", [r[1] for r in conn.execute("PRAGMA table_info(words)")])
        self.words.write_text(original)
        with TestClient(self.app) as client:
            self.assertEqual(client.get("/api/dictionary/search?q=shijie&limit=1").json()["results"][0]["character"], "世界")
        with closing(sqlite3.connect(database)) as conn:
            self.assertEqual(conn.execute("SELECT id, simp, trad, pinyin_text FROM words").fetchall(), before)
        modified = database.stat().st_mtime_ns
        ensure_word_search(database, self.words)
        self.assertEqual(database.stat().st_mtime_ns, modified)
