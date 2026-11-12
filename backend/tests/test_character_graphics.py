import unittest

from cidian.character_graphics import character_strokes


class CharacterGraphicsTest(unittest.TestCase):
    def record(self, fragments=None):
        return {"components": [{"character": "讠"}, {"character": "射"}], "images": [{
            "source": "makemeahanzi", "type": "Regular", "fragments": fragments,
            "data": {"strokes": ["M 0 0 L 10 10 Z", "M 20 0 L 30 10 Z", "M 40 0 L 50 10 Z"],
                     "medians": [[[0, 0], [10, 10]], [[20, 0], [30, 10]], [[40, 0], [50, 10]]]},
        }]}

    def test_preserves_stroke_order_and_component_mapping(self):
        record = self.record([[0], [1, 2]])
        result = character_strokes(record)
        self.assertEqual(result["strokes"], record["images"][0]["data"]["strokes"])
        self.assertEqual(result["medians"], record["images"][0]["data"]["medians"])
        self.assertEqual(result["component_indices"], [0, 1, 1])

    def test_keeps_ambiguous_or_invalid_fragment_mappings_neutral(self):
        for groups in [None, [[0, 1, 2]], [[0, 1], [1, 2]], [[0], [3]], [[-1], [1]], [[True], [1]]]:
            with self.subTest(groups=groups):
                self.assertEqual(character_strokes(self.record(groups))["component_indices"], [None] * 3)
        self.assertEqual(character_strokes(self.record([[0], [2]]))["component_indices"], [0, None, 1])

    def test_handles_missing_and_incomplete_graphics(self):
        self.assertIsNone(character_strokes({"images": None}))
        self.assertIsNone(character_strokes({"images": [{"url": "https://example.com/old-script.png"}]}))
        record = self.record([[0], [1, 2]])
        record["images"][0]["data"]["medians"].pop()
        self.assertIsNone(character_strokes(record))
        record = self.record()
        record["images"][0]["data"]["medians"][0][0][0] = float("nan")
        self.assertIsNone(character_strokes(record))
