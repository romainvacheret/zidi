"""Dictionary operations independent of HTTP and desktop GUI frameworks."""

from pathlib import Path
from typing import Literal

from .db import DictionaryRepository

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
        return [
            {"character": char, "pinyin": tone_only_pinyin(pinyin),
             "gloss": gloss, "codepoint": codepoint}
            for char, gloss, pinyin, codepoint in search(query, limit)
        ]
    finally:
        repository.close()


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
