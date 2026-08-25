from __future__ import annotations

import unittest

from cidian.gui import CharacterCardData, cards_from_search_results, tone_only_pinyin


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


if __name__ == "__main__":
    unittest.main()
