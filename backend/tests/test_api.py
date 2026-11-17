from contextlib import closing
import json
import sqlite3
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
            {"char": "世", "pinyin": "shì", "pinyinSearchString": "shi", "gloss": "generation",
             "strokeCount": 5, "codepoint": "U+4E16", "hint": "Depicts leaves.", "originalMeaning": "leaf",
             "pinyinFrequencies": [{"pinyin": "shì", "count": 1238}],
             "components": [{"character": "木", "type": ["meaning"], "hint": None}],
             "images": [{"source": "makemeahanzi", "type": "Regular", "fragments": [[0]],
                         "data": {"strokes": ["M 10 10 L 20 20 Z"], "medians": [[[10, 10], [20, 20]]]}}],
             "variants": [{"char": "世"}, {"char": "枼"}, {"char": "枼"}, {"char": ""}],
             "sources": ["unicode"], "statistics": {"hskLevel": 3, "movieCharRank": 340,
                 "topWords": [{"word": "世界", "trad": "世界", "gloss": "world"}]}},
            {"char": "尸", "pinyin": "shī", "gloss": "corpse"},
            {"char": "律", "pinyin": "lǜ", "gloss": "law"},
        ]
        words = [{"simp": "世界", "gloss": "world", "pinyin": "shì jiè"}]
        for name, records in [("char", characters), ("word", words)]:
            (self.root / f"dictionary_{name}_2025-12-27.jsonl").write_text(
                "\n".join(json.dumps(record) for record in records), encoding="utf-8")
        self.app = create_app(self.db, resources=self.root, frontend=self.root / "no-build")

    def test_graph_vocabulary_and_request_validation(self):
        with TestClient(self.app) as client:
            with closing(sqlite3.connect(self.db)) as connection, connection:
                record = {"simp": "世界", "gloss": "world", "pinyin": "shì jiè",
                          "statistics": {"hskLevel": 3}}
                connection.execute("UPDATE words SET source_json = ? WHERE simp = ?",
                                   (json.dumps(record), "世界"))
            result = client.get("/api/graph/vocabulary", params={"levels": 3, "limit": 50})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json(), {"entries": [{"text": "世界", "pronunciation": "shì jiè",
                                                          "description": "world"}], "has_more": False, "allowed_characters": ["世"]})
            self.assertEqual(client.get("/api/graph/vocabulary").json()["entries"], [])
            self.assertEqual(client.get("/api/graph/vocabulary?levels=3&character=世&exclude=世界").json()["entries"], [])
            multiple = client.get('/api/graph/vocabulary?levels=1&levels=3')
            self.assertEqual(len(multiple.json()['entries']), 1)
            self.assertEqual(client.get('/api/graph/neighborhood?target=世&levels=10').status_code, 422)
            neighborhood = client.get("/api/graph/neighborhood?target=世&limit=50&levels=3")
            self.assertEqual(neighborhood.status_code, 200)
            self.assertEqual(neighborhood.json()["entries"][0]["text"], "世界")
            for params in [{}, {"target": "世", "limit": 0}, {"target": "世", "limit": 301}]:
                self.assertEqual(client.get("/api/graph/neighborhood", params=params).status_code, 422)
            for params in [{"levels": 0}, {"levels": 10}, {"limit": 0}, {"limit": 301}, {"character": "世界"}]:
                self.assertEqual(client.get("/api/graph/vocabulary", params=params).status_code, 422)

    def test_builds_database_and_searches_all_existing_modes(self):
        with TestClient(self.app) as client:
            self.assertTrue(self.db.exists())
            cases = [("世", "character", ["世"]), ("shi", "character", ["世", "尸"]),
                     ("shi4", "character", ["世"]), ("shì", "character", ["世"]),
                     ("law", "translation", ["律"]), ("world", "translation", ["世", "世界"])]
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

    def test_character_details_include_source_fields_and_handle_missing_data(self):
        with TestClient(self.app) as client:
            response = client.get("/api/dictionary/characters/世")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["stroke_count"], 5)
            self.assertEqual(data["original_meaning"], "leaf")
            self.assertEqual(data["readings"], ["shì"])
            self.assertEqual(data["components"][0]["roles"], ["meaning"])
            self.assertEqual(data["words"][0]["gloss"], "world")
            self.assertEqual(data["variants"], ["枼"])
            self.assertEqual(data["movie_rank"], 340)
            self.assertEqual(data["sources"], ["unicode"])
            self.assertEqual(data["stroke_data"]["component_indices"], [0])
            self.assertEqual(data["stroke_data"]["medians"], [[[10, 10], [20, 20]]])
            sparse = client.get("/api/dictionary/characters/尸").json()
            self.assertIsNone(sparse["hint"])
            self.assertEqual(sparse["components"], [])
            self.assertIsNone(sparse["stroke_data"])
            self.assertEqual(client.get("/api/dictionary/characters/𠮷").status_code, 404)
            self.assertEqual(client.get("/api/dictionary/characters/世界").status_code, 422)

    def test_backfills_character_details_without_rebuilding_existing_database(self):
        with TestClient(self.app):
            pass
        with closing(sqlite3.connect(self.db)) as conn, conn:
            conn.execute("ALTER TABLE characters DROP COLUMN source_json")
            before = conn.execute("SELECT id, char, usage_rank FROM characters").fetchall()
        with TestClient(self.app) as client:
            self.assertEqual(client.get("/api/dictionary/characters/世").json()["original_meaning"], "leaf")
        with closing(sqlite3.connect(self.db)) as conn, conn:
            self.assertEqual(conn.execute("SELECT id, char, usage_rank FROM characters").fetchall(), before)
