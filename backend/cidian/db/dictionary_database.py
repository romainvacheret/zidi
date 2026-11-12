"""SQLite builder and repository for the Chinese dictionary data files."""

from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Iterable, Iterator


DEFAULT_CHAR_FILE = "resources/dictionary_char_2025-12-27.jsonl"
DEFAULT_WORD_FILE = "resources/dictionary_word_2025-12-27.jsonl"

_PINYIN_SPLIT_RE = re.compile(r"[\s\-\u200b\u200c\u200d'’·.]+")
_PINYIN_SEARCH_SPLIT_RE = re.compile(r"\s+")

_PINYIN_V_VARIANTS = {
    "ü": "v",
    "ǖ": "v",
    "ǘ": "v",
    "ǚ": "v",
    "ǜ": "v",
}

_PINYIN_TONE_MAP = {
    "ā": ("a", "1"),
    "á": ("a", "2"),
    "ǎ": ("a", "3"),
    "à": ("a", "4"),
    "ē": ("e", "1"),
    "é": ("e", "2"),
    "ě": ("e", "3"),
    "è": ("e", "4"),
    "ī": ("i", "1"),
    "í": ("i", "2"),
    "ǐ": ("i", "3"),
    "ì": ("i", "4"),
    "ō": ("o", "1"),
    "ó": ("o", "2"),
    "ǒ": ("o", "3"),
    "ò": ("o", "4"),
    "ū": ("u", "1"),
    "ú": ("u", "2"),
    "ǔ": ("u", "3"),
    "ù": ("u", "4"),
    "ǖ": ("v", "1"),
    "ǘ": ("v", "2"),
    "ǚ": ("v", "3"),
    "ǜ": ("v", "4"),
}

_SEARCH_SEPARATORS = {" ", "\t", "\n", "\r", "-", "_", "'", "’", "·", "."}
_TRANSLATION_FIELDS = {"gloss", "originalMeaning", "hint"}
_TRANSLATION_SPLIT_RE = re.compile(r"[^0-9a-z]+")


def iter_keyed_strings(value, keys: set[str]) -> Iterator[str]:
    for _, text in iter_keyed_strings_with_field(value, keys):
        yield text


def iter_keyed_strings_with_field(value, keys: set[str]) -> Iterator[tuple[str, str]]:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in keys and isinstance(child, str):
                yield key, child
            yield from iter_keyed_strings_with_field(child, keys)
    elif isinstance(value, list):
        for item in value:
            yield from iter_keyed_strings_with_field(item, keys)


def unique_terms(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        value = value.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def unique_raw_values(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        value = value.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def normalize_pinyin_term(text: str, *, keep_digits: bool) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text.strip().lower())
    text = "".join(_PINYIN_V_VARIANTS.get(char, char) for char in text)
    text = unicodedata.normalize("NFD", text)
    pieces: list[str] = []
    for char in text:
        if unicodedata.combining(char):
            continue
        if char in _SEARCH_SEPARATORS:
            continue
        if not keep_digits and char.isdigit():
            continue
        pieces.append(char)
    return "".join(pieces)


def contains_tone_marks(text: str) -> bool:
    return any(char in _PINYIN_TONE_MAP for char in unicodedata.normalize("NFC", text.lower()))


def pinyin_syllable_to_numbered(token: str) -> str:
    token = unicodedata.normalize("NFC", token.strip().lower())
    if not token:
        return ""
    if any(char.isdigit() for char in token):
        return normalize_pinyin_term(token, keep_digits=True)

    pieces: list[str] = []
    tone: str | None = None
    for char in token:
        if char in _PINYIN_TONE_MAP:
            base, tone = _PINYIN_TONE_MAP[char]
            pieces.append(base)
        elif char in _PINYIN_V_VARIANTS:
            pieces.append("v")
        elif unicodedata.combining(char):
            continue
        elif char in _SEARCH_SEPARATORS:
            continue
        else:
            pieces.append(char)
    numbered = "".join(pieces)
    return f"{numbered}{tone}" if tone else numbered


def pinyin_terms_from_phrase(text: str) -> list[str]:
    chunks = [chunk for chunk in _PINYIN_SPLIT_RE.split(text.strip()) if chunk]
    if not chunks:
        return []

    terms: list[str] = [normalize_pinyin_term(text, keep_digits=False)]
    if len(chunks) == 1:
        terms.append(pinyin_syllable_to_numbered(chunks[0]))
        return unique_terms(terms)

    terms.append("".join(normalize_pinyin_term(chunk, keep_digits=False) for chunk in chunks))
    terms.append("".join(pinyin_syllable_to_numbered(chunk) for chunk in chunks))
    for chunk in chunks:
        terms.extend(pinyin_terms_from_token(chunk))
    return unique_terms(terms)


def pinyin_terms_from_token(token: str) -> list[str]:
    normalized = normalize_pinyin_term(token, keep_digits=False)
    numbered = pinyin_syllable_to_numbered(token)
    return unique_terms([normalized, numbered])


def normalize_translation_term(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text.strip().casefold())
    pieces = [char if char.isalnum() else " " for char in text]
    return " ".join("".join(pieces).split())


def translation_terms_from_text(text: str) -> list[str]:
    normalized = normalize_translation_term(text)
    if not normalized:
        return []

    terms = [normalized]
    tokens = [token for token in _TRANSLATION_SPLIT_RE.split(normalized) if token]
    terms.extend(tokens)
    if len(tokens) > 1:
        terms.append(" ".join(tokens))
    return unique_terms(terms)


class DictionaryBuilder:
    def __init__(
        self,
        db_file: str | Path,
        char_file: str | Path = DEFAULT_CHAR_FILE,
        word_file: str | Path = DEFAULT_WORD_FILE,
    ) -> None:
        self.char_file = Path(char_file)
        self.word_file = Path(word_file)
        self.db_file = Path(db_file)

    def create_database(self) -> tuple[int, int]:
        """Create a fresh SQLite database from the JSONL sources."""
        self.db_file.parent.mkdir(parents=True, exist_ok=True)
        if self.db_file.exists():
            self.db_file.unlink()

        conn = sqlite3.connect(self.db_file)
        try:
            conn.execute("PRAGMA journal_mode = OFF")
            conn.execute("PRAGMA synchronous = OFF")
            conn.execute("PRAGMA temp_store = MEMORY")
            conn.execute("PRAGMA cache_size = -200000")

            self._create_schema(conn)
            with conn:
                char_count = self._import_jsonl(conn, self.char_file, "character")
                word_count = self._import_jsonl(conn, self.word_file, "word")
            return char_count, word_count
        finally:
            conn.close()

    def _create_schema(self, conn: sqlite3.Connection) -> None:
        conn.executescript(
            """
            PRAGMA foreign_keys = ON;

            DROP TABLE IF EXISTS character_search_terms;
            DROP TABLE IF EXISTS character_translation_terms;
            DROP TABLE IF EXISTS word_search_terms;
            DROP TABLE IF EXISTS word_translation_terms;
            DROP TABLE IF EXISTS characters;
            DROP TABLE IF EXISTS words;

            CREATE TABLE characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id TEXT,
                char TEXT NOT NULL,
                codepoint TEXT,
                stroke_count INTEGER,
                gloss TEXT,
                pinyin_text TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE character_search_terms (
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                term TEXT NOT NULL,
                PRIMARY KEY (character_id, term)
            );

            CREATE INDEX idx_characters_char ON characters(char);
            CREATE INDEX idx_character_terms_term ON character_search_terms(term);

            CREATE TABLE character_translation_terms (
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                term TEXT NOT NULL,
                PRIMARY KEY (character_id, term)
            );

            CREATE INDEX idx_character_translation_terms_term ON character_translation_terms(term);

            CREATE TABLE words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id TEXT,
                simp TEXT NOT NULL,
                trad TEXT,
                gloss TEXT,
                pinyin_text TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE word_search_terms (
                word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
                term TEXT NOT NULL,
                PRIMARY KEY (word_id, term)
            );

            CREATE INDEX idx_words_simp ON words(simp);
            CREATE INDEX idx_words_trad ON words(trad);
            CREATE INDEX idx_word_terms_term ON word_search_terms(term);

            CREATE TABLE word_translation_terms (
                word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
                term TEXT NOT NULL,
                PRIMARY KEY (word_id, term)
            );

            CREATE INDEX idx_word_translation_terms_term ON word_translation_terms(term);
            """
        )

    def _import_jsonl(self, conn: sqlite3.Connection, path: Path, kind: str) -> int:
        count = 0
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                if kind == "character":
                    self._insert_character(conn, record)
                elif kind == "word":
                    self._insert_word(conn, record)
                else:
                    raise ValueError(f"Unknown kind: {kind}")
                count += 1
        return count

    def _insert_character(self, conn: sqlite3.Connection, record: dict) -> None:
        pinyin_text = self._collect_raw_pinyin_text(record)
        cursor = conn.execute(
            """
            INSERT INTO characters (source_id, char, codepoint, stroke_count, gloss, pinyin_text)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                record.get("_id"),
                record.get("char", ""),
                record.get("codepoint"),
                record.get("strokeCount"),
                record.get("gloss"),
                pinyin_text,
            ),
        )
        character_id = cursor.lastrowid
        conn.executemany(
            "INSERT OR IGNORE INTO character_search_terms (character_id, term) VALUES (?, ?)",
            ((character_id, term) for term in self._build_character_terms(record)),
        )
        conn.executemany(
            "INSERT OR IGNORE INTO character_translation_terms (character_id, term) VALUES (?, ?)",
            ((character_id, term) for term in self._build_character_translation_terms(record)),
        )

    def _insert_word(self, conn: sqlite3.Connection, record: dict) -> None:
        pinyin_text = self._collect_raw_pinyin_text(record)
        cursor = conn.execute(
            """
            INSERT INTO words (source_id, simp, trad, gloss, pinyin_text)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                record.get("_id"),
                record.get("simp", ""),
                record.get("trad"),
                record.get("gloss"),
                pinyin_text,
            ),
        )
        word_id = cursor.lastrowid
        conn.executemany(
            "INSERT OR IGNORE INTO word_search_terms (word_id, term) VALUES (?, ?)",
            ((word_id, term) for term in self._build_word_terms(record)),
        )
        conn.executemany(
            "INSERT OR IGNORE INTO word_translation_terms (word_id, term) VALUES (?, ?)",
            ((word_id, term) for term in self._build_word_translation_terms(record)),
        )

    def _collect_raw_pinyin_text(self, record: dict) -> str:
        values = iter_keyed_strings(record, {"pinyin", "pinyinSearchString"})
        ordered = unique_raw_values(values)
        return " ".join(ordered)

    def _build_character_terms(self, record: dict) -> list[str]:
        terms: list[str] = [record.get("char", "")]
        for _, text in iter_keyed_strings_with_field(record, {"pinyin"}):
            terms.extend(pinyin_terms_from_phrase(text))
        return unique_terms(terms)

    def _build_word_terms(self, record: dict) -> list[str]:
        terms: list[str] = [record.get("simp", ""), record.get("trad", "")]
        for field, text in iter_keyed_strings_with_field(record, {"pinyin", "pinyinSearchString"}):
            if field == "pinyinSearchString":
                for token in _PINYIN_SEARCH_SPLIT_RE.split(text.strip()):
                    if token:
                        terms.extend(pinyin_terms_from_token(token))
            else:
                terms.extend(pinyin_terms_from_phrase(text))
        return unique_terms(terms)

    def _build_character_translation_terms(self, record: dict) -> list[str]:
        terms: list[str] = []
        for text in self._iter_translation_texts(record, character=True):
            terms.extend(translation_terms_from_text(text))
        return unique_terms(terms)

    def _build_word_translation_terms(self, record: dict) -> list[str]:
        terms: list[str] = []
        for text in self._iter_translation_texts(record, character=False):
            terms.extend(translation_terms_from_text(text))
        return unique_terms(terms)

    def _iter_translation_texts(self, value, *, character: bool) -> Iterator[str]:
        if isinstance(value, dict):
            for key, child in value.items():
                if character and key in _TRANSLATION_FIELDS and isinstance(child, str):
                    yield child
                elif not character and key == "gloss" and isinstance(child, str):
                    yield child
                elif not character and key == "definitions" and isinstance(child, list):
                    for item in child:
                        if isinstance(item, str):
                            yield item
                else:
                    yield from self._iter_translation_texts(child, character=character)
        elif isinstance(value, list):
            for item in value:
                yield from self._iter_translation_texts(item, character=character)


class DictionaryRepository:
    def __init__(self, db_file: str | Path) -> None:
        self.db_file = Path(db_file)
        self.conn = sqlite3.connect(self.db_file)

    def close(self) -> None:
        self.conn.close()

    def search_characters(self, query: str, limit: int = 50) -> list[tuple[str, str | None, str, str | None]]:
        """Search by exact character or by pinyin."""
        query = query.strip()
        if not query:
            return []

        if len(query) == 1 and not query.isascii():
            cursor = self.conn.execute(
                """
                SELECT DISTINCT c.char, c.gloss, c.pinyin_text, c.codepoint
                FROM characters AS c
                WHERE c.char = ?
                ORDER BY c.char
                LIMIT ?
                """,
                (query, limit),
            )
            return cursor.fetchall()

        candidate_terms = self._candidate_pinyin_terms(query)
        if not candidate_terms:
            return []

        placeholders = ",".join("?" for _ in candidate_terms)
        cursor = self.conn.execute(
            f"""
            SELECT DISTINCT c.char, c.gloss, c.pinyin_text, c.codepoint
            FROM characters AS c
            LEFT JOIN character_search_terms AS t ON t.character_id = c.id
            WHERE t.term IN ({placeholders})
               OR c.char = ?
            ORDER BY c.char
            LIMIT ?
            """,
            (*candidate_terms, query, limit),
        )
        return cursor.fetchall()

    def search_characters_by_translation(
        self,
        query: str,
        limit: int = 50,
    ) -> list[tuple[str, str | None, str, str | None]]:
        """Search characters by English translation text."""
        query = normalize_translation_term(query)
        if not query:
            return []

        candidate_terms = self._candidate_translation_terms(query)
        if not candidate_terms:
            return []

        character_rows = self._search_character_rows_by_translation_terms(candidate_terms, limit)
        if len(character_rows) >= limit:
            return character_rows[:limit]

        word_rows = self._search_character_rows_from_words_by_translation_terms(
            candidate_terms,
            limit=limit,
        )
        combined: list[tuple[str, str | None, str, str | None]] = []
        seen: set[str] = set()
        for row in character_rows + word_rows:
            character = row[0]
            if character in seen:
                continue
            seen.add(character)
            combined.append(row)
            if len(combined) >= limit:
                break
        return combined

    def _search_character_rows_by_translation_terms(
        self,
        candidate_terms: list[str],
        limit: int,
    ) -> list[tuple[str, str | None, str, str | None]]:
        placeholders = ",".join("?" for _ in candidate_terms)
        cursor = self.conn.execute(
            f"""
            SELECT DISTINCT c.char, c.gloss, c.pinyin_text, c.codepoint
            FROM characters AS c
            JOIN character_translation_terms AS t ON t.character_id = c.id
            WHERE t.term IN ({placeholders})
            ORDER BY c.char
            LIMIT ?
            """,
            (*candidate_terms, limit),
        )
        return cursor.fetchall()

    def _search_character_rows_from_words_by_translation_terms(
        self,
        candidate_terms: list[str],
        *,
        limit: int,
    ) -> list[tuple[str, str | None, str, str | None]]:
        placeholders = ",".join("?" for _ in candidate_terms)
        cursor = self.conn.execute(
            f"""
            SELECT DISTINCT w.simp, w.trad
            FROM words AS w
            JOIN word_translation_terms AS t ON t.word_id = w.id
            WHERE t.term IN ({placeholders})
            ORDER BY w.simp
            LIMIT ?
            """,
            (*candidate_terms, limit),
        )
        matched_words = cursor.fetchall()
        if not matched_words:
            return []

        characters: list[str] = []
        seen_characters: set[str] = set()
        for simp, trad in matched_words:
            for text in (simp, trad or ""):
                for character in text:
                    if character in seen_characters:
                        continue
                    seen_characters.add(character)
                    characters.append(character)

        if not characters:
            return []

        placeholders = ",".join("?" for _ in characters)
        cursor = self.conn.execute(
            f"""
            SELECT DISTINCT c.char, c.gloss, c.pinyin_text, c.codepoint
            FROM characters AS c
            WHERE c.char IN ({placeholders})
            ORDER BY c.char
            LIMIT ?
            """,
            (*characters, limit),
        )
        return cursor.fetchall()

    def _candidate_pinyin_terms(self, query: str) -> list[str]:
        if any(char.isdigit() for char in query):
            return unique_terms([normalize_pinyin_term(query, keep_digits=True)])

        if contains_tone_marks(query):
            return unique_terms([pinyin_syllable_to_numbered(query)])

        return unique_terms([normalize_pinyin_term(query, keep_digits=False)])

    def _candidate_translation_terms(self, query: str) -> list[str]:
        normalized = normalize_translation_term(query)
        if not normalized:
            return []
        tokens = [token for token in _TRANSLATION_SPLIT_RE.split(normalized) if token]
        terms = [normalized]
        terms.extend(tokens)
        return unique_terms(terms)
