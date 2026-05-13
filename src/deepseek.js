import { readSecrets } from "./secrets.js";
import { recentMemory } from "./memory.js";
import { inputNormalizationSystemPrompt } from "./input_prompt.js";

const allowedTools = [
  "update_status",
  "create_reminder",
  "create_deadline",
  "save_project_progress",
  "create_continuation",
  "save_memory_note",
  "suggest_next_action",
  "review_memory"
];

export async function parseWithDeepSeek(text, db, inputPacket = null) {
  const secrets = await readSecrets();
  if (!secrets.deepseekApiKey) return null;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: secrets.deepseekModel || "deepseek-v4-flash",
      messages: [
        { role: "system", content: systemPrompt(db) },
        { role: "user", content: JSON.stringify({ inputPacket, text }, null, 2) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: secrets.deepseekThinking || "disabled" },
      max_tokens: 1600
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek request failed: ${response.status} ${detail.slice(0, 240)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  return {
    ...normalizeLlmParse(JSON.parse(content)),
    usage: {
      provider: "deepseek",
      model: secrets.deepseekModel || "deepseek-v4-flash",
      inputTokens: payload.usage?.prompt_tokens || 0,
      outputTokens: payload.usage?.completion_tokens || 0,
      totalTokens: payload.usage?.total_tokens || 0,
      reason: "chat_parse"
    }
  };
}

function systemPrompt(db) {
  const context = {
    activeStatus: db.activeStatusId,
    context: db.context,
    workingMemory: db.workingMemory,
    projects: (db.projects || []).slice(-8),
    recentMemory: recentMemory(db, 8),
    statuses: (db.statuses || []).map(({ id, label }) => ({ id, label }))
  };

  return `You are Luma's language understanding layer. Convert the user's message into local action proposals.
Return valid JSON only. Never execute actions yourself.

Allowed tools:
- update_status: args { "label": string }
- create_reminder: args { "text": string, "frequency": "once"|"every_status_enter"|"for_next_days"|"daily_until_done"|"manual_only", "statusIds": string[] }
- create_deadline: args { "text": string, "dueAt": ISO8601 string, "leadTimes": number[], "statusIds": string[] }
- save_project_progress: args { "project": string, "progress": string, "nextStep": string|null, "state": "active"|"paused"|"done" }
- create_continuation: args { "project": string, "text": string, "when": string }
- save_memory_note: args { "note": string, "tags": string[] }
- suggest_next_action: args { "project": string|null }
- review_memory: args { "project": string|null }

Rules:
- Prefer project actions for coursework, research, documents, coding, and named work like "5207".
- If the user says they finished, completed, paused, or will continue a project, preserve it as one project thread.
- If the user asks for a future alert, use create_deadline with a concrete dueAt.
- If confidence is low, save a memory note and ask a short clarification in response.

Current local context:
${JSON.stringify(context)}`;
}

export async function normalizeWithDeepSeek(text, db, inputPacket) {
  const secrets = await readSecrets();
  if (!secrets.deepseekApiKey) return inputPacket;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: secrets.deepseekModel || "deepseek-v4-flash",
      messages: [
        { role: "system", content: inputNormalizationSystemPrompt() },
        { role: "user", content: JSON.stringify({ inputPacket, recentMemory: recentMemory(db, 5), text }, null, 2) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: secrets.deepseekThinking || "disabled" },
      max_tokens: 900
    })
  });
  if (!response.ok) return inputPacket;
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  return {
    ...inputPacket,
    ...JSON.parse(content),
    normalizerProvider: "deepseek",
    normalizerUsage: {
      provider: "deepseek",
      model: secrets.deepseekModel || "deepseek-v4-flash",
      reason: "input_normalization",
      inputTokens: payload.usage?.prompt_tokens || 0,
      outputTokens: payload.usage?.completion_tokens || 0
    }
  };
}

function normalizeLlmParse(parsed) {
  const actions = Array.isArray(parsed.proposedActions) ? parsed.proposedActions : [];
  const proposedActions = actions
    .filter((action) => allowedTools.includes(action?.tool))
    .map((action) => ({
      tool: action.tool,
      args: action.args && typeof action.args === "object" ? action.args : {},
      reason: String(action.reason || "")
    }));

  return {
    input: String(parsed.input || ""),
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.78,
    proposedActions,
    response: String(parsed.response || buildResponse(proposedActions))
  };
}

function buildResponse(actions) {
  if (!actions.length) return "I can save this as memory.";
  const labels = actions.map((action) => action.tool.replaceAll("_", " ")).join(", ");
  return `I found ${actions.length} action${actions.length > 1 ? "s" : ""}: ${labels}.`;
}
