import json
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from cidian.api import create_app


class DictionaryApiTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.db = self.root / "dictionary.sqlite3"
        characters = [
            {"char": "世", "pinyin": "shì", "pinyinSearchString": "shi", "gloss": "generation"},
            {"char": "尸", "pinyin": "shī", "gloss": "corpse"},
            {"char": "律", "pinyin": "lǜ", "gloss": "law"},
        ]
        words = [{"simp": "世界", "gloss": "world", "pinyin": "shì jiè"}]
        for name, records in [("char", characters), ("word", words)]:
            (self.root / f"dictionary_{name}_2025-12-27.jsonl").write_text(
                "\n".join(json.dumps(record) for record in records), encoding="utf-8")
        self.app = create_app(self.db, resources=self.root, frontend=self.root / "no-build")

    def test_builds_database_and_searches_all_existing_modes(self):
        with TestClient(self.app) as client:
            self.assertTrue(self.db.exists())
            cases = [("世", "character", ["世"]), ("shi", "character", ["世", "尸"]),
                     ("shi4", "character", ["世"]), ("shì", "character", ["世"]),
                     ("law", "translation", ["律"]), ("world", "translation", ["世"])]
            for query, mode, expected in cases:
                with self.subTest(query=query):
                    response = client.get("/api/dictionary/search", params={"q": query, "mode": mode})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual([r["character"] for r in response.json()["results"]], expected)
            entry = client.get("/api/dictionary/search?q=世").json()["results"][0]
            self.assertEqual(entry["pinyin"], "shì")
            self.assertEqual(entry["gloss"], "generation")
            modified = self.db.stat().st_mtime_ns
        with TestClient(self.app):
            self.assertEqual(self.db.stat().st_mtime_ns, modified)

    def test_validates_requests_and_handles_empty_results_and_limits(self):
        with TestClient(self.app) as client:
            for params in [{}, {"q": ""}, {"q": "x" * 201}, {"q": "shi", "mode": "invalid"},
                           {"q": "shi", "limit": 0}, {"q": "shi", "limit": 101}]:
                self.assertEqual(client.get("/api/dictionary/search", params=params).status_code, 422)
            for query in ["   ", "no-match"]:
                self.assertEqual(client.get("/api/dictionary/search", params={"q": query}).json()["results"], [])
            response = client.get("/api/dictionary/search?q=shi&limit=1").json()
            self.assertEqual(len(response["results"]), 1)
            self.assertEqual(response["limit"], 1)

    def test_concurrent_requests_use_independent_connections(self):
        with TestClient(self.app) as client, ThreadPoolExecutor(max_workers=4) as executor:
            responses = list(executor.map(lambda _: client.get("/api/dictionary/search?q=shi4"), range(12)))
            self.assertTrue(all(r.status_code == 200 and r.json()["results"][0]["character"] == "世"
                                for r in responses))

    def test_serves_frontend_and_api_from_same_origin(self):
        frontend = self.root / "dist"
        frontend.mkdir()
        (frontend / "index.html").write_text("<html>Zidi</html>")
        app = create_app(self.db, resources=self.root, frontend=frontend)
        with TestClient(app) as client:
            self.assertEqual(client.get("/").text, "<html>Zidi</html>")
            self.assertEqual(client.get("/api/dictionary/search?q=世").status_code, 200)
            self.assertEqual(client.get("/api/missing").status_code, 404)

    def test_failed_import_does_not_publish_incomplete_database(self):
        (self.root / "dictionary_word_2025-12-27.jsonl").write_text("invalid json")
        with self.assertRaises(json.JSONDecodeError), TestClient(self.app):
            pass
        self.assertFalse(self.db.exists())
