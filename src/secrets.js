import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "./config.js";

const defaultSecrets = {
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  deepseekThinking: "disabled"
};

export async function readSecrets() {
  if (config.deepseekApiKey) {
    return {
      deepseekApiKey: config.deepseekApiKey,
      deepseekModel: config.deepseekModel,
      deepseekThinking: config.deepseekThinking
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
  return {
    provider: "deepseek",
    enabled: Boolean(secrets.deepseekApiKey),
    model: secrets.deepseekModel || defaultSecrets.deepseekModel,
    thinking: secrets.deepseekThinking || defaultSecrets.deepseekThinking
  };
}
