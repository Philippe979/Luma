import crypto from "node:crypto";
import { nowFeatures } from "./time.js";

export function addConversationMessage(db, { role, content, source = "chat", conversationId = "default" }) {
  const message = {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    source,
    timestamp: new Date().toISOString()
  };
  db.conversations.push(message);
  return message;
}

export function addMemoryEvent(db, { type, summary, source = "chat", userText = "", actions = [], metadata = {} }) {
  const event = {
    id: crypto.randomUUID(),
    type,
    summary,
    source,
    userText,
    actions,
    metadata,
    context: nowFeatures(db),
    statusId: db.activeStatusId || null,
    timestamp: new Date().toISOString()
  };
  db.memoryEvents.push(event);
  return event;
}

export function addActionEvent(db, { tool, args = {}, result = {}, source = "chat", confirmedByUser = true }) {
  const event = {
    id: crypto.randomUUID(),
    tool,
    args,
    result,
    source,
    confirmedByUser,
    context: nowFeatures(db),
    statusId: db.activeStatusId || null,
    timestamp: new Date().toISOString()
  };
  db.actionEvents.push(event);
  return event;
}

export function updateWorkingMemory(db, patch) {
  db.workingMemory = {
    ...(db.workingMemory || {}),
    ...patch,
    updatedAt: new Date().toISOString()
  };
  return db.workingMemory;
}

export function upsertProject(db, { project, progress = "", nextStep = null, state = "active" }) {
  const id = slug(project);
  const existing = (db.projects || []).find((item) => item.id === id);
  const now = new Date().toISOString();
  const entry = {
    id,
    name: project,
    state,
    currentProgress: progress || existing?.currentProgress || "",
    nextStep: nextStep ?? existing?.nextStep ?? null,
    updatedAt: now,
    createdAt: existing?.createdAt || now,
    history: [
      ...(existing?.history || []),
      {
        progress,
        nextStep,
        state,
        timestamp: now
      }
    ].filter((item) => item.progress || item.nextStep || item.state)
  };

  if (existing) Object.assign(existing, entry);
  else db.projects.push(entry);

  updateWorkingMemory(db, {
    activeProject: state === "done" ? null : project,
    lastProgress: progress || null,
    nextStep
  });

  return entry;
}

export function recentMemory(db, limit = 6) {
  return [...(db.memoryEvents || [])].slice(-limit).reverse();
}

export function suggestedActions(db) {
  const suggestions = [];
  const memory = db.workingMemory || {};

  if (memory.activeProject) {
    suggestions.push({
      id: "continue-active-project",
      label: `Continue ${memory.activeProject}`,
      description: memory.lastProgress ? `Last progress: ${memory.lastProgress}` : "Resume the active project",
      tool: "suggest_next_action",
      source: "working_memory"
    });
  }

  const projectCounts = {};
  for (const event of db.memoryEvents || []) {
    const project = event.metadata?.project;
    if (project) projectCounts[project] = (projectCounts[project] || 0) + 1;
  }
  const topProject = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0];
  if (topProject && topProject[0] !== memory.activeProject) {
    suggestions.push({
      id: `review-${topProject[0]}`,
      label: `Review ${topProject[0]}`,
      description: `${topProject[1]} memory events recorded`,
      tool: "review_memory",
      source: "memory_pattern"
    });
  }

  return suggestions.slice(0, 4);
}

function slug(value) {
  return String(value || "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
