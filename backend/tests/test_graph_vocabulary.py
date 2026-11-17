import json
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest

from cidian.vocabulary import graph_vocabulary


class GraphVocabularyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.database = Path(self.temporary.name) / 'graph.sqlite3'
        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute('CREATE TABLE words (id INTEGER PRIMARY KEY, simp TEXT, source_json TEXT, usage_rank INTEGER)')
            connection.execute('CREATE TABLE characters (char TEXT, source_json TEXT)')
            for character, level in [('爱', 1), ('好', 2), ('人', 1), ('心', 2)]:
                connection.execute('INSERT INTO characters VALUES (?, ?)',
                                   (character, json.dumps({'statistics': {'hskLevel': level}})))
            records = [('爱好', 1, 2), ('爱', 1, 1), ('爱人', 1, None), ('爱心', 2, 3),
                       ('好', 0, 4), ('喜欢', 10, 5)]
            for expression, level, rank in records:
                connection.execute('INSERT INTO words(simp, source_json, usage_rank) VALUES (?, ?, ?)',
                                   (expression, json.dumps({'simp': expression, 'gloss': expression,
                                    'statistics': {'hskLevel': level}}), rank))

    def test_filters_exact_internal_level_and_orders_by_frequency(self):
        result = graph_vocabulary(self.database, 1, 2)
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱', '爱好'])
        self.assertTrue(result['has_more'])
        self.assertEqual([entry['text'] for entry in graph_vocabulary(self.database, 2, 200)['entries']], ['爱心'])

    def test_expansion_excludes_loaded_nodes(self):
        result = graph_vocabulary(self.database, 1, 20, '爱', ['爱', '爱好', '好'])
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱人'])
        self.assertFalse(result['has_more'])
        self.assertEqual(graph_vocabulary(self.database, 1, 20, '无')['entries'], [])

    def test_node_budget_counts_constituents_and_existing_nodes(self):
        existing = [f'node{i}' for i in range(498)]
        result = graph_vocabulary(self.database, 1, 20, exclude=existing)
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱'])
        self.assertTrue(result['has_more'])

    def test_character_neighborhood_includes_other_levels_without_unrelated_words(self):
        from cidian.vocabulary import graph_neighborhood
        result = graph_neighborhood(self.database, '爱', 20)
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱', '爱好', '爱心', '爱人'])
        self.assertFalse(result['has_more'])

    def test_word_neighborhood_keeps_seed_and_prioritizes_shared_characters(self):
        from cidian.vocabulary import graph_neighborhood
        result = graph_neighborhood(self.database, '爱心', 2)
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱心', '爱', '爱好'])
        self.assertTrue(result['has_more'])
        self.assertNotIn('喜欢', [entry['text'] for entry in result['entries']])

    def test_isolated_neighborhood_has_no_unrelated_entries(self):
        from cidian.vocabulary import graph_neighborhood
        self.assertEqual(graph_neighborhood(self.database, '𠮷', 20)['entries'], [])

    def test_neighborhood_prioritizes_more_shared_constituents(self):
        from cidian.vocabulary import graph_neighborhood
        with closing(sqlite3.connect(self.database)) as connection, connection:
            record = {'simp': '爱心人', 'gloss': 'example'}
            connection.execute('INSERT INTO words(simp, source_json, usage_rank) VALUES (?, ?, ?)',
                               ('爱心人', json.dumps(record), 9999))
        result = graph_neighborhood(self.database, '爱心', 1)
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱心', '爱心人'])

    def test_neighborhood_node_budget_includes_all_constituents(self):
        from cidian.vocabulary import graph_neighborhood
        with closing(sqlite3.connect(self.database)) as connection, connection:
            for index in range(300):
                expression = '爱' + chr(0x5000 + index)
                connection.execute('INSERT INTO words(simp, source_json, usage_rank) VALUES (?, ?, ?)',
                                   (expression, json.dumps({'simp': expression}), index + 100))
        result = graph_neighborhood(self.database, '爱', 300)
        nodes = {'爱'}
        for entry in result['entries']:
            nodes.add(entry['text'])
            nodes.update(entry['text'])
        self.assertLessEqual(len(nodes), 500)
        self.assertGreater(len(result['entries']), 100)
        self.assertTrue(result['has_more'])


    def test_multiple_levels_and_empty_selection(self):
        result = graph_vocabulary(self.database, [1, 2], 20)
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱', '爱好', '爱心', '爱人'])
        self.assertEqual(set(result['allowed_characters']), {'爱', '好', '心', '人'})
        self.assertEqual(graph_vocabulary(self.database, [], 20)['entries'], [])
        self.assertNotIn('好', graph_vocabulary(self.database, [1], 20)['allowed_characters'])

    def test_neighborhood_filters_seed_neighbors_and_characters(self):
        from cidian.vocabulary import graph_neighborhood
        result = graph_neighborhood(self.database, '爱心', 20, [1])
        self.assertEqual([entry['text'] for entry in result['entries']], ['爱', '爱好', '爱人'])
        self.assertEqual(set(result['allowed_characters']), {'爱', '人'})
        result = graph_neighborhood(self.database, '爱心', 20, [1, 2])
        self.assertIn('爱心', [entry['text'] for entry in result['entries']])
        self.assertIn('心', result['allowed_characters'])
        self.assertEqual(graph_neighborhood(self.database, '爱心', 20, [])['entries'], [])
