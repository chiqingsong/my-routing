import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import update_rules


class UpdateRulesTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.output = Path(directory.name)
        self.first = self.output / 'First.list'
        self.second = self.output / 'Second.list'
        self.first.write_text(
            '# First list\n'
            '# Keep: DOMAIN-SUFFIX,local.example\n'
            '# Rule sources: old-source\n'
            'DOMAIN-SUFFIX,removed.example\n'
            'DOMAIN-SUFFIX,shared.example\n'
            'DOMAIN-SUFFIX,local.example\n'
        )
        self.second.write_text('# Second list\nDOMAIN-SUFFIX,unchanged.example\n')
        self.config = {
            self.first.name: (
                ('one', 'https://example.com/one', 'classical'),
                ('two', 'https://example.com/two', 'dlc'),
            ),
            self.second.name: (('three', 'https://example.com/three', 'classical'),),
        }
        self.upstreams = {
            'https://example.com/one': '# Comments\nDOMAIN-SUFFIX, new.example\nIP-CIDR,192.0.2.0/24,no-resolve\n',
            'https://example.com/two': 'shared.example\nnew.example # duplicate\nfull:example.com\n',
            'https://example.com/three': ' DOMAIN-SUFFIX, unchanged.example\n',
        }

    def update(self, *, write=True):
        with patch.object(update_rules, 'RULE_LISTS', self.config), patch.object(
            update_rules, 'download', side_effect=self.upstreams.__getitem__
        ):
            return update_rules.update(self.output, write=write)

    def test_merge_keeps_pins_reports_sources_and_leaves_unchanged_file(self):
        original_second = self.second.read_bytes()
        report = self.update()
        self.assertIn('+ `DOMAIN-SUFFIX,new.example` — one, two', report)
        self.assertIn('- `DOMAIN-SUFFIX,removed.example` — previously from old-source', report)
        written = self.first.read_text()
        self.assertEqual(1, written.count('DOMAIN-SUFFIX,new.example'))
        self.assertIn('DOMAIN-SUFFIX,shared.example', written)
        self.assertIn('DOMAIN-SUFFIX,local.example', written)
        self.assertIn('DOMAIN,example.com', written)
        self.assertIn('IP-CIDR,192.0.2.0/24,no-resolve', written)
        self.assertNotIn('removed.example', written)
        self.assertEqual(original_second, self.second.read_bytes())
        self.assertIn('No rule changes.', self.update())
        self.assertEqual(written, self.first.read_text())

    def test_default_preview_never_writes(self):
        original_first = self.first.read_bytes()
        self.assertIn('new.example', self.update(write=False))
        self.assertEqual(original_first, self.first.read_bytes())

    def test_empty_or_invalid_source_preserves_both_files(self):
        original_first = self.first.read_bytes()
        original_second = self.second.read_bytes()
        for invalid in ('# nothing\n', '<html>error</html>', 'MATCH,PROXY\n', 'DOMAIN-SUFFIX,test.example,DIRECT\n'):
            with self.subTest(invalid=invalid):
                self.upstreams['https://example.com/three'] = invalid
                with self.assertRaisesRegex(ValueError, 'three'):
                    self.update()
                self.assertEqual(original_first, self.first.read_bytes())
                self.assertEqual(original_second, self.second.read_bytes())

    def test_unsupported_dlc_include_fails_instead_of_dropping_matches(self):
        self.upstreams['https://example.com/two'] = 'include:another-file\n'
        with self.assertRaisesRegex(ValueError, 'two'):
            self.update()
