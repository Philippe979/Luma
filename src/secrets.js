import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "./config.js";

const defaultSecrets = {
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  deepseekThinking: "disabled",
  llmProviders: [
    {
      id: "deepseek",
      label: "DeepSeek",
      type: "openai_compatible",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      enabled: false,
      roles: ["answerer", "reviewer", "summarizer"]
    }
  ]
};

export async function readSecrets() {
  if (config.deepseekApiKey) {
    return {
      deepseekApiKey: config.deepseekApiKey,
      deepseekModel: config.deepseekModel,
      deepseekThinking: config.deepseekThinking,
      llmProviders: defaultSecrets.llmProviders.map((provider) => ({
        ...provider,
        enabled: true,
        model: config.deepseekModel,
        hasApiKey: true
      }))
    };
  }
  await mkdir(config.dataDir, { recursive: true });
  if (!existsSync(config.secretsPath)) return { ...defaultSecrets };
  const raw = await readFile(config.secretsPath, "utf8");
  return { ...defaultSecrets, ...JSON.parse(raw) };
}

export async function saveSecrets(patch) {
  const current = await readSecrets();
  const next = {
    ...current,
    ...patch
  };
  await writeFile(config.secretsPath, JSON.stringify(next, null, 2));
  return next;
}

export function publicLlmState(secrets) {
  const providers = normalizePublicProviders(secrets);
  return {
    provider: "deepseek",
    enabled: Boolean(secrets.deepseekApiKey),
    model: secrets.deepseekModel || defaultSecrets.deepseekModel,
    thinking: secrets.deepseekThinking || defaultSecrets.deepseekThinking,
    providers
  };
}

export function normalizePublicProviders(secrets) {
  const providers = Array.isArray(secrets.llmProviders) && secrets.llmProviders.length
    ? secrets.llmProviders
    : defaultSecrets.llmProviders;
  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label || provider.id,
    type: provider.type || "openai_compatible",
    baseUrl: provider.baseUrl || "",
    model: provider.model || "",
    enabled: Boolean(provider.enabled && (provider.apiKey || provider.hasApiKey || provider.id === "deepseek" && secrets.deepseekApiKey)),
    hasApiKey: Boolean(provider.apiKey || provider.hasApiKey || provider.id === "deepseek" && secrets.deepseekApiKey),
    roles: Array.isArray(provider.roles) ? provider.roles : []
  }));
}
