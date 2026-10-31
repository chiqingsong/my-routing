# My Routing 使用说明

## FlClash

在订阅扩展中选择脚本模式，通过 URL 导入以下脚本，绑定并应用：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/flclash/My-Routing.js

脚本创建 X / Grok / Cursor 组，默认跟随名称含“海外AI”的已有组，否则跟随第一个已有组。可在代理页面手动选择节点。没有已有组及节点时回退 DIRECT，使用前确认出口。规则每 24 小时拉取更新，规则匹配优先于原订阅规则。脚本本身的变更需要更新脚本。

## Loon（iOS / iPadOS）

在远程规则中添加以下 URL，并选择你已有的代理策略组：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/My-routing-X/Grok/Cursor.list

将它放到其他可能匹配这些服务的规则之前。远程规则条目示例（将 ExistingProxy 替换为现有策略组名称）：

```ini
[Remote Rule]
https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/My-routing-X/Grok/Cursor.list, policy=ExistingProxy, tag=My Routing, enabled=true
```

## 日常维护

只修改 rules/My-routing-X/Grok/Cursor.list 即可更新服务域名和 IP。初始包含 41 条去重规则，不包含节点、密钥或机场订阅。Grok Bot 与 Cursor 共用服务的部分统一分流；尚未逐项验证所有功能的请求。

本仓库规则为手动维护快照，不会自动同步上游。上游来源及许可见：

- https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Loon/Twitter/Twitter.list
- https://github.com/v2fly/domain-list-community/blob/master/data/cursor
- https://github.com/v2fly/domain-list-community/blob/master/data/xai


## Siri

新增独立的 Siri 策略组，使用 rules/Siri.list。FlClash 更新并应用 JS 后可选择出口；默认跟随海外AI（没有时使用首个已有组）。清单合并以下两份上游，标准化空格并去除完全重复规则；保留不同匹配类型。包含定位、Apple Relay、资源域名和 siri 关键词，覆盖范围不限于 Siri。此配置只控制网络出口，不改变账号、设备或地区资格。

- https://raw.githubusercontent.com/ddgksf2013/Filter/refs/heads/master/AppleIntelligence.list
- https://raw.githubusercontent.com/RocM301/Apple-Rule/refs/heads/main/Apple-AI.list

Siri 订阅：https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/Siri.list

Loon 将这份远程规则绑定到自己的 Siri 策略组。两份清单仍为手动维护快照。旧 rules/My-Routing.list 保留为兼容副本，避免尚未更新 JS 的设备断开；日常维护使用新路径。
