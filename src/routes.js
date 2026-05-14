import { config } from "./config.js";
import { readJson, sendJson, clientIpList } from "./http.js";
import { readDb, saveDb } from "./storage.js";
import { nowFeatures } from "./time.js";
import { updateContext, savePlace } from "./context.js";
import { activeStatus, predictStatus, statusReceipt, updateStatus } from "./status.js";
import { activeReminders, createReminder, deleteReminder, dueAlerts, markAlertFired, updateReminder } from "./reminders.js";
import { learningProgress } from "./learning.js";
import { executeProposal, proposeFromChat, trainBrainInBackground } from "./agent.js";
import { recentMemory, suggestedActions, upsertProject } from "./memory.js";
import { publicLlmState, readSecrets, saveSecrets } from "./secrets.js";
import { usageSummary } from "./usage.js";
import { brainState } from "./brain_service.js";
import { optimizerState } from "./optimizer.js";

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
  return {
    ...predictStatus(db),
    activeStatusId: db.activeStatusId,
    activeStatus: activeStatus(db),
    receipt: statusReceipt(db),
    statuses: db.statuses,
    reminders: db.reminders,
    activeReminders: activeReminders(db),
    dueAlerts: dueAlerts(db),
    memoryEvents: db.memoryEvents || [],
    actionEvents: db.actionEvents || [],
    conversations: db.conversations || [],
    projects: db.projects || [],
    usageEvents: db.usageEvents || [],
    brainEvents: db.brainEvents || [],
    trainingSamples: db.trainingSamples || [],
    usage: usageSummary(db),
    workingMemory: db.workingMemory || {},
    recentMemory: recentMemory(db),
    suggestedActions: suggestedActions(db),
    actionCards: db.actionCards || [],
    modes: db.modes || [],
    context: db.context,
    places: db.places || [],
    learning: learningProgress(db),
    settings: db.settings || { language: "en" },
    llm: publicLlmState(secrets || { deepseekApiKey: "", deepseekModel: "deepseek-v4-flash", deepseekThinking: "disabled" }),
    localLlm: brainState(),
    brain: brainState(),
    optimizer: optimizerState(),
    lanUrls: clientIpList().map((ip) => `http://${ip}:${config.port}`)
  };
}
