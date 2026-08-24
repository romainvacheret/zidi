from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from cidian.db import (
    DictionaryBuilder,
    DictionaryRepository,
    contains_tone_marks,
    normalize_pinyin_term,
    pinyin_syllable_to_numbered,
)


class DictionaryDatabaseTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.char_file = self.root / "chars.jsonl"
        self.word_file = self.root / "words.jsonl"
        self.db_file = self.root / "dictionary.sqlite3"

        self._write_jsonl(
            self.char_file,
            [
                {
                    "_id": "c1",
                    "char": "世",
                    "codepoint": "U+4E16",
                    "strokeCount": 5,
                    "gloss": "generation",
                    "pinyin": "shì",
                },
                {
                    "_id": "c2",
                    "char": "尸",
                    "codepoint": "U+5C38",
                    "strokeCount": 3,
                    "gloss": "corpse",
                    "pinyin": "shī",
                },
                {
                    "_id": "c3",
                    "char": "识",
                    "codepoint": "U+8BC6",
                    "strokeCount": 7,
                    "gloss": "know",
                    "pinyin": "shí",
                },
                {
                    "_id": "c4",
                    "char": "史",
                    "codepoint": "U+53F2",
                    "strokeCount": 5,
                    "gloss": "history",
                    "pinyin": "shǐ",
                },
                {
                    "_id": "c5",
                    "char": "吕",
                    "codepoint": "U+5415",
                    "strokeCount": 6,
                    "gloss": "pitchpipe",
                    "pinyin": "lǚ",
                },
                {
                    "_id": "c6",
                    "char": "律",
                    "codepoint": "U+5F8B",
                    "strokeCount": 9,
                    "gloss": "law",
                    "pinyin": "lǜ",
                },
            ],
        )
        self._write_jsonl(
            self.word_file,
            [
                {
                    "_id": "w1",
                    "simp": "世事",
                    "trad": "世事",
                    "gloss": "world affairs",
                    "items": [{"pinyin": "shìshì"}],
                    "pinyinSearchString": "shìshì shi4shi4 shishi",
                }
            ],
        )

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def _write_jsonl(self, path: Path, records: list[dict]) -> None:
        with path.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record, ensure_ascii=False))
                handle.write("\n")

    def _search_chars(self, query: str) -> list[str]:
        repo = DictionaryRepository(self.db_file)
        self.addCleanup(repo.close)
        return [row[0] for row in repo.search_characters(query)]

    def test_builder_creates_database(self) -> None:
        builder = DictionaryBuilder(self.db_file, self.char_file, self.word_file)
        counts = builder.create_database()

        self.assertEqual(counts, (6, 1))
        self.assertTrue(self.db_file.exists())

    def test_tone_marked_pinyin_maps_to_correct_tone_number(self) -> None:
        self.assertEqual(pinyin_syllable_to_numbered("shì"), "shi4")
        self.assertEqual(pinyin_syllable_to_numbered("lǜ"), "lv4")
        self.assertTrue(contains_tone_marks("shì"))
        self.assertFalse(contains_tone_marks("shi"))

    def test_search_by_tone_less_pinyin_matches_all_tones(self) -> None:
        DictionaryBuilder(self.db_file, self.char_file, self.word_file).create_database()

        results = self._search_chars("shi")

        self.assertCountEqual(results, ["世", "尸", "识", "史"])

    def test_search_by_numbered_pinyin_matches_one_tone(self) -> None:
        DictionaryBuilder(self.db_file, self.char_file, self.word_file).create_database()

        self.assertEqual(self._search_chars("shi1"), ["尸"])
        self.assertEqual(self._search_chars("shì"), ["世"])

    def test_search_normalizes_umlaut_via_v(self) -> None:
        DictionaryBuilder(self.db_file, self.char_file, self.word_file).create_database()

        self.assertCountEqual(self._search_chars("lv"), ["吕", "律"])
        self.assertEqual(self._search_chars("lǜ"), ["律"])

    def test_search_accepts_exact_character_lookup(self) -> None:
        DictionaryBuilder(self.db_file, self.char_file, self.word_file).create_database()

        self.assertEqual(self._search_chars("世"), ["世"])


if __name__ == "__main__":
    unittest.main()
