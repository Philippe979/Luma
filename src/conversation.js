import crypto from "node:crypto";

export function addSessionMessage(db, { role, content, source = "chat", sessionId = "default", routeLabel = "general", projectId = null }) {
  const message = {
    id: crypto.randomUUID(),
    conversationId: sessionId,
    role,
    content,
    source,
    routeLabel,
    projectId,
    timestamp: new Date().toISOString()
  };
  db.conversations = db.conversations || [];
  db.conversations.push(message);
  return message;
}
