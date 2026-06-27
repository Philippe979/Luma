let state = null;
let lastReceiptNote = "";
let pendingProposal = null;
let activeRouteLabel = "general";
let lastRenderedSessionId = null;
let currentSessionStartedAt = new Date().toISOString();
let pendingFiles = [];
let pendingAnimatedMessageId = null;
let typewriterTimer = null;
let lastWorkspaceRead = null;
const animatedMessageIds = new Set();
const WORKSHOP_STORAGE_KEY = "luma_workshop_preview_v1";
let workshopBlocks = [
  {
    id: "station-bonding",
    type: "station",
    title: "Bonding station",
    stage: "P1",
    attention: "high",
    fields: [
      ["Owner", "TBD"],
      ["Primary signal", "Yield instability"],
      ["Yield", "96.8%"],
      ["CT", "13.2 s"],
      ["UPH", "198"],
      ["NG", "18"],
      ["Next check", "Fixture alignment"]
    ],
    notes: ["Use this as the first editable background block for line process discussion."]
  },
  {
    id: "station-test",
    type: "station",
    title: "Functional test station",
    stage: "P1",
    attention: "normal",
    fields: [
      ["Owner", "TBD"],
      ["Primary signal", "Test coverage pending"],
      ["Yield", "98.9%"],
      ["CT", "9.8 s"],
      ["UPH", "240"],
      ["NG", "6"],
      ["Next check", "Fixture and software version"]
    ],
    notes: ["A second station makes the line view easier to inspect."]
  },
  {
    id: "meeting-line-review",
    type: "meeting",
    title: "Line review",
    stage: "P1",
    attention: "medium",
    fields: [
      ["Focus", "Station risk and BOM stage"],
      ["Output", "Checklist"]
    ],
    notes: ["Workshop blocks stay flexible; they are not limited to stations."]
  }
];
let workshopLog = [
  { role: "luma", text: "Workshop is a flexible background. Tell me what to add, highlight, or analyze." }
];
let editingWorkshopBlockId = null;
let activeStationDrag = null;

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const i18n = {
  en: {
    addReminderFirst: "Add a reminder first.",
    addStatusFirst: "Add a status first.",
    alertsEnabled: "Alerts enabled.",
    alertsNotEnabled: "Alerts were not enabled.",
    browserAlertsUnavailable: "Browser notifications are not available.",
    chatPlaceholder: "Ask Luma to write, plan, analyze, read files, or remember something.",
    confirmActions: "Confirm",
    contextUpdated: "Context updated.",
    codexCopied: "Codex context copied.",
    conversationArchive: "Archive",
    deepseekApiKey: "DeepSeek API Key",
    deepseekKeyPlaceholder: "Paste key once; stored only on this device",
    projectNameFirst: "Add a project name first.",
    projectSaved: "Project saved.",
    locationDenied: "Location permission was not granted.",
    locationNotAvailable: "Location is not available.",
    locationUpdated: "Location and weather updated.",
    locating: "Locating",
    noActiveReminders: "No active reminders for this status.",
    noMemoryYet: "No memory yet. Tell Luma one thing you want it to remember.",
    noReminders: "No reminders saved yet.",
    noSuggestionsYet: "Suggestions will appear after Luma has a little memory.",
    projects: "Projects",
    proposedActions: "Proposed Actions",
    refresh: "Refresh",
    reminderSaved: "Reminder saved",
    reminders: "reminders",
    send: "Send",
    settingsSaved: "Preferences saved.",
    statusIsActive: "is active.",
    statusUpdated: "Status updated.",
    suggestedActions: "Suggested Actions",
    unknown: "Unknown",
    usage: "Usage",
    useLocation: "Use Location",
    workingMemoryEmpty: "No active memory thread yet."
  },
  zh: {}
};
function t(key) {
  return (i18n[state?.settings?.language || "en"] || i18n.en)[key] || i18n.en[key] || key;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (response.status === 401) {
    showAuthGate(payload.error || "Access code required.");
    throw new Error(payload.error || "Access code required.");
  }
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

async function load(nextState = null) {
  state = nextState || await api("/api/state");
  $("authGate")?.classList.add("hidden");
  render();
}

function render() {
  renderLanguage();
  renderReceipt();
  renderTabs();
  renderContextNavigation();
  renderStatusControls();
  renderReminderControls();
  renderReminders();
  renderAllReminders();
  renderChatWorkspace();
  renderConversationArchive();
  renderProposal();
  renderMemoryWorkspace();
  renderUsage();
  renderWorkshop();
  renderSetup();
}

function renderLanguage() {
  $$("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  $$("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  $("languageInput").value = state.settings?.language || "en";
}

function renderReceipt() {
  const receipt = state.receipt;
  const statusLabel = receipt.statusId ? receipt.statusLabel : t("unknown");
  $("ambientStatus").textContent = receipt.statusId ? `${statusLabel} active` : "Status unknown";
  $("ambientTime").textContent = state.features.displayTime || receipt.time || t("unknown");
  $("ambientLocation").textContent = normalizeUnknown(receipt.location);
  $("ambientWeather").textContent = normalizeUnknown(receipt.weather);
  const brain = state.localLlm?.enabled ? state.localLlm.model : state.llm?.enabled ? state.llm.model : "local parser";
  $("ambientBrain").textContent = `Brain: ${brain}`;
  renderContextReceipt(receipt);
  if (lastReceiptNote) showNotice(lastReceiptNote);
}

function renderContextReceipt(receipt) {
  const routeId = activeRouteLabel || state.activeSession?.routeLabel || "general";
  const route = (state.entryRoutes || []).find((item) => item.id === routeId);
  const status = receipt.statusId ? receipt.statusLabel : "Status unknown";
  const location = normalizeUnknown(receipt.location);
  const weather = normalizeUnknown(receipt.weather);
  const time = state.features.displayTime || receipt.time || t("unknown");
  const needsCheck = !receipt.statusId || location === t("unknown");
  $("contextReceiptState").classList.toggle("needs-check", needsCheck);
  $("contextReceipt").classList.toggle("needs-check", needsCheck);
  $("contextReceipt").querySelector("strong").textContent = needsCheck ? "Context needs check" : "Context confirmed";
  $("contextReceiptLine").textContent = `${status}  - ${location}  - ${weather}  - ${time}  - ${route?.label || "General"}`;
}

function renderTabs() {
  for (const tab of $$(".tab")) {
    tab.onclick = () => switchView(tab.dataset.view);
  }
}

function renderContextNavigation() {
  if (state.activeSessionId !== lastRenderedSessionId) {
    activeRouteLabel = state.activeSession?.routeLabel || "general";
    lastRenderedSessionId = state.activeSessionId;
  }
  const activeRoute = (state.entryRoutes || []).find((route) => route.id === activeRouteLabel);
  $("activeRoutePill").textContent = activeRoute?.label || "General";

  $("entryRouteList").innerHTML = "";
  for (const route of state.entryRoutes || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = route.id === activeRouteLabel ? "route-item active" : "route-item";
    button.innerHTML = `<strong></strong><small></small>`;
    button.querySelector("strong").textContent = route.label;
    button.querySelector("small").textContent = route.tone;
    button.addEventListener("click", () => switchEntryRoute(route.id));
    $("entryRouteList").append(button);
  }

  $("sessionList").innerHTML = "";
  for (const session of state.sessions || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = session.id === state.activeSessionId ? "session-item active" : "session-item";
    button.innerHTML = `<strong></strong><small></small>`;
    button.querySelector("strong").textContent = session.title || "Untitled session";
    button.querySelector("small").textContent = [
      routeLabel(session.routeLabel),
      session.messageCount ? `${session.messageCount} messages` : "no messages yet"
    ].join(" - ");
    button.addEventListener("click", () => switchSession(session.id));
    $("sessionList").append(button);
  }
  if (!state.sessions?.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No sessions yet.";
    $("sessionList").append(empty);
  }
}

function renderStatusControls() {
  $("suggestionActions").innerHTML = "";
  for (const suggestion of state.suggestions) {
    const button = document.createElement("button");
    button.textContent = suggestion.label;
    button.className = suggestion.id === state.activeStatusId ? "primary" : "";
    button.addEventListener("click", () => switchStatus({ statusId: suggestion.id }));
    $("suggestionActions").append(button);
  }

  $("statusButtons").innerHTML = "";
  for (const item of state.statuses) {
    const button = document.createElement("button");
    button.textContent = item.label;
    button.className = item.id === state.activeStatusId ? "active" : "";
    button.addEventListener("click", () => switchStatus({ statusId: item.id }));
    $("statusButtons").append(button);
  }
}

function renderReminderControls() {
  $("reminderStatusInput").innerHTML = "";
  for (const status of state.statuses) {
    const option = document.createElement("option");
    option.value = status.id;
    option.textContent = status.label;
    option.selected = status.id === state.activeStatusId;
    $("reminderStatusInput").append(option);
  }
  $("reminderBindHint").textContent = state.activeStatus?.label || "choose status";
  updateReminderFieldVisibility();
}

function renderReminders() {
  $("reminderCount").textContent = String(state.activeReminders.length);
  $("reminderList").innerHTML = "";
  if (!state.activeReminders.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noActiveReminders");
    $("reminderList").append(empty);
  }
  for (const reminder of state.activeReminders) {
    $("reminderList").append(reminderRow(reminder, { editable: false }));
  }
}

function renderChatWorkspace() {
  $("chatMessages").innerHTML = "";
  $("chatGreeting").textContent = greetingText();
  const messages = (state.sessionMessages || []).slice(-24);
  const chatCard = document.querySelector(".chat-card");
  if (chatCard) chatCard.classList.toggle("is-empty", !messages.length);
  if (!messages.length) {
    $("processPanel").classList.add("hidden");
    $("processList").innerHTML = "";
    return;
  }

  for (const message of messages) {
    const bubble = document.createElement("div");
    const outputType = message.outputType || message.metadata?.outputType || inferMessageOutputType(message.content);
    bubble.className = `message ${message.role === "user" ? "user" : "assistant"} ${message.role === "assistant" ? `assistant-document output-${outputType}` : ""}`;
    if (message.role === "assistant") {
      const content = message.metadata?.finalAnswer || message.content;
      const comparison = message.metadata?.modelComparison;
      const shouldAnimate = message.id && message.id === pendingAnimatedMessageId && !animatedMessageIds.has(message.id);
      if (comparison) {
        renderModelComparison(bubble, comparison, message);
      } else {
        renderRichMessage(bubble, shouldAnimate ? "" : content, {
          intent: message.intent || message.metadata?.intent,
          outputType
        });
      }
      if (shouldAnimate && !comparison) animateRichMessage(bubble, content, {
        intent: message.intent || message.metadata?.intent,
        outputType,
        messageId: message.id
      });
    } else {
      bubble.textContent = message.content;
    }
    $("chatMessages").append(bubble);
  }
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  renderProcessPanel();
}

function renderProcessPanel() {
  const trace = state.latestProcess;
  $("processPanel").classList.toggle("hidden", !trace);
  $("processList").innerHTML = "";
  if (!trace) return;
  for (const step of trace.steps || []) {
    const row = document.createElement("div");
    row.className = "process-step";
    row.innerHTML = `<span></span><div><strong></strong><small></small></div>`;
    row.querySelector("span").textContent = step.state === "running" ? "..." : "done";
    row.querySelector("strong").textContent = step.label;
    row.querySelector("small").textContent = step.detail || formatShortTime(step.timestamp);
    $("processList").append(row);
  }
}

function renderConversationArchive() {
  const archived = archiveSessions();
  $("conversationArchiveCount").textContent = archived.length;
  $("conversationArchiveList").innerHTML = "";

  if (!archived.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No archived chat yet.";
    $("conversationArchiveList").append(empty);
    return;
  }

  for (const session of archived) {
    const item = document.createElement("div");
    item.className = "archive-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    const title = document.createElement("strong");
    title.textContent = session.title;
    const time = document.createElement("small");
    time.textContent = [formatShortTime(session.lastMessageAt || session.updatedAt), `${session.messageCount} messages`].filter(Boolean).join(" - ");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini-delete";
    del.textContent = "Delete";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSession(session.id, session.title);
    });
    item.append(title, time, del);
    item.addEventListener("click", () => switchSession(session.id));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") switchSession(session.id);
    });
    $("conversationArchiveList").append(item);
  }
}

function archiveSessions() {
  const sessionMap = new Map();
  for (const session of state.sessions || []) {
    if (session.id !== state.activeSessionId) {
      sessionMap.set(session.id, { ...session, messages: [], messageCount: session.messageCount || 0 });
    }
  }
  for (const message of state.conversations || []) {
    if (message.conversationId === state.activeSessionId) continue;
    const existing = sessionMap.get(message.conversationId) || {
      id: message.conversationId,
      title: "",
      routeLabel: message.routeLabel || "general",
      messages: [],
      messageCount: 0,
      updatedAt: message.timestamp,
      lastMessageAt: message.timestamp
    };
    existing.messages.push(message);
    existing.messageCount = existing.messages.length;
    existing.lastMessageAt = message.timestamp;
    if (!existing.title && message.role === "user") existing.title = archiveTitle(message.content);
    sessionMap.set(message.conversationId, existing);
  }
  return [...sessionMap.values()]
    .map((session) => ({
      ...session,
      title: archiveTitle(session.title || session.messages?.find((message) => message.role === "user")?.content || "Luma session")
    }))
    .sort((a, b) => String(b.lastMessageAt || b.updatedAt || "").localeCompare(String(a.lastMessageAt || a.updatedAt || "")))
    .slice(0, 12);
}

function archiveTitle(text) {
  const cleaned = String(text || "Luma session").replace(/\s+/g, " ").trim();
  return cleaned.length > 42 ? `${cleaned.slice(0, 39)}...` : cleaned;
}

function formatShortTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function routeLabel(id) {
  return (state.entryRoutes || []).find((route) => route.id === id)?.label || "General";
}

function greetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}
function renderProposal() {
  const hasActions = Boolean(pendingProposal?.proposedActions?.length);
  $("proposalPanel").classList.toggle("hidden", !hasActions);
  if (!hasActions) return;

  $("proposalSummary").textContent = pendingProposal.response || "";
  $("proposalActions").innerHTML = "";
  for (const action of pendingProposal.proposedActions || []) {
    const row = document.createElement("div");
    row.className = "proposal-action";
    const title = document.createElement("strong");
    title.textContent = actionTitle(action.tool);
    const reason = document.createElement("small");
    reason.textContent = action.reason || "";
    const args = document.createElement("code");
    args.textContent = JSON.stringify(action.args || {});
    row.append(title, reason, args);
    $("proposalActions").append(row);
  }
}

function renderMemoryWorkspace() {
  const memory = state.workingMemory || {};
  const bits = [];
  if (memory.activeProject) bits.push(`Project: ${memory.activeProject}`);
  if (memory.lastProgress) bits.push(`Progress: ${memory.lastProgress}`);
  if (memory.nextStep) bits.push(`Next: ${memory.nextStep}`);
  $("workingMemoryLine").textContent = bits.length ? bits.join(" - ") : t("workingMemoryEmpty");

  const memoryLine = $("workingMemoryLine");
  memoryLine.innerHTML = "";
  memoryLine.classList.toggle("hidden", !memory.activeProject);
  if (memory.activeProject) {
    const label = document.createElement("span");
    label.textContent = `Project context: ${memory.activeProject}`;
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exit";
    exit.addEventListener("click", startFreshSession);
    memoryLine.append(label, exit);
  }

  $("projectCount").textContent = String(state.projects?.length || 0);
  $("projectList").innerHTML = "";
  if (!state.projects?.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "Create a project in Setup first.";
    $("projectList").append(empty);
  }
  for (const project of (state.projects || []).slice(-5).reverse()) {
    const row = document.createElement("div");
    row.className = "project-item";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.innerHTML = `<strong></strong><small></small>`;
    row.querySelector("strong").textContent = project.name;
    row.querySelector("small").textContent = [project.state, project.nextStep ? `next: ${project.nextStep}` : ""].filter(Boolean).join(" - ");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini-delete";
    del.textContent = "Delete";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteProject(project.id, project.name);
    });
    row.append(del);
    row.addEventListener("click", () => activateProject(project.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activateProject(project.id);
    });
    $("projectList").append(row);
  }

  const usage = state.usage?.today || {};
  $("todayTokenPill").textContent = String(usage.totalTokens || 0);
  $("usageMiniLine").textContent = `${usage.calls || 0} calls - ${Number(usage.cost || 0).toFixed(6)}`;

  $("suggestedActionList").innerHTML = "";
  const suggestions = state.suggestedActions?.length ? state.suggestedActions : state.actionCards || [];
  if (!suggestions.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noSuggestionsYet");
    $("suggestedActionList").append(empty);
  }
  for (const suggestion of suggestions.slice(0, 4)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-card";
    button.innerHTML = `<span></span><strong></strong><small></small>`;
    button.querySelector("span").textContent = "->";
    button.querySelector("strong").textContent = suggestion.label || actionTitle(suggestion.tool);
    button.querySelector("small").textContent = suggestion.reason || suggestion.source || "local";
    button.addEventListener("click", () => {
      $("chatInput").value = suggestedPrompt(suggestion);
      $("chatInput").focus();
    });
    $("suggestedActionList").append(button);
  }
}

function renderUsage() {
  const usage = state.usage || { today: {}, days: [], recent: [] };
  $("todayTokens").textContent = String(usage.today.totalTokens || 0);
  $("todayInputTokens").textContent = String(usage.today.inputTokens || 0);
  $("todayOutputTokens").textContent = String(usage.today.outputTokens || 0);
  $("todaySavedTokens").textContent = String(usage.today.savedTokens || 0);
  $("usageCostPill").textContent = `$${Number(usage.today.cost || 0).toFixed(6)}`;
  $("usageCallCount").textContent = String(usage.recent.length || 0);

  const max = Math.max(1, ...(usage.days || []).map((day) => day.totalTokens || 0));
  $("usageChart").innerHTML = "";
  for (const day of usage.days || []) {
    const bar = document.createElement("div");
    bar.className = "usage-bar";
    bar.innerHTML = `<div><span></span></div><small></small><strong></strong>`;
    bar.querySelector("div").style.height = `${Math.max(6, Math.round(((day.totalTokens || 0) / max) * 120))}px`;
    bar.querySelector("small").textContent = day.label;
    bar.querySelector("strong").textContent = String(day.totalTokens || 0);
    $("usageChart").append(bar);
  }

  $("usageList").innerHTML = "";
  if (!usage.recent.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No model calls yet.";
    $("usageList").append(empty);
  }
  for (const item of usage.recent) {
    const row = document.createElement("div");
    row.className = "usage-row";
    row.innerHTML = `<strong></strong><small></small><span></span>`;
    row.querySelector("strong").textContent = `${item.provider}  - ${item.model}`;
    row.querySelector("small").textContent = `${item.reason}  - ${new Date(item.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    row.querySelector("span").textContent = `${item.totalTokens} tok  - $${Number(item.estimatedCostUsd || 0).toFixed(6)}`;
    $("usageList").append(row);
  }

  renderCapabilities();
  renderMemoryIndex();
}

function renderWorkshop() {
  const blockList = $("workshopBlocks");
  const lineList = $("workshopLine");
  const logList = $("workshopLog");
  const attentionList = $("workshopAttentionList");
  if (!blockList || !lineList || !logList || !attentionList) return;

  lineList.innerHTML = "";
  const stations = workshopBlocks.filter((block) => block.type === "station");
  for (const [index, block] of stations.entries()) {
    ensureStationPosition(block, index);
    const node = document.createElement("article");
    node.className = `line-station attention-${block.attention || "normal"}${block.id === editingWorkshopBlockId ? " selected" : ""}`;
    node.dataset.stationId = block.id;
    node.style.left = `${block.position.x}px`;
    node.style.top = `${block.position.y}px`;
    node.innerHTML = `
      <div class="line-station-index"></div>
      <div class="line-station-body">
        <button class="workshop-delete" type="button" aria-label="Delete station">x</button>
        <div class="station-title-line">
          <span class="station-health-dot"></span>
          <strong></strong>
        </div>
        <small></small>
        <div class="station-metrics"></div>
        <div class="line-station-signal"></div>
      </div>
    `;
    node.querySelector(".line-station-index").textContent = String(index + 1).padStart(2, "0");
    node.querySelector("strong").textContent = block.title;
    node.querySelector("small").textContent = `${block.stage || "open"}  - ${block.attention || "normal"}`;
    const metrics = node.querySelector(".station-metrics");
    for (const [label, value] of stationDisplayFields(block)) {
      const item = document.createElement("div");
      item.innerHTML = `<span></span><b></b>`;
      item.querySelector("span").textContent = label;
      item.querySelector("b").textContent = value || "--";
      metrics.append(item);
    }
    node.querySelector(".line-station-signal").textContent = fieldValue(block.fields, "Primary signal") || block.notes?.[0] || "No signal yet";
    node.querySelector(".workshop-delete").addEventListener("click", () => deleteWorkshopBlock(block.id));
    node.querySelector(".line-station-body").addEventListener("pointerdown", (event) => startStationDrag(event, node, block));
    node.querySelector(".line-station-body").addEventListener("click", (event) => {
      if (event.target.closest(".workshop-delete")) return;
      if (node.dataset.wasDragged === "true") return;
      openStationEditor(block.id);
    });
    lineList.append(node);
  }
  if (!stations.length) {
    const empty = document.createElement("div");
    empty.className = "line-empty";
    empty.textContent = "No stations yet. Add one or ask Luma to create it.";
    lineList.append(empty);
  }

  blockList.innerHTML = "";
  const supportingBlocks = workshopBlocks.filter((block) => block.type !== "station");
  for (const block of supportingBlocks) {
    const card = document.createElement("article");
    card.className = `workshop-block attention-${block.attention || "normal"}`;
    card.innerHTML = `
      <div class="workshop-block-head">
        <span></span>
        <strong></strong>
        <button class="workshop-delete" type="button" aria-label="Delete background">x</button>
        <small></small>
      </div>
      <div class="workshop-fields"></div>
      <div class="workshop-notes"></div>
    `;
    card.querySelector("span").textContent = blockIcon(block.type);
    card.querySelector("strong").textContent = block.title;
    card.querySelector("small").textContent = `${block.type}  - ${block.stage || "open"}  - ${block.attention || "normal"}`;
    card.querySelector(".workshop-delete").addEventListener("click", () => deleteWorkshopBlock(block.id));
    const fields = card.querySelector(".workshop-fields");
    for (const [label, value] of block.fields || []) {
      const row = document.createElement("div");
      row.innerHTML = `<span></span><b></b>`;
      row.querySelector("span").textContent = label;
      row.querySelector("b").textContent = value;
      fields.append(row);
    }
    const notes = card.querySelector(".workshop-notes");
    for (const note of block.notes || []) {
      const p = document.createElement("p");
      p.textContent = note;
      notes.append(p);
    }
    blockList.append(card);
  }
  if (!supportingBlocks.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No supporting background yet.";
    blockList.append(empty);
  }

  renderWorkshopAttention(attentionList);

  logList.innerHTML = "";
  for (const entry of workshopLog.slice(-8)) {
    const item = document.createElement("div");
    item.className = `workshop-log-item ${entry.role}`;
    item.textContent = entry.text;
    logList.append(item);
  }
  logList.scrollTop = logList.scrollHeight;
}
function fieldValue(fields = [], label) {
  return (fields || []).find(([itemLabel]) => itemLabel === label)?.[1] || "";
}

function stationDisplayFields(block) {
  const hidden = new Set(["Owner", "Primary signal", "Next check", "Status"]);
  const values = (block.fields || []).filter(([label]) => !hidden.has(label));
  const fallback = block.fields?.length ? block.fields : [["Data", "--"]];
  return (values.length ? values : fallback).slice(0, 6);
}

function ensureStationPosition(block, index = 0) {
  if (block.position && Number.isFinite(block.position.x) && Number.isFinite(block.position.y)) return;
  block.position = defaultStationPosition(index);
}

function defaultStationPosition(index) {
  const columns = 3;
  const width = 270;
  const height = 238;
  return {
    x: 24 + (index % columns) * width,
    y: 32 + Math.floor(index / columns) * height
  };
}

function startStationDrag(event, node, block) {
  if (event.button !== 0 || event.target.closest(".workshop-delete")) return;
  const canvas = $("workshopLine");
  const nodeRect = node.getBoundingClientRect();
  activeStationDrag = {
    node,
    block,
    canvas,
    offsetX: event.clientX - nodeRect.left,
    offsetY: event.clientY - nodeRect.top,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
  node.classList.add("dragging");
  node.setPointerCapture?.(event.pointerId);
  node.dataset.wasDragged = "false";
  event.preventDefault();
}

function updateStationDrag(event) {
  if (!activeStationDrag) return;
  const { node, block, canvas, offsetX, offsetY, startX, startY } = activeStationDrag;
  const moved = Math.abs(event.clientX - startX) > 3 || Math.abs(event.clientY - startY) > 3;
  activeStationDrag.moved = activeStationDrag.moved || moved;
  const canvasRect = canvas.getBoundingClientRect();
  const maxX = Math.max(12, canvas.scrollWidth - node.offsetWidth - 12);
  const maxY = Math.max(12, canvas.scrollHeight - node.offsetHeight - 12);
  const x = clamp(event.clientX - canvasRect.left + canvas.scrollLeft - offsetX, 12, maxX);
  const y = clamp(event.clientY - canvasRect.top + canvas.scrollTop - offsetY, 12, maxY);
  block.position = { x: Math.round(x), y: Math.round(y) };
  node.style.left = `${block.position.x}px`;
  node.style.top = `${block.position.y}px`;
  node.dataset.wasDragged = activeStationDrag.moved ? "true" : "false";
}

function finishStationDrag() {
  if (!activeStationDrag) return;
  const { node, moved } = activeStationDrag;
  node.classList.remove("dragging");
  if (moved) {
    node.dataset.wasDragged = "true";
    saveWorkshopState();
    setTimeout(() => {
      node.dataset.wasDragged = "false";
    }, 120);
  }
  activeStationDrag = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderWorkshopAttention(node) {
  const items = workshopBlocks
    .filter((block) => block.type === "station" && (block.attention === "high" || block.attention === "medium"))
    .slice(0, 10);
  node.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "attention-empty";
    empty.textContent = "No station needs attention.";
    node.append(empty);
    return;
  }
  for (const block of items) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `attention-item attention-${block.attention || "normal"}`;
    item.innerHTML = `<span></span><strong></strong><small></small>`;
    item.querySelector("span").textContent = blockIcon(block.type);
    item.querySelector("strong").textContent = block.title;
    item.querySelector("small").textContent = `${block.type}  - ${block.stage || "open"}  - ${block.attention || "normal"}`;
    item.addEventListener("click", () => {
      if (block.type === "station") openStationEditor(block.id);
      workshopLog.push({ role: "luma", text: `${block.title}: ${fieldValue(block.fields, "Primary signal") || block.notes?.[0] || "Needs review."}` });
      renderWorkshop();
    });
    node.append(item);
  }
}

function deleteWorkshopBlock(id) {
  const block = workshopBlocks.find((item) => item.id === id);
  workshopBlocks = workshopBlocks.filter((item) => item.id !== id);
  if (editingWorkshopBlockId === id) closeStationEditor();
  workshopLog.push({ role: "luma", text: `Removed ${block?.title || "that block"} from the workshop preview.` });
  saveWorkshopState();
  renderWorkshop();
}

function openStationEditor(id) {
  const block = workshopBlocks.find((item) => item.id === id && item.type === "station");
  if (!block) return;
  editingWorkshopBlockId = id;
  $("stationTitleInput").value = block.title || "";
  $("stationStageInput").value = block.stage || activeWorkshopStage();
  $("stationAttentionInput").value = block.attention || "normal";
  $("stationSignalInput").value = fieldValue(block.fields, "Primary signal") || "";
  $("stationNoteInput").value = block.notes?.[0] || "";
  $("stationFieldsInput").value = serializeStationFields(block.fields);
  $("stationEditorSummary").textContent = `Edit: ${block.title}`;
  $("stationEditor").classList.remove("hidden");
  $("stationEditor").open = true;
  renderWorkshop();
}

function closeStationEditor() {
  editingWorkshopBlockId = null;
  const editor = $("stationEditor");
  if (editor) {
    editor.open = false;
    editor.classList.add("hidden");
  }
  if ($("stationEditorSummary")) $("stationEditorSummary").textContent = "Edit selected station";
}

function blockIcon(type) {
  return {
    station: "S",
    issue: "!",
    meeting: "M",
    cost: "$",
    reminder: "R",
    checklist: "C",
    note: "N"
  }[type] || "B";
}

async function submitWorkshopToLuma(text) {
  workshopLog.push({ role: "user", text });
  workshopLog.push({ role: "luma", text: "Thinking with workshop context..." });
  renderWorkshop();
  try {
    const result = await api("/api/chat/propose", {
      method: "POST",
      body: JSON.stringify({
        text,
        routeLabel: "workshop",
        persistConversation: false,
        surfaceContext: buildWorkshopSurfaceContext(),
        modelRouting: {
          mode: state.llmRegistry?.mode || "manual",
          selectedProviderId: state.llmRegistry?.selectedProviderId || "deepseek",
          compareProviderIds: state.llmRegistry?.compareProviderIds || [],
          reviewProviderIds: state.llmRegistry?.reviewProviderIds || []
        }
      })
    });
    workshopLog = workshopLog.filter((entry) => entry.text !== "Thinking with workshop context...");
    const answer = result.proposal?.finalAnswer || result.proposal?.response || result.proposal?.assistantNotice || "Luma did not return a workshop answer.";
    workshopLog.push({ role: "luma", text: answer });
    if (shouldApplyWorkshopMutation(text)) {
      handleWorkshopCommand(text, { skipUserLog: true, quiet: true });
    }
    saveWorkshopState();
    await load(result.state);
  } catch (error) {
    workshopLog = workshopLog.filter((entry) => entry.text !== "Thinking with workshop context...");
    workshopLog.push({ role: "luma", text: "Main Luma was unavailable, so I used the local workshop editor instead." });
    handleWorkshopCommand(text, { skipUserLog: true });
    showNotice(error.message || "Workshop Luma failed.");
  }
}

function buildWorkshopSurfaceContext() {
  return {
    surface: "workshop",
    clusterId: "workshop.production_line",
    label: "Production line workshop",
    activeStage: activeWorkshopStage(),
    retrievalPolicy: "surface_only",
    workshop: {
      activeStage: activeWorkshopStage(),
      blocks: workshopBlocks,
      recentLog: workshopLog.slice(-8)
    },
    file: lastWorkspaceRead ? {
      path: lastWorkspaceRead.path,
      title: lastWorkspaceRead.title,
      fileType: lastWorkspaceRead.fileType,
      summary: lastWorkspaceRead.summary,
      headers: lastWorkspaceRead.metadata?.headers || null
    } : null
  };
}

function handleWorkshopCommand(text, options = {}) {
  const value = String(text || "").trim();
  if (!value) return;
  if (!options.skipUserLog) workshopLog.push({ role: "user", text: value });
  const lower = value.toLowerCase();
  const mentionsYield = /yield|uph|poor|ng|defect|quality|良率|产出|不达标|缺陷|质量/.test(lower);
  const mentionsHighlight = /highlight|risk|attention|important|urgent|issue|高亮|标记|注意|风险|重要|紧急|问题/.test(lower);
  const asksWhy = /why|analyze|analysis|reason|because|root cause|为什么|分析|原因|根因/.test(lower);
  const addStation = /add|create|new|创建|新增|添加/.test(lower) && /station|workstation|line|工站|产线/.test(lower);
  const target = findWorkshopBlock(value);

  if (addStation) {
    const title = stationTitleFromText(value);
    const stationCount = workshopBlocks.filter((block) => block.type === "station").length;
    workshopBlocks.push({
      id: `station-${Date.now()}`,
      type: "station",
      title,
      stage: activeWorkshopStage(),
      attention: mentionsHighlight ? "high" : "normal",
      position: defaultStationPosition(stationCount),
      fields: [
        ["Primary signal", mentionsYield ? "Yield issue" : "new station"],
        ["Type", /manual/.test(lower) ? "manual" : /auto|automation/.test(lower) ? "automation" : "open"],
        ["BOM", activeWorkshopStage()]
      ],
      notes: [value]
    });
    if (!options.quiet) workshopLog.push({ role: "luma", text: `Added ${title} as a flexible station block.` });
    saveWorkshopState();
    renderWorkshop();
    return;
  }

  if (target && mentionsHighlight) {
    target.attention = "high";
    target.notes = [...(target.notes || []), value];
    if (mentionsYield) target.fields = upsertField(target.fields, "Primary signal", "Yield issue");
    if (!options.quiet) workshopLog.push({ role: "luma", text: `Highlighted ${target.title}. I also kept your note inside the background.` });
    saveWorkshopState();
    renderWorkshop();
    return;
  }

  if (target && asksWhy) {
    if (!options.quiet) {
      workshopLog.push({
        role: "luma",
        text: `${target.title} may need checks around input material variation, fixture alignment, equipment parameter drift, operator method, and inspection criteria. I would first compare yield by time, operator, lot, and station parameter changes.`
      });
    }
    renderWorkshop();
    return;
  }

  workshopBlocks.push({
    id: `note-${Date.now()}`,
    type: mentionsYield ? "issue" : "note",
    title: mentionsYield ? "Yield note" : "Open note",
    stage: activeWorkshopStage(),
    attention: mentionsHighlight ? "high" : "normal",
    fields: [["Source", "Luma command"]],
    notes: [value]
  });
  if (!options.quiet) workshopLog.push({ role: "luma", text: "Added this as a flexible background note. You can turn it into a station, issue, reminder, or checklist later." });
  saveWorkshopState();
  renderWorkshop();
}

function shouldApplyWorkshopMutation(text) {
  const value = String(text || "").toLowerCase();
  return /add|create|new|highlight|risk|attention|important|urgent|issue|remove|delete|update|set|uph|yield|ng|defect|创建|新增|添加|高亮|标记|删除|更新|注意|风险|问题|不达标|缺陷|质量/.test(value);
}

function findWorkshopBlock(text) {
  const value = String(text || "").toLowerCase();
  return workshopBlocks.find((block) => value.includes(block.title.toLowerCase().split(" ")[0]));
}

function stationTitleFromText(text) {
  const named = String(text || "").match(/(?:called|named|name\s+it|叫做|叫|命名为)\s*["“]?([A-Za-z0-9_\-\u4e00-\u9fa5 ]{1,32})/i);
  if (named?.[1]) {
    const title = named[1].replace(/[”"。,.，、].*$/, "").trim();
    if (title) return /station|workstation|工站/i.test(title) ? title : `${title} station`;
  }
  const cleaned = String(text || "")
    .replace(/add|create|new|station|workstation|line|创建|新增|添加|工站|产线/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? `${cleaned.slice(0, 32)} station` : "New station";
}
function activeWorkshopStage() {
  return document.querySelector(".stage-pill.active")?.textContent || "P1";
}

function upsertField(fields = [], label, value) {
  const next = [...fields];
  const index = next.findIndex(([itemLabel]) => itemLabel === label);
  if (index >= 0) next[index] = [label, value];
  else next.push([label, value]);
  return next;
}

function serializeStationFields(fields = []) {
  return (fields || [])
    .filter(([label]) => label !== "Primary signal")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function parseStationFields(text, primarySignal) {
  const fields = [];
  if (primarySignal) fields.push(["Primary signal", primarySignal]);
  for (const line of String(text || "").split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    const separator = value.includes(":") ? ":" : "";
    if (!separator) {
      fields.push(["Note", value]);
      continue;
    }
    const [rawLabel, ...rest] = value.split(separator);
    const label = rawLabel.trim();
    const fieldValue = rest.join(separator).trim();
    if (!label || label === "Primary signal") continue;
    fields.push([label, fieldValue || "--"]);
  }
  return fields.length ? fields : [["Primary signal", primarySignal || "No signal yet"]];
}

function saveWorkshopState() {
  try {
    localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify({ blocks: workshopBlocks, log: workshopLog.slice(-16) }));
  } catch {
    // Private browsing can block local storage; the preview still works in memory.
  }
}

function loadWorkshopState() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSHOP_STORAGE_KEY) || "null");
    if (Array.isArray(saved?.blocks)) workshopBlocks = saved.blocks;
    if (Array.isArray(saved?.log)) workshopLog = saved.log;
  } catch {
    // Ignore corrupt local workshop previews.
  }
}

function renderRichMessage(node, content, meta = {}) {
  node.dataset.intent = meta.intent || "direct_answer";
  node.dataset.outputType = meta.outputType || inferMessageOutputType(content);
  node.innerHTML = safeMarkdown(content);
}

function renderModelComparison(node, comparison, message = {}) {
  node.dataset.intent = message.intent || message.metadata?.intent || "direct_answer";
  node.dataset.outputType = "comparison";
  node.classList.add("model-comparison-message");
  const responses = Array.isArray(comparison.responses) ? comparison.responses : [];
  node.innerHTML = `
    <div class="model-comparison-block">
      <div class="comparison-header">
        <div>
          <span class="eyebrow">Model workspace</span>
          <h3>${escapeHtml(comparison.mode === "review" ? "Review Output" : "Compare Output")}</h3>
        </div>
        <span class="comparison-pill">${escapeHtml(comparison.mode || "manual")}</span>
      </div>
      <section class="comparison-summary">
        <div class="section-label">Luma synthesis</div>
        <div class="rich-slot">${safeMarkdown(comparison.synthesis || message.content || "")}</div>
      </section>
      <details class="comparison-details">
        <summary>View model responses</summary>
        <div class="model-response-grid"></div>
      </details>
      <div class="comparison-note">${escapeHtml(comparison.note || "")}</div>
    </div>
  `;
  const grid = node.querySelector(".model-response-grid");
  for (const response of responses) {
    const card = document.createElement("article");
    card.className = `model-response-card ${response.error ? "has-error" : ""}`;
    card.innerHTML = `
      <div class="model-response-head">
        <div>
          <strong>${escapeHtml(response.label || response.providerId || "model")}</strong>
          <small>${escapeHtml(response.model || "unknown model")}</small>
        </div>
        <span>${escapeHtml(response.role || "answer")}</span>
      </div>
      <div class="rich-slot">${safeMarkdown(response.content || "")}</div>
      <div class="model-response-meta">
        <span>${response.tokens ? `${escapeHtml(String(response.tokens))} tokens` : "tokens n/a"}</span>
        <span>${response.latencyMs ? `${escapeHtml(String(response.latencyMs))} ms` : "latency n/a"}</span>
      </div>
      <div class="preference-buttons">
        <button type="button" data-signal="use_this">Use this</button>
        <button type="button" data-signal="better_reasoning">Reasoning</button>
        <button type="button" data-signal="better_tone">Tone</button>
        <button type="button" data-signal="better_structure">Structure</button>
        <button type="button" data-signal="too_vague">Too vague</button>
        <button type="button" data-signal="wrong_direction">Wrong</button>
      </div>
    `;
    card.querySelectorAll(".preference-buttons button").forEach((button) => {
      button.addEventListener("click", () => sendModelPreference({
        comparisonId: comparison.id,
        messageId: message.id,
        sessionId: message.sessionId || state.activeSessionId,
        taskType: inferTaskTypeForPreference(message.content || comparison.synthesis),
        providerId: response.providerId,
        model: response.model,
        signal: button.dataset.signal
      }));
    });
    grid.append(card);
  }
}

function inferTaskTypeForPreference(content) {
  const value = String(content || "").toLowerCase();
  if (/```|code|javascript|python|sql/.test(value)) return "code";
  if (/table|csv|excel|xlsx|sheet/.test(value)) return "data";
  if (/report|summary|essay|\u6587\u6863|\u62a5\u544a|\u603b\u7ed3/.test(value)) return "writing";
  return "general";
}

async function sendModelPreference(body) {
  try {
    const result = await api("/api/model-preferences", {
      method: "POST",
      body: JSON.stringify(body)
    });
    lastReceiptNote = "Model preference saved.";
    await load(result.state);
  } catch (error) {
    showNotice(error.message || "Could not save model preference.");
  }
}

function animateRichMessage(node, content, meta = {}) {
  const value = String(content || "");
  const chunk = value.length > 1000 ? 8 : 4;
  let index = 0;
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
  animatedMessageIds.add(meta.messageId);
  typewriterTimer = setInterval(() => {
    index = Math.min(value.length, index + chunk);
    renderRichMessage(node, value.slice(0, index), meta);
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
    if (index >= value.length) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      if (pendingAnimatedMessageId === meta.messageId) pendingAnimatedMessageId = null;
    }
  }, 18);
}

function safeMarkdown(content) {
  const escaped = escapeHtml(String(content || ""));
  const lines = escaped.split(/\r?\n/);
  const html = [];
  let listType = null;
  let inCode = false;
  let code = [];
  let table = [];

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };
  const flushTable = () => {
    if (!table.length) return;
    html.push(renderMarkdownTable(table));
    table = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushTable();
      closeList();
      if (inCode) {
        html.push(`<pre><code>${code.join("\n")}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (isTableLine(line)) {
      closeList();
      table.push(line);
      continue;
    }
    flushTable();
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdown(numbered[2])}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,4})\s+(.+)/);
    if (heading) {
      const level = Math.min(4, heading[1].length + 1);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const quote = line.match(/^&gt;\s+(.+)/);
    if (quote) {
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      html.push("<hr>");
      continue;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  flushTable();
  closeList();
  if (inCode) html.push(`<pre><code>${code.join("\n")}</code></pre>`);
  return html.join("\n");
}

function inlineMarkdown(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inferMessageOutputType(content) {
  const value = String(content || "");
  if (/```/.test(value)) return "code";
  if (/\|.+\|/.test(value) && /\n\s*\|?\s*[-:]+\s*\|/.test(value)) return "table";
  if (/\$\$|\\\(|\\\[/.test(value)) return "math";
  if (/^#{1,6}\s+/m.test(value) || /^\s*\d+[.)]\s+/m.test(value) || /^\s*[-*]\s+/m.test(value)) return "document";
  return value.length > 420 ? "document" : "chat";
}

function isTableLine(line) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function renderMarkdownTable(rows) {
  if (rows.length < 2 || !/^\s*\|?\s*[-:| ]+\s*\|?\s*$/.test(rows[1])) {
    return rows.map((row) => `<p>${inlineMarkdown(row)}</p>`).join("\n");
  }
  const cells = rows.map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => inlineMarkdown(cell.trim())));
  const [head, , ...body] = cells;
  const header = `<thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("\n")}</tr></thead>`;
  const bodyHtml = `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("\n")}</tr>`).join("\n")}</tbody>`;
  return `<div class="table-wrap"><table>${header}${bodyHtml}</table></div>`;
}

function renderCapabilities() {
  const capabilities = state.capabilities?.capabilities || [];
  $("capabilityCount").textContent = `${state.capabilities?.available || 0}/${state.capabilities?.total || 0}`;
  $("capabilityList").innerHTML = "";
  if (!capabilities.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No capabilities registered.";
    $("capabilityList").append(empty);
    return;
  }
  for (const capability of capabilities) {
    const row = document.createElement("div");
    row.className = "usage-row";
    row.innerHTML = `<strong></strong><small></small><span></span>`;
    row.querySelector("strong").textContent = capability.id;
    row.querySelector("small").textContent = capability.description;
    row.querySelector("span").textContent = `${capability.state}  - ${capability.adapter}`;
    $("capabilityList").append(row);
  }
}

function renderMemoryIndex() {
  const index = state.memoryIndex || {};
  $("memoryIndexState").textContent = index.state || "planned";
  $("memoryIndexList").innerHTML = "";
  const rules = index.rules || {};
  const rows = [
    ["Profile memory", `${state.profileMemory?.items?.filter((item) => item.state === "active").length || 0} active / ${state.profileMemory?.items?.length || 0} total`],
    ["Workflow records", `${state.workflowRecords?.length || 0} draft records`],
    ["Workflow clusters", `${state.workflowClusters?.length || 0} reserved`],
    ["Environment clusters", `${state.environmentClusters?.length || 0} reserved`],
    ["Extraction runs", `${state.memoryExtractionRuns?.length || 0} runs`],
    ["Boundary engine", index.provider || "cluster-router"],
    ["Chunks", String(index.chunkCount || 0)],
    ["Default activation", rules.defaultRetrieve ? "enabled" : "disabled"],
    ["Exclude deleted", rules.excludeDeleted ? "yes" : "no"],
    ["Scope required", rules.requireSessionOrProjectScope ? "yes" : "no"]
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "usage-row";
    row.innerHTML = `<strong></strong><small></small><span></span>`;
    row.querySelector("strong").textContent = label;
    row.querySelector("small").textContent = value;
    row.querySelector("span").textContent = "memory";
    $("memoryIndexList").append(row);
  }
}

function actionTitle(tool) {
  return {
    update_status: "Update status",
    create_reminder: "Create reminder",
    create_deadline: "Create deadline",
    save_project_progress: "Save project progress",
    create_continuation: "Create continuation",
    save_memory_note: "Save memory",
    suggest_next_action: "Suggest next action",
    review_memory: "Review memory"
  }[tool] || tool;
}

function suggestedPrompt(suggestion) {
  if (suggestion.tool === "suggest_next_action") return "Suggest my next action based on recent memory";
  if (suggestion.tool === "review_memory") return "Review recent memory";
  return suggestion.label || "";
}
function renderAllReminders() {
  $("allReminderCount").textContent = String(state.reminders.length);
  $("allReminderList").innerHTML = "";
  if (!state.reminders.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noReminders");
    $("allReminderList").append(empty);
  }
  for (const reminder of state.reminders) {
    $("allReminderList").append(reminderRow(reminder, { editable: true }));
  }
}

function renderSetup() {
  $("llmStatus").textContent = state.llm?.enabled ? `${state.llm.model}  - on` : "local";
  $("deepseekKeyInput").value = "";
  $("deepseekModelInput").value = state.llm?.model || "deepseek-v4-flash";
  $("deepseekThinkingInput").value = state.llm?.thinking || "disabled";
  renderModelRegistry();
  renderLocalWorkspace();
  $("locationInput").value = state.context.locationTag === "unknown" ? "" : state.context.locationTag || "";
  $("weatherInput").value = state.context.weather === "unknown" ? "" : state.context.weather || "";
  const lat = finiteContextNumber(state.context.latitude);
  const lon = finiteContextNumber(state.context.longitude);
  $("coordinateLine").textContent =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `Coordinates saved  - ${lat.toFixed(4)}, ${lon.toFixed(4)}`
      : t("locationNotCaptured");
  $("lanLine").textContent = state.lanUrls?.[0] ? `Phone / LAN: ${state.lanUrls[0]}` : "LAN address unavailable.";
}

function renderModelRegistry() {
  const registry = state.llmRegistry || {};
  const providers = registry.providers || state.llm?.providers || [];
  $("modelRoutingPill").textContent = registry.mode || "manual";
  $("modelRoutingModeInput").value = registry.mode || "manual";
  $("selectedProviderInput").innerHTML = "";
  $("comparisonProviderInput").innerHTML = "";
  const comparisonIds = new Set([...(registry.compareProviderIds || []), ...(registry.reviewProviderIds || [])]);
  for (const provider of providers) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = `${provider.label || provider.id}  - ${provider.model || "no model"}`;
    option.selected = provider.id === registry.selectedProviderId;
    $("selectedProviderInput").append(option);
    const compareOption = option.cloneNode(true);
    compareOption.selected = comparisonIds.has(provider.id);
    $("comparisonProviderInput").append(compareOption);
  }

  $("providerList").innerHTML = "";
  if (!providers.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No LLM providers registered yet.";
    $("providerList").append(empty);
    return;
  }
  for (const provider of providers) {
    const row = document.createElement("div");
    row.className = "provider-row";
    row.innerHTML = `<strong></strong><small></small><span></span><button type="button">Delete</button>`;
    row.querySelector("strong").textContent = provider.label || provider.id;
    row.querySelector("small").textContent = `${provider.type || "openai_compatible"}  - ${provider.model || "model not set"}`;
    row.querySelector("span").textContent = provider.enabled ? "ready" : provider.hasApiKey ? "disabled" : "needs key";
    row.querySelector("button").addEventListener("click", () => deleteProvider(provider.id));
    $("providerList").append(row);
  }
}

function renderLocalWorkspace() {
  const workspace = state.localWorkspace || {};
  $("workspaceStatePill").textContent = workspace.enabled ? "on" : "off";
  $("workspaceRootInput").value = workspace.root || "";
  $("workspaceEnabledInput").checked = Boolean(workspace.enabled);
  $("workspaceConfirmInput").checked = workspace.requireConfirmBeforeWrite !== false;
  renderWorkspaceLog(workspace.operationLog || []);
  renderWorkspacePreview(lastWorkspaceRead);
}

function renderWorkspaceLog(log = []) {
  $("workspaceFileList").innerHTML = "";
  if (!log.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No local file operations yet. Enable a folder, then list files.";
    $("workspaceFileList").append(empty);
    return;
  }
  for (const item of log.slice(-8).reverse()) {
    const row = document.createElement("div");
    row.className = "workspace-row";
    row.innerHTML = `<strong></strong><small></small><span></span>`;
    row.querySelector("strong").textContent = item.path || item.action || "workspace operation";
    row.querySelector("small").textContent = `${item.action || "read"}  - ${item.summary || ""}`;
    row.querySelector("span").textContent = item.fileType || "";
    $("workspaceFileList").append(row);
  }
}

function renderWorkspaceFiles(files = []) {
  $("workspaceFileList").innerHTML = "";
  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "empty quiet-empty";
    empty.textContent = "No supported files found. Supported: CSV, Word, Excel, PowerPoint.";
    $("workspaceFileList").append(empty);
    return;
  }
  for (const file of files) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "workspace-file-row";
    row.innerHTML = `<strong></strong><small></small><span></span>`;
    row.querySelector("strong").textContent = file.name;
    row.querySelector("small").textContent = file.path;
    row.querySelector("span").textContent = file.kind === "folder" ? "folder" : `${file.kind}  - ${formatBytes(file.size)}`;
    row.addEventListener("click", () => {
      $("workspaceWritePathInput").value = file.path;
      readWorkspaceFile(file.path);
    });
    $("workspaceFileList").append(row);
  }
}

function renderWorkspacePreview(file) {
  const node = $("workspacePreview");
  if (!node) return;
  if (!file) {
    node.className = "workspace-preview empty quiet-empty";
    node.textContent = "Select a supported file to preview it here.";
    return;
  }
  node.className = "workspace-preview";
  const lines = [];
  lines.push(`${file.title || file.path || "Workspace file"}  -  ${file.fileType || "file"}`);
  lines.push(file.summary || "");
  if (file.text) lines.push("", file.text.slice(0, 5000));
  if (Array.isArray(file.rows)) lines.push("", JSON.stringify(file.rows.slice(0, 20), null, 2));
  if (file.sheets) lines.push("", JSON.stringify(file.sheets, null, 2).slice(0, 5000));
  if (Array.isArray(file.slides)) lines.push("", file.slides.map((slide) => `${slide.title || "Slide"}\n${slide.text || ""}`).join("\n\n").slice(0, 5000));
  node.textContent = lines.filter((line) => line !== undefined && line !== null).join("\n");
}

function renderLearning() {
  const { counts, targets, statusCounts, readyForTuning } = state.learning;
  $("learningStatus").textContent = readyForTuning ? t("readyToTune") : t("collecting");
  $("statusSampleTotal").textContent = String(counts.statusSamples);
  $("learningCards").innerHTML = "";
  addMetric(t("statusSamplesMetric"), counts.statusSamples, targets.statusSamples);
  addMetric(t("reminderSamples"), counts.reminderSamples, targets.reminderSamples);
  addMetric(t("knownPlaces"), counts.knownPlaces, targets.knownPlaces);
  addMetric(t("hourCoverage"), counts.hourCoverage, targets.hourCoverage);

  $("statusChart").innerHTML = "";
  const entries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noStatusSamples");
    $("statusChart").append(empty);
  }
  const max = Math.max(1, ...entries.map(([, count]) => count));
  for (const [id, count] of entries) {
    const label = state.statuses.find((status) => status.id === id)?.label || id;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `<strong></strong><div class="bar-track"><div class="bar-fill"></div></div><span></span>`;
    row.querySelector("strong").textContent = label;
    row.querySelector(".bar-fill").style.width = `${Math.round((count / max) * 100)}%`;
    row.querySelector("span").textContent = String(count);
    $("statusChart").append(row);
  }
}

function addMetric(label, value, target) {
  const item = document.createElement("div");
  item.className = "metric";
  item.innerHTML = `<span></span><strong></strong><div class="bar-track"><div class="bar-fill"></div></div>`;
  item.querySelector("span").textContent = label;
  item.querySelector("strong").textContent = `${value} / ${target}`;
  item.querySelector(".bar-fill").style.width = `${Math.min(100, Math.round((value / target) * 100))}%`;
  $("learningCards").append(item);
}

function reminderRow(reminder, options = { editable: true }) {
  const row = document.createElement("div");
  row.className = "reminder";
  const text = document.createElement("div");
  text.innerHTML = `<strong></strong><small></small>`;
  text.querySelector("strong").textContent = reminder.text;
  text.querySelector("small").textContent = reminder.kind === "deadline" ? deadlineLabel(reminder) : frequencyLabel(reminder.frequency);
  row.append(text);
  if (options.editable) {
    const actions = document.createElement("div");
    actions.className = "reminder-actions";
    const done = document.createElement("button");
    done.textContent = reminder.done ? t("completed") : t("markComplete");
    done.disabled = reminder.done;
    done.addEventListener("click", () => completeReminder(reminder.id));
    const del = document.createElement("button");
    del.textContent = t("deleteReminder");
    del.className = "danger-button";
    del.addEventListener("click", () => deleteReminder(reminder.id, reminder.text));
    actions.append(done, del);
    row.append(actions);
  }
  return row;
}

async function switchStatus(payload) {
  const result = await api("/api/status", { method: "POST", body: JSON.stringify(payload) });
  const label = result.status.label;
  lastReceiptNote = `${t("statusUpdated")} ${label} ${t("statusIsActive")} ${result.receipt.location}  - ${result.receipt.weather}  - ${result.receipt.reminderCount} ${t("reminders")}`;
  await load(result.state);
  switchView("today");
}

async function switchSession(sessionId) {
  const result = await api("/api/sessions/active", { method: "POST", body: JSON.stringify({ sessionId }) });
  activeRouteLabel = result.session.routeLabel || "general";
  pendingProposal = null;
  await load(result.state);
}

async function switchEntryRoute(routeId) {
  activeRouteLabel = routeId || "general";
  pendingProposal = null;
  const result = await api("/api/sessions/fresh", {
    method: "POST",
    body: JSON.stringify({ routeLabel: activeRouteLabel })
  });
  activeRouteLabel = result.session.routeLabel || activeRouteLabel;
  lastReceiptNote = `Entry route: ${routeLabel(activeRouteLabel)}`;
  await load(result.state);
}

async function startFreshSession() {
  const routeLabel = activeRouteLabel || state.activeSession?.routeLabel || "general";
  const result = await api("/api/sessions/fresh", {
    method: "POST",
    body: JSON.stringify({ routeLabel, forceNew: true })
  });
  activeRouteLabel = result.session.routeLabel || routeLabel;
  pendingProposal = null;
  currentSessionStartedAt = new Date().toISOString();
  await load(result.state);
}

async function activateProject(projectId) {
  const result = await api("/api/projects/active", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      routeLabel: activeRouteLabel || state.activeSession?.routeLabel || "academic"
    })
  });
  activeRouteLabel = result.session.routeLabel || activeRouteLabel;
  pendingProposal = null;
  lastReceiptNote = "Project loaded into this session.";
  await load(result.state);
}

async function updateReminder(id, patch) {
  const result = await api(`/api/reminders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  await load(result.state);
}

async function completeReminder(id) {
  const result = await api(`/api/reminders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ done: true, seen: true }) });
  lastReceiptNote = t("reminderCompleted");
  await load(result.state);
}

async function deleteReminder(id, text) {
  if (!confirm(`${t("confirmDelete")}\n${text}`)) return;
  const result = await api(`/api/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
  lastReceiptNote = t("reminderDeleted");
  await load(result.state);
}

async function deleteProject(id, name) {
  if (!confirm(`Delete project?\n${name}`)) return;
  const result = await api(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  lastReceiptNote = "Project moved to deleted items.";
  await load(result.state);
}

async function deleteSession(id, title) {
  if (!confirm(`Delete session?\n${title}`)) return;
  const result = await api(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  lastReceiptNote = "Session moved to deleted items.";
  await load(result.state);
}

function switchView(name) {
  for (const view of $$(".view")) view.classList.toggle("active", view.id === `${name}View`);
  for (const tab of $$(".tab")) tab.classList.toggle("active", tab.dataset.view === name);
}

function showNotice(text) {
  $("notice").textContent = text;
  $("notice").classList.remove("hidden");
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => {
    $("notice").classList.add("hidden");
    lastReceiptNote = "";
  }, 2800);
}

function addPendingFiles(fileList) {
  const files = [...(fileList || [])].filter(Boolean);
  pendingFiles.push(...files);
  renderFileQueue();
}

function renderFileQueue() {
  $("fileQueue").innerHTML = "";
  $("fileQueue").classList.toggle("hidden", !pendingFiles.length);
  pendingFiles.forEach((file, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "file-chip";
    item.textContent = `${file.name}  - ${formatBytes(file.size)}`;
    item.addEventListener("click", () => {
      pendingFiles = pendingFiles.filter((_, fileIndex) => fileIndex !== index);
      renderFileQueue();
    });
    $("fileQueue").append(item);
  });
}

async function uploadPendingFiles() {
  const files = pendingFiles;
  pendingFiles = [];
  renderFileQueue();
  const results = [];
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await api("/api/files/upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl,
        sessionId: state.activeSessionId,
        routeLabel: activeRouteLabel || state.activeSession?.routeLabel || "general",
        projectId: state.activeSession?.projectId || null
      })
    });
    results.push(result);
  }
  if (results.length) lastReceiptNote = `${results.length} file${results.length > 1 ? "s" : ""} read and attached to this session.`;
  return results;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showAlert(alert) {
  const due = new Date(alert.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  $("alertBanner").innerHTML = "";
  const card = document.createElement("div");
  card.className = "alert-card";
  card.innerHTML = `<strong></strong><p></p><div class="button-row"></div>`;
  card.querySelector("strong").textContent = "Luma reminder";
  card.querySelector("p").textContent = `${alert.text} is due at ${due}. ${alert.minutesBefore} min left.`;
  const done = document.createElement("button");
  done.textContent = t("complete");
  done.addEventListener("click", async () => {
    await completeReminder(alert.reminderId);
    $("alertBanner").classList.add("hidden");
  });
  const dismiss = document.createElement("button");
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => $("alertBanner").classList.add("hidden"));
  card.querySelector(".button-row").append(done, dismiss);
  $("alertBanner").append(card);
  $("alertBanner").classList.remove("hidden");
}

async function pollAlerts() {
  try {
    const { dueAlerts } = await api("/api/alerts/due");
    for (const alert of dueAlerts) {
      showAlert(alert);
      if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Luma reminder", { body: `${alert.text}  - ${alert.minutesBefore} min left` });
      }
      await api("/api/alerts/fire", { method: "POST", body: JSON.stringify({ reminderId: alert.reminderId, alertId: alert.alertId }) });
    }
  } catch {
    // Keep polling quiet; Dashboard remains the source of truth.
  }
}

function updateReminderFieldVisibility() {
  const deadline = $("reminderKindInput").value === "deadline";
  $("deadlineFields").classList.toggle("hidden", !deadline);
  $("statusReminderFields").classList.toggle("hidden", deadline);
}

function frequencyLabel(value) {
  return {
    every_status_enter: t("everyTime"),
    once: t("once"),
    for_next_days: t("next3Days"),
    daily_until_done: t("dailyUntilDone"),
    manual_only: t("keepInList")
  }[value] || value;
}

function deadlineLabel(reminder) {
  const due = new Date(reminder.dueAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const next = (reminder.alerts || []).find((alert) => !alert.firedAt);
  return next ? `due ${due}  - next alert ${next.minutesBefore}m before` : `due ${due}`;
}

function normalizeUnknown(value) {
  return !value || value === "unknown" ? t("unknown") : value;
}

function finiteContextNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function weatherFromCode(code) {
  if ([0, 1].includes(code)) return "clear";
  if ([2, 3].includes(code)) return "cloudy";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "unknown";
}

$("refreshButton").addEventListener("click", async () => {
  await startFreshSession();
});
$("newSessionButton").addEventListener("click", async () => {
  await startFreshSession();
});
$("openStatusButton").addEventListener("click", () => jumpToSetup("statusPanel"));
$("openReminderButton").addEventListener("click", () => jumpToSetup("reminderPanel"));
$("reminderKindInput").addEventListener("change", updateReminderFieldVisibility);

$("notifyButton").addEventListener("click", () => jumpToSetup("alertsPanel"));

$("attachButton").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", (event) => {
  addPendingFiles(event.target.files);
  event.target.value = "";
});

function fitChatInput() {
  const input = $("chatInput");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

$("chatInput").addEventListener("input", fitChatInput);
$("chatForm").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("chatForm").classList.add("drag-active");
});
$("chatForm").addEventListener("dragleave", () => {
  $("chatForm").classList.remove("drag-active");
});
$("chatForm").addEventListener("drop", (event) => {
  event.preventDefault();
  $("chatForm").classList.remove("drag-active");
  addPendingFiles(event.dataTransfer.files);
});

$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = $("chatInput").value.trim();
  if (!text && !pendingFiles.length) return;
  $("chatInput").value = "";
  fitChatInput();
  const thinking = document.createElement("div");
  thinking.className = "message assistant assistant-document thinking-message";
  thinking.textContent = "Luma is working on the answer...";
  $("chatMessages").append(thinking);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  try {
    const uploaded = await uploadPendingFiles();
    if (!text && uploaded.length) {
      await load(uploaded.at(-1).state);
      return;
    }
    const result = await api("/api/chat/propose", {
      method: "POST",
      body: JSON.stringify({
        text,
        sessionId: state.activeSessionId,
        routeLabel: activeRouteLabel || state.activeSession?.routeLabel || "general",
        modelRouting: {
          mode: state.llmRegistry?.mode || "manual",
          selectedProviderId: state.llmRegistry?.selectedProviderId || state.modelRouting?.selectedProviderId || "deepseek",
          compareProviderIds: state.llmRegistry?.compareProviderIds || [],
          reviewProviderIds: state.llmRegistry?.reviewProviderIds || []
        }
      })
    });
    pendingProposal = result.proposal?.proposedActions?.length ? result.proposal : null;
    pendingAnimatedMessageId = result.proposal?.assistantMessageId || null;
    await load(result.state);
  } catch (error) {
    thinking.textContent = error.message || "Luma could not process that message.";
    showNotice(thinking.textContent);
  }
});

$("confirmProposalButton").addEventListener("click", async () => {
  if (!pendingProposal) return;
  const result = await api("/api/chat/confirm", {
    method: "POST",
    body: JSON.stringify({ proposedActions: pendingProposal.proposedActions, sessionId: state.activeSessionId, memoryTitle: pendingProposal.memoryTitle })
  });
  pendingProposal = null;
  lastReceiptNote = "Luma executed the action and wrote local memory.";
  await load(result.state);
});

$("cancelProposalButton").addEventListener("click", () => {
  pendingProposal = null;
  renderProposal();
});

$("profileExtractButton").addEventListener("click", async () => {
  const button = $("profileExtractButton");
  button.disabled = true;
  button.textContent = "Extracting...";
  try {
    const result = await api("/api/memory/extract-profile", {
      method: "POST",
      body: JSON.stringify({ limit: 120 })
    });
    await load(result.state);
    showNotice("Profile memory extraction finished.");
  } catch (error) {
    showNotice(error.message || "Profile extraction failed.");
  } finally {
    button.disabled = false;
    button.textContent = "Extract Profile";
  }
});

$("workshopAddBlockButton")?.addEventListener("click", () => {
  const stationCount = workshopBlocks.filter((block) => block.type === "station").length;
  workshopBlocks.push({
    id: `station-${Date.now()}`,
    type: "station",
    title: "New station",
    stage: activeWorkshopStage(),
    attention: "normal",
    position: defaultStationPosition(stationCount),
    fields: [["Primary signal", "draft"], ["BOM", "open"], ["Owner", "TBD"]],
    notes: ["Edit this station through Luma or use it as a placeholder."]
  });
  workshopLog.push({ role: "luma", text: "Added a blank station to the production line." });
  saveWorkshopState();
  renderWorkshop();
});

$("workshopForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("workshopInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await submitWorkshopToLuma(text);
});

$("backgroundForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("backgroundTitleInput").value.trim();
  const note = $("backgroundNoteInput").value.trim();
  const type = $("backgroundTypeInput").value;
  const attention = $("backgroundAttentionInput").value;
  if (!title && !note) return;
  workshopBlocks.push({
    id: `${type}-${Date.now()}`,
    type,
    title: title || `${type[0].toUpperCase()}${type.slice(1)} note`,
    stage: activeWorkshopStage(),
    attention,
    fields: [["Source", "manual edit"], ["Stage", activeWorkshopStage()]],
    notes: note ? [note] : []
  });
  $("backgroundTitleInput").value = "";
  $("backgroundNoteInput").value = "";
  $("backgroundAttentionInput").value = "normal";
  saveWorkshopState();
  renderWorkshop();
});

$("stationEditForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const block = workshopBlocks.find((item) => item.id === editingWorkshopBlockId && item.type === "station");
  if (!block) return closeStationEditor();
  block.title = $("stationTitleInput").value.trim() || block.title;
  block.stage = $("stationStageInput").value;
  block.attention = $("stationAttentionInput").value;
  block.fields = parseStationFields($("stationFieldsInput").value, $("stationSignalInput").value.trim() || "No signal yet");
  const note = $("stationNoteInput").value.trim();
  block.notes = note ? [note, ...(block.notes || []).slice(1)] : block.notes || [];
  workshopLog.push({ role: "luma", text: `Updated ${block.title}.` });
  closeStationEditor();
  saveWorkshopState();
  renderWorkshop();
});

$("stationEditCancelButton")?.addEventListener("click", closeStationEditor);

for (const button of $$(".stage-pill")) {
  button.addEventListener("click", () => {
    for (const item of $$(".stage-pill")) item.classList.toggle("active", item === button);
    workshopLog.push({ role: "luma", text: `Workshop stage focus changed to ${button.textContent}.` });
    saveWorkshopState();
    renderWorkshop();
  });
}

window.addEventListener("pointermove", updateStationDrag);
window.addEventListener("pointerup", finishStationDrag);
window.addEventListener("pointercancel", finishStationDrag);

$("enableAlertsButton").addEventListener("click", async () => {
  if (!("Notification" in window)) return showNotice(t("browserAlertsUnavailable"));
  const permission = await Notification.requestPermission();
  showNotice(permission === "granted" ? t("alertsEnabled") : t("alertsNotEnabled"));
});

$("customStatusForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const label = $("customStatusInput").value.trim();
  if (!label) return showNotice(t("addStatusFirst"));
  $("customStatusInput").value = "";
  await switchStatus({ label });
});

$("reminderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = $("reminderInput").value.trim();
  if (!text) return showNotice(t("addReminderFirst"));
  const kind = $("reminderKindInput").value;
  const statusIds = [$("reminderStatusInput").value].filter(Boolean);
  const body = { kind, text, statusIds };
  if (kind === "deadline") {
    body.dueAt = $("dueAtInput").value;
    body.leadTimes = $$("#deadlineFields input[type='checkbox']:checked").map((input) => Number(input.value));
  } else {
    body.frequency = $("frequencyInput").value;
    body.days = 3;
  }
  const result = await api("/api/reminders", { method: "POST", body: JSON.stringify(body) });
  $("reminderInput").value = "";
  lastReceiptNote = `${t("reminderSaved")}: ${text}`;
  await load(result.state);
});

$("contextForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await api("/api/context", {
    method: "POST",
    body: JSON.stringify({
      locationTag: $("locationInput").value.trim() || "unknown",
      weather: $("weatherInput").value.trim() || "unknown"
    })
  });
  lastReceiptNote = t("contextUpdated");
  await load(result.state);
});

$("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify({ language: $("languageInput").value })
  });
  state = result.state;
  lastReceiptNote = t("settingsSaved");
  render();
});

$("projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("projectNameInput").value.trim();
  if (!name) return showNotice(t("projectNameFirst"));
  const result = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      type: $("projectTypeInput").value,
      goal: $("projectGoalInput").value.trim(),
      nextStep: $("projectNextInput").value.trim(),
      state: "active"
    })
  });
  $("projectNameInput").value = "";
  $("projectGoalInput").value = "";
  $("projectNextInput").value = "";
  lastReceiptNote = t("projectSaved");
  await load(result.state);
});

$("llmForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    deepseekModel: $("deepseekModelInput").value,
    deepseekThinking: $("deepseekThinkingInput").value
  };
  const key = $("deepseekKeyInput").value.trim();
  if (key) body.deepseekApiKey = key;
  const result = await api("/api/llm/settings", { method: "POST", body: JSON.stringify(body) });
  state = result.state;
  lastReceiptNote = t("languageLayerSaved");
  render();
});

$("modelRoutingForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const candidateIds = [...$("comparisonProviderInput").selectedOptions].map((option) => option.value);
  const result = await api("/api/llm/routing", {
    method: "POST",
    body: JSON.stringify({
      mode: $("modelRoutingModeInput").value,
      selectedProviderId: $("selectedProviderInput").value,
      compareProviderIds: candidateIds,
      reviewProviderIds: candidateIds
    })
  });
  lastReceiptNote = "Model routing saved.";
  await load(result.state);
});

$("providerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const label = $("providerLabelInput").value.trim();
  const model = $("providerModelInput").value.trim();
  const baseUrl = $("providerBaseUrlInput").value.trim();
  if (!label || !model || !baseUrl) return showNotice("Provider label, base URL, and model are required.");
  const body = {
    id: $("providerIdInput").value.trim() || label,
    label,
    type: "openai_compatible",
    baseUrl,
    model,
    enabled: true,
    roles: ["answerer", "reviewer", "summarizer"]
  };
  const apiKey = $("providerApiKeyInput").value.trim();
  if (apiKey) body.apiKey = apiKey;
  const result = await api("/api/llm/providers", { method: "POST", body: JSON.stringify(body) });
  $("providerLabelInput").value = "";
  $("providerIdInput").value = "";
  $("providerBaseUrlInput").value = "";
  $("providerModelInput").value = "";
  $("providerApiKeyInput").value = "";
  lastReceiptNote = "Model provider saved.";
  await load(result.state);
});

async function deleteProvider(id) {
  if (!confirm(`Delete provider?\n${id}`)) return;
  const result = await api(`/api/llm/providers/${encodeURIComponent(id)}`, { method: "DELETE" });
  lastReceiptNote = "Model provider removed.";
  await load(result.state);
}

$("workspaceSettingsForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await api("/api/local-workspace/settings", {
    method: "POST",
    body: JSON.stringify({
      root: $("workspaceRootInput").value.trim(),
      enabled: $("workspaceEnabledInput").checked,
      requireConfirmBeforeWrite: $("workspaceConfirmInput").checked
    })
  });
  lastReceiptNote = "Local workspace settings saved.";
  await load(result.state);
});

$("workspaceRefreshButton")?.addEventListener("click", async () => {
  try {
    const result = await api("/api/local-workspace/files");
    renderWorkspaceFiles(result.files || []);
  } catch (error) {
    showNotice(error.message || "Could not list workspace files.");
  }
});

$("workspaceImportWorkshopButton")?.addEventListener("click", () => {
  if (!lastWorkspaceRead) return showNotice("Read a CSV or Excel file first.");
  const count = importWorkspacePreviewToWorkshop(lastWorkspaceRead);
  if (!count) return showNotice("No station-like rows found in the selected file.");
  lastReceiptNote = `Imported ${count} station${count === 1 ? "" : "s"} into Workshop.`;
  saveWorkshopState();
  renderWorkshop();
  switchView("workshop");
});

async function readWorkspaceFile(path) {
  try {
    const result = await api("/api/local-workspace/read", {
      method: "POST",
      body: JSON.stringify({ path })
    });
    lastWorkspaceRead = result.file;
    lastReceiptNote = `Read local file: ${result.file.title || path}`;
    await load(result.state);
  } catch (error) {
    showNotice(error.message || "Could not read workspace file.");
  }
}

function importWorkspacePreviewToWorkshop(file) {
  const rows = workspaceFileRows(file);
  if (rows.length < 2) return 0;
  const headers = rows[0].map((value) => String(value || "").trim());
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim()));
  let imported = 0;
  for (const row of dataRows) {
    const record = rowToRecord(headers, row);
    const title = record.station || record.workstation || record.name || record.process || record.title || `Station ${workshopBlocks.filter((block) => block.type === "station").length + 1}`;
    const existing = workshopBlocks.find((block) => block.type === "station" && block.title.toLowerCase() === String(title).toLowerCase());
    const fields = stationFieldsFromRecord(record);
    const notes = [record.note || record.notes || record.issue || record.risk || record.problem || "Imported from workspace file"].filter(Boolean);
    if (existing) {
      existing.fields = mergeFields(existing.fields, fields);
      existing.stage = record.stage || record.bom || existing.stage || activeWorkshopStage();
      existing.attention = attentionFromRecord(record, existing.attention);
      existing.notes = [...new Set([...(existing.notes || []), ...notes])].slice(-6);
    } else {
      const stationCount = workshopBlocks.filter((block) => block.type === "station").length;
      workshopBlocks.push({
        id: `station-import-${Date.now()}-${imported}`,
        type: "station",
        title: String(title),
        stage: record.stage || record.bom || activeWorkshopStage(),
        attention: attentionFromRecord(record, "normal"),
        position: defaultStationPosition(stationCount),
        fields,
        notes
      });
    }
    imported += 1;
  }
  workshopLog.push({ role: "luma", text: `Imported ${imported} station rows from ${file.title || file.path || "workspace file"}.` });
  return imported;
}

function workspaceFileRows(file) {
  if (file.fileType === "csv" && file.text) return parseSimpleCsv(file.text);
  if (file.fileType === "xlsx") return file.metadata?.sheets?.[0]?.rows || [];
  return [];
}

function rowToRecord(headers, row) {
  const record = {};
  headers.forEach((header, index) => {
    const key = normalizeFieldKey(header || `field_${index + 1}`);
    record[key] = row[index];
  });
  return record;
}

function normalizeFieldKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s/.-]+/g, "_")
    .replace(/[^a-z0-9_\u4e00-\u9fa5]/g, "");
}

function stationFieldsFromRecord(record) {
  const preferred = [
    ["Owner", record.owner],
    ["Primary signal", record.primary_signal || record.signal || record.risk || record.issue || record.problem],
    ["Yield", record.yield || record.yield_rate || record.良率],
    ["CT", record.ct || record.cycle_time],
    ["UPH", record.uph],
    ["NG", record.ng || record.defect || record.defects],
    ["BOM", record.bom || record.stage],
    ["Cost", record.cost],
    ["Equipment", record.equipment || record.machine || record.设备]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
  const used = new Set(["owner", "primary_signal", "signal", "risk", "issue", "problem", "yield", "yield_rate", "良率", "ct", "cycle_time", "uph", "ng", "defect", "defects", "bom", "stage", "cost", "equipment", "machine", "设备", "station", "workstation", "name", "process", "title", "note", "notes"]);
  for (const [key, value] of Object.entries(record)) {
    if (used.has(key) || value === undefined || value === null || String(value).trim() === "") continue;
    preferred.push([key, value]);
  }
  return preferred.length ? preferred.map(([label, value]) => [String(label), String(value)]) : [["Primary signal", "Imported station"]];
}

function mergeFields(current = [], next = []) {
  let merged = [...current];
  for (const [label, value] of next) merged = upsertField(merged, label, value);
  return merged;
}

function attentionFromRecord(record, fallback = "normal") {
  const raw = String(record.attention || record.priority || record.risk_level || record.risk || record.issue || fallback || "normal").toLowerCase();
  if (/high|urgent|critical|严重|高|风险/.test(raw)) return "high";
  if (/medium|mid|watch|中/.test(raw)) return "medium";
  return fallback || "normal";
}

function parseSimpleCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const value = String(text || "");
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '"' && value[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && value[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => String(item).trim())) rows.push(row);
  return rows;
}

$("workspaceWriteForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const body = buildWorkspaceWritePayload();
    if (!body.path) return showNotice("Choose a workspace file path first.");
    if ($("workspaceConfirmInput").checked && !confirm(`Write local file?\n${body.path}\n\nA backup will be created when possible.`)) return;
    const result = await api("/api/local-workspace/write", {
      method: "POST",
      body: JSON.stringify(body)
    });
    lastWorkspaceRead = null;
    lastReceiptNote = result.summary || "Local file written.";
    await load(result.state);
  } catch (error) {
    showNotice(error.message || "Could not write workspace file.");
  }
});

function buildWorkspaceWritePayload() {
  const path = $("workspaceWritePathInput").value.trim();
  const operation = $("workspaceWriteOperationInput").value;
  const columnOrSheet = $("workspaceWriteColumnInput").value.trim();
  const cellOrRow = $("workspaceWriteCellInput").value.trim();
  const text = $("workspaceWriteTextInput").value;
  const body = {
    path,
    operation,
    createBackup: $("workspaceBackupInput").checked
  };
  if (operation === "append_row") {
    body.values = parseWorkspaceArray(text);
    return body;
  }
  if (operation === "update_cell") {
    body.value = text;
    if (/^[A-Z]+[0-9]+$/i.test(cellOrRow)) {
      body.sheetName = columnOrSheet || undefined;
      body.cell = cellOrRow;
    } else {
      body.column = columnOrSheet;
      body.rowIndex = Number(cellOrRow || 0);
    }
    return body;
  }
  if (operation === "replace_rows") {
    body.rows = parseWorkspaceRows(text);
    body.sheetName = columnOrSheet || undefined;
    return body;
  }
  body.text = text;
  return body;
}

function parseWorkspaceArray(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall back to a simple comma-separated row.
  }
  return raw.split(",").map((item) => item.trim());
}

function parseWorkspaceRows(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Rows must be a JSON array.");
  return parsed;
}

$("placeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const label = $("placeInput").value.trim();
  if (!label) return showNotice(t("placeNameFirst"));
  const result = await api("/api/places", { method: "POST", body: JSON.stringify({ label }) });
  $("placeInput").value = "";
  lastReceiptNote = `${t("placeSaved")}: ${result.place.label}.`;
  await load(result.state);
});

$("codexButton").addEventListener("click", async () => {
  const context = await api("/api/codex-context");
  await navigator.clipboard.writeText(JSON.stringify(context, null, 2));
  showNotice(t("codexCopied"));
});

$("locateButton").addEventListener("click", async () => {
  if (!navigator.geolocation) return showNotice(t("locationNotAvailable"));
  $("locateButton").textContent = t("locating");
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    let weather = "unknown";
    let temperature = null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code`;
      const data = await (await fetch(url)).json();
      temperature = data.current?.temperature_2m ?? null;
      const precipitation = data.current?.precipitation ?? 0;
      weather = precipitation > 0 ? "rain" : weatherFromCode(data.current?.weather_code);
    } catch {
      weather = state.context.weather || "unknown";
    }
    const result = await api("/api/context", {
      method: "POST",
      body: JSON.stringify({ latitude, longitude, locationTag: state.context.locationTag || "unknown", weather, temperature })
    });
    $("locateButton").textContent = t("useLocation");
    lastReceiptNote = t("locationUpdated");
    await load(result.state);
  }, () => {
    $("locateButton").textContent = t("useLocation");
    showNotice(t("locationDenied"));
  });
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("authError").textContent = "";
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ code: $("accessCodeInput").value })
    });
    $("accessCodeInput").value = "";
    await load();
  } catch {
    $("authError").textContent = "Access code did not work.";
  }
});

async function boot() {
  loadWorkshopState();
  const auth = await api("/api/auth/state");
  if (auth.required && !auth.authed) {
    showAuthGate("");
    return;
  }
  await load();
  if ((state.activeSession?.messageCount || 0) > 0) {
    await startFreshSession();
  }
}

function showAuthGate(message) {
  $("authGate").classList.remove("hidden");
  $("authError").textContent = message || "";
}

await boot();
setInterval(pollAlerts, 15000);

function jumpToSetup(targetId) {
  switchView("setup");
  requestAnimationFrame(() => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
