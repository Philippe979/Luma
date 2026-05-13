import crypto from "node:crypto";
import { normalizeWithDeepSeek, parseWithDeepSeek } from "./deepseek.js";
import { parseChatInput } from "./parser.js";
import { addConversationMessage, addMemoryEvent } from "./memory.js";
import { executeTool } from "./tools.js";
import { addUsageEvent } from "./usage.js";
import { trainWithBrain } from "./brain_service.js";
import { buildInputPacket } from "./input_prompt.js";

export async function proposeFromChat(db, body) {
  const text = String(body.text || "").trim();
  if (!text) throw new Error("Chat input is required.");

  const inputPacket = await buildNormalizedInputPacket(db, text);
  addConversationMessage(db, { role: "user", content: text, source: "chat" });
  const parsed = await parseWithFallback(text, db, inputPacket);
  const proposal = {
    id: crypto.randomUUID(),
    text,
    response: parsed.response,
    confidence: parsed.confidence,
    proposedActions: parsed.proposedActions,
    parser: parsed.parser || "local",
    inputPacket,
    createdAt: new Date().toISOString()
  };

  addConversationMessage(db, { role: "assistant", content: proposal.response, source: proposal.parser === "deepseek" ? "deepseek" : "local_parser" });
  addMemoryEvent(db, {
    type: "chat_interaction",
    summary: proposal.response,
    source: "chat",
    userText: text,
    actions: parsed.proposedActions,
    metadata: { proposalId: proposal.id, confidence: parsed.confidence, parser: proposal.parser, inputPacket }
  });
  if (inputPacket.normalizerUsage) addUsageEvent(db, { ...inputPacket.normalizerUsage, parser: "input_processor" });
  addUsageEvent(db, parsed.usage ? { ...parsed.usage, parser: proposal.parser } : {
    provider: "local",
    model: "local-parser",
    parser: proposal.parser,
    reason: "chat_parse",
    inputTokens: estimateTokens(text),
    outputTokens: estimateTokens(proposal.response)
  });
  await trainWithBrain(db, { userText: text, inputPacket, expertProposal: proposal });

  return proposal;
}

export function executeProposal(db, body) {
  const actions = body.proposedActions || [];
  if (!actions.length) throw new Error("No proposed actions to execute.");
  const results = actions.map((action) => ({
    action,
    result: executeTool(db, action, "chat_confirmed")
  }));
  addMemoryEvent(db, {
    type: "proposal_confirmed",
    summary: `${actions.length} action${actions.length > 1 ? "s" : ""} confirmed`,
    source: "chat",
    actions,
    metadata: { results: results.map(({ action }) => action.tool) }
  });
  return results;
}

async function buildNormalizedInputPacket(db, text) {
  const inputPacket = buildInputPacket(db, text);
  try {
    return await normalizeWithDeepSeek(text, db, inputPacket);
  } catch {
    return inputPacket;
  }
}

async function parseWithFallback(text, db, inputPacket) {
  try {
    const llm = await parseWithDeepSeek(text, db, inputPacket);
    if (llm?.proposedActions?.length) return { ...llm, parser: "deepseek" };
  } catch (error) {
    addMemoryEvent(db, {
      type: "llm_error",
      summary: error.message,
      source: "deepseek",
      metadata: { provider: "deepseek" }
    });
  }
  return { ...parseChatInput(text, db), parser: "local" };
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length * 0.6);
}
