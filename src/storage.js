import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { defaultDb, seedStatuses } from "./schema.js";
import { ensurePostgresSchema, postgresEnabled, readStateFromPostgres, saveStateToPostgres } from "./postgres.js";
import { withLifecycle } from "./lifecycle.js";
import { normalizeEnvironmentCluster, normalizeExtractionRun, normalizeProfileMemory, normalizeWorkflowCluster, normalizeWorkflowRecord } from "./memory_architecture.js";
import { normalizeModelPreferences } from "./model_preferences.js";

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
    sessions: (db.sessions || []).map((session) => withLifecycle(session, session.createdAt || session.updatedAt || new Date().toISOString())),
    activeSessionId: db.activeSessionId || null,
    processTraces: db.processTraces || [],
    memoryEvents: (db.memoryEvents || []).map((event) => withLifecycle({
      memoryType: event.memoryType || event.type || "conversation",
      ...event
    }, event.createdAt || event.timestamp || new Date().toISOString())),
    actionEvents: db.actionEvents || [],
    conversations: db.conversations || [],
    projects: (db.projects || []).map((project) => withLifecycle(project, project.createdAt || project.updatedAt || new Date().toISOString())),
    fileMemories: (db.fileMemories || []).map((file) => withLifecycle(file, file.createdAt || file.updatedAt || new Date().toISOString())),
    usageEvents: db.usageEvents || [],
    brainEvents: db.brainEvents || [],
    trainingSamples: db.trainingSamples || [],
    profileMemory: normalizeProfileMemory({ ...defaultDb.profileMemory, ...(db.profileMemory || {}) }),
    workflowRecords: (db.workflowRecords || []).map((record) => normalizeWorkflowRecord(record, record.createdAt || record.updatedAt || new Date().toISOString())),
    workflowClusters: (db.workflowClusters || []).map((cluster) => normalizeWorkflowCluster(cluster, cluster.createdAt || cluster.updatedAt || new Date().toISOString())),
    environmentClusters: (db.environmentClusters || []).map((cluster) => normalizeEnvironmentCluster(cluster, cluster.createdAt || cluster.updatedAt || new Date().toISOString())),
    memoryExtractionRuns: (db.memoryExtractionRuns || []).map((run) => normalizeExtractionRun(run, run.createdAt || run.updatedAt || new Date().toISOString())),
    memoryIndex: { ...defaultDb.memoryIndex, ...(db.memoryIndex || {}) },
    localWorkspace: {
      ...defaultDb.localWorkspace,
      ...(db.localWorkspace || {}),
      operationLog: db.localWorkspace?.operationLog || []
    },
    modelRouting: {
      ...defaultDb.modelRouting,
      ...(db.modelRouting || {}),
      callLog: db.modelRouting?.callLog || []
    },
    modelPreferences: normalizeModelPreferences({ ...defaultDb.modelPreferences, ...(db.modelPreferences || {}) }),
    workingMemory: { ...defaultDb.workingMemory, ...(db.workingMemory || {}) },
    modes: db.modes || [],
    actionCards: db.actionCards?.length ? db.actionCards : defaultDb.actionCards,
    alertLog: db.alertLog || [],
    settings: { ...defaultDb.settings, ...(db.settings || {}) }
  };

  normalized.reminders = normalized.reminders.map((reminder) => withLifecycle({
    kind: reminder.kind || (reminder.dueAt ? "deadline" : "status"),
    statusIds: reminder.statusIds || [],
    leadTimes: reminder.leadTimes || [],
    alerts: reminder.alerts || [],
    done: Boolean(reminder.done),
    ...reminder
  }, reminder.createdAt || new Date().toISOString()));

  if (!normalized.sessions.length) {
    const firstMessage = normalized.conversations[0];
    const lastMessage = normalized.conversations.at(-1);
    normalized.sessions.push({
      id: "default",
      title: "General Session",
      routeLabel: "general",
      projectId: null,
      summary: "",
      state: "active",
      messageCount: normalized.conversations.length,
      createdAt: firstMessage?.timestamp || new Date().toISOString(),
      updatedAt: lastMessage?.timestamp || new Date().toISOString(),
      lastMessageAt: lastMessage?.timestamp || null
    });
  }

  normalized.activeSessionId = normalized.activeSessionId || normalized.sessions[0]?.id || "default";
  normalized.conversations = normalized.conversations.map((message) => ({
    conversationId: normalized.activeSessionId,
    routeLabel: "general",
    projectId: null,
    ...message,
    conversationId: message.conversationId || normalized.activeSessionId
  }));

  return normalized;
}
