// FlClash 会把原始订阅配置传入 main，脚本修改后再返回。
const main = (config) => {
  // 每一项把一个远程规则列表绑定到一个可手动选择节点的策略组。
  // id 是规则集标识，尽量保持不变；file 是仓库 rules 目录下的文件路径。
  const routes = [
    { name: 'X / Grok / Cursor', id: 'my-routing', file: 'My-routing-X/Grok/Cursor.list' },
    { name: 'Siri', id: 'my-routing-siri', file: 'Siri.list' }
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
  config['proxy-groups'] = [
    ...routes.map(route => ({ name: route.name, type: 'select', proxies: [...choices] })),
    ...groups
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
  // 先删除这两个规则集的旧绑定，确保反复运行脚本也不会产生重复规则。
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
