import crypto from "node:crypto";
import { generateAnswerWithDeepSeek, normalizeWithDeepSeek, parseWithDeepSeek } from "./deepseek.js";
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

const contentRequestPattern = new RegExp([
  "\\u6574\\u7406",
  "\\u751f\\u6210",
  "\\u91cd\\u65b0\\u751f\\u6210",
  "\\u5199",
  "\\u5217\\u51fa",
  "\\u603b\\u7ed3",
  "\\u89e3\\u91ca",
  "\\u5206\\u6790",
  "\\u7ffb\\u8bd1",
  "\\u6da6\\u8272",
  "\\u6539\\u5199",
  "\\u7ed9\\u6211",
  "\\u8f93\\u51fa",
  "\\u5b8c\\u6574",
  "\\u7ed3\\u679c",
  "\\u65b9\\u6cd5",
  "\\u6b65\\u9aa4",
  "\\u6e05\\u5355",
  "\\u65b9\\u6848",
  "\\u5c55\\u793a",
  "\\u62a5\\u544a",
  "\\u5b9e\\u9a8c",
  "\\u9010\\u6761",
  "reference",
  "report",
  "essay",
  "list",
  "summary",
  "draft",
  "write",
  "generate",
  "organize",
  "explain",
  "analyze",
  "translate",
  "polish",
  "rewrite"
].join("|"), "i");

const localActionPattern = new RegExp([
  "status\\s*:",
  "remember",
  "record",
  "save\\s+(this|memory|project|progress)",
  "remind",
  "deadline",
  "\\u8bb0\\u4f4f",
  "\\u8bb0\\u5f55",
  "\\u4fdd\\u5b58",
  "\\u63d0\\u9192",
  "\\u622a\\u6b62",
  "\\u9879\\u76ee\\u8fdb\\u5ea6",
  "\\u66f4\\u65b0\\u72b6\\u6001"
].join("|"), "i");

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
  const useDirectAnswer = shouldUseDirectAnswer(text);
  addProcessStep(trace, `Intent routed: ${useDirectAnswer ? "direct_answer" : "memory_action"}`, "done", useDirectAnswer ? "final answer channel" : "proposal channel");
  const parsed = useDirectAnswer
    ? await answerWithFallback(text, contextDb, inputPacket, db)
    : await parseWithFallback(text, contextDb, inputPacket, db);
  const output = normalizeProposalOutput(parsed, text);
  addProcessStep(
    trace,
    output.intent === "direct_answer" ? "Direct answer generated" : "Memory and action proposal prepared",
    "done",
    output.intent === "direct_answer" ? output.outputType : `${output.proposedActions?.length || 0} proposed action(s)`
  );
  const proposal = {
    id: crypto.randomUUID(),
    text,
    intent: output.intent,
    response: output.response,
    finalAnswer: output.finalAnswer,
    assistantNotice: output.assistantNotice,
    outputType: output.outputType,
    confidence: output.confidence,
    memoryTitle: output.memoryTitle,
    proposedActions: output.proposedActions,
    workflowTrace: trace.steps,
    parser: parsed.parser || "local",
    inputPacket,
    sessionId: session.id,
    routeLabel: route.id,
    processTraceId: trace.id,
    createdAt: new Date().toISOString()
  };

  addSessionMessage(db, {
    role: "assistant",
    content: proposal.finalAnswer || proposal.response,
    source: proposal.parser === "deepseek" ? "deepseek" : "local_parser",
    sessionId: session.id,
    routeLabel: route.id,
    projectId: session.projectId,
    intent: proposal.intent,
    outputType: proposal.outputType,
    metadata: {
      finalAnswer: proposal.finalAnswer,
      assistantNotice: proposal.assistantNotice,
      proposedActions: proposal.proposedActions,
      memoryTitle: proposal.memoryTitle,
      processTraceId: trace.id
    }
  });
  addMemoryEvent(db, {
    type: output.intent === "direct_answer" ? "chat_answer" : "chat_interaction",
    summary: proposal.memoryTitle,
    source: "chat",
    userText: text,
    actions: output.proposedActions,
    metadata: {
      proposalId: proposal.id,
      title: proposal.memoryTitle,
      intent: proposal.intent,
      finalAnswer: proposal.finalAnswer,
      assistantNotice: proposal.assistantNotice,
      response: proposal.response,
      confidence: output.confidence,
      parser: proposal.parser,
      outputType: proposal.outputType,
      inputPacket,
      sessionId: session.id,
      routeLabel: route.id,
      projectId: session.projectId
    }
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
    outputTokens: estimateTokens(proposal.finalAnswer || proposal.response)
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

async function answerWithFallback(text, parserDb, inputPacket, eventDb = parserDb) {
  try {
    const answer = await generateAnswerWithDeepSeek(text, parserDb, inputPacket);
    if (answer?.response) return { ...answer, mode: "direct_answer", parser: "deepseek" };
  } catch (error) {
    addMemoryEvent(eventDb, {
      type: "llm_error",
      summary: error.message,
      source: "deepseek",
      metadata: { provider: "deepseek", mode: "direct_answer" }
    });
  }
  return { ...parseChatInput(text, parserDb), parser: "local", mode: "proposal" };
}

function shouldUseDirectAnswer(text) {
  const input = String(text || "");
  if (looksLikeLocalAction(input)) return false;
  return contentRequestPattern.test(input);
}

function looksLikeLocalAction(text) {
  return localActionPattern.test(String(text || ""));
}

function normalizeProposalOutput(parsed, fallbackText) {
  const intent = parsed.intent || (parsed.mode === "direct_answer" ? "direct_answer" : "memory_action");
  const finalAnswer = String(parsed.finalAnswer || (intent === "direct_answer" ? parsed.response : "") || "");
  const assistantNotice = String(parsed.assistantNotice || (intent === "direct_answer" ? "" : parsed.response || "") || "");
  const response = finalAnswer || assistantNotice || parsed.response || "";
  return {
    intent,
    response,
    finalAnswer,
    assistantNotice,
    outputType: parsed.outputType || inferOutputType(finalAnswer || response),
    confidence: parsed.confidence,
    memoryTitle: parsed.memoryTitle || inferMemoryTitle(fallbackText),
    proposedActions: Array.isArray(parsed.proposedActions) ? parsed.proposedActions : []
  };
}

function inferOutputType(text) {
  const value = String(text || "");
  if (/```/.test(value)) return "code";
  if (/\|.+\|/.test(value) && /\n\s*\|?\s*[-:]+\s*\|/.test(value)) return "table";
  if (/\$\$|\\\(|\\\[/.test(value)) return "math";
  if (/^#{1,6}\s+/m.test(value) || /^\s*\d+[.\u3001]\s+/m.test(value) || /^\s*[-*]\s+/m.test(value)) return "document";
  return value.length > 420 ? "document" : "chat";
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
