#!/usr/bin/env python3
"""Generate Mihomo classical rule sets from current RIPE announcements.

Adapted from RzMY/Telegram-CIDR-Regions (MIT; see LICENSE-Telegram).
Upstream reference: 41cdbe29d6e471871b71ab3b9c86c78d9bf000b7
The region/ASN mapping is maintained manually, not certified by Telegram.
Run from the repository root: python3 scripts/update_telegram.py
"""

import argparse
import ipaddress
import json
import logging
import os
from pathlib import Path
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen

REGION_ASNS = {'SG': (44907, 62014), 'US': (59930,), 'EU': (62041, 211157)}
API = 'https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS{}'


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def network(value):
    parsed = ipaddress.ip_network(value, strict=True)
    if not parsed.network_address.is_global or not parsed.broadcast_address.is_global:
        raise ValueError('Non-public prefix: ' + value)
    return parsed


def parse_response(payload, asn, now):
    try:
        if payload['status'] != 'ok':
            raise ValueError('RIPE returned a non-ok status')
        data = payload['data']
        if str(data['resource']).removeprefix('AS') != str(asn):
            raise ValueError('RIPE returned the wrong ASN')
        # The API defaults to two weeks of history; use only the latest snapshot.
        snapshot = min(timestamp(data['latest_time']), timestamp(data['query_endtime']))
        if not timedelta(0) <= now - snapshot <= timedelta(hours=48):
            raise ValueError('RIPE snapshot is stale or in the future')
        result = set()
        for item in data['prefixes']:
            prefix = network(item['prefix'])
            timelines = item['timelines']
            if not timelines:
                raise ValueError('Prefix has no announcement timeline')
            if any(timestamp(t['starttime']) <= snapshot <= timestamp(t['endtime']) for t in timelines):
                result.add(str(prefix))
        if not result:
            raise ValueError('ASN has no active prefixes')
        return sorted(result)
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError('Malformed RIPE response for AS' + str(asn)) from exc


def fetch_prefixes(asn):
    for attempt in range(3):
        try:
            request = Request(API.format(asn), headers={'User-Agent': 'my-routing-telegram/1.0'})
            with urlopen(request, timeout=25) as response:
                payload = json.load(response)
            result = parse_response(payload, asn, datetime.now(timezone.utc))
            logging.info('AS%s: %d active prefixes', asn, len(result))
            return result
        except (URLError, OSError, ValueError) as exc:
            if attempt == 2:
                raise RuntimeError('AS{} failed; no rule files were published'.format(asn)) from exc
            logging.warning('AS%s attempt %d failed: %s', asn, attempt + 1, exc)
            time.sleep(2 ** attempt)


def partition(source):
    if set(source) != set(REGION_ASNS) or any(not items for items in source.values()):
        raise ValueError('All three regions must have input prefixes')
    owners = {}
    for region, prefixes in source.items():
        for value in prefixes:
            prefix = network(value)
            if prefix in owners and owners[prefix] != region:
                raise ValueError('Ambiguous region ownership for ' + str(prefix))
            owners[prefix] = region
    # Preserve all more-specific assignments, subtracting them from larger ranges.
    ordered = sorted(owners, key=lambda p: (p.version, -p.prefixlen, int(p.network_address)))
    assigned = []
    for prefix in ordered:
        region = owners[prefix]
        remaining = [prefix]
        for existing, other in assigned:
            if other == region or existing.version != prefix.version:
                continue
            next_remaining = []
            for candidate in remaining:
                if existing.subnet_of(candidate):
                    next_remaining.extend(candidate.address_exclude(existing))
                else:
                    next_remaining.append(candidate)
            remaining = next_remaining
        assigned.extend((candidate, region) for candidate in remaining)
    result = {}
    for region in REGION_ASNS:
        result[region] = []
        for version in (4, 6):
            result[region].extend(ipaddress.collapse_addresses(
                prefix for prefix, owner in assigned if owner == region and prefix.version == version))
        if not result[region]:
            raise ValueError('Empty region after resolving overlaps: ' + region)
    for i, a in enumerate(REGION_ASNS):
        for b in list(REGION_ASNS)[i + 1:]:
            if any(x.overlaps(y) for x in result[a] for y in result[b] if x.version == y.version):
                raise ValueError('Unresolved cross-region overlap')
    return result


def render(region, prefixes):
    lines = [
        '# Telegram ' + region + ' - Mihomo classical rules',
        '# Source: RIPEstat announced-prefixes API (latest available snapshot)',
        '# Region mapping: RzMY/Telegram-CIDR-Regions; maintained by chiqingsong/my-routing',
        '# ASNs: ' + ', '.join('AS' + str(asn) for asn in REGION_ASNS[region]),
        '# Policy is assigned by RULE-SET in the client configuration.',
    ]
    for prefix in prefixes:
        kind = 'IP-CIDR' if prefix.version == 4 else 'IP-CIDR6'
        lines.append('{},{},no-resolve'.format(kind, prefix))
    # No generated timestamp: identical data must produce identical files.
    return '\n'.join(lines) + '\n'


def update(output):
    source = {region: [] for region in REGION_ASNS}
    for region, asns in REGION_ASNS.items():
        for asn in asns:
            prefixes = fetch_prefixes(asn)
            if not prefixes:
                raise ValueError('Empty ASN result: AS' + str(asn))
            source[region].extend(prefixes)
    result = partition(source)
    contents = {region: render(region, prefixes) for region, prefixes in result.items()}
    # Fetch and validate the entire batch before writing any destination file.
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.telegram-', dir=output) as staging:
        changed = []
        for region, content in contents.items():
            target = output / ('Telegram' + region + '.list')
            if target.exists() and target.read_text(encoding='utf-8') == content:
                continue
            temporary = Path(staging) / target.name
            temporary.write_text(content, encoding='utf-8')
            changed.append((temporary, target))
        for temporary, target in changed:
            os.replace(temporary, target)
    # The workflow publishes all three files in one commit, only after success.
    logging.info('Validated SG=%d US=%d EU=%d; %d files changed',
                 len(result['SG']), len(result['US']), len(result['EU']), len(changed))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'rules')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    update(args.output_dir)
