import { createReminder } from "./reminders.js";
import { updateContext } from "./context.js";
import { updateStatus } from "./status.js";
import { addActionEvent, addMemoryEvent, upsertProject } from "./memory.js";

export function executeTool(db, action, source = "chat", context = {}) {
  const { tool, args = {} } = action;
  const memoryContext = {
    sessionId: context.sessionId || null,
    projectId: context.projectId || null,
    title: context.title || action.reason || action.tool
  };
  let result;

  if (tool === "update_status") {
    result = updateStatus(db, args);
  } else if (tool === "update_context") {
    result = updateContext(db, args);
    addMemoryEvent(db, {
      type: "context_update",
      summary: [
        args.locationTag ? `location=${args.locationTag}` : "",
        args.weather ? `weather=${args.weather}` : ""
      ].filter(Boolean).join(", ") || "Context updated",
      source,
      metadata: { ...memoryContext, contextPatch: args }
    });
  } else if (tool === "create_reminder") {
    result = createReminder(db, { kind: "status", ...args, statusIds: args.statusIds?.length ? args.statusIds : db.activeStatusId ? [db.activeStatusId] : [] });
  } else if (tool === "create_deadline") {
    result = createReminder(db, { kind: "deadline", ...args, statusIds: args.statusIds?.length ? args.statusIds : db.activeStatusId ? [db.activeStatusId] : [] });
  } else if (tool === "save_project_progress") {
    result = upsertProject(db, {
      project: args.project,
      progress: args.progress,
      nextStep: args.nextStep || null,
      state: args.state || "active"
    });
    addMemoryEvent(db, {
      type: "project_progress",
      summary: `${args.project}: ${args.progress}`,
      source,
      metadata: { ...memoryContext, project: args.project, progress: args.progress, nextStep: args.nextStep || null, state: args.state || "active" }
    });
  } else if (tool === "create_continuation") {
    result = upsertProject(db, {
      project: args.project,
      nextStep: args.text || `Continue ${args.project}`,
      state: "paused"
    });
    addMemoryEvent(db, {
      type: "continuation",
      summary: `${args.project}: ${args.text || "continue later"}`,
      source,
      metadata: { ...memoryContext, project: args.project, when: args.when || "next" }
    });
  } else if (tool === "save_memory_note") {
    result = addMemoryEvent(db, {
      type: "note",
      summary: args.note,
      source,
      metadata: { ...memoryContext, note: args.note }
    });
  } else if (tool === "suggest_next_action" || tool === "review_memory") {
    result = { ok: true, message: "Suggestion acknowledged." };
  } else {
    throw new Error(`Unknown tool: ${tool}`);
  }

  addActionEvent(db, { tool, args, result, source, confirmedByUser: true });
  return result;
}
