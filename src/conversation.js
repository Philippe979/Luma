import crypto from "node:crypto";

export function addSessionMessage(db, { role, content, source = "chat", sessionId = "default", routeLabel = "general", projectId = null, intent = "chat", outputType = "chat", metadata = {} }) {
  const message = {
    id: crypto.randomUUID(),
    conversationId: sessionId,
    role,
    content,
    source,
    routeLabel,
    projectId,
    intent,
    outputType,
    metadata,
    timestamp: new Date().toISOString()
  };
  db.conversations = db.conversations || [];
  db.conversations.push(message);
  return message;
}
