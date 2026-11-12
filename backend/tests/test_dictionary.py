import unittest

from cidian.dictionary import tone_only_pinyin


class DictionaryFormattingTest(unittest.TestCase):
    def test_tone_only_pinyin_filters_tone_less_duplicates(self):
        self.assertEqual(tone_only_pinyin("shì shi"), "shì")
        self.assertEqual(tone_only_pinyin("nǚ nü nǜ"), "nǚ nǜ")
        self.assertEqual(tone_only_pinyin("shi4 shi"), "shi4")
        self.assertEqual(tone_only_pinyin(" shi "), "shi")
