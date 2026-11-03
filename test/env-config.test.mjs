import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEnvUpdates, llmUpdates, LLM_KEYS, maskSecret, parseEnv, readLlmConfig } from "../lib/env-config.js";

const TEMPLATE = [
  "# Hindsight Embed settings",
  "# HINDSIGHT_API_LLM_PROVIDER=openai",
  "HINDSIGHT_API_LLM_PROVIDER=deepseek",
  "HINDSIGHT_API_LLM_MODEL=deepseek-v4-flash",
  "HINDSIGHT_API_LLM_API_KEY=sk-abcdefghijklmnop",
  "HINDSIGHT_API_PORT=9077",
  "",
  "# HINDSIGHT_API_LLM_BASE_URL=",
  "HF_ENDPOINT=https://hf-mirror.com",
  "",
].join("\n");

test("parseEnv reads active assignments and skips comments/blanks", () => {
  const values = parseEnv(TEMPLATE);
  assert.equal(values.HINDSIGHT_API_LLM_PROVIDER, "deepseek");
  assert.equal(values.HINDSIGHT_API_LLM_MODEL, "deepseek-v4-flash");
  assert.equal(values.HF_ENDPOINT, "https://hf-mirror.com");
  assert.equal(values.HINDSIGHT_API_LLM_BASE_URL, undefined);
});

test("parseEnv strips matching quotes and lets later assignments win", () => {
  const values = parseEnv('A=1\nA="two words"\nB=\'single\'\n');
  assert.equal(values.A, "two words");
  assert.equal(values.B, "single");
});

test("readLlmConfig maps env keys and normalises the port", () => {
  const llm = readLlmConfig(TEMPLATE);
  assert.equal(llm.provider, "deepseek");
  assert.equal(llm.model, "deepseek-v4-flash");
  assert.equal(llm.apiKey, "sk-abcdefghijklmnop");
  assert.equal(llm.port, 9077);
  assert.equal(llm.baseURL, "");
  assert.equal(llm.reasoningEffort, "");
});

test("readLlmConfig returns null port when the value is not a positive number", () => {
  assert.equal(readLlmConfig("HINDSIGHT_API_PORT=0\n").port, null);
  assert.equal(readLlmConfig("HINDSIGHT_API_PORT=not-a-port\n").port, null);
});

test("maskSecret keeps a short prefix and suffix", () => {
  const masked = maskSecret("sk-abcdefghijklmnop");
  assert.equal(masked.startsWith("sk-ab"), true);
  assert.equal(masked.endsWith("mnop"), true);
  assert.equal(masked.includes("cdefgh"), false);
  assert.equal(maskSecret(""), "");
  assert.equal(maskSecret("short"), "*****");
});

test("applyEnvUpdates rewrites only the active lines and keeps comments", () => {
  const next = applyEnvUpdates(TEMPLATE, {
    [LLM_KEYS.model]: "deepseek-v4-pro",
    [LLM_KEYS.reasoningEffort]: "high",
  });
  assert.match(next, /^HINDSIGHT_API_LLM_MODEL=deepseek-v4-pro$/m);
  assert.equal(next.includes("HINDSIGHT_API_LLM_MODEL=deepseek-v4-flash"), false);
  // template comments untouched
  assert.equal(next.includes("# HINDSIGHT_API_LLM_PROVIDER=openai"), true);
  assert.equal(next.includes("# Hindsight Embed settings"), true);
  // missing key appended in the trailing block
  assert.match(next, /# Added by dsh-hindsight-panel\nHINDSIGHT_API_LLM_REASONING_EFFORT=high/);
});

test("applyEnvUpdates activates a commented-out template key in place", () => {
  const next = applyEnvUpdates(TEMPLATE, { [LLM_KEYS.baseURL]: "http://localhost:11434/v1" });
  assert.match(next, /^HINDSIGHT_API_LLM_BASE_URL=http:\/\/localhost:11434\/v1$/m);
  assert.equal(next.includes("# HINDSIGHT_API_LLM_BASE_URL="), false);
  // nothing was appended to the bottom
  assert.equal(next.includes("# Added by dsh-hindsight-panel"), false);
});

test("applyEnvUpdates quotes values that contain whitespace", () => {
  const next = applyEnvUpdates(TEMPLATE, { [LLM_KEYS.model]: "my model" });
  assert.match(next, /^HINDSIGHT_API_LLM_MODEL="my model"$/m);
});

test("applyEnvUpdates comments out a key when the value is null", () => {
  const next = applyEnvUpdates(TEMPLATE, { [LLM_KEYS.apiKey]: null });
  assert.equal(next.includes("\nHINDSIGHT_API_LLM_API_KEY=sk-"), false);
  assert.match(next, /^# HINDSIGHT_API_LLM_API_KEY=sk-abcdefghijklmnop$/m);
});

test("applyEnvUpdates leaves the text untouched when there is nothing to update", () => {
  assert.equal(applyEnvUpdates(TEMPLATE, {}), TEMPLATE);
  assert.equal(applyEnvUpdates(TEMPLATE, { [LLM_KEYS.model]: undefined }), TEMPLATE);
});

test("applyEnvUpdates keeps CRLF line endings", () => {
  const crlf = TEMPLATE.replace(/\n/g, "\r\n");
  const next = applyEnvUpdates(crlf, { [LLM_KEYS.model]: "deepseek-v4-pro" });
  assert.equal(next.includes("\r\n"), true);
  assert.equal(next.replace(/\r\n/g, "").includes("\n"), false);
});

test("llmUpdates clears base URL and API key when the new value is empty", () => {
  const updates = llmUpdates({ provider: "deepseek", model: "deepseek-v4-pro", baseURL: "", apiKey: "", port: 0 });
  assert.equal(updates[LLM_KEYS.provider], "deepseek");
  assert.equal(updates[LLM_KEYS.model], "deepseek-v4-pro");
  assert.equal(updates[LLM_KEYS.baseURL], null);
  assert.equal(updates[LLM_KEYS.apiKey], null);
  assert.equal(updates[LLM_KEYS.port], null);
});

test("llmUpdates ignores fields that were not provided", () => {
  const updates = llmUpdates({ provider: "deepseek" });
  assert.deepEqual(Object.keys(updates), [LLM_KEYS.provider]);
});
