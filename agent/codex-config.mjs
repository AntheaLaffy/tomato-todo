import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
export const codexAuthPath = join(codexHome, "auth.json");
export const codexConfigPath = join(codexHome, "config.toml");

// Codex CLI intentionally keeps this file small and TOML-like. This parser only
// handles the provider fields documented by Codex, while ignoring unrelated
// project/UI settings instead of trying to interpret arbitrary TOML.
function scalar(value) {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  if (text === "true") return true;
  if (text === "false") return false;
  const number = Number(text);
  return Number.isNaN(number) ? text : number;
}
export function parseCodexConfig(text) {
  const result = { providers: {}, model: undefined, modelProvider: undefined };
  let section = "";
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line) continue;
    const heading = line.match(/^\[model_providers\.([^\]]+)\]$/);
    if (heading) { section = heading[1]; result.providers[section] ||= {}; continue; }
    if (line.startsWith("[")) { section = ""; continue; }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = scalar(rawValue);
    if (section) result.providers[section][key] = value;
    else if (key === "model") result.model = value;
    else if (key === "model_provider") result.modelProvider = value;
  }
  return result;
}
export async function readCodexConfig() {
  try { return parseCodexConfig(await readFile(codexConfigPath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { providers: {} }; throw error; }
}

function jwtExpiry(token) {
  try { const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); return Number(payload.exp) * 1000; }
  catch { return 0; }
}
export function normalizeCodexCredential(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  if (raw.type === "oauth" && raw.access && raw.refresh) return { ...raw, accountId: raw.accountId ?? raw.account_id };
  const tokens = raw.tokens && typeof raw.tokens === "object" ? raw.tokens : raw;
  const access = tokens.access_token ?? tokens.access;
  const refresh = tokens.refresh_token ?? tokens.refresh;
  if (!access || !refresh) return undefined;
  const expires = Number(tokens.expires ?? tokens.expires_at ?? raw.expires ?? 0) || jwtExpiry(access);
  return { type: "oauth", access, refresh, expires, accountId: tokens.account_id ?? tokens.accountId ?? raw.account_id ?? raw.accountId };
}
export function codexAuthDocument(credential, previous = {}) {
  const tokens = {
    ...(previous.tokens && typeof previous.tokens === "object" ? previous.tokens : {}),
    access_token: credential.access,
    refresh_token: credential.refresh,
    account_id: credential.accountId,
    expires: credential.expires,
  };
  return { ...previous, tokens, last_refresh: new Date().toISOString() };
}

/** Return config providers in the ModelRuntime registration shape. */
export function codexProviderConfigs(config) {
  return Object.entries(config?.providers ?? {}).filter(([id]) => id === config.modelProvider && typeof config.model === "string" && config.model.length > 0).map(([id, value]) => {
    const api = value.wire_api === "responses" ? "openai-responses" : "openai-completions";
    const model = config.model;
    const env = value.env_key || value.api_key_env;
    const apiKey = value.experimental_bearer_token || (env ? `$${env}` : undefined);
    return { id, name: value.name || id, baseUrl: value.base_url, api, apiKey,
      models: [{ id: model, name: model, reasoning: true, input: ["text"] }] };
  });
}
