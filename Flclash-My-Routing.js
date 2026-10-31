const main = (config) => {
  const name = 'X / Grok / Cursor';
  const groups = (config['proxy-groups'] || []).filter(g => g.name !== name);
  const fallback = groups.find(g => g.name.includes('海外AI')) || groups[0];
  const choices = [...new Set([...(fallback ? [fallback.name] : []), ...(config.proxies || []).map(p => p.name), 'DIRECT'])];
  config['proxy-groups'] = [{name, type: 'select', proxies: choices}, ...groups];
  config['rule-providers'] = {...(config['rule-providers'] || {}), 'my-routing': {
    type: 'http', behavior: 'classical', format: 'text',
    url: 'https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/My-Routing.list',
    path: './ruleset/my-routing.list', interval: 86400
  }};
  const rule = 'RULE-SET,my-routing,' + name;
  config.rules = [rule, ...(config.rules || []).filter(r => r !== rule)];
  return config;
};
