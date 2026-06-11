import crypto from "node:crypto";
import { isVisible, softDeleteRecord, withLifecycle } from "./lifecycle.js";

export const workflowClusterDefaults = {
  enabled: false,
  retrieveByDefault: false,
  writeDraftOnly: true
};

export function normalizeProfileMemory(profileMemory = {}) {
  const now = new Date().toISOString();
  return {
    provider: profileMemory.provider || "profile-memory-v0",
    enabled: profileMemory.enabled !== false,
    promptEnabled: profileMemory.promptEnabled !== false,
    items: (profileMemory.items || []).map((item) => normalizeProfileItem(item, now)),
    rules: {
      injectActive: profileMemory.rules?.injectActive !== false,
      minPromptConfidence: Number(profileMemory.rules?.minPromptConfidence ?? 0.75),
      rawMemoryOptIn: profileMemory.rules?.rawMemoryOptIn !== false
    },
    updatedAt: profileMemory.updatedAt || null
  };
}

export function normalizeProfileItem(item, now = new Date().toISOString()) {
  return withLifecycle({
    id: item.id || crypto.randomUUID(),
    type: item.type || "communication_style",
    statement: String(item.statement || "").trim(),
    evidenceSummary: String(item.evidenceSummary || item.reason || "").trim(),
    confidence: clamp01(item.confidence ?? 0.5),
    sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds : [],
    scope: item.scope || "global",
    ...item
  }, item.createdAt || now);
}

export function activeProfileItems(db, { limit = 8, scope = "global" } = {}) {
  const profile = normalizeProfileMemory(db.profileMemory);
  const min = profile.rules.minPromptConfidence;
  if (!profile.enabled || !profile.promptEnabled || !profile.rules.injectActive) return [];
  return profile.items
    .filter(isVisible)
    .filter((item) => item.state === "active" && Number(item.confidence || 0) >= min)
    .filter((item) => profileScopeMatches(item.scope, scope))
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
    .slice(0, limit);
}

export function profilePromptBlock(db, { scope = "global", limit = 8 } = {}) {
  const items = activeProfileItems(db, { scope, limit });
  if (!items.length) return "No active profile memory.";
  return JSON.stringify(items.map(({ type, statement, confidence, scope }) => ({ type, statement, confidence, scope })));
}

export function normalizeWorkflowRecord(record, now = new Date().toISOString()) {
  return withLifecycle({
    id: record.id || crypto.randomUUID(),
    title: record.title || "Untitled workflow",
    taskDomain: record.taskDomain || "general",
    subCluster: record.subCluster || null,
    environmentCluster: record.environmentCluster || null,
    inputSummary: record.inputSummary || "",
    workflow: {
      steps: record.workflow?.steps || [],
      toolsUsed: record.workflow?.toolsUsed || [],
      decisionPoints: record.workflow?.decisionPoints || [],
      failureModes: record.workflow?.failureModes || []
    },
    outputSummary: record.outputSummary || "",
    qualitySignals: {
      userAccepted: record.qualitySignals?.userAccepted ?? null,
      revisionCount: Number(record.qualitySignals?.revisionCount || 0),
      successScore: clamp01(record.qualitySignals?.successScore ?? 0.5),
      preferenceAlignment: clamp01(record.qualitySignals?.preferenceAlignment ?? 0.5)
    },
    clusterState: record.clusterState || "draft",
    ...record
  }, record.createdAt || now);
}

export function normalizeWorkflowCluster(cluster, now = new Date().toISOString()) {
  return withLifecycle({
    id: cluster.id || crypto.randomUUID(),
    domain: cluster.domain || "general",
    label: cluster.label || "General workflow",
    description: cluster.description || "",
    workflowRecordIds: Array.isArray(cluster.workflowRecordIds) ? cluster.workflowRecordIds : [],
    density: Number(cluster.density || 0),
    confidence: clamp01(cluster.confidence ?? 0.3),
    enabled: false,
    ...cluster
  }, cluster.createdAt || now);
}

export function normalizeEnvironmentCluster(cluster, now = new Date().toISOString()) {
  return withLifecycle({
    id: cluster.id || crypto.randomUUID(),
    label: cluster.label || "general_environment",
    description: cluster.description || "",
    signals: Array.isArray(cluster.signals) ? cluster.signals : [],
    confidence: clamp01(cluster.confidence ?? 0.3),
    activeScore: clamp01(cluster.activeScore ?? 0),
    decay: clamp01(cluster.decay ?? 0.92),
    lastObservedAt: cluster.lastObservedAt || null,
    enabled: false,
    ...cluster
  }, cluster.createdAt || now);
}

export function normalizeExtractionRun(run, now = new Date().toISOString()) {
  return withLifecycle({
    id: run.id || crypto.randomUUID(),
    source: run.source || "manual",
    sourceIds: Array.isArray(run.sourceIds) ? run.sourceIds : [],
    model: run.model || "unknown",
    status: run.status || "completed",
    profileCandidates: run.profileCandidates || [],
    workflowCandidates: run.workflowCandidates || [],
    environmentCandidates: run.environmentCandidates || [],
    error: run.error || null,
    ...run
  }, run.createdAt || now);
}

export function applyMemoryExtraction(db, extraction) {
  const now = new Date().toISOString();
  db.profileMemory = normalizeProfileMemory(db.profileMemory);
  db.workflowRecords = db.workflowRecords || [];
  db.workflowClusters = db.workflowClusters || [];
  db.environmentClusters = db.environmentClusters || [];
  db.memoryExtractionRuns = db.memoryExtractionRuns || [];

  const run = normalizeExtractionRun({ ...extraction, createdAt: now }, now);
  for (const candidate of run.profileCandidates || []) {
    const item = normalizeProfileItem({
      ...candidate,
      state: Number(candidate.confidence || 0) >= 0.8 ? "active" : "needs_review"
    }, now);
    if (item.statement && !profileStatementExists(db.profileMemory.items, item.statement)) {
      db.profileMemory.items.push(item);
    }
  }

  for (const candidate of run.workflowCandidates || []) {
    db.workflowRecords.push(normalizeWorkflowRecord({
      ...candidate,
      clusterState: "draft"
    }, now));
  }

  for (const candidate of run.environmentCandidates || []) {
    const cluster = normalizeEnvironmentCluster({
      ...candidate,
      state: Number(candidate.confidence || 0) >= 0.75 ? "active" : "needs_review"
    }, now);
    if (cluster.label && !environmentLabelExists(db.environmentClusters, cluster.label)) {
      db.environmentClusters.push(cluster);
    }
  }

  db.profileMemory.updatedAt = now;
  db.memoryExtractionRuns.push(run);
  return run;
}

export function softDeleteWorkflowRecord(db, id) {
  const record = (db.workflowRecords || []).find((item) => item.id === id);
  return softDeleteRecord(record);
}

function profileStatementExists(items, statement) {
  const normalized = normalizeText(statement);
  return (items || []).some((item) => normalizeText(item.statement) === normalized && isVisible(item));
}

function environmentLabelExists(items, label) {
  const normalized = normalizeText(label);
  return (items || []).some((item) => normalizeText(item.label) === normalized && isVisible(item));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function profileScopeMatches(itemScope = "global", activeScope = "global") {
  const normalizedItemScope = normalizeText(itemScope || "global");
  const normalizedActiveScope = normalizeText(activeScope || "global");
  return normalizedItemScope === "global" || normalizedItemScope === normalizedActiveScope;
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}
