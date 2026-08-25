# dsh-auto-reasoning

`dsh-auto-reasoning` 是一个独立、Provider 无关的 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) LLM 路由插件。它为模型增加 `Auto` 思考级别，并在每次请求中根据任务复杂度选择下游模型实际支持的 reasoning effort。

它与多模态路由相互独立：可以单独使用，也可以放在 [`dsh-auto-vision`](https://github.com/ShanyouYu-Sean/dsh-auto-vision) 后面，让图片先被转换成视觉观察，再决定最终回答的思考强度。

## 工作方式

```text
单独使用：
DSH Session → dsh-auto-reasoning → 任意下游 Provider

与 Auto Vision 组合：
DSH Session → dsh-auto-vision → dsh-auto-reasoning → 最终回答 Provider
                         └→ Vision Provider（只负责识图）
```

- 普通问答、新闻摘要、行情查询等默认映射到 `high`，或下游最接近的可用级别。
- 深度研究、估值建模、财报分析、压力测试、多阶段交付等映射到 `max`，或下游最高的可用级别。
- 下游没有 reasoning 能力时不传该参数，保留 Provider 默认行为。
- 人工选择具体等级时直接透传，不再自动判断。
- `compaction` 和 `session-title` 等辅助请求不会被升级成复杂任务。

## 为什么是 Provider 无关的

插件不会假设所有 Provider 都使用 `high/max`。它首先读取下游模型公布的 reasoning metadata：

- 识别 `off/low/medium/high/max/xhigh/ultra` 等常见命名；
- 普通任务选择不高于 `high` 的最高可用级别；
- 复杂任务选择最高可用级别；
- 遇到未知命名时保留下游模型的默认级别；
- 可用 `normalEffort`、`complexEffort` 为任意 Provider 显式映射。

## 安装

```bash
dsh plugin --profile web add github:ShanyouYu-Sean/dsh-auto-reasoning#v0.1.0
```

然后重启对应的 DSH 进程。例如使用 systemd user service 时：

```bash
systemctl --user restart dsh-web.service
```

插件包提交了编译后的 `lib/`，从 GitHub 安装不需要运行 lifecycle build script。

## 默认配置

插件自带的 bundle 创建一条 `auto-reasoning → deepseek-official` 路由：

```yaml
- id: dsh-auto-reasoning
  config:
    routes:
      - provider: auto-reasoning
        name: Auto Reasoning
        upstreamProvider: deepseek-official
        models:
          - deepseek-v4-flash
          - deepseek-v4-pro
    threshold: 6
    logDecisions: true
```

要单独使用，将新 Session 的默认模型设置为 `auto-reasoning/<model>`，并将 `reasoningEffort` 设为 `auto`。

## 与 dsh-auto-vision 组合

在 profile 的 `cordis.patch.yml` 中，让 Auto Vision 的最终回答 Provider 指向 Auto Reasoning：

```yaml
- id: dsh-auto-vision
  config:
    primaryProvider: auto-reasoning
```

新 Session 仍然选择 `auto-vision/<model>`，但将 `reasoningEffort` 设置成 `auto`。图片识别调用不会被 Auto Reasoning 改写；只有最终文本回答会自动选择 reasoning effort。

## 多 Provider 路由

一个插件实例可以声明多条独立路由：

```yaml
- id: dsh-auto-reasoning
  config:
    routes:
      - provider: auto-reasoning-deepseek
        name: Auto Reasoning · DeepSeek
        upstreamProvider: deepseek-official
        models:
          - deepseek-v4-pro
      - provider: auto-reasoning-openai
        name: Auto Reasoning · OpenAI
        upstreamProvider: openai
        # models 留空时动态镜像下游 Provider 的模型目录
        normalEffort: high
        complexEffort: xhigh
```

`normalEffort` 与 `complexEffort` 必须是对应下游模型实际公布的 effort id；错误映射会在请求发出前明确失败。

## 复杂度判断

判断是本地、确定性且可解释的，不会额外调用一个模型做分类。评分只使用：

- 当前真人用户消息中的文本；
- 当前任务已经产生的工具结果数量，但不读取工具结果内容；
- 当前用户消息的图片数量，但图片本身不会直接触发 `max`；
- 明确的复杂任务特征，如深度研究、估值、财报、跨源验证、压力测试、多实体比较、多阶段实现与验证。

`auto_vision_observation` 中的 OCR/视觉内容会在判断前移除。网页、文件、图片或工具输出中的指令不能诱导插件升级 reasoning 级别。

当一个任务在工具执行过程中变复杂时，同一轮可以从普通升级到复杂；同一轮一旦升级不会再降级。缓存有固定上限，不持久化。

可调参数：

| 配置 | 默认值 | 说明 |
|---|---:|---|
| `autoEffortId` | `auto` | 插件对外公布的自动等级 id |
| `threshold` | `6` | 达到该分数时使用复杂等级 |
| `additionalComplexKeywords` | `[]` | 额外关键词，每个命中加 3 分 |
| `logDecisions` | `true` | 记录不含用户正文的审计日志 |
| `decisionLogLevel` | `info` | 审计日志级别：`debug`、`info` 或 `warn` |
| `maxDecisionCacheEntries` | `2048` | 同轮升级缓存上限 |

审计日志只包含 Provider、模型、等级、分数和规则名称，不记录用户消息正文：

`warn` 会直接写入进程 stderr，便于 systemd/journald 环境强制留痕；`info/debug` 使用 Cordis logger，是否输出由 profile 的日志 exporter 决定。

```text
dsh-auto-reasoning: provider=auto-reasoning upstream=deepseek-official model=... tier=complex score=8 effort=max reasons=deep-analysis,valuation-model
```

## 手动覆盖

模型选择器会显示 `Auto` 和下游模型原有的 reasoning levels：

- 选择 `Auto`：逐次自动路由；
- 选择 `high/max/...`：直接透传，人工选择优先；
- 删除插件不会改写历史消息或已有文件，但仍指向插件 Provider 的 Session 需要先切回真实 Provider。

## 回滚

1. 将默认模型和现有 Session 切回真实 Provider；如果与 Auto Vision 组合，将 `primaryProvider` 改回原 Provider。
2. 删除 profile 对 `dsh-auto-reasoning` 的覆盖。
3. 卸载并重启：

```bash
dsh plugin --profile web remove dsh-auto-reasoning
systemctl --user restart dsh-web.service
```

## 开发

```bash
pnpm install
pnpm check
pnpm pack
```

## License

[MIT](./LICENSE)
