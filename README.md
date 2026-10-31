# My Routing

统一维护 X / Twitter、Grok、Cursor / Grok Bot 的分流规则。

## 上传

将本文件与 `rules`、`flclash`、`loon` 三个文件夹上传到仓库根目录的 main 分支。不要把外层 my-routing 文件夹一起套进去。若 README.md 已存在，可以保留原文件，稍后在网页编辑说明。

## FlClash

从 URL 导入扩展脚本：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/flclash/My-Routing.js

在订阅的扩展设置中选择脚本模式，绑定并应用。脚本创建 X / Grok / Cursor 和 Siri 两个独立组，直接选择订阅节点，不跟随机场策略组。没有已保存的选择时默认使用首个节点；没有节点时仅有 DIRECT（直连）。

规则集每 86400 秒更新一次，也可手动更新。规则内容更新无需重新导入脚本；脚本自身的配置变化需要更新脚本。

## Loon

远程规则 URL：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/X&Grok&Cursor.list

在远程规则中添加该 URL，并绑定现有的代理策略组。规则应放在其他可能覆盖这些服务的规则前面。

`loon/My-Routing.conf` 仅为合并示例，不是完整配置。示例中的 ExistingProxy 和 SiriProxy 必须替换为已有策略组名称；建议直接在 Loon 中绑定你已有的代理策略组。

## 维护

日常只编辑 rules/X&Grok&Cursor.list。共 41 条初始规则，无节点、密钥或机场订阅。Grok Bot 和 Cursor 共用服务的部分一起分流，尚未逐项验证所有功能的网络请求。

规则源为手动整理的快照，不会自动同步上游。来源：

- https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Loon/Twitter/Twitter.list
- https://github.com/v2fly/domain-list-community/blob/master/data/cursor
- https://github.com/v2fly/domain-list-community/blob/master/data/xai

上游内容的使用和再分发请遵守各源仓库的许可。


## Siri

新增独立的 Siri 策略组，使用 rules/Siri.list。FlClash 更新并应用 JS 后可选择出口；直接选择节点，不跟随机场策略组。清单合并以下两份上游，标准化空格并去除完全重复规则；保留不同匹配类型。包含定位、Apple Relay、资源域名和 siri 关键词，覆盖范围不限于 Siri。此配置只控制网络出口，不改变账号、设备或地区资格。

- https://raw.githubusercontent.com/ddgksf2013/Filter/refs/heads/master/AppleIntelligence.list
- https://raw.githubusercontent.com/RocM301/Apple-Rule/refs/heads/main/Apple-AI.list

Siri 订阅：https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/Siri.list

Loon 将这份远程规则绑定到自己的 Siri 策略组。两份清单仍为手动维护快照。旧路径已删除，请更新脚本及 Loon 远程规则地址，使用 rules/X&Grok&Cursor.list。
