import crypto from "node:crypto";
import { normalizeWithDeepSeek, parseWithDeepSeek } from "./deepseek.js";
import { parseChatInput } from "./parser.js";
import { addMemoryEvent, emptyWorkingMemory, projectWorkingMemory } from "./memory.js";
import { addSessionMessage } from "./conversation.js";
import { routeProfile } from "./entry_routes.js";
import { addProcessStep, finishProcessTrace, startProcessTrace } from "./process_trace.js";
import { ensureActiveSession, touchSession } from "./sessions.js";
import { executeTool } from "./tools.js";
import { addUsageEvent } from "./usage.js";
import { trainWithBrain } from "./brain_service.js";
import { buildInputPacket } from "./input_prompt.js";
import { readDb, saveDb } from "./storage.js";
import { isVisible } from "./lifecycle.js";

export async function proposeFromChat(db, body) {
  const text = String(body.text || "").trim();
  if (!text) throw new Error("Chat input is required.");
  if (text.length > 12000) {
    throw new Error("This message is too long for one Luma turn. Please split it into smaller parts.");
  }

  const session = ensureActiveSession(db, {
    sessionId: body.sessionId,
    routeLabel: body.routeLabel,
    projectId: body.projectId || null
  });
  const route = routeProfile(body.routeLabel || session.routeLabel);
  const trace = startProcessTrace(db, { sessionId: session.id, routeLabel: route.id });
  addProcessStep(trace, "Question received");
  addProcessStep(trace, `Context selected: ${route.label}`, "done", route.tone);

  const contextDb = scopedDbForSession(db, session);
  const inputPacket = await buildNormalizedInputPacket(contextDb, text, session, route);
  inputPacket.session = {
    id: session.id,
    title: session.title,
    routeLabel: route.id,
    routeTone: route.tone,
    projectId: session.projectId
  };
  addProcessStep(trace, "Input normalized");
  addSessionMessage(db, { role: "user", content: text, source: "chat", sessionId: session.id, routeLabel: route.id, projectId: session.projectId });
  const parsed = await parseWithFallback(text, contextDb, inputPacket, db);
  addProcessStep(trace, "Memory and action proposal prepared", "done", `${parsed.proposedActions?.length || 0} proposed action(s)`);
  const proposal = {
    id: crypto.randomUUID(),
    text,
    response: parsed.response,
    confidence: parsed.confidence,
    memoryTitle: parsed.memoryTitle || inferMemoryTitle(text),
    proposedActions: parsed.proposedActions,
    parser: parsed.parser || "local",
    inputPacket,
    sessionId: session.id,
    routeLabel: route.id,
    processTraceId: trace.id,
    createdAt: new Date().toISOString()
  };

  addSessionMessage(db, { role: "assistant", content: proposal.response, source: proposal.parser === "deepseek" ? "deepseek" : "local_parser", sessionId: session.id, routeLabel: route.id, projectId: session.projectId });
  addMemoryEvent(db, {
    type: "chat_interaction",
    summary: proposal.memoryTitle,
    source: "chat",
    userText: text,
    actions: parsed.proposedActions,
    metadata: { proposalId: proposal.id, title: proposal.memoryTitle, response: proposal.response, confidence: parsed.confidence, parser: proposal.parser, inputPacket, sessionId: session.id, routeLabel: route.id, projectId: session.projectId }
  });
  touchSession(db, session.id, { titleHint: text, routeLabel: route.id, projectId: session.projectId });
  addProcessStep(trace, "Response generated");
  finishProcessTrace(trace);
  if (inputPacket.normalizerUsage) addUsageEvent(db, { ...inputPacket.normalizerUsage, parser: "input_processor" });
  addUsageEvent(db, parsed.usage ? { ...parsed.usage, parser: proposal.parser } : {
    provider: "local",
    model: "local-parser",
    parser: proposal.parser,
    reason: "chat_parse",
    inputTokens: estimateTokens(text),
    outputTokens: estimateTokens(proposal.response)
  });
  return proposal;
}

export function trainBrainInBackground({ userText, inputPacket, expertProposal }) {
  setTimeout(async () => {
    try {
      const snapshot = await readDb();
      const { sample, brainEvent } = await trainWithBrain(snapshot, { userText, inputPacket, expertProposal });
      const latest = await readDb();
      latest.trainingSamples = latest.trainingSamples || [];
      latest.brainEvents = latest.brainEvents || [];
      if (brainEvent && !latest.brainEvents.some((event) => event.id === brainEvent.id)) {
        latest.brainEvents.push(brainEvent);
      }
      if (sample && !latest.trainingSamples.some((item) => item.id === sample.id)) {
        latest.trainingSamples.push(sample);
      }
      await saveDb(latest);
    } catch (error) {
      console.error(`Brain background training failed: ${error.message}`);
    }
  }, 0);
}

export function executeProposal(db, body) {
  const actions = body.proposedActions || [];
  if (!actions.length) throw new Error("No proposed actions to execute.");
  const session = ensureActiveSession(db, { sessionId: body.sessionId });
  const results = actions.map((action) => ({
    action,
    result: executeTool(db, action, "chat_confirmed", {
      sessionId: session.id,
      projectId: session.projectId || null,
      title: body.memoryTitle || inferMemoryTitle(action.reason || action.tool)
    })
  }));
  for (const { action, result } of results) {
    if ((action.tool === "save_project_progress" || action.tool === "create_continuation") && result?.id) {
      if (action.args?.state === "done") {
        if (session.projectId === result.id) session.projectId = null;
      } else {
        touchSession(db, session.id, { projectId: result.id });
      }
    }
  }
  addMemoryEvent(db, {
    type: "proposal_confirmed",
    summary: `${actions.length} action${actions.length > 1 ? "s" : ""} confirmed`,
    source: "chat",
    actions,
    metadata: { title: body.memoryTitle || "Actions confirmed", results: results.map(({ action }) => action.tool), sessionId: session.id, projectId: session.projectId || null }
  });
  return results;
}

async function buildNormalizedInputPacket(db, text, session, route) {
  const inputPacket = buildInputPacket(db, text);
  inputPacket.session = {
    id: session.id,
    title: session.title,
    routeLabel: route.id,
    routeTone: route.tone,
    projectId: session.projectId
  };
  try {
    return await normalizeWithDeepSeek(text, db, inputPacket);
  } catch {
    return inputPacket;
  }
}

async function parseWithFallback(text, parserDb, inputPacket, eventDb = parserDb) {
  try {
    const llm = await parseWithDeepSeek(text, parserDb, inputPacket);
    if (llm?.response || llm?.proposedActions?.length) return { ...llm, parser: "deepseek" };
  } catch (error) {
    addMemoryEvent(eventDb, {
      type: "llm_error",
      summary: error.message,
      source: "deepseek",
      metadata: { provider: "deepseek" }
    });
  }
  return { ...parseChatInput(text, parserDb), parser: "local" };
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length * 0.6);
}

function inferMemoryTitle(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!cleaned) return "Luma conversation";
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned;
}

function scopedDbForSession(db, session) {
  const project = session.projectId ? (db.projects || []).find((item) => item.id === session.projectId && isVisible(item)) : null;
  const scoped = {
    ...db,
    projects: project ? [project] : [],
    workingMemory: project ? projectWorkingMemory(project) : emptyWorkingMemory(),
    memoryEvents: project
      ? (db.memoryEvents || []).filter((event) => isVisible(event) && (event.metadata?.project === project.name || event.metadata?.projectId === project.id))
      : (db.memoryEvents || []).filter((event) => isVisible(event) && event.metadata?.sessionId === session.id)
  };
  return scoped;
}
