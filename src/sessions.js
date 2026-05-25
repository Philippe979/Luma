import crypto from "node:crypto";
import { normalizeRouteLabel } from "./entry_routes.js";
import { isVisible, softDeleteRecord, withLifecycle } from "./lifecycle.js";

export function ensureActiveSession(db, options = {}) {
  db.sessions = db.sessions || [];
  const requestedId = options.sessionId || db.activeSessionId;
  const existing = requestedId ? db.sessions.find((session) => session.id === requestedId && isVisible(session) && session.state !== "archived") : null;
  if (existing) {
    db.activeSessionId = existing.id;
    return existing;
  }

  const legacy = db.sessions.find((session) => session.id === "default" && isVisible(session));
  if (legacy) {
    db.activeSessionId = legacy.id;
    return legacy;
  }

  return createSession(db, {
    id: "default",
    title: options.title || "General Session",
    routeLabel: options.routeLabel || "general",
    projectId: options.projectId || null
  });
}

export function createSession(db, { id = crypto.randomUUID(), title = "", routeLabel = "general", projectId = null } = {}) {
  db.sessions = db.sessions || [];
  const now = new Date().toISOString();
  const session = withLifecycle({
    id,
    title: title || "New Session",
    routeLabel: normalizeRouteLabel(routeLabel),
    projectId: projectId || null,
    summary: "",
    state: "active",
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null
  }, now);
  db.sessions.push(session);
  db.activeSessionId = session.id;
  return session;
}

export function activateFreshSession(db, routeLabel = "general") {
  const normalizedRoute = normalizeRouteLabel(routeLabel);
  const reusable = (db.sessions || []).find((session) => (
    session.state !== "archived" &&
    isVisible(session) &&
    session.routeLabel === normalizedRoute &&
    sessionMessageCount(db, session.id) === 0
  ));
  if (reusable) {
    db.activeSessionId = reusable.id;
    reusable.updatedAt = new Date().toISOString();
    reusable.messageCount = 0;
    return reusable;
  }

  return createSession(db, {
    title: "New Session",
    routeLabel: normalizedRoute
  });
}

export function activateSession(db, sessionId) {
  const session = (db.sessions || []).find((item) => item.id === sessionId && isVisible(item) && item.state !== "archived");
  if (!session) throw new Error("Session not found.");
  db.activeSessionId = session.id;
  session.updatedAt = new Date().toISOString();
  return session;
}

export function touchSession(db, sessionId, { titleHint = "", projectId = null, routeLabel = null } = {}) {
  const session = ensureActiveSession(db, { sessionId, routeLabel, projectId });
  const now = new Date().toISOString();
  session.updatedAt = now;
  session.lastMessageAt = now;
  session.messageCount = sessionMessageCount(db, session.id);
  if (projectId) session.projectId = projectId;
  if (routeLabel) session.routeLabel = normalizeRouteLabel(routeLabel);
  if ((!session.title || session.title === "New Session" || session.title === "General Session") && titleHint) {
    session.title = inferSessionTitle(titleHint);
  }
  return session;
}

export function sessionMessages(db, sessionId, limit = 40) {
  const id = sessionId || db.activeSessionId || "default";
  return (db.conversations || [])
    .filter((message) => message.conversationId === id)
    .slice(-limit);
}

export function recentSessions(db, limit = 12) {
  return recentSessionsForRoute(db, null, limit);
}

export function recentSessionsForRoute(db, routeLabel = null, limit = 12) {
  const normalizedRoute = routeLabel ? normalizeRouteLabel(routeLabel) : null;
  return [...(db.sessions || [])]
    .filter((session) => session.state !== "archived" && (!normalizedRoute || session.routeLabel === normalizedRoute))
    .filter(isVisible)
    .map((session) => ({ ...session, messageCount: sessionMessageCount(db, session.id) }))
    .sort((a, b) => String(b.lastMessageAt || b.updatedAt || "").localeCompare(String(a.lastMessageAt || a.updatedAt || "")))
    .slice(0, limit);
}

export function inferSessionTitle(text) {
  const cleaned = String(text || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "New Session";
  return cleaned.length > 42 ? `${cleaned.slice(0, 39)}...` : cleaned;
}

function sessionMessageCount(db, sessionId) {
  return (db.conversations || []).filter((message) => message.conversationId === sessionId).length;
}

export function softDeleteSession(db, sessionId, options = {}) {
  const session = (db.sessions || []).find((item) => item.id === sessionId);
  const deleted = softDeleteRecord(session, options);
  if (db.activeSessionId === sessionId) {
    const next = (db.sessions || []).find((item) => isVisible(item) && item.id !== sessionId);
    db.activeSessionId = next?.id || null;
  }
  return deleted;
}
