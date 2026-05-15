import crypto from "node:crypto";

export function startProcessTrace(db, { sessionId, routeLabel }) {
  db.processTraces = db.processTraces || [];
  const trace = {
    id: crypto.randomUUID(),
    sessionId,
    routeLabel,
    state: "running",
    steps: [],
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  db.processTraces.push(trace);
  return trace;
}

export function addProcessStep(trace, label, state = "done", detail = "") {
  trace.steps.push({
    label,
    state,
    detail,
    timestamp: new Date().toISOString()
  });
  return trace;
}

export function finishProcessTrace(trace, state = "done") {
  trace.state = state;
  trace.finishedAt = new Date().toISOString();
  return trace;
}

export function latestProcessTrace(db, sessionId = null) {
  const traces = sessionId
    ? (db.processTraces || []).filter((trace) => trace.sessionId === sessionId)
    : db.processTraces || [];
  return traces.at(-1) || null;
}
