#!/usr/bin/env python3
"""Preview or stage upstream updates to the X / Grok / Cursor and Siri lists."""

import argparse
import ipaddress
import re
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen

RAW = 'https://raw.githubusercontent.com/'
RULE_LISTS = {
    'X&Grok&Cursor.list': (
        ('blackmatrix7/Twitter', RAW + 'blackmatrix7/ios_rule_script/master/rule/Loon/Twitter/Twitter.list', 'classical'),
        ('v2fly/Cursor', RAW + 'v2fly/domain-list-community/master/data/cursor', 'dlc'),
        ('v2fly/xAI', RAW + 'v2fly/domain-list-community/master/data/xai', 'dlc'),
    ),
    'Siri.list': (
        ('ddgksf2013/AppleIntelligence', RAW + 'ddgksf2013/Filter/master/AppleIntelligence.list', 'classical'),
        ('RocM301/Apple-AI', RAW + 'RocM301/Apple-Rule/main/Apple-AI.list', 'classical'),
    ),
}

KEEP = '# Keep: '
SOURCES = '# Rule sources: '
DOMAIN_LABEL = re.compile(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?')
KEYWORD = re.compile(r'[a-z0-9._-]+')
DLC_TYPES = {'domain': 'DOMAIN-SUFFIX', 'full': 'DOMAIN', 'keyword': 'DOMAIN-KEYWORD'}


def classical_rule(line):
    parts = [part.strip() for part in line.split(',')]
    if len(parts) < 2:
        raise ValueError(f'Invalid rule: {line!r}')
    kind, value, *options = parts
    kind = kind.upper()
    if kind in {'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD'} and not options:
        value = value.lower()
        if kind == 'DOMAIN-KEYWORD':
            valid = KEYWORD.fullmatch(value)
        else:
            value = value.removesuffix('.')
            valid = '.' in value and len(value) <= 253 and all(
                DOMAIN_LABEL.fullmatch(label) for label in value.split('.')
            )
        if valid:
            return f'{kind},{value}'
    if kind in {'IP-CIDR', 'IP-CIDR6', 'IP6-CIDR'} and options in ([], ['no-resolve']):
        prefix = ipaddress.ip_network(value, strict=True)
        if '/' in value and (kind == 'IP-CIDR') == (prefix.version == 4):
            canonical_kind = 'IP-CIDR' if prefix.version == 4 else 'IP-CIDR6'
            return ','.join([canonical_kind, str(prefix), *options])
    raise ValueError(f'Unsupported or invalid rule: {line!r}')


def parse_upstream(body, syntax):
    rules = set()
    for source_line in body.splitlines():
        line = source_line.split('#', 1)[0].strip()
        if not line:
            continue
        if syntax == 'dlc':
            prefix, separator, value = line.partition(':')
            if not separator:
                prefix, value = 'domain', prefix
            if prefix not in DLC_TYPES:
                raise ValueError(f'Unsupported domain-list entry: {line!r}')
            line = f'{DLC_TYPES[prefix]},{value}'
        rules.add(classical_rule(line))
    if not rules:
        raise ValueError('No rules in source')
    return rules


def download(url):
    request = Request(url, headers={'User-Agent': 'my-routing-rule-sync/1.0'})
    with urlopen(request, timeout=20) as response:
        data = response.read(256 * 1024 + 1)
    if len(data) > 256 * 1024:
        raise ValueError('Rule list exceeded 256 KiB')
    return data.decode('utf-8-sig')


def read_local(path):
    header, pins, rules = [], set(), {}
    sources = ()
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if line.startswith(KEEP):
            pins.add(classical_rule(line[len(KEEP):]))
        elif line.startswith(SOURCES):
            sources = tuple(line[len(SOURCES):].split(', '))
        elif line.strip() and not line.lstrip().startswith('#'):
            rules[classical_rule(line)] = sources
        elif not rules:
            header.append(line)
    return header, pins, rules


def render(header, pins, order, rule_sources):
    lines = header + [KEEP + rule for rule in sorted(pins)]
    last_sources = None
    for rule in order:
        sources = rule_sources[rule]
        if sources != last_sources:
            lines.append(SOURCES + ', '.join(sorted(sources)))
            last_sources = sources
        lines.append(rule)
    return '\n'.join(lines) + '\n'


def update(output_dir, *, write=False):
    changes = {}
    sections = []
    for filename, upstreams in RULE_LISTS.items():
        path = output_dir / filename
        header, pins, old_rules = read_local(path)
        rule_sources = {rule: {'manual'} for rule in pins}
        for source, url, syntax in upstreams:
            try:
                source_rules = parse_upstream(download(url), syntax)
            except (OSError, ValueError) as error:
                raise ValueError(f'{source}: {error}') from error
            for rule in source_rules:
                rule_sources.setdefault(rule, set()).add(source)
        added = sorted(rule_sources.keys() - old_rules.keys())
        removed = sorted(old_rules.keys() - rule_sources.keys())
        if not (added or removed):
            continue
        order = [rule for rule in old_rules if rule in rule_sources] + added
        changes[path] = render(header, pins, order, rule_sources)
        sections.append(f'### {filename}')
        if added:
            sections += ['\nAdded'] + [
                f'+ `{rule}` — {", ".join(sorted(rule_sources[rule]))}' for rule in added
            ]
        if removed:
            sections += ['\nRemoved (absent from all current sources)']
            for rule in removed:
                previous = ', '.join(old_rules[rule]) or 'the previous merged list; source unrecorded'
                sections.append(f'- `{rule}` — previously from {previous}')
        sections.append('')

    if write and changes:
        # Finish fetching and validating both lists before replacing any file.
        with TemporaryDirectory(dir=output_dir) as staging:
            staging = Path(staging)
            for path, content in changes.items():
                (staging / path.name).write_text(content, encoding='utf-8')
            for path in changes:
                (staging / path.name).replace(path)
    return '\n'.join(sections).rstrip() + '\n' if sections else 'No rule changes.\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'rules')
    parser.add_argument('--write', action='store_true', help='Write the reviewed candidate lists; default to preview')
    parser.add_argument('--report', type=Path, help='Also save the change summary as Markdown')
    args = parser.parse_args()
    try:
        report = update(args.output_dir, write=args.write)
        if args.report:
            args.report.write_text(report, encoding='utf-8')
    except (OSError, ValueError) as error:
        parser.exit(1, f'Rule update failed: {error}\n')
    print(report, end='')


if __name__ == '__main__':
    main()
