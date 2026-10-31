# My Routing 使用说明

## FlClash

在订阅扩展中选择脚本模式，通过 URL 导入以下脚本，绑定并应用：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/flclash/My-Routing.js

脚本创建 X / Grok / Cursor 组，默认跟随名称含“海外AI”的已有组，否则跟随第一个已有组。可在代理页面手动选择节点。没有已有组及节点时回退 DIRECT，使用前确认出口。规则每 24 小时拉取更新，规则匹配优先于原订阅规则。脚本本身的变更需要更新脚本。

## Loon（iOS / iPadOS）

在远程规则中添加以下 URL，并选择你已有的代理策略组：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/My-Routing.list

将它放到其他可能匹配这些服务的规则之前。远程规则条目示例（将 ExistingProxy 替换为现有策略组名称）：

```ini
[Remote Rule]
https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/My-Routing.list, policy=ExistingProxy, tag=My Routing, enabled=true
```

## 日常维护

只修改 rules/My-Routing.list 即可更新服务域名和 IP。初始包含 41 条去重规则，不包含节点、密钥或机场订阅。Grok Bot 与 Cursor 共用服务的部分统一分流；尚未逐项验证所有功能的请求。

本仓库规则为手动维护快照，不会自动同步上游。上游来源及许可见：

- https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Loon/Twitter/Twitter.list
- https://github.com/v2fly/domain-list-community/blob/master/data/cursor
- https://github.com/v2fly/domain-list-community/blob/master/data/xai
