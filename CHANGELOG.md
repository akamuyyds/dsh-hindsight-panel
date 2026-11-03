# Changelog

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
