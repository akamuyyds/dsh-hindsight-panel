// Host half of dsh-hindsight-panel.
//
// A plain Cordis plugin that:
//   1. exposes a small same-origin JSON API under /api/dsh-hindsight-panel/*,
//   2. rewrites the Hindsight daemon profile env file (the only place where
//      its LLM provider/model lives) and restarts the daemon,
//   3. proxies the daemon's REST API so the browser half can render memories,
//   4. can remove its own bundle from the profile in one request.
//
// The browser half never talks to the daemon directly and never sees the API
// key: every request goes through these routes.

import { spawn } from "node:child_process";
import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyEnvUpdates, llmUpdates, maskSecret, readLlmConfig } from "./env-config.js";

export const name = "dsh-hindsight-panel";
export const inject = ["webServer"];

const PLUGIN_PACKAGE = "dsh-hindsight-panel";
const API_BASE = "/api/dsh-hindsight-panel";
const REQUEST_HEADER = "x-dsh-hindsight-panel";
const DEFAULT_PROFILE = "coding-agent";
const DEFAULT_PORT = 9077;
const LOG_TAIL_LINES = 80;

/** Mirrors hindsight-embed's control-center provider catalog. */
const PROVIDER_CATALOG = [
  { id: "openai", label: "OpenAI", needsApiKey: true, defaultBaseURL: "https://api.openai.com/v1", models: ["gpt-5.1", "gpt-5-mini", "gpt-4.1"] },
  { id: "anthropic", label: "Anthropic", needsApiKey: true, defaultBaseURL: "https://api.anthropic.com", models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"] },
  { id: "gemini", label: "Google Gemini", needsApiKey: true, defaultBaseURL: "", models: ["gemini-3-pro", "gemini-2.5-flash", "gemini-2.5-pro"] },
  { id: "groq", label: "Groq", needsApiKey: true, defaultBaseURL: "https://api.groq.com/openai/v1", models: ["llama-4-scout", "llama-3.3-70b-versatile"] },
  { id: "ollama", label: "Ollama（本地）", needsApiKey: false, defaultBaseURL: "http://localhost:11434", models: ["qwen3:8b", "llama3.2:3b"] },
  { id: "lmstudio", label: "LM Studio（本地）", needsApiKey: false, defaultBaseURL: "http://localhost:1234/v1", models: ["local-model"] },
  { id: "vertexai", label: "Google Vertex AI", needsApiKey: false, defaultBaseURL: "", models: ["gemini-2.5-flash", "gemini-2.5-pro"] },
  { id: "deepseek", label: "DeepSeek", needsApiKey: true, defaultBaseURL: "", models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"] },
  { id: "minimax", label: "MiniMax", needsApiKey: true, defaultBaseURL: "", models: ["MiniMax-M2", "MiniMax-Text-01"] },
  { id: "zai", label: "Z.ai", needsApiKey: true, defaultBaseURL: "", models: ["glm-4.6", "glm-4.5-air"] },
  { id: "atlas", label: "Atlas Cloud", needsApiKey: true, defaultBaseURL: "https://api.atlascloud.ai/v1", models: [] },
  { id: "meta", label: "Meta Model API", needsApiKey: true, defaultBaseURL: "https://api.meta.ai/v1", models: ["llama-4-maverick"] },
  { id: "volcano", label: "Volcano 方舟", needsApiKey: true, defaultBaseURL: "", models: ["doubao-seed-1.6", "deepseek-v3.2"] },
];

const REASONING_EFFORTS = ["none", "low", "medium", "high"];

// ---------------------------------------------------------------------------
// DSH-local providers
//
// The daemon's LLM lives in its profile env, but the credentials, the provider
// routes and the model lists already exist in this DSH process. `llm` and
// `credentials` are optional host services: when either is missing the panel
// simply falls back to the bundled catalog above.
// ---------------------------------------------------------------------------

/** Provider names hindsight_api/config.py knows natively (PROVIDER_DEFAULT_MODELS). */
const HINDSIGHT_NATIVE_PROVIDERS = new Set([
  "openai", "openai-responses", "anthropic", "gemini", "groq", "minimax", "deepseek", "zai",
  "opencode-go", "atlas", "meta", "ollama", "ollama-cloud", "llamacpp", "lmstudio", "vertexai",
  "openai-codex", "chatgpt", "claude-code", "cursor", "github-copilot", "litellm", "bedrock",
  "volcano", "openrouter", "requesty", "fireworks", "nous", "xai-oauth", "mock", "none",
]);

/** DSH provider id -> how the Hindsight daemon should dial it. */
const DSH_ROUTE_HINTS = {
  "opencode-go": { provider: "opencode-go", baseURL: "" },
  "deepseek-official": { provider: "deepseek", baseURL: "" },
  deepseek: { provider: "deepseek", baseURL: "" },
  openai: { provider: "openai", baseURL: "" },
  anthropic: { provider: "anthropic", baseURL: "" },
  gemini: { provider: "gemini", baseURL: "" },
  google: { provider: "gemini", baseURL: "" },
  groq: { provider: "groq", baseURL: "" },
  minimax: { provider: "minimax", baseURL: "" },
  zai: { provider: "zai", baseURL: "" },
  meta: { provider: "meta", baseURL: "" },
  volcano: { provider: "volcano", baseURL: "" },
  ollama: { provider: "ollama", baseURL: "" },
  lmstudio: { provider: "lmstudio", baseURL: "" },
  vertexai: { provider: "vertexai", baseURL: "" },
  openrouter: { provider: "openrouter", baseURL: "" },
  atlas: { provider: "atlas", baseURL: "" },
};

/** Credential refs to try for a provider when DSH does not advertise any. */
const KEY_REF_OVERRIDES = {
  "opencode-go": ["OPENCODE_GO_API_KEY", "OPENCODE_API_KEY"],
  "deepseek-official": ["DEEPSEEK_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  groq: ["GROQ_API_KEY"],
  minimax: ["MINIMAX_API_KEY"],
  zai: ["ZAI_API_KEY"],
  meta: ["META_API_KEY"],
  volcano: ["ARK_API_KEY", "VOLCANO_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  atlas: ["ATLAS_API_KEY"],
};

/** DSH model ids that differ from the name the provider's public API expects. */
const MODEL_ALIASES = {
  "deepseek-official": { "deepseek-flash": "deepseek-v4-flash" },
};

function upperSnake(value) {
  return String(value == null ? "" : value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function serviceOf(ctx, id) {
  if (!ctx || typeof ctx.get !== "function") return undefined;
  try {
    return ctx.get(id);
  } catch {
    return undefined;
  }
}

function dshRouteHint(id, configurable) {
  const known = DSH_ROUTE_HINTS[id];
  if (known) return { provider: known.provider, baseURL: known.baseURL, native: HINDSIGHT_NATIVE_PROVIDERS.has(known.provider) };
  if (id.startsWith("opencode")) return { provider: "opencode-go", baseURL: "", native: true };
  const baseURL = (configurable && configurable.defaultBaseURL) || "";
  return { provider: baseURL !== "" ? "openai" : id, baseURL, native: HINDSIGHT_NATIVE_PROVIDERS.has(id) };
}

function keyRefCandidates(id, configurable) {
  const refs = [];
  const push = (value) => {
    const ref = typeof value === "string" ? value.trim() : "";
    if (ref !== "" && !refs.includes(ref)) refs.push(ref);
  };
  if (configurable) {
    for (const ref of configurable.baseURLEnv || []) push(ref);
    if (configurable.nativeAuth && Array.isArray(configurable.nativeAuth.env)) {
      for (const ref of configurable.nativeAuth.env) push(ref);
    }
  }
  for (const ref of KEY_REF_OVERRIDES[id] || []) push(ref);
  push(`${upperSnake(id)}_API_KEY`);
  push(`${upperSnake(id.replace(/-official$/, ""))}_API_KEY`);
  return refs;
}

async function resolveCredential(credentials, refs) {
  if (!credentials || typeof credentials.resolve !== "function") return null;
  for (const ref of refs) {
    try {
      const resolved = await credentials.resolve(ref);
      if (resolved && typeof resolved.value === "string" && resolved.value.trim() !== "") {
        return { ref, value: resolved.value, source: resolved.source || null };
      }
    } catch {
      // Unknown ref: keep looking.
    }
  }
  return null;
}

async function describeKey(credentials, refs) {
  if (!credentials || typeof credentials.describe !== "function") return null;
  for (const ref of refs) {
    try {
      const info = await credentials.describe(ref);
      if (info && info.configured === true) return { ref, source: info.source || null };
    } catch {
      // Unknown ref: keep looking.
    }
  }
  return null;
}

/**
 * Lists the providers/models this DSH profile has configured, plus whether each
 * one owns a credential the daemon could use. Never returns secret material.
 */
async function inspectLocalProviders(ctx) {
  const llm = serviceOf(ctx, "llm");
  const credentials = serviceOf(ctx, "credentials");
  if (!llm || typeof llm.listProviders !== "function") return { available: false, providers: [], reason: "host llm service unavailable" };

  let registered = [];
  let configurable = [];
  try {
    registered = await llm.listProviders();
  } catch {
    registered = [];
  }
  try {
    configurable = await llm.listConfigurableProviders();
  } catch {
    configurable = [];
  }

  const ids = [];
  for (const provider of Array.isArray(registered) ? registered : []) {
    if (provider && typeof provider.id === "string" && provider.id.trim() !== "") ids.push(provider.id.trim());
  }
  for (const provider of Array.isArray(configurable) ? configurable : []) {
    if (provider && typeof provider.provider === "string" && provider.provider.trim() !== "") ids.push(provider.provider.trim());
  }
  const uniqueIds = [...new Set(ids)].filter((id) => id !== "mock" && id !== "none");

  const providers = [];
  for (const id of uniqueIds) {
    const cfg = (Array.isArray(configurable) ? configurable : []).find((item) => item && item.provider === id) || null;
    let models = [];
    if (typeof llm.listModels === "function") {
      try {
        models = await llm.listModels(id);
      } catch {
        models = [];
      }
    }
    const refs = keyRefCandidates(id, cfg);
    const key = await describeKey(credentials, refs);
    const hint = dshRouteHint(id, cfg);
    // Only what the panel can actually offer: a known model list plus a route
    // the daemon can dial. The catalog above already covers everything else.
    if (!Array.isArray(models) || models.length === 0) continue;
    if (!(hint.native || hint.baseURL !== "")) continue;
    providers.push({
      provider: id,
      displayName: (cfg && cfg.displayName) || (Array.isArray(registered) ? (registered.find((item) => item && item.id === id) || {}).name : "") || id,
      declared: Boolean(cfg && cfg.declared),
      models: (Array.isArray(models) ? models : []).map((model) => ({
        id: String(model.id),
        name: typeof model.name === "string" && model.name !== "" ? model.name : String(model.id),
        description: typeof model.description === "string" ? model.description : "",
        inputModalities: Array.isArray(model.inputModalities) ? model.inputModalities : [],
      })),
      keyRefs: refs,
      keyRef: key ? key.ref : refs[0] || null,
      keyConfigured: Boolean(key),
      keySource: key ? key.source : null,
      // True when the Hindsight daemon can actually be pointed at this route:
      // either a native provider name, or an OpenAI-compatible base URL.
      mappable: Boolean(hint.native || hint.baseURL !== ""),
      hindsight: hint,
    });
  }
  return { available: true, providers };
}

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

function fail(response, statusCode, message) {
  sendJson(response, statusCode, { ok: false, error: String(message == null ? "" : message) });
}

function readJsonBody(request, limit = 128 * 1024) {
  return new Promise((resolve) => {
    const chunks = [];
    let bytes = 0;
    let overflow = false;
    request.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > limit) {
        overflow = true;
        return;
      }
      chunks.push(buffer);
    });
    request.on("end", () => {
      if (overflow) return resolve(null);
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw === "") return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    });
    request.on("error", () => resolve(null));
  });
}

/** Custom request header (forces a CORS preflight cross-origin) + same host origin. */
function isLocalRequest(request) {
  if (request.headers[REQUEST_HEADER] !== "1") return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text, max) {
  const value = String(text == null ? "" : text).trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function uvxCommand() {
  if (process.env.HINDSIGHT_UVX) return process.env.HINDSIGHT_UVX;
  if (process.platform === "win32") {
    const candidate = path.join(os.homedir(), ".local", "bin", "uvx.exe");
    return candidate;
  }
  return "uvx";
}

function embedSpec() {
  return process.env.HINDSIGHT_EMBED_SPEC || "hindsight-embed@latest";
}

function hindsightHome() {
  return process.env.HINDSIGHT_HOME || path.join(os.homedir(), ".hindsight");
}

function settingsPath() {
  return process.env.HINDSIGHT_CONFIG || path.join(hindsightHome(), "coding-agent.json");
}

// Panel preferences live next to the Hindsight config, never inside it: the
// Hindsight file belongs to the daemon and gets rewritten by the model form.
function panelSettingsPath() {
  return path.join(hindsightHome(), "dsh-hindsight-panel.json");
}

const DEFAULT_PANEL_SETTINGS = { autoStartDaemon: true, autoStartDelaySeconds: 15, stopOnExit: false };

function normalizePanelSettings(raw) {
  const autoStartDaemon = raw && raw.autoStartDaemon === false ? false : true;
  const stopOnExit = Boolean(raw && raw.stopOnExit === true);
  const delay = Number(raw && raw.autoStartDelaySeconds);
  const autoStartDelaySeconds = Number.isFinite(delay)
    ? Math.min(Math.max(Math.round(delay), 0), 300)
    : DEFAULT_PANEL_SETTINGS.autoStartDelaySeconds;
  return { autoStartDaemon, autoStartDelaySeconds, stopOnExit };
}

async function readPanelSettings() {
  try {
    const text = await fs.readFile(panelSettingsPath(), "utf8");
    return normalizePanelSettings(JSON.parse(text));
  } catch {
    return { ...DEFAULT_PANEL_SETTINGS };
  }
}

async function writePanelSettings(settings) {
  const file = panelSettingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

// Best-effort stop for shutdown. The daemon is a detached process, so the only
// way to stop it while the harness is exiting is to hand the command to its own
// detached child: that child keeps running after this process is gone, while
// waiting for it inline would just make quitting hang.
function stopDaemonDetached() {
  try {
    let profile = process.env.HINDSIGHT_DAEMON_PROFILE || DEFAULT_PROFILE;
    try {
      const parsed = JSON.parse(readFileSync(settingsPath(), "utf8"));
      if (parsed && typeof parsed.daemonProfile === "string" && parsed.daemonProfile) {
        profile = parsed.daemonProfile;
      }
    } catch {
      // fall back to the default profile
    }
    const child = spawn(uvxCommand(), [embedSpec(), "daemon", "--profile", profile, "stop"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {
    // shutdown must never throw
  }
}

function runCommand(command, args, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      resolve({ code, stdout, stderr, timedOut });
    };
    let child;
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({ code: -1, stdout: "", stderr: String(error && error.message ? error.message : error), timedOut: false });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);
    timer.unref?.();
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 64 * 1024) stdout = stdout.slice(-32 * 1024);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-32 * 1024);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(-1);
      stderr += String(error && error.message ? error.message : error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish(typeof code === "number" ? code : -1);
    });
  });
}

// ---------------------------------------------------------------------------
// Hindsight profile state
// ---------------------------------------------------------------------------

async function readSettings() {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function resolveStack() {
  const settings = await readSettings();
  const profile = typeof settings.daemonProfile === "string" && settings.daemonProfile.trim() !== "" ? settings.daemonProfile.trim() : DEFAULT_PROFILE;
  const profilesDir = path.join(hindsightHome(), "profiles");
  const envPath = path.join(profilesDir, `${profile}.env`);
  const logPath = path.join(profilesDir, `${profile}.log`);
  let envText = "";
  try {
    envText = await fs.readFile(envPath, "utf8");
  } catch {
    envText = "";
  }
  const llm = readLlmConfig(envText);
  const mode = typeof settings.serverMode === "string" ? settings.serverMode : "daemon";
  const port = Number(settings.apiPort) || llm.port || DEFAULT_PORT;
  return { settings, profile, envPath, logPath, envText, llm, mode, port };
}

async function tailLog(logPath, lines = LOG_TAIL_LINES) {
  try {
    const raw = await fs.readFile(logPath, "utf8");
    const all = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
    return all.slice(-lines).join("\n");
  } catch {
    return "";
  }
}

function daemonBase(port) {
  return `http://127.0.0.1:${port}`;
}

async function daemonJson(port, pathname, init = {}) {
  const { timeoutMs, ...rest } = init;
  const response = await fetch(`${daemonBase(port)}${pathname}`, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs || 15000),
    headers: { "content-type": "application/json", ...(rest.headers || {}) },
  });
  const raw = await response.text();
  let data = null;
  if (raw !== "") {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  }
  if (!response.ok) {
    const detail = data && typeof data === "object" ? data.detail || data.error || data.message : null;
    const error = new Error(typeof detail === "string" ? detail : `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function daemonHealth(port) {
  try {
    const response = await fetch(`${daemonBase(port)}/health`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return { ok: false, status: response.status };
    const data = await response.json();
    const healthy = data && data.status === "healthy" && (data.database === undefined || data.database === "connected");
    return { ok: Boolean(healthy), status: data && data.status, database: data && data.database };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function waitForDaemonDown(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await daemonHealth(port);
    if (!health.ok) return true;
    await sleep(1000);
  }
  return false;
}

// Starts the daemon when nothing is listening, and waits until /health is
// genuinely ready. Concurrent callers share one promise, so the panel opening
// while the plugin's own auto-start is in flight cannot start two processes.
const ensureState = { promise: null, lastError: null };

async function ensureDaemonRunning() {
  const { profile, port } = await resolveStack();
  const current = await daemonHealth(port);
  if (current.ok) return { started: false, running: true, health: current };
  if (ensureState.promise !== null) return ensureState.promise;
  ensureState.promise = (async () => {
    let startError = "";
    try {
      const result = await runCommand(uvxCommand(), [embedSpec(), "daemon", "--profile", profile, "start"], 180000);
      if (result.code !== 0) startError = truncate(result.stderr || result.stdout, 400);
    } catch (error) {
      startError = String(error && error.message ? error.message : error);
    }
    const deadline = Date.now() + 150000;
    let last = { ok: false };
    while (Date.now() < deadline) {
      last = await daemonHealth(port);
      if (last.ok) {
        ensureState.lastError = null;
        return { started: true, running: true, health: last };
      }
      await sleep(1500);
    }
    ensureState.lastError = startError || last.error || "daemon 启动超时（150s）";
    return { started: false, running: false, health: last, error: ensureState.lastError };
  })().finally(() => {
    ensureState.promise = null;
  });
  return ensureState.promise;
}

// ---------------------------------------------------------------------------
// daemon restart (the env file is only read at daemon start)
// ---------------------------------------------------------------------------

const restart = {
  state: "idle", // idle | running | ready | failed
  stage: "",
  steps: [],
  startedAt: null,
  finishedAt: null,
  error: null,
  logTail: "",
};

let restartPromise = null;

function publicRestart() {
  return {
    state: restart.state,
    stage: restart.stage,
    steps: restart.steps.map((step) => ({ ...step })),
    startedAt: restart.startedAt,
    finishedAt: restart.finishedAt,
    elapsedMs: restart.startedAt === null ? null : (restart.finishedAt || Date.now()) - restart.startedAt,
    error: restart.error,
    logTail: restart.logTail,
  };
}

async function runStep(key, label, action) {
  const step = { key, label, state: "running", detail: "", startedAt: Date.now(), finishedAt: null };
  restart.steps.push(step);
  restart.stage = key;
  try {
    const detail = await action(step);
    step.state = "done";
    step.detail = typeof detail === "string" ? detail : "";
  } catch (error) {
    step.state = "failed";
    step.detail = truncate(error && error.message ? error.message : error, 1000);
    throw error;
  } finally {
    step.finishedAt = Date.now();
  }
}

async function runRestart() {
  const { profile, logPath, port } = await resolveStack();
  restart.state = "running";
  restart.stage = "stop";
  restart.steps = [];
  restart.startedAt = Date.now();
  restart.finishedAt = null;
  restart.error = null;
  restart.logTail = "";
  try {
    await runStep("stop", "停止旧 daemon", async () => {
      const result = await runCommand(uvxCommand(), [embedSpec(), "daemon", "--profile", profile, "stop"], 60000);
      const output = `${result.stdout}\n${result.stderr}`;
      // On Windows the embed CLI can raise after the daemon is already gone
      // (WinError 87 from a liveness probe), so trust /health over the exit code.
      const down = await waitForDaemonDown(port, 30000);
      if (!down) {
        if (result.code !== 0 && !/not running|no daemon/i.test(output)) {
          throw new Error(`stop 退出码 ${result.code}：${truncate(result.stderr || result.stdout, 400)}`);
        }
        throw new Error("stop 已结束，但 daemon 仍在响应 /health。");
      }
      if (result.code !== 0) return "daemon 已停止（stop 命令在 Windows 上退出异常后仍生效）";
      return truncate(result.stdout || result.stderr, 200);
    });
    await runStep("start", "启动新 daemon", async (step) => {
      const result = await runCommand(uvxCommand(), [embedSpec(), "daemon", "--profile", profile, "start"], 180000);
      if (result.code === 0) return truncate(result.stdout || result.stderr, 200);
      // Another daemon may already be starting (a second window, or a start
      // racing with ours). "Clearing unhealthy process on port" and the
      // database handshake both hurt at that moment, but the other process
      // usually wins a few seconds later — wait before declaring failure.
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const health = await daemonHealth(port);
        if (health.ok) return "daemon 已启动（start 命令报错，但另一个进程已把它拉起来）";
        step.detail = `start 报错，正在等待端口 9077 上的 daemon 就绪（最多 90s）…`;
        await sleep(2000);
      }
      throw new Error(`start 退出码 ${result.code}：${truncate(result.stderr || result.stdout, 400)}`);
    });
    await runStep("ready", "等待健康检查", async (step) => {
      const deadline = Date.now() + 240000;
      let last = { ok: false };
      while (Date.now() < deadline) {
        last = await daemonHealth(port);
        if (last.ok) return "daemon 已就绪";
        step.detail = `已等待 ${Math.round((Date.now() - step.startedAt) / 1000)}s`;
        await sleep(1500);
      }
      throw new Error(`等待 daemon 就绪超时（240s）：${last.error || last.status || "未返回 healthy"}`);
    });
    restart.state = "ready";
    restart.stage = "";
    restart.logTail = await tailLog(logPath, 30);
  } catch (error) {
    restart.state = "failed";
    restart.stage = "";
    restart.error = String(error && error.message ? error.message : error);
    restart.logTail = await tailLog(logPath, LOG_TAIL_LINES);
  } finally {
    restart.finishedAt = Date.now();
  }
}

function startRestart(reason) {
  if (restartPromise !== null) {
    return { started: false, reason: "restart-in-progress", state: publicRestart() };
  }
  restart.reason = reason;
  restartPromise = runRestart().finally(() => {
    restartPromise = null;
  });
  return { started: true, state: publicRestart() };
}

// ---------------------------------------------------------------------------
// env file writes
// ---------------------------------------------------------------------------

function backupPath(envPath) {
  return `${envPath}.hindsight-panel-backup.json`;
}

async function saveEnv(envPath, nextText, previousLlm) {
  await fs.mkdir(path.dirname(envPath), { recursive: true });
  // One-step undo: remember the config that was active before this save.
  try {
    await fs.writeFile(backupPath(envPath), JSON.stringify({ savedAt: new Date().toISOString(), llm: previousLlm }, null, 2), { mode: 0o600 });
  } catch {
    // a missing backup only disables rollback, never the save itself
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    await fs.copyFile(envPath, `${envPath}.${stamp}.bak`);
  } catch {
    // first run may have no env file yet
  }
  await fs.writeFile(envPath, nextText, { mode: 0o600 });
}

async function readRollback(envPath) {
  try {
    const raw = await fs.readFile(backupPath(envPath), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.llm && typeof parsed.llm === "object") return parsed;
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// plugin version
// ---------------------------------------------------------------------------

let cachedPackage = null;
async function packageInfo() {
  if (cachedPackage !== null) return cachedPackage;
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const raw = await fs.readFile(path.join(here, "..", "package.json"), "utf8");
    const parsed = JSON.parse(raw);
    cachedPackage = { name: parsed.name || PLUGIN_PACKAGE, version: parsed.version || "0.0.0" };
  } catch {
    cachedPackage = { name: PLUGIN_PACKAGE, version: "0.0.0" };
  }
  return cachedPackage;
}

// ---------------------------------------------------------------------------
// route helpers
// ---------------------------------------------------------------------------

function query(request) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  return url.searchParams;
}

function firstString(value) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function pickPositiveInt(params, key, fallback, max) {
  const raw = Number(params.get(key));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}

function encodeBank(bank) {
  return encodeURIComponent(bank);
}

// ---------------------------------------------------------------------------
// the plugin
// ---------------------------------------------------------------------------

export function apply(ctx) {
  const disposers = [];
  let autoStartTimer = null;
  let cachedSettings = { ...DEFAULT_PANEL_SETTINGS };

  // Register the disposer before anything can fail: when a later route throws,
  // the host tears this fiber down and this cleanup removes whatever mounted
  // before the throw, instead of leaving half of the API behind for the retry.
  const cleanup = () => {
    if (autoStartTimer !== null) clearTimeout(autoStartTimer);
    autoStartTimer = null;
    if (cachedSettings.stopOnExit) stopDaemonDetached();
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // already gone
      }
    }
    disposers.length = 0;
  };
  if (typeof ctx.effect === "function") {
    ctx.effect(() => cleanup);
  } else if (typeof ctx.on === "function") {
    ctx.on("dispose", cleanup);
  }

  const route = (method, pathname, handler) => {
    const fullPath = `${API_BASE}${pathname}`;
    const wrapped = async (request, response) => {
      try {
        if (!isLocalRequest(request)) {
          fail(response, 403, "已拒绝非本机同源请求。");
          return;
        }
        if (request.method === "OPTIONS") {
          response.writeHead(204, { "cache-control": "no-store" });
          response.end();
          return;
        }
        if (method !== "ANY" && request.method !== method && !(method === "GET" && request.method === "HEAD")) {
          fail(response, 405, `只支持 ${method}`);
          return;
        }
        await handler(request, response);
      } catch (error) {
        const status = Number(error && error.status) || 500;
        fail(response, status, truncate(error && error.message ? error.message : error, 800));
      }
    };
    try {
      disposers.push(ctx.webServer.register({ kind: "exact", path: fullPath, handler: wrapped }));
    } catch (error) {
      // WebServer keeps one handler per exact path. Unmount what this apply
      // already added so a retry starts from a clean table instead of dying on
      // a duplicate route it registered itself.
      cleanup();
      throw error;
    }
  };

  // -- overview ------------------------------------------------------------
  route("GET", "/overview", async (request, response) => {
    const stack = await resolveStack();
    const [health, version, banks, dsh, panelSettings] = await Promise.all([
      daemonHealth(stack.port),
      daemonJson(stack.port, "/version", { timeoutMs: 4000 }).catch(() => null),
      daemonJson(stack.port, "/v1/default/banks", { timeoutMs: 8000 }).catch(() => null),
      inspectLocalProviders(ctx).catch(() => ({ available: false, providers: [] })),
      readPanelSettings().catch(() => ({ ...DEFAULT_PANEL_SETTINGS })),
    ]);
    const pkg = await packageInfo();
    sendJson(response, 200, {
      ok: true,
      plugin: pkg,
      runtime: {
        mode: stack.mode,
        supported: stack.mode === "daemon",
        profile: stack.profile,
        envPath: stack.envPath,
        logPath: stack.logPath,
        settingsPath: settingsPath(),
      },
      daemon: {
        running: health.ok,
        port: stack.port,
        health,
        version: version ? version.api_version : null,
        features: version ? version.features : null,
      },
      llm: {
        provider: stack.llm.provider,
        model: stack.llm.model,
        baseURL: stack.llm.baseURL,
        reasoningEffort: stack.llm.reasoningEffort,
        port: stack.llm.port || stack.port,
        hasApiKey: stack.llm.apiKey !== "",
        apiKeyMasked: maskSecret(stack.llm.apiKey),
      },
      providers: PROVIDER_CATALOG,
      dsh,
      reasoningEfforts: REASONING_EFFORTS,
      restart: publicRestart(),
      settings: panelSettings,
      banks: banks && Array.isArray(banks.banks) ? banks.banks : [],
    });
  });

  // -- providers/models already configured in this DSH profile ---------------
  route("GET", "/dsh-providers", async (request, response) => {
    const local = await inspectLocalProviders(ctx);
    sendJson(response, 200, { ok: true, ...local });
  });

  // -- save model config ---------------------------------------------------
  route("POST", "/save", async (request, response) => {
    const body = await readJsonBody(request);
    if (body === null) {
      fail(response, 400, "请求体不是合法 JSON 对象。");
      return;
    }
    const provider = typeof body.provider === "string" ? body.provider.trim() : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (provider === "") {
      fail(response, 400, "provider 不能为空。");
      return;
    }
    if (model === "") {
      fail(response, 400, "model 不能为空。");
      return;
    }
    const stack = await resolveStack();
    const wantsRestart = body.restart !== false;
    const previous = { ...stack.llm };
    // A provider picked from the "DSH local config" list carries no key in the
    // request: the host resolves it from the credential store on its behalf.
    const localProvider = typeof body.localProvider === "string" ? body.localProvider.trim() : "";
    let localKey = null;
    let keyWarning = null;
    if (localProvider !== "") {
      const local = await inspectLocalProviders(ctx).catch(() => ({ providers: [] }));
      const entry = (local.providers || []).find((item) => item.provider === localProvider) || null;
      const refs = entry && entry.keyRefs && entry.keyRefs.length > 0 ? entry.keyRefs : keyRefCandidates(localProvider, null);
      localKey = await resolveCredential(serviceOf(ctx, "credentials"), refs);
      if (localKey === null && stack.llm.apiKey === "") {
        keyWarning = `本地凭据里没有找到 ${localProvider} 的 API Key（尝试过 ${refs.join(" / ")}），模型可能无法调用。`;
      }
    }
    const typedKey = typeof body.apiKey === "string" && body.apiKey.trim() !== "";
    const aliasTable = MODEL_ALIASES[localProvider] || null;
    const effectiveModel = aliasTable && aliasTable[model] ? aliasTable[model] : model;
    // An empty key from the panel means "keep the stored one"; clearing has to be explicit.
    const apiKeyUpdate = typedKey ? body.apiKey : localKey !== null ? localKey.value : body.clearApiKey === true ? "" : undefined;
    const updates = llmUpdates({
      provider,
      model: effectiveModel,
      baseURL: typeof body.baseURL === "string" ? body.baseURL : undefined,
      apiKey: apiKeyUpdate,
      reasoningEffort: typeof body.reasoningEffort === "string" ? body.reasoningEffort : undefined,
      port: body.port,
    });
    const nextText = applyEnvUpdates(stack.envText, updates);
    await saveEnv(stack.envPath, nextText, previous);
    const saved = readLlmConfig(nextText);
    const restarted = wantsRestart ? startRestart("manual") : null;
    sendJson(response, 200, {
      ok: true,
      saved: {
        provider: saved.provider,
        model: saved.model,
        baseURL: saved.baseURL,
        reasoningEffort: saved.reasoningEffort,
        hasApiKey: saved.apiKey !== "",
        apiKeyMasked: maskSecret(saved.apiKey),
        port: saved.port,
      },
      envPath: stack.envPath,
      keyFrom: localKey ? localKey.ref : null,
      warning: keyWarning,
      restart: restarted ? restarted.state : publicRestart(),
      restartStarted: Boolean(restarted && restarted.started),
    });
  });

  // -- restart -------------------------------------------------------------
  route("POST", "/restart", async (request, response) => {
    const result = startRestart("manual");
    sendJson(response, 200, { ok: true, restartStarted: result.started, reason: result.reason || null, restart: result.state });
  });

  route("GET", "/restart-status", async (request, response) => {
    sendJson(response, 200, { ok: true, restart: publicRestart() });
  });

  // -- daemon lifecycle ----------------------------------------------------
  // DSH restarts leave the standalone daemon down until something asks for it;
  // the panel and its startup kick both come through here.
  route("POST", "/ensure-daemon", async (request, response) => {
    const result = await ensureDaemonRunning();
    sendJson(response, 200, { ok: true, ...result });
  });

  // -- panel settings ------------------------------------------------------
  // One route serves both verbs: webServer rejects two exact routes on the same
  // path, so GET/POST cannot be registered separately.
  route("ANY", "/settings", async (request, response) => {
    if (request.method === "GET" || request.method === "HEAD") {
      sendJson(response, 200, { ok: true, settings: await readPanelSettings() });
      return;
    }
    const body = await readJsonBody(request);
    if (body === null) {
      fail(response, 400, "请求体不是合法的 JSON 对象。");
      return;
    }
    const settings = normalizePanelSettings(body);
    await writePanelSettings(settings);
    cachedSettings = settings;
    const stack = await resolveStack();
    const health = await daemonHealth(stack.port);
    if (settings.autoStartDaemon && !health.ok) ensureDaemonRunning().catch(() => {});
    sendJson(response, 200, { ok: true, settings, daemon: { running: health.ok } });
  });

  // -- rollback ------------------------------------------------------------
  route("POST", "/rollback", async (request, response) => {
    const stack = await resolveStack();
    const backup = await readRollback(stack.envPath);
    if (backup === null) {
      fail(response, 404, "没有可回滚的上一次配置。");
      return;
    }
    const target = backup.llm;
    const updates = llmUpdates({
      provider: target.provider,
      model: target.model,
      baseURL: target.baseURL,
      apiKey: target.apiKey,
      reasoningEffort: target.reasoningEffort,
      port: target.port,
    });
    const nextText = applyEnvUpdates(stack.envText, updates);
    await saveEnv(stack.envPath, nextText, { ...stack.llm });
    const saved = readLlmConfig(nextText);
    const result = startRestart("rollback");
    sendJson(response, 200, {
      ok: true,
      savedAt: backup.savedAt || null,
      saved: {
        provider: saved.provider,
        model: saved.model,
        baseURL: saved.baseURL,
        reasoningEffort: saved.reasoningEffort,
        hasApiKey: saved.apiKey !== "",
        apiKeyMasked: maskSecret(saved.apiKey),
        port: saved.port,
      },
      restartStarted: result.started,
      restart: result.state,
    });
  });

  // -- connectivity probe --------------------------------------------------
  route("POST", "/test", async (request, response) => {
    const stack = await resolveStack();
    const body = await readJsonBody(request);
    const bank = (body && typeof body.bank === "string" && body.bank.trim()) || (await firstBank(stack.port));
    if (!bank) {
      fail(response, 400, "没有可用的 bank。");
      return;
    }
    const health = await daemonHealth(stack.port);
    if (!health.ok) {
      fail(response, 503, "Hindsight daemon 未就绪，无法测试模型。");
      return;
    }
    const payload = {
      content: "Connectivity probe from the DSH Hindsight panel: the memory daemon is configured and reachable.",
      context: "dsh-hindsight-panel connectivity test",
      timestamp: new Date().toISOString(),
    };
    try {
      const result = await daemonJson(stack.port, `/v1/default/banks/${encodeBank(bank)}/memories/dry-run-extract`, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 180000,
      });
      sendJson(response, 200, { ok: true, bank, llm: { provider: stack.llm.provider, model: stack.llm.model }, result });
    } catch (error) {
      sendJson(response, 200, { ok: false, bank, llm: { provider: stack.llm.provider, model: stack.llm.model }, error: truncate(error && error.message ? error.message : error, 900) });
    }
  });

  // -- logs ----------------------------------------------------------------
  route("GET", "/logs", async (request, response) => {
    const stack = await resolveStack();
    const lines = pickPositiveInt(query(request), "lines", 60, 400);
    sendJson(response, 200, { ok: true, path: stack.logPath, log: await tailLog(stack.logPath, lines) });
  });

  // -- uninstall -----------------------------------------------------------
  route("POST", "/uninstall", async (request, response) => {
    const manager = typeof ctx.get === "function" ? ctx.get("pluginManager") : undefined;
    if (!manager || typeof manager.removeBundle !== "function") {
      fail(response, 501, "当前 DSH 版本没有提供 pluginManager.removeBundle，无法在此卸载。");
      return;
    }
    sendJson(response, 200, { ok: true, pending: true, bundle: PLUGIN_PACKAGE });
    setTimeout(() => {
      Promise.resolve()
        .then(() => manager.removeBundle(PLUGIN_PACKAGE))
        .catch(() => {
          // the bundle is usually gone by the time this settles; failures are
          // reported by the plugin manager's own log
        });
    }, 250);
  });

  // -- daemon proxies ------------------------------------------------------
  const proxyGet = (pathname, buildPath) => {
    route("GET", pathname, async (request, response) => {
      const stack = await resolveStack();
      const params = query(request);
      const bank = firstString(params.get("bank")) || (await firstBank(stack.port));
      if (!bank) {
        fail(response, 400, "没有可用的 bank。");
        return;
      }
      const target = buildPath(bank, params);
      const data = await daemonJson(stack.port, target, { timeoutMs: 20000 });
      sendJson(response, 200, { ok: true, bank, data });
    });
  };

  route("GET", "/banks", async (request, response) => {
    const stack = await resolveStack();
    const data = await daemonJson(stack.port, "/v1/default/banks", { timeoutMs: 10000 });
    sendJson(response, 200, { ok: true, data });
  });

  proxyGet("/stats", (bank) => `/v1/default/banks/${encodeBank(bank)}/stats`);

  proxyGet("/memories", (bank, params) => {
    const search = new URLSearchParams();
    for (const key of ["type", "q", "state", "document_id", "entity_id", "consolidation_state", "start_date", "end_date"]) {
      const value = firstString(params.get(key));
      if (value !== "") search.set(key, value);
    }
    search.set("limit", String(pickPositiveInt(params, "limit", 20, 100)));
    search.set("offset", String(Math.max(0, Number(params.get("offset")) || 0)));
    return `/v1/default/banks/${encodeBank(bank)}/memories/list?${search.toString()}`;
  });

  proxyGet("/documents", (bank, params) => {
    const search = new URLSearchParams();
    const q = firstString(params.get("q"));
    if (q !== "") search.set("q", q);
    search.set("limit", String(pickPositiveInt(params, "limit", 20, 100)));
    search.set("offset", String(Math.max(0, Number(params.get("offset")) || 0)));
    return `/v1/default/banks/${encodeBank(bank)}/documents?${search.toString()}`;
  });

  proxyGet("/observations", (bank, params) => {
    const search = new URLSearchParams();
    search.set("limit", String(pickPositiveInt(params, "limit", 20, 100)));
    search.set("offset", String(Math.max(0, Number(params.get("offset")) || 0)));
    return `/v1/default/banks/${encodeBank(bank)}/observations/scopes?${search.toString()}`;
  });

  proxyGet("/llm-requests", (bank, params) => {
    const search = new URLSearchParams();
    for (const key of ["status", "operation", "scope", "call_type", "provider"]) {
      const value = firstString(params.get(key));
      if (value !== "") search.set(key, value);
    }
    search.set("limit", String(pickPositiveInt(params, "limit", 20, 100)));
    search.set("offset", String(Math.max(0, Number(params.get("offset")) || 0)));
    return `/v1/default/banks/${encodeBank(bank)}/llm-requests?${search.toString()}`;
  });

  proxyGet("/llm-requests/stats", (bank, params) => {
    const period = firstString(params.get("period")) || "7d";
    return `/v1/default/banks/${encodeBank(bank)}/llm-requests/stats?period=${encodeURIComponent(period)}`;
  });

  proxyGet("/timeseries", (bank, params) => {
    const period = firstString(params.get("period")) || "30d";
    return `/v1/default/banks/${encodeBank(bank)}/stats/memories-timeseries?period=${encodeURIComponent(period)}`;
  });

  // Diagnostics: the browser half reports its own boot failure here, so a
  // broken client bundle leaves a trace even though it never reaches the panel.
  route("POST", "/client-error", async (request, response) => {
    const body = await readJsonBody(request);
    const stage = body && body.stage ? String(body.stage) : "unknown-stage";
    const line = [
      `[${new Date().toISOString()}] ${stage}: ${body && body.message ? String(body.message) : "unknown client error"}`,
      body && body.stack ? String(body.stack) : "",
      "",
    ].join("\n");
    try {
      await fs.appendFile(path.join(hindsightHome(), "dsh-hindsight-panel-client-error.log"), line, "utf8");
    } catch {
      // best effort only
    }
    sendJson(response, 200, { ok: true });
  });

  proxyGet("/knowledge", (bank) => `/v1/default/banks/${encodeBank(bank)}/knowledge-base/tree`);

  proxyGet("/bank-config", (bank) => `/v1/default/banks/${encodeBank(bank)}/config`);

  route("POST", "/recall", async (request, response) => {
    const stack = await resolveStack();
    const body = await readJsonBody(request);
    if (body === null) {
      fail(response, 400, "请求体不是合法 JSON 对象。");
      return;
    }
    const question = typeof body.query === "string" ? body.query.trim() : "";
    if (question === "") {
      fail(response, 400, "query 不能为空。");
      return;
    }
    const bank = (typeof body.bank === "string" && body.bank.trim()) || (await firstBank(stack.port));
    if (!bank) {
      fail(response, 400, "没有可用的 bank。");
      return;
    }
    const limit = Number(body.limit) > 0 ? Math.min(Math.floor(Number(body.limit)), 50) : 12;
    const data = await daemonJson(stack.port, `/v1/default/banks/${encodeBank(bank)}/memories/recall`, {
      method: "POST",
      body: JSON.stringify({ query: question, limit }),
      timeoutMs: 120000,
    });
    sendJson(response, 200, { ok: true, bank, data });
  });

  // -- lifecycle -----------------------------------------------------------
  // The standalone daemon is not started by the desktop app itself, so the
  // first panel visit would otherwise land on a dead backend. Kick it once,
  // late enough to never slow the harness down, and stay silent on failure:
  // the panel retries the same path when it opens. Both the switch and the
  // delay are the user's call and live in the panel settings.
  readPanelSettings()
    .then((settings) => {
      cachedSettings = settings;
      if (!settings.autoStartDaemon) return;
      autoStartTimer = setTimeout(() => {
        ensureDaemonRunning().catch(() => {});
      }, settings.autoStartDelaySeconds * 1000);
      if (typeof autoStartTimer.unref === "function") autoStartTimer.unref();
    })
    .catch(() => {});
}

async function firstBank(port) {
  try {
    const data = await daemonJson(port, "/v1/default/banks", { timeoutMs: 8000 });
    const banks = data && Array.isArray(data.banks) ? data.banks : [];
    return banks.length > 0 ? banks[0].bank_id : null;
  } catch {
    return null;
  }
}
