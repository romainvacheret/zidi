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
