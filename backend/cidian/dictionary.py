"""Dictionary operations independent of HTTP and desktop GUI frameworks."""

from pathlib import Path
from typing import Literal
import unicodedata

from .db import DictionaryRepository
from .db.dictionary_database import iter_keyed_strings
from .character_graphics import character_strokes

SearchMode = Literal["character", "translation"]


def tone_only_pinyin(raw_pinyin: str) -> str:
    tokens = raw_pinyin.split()
    tones = set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ")
    marked = [token for token in tokens if any(c.isdigit() or c in tones for c in token)]
    return " ".join(marked) if marked else raw_pinyin.strip()


def search_dictionary(db_file: Path, query: str, mode: SearchMode, limit: int) -> list[dict]:
    # Open and close in the calling thread; SQLite connections aren't shared
    # between FastAPI worker threads or future desktop bridge calls.
    repository = DictionaryRepository(db_file)
    try:
        search = (repository.search_characters_by_translation
                  if mode == "translation" else repository.search_characters)
        character_rows = search(query, limit)
        ranks = repository.character_usage_ranks([row[0] for row in character_rows])
        results = [
            {"character": char, "pinyin": tone_only_pinyin(pinyin),
             "gloss": gloss, "codepoint": codepoint, "kind": "character", "usage_rank": ranks.get(char)}
            for char, gloss, pinyin, codepoint in character_rows
        ]
        for record in repository.search_words(query, limit, translation=mode == "translation"):
            detail = word_details_data(record)
            results.append({"character": record["simp"], "pinyin": detail["pinyin"],
                            "gloss": detail["gloss"], "codepoint": None, "kind": "word",
                            "usage_rank": record.get("usage_rank")})
        results.sort(key=lambda entry: (entry["usage_rank"] is None, entry["usage_rank"] or 0, entry["character"]))
        unique = {}
        for entry in results:
            unique.setdefault(entry["character"], entry)
        return list(unique.values())[:limit]
    finally:
        repository.close()


def word_details_data(record: dict) -> dict:
    statistics = record.get("statistics") or {}
    readings = list(dict.fromkeys(" ".join(text.replace("\u200b", " ").replace("\u200c", " ").replace("\u200d", " ").split())
                                 for text in iter_keyed_strings(record, {"pinyin"}) if text.strip()))
    definitions = list(dict.fromkeys(text for item in record.get("items", [])
                                    for text in (item.get("definitions") or []) if isinstance(text, str)))
    if not definitions and record.get("gloss"):
        definitions = [record["gloss"]]
    return {
        "character": record["simp"], "traditional": record.get("trad"), "codepoint": None,
        "pinyin": " · ".join(readings) or tone_only_pinyin(record.get("pinyin_text", "")),
        "gloss": record.get("gloss") or (definitions[0] if definitions else None),
        "readings": readings, "definitions": definitions,
        "hsk_level": statistics.get("hskLevel"), "movie_rank": statistics.get("movieWordRank"),
        "book_rank": statistics.get("bookWordRank"),
        "characters": list(dict.fromkeys(c for c in record["simp"]
                                         if unicodedata.name(c, "").startswith(("CJK UNIFIED IDEOGRAPH", "CJK COMPATIBILITY IDEOGRAPH")) or c == "〇")),
        "sources": list(dict.fromkeys(item["source"] for item in record.get("items", []) if item.get("source"))),
    }


def word_details(db_file: Path, word: str) -> dict | None:
    repository = DictionaryRepository(db_file)
    try:
        record = repository.get_word(word)
    finally:
        repository.close()
    return word_details_data(record) if record else None


def character_details(db_file: Path, character: str) -> dict | None:
    repository = DictionaryRepository(db_file)
    try:
        record = repository.get_character(character)
    finally:
        repository.close()
    if record is None:
        return None
    statistics = record.get("statistics") or {}
    return {
        "character": record["char"], "gloss": record.get("gloss"),
        "stroke_data": character_strokes(record),
        "pinyin": tone_only_pinyin(record["pinyin_text"]), "codepoint": record.get("codepoint"),
        "stroke_count": record.get("strokeCount"), "original_meaning": record.get("originalMeaning"),
        "hint": record.get("hint"), "hsk_level": statistics.get("hskLevel"),
        "movie_rank": statistics.get("movieCharRank"), "book_rank": statistics.get("bookCharRank"),
        "readings": list(dict.fromkeys(r["pinyin"] for r in record.get("pinyinFrequencies", []) if r.get("pinyin"))),
        "components": [{"character": c["character"], "roles": c.get("type") or [], "hint": c.get("hint")}
                       for c in record.get("components", []) if c.get("character")],
        "words": [{"word": w["word"], "traditional": w.get("trad"), "gloss": w.get("gloss")}
                  for w in statistics.get("topWords", []) if w.get("word")],
        "variants": list(dict.fromkeys(v["char"] for v in record.get("variants", [])
                                       if v.get("char") and v["char"] != character)),
        "sources": record.get("sources") or [],
    }
