import { createReminder } from "./reminders.js";
import { updateStatus } from "./status.js";
import { addActionEvent, addMemoryEvent, updateWorkingMemory, upsertProject } from "./memory.js";

export function executeTool(db, action, source = "chat") {
  const { tool, args = {} } = action;
  let result;

  if (tool === "update_status") {
    result = updateStatus(db, args);
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
      metadata: { project: args.project, progress: args.progress, nextStep: args.nextStep || null, state: args.state || "active" }
    });
  } else if (tool === "create_continuation") {
    const working = updateWorkingMemory(db, {
      activeProject: args.project,
      nextStep: args.text || `Continue ${args.project}`
    });
    result = upsertProject(db, {
      project: args.project,
      nextStep: args.text || `Continue ${args.project}`,
      state: "paused"
    }) || working;
    addMemoryEvent(db, {
      type: "continuation",
      summary: `${args.project}: ${args.text || "continue later"}`,
      source,
      metadata: { project: args.project, when: args.when || "next" }
    });
  } else if (tool === "save_memory_note") {
    result = addMemoryEvent(db, {
      type: "note",
      summary: args.note,
      source,
      metadata: { note: args.note }
    });
  } else if (tool === "suggest_next_action" || tool === "review_memory") {
    result = { ok: true, message: "Suggestion acknowledged." };
  } else {
    throw new Error(`Unknown tool: ${tool}`);
  }

  addActionEvent(db, { tool, args, result, source, confirmedByUser: true });
  return result;
}
