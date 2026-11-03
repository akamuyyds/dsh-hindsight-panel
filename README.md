# dsh-hindsight-panel

[![CI](https://github.com/akamuyyds/dsh-hindsight-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/akamuyyds/dsh-hindsight-panel/actions/workflows/ci.yml)

给 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 用的侧边栏面板，把
[Hindsight](https://github.com/vectorize-io/hindsight) 记忆集中到一处 —— 并且可以直接
切换 Hindsight 自己用的模型，不用手改 env 文件。

| | |
| --- | --- |
| **切换 Hindsight 用的模型** | 选 provider、模型、base URL、API Key 与 reasoning effort，保存后可顺手重启本地 Hindsight daemon 让改动生效；一键回滚可恢复上一次的配置。 |
| **复用 DSH 已配置好的模型** | Harness profile 里声明过的 provider/模型（例如 `opencode-go`、`deepseek-official`）会原样列出。API Key 由宿主进程从 DSH 凭据库解析，不进浏览器、也不用重复填写。 |
| **看它记住了什么** | 当前 bank 的记忆、文档、观察、LLM 调用统计与知识页，支持关键词搜索、语义召回、记忆构成图。 |
| **面板内一键卸载** | 关于页通过 Harness 插件管理器移除 bundle 并刷新页面，不会动你的记忆数据和 Hindsight 配置。 |

全部本地运行：插件代理 `127.0.0.1:9077` 的 Hindsight REST API，并读写 daemon profile 的
env 文件（`~/.hindsight/profiles/<profile>.env`）。API Key 只以掩码形式展示。

## 环境要求

1. **DeepSeek Harness**，且是桌面/Web profile（只跑 CLI 不行）。
2. **Hindsight coding agent** 已安装并以 daemon 模式运行 —— 市场里的
   `@vectorize-io/hindsight-coding-agents`，daemon 在 `127.0.0.1:9077`。检查：

   ```bash
   curl http://127.0.0.1:9077/health
   # {"status":"healthy","database":"connected", ...}
   ```

3. **`uvx`** 在 `PATH` 上 —— 只有「保存并重启」「回滚」需要。不在 `PATH` 就用环境变量
   `HINDSIGHT_UVX` 指定绝对路径。
4. **Node.js 22.19+ / 24+** —— 只用于跑单元测试，运行插件不需要。

## 安装

插件没有构建步骤：克隆下来，让 Harness 的插件管理器指向这个目录即可。

```bash
git clone https://github.com/akamuyyds/dsh-hindsight-panel.git ~/dsh-plugins/dsh-hindsight-panel
```

然后打开 Harness Web UI：

1. 侧边栏点 **插件**，按 **添加插件**（按钮旁的箭头里还有「安装第三方插件」）。
2. 选 **本地目录**，填克隆目录的绝对路径，例如 `D:\dsh-plugins\dsh-hindsight-panel`
   （要填真实路径，不要用 `~`）。
3. 列表里出现 **Hindsight 记忆**，立即生效。
4. 点侧边栏新出现的脑图图标，面板在主区域打开。

> 目录要留在安装时所在的位置：bundle 是以 `link:` 依赖安装的，移动或删除目录会让
> 插件失效，需要重新安装。

## 第一次打开

打开面板的「模型」页检查：

- **Daemon** 显示 *healthy* 与检测到的版本（例如 `v1.1.0`）。
- **当前模型** 显示 daemon 现在实际使用的 provider/model（读自 profile env），Key 掩码。
- 点 **测试连接** 会触发一次真实的 Hindsight 抽取调用（`dry-run-extract`），能拿到
  facts 就说明 provider、模型、Key 整条链路都通。

## 使用

### 模型页

- **从 DSH 本地配置导入** —— 选 Harness profile 里声明过的 provider，模型列表和凭据
  （`OPENCODE_GO_API_KEY`、`DEEPSEEK_API_KEY` 等）自动探测；Key 输入框会提示
  *自动：`<凭据名>`*。
- **手动配置** —— 选 Hindsight 内置的 provider，或自己填 provider 名 + base URL
  （OpenAI 兼容）。
- **保存** 原位改写 profile env 文件，保留注释与所有无关行。**保存并重启** 还会执行
  `uvx hindsight-embed@latest daemon --profile <profile> stop|start`，并等到 `/health`
  返回 `healthy` + `database: connected`。大约 1–2 分钟：daemon 要验证模型连接并加载
  本地 embedding 模型。
- **回滚** 从 `~/.hindsight/profiles/<profile>.env.hindsight-panel-backup.json` 恢复
  上一次的 LLM 配置并重启。
- **Reasoning effort** 只在填写时写入；不支持该参数的 provider 写 `none` 也安全。

### 记忆页

bank 选择器（通常是 `coding-agent::<repo>`）、4 个统计卡、构成甜甜圈图与 30 天活跃度
曲线，下面是子标签：

- **记忆** —— 按 fact 类型过滤、关键词搜索（`/memories/list?q=`）或语义召回
  （`/memories/recall`，带 reranker 分数）。
- **文档**、**观察**、**LLM 调用**（provider、模型、token、耗时）、**知识页**（bank
  没有知识页时显示空状态）。

### 卸载

**关于 → 卸载** 调用 Harness 插件管理器移除 bundle 并刷新页面；在 *设置 → 插件* 里
移除 **Hindsight 记忆** 效果相同。两者都不会删除记忆数据，也不会改 `~/.hindsight`。

## 模型切换的原理

Hindsight 在 daemon 启动时读取 LLM 配置，所以「换模型 = 改 env → 重启 daemon」。面板做的
就是这件事：

1. 只原位改写相关键（`HINDSIGHT_API_LLM_PROVIDER`、`_MODEL`、`_API_KEY`、`_BASE_URL`、
   `_REASONING_EFFORT`、`HINDSIGHT_API_PORT`）。模板注释保持注释，文件格式不变。
2. 把上一版 LLM 配置写进 `.hindsight-panel-backup.json`，供回滚使用。
3. 用 `uvx` 停止并启动 daemon；把「`/health` 已不再应答」视为停止成功（Windows 上
   停止命令即使生效也会返回非 0），随后轮询 `/health` 直到就绪。

重启失败时面板会显示日志尾部，env 里仍保留上一版可用的值，重新启动会回到最后一次
已知可用的配置。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 接口返回 403 | 插件校验 `x-dsh-hindsight-panel: 1` 请求头与同源 `Origin`，只能从面板调用，别从第三方页面调。 |
| 面板显示 `daemon: unreachable` | 启动 Hindsight：`uvx hindsight-embed@latest daemon --profile coding-agent start`。用了别的 profile 就在 `~/.hindsight/coding-agent.json` 里设 `daemonProfile`。 |
| 重启卡在 `stop` | Windows 上是正常现象：停止命令杀掉进程后仍返回非 0。面板已把「daemon 不再应答」当作停止成功；若它仍 healthy，错误信息会来自日志。 |
| 重启卡在 `ready` | 看面板里的日志尾部与 `~/.hindsight/profiles/<profile>.log`，多半是 base URL 写错、Key 被拒或没有网络。 |
| 更新后侧边栏图标不见了 | 宿主代码不会热重载：在 *设置 → 插件* 里把 **Hindsight 记忆** 禁用再启用，然后刷新页面。 |
| Key 输入框看起来是空的 | 空密码框表示「保留已存的 Key」。真要删除请用「清除已存 Key」。 |
| 端口 | daemon API 默认 `9077`；面板路由在 Harness Web 服务器的 `/api/dsh-hindsight-panel/*` 下。 |

## 开发

没有构建步骤。宿主半边是普通 Cordis 插件（`lib/index.js`）；浏览器半边是手写的
`window.__ModuleLoader__.load({ id, factory })` 模块（`lib/client.js`）。插件标题和描述来自
`locale/*.json`。

```bash
npm test        # env 文件编辑器单元测试（node --test）
node --check lib/index.js lib/client.js lib/env-config.js
```

重载方式：改宿主代码 → 在 *设置 → 插件* 里禁用/启用插件；改 `lib/client.js` → 刷新页面。
宿主报错见 Harness 的日志输出。

| 路径 | 用途 |
| --- | --- |
| `lib/index.js` | 宿主：HTTP 路由、Hindsight API 代理、env 编辑、重启状态机、本地 provider 探测 |
| `lib/env-config.js` | env 解析 / 掩码 / 保留注释的改写（纯函数） |
| `lib/client.js` | 浏览器：侧边栏入口 + 主面板（模型 / 记忆 / 关于） |
| `cordis.patch.yml` | 插入插件行的 bundle patch |
| `locale/en.json`, `locale/zh.json` | 插件管理器里的标题与描述 |
| `test/env-config.test.mjs` | 单元测试 |

## 许可

MIT —— 见 [LICENSE](LICENSE)。

---

英文文档见 [README.en.md](README.en.md)。
