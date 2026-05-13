import crypto from "node:crypto";

export function buildInputPacket(db, userText) {
  const originalText = String(userText || "").trim();
  const packet = {
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
    promptVersion: "luma-input-v0.1"
  };
  return packet;
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
  if (/(project|research|assignment|essay|report|5207|COMP|methodology|literature review)/i.test(text)) return "project_update";
  if (/(remind|deadline|due|提醒|叫我|截止)/i.test(text)) return "reminder";
  if (/(prefer|always|不要|喜欢|习惯)/i.test(text)) return "preference";
  if (/(status|working|studying|relaxing|切换|状态)/i.test(text)) return "status_update";
  if (/\?$|？$|what|why|how|怎么|为什么/i.test(text)) return "question";
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
  return /(remember|record|save|project|progress|preference|remind|完成|记录|提醒|继续|偏好)/i.test(text);
}
