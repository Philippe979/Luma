import crypto from "node:crypto";
import { nowFeatures } from "./time.js";
import { activeReminders } from "./reminders.js";

export function activeStatus(db) {
  return db.statuses.find((item) => item.id === db.activeStatusId) || null;
}

export function updateStatus(db, body) {
  let status = db.statuses.find((item) => item.id === body.statusId);
  let created = false;

  if (!status && body.label) {
    status = {
      id: slugify(body.label),
      label: String(body.label).trim(),
      builtin: false,
      group: "custom",
      attention: "normal"
    };
    db.statuses.push(status);
    created = true;
  }

  if (!status) throw new Error("Missing statusId or label.");

  const features = nowFeatures(db);
  db.activeStatusId = status.id;
  db.history.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: "manual",
    selectedStatusId: status.id,
    features
  });

  return {
    status,
    created,
    receipt: statusReceipt(db, status, features)
  };
}

export function predictStatus(db) {
  const features = nowFeatures(db);
  const candidates = db.statuses
    .map((status) => ({ status, score: scoreStatus(status, db.history, features) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const topScore = candidates[0]?.score || 0;

  return {
    features,
    suggestions: candidates.map(({ status, score }) => ({
      id: status.id,
      label: status.label,
      confidence: Math.min(0.96, Number((score / Math.max(topScore, 1)).toFixed(2)))
    }))
  };
}

export function statusReceipt(db, status = activeStatus(db), features = nowFeatures(db)) {
  const reminders = activeReminders(db);
  return {
    statusLabel: status?.label || "Unknown",
    statusId: status?.id || null,
    time: `${features.displayTime} · ${features.weekdayLabel} · ${features.hourBucket}`,
    weather: weatherLine(db),
    location: db.context.locationTag || "unknown",
    reminderCount: reminders.length,
    sampleCount: db.history.length,
    savedAt: new Date().toISOString()
  };
}

function scoreStatus(status, history, features) {
  let score = status.builtin ? 0.08 : 0.03;
  const recent = history.slice(-120);
  for (const item of recent) {
    if (item.selectedStatusId !== status.id) continue;
    const f = item.features || {};
    if (f.hourBucket === features.hourBucket) score += 0.4;
    if (f.weekday === features.weekday) score += 0.18;
    if (f.isWeekend === features.isWeekend) score += 0.1;
    if (f.locationTag && f.locationTag === features.locationTag) score += 0.22;
    if (f.weather && f.weather === features.weather) score += 0.08;
  }
  return score;
}

function weatherLine(db) {
  const weather = db.context.weather || "unknown";
  if (typeof db.context.temperature === "number") return `${weather} · ${db.context.temperature}°C`;
  return weather;
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
}
