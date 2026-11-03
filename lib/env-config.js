// Pure helpers for reading and rewriting Hindsight's profile env file.
//
// Hindsight's daemon reads its LLM settings from
//   <HINDSIGHT_HOME>/profiles/<profile>.env
// once at daemon start, so switching the model means rewriting a handful of
// lines in that file and then restarting the daemon.
//
// This module is deliberately free of I/O and of any Cordis/DSH dependency so
// it can be exercised with `node --test` (see test/env-config.test.mjs).

/** Env keys this panel reads and writes. */
export const LLM_KEYS = {
  provider: "HINDSIGHT_API_LLM_PROVIDER",
  model: "HINDSIGHT_API_LLM_MODEL",
  baseURL: "HINDSIGHT_API_LLM_BASE_URL",
  apiKey: "HINDSIGHT_API_LLM_API_KEY",
  reasoningEffort: "HINDSIGHT_API_LLM_REASONING_EFFORT",
  port: "HINDSIGHT_API_PORT",
};

const ACTIVE_LINE = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;
const COMMENTED_LINE = /^\s*#\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;

function unquote(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function quoteIfNeeded(value) {
  const text = String(value);
  if (text === "") return "";
  if (/[\s#"'\\]/.test(text)) return JSON.stringify(text);
  return text;
}

/**
 * Parse the active `KEY=value` pairs of an env file.
 * Commented lines and blanks are ignored; later assignments win.
 */
export function parseEnv(text) {
  const values = {};
  for (const line of String(text == null ? "" : text).split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = ACTIVE_LINE.exec(line);
    if (match === null) continue;
    values[match[2]] = unquote(match[4]);
  }
  return values;
}

/** The LLM settings currently active in an env file. */
export function readLlmConfig(text) {
  const values = parseEnv(text);
  const port = Number(values[LLM_KEYS.port] || 0);
  return {
    provider: values[LLM_KEYS.provider] || "",
    model: values[LLM_KEYS.model] || "",
    baseURL: values[LLM_KEYS.baseURL] || "",
    apiKey: values[LLM_KEYS.apiKey] || "",
    reasoningEffort: values[LLM_KEYS.reasoningEffort] || "",
    port: Number.isFinite(port) && port > 0 ? port : null,
  };
}

/** `sk-b3f6...e3814` style masking; short secrets are fully hidden. */
export function maskSecret(value) {
  const text = String(value == null ? "" : value);
  if (text === "") return "";
  if (text.length <= 8) return "*".repeat(text.length);
  return `${text.slice(0, 5)}${"*".repeat(Math.min(12, Math.max(4, text.length - 9)))}${text.slice(-4)}`;
}

/**
 * Rewrite `updates` inside the env text, keeping every other line (including
 * the template's comments) exactly as it was.
 *
 * - `undefined` values are ignored (leave the key alone).
 * - `null` values remove a key by commenting its active line out.
 * - The shipped template comments out every optional key (`# KEY=`). When a
 *   key has no active line but does have such a commented template line, the
 *   value is written in place instead of growing a second copy at the bottom.
 * - Keys that appear nowhere are appended in a small trailing block, marked
 *   so a human can tell where they came from.
 */
export function applyEnvUpdates(text, updates) {
  const source = String(text == null ? "" : text);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const pending = new Map();
  for (const [key, value] of Object.entries(updates || {})) {
    if (value === undefined) continue;
    pending.set(key, value);
  }
  if (pending.size === 0) return source;

  const lines = source.split(/\r?\n/);
  const handled = new Set();
  const out = lines.map((line) => {
    const match = ACTIVE_LINE.exec(line);
    if (match === null) return line;
    const key = match[2];
    if (!pending.has(key)) return line;
    handled.add(key);
    const value = pending.get(key);
    if (value === null) return `# ${key}=${match[4]}`.trimEnd();
    return `${match[1]}${key}=${quoteIfNeeded(value)}`;
  });

  // Optional template keys are commented out; activate them in place.
  const commented = new Map();
  lines.forEach((line, index) => {
    if (ACTIVE_LINE.test(line)) return;
    const match = COMMENTED_LINE.exec(line);
    if (match !== null && !commented.has(match[1])) commented.set(match[1], index);
  });

  const appended = [];
  for (const [key, value] of pending) {
    if (handled.has(key)) continue;
    if (value === null) continue;
    if (commented.has(key)) {
      out[commented.get(key)] = `${key}=${quoteIfNeeded(value)}`;
      continue;
    }
    appended.push(`${key}=${quoteIfNeeded(value)}`);
  }

  if (appended.length > 0) {
    if (out.length > 0 && out[out.length - 1] !== "") out.push("");
    if (!out.includes("# Added by dsh-hindsight-panel")) {
      out.push("# Added by dsh-hindsight-panel");
    }
    out.push(...appended);
  }
  return out.join(eol);
}

/** Turn a settings object into the `updates` map accepted by applyEnvUpdates. */
export function llmUpdates(next, { clearMissing = true } = {}) {
  const updates = {};
  if (typeof next.provider === "string") updates[LLM_KEYS.provider] = next.provider.trim();
  if (typeof next.model === "string") updates[LLM_KEYS.model] = next.model.trim();
  if (next.baseURL !== undefined) {
    const baseURL = typeof next.baseURL === "string" ? next.baseURL.trim() : "";
    updates[LLM_KEYS.baseURL] = baseURL === "" && clearMissing ? null : baseURL;
  }
  if (next.apiKey !== undefined) {
    const apiKey = typeof next.apiKey === "string" ? next.apiKey.trim() : "";
    updates[LLM_KEYS.apiKey] = apiKey === "" ? null : apiKey;
  }
  if (next.reasoningEffort !== undefined) {
    const effort = typeof next.reasoningEffort === "string" ? next.reasoningEffort.trim() : "";
    updates[LLM_KEYS.reasoningEffort] = effort === "" && clearMissing ? null : effort;
  }
  if (next.port !== undefined) {
    const port = Number(next.port);
    updates[LLM_KEYS.port] = Number.isFinite(port) && port > 0 ? String(port) : null;
  }
  return updates;
}
