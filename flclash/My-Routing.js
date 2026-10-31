// FlClash calls main with the original subscription configuration.
const main = (config) => {
  // Each entry connects one remote rule list to one selectable proxy group.
  // Keep provider IDs stable so existing cached rule lists can still be used.
  const routes = [
    { name: 'X / Grok / Cursor', id: 'my-routing', file: 'My-routing-X/Grok/Cursor.list' },
    { name: 'Siri', id: 'my-routing-siri', file: 'Siri.list' }
  ];
  const base = 'https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/';
  const names = routes.map(route => route.name);

  // Preserve the subscription groups, replacing only our managed groups.
  const groups = (config['proxy-groups'] || []).filter(group => !names.includes(group.name));
  const fallback = groups.find(group => group.name.includes('海外AI')) || groups[0];

  // The first choice is the default; each group can select a different node.
  const choices = [...new Set([
    ...(fallback ? [fallback.name] : []),
    ...(config.proxies || []).map(proxy => proxy.name),
    'DIRECT'
  ])];
  config['proxy-groups'] = [
    ...routes.map(route => ({ name: route.name, type: 'select', proxies: [...choices] })),
    ...groups
  ];

  // Preserve other providers and refresh our text rule lists every 24 hours.
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

  // Put our rules before subscription rules. First match wins.
  // Remove older bindings for our provider IDs to avoid duplicate rules.
  const ids = new Set(routes.map(route => route.id));
  const originalRules = (config.rules || []).filter(rule => {
    const parts = rule.split(',').map(part => part.trim());
    return !(parts[0] === 'RULE-SET' && ids.has(parts[1]));
  });
  config.rules = [
    ...routes.map(route => 'RULE-SET,' + route.id + ',' + route.name),
    ...originalRules
  ];
  return config;
};
