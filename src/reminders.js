import crypto from "node:crypto";
import { isVisible, softDeleteRecord, withLifecycle } from "./lifecycle.js";

export function createReminder(db, body) {
  const text = String(body.text || "").trim();
  if (!text) throw new Error("Reminder text is required.");

  const kind = body.kind === "deadline" ? "deadline" : "status";
  const statusIds = body.statusIds?.length ? body.statusIds : db.activeStatusId ? [db.activeStatusId] : [];
  const now = new Date().toISOString();
  const reminder = withLifecycle({
    id: crypto.randomUUID(),
    kind,
    text,
    statusIds,
    createdAt: now,
    done: false
  }, now);

  if (kind === "deadline") {
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (!dueAt || Number.isNaN(dueAt.valueOf())) throw new Error("Deadline reminders need a valid due time.");
    const leadTimes = normalizeLeadTimes(body.leadTimes);
    Object.assign(reminder, {
      dueAt: dueAt.toISOString(),
      leadTimes,
      alerts: leadTimes.map((minutesBefore) => ({
        id: crypto.randomUUID(),
        minutesBefore,
        fireAt: new Date(dueAt.getTime() - minutesBefore * 60000).toISOString(),
        firedAt: null
      }))
    });
  } else {
    const frequency = body.frequency || "every_status_enter";
    Object.assign(reminder, {
      frequency,
      expiresAt: frequency === "for_next_days" ? new Date(Date.now() + Number(body.days || 3) * 86400000).toISOString() : null
    });
  }

  db.reminders.push(reminder);
  return reminder;
}

export function updateReminder(db, id, patch) {
  const reminder = db.reminders.find((item) => item.id === id);
  if (!reminder) throw new Error("Reminder not found.");
  Object.assign(reminder, patch);
  if (patch.done) reminder.completedAt = new Date().toISOString();
  if (patch.seen) reminder.seenAt = new Date().toISOString();
  return reminder;
}

export function deleteReminder(db, id) {
  const reminder = db.reminders.find((item) => item.id === id);
  return softDeleteRecord(reminder);
}

export function activeReminders(db) {
  return db.reminders.filter(isVisible).filter((reminder) => isReminderActive(reminder, db.activeStatusId));
}

export function dueAlerts(db) {
  const now = Date.now();
  const due = [];
  for (const reminder of db.reminders.filter(isVisible)) {
    if (reminder.kind !== "deadline" || reminder.done) continue;
    for (const alert of reminder.alerts || []) {
      if (!alert.firedAt && new Date(alert.fireAt).getTime() <= now) {
        due.push({
          reminderId: reminder.id,
          alertId: alert.id,
          text: reminder.text,
          dueAt: reminder.dueAt,
          minutesBefore: alert.minutesBefore,
          fireAt: alert.fireAt
        });
      }
    }
  }
  return due.sort((a, b) => new Date(a.fireAt) - new Date(b.fireAt));
}

export function markAlertFired(db, reminderId, alertId) {
  const reminder = db.reminders.find((item) => item.id === reminderId);
  const alert = reminder?.alerts?.find((item) => item.id === alertId);
  if (!alert) throw new Error("Alert not found.");
  alert.firedAt = new Date().toISOString();
  db.alertLog.push({ reminderId, alertId, firedAt: alert.firedAt });
  return alert;
}

function isReminderActive(reminder, activeStatusId) {
  if (reminder.done) return false;
  if (reminder.kind === "deadline") {
    return !reminder.statusIds?.length || reminder.statusIds.includes(activeStatusId);
  }
  if (!reminder.statusIds?.includes(activeStatusId)) return false;
  const now = new Date();
  if (reminder.frequency === "once") return !reminder.seenAt;
  if (reminder.frequency === "for_next_days") return reminder.expiresAt ? new Date(reminder.expiresAt) >= now : true;
  if (reminder.frequency === "daily_until_done") return true;
  if (reminder.frequency === "manual_only") return true;
  return reminder.frequency === "every_status_enter";
}

function normalizeLeadTimes(value) {
  const raw = Array.isArray(value) ? value : [30, 20, 10];
  const leadTimes = raw.map(Number).filter((item) => Number.isFinite(item) && item >= 0);
  return [...new Set(leadTimes.length ? leadTimes : [30, 20, 10])].sort((a, b) => b - a);
}
