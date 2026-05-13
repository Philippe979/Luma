import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { defaultDb, seedStatuses } from "./schema.js";
import { ensurePostgresSchema, postgresEnabled, readStateFromPostgres, saveStateToPostgres } from "./postgres.js";

export async function ensureDb() {
  if (postgresEnabled()) {
    await ensurePostgresSchema();
    const remote = await readStateFromPostgres();
    if (!remote) await saveDb(defaultDb);
    return;
  }
  await mkdir(config.dataDir, { recursive: true });
  if (!existsSync(config.dbPath)) {
    await saveDb(defaultDb);
  }
}

export async function readDb() {
  await ensureDb();
  if (postgresEnabled()) {
    const remote = await readStateFromPostgres();
    return normalizeDb(remote || defaultDb);
  }
  const raw = await readFile(config.dbPath, "utf8");
  return normalizeDb(JSON.parse(raw));
}

export async function saveDb(db) {
  if (postgresEnabled()) {
    await saveStateToPostgres(normalizeDb(db));
    return;
  }
  await writeFile(config.dbPath, JSON.stringify(normalizeDb(db), null, 2));
}

function normalizeDb(db) {
  const normalized = {
    ...defaultDb,
    ...db,
    context: { ...defaultDb.context, ...(db.context || {}) },
    places: db.places || [],
    statuses: db.statuses?.length ? db.statuses : seedStatuses,
    reminders: db.reminders || [],
    history: db.history || [],
    memoryEvents: db.memoryEvents || [],
    actionEvents: db.actionEvents || [],
    conversations: db.conversations || [],
    projects: db.projects || [],
    usageEvents: db.usageEvents || [],
    brainEvents: db.brainEvents || [],
    trainingSamples: db.trainingSamples || [],
    workingMemory: { ...defaultDb.workingMemory, ...(db.workingMemory || {}) },
    modes: db.modes || [],
    actionCards: db.actionCards?.length ? db.actionCards : defaultDb.actionCards,
    alertLog: db.alertLog || [],
    settings: { ...defaultDb.settings, ...(db.settings || {}) }
  };

  normalized.reminders = normalized.reminders.map((reminder) => ({
    kind: reminder.kind || (reminder.dueAt ? "deadline" : "status"),
    statusIds: reminder.statusIds || [],
    leadTimes: reminder.leadTimes || [],
    alerts: reminder.alerts || [],
    done: Boolean(reminder.done),
    ...reminder
  }));

  return normalized;
}
