# dsh-hindsight-panel

[![CI](https://github.com/akamuyyds/dsh-hindsight-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/akamuyyds/dsh-hindsight-panel/actions/workflows/ci.yml)

A sidebar panel for [DeepSeek Harness](https://github.com/deepseek-ai/dsh) that puts
[Hindsight](https://github.com/vectorize-io/hindsight) memory in one place — and lets you
change which model Hindsight itself uses, without editing env files by hand.

| | |
| --- | --- |
| **Switch the model Hindsight uses** | Pick a provider, model, base URL, API key and reasoning effort, then save — and optionally restart the local Hindsight daemon so the change takes effect. A one-click rollback restores the previous settings. |
| **Reuse what DSH already configured** | Providers and models declared in your Harness profile (for example `opencode-go` or `deepseek-official`) are listed as-is. The API key is resolved from DSH's credential store inside the harness process, so it never reaches the browser and never has to be typed twice. |
| **See what it remembers** | Memories, documents, observations, LLM call statistics and knowledge pages for the current bank, with keyword search, semantic recall and memory-composition charts. |
| **Uninstall from the panel** | The About tab removes the bundle through the Harness plugin manager and reloads the page. Your Hindsight data and configuration are left alone. |

Everything runs locally. The plugin proxies the Hindsight REST API on `127.0.0.1:9077`
and rewrites the daemon profile env file (`~/.hindsight/profiles/<profile>.env`). No data
leaves the machine; API keys are only ever rendered masked.

## Requirements

1. **DeepSeek Harness** with a desktop/web profile (the Web UI, not CLI-only).
2. **Hindsight coding agent** installed and running in daemon mode —
   `@vectorize-io/hindsight-coding-agents` from the Harness plugin marketplace, or
   `HINDSIGHT_API_PORT` reachable at `127.0.0.1:9077`. Check with:

   ```bash
   curl http://127.0.0.1:9077/health
   # {"status":"healthy","database":"connected", ...}
   ```

3. **`uvx`** on `PATH` — only needed for *Save & restart* and *Rollback*. Set
   `HINDSIGHT_UVX` to an absolute path if `uvx` lives outside `PATH`.
4. **Node.js 22.19+ / 24+** — only for the unit tests, not to run the plugin.

## Install

The plugin has no build step: clone it, then point the Harness plugin manager at the
folder.

```bash
git clone https://github.com/akamuyyds/dsh-hindsight-panel.git ~/dsh-plugins/dsh-hindsight-panel
```

Then in the Harness Web UI:

1. Open **Plugins** from the sidebar and press **Add plugin** (the arrow next to the
   button also offers *Install a third-party plugin*).
2. Pick the **local folder** option and enter the absolute path of the cloned folder —
   for example `D:\dsh-plugins\dsh-hindsight-panel`. Use a real path, not `~`.
3. The bundle is listed as **Hindsight Memory** and applies immediately.
4. Click the new brain icon in the left sidebar. The panel opens in the main area.

> The folder must stay where you installed it from: the bundle is installed as a
> `link:` dependency. Moving or deleting it breaks the plugin until you install it again.

## First run

Open the panel and check the **Model** tab:

- **Daemon** should say *healthy* and show the detected version (for example `v1.1.0`).
- **Current model** shows what the daemon is using right now, read from the profile env
  file (`HINDSIGHT_API_LLM_PROVIDER` / `_MODEL`), with the API key masked.
- Press **Test connection** to make a real extraction call through Hindsight
  (`dry-run-extract`). A successful answer proves the configured provider, model and key
  all work end to end.

## Use

### Model tab

- **From DSH local config** — choose one of the providers your Harness profile declares.
  Its models and its credential (`OPENCODE_GO_API_KEY`, `DEEPSEEK_API_KEY`, …) are
  detected automatically; the key field shows *auto: `<credential name>`*.
- **Manual configuration** — pick one of Hindsight's built-in providers, or type any
  provider name with a custom base URL (OpenAI-compatible).
- **Save** writes the profile env file in place, keeping comments and every unrelated
  line intact. **Save & restart** also runs
  `uvx hindsight-embed@latest daemon --profile <profile> stop|start` and waits for
  `/health` to report `healthy` + `database: connected`. Expect 1–2 minutes: the daemon
  verifies the model connection and loads its local embedding models.
- **Rollback** restores the previous LLM settings from
  `~/.hindsight/profiles/<profile>.env.hindsight-panel-backup.json` and restarts.
- **Reasoning effort** is only written when set; `none` is valid for providers that do
  not support it.

### Memory tab

Bank selector (usually `coding-agent::<repo>`), four stat cards, a composition donut and
a 30-day activity sparkline, then tabs for:

- **Memories** — filter by fact type, keyword search (`/memories/list?q=`), or semantic
  recall (`/memories/recall` with reranker scores).
- **Documents**, **Observations**, **LLM calls** (provider, model, tokens, duration) and
  **Knowledge pages** (empty state when the bank has none).

### Uninstall

**About → Uninstall** calls the Harness plugin manager, removes the bundle and reloads
the page. Removing **Hindsight Memory** from *Settings → Plugins* does the same. Neither
deletes your memories or touches `~/.hindsight`.

## How the model switch works

Hindsight reads its LLM configuration when the daemon starts, so a model change is
`edit env → restart daemon`. The panel does exactly that:

1. Rewrites only the relevant keys in place (`HINDSIGHT_API_LLM_PROVIDER`,
   `_MODEL`, `_API_KEY`, `_BASE_URL`, `_REASONING_EFFORT`, `HINDSIGHT_API_PORT`).
   Commented template lines stay commented; the file format is untouched.
2. Stores the previous LLM block in `.hindsight-panel-backup.json` for rollback.
3. Stops and starts the daemon with `uvx`, treats "the daemon is no longer answering
   `/health`" as a successful stop (the Windows stop command exits non-zero even when it
   works), then polls `/health` until the daemon is ready.

A failed restart keeps the log tail in the panel and leaves the previous env values in
the backup, so the next start uses the last known-good configuration.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Panel route returns 403 | The plugin checks the `x-dsh-hindsight-panel: 1` header and same-origin `Origin`. Call it from the panel, not from another site. |
| `daemon: unreachable` in the panel | Start Hindsight: `uvx hindsight-embed@latest daemon --profile coding-agent start`. If you use another profile, set it in `~/.hindsight/coding-agent.json` (`daemonProfile`). |
| Restart fails at `stop` | Expected on Windows: the stop command exits non-zero after killing the process. The panel already treats a non-responding daemon as stopped. If the daemon stays healthy, the error text comes from the log. |
| Restart fails at `ready` | Check the log tail shown in the panel and `~/.hindsight/profiles/<profile>.log`. Usually a wrong base URL, a rejected key, or no network. |
| Sidebar icon missing after an update | Host-side code changes are not hot-reloaded: disable and re-enable **Hindsight Memory** in *Settings → Plugins*, then refresh the page. |
| Key field looks empty | An empty password box means "keep the stored key". Use **Clear stored key** if you really want to remove it. |
| Ports | Daemon API defaults to `9077`; the panel's routes live under `/api/dsh-hindsight-panel/*` on the Harness web server. |

## Development

No build step. The host half is a plain Cordis plugin (`lib/index.js`); the browser half
is a hand-written `window.__ModuleLoader__.load({ id, factory })` module
(`lib/client.js`). The plugin title and description come from `locale/*.json`.

```bash
npm test        # env-file editor unit tests (node --test)
node --check lib/index.js lib/client.js lib/env-config.js
```

Reload loop: edit host files → disable/enable the plugin in *Settings → Plugins*; edit
`lib/client.js` → refresh the page. Host errors surface in the Harness log output.

| Path | Purpose |
| --- | --- |
| `lib/index.js` | Host half: HTTP routes, Hindsight API proxy, env editing, restart state machine, local-provider discovery |
| `lib/env-config.js` | Env parsing / masking / comment-preserving updates (pure functions) |
| `lib/client.js` | Browser half: sidebar entry + main panel (Model / Memory / About) |
| `cordis.patch.yml` | Bundle patch inserting the plugin row |
| `locale/en.json`, `locale/zh.json` | Plugin manager title and description |
| `test/env-config.test.mjs` | Unit tests |

## License

MIT — see [LICENSE](LICENSE).

---

中文说明见 [README.zh-CN.md](README.zh-CN.md)。
