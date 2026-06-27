import crypto from "node:crypto";

const providerTypes = new Set(["openai_compatible", "deepseek", "local", "custom"]);
const routingModes = new Set(["manual", "compare", "review", "auto"]);

export function normalizeProvider(provider = {}) {
  const id = slug(provider.id || provider.label || crypto.randomUUID());
  return {
    id,
    label: String(provider.label || id).trim(),
    type: providerTypes.has(provider.type) ? provider.type : "openai_compatible",
    baseUrl: String(provider.baseUrl || "").trim().replace(/\/$/, ""),
    model: String(provider.model || "").trim(),
    enabled: Boolean(provider.enabled),
    roles: normalizeRoles(provider.roles),
    apiKey: provider.apiKey,
    hasApiKey: Boolean(provider.apiKey || provider.hasApiKey),
    createdAt: provider.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function publicProvider(provider = {}) {
  const normalized = normalizeProvider(provider);
  return {
    id: normalized.id,
    label: normalized.label,
    type: normalized.type,
    baseUrl: normalized.baseUrl,
    model: normalized.model,
    enabled: normalized.enabled && normalized.hasApiKey,
    hasApiKey: normalized.hasApiKey,
    roles: normalized.roles,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export function upsertProvider(secrets, body = {}) {
  const providers = Array.isArray(secrets.llmProviders) ? [...secrets.llmProviders] : [];
  const next = normalizeProvider(body);
  const existing = providers.findIndex((provider) => provider.id === next.id);
  if (existing >= 0) {
    const previous = providers[existing];
    providers[existing] = normalizeProvider({
      ...previous,
      ...next,
      apiKey: next.apiKey || previous.apiKey,
      hasApiKey: Boolean(next.apiKey || previous.apiKey || previous.hasApiKey)
    });
  } else {
    providers.push(next);
  }
  return providers;
}

export function deleteProvider(secrets, id) {
  return (secrets.llmProviders || []).filter((provider) => provider.id !== id);
}

export function normalizeRouting(db, body = {}) {
  db.modelRouting = db.modelRouting || {};
  const mode = routingModes.has(body.mode) ? body.mode : db.modelRouting.mode || "manual";
  return {
    ...db.modelRouting,
    mode,
    selectedProviderId: body.selectedProviderId || db.modelRouting.selectedProviderId || "deepseek",
    compareProviderIds: Array.isArray(body.compareProviderIds) ? body.compareProviderIds : db.modelRouting.compareProviderIds || ["deepseek"],
    reviewProviderIds: Array.isArray(body.reviewProviderIds) ? body.reviewProviderIds : db.modelRouting.reviewProviderIds || [],
    callLog: db.modelRouting.callLog || []
  };
}

export function routingState(db, secrets) {
  const sourceProviders = Array.isArray(secrets?.llmProviders) && secrets.llmProviders.length
    ? secrets.llmProviders
    : [{
      id: "deepseek",
      label: "DeepSeek",
      type: "openai_compatible",
      baseUrl: "https://api.deepseek.com",
      model: secrets?.deepseekModel || "deepseek-v4-flash",
      enabled: Boolean(secrets?.deepseekApiKey),
      hasApiKey: Boolean(secrets?.deepseekApiKey),
      roles: ["answerer", "reviewer", "summarizer"]
    }];
  const providers = sourceProviders.map(publicProvider);
  return {
    ...(db.modelRouting || {}),
    providers,
    modes: [...routingModes],
    roles: ["answerer", "reviewer", "summarizer", "planner", "coder", "vision", "local_brain"]
  };
}

function normalizeRoles(roles) {
  const values = Array.isArray(roles) ? roles : String(roles || "answerer").split(",");
  return [...new Set(values.map((role) => String(role).trim()).filter(Boolean))];
}

function slug(value) {
  return String(value || "provider")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || crypto.randomUUID();
}
