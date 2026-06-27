import crypto from "node:crypto";
import { isVisible, withLifecycle } from "./lifecycle.js";

const negativeSignals = new Set(["too_vague", "too_long", "wrong_direction", "incorrect"]);

export function normalizeModelPreferences(value = {}) {
  return {
    feedbackLog: (value.feedbackLog || []).map((item) => withLifecycle(item, item.createdAt || item.updatedAt || new Date().toISOString())),
    stablePreferences: (value.stablePreferences || []).map((item) => withLifecycle(item, item.createdAt || item.updatedAt || new Date().toISOString()))
  };
}

export function modelPreferenceSummary(db) {
  const prefs = normalizeModelPreferences(db.modelPreferences);
  const feedbackLog = prefs.feedbackLog.filter(isVisible);
  const stablePreferences = prefs.stablePreferences.filter(isVisible);
  const providerScores = {};
  for (const item of feedbackLog) {
    if (!item.providerId) continue;
    providerScores[item.providerId] = providerScores[item.providerId] || { providerId: item.providerId, positive: 0, negative: 0 };
    providerScores[item.providerId][item.polarity === "negative" ? "negative" : "positive"] += 1;
  }
  return {
    feedbackCount: feedbackLog.length,
    stablePreferences,
    providerScores: Object.values(providerScores)
  };
}

export function recordModelPreference(db, body = {}) {
  db.modelPreferences = normalizeModelPreferences(db.modelPreferences);
  const now = new Date().toISOString();
  const signal = String(body.signal || "use_this").trim() || "use_this";
  const record = withLifecycle({
    id: crypto.randomUUID(),
    comparisonId: body.comparisonId || null,
    messageId: body.messageId || null,
    sessionId: body.sessionId || db.activeSessionId || null,
    taskType: body.taskType || "general",
    providerId: body.providerId || "unknown",
    model: body.model || "",
    signal,
    polarity: negativeSignals.has(signal) ? "negative" : "positive",
    reason: body.reason || "",
    remember: body.remember !== false,
    createdAt: now,
    updatedAt: now
  }, now);
  db.modelPreferences.feedbackLog.push(record);
  db.modelPreferences.feedbackLog = db.modelPreferences.feedbackLog.slice(-300);
  if (record.remember && record.polarity === "positive") upsertStablePreference(db.modelPreferences, record);
  return record;
}

function upsertStablePreference(modelPreferences, record) {
  const key = `${record.taskType}:${record.providerId}:${record.signal}`;
  const existing = modelPreferences.stablePreferences.find((item) => item.key === key && isVisible(item));
  const now = new Date().toISOString();
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.updatedAt = now;
    existing.confidence = Math.min(0.95, Number(existing.confidence || 0.62) + 0.04);
    return existing;
  }
  const preference = withLifecycle({
    id: crypto.randomUUID(),
    key,
    type: "model_selection",
    taskType: record.taskType,
    providerId: record.providerId,
    model: record.model,
    signal: record.signal,
    statement: `Prefer ${record.providerId} for ${record.taskType} when signal is ${record.signal}.`,
    confidence: 0.62,
    count: 1,
    createdAt: now,
    updatedAt: now
  }, now);
  modelPreferences.stablePreferences.push(preference);
  modelPreferences.stablePreferences = modelPreferences.stablePreferences.slice(-80);
  return preference;
}
