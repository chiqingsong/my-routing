import copy
import ipaddress
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from scripts import update_telegram as tg

NOW = datetime(2026, 11, 4, 12, tzinfo=timezone.utc)


def response(asn=44907):
    return {'status': 'ok', 'data': {
        'resource': str(asn), 'latest_time': '2026-11-04T00:00:00',
        'query_endtime': '2026-11-04T00:00:00',
        'prefixes': [{'prefix': '91.108.16.0/22', 'timelines': [
            {'starttime': '2026-10-21T00:00:00', 'endtime': '2026-11-04T00:00:00'}]}]}}


class TelegramTests(unittest.TestCase):
    def test_more_specific_region_wins_without_losing_addresses(self):
        result = tg.partition({'SG': ['91.108.56.0/23'], 'EU': ['91.108.56.0/22'], 'US': ['91.108.12.0/22']})
        self.assertEqual(result['SG'], [ipaddress.ip_network('91.108.56.0/23')])
        self.assertEqual(result['EU'], [ipaddress.ip_network('91.108.58.0/23')])

    def test_same_prefix_in_two_regions_is_rejected(self):
        with self.assertRaises(ValueError):
            tg.partition({'SG': ['91.108.56.0/23'], 'EU': ['91.108.56.0/23'], 'US': ['91.108.12.0/22']})

    def test_nested_regions_and_ipv6_are_disjoint(self):
        source = {'SG': ['91.108.56.0/23', '2001:b28:f23c::/48'],
                  'US': ['91.108.56.0/24', '2001:b28:f23c::/49'],
                  'EU': ['91.108.56.0/22', '2001:67c:4e8::/48']}
        result = tg.partition(source)
        self.assertEqual(result['SG'][0], ipaddress.ip_network('91.108.57.0/24'))
        self.assertEqual(sum(n.num_addresses for nets in result.values() for n in nets if n.version == 4), 1024)
        for a in result:
            for b in result:
                if a != b:
                    self.assertFalse(any(x.overlaps(y) for x in result[a] for y in result[b] if x.version == y.version))

    def test_rejects_bad_or_empty_response(self):
        cases = []
        for field, value in [('resource', '59930'), ('prefixes', []), ('latest_time', '2025-01-01T00:00:00')]:
            obj = response(); obj['data'][field] = value; cases.append(obj)
        obj = response(); obj['status'] = 'error'; cases.append(obj)
        obj = response(); obj['data']['prefixes'][0]['prefix'] = 'not-a-cidr'; cases.append(obj)
        for obj in cases:
            with self.subTest(obj=obj), self.assertRaises(ValueError):
                tg.parse_response(obj, 44907, NOW)

    def test_filters_withdrawn_prefixes_from_two_week_history(self):
        obj = response()
        withdrawn = copy.deepcopy(obj['data']['prefixes'][0])
        withdrawn['prefix'] = '91.108.20.0/22'
        withdrawn['timelines'][0]['endtime'] = '2026-11-02T00:00:00'
        obj['data']['prefixes'].append(withdrawn)
        self.assertEqual(tg.parse_response(obj, 44907, NOW), ['91.108.16.0/22'])

    def test_fetch_failure_preserves_all_existing_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for region in ('SG', 'US', 'EU'):
                (root / ('Telegram' + region + '.list')).write_text('old-' + region)
            before = {p.name: p.read_bytes() for p in root.iterdir()}
            with patch.object(tg, 'fetch_prefixes', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError):
                    tg.update(root)
            self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()})

    def test_complete_output_is_stable_and_policy_free(self):
        data = {44907: ['91.108.16.0/22'], 62014: ['2001:b28:f23c::/48'],
                59930: ['91.108.12.0/22'], 62041: ['91.108.4.0/22'], 211157: ['2001:67c:4e8::/48']}
        with tempfile.TemporaryDirectory() as folder, patch.object(tg, 'fetch_prefixes', side_effect=lambda asn: data[asn]):
            root = Path(folder)
            tg.update(root)
            first = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in root.iterdir()}
            self.assertEqual(len(first), 3)
            tg.update(root)
            self.assertEqual(first, {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in root.iterdir()})
            sg = (root / 'TelegramSG.list').read_text()
            self.assertIn('IP-CIDR6,2001:b28:f23c::/48,no-resolve', sg)
            for body, _ in first.values():
                for line in body.decode().splitlines():
                    if not line.startswith('#'):
                        kind, cidr, option = line.split(',')
                        self.assertIn(kind, ('IP-CIDR', 'IP-CIDR6'))
                        self.assertEqual(option, 'no-resolve')
                        ipaddress.ip_network(cidr)


if __name__ == '__main__':
    unittest.main()
