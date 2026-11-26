// FlClash 会把原始订阅配置传入 main，脚本修改后再返回。
const main = (config) => {
  // 每一项把一个远程规则列表绑定到一个可手动选择节点的策略组。
  // id 是规则集标识，尽量保持不变；file 是仓库 rules 目录下的文件路径。
  const usRegion = '🇺🇸 美国';
  const usSelector = usRegion + '节点';
  const originalGroups = config['proxy-groups'] || [];
  const paoluz = originalGroups.find(group => /(?:^|\s)PAOLUZ$/i.test(group.name))?.name;
  const originalYouTube = originalGroups.find(group => group.name === 'YouTube');
  const youtubeRules = 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/YouTube/YouTube.list';
  const routes = [
    { name: 'X / Grok / Cursor', id: 'my-routing', file: 'X&Grok&Cursor.list', preferred: usSelector },
    { name: 'YouTube', id: 'my-routing-youtube', url: youtubeRules, preferred: originalYouTube ? undefined : paoluz, existing: originalYouTube },
    { name: 'Siri', id: 'my-routing-siri', file: 'Siri.list', preferred: usSelector },
    { name: 'Telegram SG', id: 'telegram-sg', file: 'TelegramSG.list', preferred: '🇸🇬 新加坡节点' },
    { name: 'Telegram US', id: 'telegram-us', file: 'TelegramUS.list', preferred: usSelector },
    { name: 'Telegram EU', id: 'telegram-eu', file: 'TelegramEU.list', preferred: '🇩🇪 德国节点' },
    { name: 'Non-US Brokers', id: 'non-us-brokers', file: 'Non-US-Brokers.list', preferred: 'DIRECT' }
  ];
  const base = 'https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/';
  const names = routes.map(route => route.name);

  // 保留机场原有策略组，只替换本脚本管理的同名组，避免重复添加。
  const groups = originalGroups.filter(group => !names.includes(group.name));

  // Custom service selectors can pick a region, a node, or DIRECT.
  const choices = [...new Set([
    ...(config.proxies || []).map(proxy => proxy.name),
    'DIRECT' // 直连选项；如果订阅没有提供节点，则只剩此选项。
  ])];
  // Region groups contain matching nodes only; each group is manually selectable.
  const regions = [
    ['🇭🇰 香港', /香港|Hong[ -]?Kong|\bHK\b|🇭🇰/i],
    ['🇹🇼 台湾', /台湾|台灣|Taiwan|\bTW\b|🇹🇼/i],
    ['🇯🇵 日本', /日本|Japan|\bJP\b|🇯🇵/i],
    ['🇰🇷 韩国', /韩国|韓國|Korea|\bKR\b|🇰🇷/i],
    ['🇸🇬 新加坡', /新加坡|Singapore|\bSG\b|🇸🇬/i],
    [usRegion, /美国|美國|United States|USA|\bUS\b|🇺🇸/i],
    ['🇲🇾 马来西亚', /马来西亚|馬來西亞|Malaysia|\bMY\b|🇲🇾/i],
    ['🇩🇪 德国', /德国|德國|Germany|\bDE\b|🇩🇪/i],
    ['🇳🇱 荷兰', /荷兰|荷蘭|Netherlands|\bNL\b|🇳🇱/i],
    ['🇬🇧 英国', /英国|英國|United Kingdom|Britain|\b(?:UK|GB)\b|🇬🇧/i]
  ];
  const regionNames = regions.map(([name]) => name + '节点');
  const displayOrder = [usRegion, '🇯🇵 日本', '🇸🇬 新加坡', '🇹🇼 台湾', '🇭🇰 香港'];
  const displayRegions = [
    ...displayOrder.map(name => regions.find(region => region[0] === name)),
    ...regions.filter(([name]) => !displayOrder.includes(name))
  ];
  const displayRegionNames = displayRegions.map(([name]) => name + '节点');
  const nodeRanks = new Map();
  for (const proxy of config.proxies || []) {
    const rank = displayRegions.findIndex(([, pattern]) => pattern.test(proxy.name));
    if (rank !== -1) nodeRanks.set(proxy.name, rank);
  }

  const usStandardAuto = usRegion + '普通测速';
  const usMultiplierAuto = usRegion + '倍率测速';
  const legacyRegionNames = regionNames.map(name => name.slice(name.indexOf(' ') + 1));
  const autoNames = regions.map(([name]) => name + '自动');
  const managedRegionNames = new Set([
    ...regionNames, ...legacyRegionNames, ...autoNames, usStandardAuto, usMultiplierAuto
  ]);
  const healthCheck = {
    url: 'https://www.gstatic.com/generate_204',
    interval: 300, timeout: 5000, lazy: true, 'expected-status': 204, hidden: true
  };
  const autoGroups = [];
  const regionGroups = regions.map(([name, pattern]) => {
    const matches = (config.proxies || []).map(proxy => proxy.name)
      .filter(node => pattern.test(node));
    const nodes = [...new Set(matches)];
    const selector = name + '节点';
    // Keep empty regions selectable without routing their traffic elsewhere.
    if (!nodes.length) return { name: selector, type: 'select', proxies: ['REJECT'] };

    const automatic = name + '自动';
    if (name === usRegion) {
      const standard = [];
      const multiplier = [];
      let primary;
      for (const node of nodes) {
        const label = node.normalize('NFKC').trim();
        // Only a trailing numeric bracket is a multiplier. Classify it before checking D1–D4.
        if (/\[\s*(?:[x×]\s*)?\d+(?:\.\d+)?\s*(?:[x×倍])?\s*\]$/i.test(label)) {
          multiplier.push(node);
        } else {
          const slot = label.match(/(?:^|[^A-Za-z0-9])D([1-4])$/i)?.[1];
          if (slot === '3') primary ??= node;
          else if (slot) standard.push(node);
        }
      }

      const tiers = primary ? [primary] : [];
      for (const [tier, candidates] of [[usStandardAuto, standard], [usMultiplierAuto, multiplier]]) {
        if (!candidates.length) continue;
        autoGroups.push({ ...healthCheck, name: tier, type: 'url-test', proxies: candidates, tolerance: 0 });
        tiers.push(tier);
      }
      // Unknown labels remain available as manual picks.
      if (!tiers.length) return { name: selector, type: 'select', proxies: ['REJECT', ...nodes] };
      autoGroups.push({ ...healthCheck, name: automatic, type: 'fallback', proxies: tiers });
    } else {
      autoGroups.push({ ...healthCheck, name: automatic, type: 'url-test', proxies: nodes, tolerance: 50 });
    }
    return { name: selector, type: 'select', proxies: [automatic, ...nodes] };
  });
  const businessGroups = [
    ...routes.map(route => route.existing ?? {
      name: route.name, type: 'select',
      proxies: route.preferred && !managedRegionNames.has(route.preferred) && !choices.includes(route.preferred)
        ? [route.preferred, ...choices]
        : [...choices]
    }),
    ...groups.filter(group => !managedRegionNames.has(group.name))
  ];
  config['proxy-groups'] = [
    ...businessGroups.map(group => {
      // Hide media selectors without removing their rules or changing their targets.
      if (['🌍 国外媒体', '🎬 Netflix', '🎬 DisneyPlus'].includes(group.name)) {
        group = { ...group, hidden: true };
      }
      // Keep fixed DIRECT/REJECT wrappers and automatic test groups unchanged.
      const previous = (group.proxies || []).filter(name => !managedRegionNames.has(name));
      const fixed = previous.length === 1 && ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(previous[0]);
      if (group.type !== 'select' || fixed) return group;
      const preferred = routes.find(route => route.name === group.name)?.preferred ??
        (group.name === paoluz ? usSelector : undefined);
      const sortedNodes = previous.filter(name => nodeRanks.has(name))
        .sort((a, b) => nodeRanks.get(a) - nodeRanks.get(b));
      const rest = previous.filter(name => !nodeRanks.has(name));
      return {
        ...group,
        // Display order is independent of the default used by a fresh selector.
        'default-selected': preferred ?? group['default-selected'] ?? previous[0] ?? regionNames[0],
        proxies: [...new Set([...displayRegionNames, ...sortedNodes, ...rest])]
      };
    }),
    ...regionGroups,
    ...autoGroups
  ];

  // 保留其他规则集，并设置我们自己的远程列表，每 86400 秒（24 小时）更新一次。
  const providers = { ...(config['rule-providers'] || {}) };
  for (const route of routes) {
    providers[route.id] = {
      type: 'http', behavior: 'classical', format: 'text',
      url: route.url ?? base + route.file,
      path: './ruleset/' + route.id + '.list',
      interval: 86400
    };
  }
  config['rule-providers'] = providers;

  // 把我们的规则放在机场规则之前；流量命中第一条匹配规则后就使用对应策略组。
  // Remove managed bindings before prepending them to keep repeated runs idempotent.
  const ids = new Set(routes.map(route => route.id));
  const originalRules = (config.rules || []).filter(rule => {
    const parts = rule.split(',').map(part => part.trim());
    return !(parts[0] === 'RULE-SET' && ids.has(parts[1]));
  });
  config.rules = [
    ...routes.map(route => 'RULE-SET,' + route.id + ',' + route.name),
    ...originalRules
  ];
  // Reuse an automatic selector only when every candidate is a concrete proxy.
  // Never resolve proxy endpoints through this group: that would create a dependency loop.
  const dnsNodes = (config.proxies || [])
    .filter(proxy => !['direct', 'reject', 'dns', 'pass'].includes(proxy.type))
    .map(proxy => proxy.name);
  const dnsNodeSet = new Set(dnsNodes);
  let dnsGroup = config['proxy-groups'].find(group =>
    /自动选择|auto[ -]?select/i.test(group.name) && group.type === 'url-test' &&
    !group['include-all'] && !group['include-all-proxies'] &&
    !group['include-all-providers'] && !(group.use || []).length &&
    (group.proxies || []).length > 0 &&
    group.proxies.every(name => dnsNodeSet.has(name))
  );
  // Reuse a previously generated provider-only or empty selector on repeated runs.
  dnsGroup = dnsGroup || config['proxy-groups'].find(group =>
    /^🌐 DNS 自动选择(?: \d+)?$/.test(group.name) && (
      (group.type === 'url-test' && group['exclude-type'] === 'direct|reject' &&
        (group.use || []).length > 0 &&
        group.use.every(name => Object.prototype.hasOwnProperty.call(config['proxy-providers'] || {}, name)) &&
        (group.proxies || []).every(name => dnsNodeSet.has(name))) ||
      (!dnsNodes.length && !Object.keys(config['proxy-providers'] || {}).length &&
        group.type === 'select' && JSON.stringify(group.proxies) === '["REJECT"]')
    )
  );
  if (!dnsGroup) {
    // Provider-only subscriptions can also supply nodes to the dedicated selector.
    const providerNames = Object.keys(config['proxy-providers'] || {});
    let name = '🌐 DNS 自动选择';
    const occupied = new Set([...config['proxy-groups'].map(group => group.name), ...dnsNodes]);
    for (let suffix = 2; occupied.has(name); suffix++) name = '🌐 DNS 自动选择 ' + suffix;
    dnsGroup = dnsNodes.length || providerNames.length ? {
      name, type: 'url-test', proxies: [...new Set(dnsNodes)],
      ...(providerNames.length ? { use: providerNames, 'exclude-type': 'direct|reject' } : {}),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300, timeout: 5000, tolerance: 50, lazy: true,
      'expected-status': 204
    } : { name, type: 'select', proxies: ['REJECT'] };
    config['proxy-groups'].push(dnsGroup);
  }
  // Keep the subscription's listener and Fake-IP compatibility filters.
  // Resolve proxy endpoints directly to avoid a DNS/proxy dependency loop.
  config.dns = {
    ...(config.dns || {}),
    enable: true, ipv6: false, 'prefer-h3': false,
    'use-hosts': true, 'use-system-hosts': true, 'respect-rules': false,
    'enhanced-mode': 'fake-ip', 'fake-ip-range': '198.18.0.1/16',
    'default-nameserver': ['223.5.5.5', '119.29.29.29'],
    'proxy-server-nameserver': [
      'https://dns.alidns.com/dns-query#DIRECT',
      'https://doh.pub/dns-query#DIRECT'
    ],
    'proxy-server-nameserver-policy': {},
    nameserver: [
      'https://1.1.1.1/dns-query#' + dnsGroup.name,
      'https://8.8.8.8/dns-query#' + dnsGroup.name
    ],
    'nameserver-policy': {
      'geosite:cn': [
        'https://dns.alidns.com/dns-query#DIRECT',
        'https://doh.pub/dns-query#DIRECT'
      ]
    },
    // Clear inherited resolver paths that could bypass this policy.
    fallback: [], 'fallback-filter': {},
    'direct-nameserver': [], 'direct-nameserver-follow-policy': false
  };
  return config;
};
