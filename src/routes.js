import { config } from "./config.js";
import { readJson, sendJson, clientIpList } from "./http.js";
import { readDb, saveDb } from "./storage.js";
import { nowFeatures } from "./time.js";
import { updateContext, savePlace } from "./context.js";
import { activeStatus, predictStatus, statusReceipt, updateStatus } from "./status.js";
import { activeReminders, createReminder, deleteReminder, dueAlerts, markAlertFired, updateReminder } from "./reminders.js";
import { learningProgress } from "./learning.js";
import { executeProposal, proposeFromChat, trainBrainInBackground } from "./agent.js";
import { clearWorkingMemory, emptyWorkingMemory, projectWorkingMemory, recentMemory, softDeleteMemoryEvent, softDeleteProject, suggestedActions, upsertProject } from "./memory.js";
import { publicLlmState, readSecrets, saveSecrets } from "./secrets.js";
import { usageSummary } from "./usage.js";
import { brainState } from "./brain_service.js";
import { optimizerState } from "./optimizer.js";
import { entryRoutes } from "./entry_routes.js";
import { createSession, activateFreshSession, activateSession, ensureActiveSession, recentSessionsForRoute, sessionMessages, softDeleteSession } from "./sessions.js";
import { latestProcessTrace } from "./process_trace.js";
import { capabilitySummary } from "./capabilities.js";
import { isVisible } from "./lifecycle.js";
import { readUploadedFile } from "./file_service.js";
import { extractMemoryArchitectureWithDeepSeek } from "./deepseek.js";
import { applyMemoryExtraction, normalizeProfileItem, normalizeProfileMemory, normalizeWorkflowRecord, softDeleteWorkflowRecord } from "./memory_architecture.js";
import { listWorkspaceFiles, readWorkspaceFile, updateWorkspaceSettings, workspaceState, writeWorkspaceFile } from "./local_workspace.js";
import { deleteProvider, normalizeRouting, routingState, upsertProvider } from "./llm_registry.js";
import { modelPreferenceSummary, recordModelPreference } from "./model_preferences.js";

export function createRouter() {
  return async function router(req, res, url) {
    const db = await readDb();
    const secrets = await readSecrets();

    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, statePayload(db, secrets));
    }

    if (req.method === "POST" && url.pathname === "/api/status") {
      const result = updateStatus(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, ...result, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/context") {
      const context = updateContext(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, context, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/places") {
      const place = savePlace(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, place, context: db.context, places: db.places, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/reminders") {
      const reminder = createReminder(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, reminder, state: statePayload(db, secrets) });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/reminders/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const reminder = updateReminder(db, id, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, reminder, state: statePayload(db, secrets) });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/reminders/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const reminder = deleteReminder(db, id);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, reminder, state: statePayload(db, secrets) });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/projects/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const project = softDeleteProject(db, id);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, project, state: statePayload(db, secrets) });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/sessions/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const session = softDeleteSession(db, id);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, session, state: statePayload(db, secrets) });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/memory-events/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const memory = softDeleteMemoryEvent(db, id);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, memory, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      const body = await readJson(req);
      db.settings = { ...(db.settings || {}), ...body };
      await saveDb(db);
      return sendJson(res, 200, { ok: true, settings: db.settings, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/llm/settings") {
      const body = await readJson(req);
      const next = await saveSecrets({
        deepseekApiKey: body.deepseekApiKey === undefined ? secrets.deepseekApiKey : String(body.deepseekApiKey || "").trim(),
        deepseekModel: body.deepseekModel || secrets.deepseekModel,
        deepseekThinking: body.deepseekThinking || secrets.deepseekThinking
      });
      return sendJson(res, 200, { ok: true, llm: publicLlmState(next), state: statePayload(db, next) });
    }

    if (req.method === "GET" && url.pathname === "/api/llm/providers") {
      return sendJson(res, 200, { registry: routingState(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/llm/providers") {
      const body = await readJson(req);
      const nextSecrets = await saveSecrets({ llmProviders: upsertProvider(secrets, body) });
      return sendJson(res, 200, { ok: true, registry: routingState(db, nextSecrets), state: statePayload(db, nextSecrets) });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/llm/providers/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const nextSecrets = await saveSecrets({ llmProviders: deleteProvider(secrets, id) });
      return sendJson(res, 200, { ok: true, registry: routingState(db, nextSecrets), state: statePayload(db, nextSecrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/llm/routing") {
      db.modelRouting = normalizeRouting(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, registry: routingState(db, secrets), state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/model-preferences") {
      const record = recordModelPreference(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, record, modelPreferences: modelPreferenceSummary(db), state: statePayload(db, secrets) });
    }

    if (req.method === "GET" && url.pathname === "/api/local-workspace") {
      return sendJson(res, 200, { workspace: workspaceState(db) });
    }

    if (req.method === "POST" && url.pathname === "/api/local-workspace/settings") {
      const workspace = await updateWorkspaceSettings(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, workspace, state: statePayload(db, secrets) });
    }

    if (req.method === "GET" && url.pathname === "/api/local-workspace/files") {
      const files = await listWorkspaceFiles(db, url.searchParams.get("dir") || "");
      return sendJson(res, 200, { files, workspace: workspaceState(db) });
    }

    if (req.method === "POST" && url.pathname === "/api/local-workspace/read") {
      const file = await readWorkspaceFile(db, (await readJson(req)).path);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, file, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/local-workspace/write") {
      const result = await writeWorkspaceFile(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ...result, state: statePayload(db, secrets) });
    }

    if (req.method === "GET" && url.pathname === "/api/memory/profile") {
      return sendJson(res, 200, { profileMemory: normalizeProfileMemory(db.profileMemory) });
    }

    if (req.method === "PATCH" && url.pathname === "/api/memory/profile") {
      const body = await readJson(req);
      db.profileMemory = normalizeProfileMemory(db.profileMemory);
      if (body.item) {
        db.profileMemory.items.push(normalizeProfileItem(body.item));
      }
      if (Array.isArray(body.items)) {
        db.profileMemory.items = body.items.map((item) => normalizeProfileItem(item));
      }
      if (body.rules) db.profileMemory.rules = { ...db.profileMemory.rules, ...body.rules };
      db.profileMemory.updatedAt = new Date().toISOString();
      await saveDb(db);
      return sendJson(res, 200, { ok: true, profileMemory: db.profileMemory, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/memory/extract-profile") {
      const body = await readJson(req);
      const extraction = await extractMemoryArchitectureWithDeepSeek(db, { limit: body.limit || 80 });
      const run = applyMemoryExtraction(db, extraction);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, run, profileMemory: db.profileMemory, state: statePayload(db, secrets) });
    }

    if (req.method === "GET" && url.pathname === "/api/workflow-records") {
      return sendJson(res, 200, { workflowRecords: (db.workflowRecords || []).filter(isVisible) });
    }

    if (req.method === "POST" && url.pathname === "/api/workflow-records") {
      const record = normalizeWorkflowRecord(await readJson(req));
      db.workflowRecords = db.workflowRecords || [];
      db.workflowRecords.push(record);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, record, state: statePayload(db, secrets) });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/workflow-records/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const record = softDeleteWorkflowRecord(db, id);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, record, state: statePayload(db, secrets) });
    }

    if (req.method === "GET" && url.pathname === "/api/workflow-clusters") {
      return sendJson(res, 200, { workflowClusters: (db.workflowClusters || []).filter(isVisible) });
    }

    if (req.method === "GET" && url.pathname === "/api/environment-clusters") {
      return sendJson(res, 200, { environmentClusters: (db.environmentClusters || []).filter(isVisible) });
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      const body = await readJson(req);
      const project = upsertProject(db, {
        project: body.name,
        progress: body.currentProgress || "",
        nextStep: body.nextStep || null,
        state: body.state || "active"
      });
      project.type = body.type || project.type || "custom";
      project.goal = body.goal || project.goal || "";
      await saveDb(db);
      return sendJson(res, 200, { ok: true, project, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/sessions") {
      const body = await readJson(req);
      const session = createSession(db, {
        title: body.title || "New Session",
        routeLabel: body.routeLabel || "general",
        projectId: body.projectId || null
      });
      if (!session.projectId) clearWorkingMemory(db);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, session, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/sessions/fresh") {
      const body = await readJson(req);
      const session = activateFreshSession(db, body.routeLabel || "general", { forceNew: Boolean(body.forceNew) });
      session.projectId = null;
      clearWorkingMemory(db);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, session, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/sessions/active") {
      const body = await readJson(req);
      const session = activateSession(db, body.sessionId);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, session, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/projects/active") {
      const body = await readJson(req);
      const project = (db.projects || []).find((item) => item.id === body.projectId && isVisible(item));
      if (!project) return sendJson(res, 404, { error: "Project not found." });
      const session = createSession(db, {
        title: project.name,
        routeLabel: body.routeLabel || "academic",
        projectId: project.id
      });
      db.workingMemory = projectWorkingMemory(project);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, project, session, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/chat/propose") {
      const proposal = await proposeFromChat(db, await readJson(req));
      await saveDb(db);
      trainBrainInBackground({
        userText: proposal.text,
        inputPacket: proposal.inputPacket,
        expertProposal: proposal
      });
      return sendJson(res, 200, { ok: true, proposal, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/chat/confirm") {
      const results = executeProposal(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, results, state: statePayload(db, secrets) });
    }

    if (req.method === "POST" && url.pathname === "/api/files/upload") {
      const file = await readUploadedFile(db, await readJson(req));
      await saveDb(db);
      return sendJson(res, 200, { ok: true, file, state: statePayload(db, secrets) });
    }

    if (req.method === "GET" && url.pathname === "/api/alerts/due") {
      return sendJson(res, 200, { dueAlerts: dueAlerts(db) });
    }

    if (req.method === "POST" && url.pathname === "/api/alerts/fire") {
      const body = await readJson(req);
      const alert = markAlertFired(db, body.reminderId, body.alertId);
      await saveDb(db);
      return sendJson(res, 200, { ok: true, alert });
    }

    if (req.method === "GET" && url.pathname === "/api/codex-context") {
      return sendJson(res, 200, {
        name: "Luma",
        activeStatus: activeStatus(db),
        features: nowFeatures(db),
        context: db.context,
        places: db.places || [],
        activeReminders: activeReminders(db),
        suggestions: predictStatus(db).suggestions,
        learning: learningProgress(db),
        llm: publicLlmState(secrets),
        note: "Paste this into Codex when you want help debugging or extending Luma."
      });
    }

    return sendJson(res, 404, { error: "Unknown API route." });
  };
}

function statePayload(db, secrets = null) {
  const activeSession = ensureActiveSession(db);
  const memoryScope = sessionMemoryScope(db, activeSession);
  return {
    ...predictStatus(db),
    activeStatusId: db.activeStatusId,
    activeStatus: activeStatus(db),
    receipt: statusReceipt(db),
    statuses: db.statuses,
    reminders: (db.reminders || []).filter(isVisible),
    entryRoutes,
    sessions: recentSessionsForRoute(db, activeSession.routeLabel),
    activeSessionId: activeSession.id,
    activeSession,
    sessionMessages: sessionMessages(db, activeSession.id),
    latestProcess: latestProcessTrace(db, activeSession.id),
    activeReminders: activeReminders(db),
    dueAlerts: dueAlerts(db),
    memoryEvents: (db.memoryEvents || []).filter(isVisible),
    actionEvents: db.actionEvents || [],
    conversations: db.conversations || [],
    projects: (db.projects || []).filter(isVisible),
    usageEvents: db.usageEvents || [],
    brainEvents: db.brainEvents || [],
    trainingSamples: db.trainingSamples || [],
    fileMemories: (db.fileMemories || []).filter(isVisible),
    profileMemory: normalizeProfileMemory(db.profileMemory),
    workflowRecords: (db.workflowRecords || []).filter(isVisible),
    workflowClusters: (db.workflowClusters || []).filter(isVisible),
    environmentClusters: (db.environmentClusters || []).filter(isVisible),
    memoryExtractionRuns: db.memoryExtractionRuns || [],
    memoryIndex: db.memoryIndex || {},
    usage: usageSummary(db),
    workingMemory: memoryScope.workingMemory,
    recentMemory: memoryScope.recentMemory,
    suggestedActions: memoryScope.suggestedActions,
    actionCards: db.actionCards || [],
    modes: db.modes || [],
    context: db.context,
    places: db.places || [],
    learning: learningProgress(db),
    settings: db.settings || { language: "en" },
    llm: publicLlmState(secrets || { deepseekApiKey: "", deepseekModel: "deepseek-v4-flash", deepseekThinking: "disabled" }),
    localLlm: brainState(),
    brain: brainState(),
    llmRegistry: routingState(db, secrets || {}),
    modelPreferences: modelPreferenceSummary(db),
    localWorkspace: workspaceState(db),
    optimizer: optimizerState(),
    capabilities: capabilitySummary(),
    lanUrls: clientIpList().map((ip) => `http://${ip}:${config.port}`)
  };
}

function sessionMemoryScope(db, session) {
  const project = session?.projectId ? (db.projects || []).find((item) => item.id === session.projectId && isVisible(item)) : null;
  if (!project) {
    return {
      workingMemory: emptyWorkingMemory(),
      recentMemory: recentMemory(db, 6, { sessionId: session?.id }),
      suggestedActions: []
    };
  }

  const workingMemory = projectWorkingMemory(project);
  return {
    workingMemory,
    recentMemory: recentMemory(db, 8, { projectId: project.id, projectName: project.name }),
    suggestedActions: suggestedActions(db, { workingMemory })
  };
}
