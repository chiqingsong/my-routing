// FlClash 会把原始订阅配置传入 main，脚本修改后再返回。
const main = (config) => {
  // 每一项把一个远程规则列表绑定到一个可手动选择节点的策略组。
  // id 是规则集标识，尽量保持不变；file 是仓库 rules 目录下的文件路径。
  const routes = [
    { name: 'X / Grok / Cursor', id: 'my-routing', file: 'X&Grok&Cursor.list' },
    { name: 'Siri', id: 'my-routing-siri', file: 'Siri.list' },
    { name: 'Telegram SG', id: 'telegram-sg', file: 'TelegramSG.list', preferred: '🇸🇬 新加坡节点' },
    { name: 'Telegram US', id: 'telegram-us', file: 'TelegramUS.list', preferred: '🇺🇸 美国节点' },
    { name: 'Telegram EU', id: 'telegram-eu', file: 'TelegramEU.list', preferred: '🇩🇪 德国节点' }
  ];
  const base = 'https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/';
  const names = routes.map(route => route.name);

  // 保留机场原有策略组，只替换本脚本管理的同名组，避免重复添加。
  const groups = (config['proxy-groups'] || []).filter(group => !names.includes(group.name));

  // 两个组独立选择节点，不跟随机场策略组。没有已保存的选择时默认使用首个节点。
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
    ['🇺🇸 美国', /美国|美國|United States|USA|\bUS\b|🇺🇸/i],
    ['🇲🇾 马来西亚', /马来西亚|馬來西亞|Malaysia|\bMY\b|🇲🇾/i],
    ['🇩🇪 德国', /德国|德國|Germany|\bDE\b|🇩🇪/i],
    ['🇳🇱 荷兰', /荷兰|荷蘭|Netherlands|\bNL\b|🇳🇱/i],
    ['🇬🇧 英国', /英国|英國|United Kingdom|Britain|\b(?:UK|GB)\b|🇬🇧/i]
  ];
  const regionNames = regions.map(([name]) => name + '节点');
  const legacyRegionNames = regionNames.map(name => name.slice(name.indexOf(' ') + 1));
  const autoNames = regions.map(([name]) => name + '自动');
  const managedRegionNames = [...regionNames, ...legacyRegionNames, ...autoNames];
  const autoGroups = [];
  const regionGroups = regions.map(([name, pattern]) => {
    const matches = (config.proxies || []).map(proxy => proxy.name)
      .filter(node => pattern.test(node));
    const nodes = [...new Set(matches)];
    // Do not probe REJECT or silently fall back to another region.
    if (!nodes.length) return { name: name + '节点', type: 'select', proxies: ['REJECT'] };
    const automatic = name + '自动';
    autoGroups.push({
      name: automatic, type: 'url-test', proxies: nodes,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300, timeout: 5000, tolerance: 50,
      lazy: true, 'expected-status': 204, hidden: true
    });
    // Existing saved manual selections remain valid; fresh groups start with automatic selection.
    return { name: name + '节点', type: 'select', proxies: [automatic, ...nodes] };
  });
  const businessGroups = [
    ...routes.map(route => ({ name: route.name, type: 'select', proxies: [...choices] })),
    ...groups.filter(group => !managedRegionNames.includes(group.name))
  ];
  config['proxy-groups'] = [
    ...businessGroups.map(group => {
      // Hide media selectors without removing their rules or changing their targets.
      if (['🌍 国外媒体', '🎬 Netflix', '🎬 DisneyPlus'].includes(group.name)) {
        group = { ...group, hidden: true };
      }
      // Keep fixed DIRECT/REJECT wrappers and automatic test groups unchanged.
      const previous = (group.proxies || []).filter(name => !managedRegionNames.includes(name));
      const fixed = previous.length === 1 && ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'].includes(previous[0]);
      if (group.type !== 'select' || fixed) return group;
      // Put the default region first without preventing manual overrides.
      const preferred = routes.find(route => route.name === group.name)?.preferred;
      return { ...group, proxies: [...new Set([...(preferred ? [preferred] : []), ...previous, ...regionNames])] };
    }),
    ...regionGroups,
    ...autoGroups
  ];

  // 保留其他规则集，并设置我们自己的远程列表，每 86400 秒（24 小时）更新一次。
  const providers = { ...(config['rule-providers'] || {}) };
  for (const route of routes) {
    providers[route.id] = {
      type: 'http', behavior: 'classical', format: 'text',
      url: base + route.file,
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
      'https://1.1.1.1/dns-query#🇸🇬 新加坡节点',
      'https://8.8.8.8/dns-query#🇸🇬 新加坡节点'
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
