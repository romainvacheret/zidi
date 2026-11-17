"""Compare bundled dictionary metadata with the official 2025 HSK syllabus.

Usage: pdftotext -raw syllabus.pdf /tmp/hsk.txt
       python3 scripts/audit_hsk.py /tmp/hsk.txt /tmp/hsk-audit

The input must be the November 2025 syllabus linked by chinesetest.cn/syllabus.
Only homograph number suffixes are removed; alternative spellings aren't guessed.
"""

import collections
import csv
import json
from pathlib import Path
import re
import sys


def main():
    text = Path(sys.argv[1]).read_text()
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    rows = re.findall(r"^(\d+)\s+([1-6]|7-9)(?:（[^\n]*?）)?\s+(\S+)", text, re.M)
    assert len(rows) == 11000
    assert [int(row[0]) for row in rows] == list(range(1, 11001))
    words = {}
    for _, level, word in rows:
        word = re.sub(r"\d+$", "", word)
        words.setdefault(word, int(level) if level != "7-9" else 7)

    characters = {}
    level = None
    levels = dict(zip("一二三四五六", range(1, 7))) | {"七—九": 7}
    for line in text.splitlines():
        if "书写字" in line and "HSK" in line:
            level = None
        heading = re.search(r"HSK（([一二三四五六]|七—九)级）认读字$", line)
        if heading:
            level = levels[heading[1]]
        char = re.match(r"^\d+\.\s*([\u3400-\u9fff])\s*$", line)
        if level and char:
            characters.setdefault(char[1], level)
    assert collections.Counter(characters.values()) == {
        1: 246, 2: 125, 3: 284, 4: 441, 5: 431, 6: 413, 7: 1148,
    }

    root = Path(__file__).resolve().parents[1]
    summary = {"official_vocabulary_rows": dict(collections.Counter(r[1] for r in rows))}
    for kind, key, official in [("char", "char", characters), ("word", "simp", words)]:
        records = [json.loads(line) for line in
                   (root / f"backend/resources/dictionary_{kind}_2025-12-27.jsonl").open()]
        local = {record[key]: record.get("statistics", {}).get("hskLevel")
                 for record in records if key in record}
        results = []
        for expression in sorted(local.keys() | official.keys()):
            actual, expected = local.get(expression), official.get(expression)
            if expected is not None:
                status = ("missing_record" if expression not in local else
                          "missing_level" if actual is None else
                          "match" if actual == expected else "wrong_level")
            elif actual is not None:
                status = "not_in_official_list"
            else:
                continue
            results.append((expression, actual, expected, status))
        with (output / f"{kind}.csv").open("w") as file:
            writer = csv.writer(file)
            writer.writerow(["expression", "dictionary_level", "official_level", "status"])
            writer.writerows(results)
        summary[kind] = {
            "records": len(records),
            "dictionary_level_counts": dict(collections.Counter(
                record.get("statistics", {}).get("hskLevel") for record in records)),
            "official_unique_expressions": len(official),
            "official_level_counts": dict(collections.Counter(official.values())),
            "comparison": dict(collections.Counter(row[3] for row in results)),
        }
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
