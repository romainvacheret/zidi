"""Bounded graph vocabulary from dictionary records and their internal HSK tags."""
import json
from contextlib import closing
from pathlib import Path
import sqlite3
import unicodedata

from .dictionary import word_details_data


def graph_vocabulary(database: Path, level: int, limit: int, character: str | None = None,
                     exclude: list[str] | None = None) -> dict:
    excluded = set(exclude or [])
    nodes = set(excluded)
    entries = []
    has_more = False
    with closing(sqlite3.connect(database)) as connection:
        rows = connection.execute(
            "SELECT simp, source_json FROM words "
            "WHERE json_extract(source_json, '$.statistics.hskLevel') = ? "
            "AND (? IS NULL OR instr(simp, ?) > 0) "
            "ORDER BY usage_rank IS NULL, usage_rank, simp, id",
            (level, character, character),
        )
        for expression, source in rows:
            if expression in excluded or not expression.strip():
                continue
            characters = {c for c in expression if unicodedata.name(c, '').startswith(
                ('CJK UNIFIED IDEOGRAPH', 'CJK COMPATIBILITY IDEOGRAPH')) or c == '〇'}
            if not characters:
                continue
            if len(entries) >= limit:
                has_more = True
                break
            added = {expression} | characters
            if len(nodes | added) > 500:
                has_more = True
                continue
            detail = word_details_data(json.loads(source))
            entries.append({'text': expression, 'pronunciation': detail['pinyin'],
                            'description': detail['gloss'] or ''})
            excluded.add(expression)
            nodes.update(added)
    return {'entries': entries, 'has_more': has_more}
