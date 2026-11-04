# Changelog

## 0.2.6

- **Opening the panel no longer starts the daemon when auto-start is off.** The model tab
  used to call `/ensure-daemon` whenever the panel opened and the daemon was down,
  ignoring the auto-start switch. It now stays a read-only observer unless
  "启动时自动启动 Hindsight daemon" is on, matching what the settings card promised.

## 0.2.5

- **One-step install.** Every release carries `dsh-hindsight-panel.tgz`, so the plugin
  page installs the panel from
  `https://github.com/akamuyyds/dsh-hindsight-panel/releases/latest/download/dsh-hindsight-panel.tgz`
  without cloning the repository. The release workflow attaches that tarball
  automatically, under a stable file name that never changes between versions.
- README (中文 / English) now leads with that path and keeps the source checkout only
  for development.

## 0.2.4

- **Auto-start is now a setting, not a hard-coded behaviour.** The *About* tab has a
  "插件设置" card with a switch for starting the daemon on load and a 0–300s delay.
- Preferences persist to `~/.hindsight/dsh-hindsight-panel.json` (mode 0600), separate
  from the Hindsight profile env so the model form and the panel settings never
  overwrite each other.
- `GET/POST /api/dsh-hindsight-panel/settings` expose the same values; saving with the
  switch on starts a stopped daemon right away.

## 0.2.3

- **The daemon now comes up on its own.** DSH only starts it while a session retains
  or recalls memories, so after a desktop restart the panel used to open on a stopped
  backend. The host half starts it 15s after load, and the panel kicks the same path on
  first open (one shared start, never two).
- The badge shows `daemon 启动中` while that happens, and a failed auto-start says why
  instead of leaving the panel looking broken.
- New `POST /api/dsh-hindsight-panel/ensure-daemon` exposes the same idempotent
  start-and-wait for anything else that needs it.

## 0.2.2

- **Restart diagnostics no longer contradict the live status.** The status badge now reads
  "restarting" while a restart runs and shows `daemon 运行中 · 上次重启失败` when the
  daemon is healthy again but the last attempt is still recorded as failed.
- The failure card explains that case in words instead of just dumping `start 退出码 1`,
  and keeps the retry/rollback buttons available.
- When `start` reports an error but another process is already bringing the daemon up
  (a second window, or a start racing with the panel's own), the panel now waits up to
  90s for `/health` instead of failing immediately on the exit code.

## 0.2.1

- **Fixed the panel taking DSH down at startup.** Current DSH builds only allow a slot to
  be registered after its owning entry has declared it, so both registrations now wait
  inside `slots.inject` instead of running directly in `apply`.
- `dsh.client.inject` now lists the client packages the sidebar and main area come from
  (`dsh-client-ui-conversation`, `dsh-client-ui-workspace`, `dsh-typert-registry`,
  `dsh-client-connection`), matching how shipped sidebar plugins declare themselves.
- A client-half failure is reported instead of thrown: the reason is written to
  `~/.hindsight/dsh-hindsight-panel-client-error.log` and shown as a small banner, so a
  broken build can no longer block the whole window.
- The Chinese README is now the main `README.md`; the English one moved to
  `README.en.md`.

## 0.2.0

- **Model tab reads DSH's own LLM configuration.** Providers and models declared in the
  Harness profile are listed under *From DSH local config*; their API key is resolved
  from the DSH credential store inside the harness process, so it never reaches the
  browser. `opencode-go` and `deepseek-official` are supported out of the box.
- Saving a locally configured provider writes the Hindsight provider it maps to, plus
  model aliases where the public API uses a different id
  (`deepseek-flash` → `deepseek-v4-flash`).
- New host route `GET /api/dsh-hindsight-panel/dsh-providers`; `/overview` now carries a
  compact summary of local providers instead of the full catalog.
- Saving with an empty password field keeps the stored API key. Use the explicit
  *Clear stored key* option to remove it.
- Restart no longer fails when the Windows stop command exits non-zero after stopping the
  daemon; readiness is decided by polling `/health`.
- Worked around a client state-closure bug where changing search mode kept the previous
  mode.

## 0.1.0

- First release: sidebar entry and main panel, model switching with save / save & restart
  / rollback / connection test, memory browsing (memories, documents, observations, LLM
  calls, knowledge pages), and one-click uninstall.
