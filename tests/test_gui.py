from __future__ import annotations

import unittest

from cidian.gui import (
    CharacterCardData,
    SEARCH_MODE_CHARACTER,
    SEARCH_MODE_TRANSLATION,
    cards_from_query,
    cards_from_search_results,
    tone_only_pinyin,
)


class GuiHelpersTest(unittest.TestCase):
    def test_tone_only_pinyin_filters_tone_less_duplicates(self) -> None:
        self.assertEqual(tone_only_pinyin("shì shi"), "shì")
        self.assertEqual(tone_only_pinyin("nǚ nü nǜ"), "nǚ nǜ")

    def test_cards_from_search_results_keeps_character_and_tone_pinyin(self) -> None:
        rows = [
            ("世", None, "shì shi", "U+4E16"),
            ("律", None, "lǜ lv", "U+5F8B"),
        ]

        self.assertEqual(
            cards_from_search_results(rows),
            [
                CharacterCardData(character="世", pinyin="shì"),
                CharacterCardData(character="律", pinyin="lǜ"),
            ],
        )

    def test_cards_from_query_dispatches_to_translation_search(self) -> None:
        class FakeRepository:
            def __init__(self) -> None:
                self.calls: list[tuple[str, str]] = []

            def search_characters(self, query: str):
                self.calls.append(("character", query))
                return [("世", None, "shì", "U+4E16")]

            def search_characters_by_translation(self, query: str):
                self.calls.append(("translation", query))
                return [("律", None, "lǜ", "U+5F8B")]

        repository = FakeRepository()

        character_cards = cards_from_query(repository, "shi", SEARCH_MODE_CHARACTER)
        translation_cards = cards_from_query(repository, "law", SEARCH_MODE_TRANSLATION)

        self.assertEqual(character_cards, [CharacterCardData(character="世", pinyin="shì")])
        self.assertEqual(translation_cards, [CharacterCardData(character="律", pinyin="lǜ")])
        self.assertEqual(
            repository.calls,
            [("character", "shi"), ("translation", "law")],
        )


if __name__ == "__main__":
    unittest.main()
