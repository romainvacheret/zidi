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
