"""Bounded graph vocabulary from dictionary records and their internal HSK tags."""
import json
from collections import Counter
from contextlib import closing
from pathlib import Path
import sqlite3
import unicodedata

from .dictionary import word_details_data


def allowed_characters(connection, entries, levels, target=''):
    candidates = set(target)
    for entry in entries:
        candidates.update(entry['text'])
    if not candidates or not levels:
        return []
    placeholders = ','.join('?' for _ in candidates)
    level_marks = ','.join('?' for _ in levels)
    return [row[0] for row in connection.execute(
        f"SELECT char FROM characters WHERE char IN ({placeholders}) "
        f"AND json_extract(source_json, '$.statistics.hskLevel') IN ({level_marks})",
        [*candidates, *levels])]


def graph_vocabulary(database: Path, level: int | list[int], limit: int, character: str | None = None,
                     exclude: list[str] | None = None, preserve: list[str] | None = None) -> dict:
    levels = [level] if isinstance(level, int) else level
    if not levels:
        return {'entries': [], 'has_more': False, 'allowed_characters': []}
    excluded = set(exclude or [])
    nodes = set(excluded)
    entries = []
    counts = Counter()
    retained = list(dict.fromkeys(preserve or []))
    retained_set = set(retained)
    priority = f"(simp IN ({','.join('?' for _ in retained)})) DESC, " if retained else ''
    has_more = False
    with closing(sqlite3.connect(database)) as connection:
        rows = connection.execute(
            "SELECT simp, source_json, json_extract(source_json, '$.statistics.hskLevel') FROM words "
            f"WHERE json_extract(source_json, '$.statistics.hskLevel') IN ({','.join('?' for _ in levels)}) "
            "AND (? IS NULL OR instr(simp, ?) > 0) "
            f"ORDER BY {priority}usage_rank IS NULL, usage_rank, simp, id",
            (*levels, character, character, *retained),
        )
        for expression, source, entry_level in rows:
            if expression in excluded or not expression.strip():
                continue
            characters = {c for c in expression if unicodedata.name(c, '').startswith(
                ('CJK UNIFIED IDEOGRAPH', 'CJK COMPATIBILITY IDEOGRAPH')) or c == '〇'}
            if not characters:
                continue
            if counts[entry_level] >= limit and expression not in retained_set:
                has_more = True
                continue
            added = {expression} | characters
            if len(nodes | added) > 500:
                has_more = True
                continue
            detail = word_details_data(json.loads(source))
            entries.append({'text': expression, 'pronunciation': detail['pinyin'],
                            'description': detail['gloss'] or ''})
            counts[entry_level] += 1
            excluded.add(expression)
            nodes.update(added)
        allowed = allowed_characters(connection, entries, levels)
    return {'entries': entries, 'has_more': has_more, 'allowed_characters': allowed}


def graph_neighborhood(database: Path, target: str, limit: int, levels: list[int] | None = None, preserve: list[str] | None = None) -> dict:
    """A character's incident words, or words sharing a constituent with a word.

    Shared-character count and usage rank break ties within the same relation
    distance. The response identifies which constituent characters pass the
    selected levels so the client can remove other nodes and their links.
    """
    characters = list(dict.fromkeys(c for c in target if unicodedata.name(c, '').startswith(
        ('CJK UNIFIED IDEOGRAPH', 'CJK COMPATIBILITY IDEOGRAPH')) or c == '〇'))
    entries = []
    nodes = {target, *characters}
    seen = {target}
    counts = Counter()
    retained = list(dict.fromkeys(preserve or []))
    retained_set = set(retained)
    priority = f"(simp IN ({','.join('?' for _ in retained)})) DESC, " if retained else ''
    has_more = False
    with closing(sqlite3.connect(database)) as connection:
        seed = connection.execute('SELECT source_json FROM words WHERE simp = ? ORDER BY id LIMIT 1',
                                  (target,)).fetchone()
        if seed and seed[0] and (levels is None or json.loads(seed[0]).get('statistics', {}).get('hskLevel') in levels):
            detail = word_details_data(json.loads(seed[0]))
            entries.append({'text': target, 'pronunciation': detail['pinyin'],
                            'description': detail['gloss'] or ''})
        if characters and levels != []:
            overlap = ' + '.join('(instr(simp, ?) > 0)' for _ in characters)
            level_filter = '' if levels is None else f"AND json_extract(source_json, '$.statistics.hskLevel') IN ({','.join('?' for _ in levels)}) "
            rows = connection.execute(
                f"SELECT simp, source_json, json_extract(source_json, '$.statistics.hskLevel') FROM words WHERE ({overlap}) > 0 " + level_filter +
                f'ORDER BY {priority}({overlap}) DESC, usage_rank IS NULL, usage_rank, simp, id',
                characters + ([] if levels is None else levels) + retained + characters)
            for expression, source, entry_level in rows:
                if expression in seen or not source:
                    continue
                bucket = entry_level if levels is not None else None
                if counts[bucket] >= limit and expression not in retained_set:
                    has_more = True
                    continue
                constituents = {c for c in expression if unicodedata.name(c, '').startswith(
                    ('CJK UNIFIED IDEOGRAPH', 'CJK COMPATIBILITY IDEOGRAPH')) or c == '〇'}
                if len(nodes | {expression} | constituents) > 500:
                    has_more = True
                    continue
                detail = word_details_data(json.loads(source))
                entries.append({'text': expression, 'pronunciation': detail['pinyin'],
                                'description': detail['gloss'] or ''})
                nodes.update({expression} | constituents)
                seen.add(expression)
                counts[bucket] += 1
        allowed = allowed_characters(connection, entries, levels, target) if levels is not None else None
    return {'entries': entries, 'has_more': has_more, 'allowed_characters': allowed}
