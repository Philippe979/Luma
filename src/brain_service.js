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
  const response = await fetch(`${config.brainEndpoint.replace(/\/$/, "")}/v1/chat/completions`, {
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
      temperature: 0.2
    })
  });
  if (!response.ok) throw new Error(`Brain request failed: ${response.status} ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
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
