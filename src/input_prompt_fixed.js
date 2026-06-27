import crypto from "node:crypto";

export function buildInputPacket(db, userText) {
  const originalText = String(userText || "").trim();
  return {
    id: crypto.randomUUID(),
    originalText,
    language: detectLanguage(originalText),
    normalizedTextEn: originalText,
    compressedPrompt: compressPrompt(originalText),
    taskType: inferTaskType(originalText),
    behaviorMode: db.activeStatusId || "unknown",
    context: {
      location: db.context?.locationTag || "unknown",
      weather: db.context?.weather || "unknown",
      temperature: db.context?.temperature ?? null,
      activeProject: db.workingMemory?.activeProject || null,
      localTime: new Date().toISOString()
    },
    entities: extractEntities(originalText),
    needsMemory: needsMemory(originalText),
    promptVersion: "luma-input-v0.2"
  };
}

export function inputNormalizationSystemPrompt() {
  return `You are Luma Input Processor.
Normalize user input into stable English memory-ready structure.
Return JSON only:
{
  "normalizedTextEn": "clear English rewrite",
  "compressedPrompt": "short key=value style prompt",
  "taskType": "project_update|reminder|question|preference|status_update|general",
  "entities": [{"type": "project|person|place|deadline|topic|file|tool", "name": "..."}],
  "needsMemory": true,
  "qualityNotes": []
}
Rules:
- Preserve original meaning.
- Prefer concise English for memory.
- Do not answer the user.
- Do not create actions directly.`;
}

function detectLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text) && /[A-Za-z]/.test(text)) return "zh_mix";
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh";
  return "en";
}

function compressPrompt(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 600);
}

function inferTaskType(text) {
  if (/(remind|deadline|due|\u63d0\u9192|\u53eb\u6211|\u622a\u6b62)/i.test(text)) return "reminder";
  if (/(prefer|always|\u4e0d\u8981|\u559c\u6b22|\u4e60\u60ef)/i.test(text)) return "preference";
  if (/(status|working|studying|relaxing|\u5207\u6362|\u72b6\u6001)/i.test(text)) return "status_update";
  if (/\?$|\uff1f|what|why|how|\u600e\u4e48|\u4e3a\u4ec0\u4e48/i.test(text)) return "question";
  if (/(project|research|assignment|essay|report|5207|COMP|methodology|literature review)/i.test(text)) return "project_update";
  return "general";
}

function extractEntities(text) {
  const entities = [];
  const projectMatches = String(text || "").match(/\b[A-Z]{2,}\d{3,}|\b\d{4}\b/g) || [];
  for (const name of projectMatches) entities.push({ type: "project", name });
  if (/literature review/i.test(text)) entities.push({ type: "topic", name: "literature_review" });
  if (/methodology/i.test(text)) entities.push({ type: "topic", name: "methodology" });
  return entities;
}

function needsMemory(text) {
  return /(remember|record|save|project|progress|preference|remind|\u5b8c\u6210|\u8bb0\u5f55|\u63d0\u9192|\u7ee7\u7eed|\u504f\u597d)/i.test(text);
}
