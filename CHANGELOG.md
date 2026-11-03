# Changelog

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
