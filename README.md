# My Routing

为 FlClash 补充个人分流规则与地区选择，保留机场原有规则。

## 使用

在订阅扩展中通过 URL 导入[脚本](https://raw.githubusercontent.com/chiqingsong/my-routing/main/flclash/My-Routing.js)，选择脚本模式，绑定并应用。

- `X / Grok / Cursor`、`Siri` 可以选择节点或地区组；对应规则优先于机场规则。
- 提供香港、台湾、日本、韩国、新加坡、美国、马来西亚、德国、荷兰、英国十个地区组，按节点名称识别地区。每组可手选节点，或选择组内自动测速；没有匹配节点的地区使用 `REJECT`。
- 自动测速间隔 300 秒，切换容差 50 毫秒，启用懒测速。国外媒体、Netflix、DisneyPlus 组仅隐藏，规则仍保留。
- 已接入的规则集每 24 小时更新；修改脚本后需在 FlClash 同步并重新应用。

## 规则与来源

| 文件 | 上游 | 更新方式 |
| --- | --- | --- |
| [X&Grok&Cursor.list](rules/X&Grok&Cursor.list) | [blackmatrix7 Twitter](https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Loon/Twitter/Twitter.list)、v2fly [Cursor](https://github.com/v2fly/domain-list-community/blob/master/data/cursor) / [xAI](https://github.com/v2fly/domain-list-community/blob/master/data/xai) | 手动维护快照 |
| [Siri.list](rules/Siri.list) | [ddgksf2013](https://github.com/ddgksf2013/Filter/blob/master/AppleIntelligence.list)、[RocM301](https://github.com/RocM301/Apple-Rule/blob/main/Apple-AI.list) | 合并去重后手动维护 |
| [TelegramSG.list](rules/TelegramSG.list)、[TelegramUS.list](rules/TelegramUS.list)、[TelegramEU.list](rules/TelegramEU.list) | [RzMY 区域映射与生成器](https://github.com/RzMY/Telegram-CIDR-Regions)、[RIPEstat 数据接口](https://stat.ripe.net/docs/data-api/api-endpoints/announced-prefixes) | 每日自动生成 |

Siri 清单也包含 Apple Relay 等服务，覆盖范围不限于 Siri。Telegram SG、US、EU 已接入脚本，默认分别选择新加坡、美国、德国地区组，可手动更换出口；三份规则均优先于机场规则。

## 维护

新增匹配项时修改对应列表；新增独立分流组时，同时修改脚本的 `routes`。

Telegram 使用改造后的[生成器](scripts/update_telegram.py)，按上游映射划分 SG（DC5）、US（DC1/DC3）、EU（DC2/DC4）。它只保留最新快照中仍宣告的网段，拆分跨区域重叠；获取或校验失败时不发布更新。[自动任务](.github/workflows/update-telegram.yml)计划每天北京时间 09:23 运行，可能受 GitHub 调度延迟影响，仅在规则变化时提交，也可在 Actions 手动触发。

本地检查与生成：

```sh
python3 -m unittest discover -s tests -v
python3 scripts/update_telegram.py
```

Telegram 生成器的上游 MIT 许可保留在 [LICENSE-Telegram](LICENSE-Telegram)；其他规则遵循各上游许可。
