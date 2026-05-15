import crypto from "node:crypto";
import { config } from "./config.js";
import { recentMemory } from "./memory.js";

export function brainState() {
  return {
    provider: config.brainProvider,
    enabled: Boolean(config.brainEndpoint),
    endpoint: config.brainEndpoint || null,
    model: config.brainModel,
    mode: config.brainMode,
    role: "luma_brain_training"
  };
}

export async function trainWithBrain(db, { userText, inputPacket, expertProposal }) {
  const sample = baseTrainingSample(db, { userText, inputPacket, expertProposal });
  if (!config.brainEndpoint) {
    db.trainingSamples.push(sample);
    return { sample, brainEvent: null };
  }

  const startedAt = Date.now();
  try {
    const packet = await callBrain(sample);
    const brainEvent = {
      id: crypto.randomUUID(),
      provider: config.brainProvider,
      model: config.brainModel,
      mode: config.brainMode,
      purpose: "training_packet",
      ok: true,
      latencyMs: Date.now() - startedAt,
      input: sample.inputPacket,
      output: packet,
      timestamp: new Date().toISOString()
    };
    sample.brainOutput = packet;
    sample.brainEventId = brainEvent.id;
    db.brainEvents.push(brainEvent);
    db.trainingSamples.push(sample);
    return { sample, brainEvent };
  } catch (error) {
    const brainEvent = {
      id: crypto.randomUUID(),
      provider: config.brainProvider,
      model: config.brainModel,
      mode: config.brainMode,
      purpose: "training_packet",
      ok: false,
      error: error.message,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    };
    sample.brainError = error.message;
    sample.brainEventId = brainEvent.id;
    db.brainEvents.push(brainEvent);
    db.trainingSamples.push(sample);
    return { sample, brainEvent };
  }
}

function baseTrainingSample(db, { userText, inputPacket, expertProposal }) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    mode: "deepseek_answer_qwen_training",
    inputPacket: inputPacket || {
      originalText: userText,
      normalizedLanguage: "en",
      behaviorMode: db.activeStatusId || null,
      location: db.context?.locationTag || null,
      weather: db.context?.weather || null,
      activeProject: db.workingMemory?.activeProject || null,
      recentMemory: recentMemory(db, 5)
    },
    expertOutput: {
      provider: "deepseek",
      memoryTitle: expertProposal.memoryTitle || null,
      response: expertProposal.response,
      proposedActions: expertProposal.proposedActions,
      confidence: expertProposal.confidence
    },
    brainOutput: null,
    userFeedback: {
      accepted: null,
      edited: false,
      correction: null
    },
    createdAt: now
  };
}

async function callBrain(sample) {
  const endpoint = config.brainEndpoint.replace(/\/$/, "");
  try {
    return await callOpenAiCompatibleBrain(endpoint, sample);
  } catch (error) {
    if (/localhost:11434|127\.0\.0\.1:11434/.test(endpoint)) {
      return callOllamaBrain(endpoint, sample);
    }
    throw error;
  }
}

async function callOpenAiCompatibleBrain(endpoint, sample) {
  const response = await fetchWithTimeout(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.brainApiKey ? { Authorization: `Bearer ${config.brainApiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.brainModel,
      messages: [
        { role: "system", content: brainSystemPrompt() },
        { role: "user", content: JSON.stringify(sample, null, 2) }
      ],
      response_format: { type: "json_object" },
      think: false,
      temperature: 0.2
    })
  }, 12000);
  if (!response.ok) throw new Error(`Brain request failed: ${response.status} ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "";
  return parseBrainPacket(content, sample, "openai-compatible");
}

async function callOllamaBrain(endpoint, sample) {
  const response = await fetch(`${endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.brainModel,
      prompt: `${brainSystemPrompt()}\n\nTraining sample:\n${JSON.stringify(sample, null, 2)}`,
      stream: false,
      think: false,
      format: "json",
      options: {
        temperature: 0.2,
        num_predict: 700
      }
    })
  });
  if (!response.ok) throw new Error(`Ollama brain request failed: ${response.status} ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json();
  return parseBrainPacket(payload.response || "", sample, "ollama");
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseBrainPacket(content, sample, providerPath) {
  try {
    const packet = JSON.parse(String(content || "{}"));
    if (packet?.memory_packet) return packet;
    return fallbackBrainPacket(sample, `${providerPath}_empty_packet`);
  } catch {
    return fallbackBrainPacket(sample, `${providerPath}_invalid_json`);
  }
}

function fallbackBrainPacket(sample, reason) {
  return {
    normalized_input: {
      text_en: sample.inputPacket?.normalizedTextEn || sample.inputPacket?.originalText || "",
      task_type: sample.inputPacket?.taskType || "general",
      entities: sample.inputPacket?.entities || []
    },
    router_decision: {
      route: "local_future",
      confidence: 0.5,
      reason
    },
    memory_packet: {
      conversation_memory: {
        session: sample.inputPacket?.session || null,
        originalText: sample.inputPacket?.originalText || "",
        expertResponse: sample.expertOutput?.response || ""
      },
      project_memory: null,
      preference_memory: [],
      skill_memory: [],
      status_context: {
        behaviorMode: sample.inputPacket?.behaviorMode || null,
        routeLabel: sample.inputPacket?.session?.routeLabel || null
      },
      location_context: {
        location: sample.inputPacket?.context?.location || null,
        weather: sample.inputPacket?.context?.weather || null,
        temperature: sample.inputPacket?.context?.temperature ?? null
      },
      emotional_signal: null
    },
    learning_notes: [`Generated fallback packet because ${reason}.`],
    quality_score: 0.5
  };
}

function brainSystemPrompt() {
  return `You are Luma Brain. Do not answer the user directly.
DeepSeek is the default answering expert. Your job is training and memory formation.
Return JSON only:
{
  "normalized_input": {"text_en": string, "task_type": string, "entities": []},
  "router_decision": {"route": "deepseek"|"local_future", "confidence": number, "reason": string},
  "memory_packet": {
    "conversation_memory": object,
    "project_memory": object|null,
    "preference_memory": [],
    "skill_memory": [],
    "status_context": object,
    "location_context": object,
    "emotional_signal": object|null
  },
  "learning_notes": [],
  "quality_score": number
}`;
}
