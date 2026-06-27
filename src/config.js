import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

loadDotEnv();

export const config = {
  root: process.cwd(),
  port: Number(process.env.PORT || 4387),
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.LUMA_DATABASE_SSL || "",
  accessCode: process.env.LUMA_ACCESS_CODE || "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  deepseekThinking: process.env.DEEPSEEK_THINKING || "disabled",
  brainProvider: process.env.LUMA_BRAIN_PROVIDER || "qwen",
  brainEndpoint: process.env.LUMA_BRAIN_ENDPOINT || "",
  brainApiKey: process.env.LUMA_BRAIN_API_KEY || "",
  brainModel: process.env.LUMA_BRAIN_MODEL || "qwen3.5:2b",
  brainMode: process.env.LUMA_BRAIN_MODE || "training",
  localWorkspaceRoot: process.env.LUMA_LOCAL_WORKSPACE || ""
};

config.publicDir = path.join(config.root, "public");
config.dataDir = path.join(config.root, "data");
config.dbPath = path.join(config.dataDir, "luma.json");
config.secretsPath = path.join(config.dataDir, "secrets.local.json");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
