import { readSecrets } from "./secrets.js";
import { emptyWorkingMemory, projectWorkingMemory, recentMemory } from "./memory.js";
import { inputNormalizationSystemPrompt } from "./input_prompt.js";
import { isVisible } from "./lifecycle.js";
import { profilePromptBlock } from "./memory_architecture.js";

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

const hollowResponsePattern = new RegExp([
  "\\u6211(?:\\u9a6c\\u4e0a|\\u8fd9\\u5c31|\\u4f1a|\\u6765|\\u5c06|\\u6b63\\u5728|\\u53ef\\u4ee5|\\u5e2e\\u4f60|\\u7ed9\\u4f60)",
  "\\u8bf7(?:\\u7a0d\\u7b49|\\u7b49\\u4e00\\u4e0b)",
  "\\u9700\\u8981\\u6211(?:\\u518d|\\u91cd\\u65b0)",
  "\\u91cd\\u65b0(?:\\u751f\\u6210|\\u6574\\u7406)",
  "\\u5df2\\u7ecf(?:\\u6574\\u7406|\\u5b8c\\u6210|\\u751f\\u6210)",
  "\\u4e0d\\u518d\\u52a0\\u8fc7\\u6e21",
  "\\u76f4\\u63a5\\u6309\\u8981\\u6c42",
  "\\u6ca1\\u95ee\\u9898",
  "\\u597d\\u7684",
  "please\\s+wait",
  "i\\s+(will|can|am going to)\\s+(generate|write|organize|prepare)"
].join("|"), "i");

const permissionQuestionPattern = new RegExp([
  "\\u9700\\u8981\\u6211.*(?:\\u770b|\\u53d1|\\u7ed9\\u4f60|\\u7ee7\\u7eed)",
  "\\u8981\\u4e0d\\u8981\\u6211",
  "\\u662f\\u5426\\u9700\\u8981",
  "do\\s+you\\s+want\\s+me",
  "would\\s+you\\s+like\\s+me"
].join("|"), "i");

const resultStructurePattern = new RegExp(
  "(^|\\n)\\s*(#{1,6}\\s+|\\d+[.\\u3001]\\s+|[-*]\\s+|[\\u4e00\\u4e8c\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341]+[\\u3001.]\\s+|Status\\s*:|Project\\s*:|Action\\s*:|Answer\\s*:|\\*\\*[^*]+\\*\\*)",
  "m"
);

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
        { role: "system", content: systemPrompt(db, inputPacket) },
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
  const normalized = normalizeLlmParse(JSON.parse(content));
  const repaired = shouldRepairHollowResponse(text, normalized)
    ? await repairHollowResponse({ text, db, inputPacket, normalized, secrets })
    : null;
  return {
    ...(repaired || normalized),
    usage: {
      provider: "deepseek",
      model: secrets.deepseekModel || "deepseek-v4-flash",
      inputTokens: payload.usage?.prompt_tokens || 0,
      outputTokens: payload.usage?.completion_tokens || 0,
      totalTokens: payload.usage?.total_tokens || 0,
      reason: repaired ? "chat_parse_repaired" : "chat_parse"
    }
  };
}

export async function generateAnswerWithDeepSeek(text, db, inputPacket = null) {
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
        { role: "system", content: answerSystemPrompt(db, inputPacket) },
        { role: "user", content: JSON.stringify({ inputPacket, text, conversation: scopedConversation(db, inputPacket) }, null, 2) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: secrets.deepseekThinking || "disabled" },
      max_tokens: 2600
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek answer failed: ${response.status} ${detail.slice(0, 240)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  const parsed = normalizeAnswer(JSON.parse(content), text);
  return {
    ...parsed,
    proposedActions: [],
    intent: "direct_answer",
    assistantNotice: "",
    finalAnswer: parsed.response,
    outputType: inferOutputType(parsed.response),
    usage: {
      provider: "deepseek",
      model: secrets.deepseekModel || "deepseek-v4-flash",
      inputTokens: payload.usage?.prompt_tokens || 0,
      outputTokens: payload.usage?.completion_tokens || 0,
      totalTokens: payload.usage?.total_tokens || 0,
      reason: "direct_answer"
    }
  };
}

export async function extractMemoryArchitectureWithDeepSeek(db, { limit = 80 } = {}) {
  const secrets = await readSecrets();
  if (!secrets.deepseekApiKey) {
    return {
      source: "legacy_memory_migration",
      model: "local_fallback",
      status: "failed",
      error: "DeepSeek API key is not configured.",
      profileCandidates: [],
      workflowCandidates: [],
      environmentCandidates: []
    };
  }

  const sources = legacyMemorySources(db, limit);
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: secrets.deepseekModel || "deepseek-v4-flash",
      messages: [
        { role: "system", content: memoryExtractionPrompt() },
        { role: "user", content: JSON.stringify({ sources }, null, 2) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: secrets.deepseekThinking || "disabled" },
      max_tokens: 2600
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek memory extraction failed: ${response.status} ${detail.slice(0, 240)}`);
  }
  const payload = await response.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
  return normalizeMemoryExtraction(parsed, {
    model: secrets.deepseekModel || "deepseek-v4-flash",
    sourceIds: sources.map((source) => source.id)
  });
}

function systemPrompt(db, inputPacket = null) {
  const scoped = scopedContext(db, inputPacket);
  const routeScope = inputPacket?.session?.routeLabel || "global";
  const context = {
    activeStatus: db.activeStatusId,
    context: db.context,
    profileMemory: profilePromptBlock(db, { scope: routeScope }),
    workingMemory: scoped.workingMemory,
    projects: scoped.projects,
    recentMemory: scoped.recentMemory,
    statuses: (db.statuses || []).map(({ id, label }) => ({ id, label }))
  };

  return `You are Luma's conversational butler and language understanding layer.
Return valid JSON only. Include a useful "response" for the user every time.
Only propose local actions when the user clearly asks Luma to remember, remind, update status, save project progress, continue work, or review memory.
For greetings, small talk, questions, or general conversation, return an empty proposedActions array and answer naturally.
For content tasks such as write, summarize, organize, translate, explain, list, compare, analyze, draft, generate, or complete, put the actual finished content in "response".
Do not answer with promises, waiting language, or transition-only phrases such as "I will do it", "please wait", "I will regenerate", "I have organized it", or "do you want me to show it".
Never execute local state mutations yourself. You may still write the requested answer directly in "response".

Required JSON shape:
{
  "input": string,
  "confidence": number,
  "response": string,
  "memoryTitle": string,
  "proposedActions": []
}

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
- Treat memory as opt-in context. If Current local context has no active project and no recent session memory, do not mention or infer old memories.
- Always generate "memoryTitle" as a short archive title for this turn, 4-9 words, no markdown.
- Prefer project actions for coursework, research, documents, coding, and named work like "5207".
- Do not continue an old project unless the user explicitly asks to continue/review it or the current session is already linked to that project.
- If the user says they finished, completed, paused, or will continue a project, preserve it as one project thread.
- If the user asks for a future alert, use create_deadline with a concrete dueAt.
- If confidence is low, ask a short clarification in response and do not propose a memory action unless the user explicitly asked to save it.
- Do not save greetings such as "hi", "hello", or "welcome" as memory.
- If the user says the result is missing, invisible, or asks you to regenerate, immediately provide the full result instead of apologizing only.
- Avoid filler openers unless the full requested result follows in the same response.
- Use active profile memory only for tone, communication style, and stable user preferences.
- Do not treat profile memory as raw factual history. Do not summon raw old memories unless the user selected or requested them.

Current local context:
${JSON.stringify(context)}`;
}

function answerSystemPrompt(db, inputPacket = null) {
  const scoped = scopedContext(db, inputPacket);
  const routeScope = inputPacket?.session?.routeLabel || "global";
  const profileMemory = profilePromptBlock(db, { scope: routeScope });
  return `You are Luma's direct answer generator.
Return valid JSON only.
Your job is to answer the user's latest request with the actual useful result.

Required JSON shape:
{
  "input": string,
  "confidence": number,
  "response": string,
  "memoryTitle": string
}

Rules:
- Do not promise future work. Do not say "please wait", "I will generate", or "I have organized it above".
- If the user asks for writing, summarizing, organizing, listing, translating, explaining, drafting, or analysis, provide the finished content in "response".
- If the user asks for a section such as methods, results, references, or a list, write that section now.
- If essential source information is missing, still provide a useful scaffold with clear placeholders instead of transition-only text.
- Use the same language as the user unless the user asks otherwise.
- Use concise markdown when it improves readability.
- Do not create local memory/project/reminder actions in this mode.
- Use active profile memory for tone, pacing, formatting preferences, and relationship warmth.
- Do not use raw historical facts unless the user explicitly selected or asked for them.
- Avoid customer-service tone, excessive apology, and hollow transition phrases.

Active profile memory:
${profileMemory}

Scoped memory, only if relevant and explicitly connected to this session/project:
${JSON.stringify({
    workingMemory: scoped.workingMemory,
    projects: scoped.projects,
    recentMemory: scoped.recentMemory
  })}`;
}

function memoryExtractionPrompt() {
  return `You extract high-quality memory architecture candidates for Luma.
Return valid JSON only.
Do not copy raw conversations into memory. Extract compact, stable statements.

Separate memory into three types:
1. profileCandidates: communication style, tone, formatting preference, interaction rule, relationship term, work habit.
2. workflowCandidates: reusable task workflows, successful task patterns, failure modes.
3. environmentCandidates: long-term or phase-based context such as deadline pressure, research phase, debugging crisis, exam period.

Rules:
- Profile memory affects Luma's tone and communication style.
- Workflow memory affects future task planning only.
- Environment clusters describe current/recurring conditions and should not be used as raw facts.
- Use "scope": "global" only for preferences that should apply everywhere. Use the routeLabel when the preference or relationship term belongs to a specific entry route.
- Give confidence 0 to 1.
- Put uncertain personal terms in needs-review style by giving confidence below 0.8.
- Keep each statement short and reusable.

Required JSON shape:
{
  "profileCandidates": [
    {
      "type": "communication_style|format_preference|interaction_rule|relationship_term|work_habit",
      "statement": string,
      "evidenceSummary": string,
      "confidence": number,
      "sourceIds": [],
      "scope": "global|space:<id>"
    }
  ],
  "workflowCandidates": [
    {
      "title": string,
      "taskDomain": "writing|coding|research|planning|analysis|personal|general",
      "subCluster": string,
      "inputSummary": string,
      "workflow": {"steps": [], "toolsUsed": [], "decisionPoints": [], "failureModes": []},
      "outputSummary": string,
      "qualitySignals": {"successScore": number, "preferenceAlignment": number}
    }
  ],
  "environmentCandidates": [
    {
      "label": string,
      "description": string,
      "signals": [],
      "confidence": number,
      "activeScore": number
    }
  ]
}`;
}

async function repairHollowResponse({ text, db, inputPacket, normalized, secrets }) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: secrets.deepseekModel || "deepseek-v4-flash",
      messages: [
        { role: "system", content: repairSystemPrompt(db, inputPacket) },
        { role: "user", content: JSON.stringify({ userText: text, badResponse: normalized.response }, null, 2) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: secrets.deepseekThinking || "disabled" },
      max_tokens: 2200
    })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  const parsed = normalizeLlmParse(JSON.parse(content));
  return {
    ...normalized,
    ...parsed,
    proposedActions: normalized.proposedActions,
    repairedFromHollowResponse: true
  };
}

function repairSystemPrompt(db, inputPacket = null) {
  const scoped = scopedContext(db, inputPacket);
  return `You are Luma's response repair layer.
Return valid JSON only.
The previous response was rejected because it promised work instead of giving the result.
Write the actual answer now. Do not say you will do it later. Do not ask whether the user wants to see it.
If information is missing, provide the best useful structure and mark unknown fields as "Unknown".

Required JSON shape:
{
  "input": string,
  "confidence": number,
  "response": string,
  "memoryTitle": string,
  "proposedActions": []
}

Available scoped context:
${JSON.stringify({
    workingMemory: scoped.workingMemory,
    projects: scoped.projects,
    recentMemory: scoped.recentMemory
  })}`;
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
        { role: "user", content: JSON.stringify({ inputPacket, recentMemory: scopedContext(db, inputPacket).recentMemory.slice(0, 5), text }, null, 2) }
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

function scopedContext(db, inputPacket = null) {
  const session = inputPacket?.session || {};
  const project = session.projectId ? (db.projects || []).find((item) => item.id === session.projectId && isVisible(item)) : null;
  if (project) {
    return {
      workingMemory: projectWorkingMemory(project),
      projects: [project],
      recentMemory: recentMemory(db, 8, { projectId: project.id, projectName: project.name })
    };
  }

  return {
    workingMemory: emptyWorkingMemory(),
    projects: [],
    recentMemory: recentMemory(db, 8, { sessionId: session.id })
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
    memoryTitle: cleanTitle(parsed.memoryTitle || parsed.title || parsed.response || parsed.input),
    response: String(parsed.response || buildResponse(proposedActions))
  };
}

function normalizeAnswer(parsed, fallbackInput) {
  const response = String(parsed.response || parsed.answer || "");
  return {
    input: String(parsed.input || fallbackInput || ""),
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.82,
    memoryTitle: cleanTitle(parsed.memoryTitle || parsed.title || fallbackInput || "Luma answer"),
    response,
    finalAnswer: response,
    assistantNotice: String(parsed.assistantNotice || ""),
    outputType: parsed.outputType || inferOutputType(response)
  };
}

function normalizeMemoryExtraction(parsed, { model, sourceIds }) {
  return {
    source: "legacy_memory_migration",
    sourceIds,
    model,
    status: "completed",
    profileCandidates: Array.isArray(parsed.profileCandidates)
      ? parsed.profileCandidates.map((item) => ({
        type: item.type || "communication_style",
        statement: String(item.statement || "").trim(),
        evidenceSummary: String(item.evidenceSummary || "").trim(),
        confidence: clamp01(item.confidence ?? 0.5),
        sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds : [],
        scope: item.scope || "global"
      })).filter((item) => item.statement)
      : [],
    workflowCandidates: Array.isArray(parsed.workflowCandidates)
      ? parsed.workflowCandidates.map((item) => ({
        title: String(item.title || "Workflow candidate").trim(),
        taskDomain: item.taskDomain || "general",
        subCluster: item.subCluster || null,
        inputSummary: String(item.inputSummary || "").trim(),
        workflow: {
          steps: Array.isArray(item.workflow?.steps) ? item.workflow.steps : [],
          toolsUsed: Array.isArray(item.workflow?.toolsUsed) ? item.workflow.toolsUsed : [],
          decisionPoints: Array.isArray(item.workflow?.decisionPoints) ? item.workflow.decisionPoints : [],
          failureModes: Array.isArray(item.workflow?.failureModes) ? item.workflow.failureModes : []
        },
        outputSummary: String(item.outputSummary || "").trim(),
        qualitySignals: {
          successScore: clamp01(item.qualitySignals?.successScore ?? 0.5),
          preferenceAlignment: clamp01(item.qualitySignals?.preferenceAlignment ?? 0.5)
        }
      })).filter((item) => item.inputSummary || item.workflow.steps.length)
      : [],
    environmentCandidates: Array.isArray(parsed.environmentCandidates)
      ? parsed.environmentCandidates.map((item) => ({
        label: String(item.label || "").trim(),
        description: String(item.description || "").trim(),
        signals: Array.isArray(item.signals) ? item.signals : [],
        confidence: clamp01(item.confidence ?? 0.5),
        activeScore: clamp01(item.activeScore ?? 0)
      })).filter((item) => item.label)
      : []
  };
}

function buildResponse(actions) {
  if (!actions.length) return "I can save this as memory.";
  const labels = actions.map((action) => action.tool.replaceAll("_", " ")).join(", ");
  return `I found ${actions.length} action${actions.length > 1 ? "s" : ""}: ${labels}.`;
}

function shouldRepairHollowResponse(userText, parsed) {
  const response = String(parsed?.response || "").trim();
  if (!response || !looksLikeContentRequest(userText)) return false;
  if (response.length > 700 && hasResultStructure(response)) return false;
  const transitionOnly =
    hollowResponsePattern.test(response) &&
    !hasResultStructure(response);
  const asksForPermission = permissionQuestionPattern.test(response);
  return transitionOnly || asksForPermission;
}

function looksLikeContentRequest(text) {
  return contentRequestPattern.test(String(text || ""));
}

function hasResultStructure(text) {
  return resultStructurePattern.test(String(text || ""));
}

function scopedConversation(db, inputPacket = null) {
  const sessionId = inputPacket?.session?.id;
  if (!sessionId) return [];
  return (db.conversations || [])
    .filter((message) => message.conversationId === sessionId)
    .slice(-10)
    .map(({ role, content, source, timestamp }) => ({ role, content, source, timestamp }));
}

function legacyMemorySources(db, limit) {
  const memory = (db.memoryEvents || []).filter(isVisible).slice(-Math.floor(limit / 2)).map((event) => ({
    id: event.id,
    type: "memory_event",
    memoryType: event.memoryType || event.type,
    summary: event.summary,
    userText: event.userText,
    metadata: event.metadata
  }));
  const conversations = (db.conversations || []).slice(-limit).map((message) => ({
    id: message.id,
    type: "conversation",
    role: message.role,
    content: message.content,
    routeLabel: message.routeLabel,
    intent: message.intent,
    outputType: message.outputType,
    timestamp: message.timestamp
  }));
  const projects = (db.projects || []).filter(isVisible).slice(-20).map((project) => ({
    id: project.id,
    type: "project",
    name: project.name,
    state: project.state,
    goal: project.goal,
    currentProgress: project.currentProgress,
    nextStep: project.nextStep,
    history: project.history
  }));
  return [...memory, ...conversations, ...projects];
}

function inferOutputType(text) {
  const value = String(text || "");
  if (/```/.test(value)) return "code";
  if (/\|.+\|/.test(value) && /\n\s*\|?\s*[-:]+\s*\|/.test(value)) return "table";
  if (/\$\$|\\\(|\\\[/.test(value)) return "math";
  if (/^#{1,6}\s+/m.test(value) || /^\s*\d+[.\u3001]\s+/m.test(value) || /^\s*[-*]\s+/m.test(value)) return "document";
  return value.length > 420 ? "document" : "chat";
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function cleanTitle(value) {
  return String(value || "Luma conversation")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, 80) || "Luma conversation";
}
