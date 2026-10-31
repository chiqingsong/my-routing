# My Routing

统一维护 X / Twitter、Grok、Cursor / Grok Bot 的分流规则。

## 上传

将本文件与 `rules`、`flclash`、`loon` 三个文件夹上传到仓库根目录的 main 分支。不要把外层 my-routing 文件夹一起套进去。若 README.md 已存在，可以保留原文件，稍后在网页编辑说明。

## FlClash

从 URL 导入扩展脚本：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/flclash/My-Routing.js

在订阅的扩展设置中选择脚本模式，绑定并应用。脚本创建 X / Grok / Cursor 组，优先使用名称含“海外AI”的现有组，否则使用第一个现有组；也可手动选择节点。若没有现有组和节点，会回退到 DIRECT，使用前请确认出口。

规则集每 86400 秒更新一次，也可手动更新。规则内容更新无需重新导入脚本；脚本自身的配置变化需要更新脚本。

## Loon

远程规则 URL：

https://raw.githubusercontent.com/chiqingsong/my-routing/main/rules/My-Routing.list

在远程规则中添加该 URL，并绑定现有的代理策略组。规则应放在其他可能覆盖这些服务的规则前面。

`loon/My-Routing.conf` 仅为合并示例，不是完整配置。示例组暂用 DIRECT 占位，必须替换为已有代理策略或节点；建议直接在 Loon 中绑定你已有的代理策略组。

## 维护

日常只编辑 rules/My-Routing.list。共 41 条初始规则，无节点、密钥或机场订阅。Grok Bot 和 Cursor 共用服务的部分一起分流，尚未逐项验证所有功能的网络请求。

规则源为手动整理的快照，不会自动同步上游。来源：

- https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Loon/Twitter/Twitter.list
- https://github.com/v2fly/domain-list-community/blob/master/data/cursor
- https://github.com/v2fly/domain-list-community/blob/master/data/xai

上游内容的使用和再分发请遵守各源仓库的许可。
