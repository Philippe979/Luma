let state = null;
let lastReceiptNote = "";
let pendingProposal = null;
let activeRouteLabel = "general";
let lastRenderedSessionId = null;
let currentSessionStartedAt = new Date().toISOString();
let pendingFiles = [];

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const i18n = {
  en: {
    activeReminders: "Active Reminders",
    addReminder: "Add Reminder",
    addReminderFirst: "Add a reminder first.",
    addStatusFirst: "Add a status first.",
    alertBefore: "Alert before",
    alerts: "Alerts",
    alertsEnabled: "Alerts enabled.",
    alertsHelp: "Deadline reminders can show in-page alerts and browser notifications while Luma is open.",
    alertsNotEnabled: "Alerts were not enabled.",
    allStatuses: "All statuses",
    bindTo: "Bind to",
    browser: "browser",
    browserAlertsUnavailable: "Browser notifications are not available.",
    cancel: "Cancel",
    chatGreeting: "How can I help you today?",
    chatPlaceholder: "Tell Luma what changed, what to remember, or what to do next.",
    confirmActions: "Confirm",
    conversationArchive: "Archive",
    codexCopied: "Codex context copied.",
    collecting: "collecting",
    complete: "Complete",
    completed: "completed",
    confirmDelete: "Delete this reminder?",
    context: "Context",
    contextUpdated: "Context updated.",
    copyCodex: "Copy Codex Context",
    dailyUntilDone: "Daily until done",
    deadlineReminder: "Deadline reminder",
    deleted: "Delete",
    deleteReminder: "Delete",
    deepseekApiKey: "DeepSeek API Key",
    deepseekKeyPlaceholder: "Paste key once; stored only on this Mac",
    disabled: "disabled",
    due: "Due",
    enableAlerts: "Enable Alerts",
    enableBrowserAlerts: "Enable Browser Alerts",
    enabled: "enabled",
    everyTime: "Every time",
    frequency: "Frequency",
    goal: "Goal",
    goalPlaceholder: "What should Luma remember this project for?",
    hourCoverage: "Hour coverage",
    keepInList: "Keep in list",
    knownPlaces: "Known places",
    language: "Language",
    languageLayer: "Language Layer",
    languageLayerSaved: "Language layer saved.",
    learningProgress: "Learning Progress",
    localAccess: "Local Access",
    localButler: "Local Butler",
    locating: "Locating",
    location: "Location",
    locationDenied: "Location permission was not granted.",
    locationNotAvailable: "Location is not available.",
    locationNotCaptured: "Location not captured yet.",
    locationPlaceholder: "home / campus / outside",
    locationUpdated: "Location and weather updated.",
    manageReminders: "Manage Reminders",
    manual: "manual",
    markComplete: "Complete",
    mlProgress: "ML Progress",
    model: "Model",
    next3Days: "Next 3 days",
    nextStep: "Next step",
    nextStepPlaceholder: "e.g. methodology",
    noActiveReminders: "No active reminders for this status.",
    needsConfirm: "confirm",
    noMemoryYet: "No memory yet. Tell Luma one thing you want it to remember.",
    noReminders: "No reminders saved yet.",
    noSuggestionsYet: "Suggestions will appear after Luma has a little memory.",
    noStatusSamples: "No status samples yet. Update status from Setup to train Luma.",
    once: "Once",
    placeNameFirst: "Add a place name first.",
    placePlaceholder: "Save current place as, e.g. home",
    placeSaved: "Place saved",
    preferences: "Preferences",
    projectName: "Project name",
    projectNameFirst: "Add a project name first.",
    projectNamePlaceholder: "e.g. 5207 Research Project",
    projectSaved: "Project saved.",
    projects: "Projects",
    proposedActions: "Proposed Actions",
    readyToTune: "ready to tune",
    recentMemory: "Recent Memory",
    recentCalls: "Recent Calls",
    refresh: "Refresh",
    reminder: "Reminder",
    reminderCompleted: "Reminder completed.",
    reminderDeleted: "Reminder deleted.",
    reminderPlaceholder: "e.g. Finish 5207",
    reminderSamples: "Reminder samples",
    reminderSaved: "Reminder saved",
    reminders: "Reminders",
    saveContext: "Save Context",
    saveLanguageLayer: "Save Language Layer",
    savePlace: "Save Place",
    savePreferences: "Save Preferences",
    saveProject: "Save Project",
    saveReminder: "Save Reminder",
    savedTokens: "Saved",
    send: "Send",
    sevenDayTrend: "7 Day Trend",
    settingsSaved: "Preferences saved.",
    setup: "Setup",
    statusIsActive: "is active.",
    statusPlaceholder: "Add status, e.g. Poker",
    statusReminder: "Status reminder",
    statusSamples: "Status Samples",
    statusSamplesMetric: "Status samples",
    statusUpdated: "Status updated.",
    suggested: "Suggested",
    suggestedActions: "Suggested Actions",
    switch: "Switch",
    time: "Time",
    thinking: "Thinking",
    today: "Today",
    todayBrief: "Today",
    todayTokens: "Today tokens",
    tokenUsage: "Token Usage",
    type: "Type",
    unknown: "Unknown",
    updateStatus: "Update Status",
    usage: "Usage",
    useLocation: "Use Location",
    weather: "Weather",
    weatherPlaceholder: "sunny / rain / unknown",
    workingMemoryEmpty: "No active memory thread yet."
  },
  zh: {
    activeReminders: "当前提醒",
    addReminder: "添加提醒",
    addReminderFirst: "请先输入提醒内容。",
    addStatusFirst: "请先输入状态。",
    alertBefore: "提前提醒",
    alerts: "提醒通知",
    alertsEnabled: "通知已启用。",
    alertsHelp: "当 Luma 页面保持打开时，截止提醒可以显示页面提醒和浏览器通知。",
    alertsNotEnabled: "通知未启用。",
    allStatuses: "全部状态",
    bindTo: "绑定到",
    browser: "浏览器",
    browserAlertsUnavailable: "当前浏览器不支持通知。",
    cancel: "取消",
    chatGreeting: "今天想让 Luma 帮你做什么？",
    chatPlaceholder: "告诉 Luma 状态变化、需要记住的事，或者下一步要做什么。",
    confirmActions: "确认执行",
    codexCopied: "Codex 上下文已复制。",
    collecting: "收集中",
    complete: "完成",
    completed: "已完成",
    confirmDelete: "删除这条提醒吗？",
    context: "上下文",
    contextUpdated: "上下文已更新。",
    copyCodex: "复制 Codex 上下文",
    dailyUntilDone: "每天提醒直到完成",
    deadlineReminder: "截止提醒",
    deleted: "删除",
    deleteReminder: "删除",
    deepseekApiKey: "DeepSeek API Key",
    deepseekKeyPlaceholder: "只需粘贴一次；仅保存在这台 Mac",
    disabled: "关闭",
    due: "截止时间",
    enableAlerts: "启用通知",
    enableBrowserAlerts: "启用浏览器通知",
    enabled: "开启",
    everyTime: "每次进入状态",
    frequency: "频率",
    goal: "目标",
    goalPlaceholder: "这个项目希望 Luma 记住什么？",
    hourCoverage: "时间覆盖",
    keepInList: "仅保存在列表",
    knownPlaces: "已知地点",
    language: "语言",
    languageLayer: "语言理解层",
    languageLayerSaved: "语言理解层已保存。",
    learningProgress: "学习进度",
    localAccess: "本地访问",
    localButler: "本地管家",
    locating: "定位中",
    location: "地点",
    locationDenied: "定位权限未授予。",
    locationNotAvailable: "当前位置不可用。",
    locationNotCaptured: "尚未获取位置。",
    locationPlaceholder: "home / campus / outside",
    locationUpdated: "位置和天气已更新。",
    manageReminders: "管理提醒",
    manual: "手动",
    markComplete: "完成",
    mlProgress: "学习进度",
    model: "模型",
    next3Days: "接下来 3 天",
    nextStep: "下一步",
    nextStepPlaceholder: "例如：methodology",
    noActiveReminders: "当前状态没有有效提醒。",
    needsConfirm: "待确认",
    noMemoryYet: "还没有记忆。先告诉 Luma 一件需要记住的事。",
    noReminders: "还没有保存提醒。",
    noSuggestionsYet: "当 Luma 有一点记忆后，会在这里给出建议。",
    noStatusSamples: "还没有状态样本。请在设置里更新状态来训练 Luma。",
    once: "仅一次",
    placeNameFirst: "请先输入地点名称。",
    placePlaceholder: "保存当前位置为，例如 home",
    placeSaved: "地点已保存",
    preferences: "偏好设置",
    projectName: "项目名称",
    projectNameFirst: "请先输入项目名称。",
    projectNamePlaceholder: "例如：5207 Research Project",
    projectSaved: "项目已保存。",
    projects: "项目",
    proposedActions: "建议行动",
    readyToTune: "可优化",
    recentMemory: "最近记忆",
    recentCalls: "最近调用",
    refresh: "刷新",
    reminder: "提醒",
    reminderCompleted: "提醒已完成。",
    reminderDeleted: "提醒已删除。",
    reminderPlaceholder: "例如：完成 5207",
    reminderSamples: "提醒样本",
    reminderSaved: "提醒已保存",
    reminders: "提醒",
    saveContext: "保存上下文",
    saveLanguageLayer: "保存语言理解层",
    savePlace: "保存地点",
    savePreferences: "保存偏好",
    saveProject: "保存项目",
    saveReminder: "保存提醒",
    savedTokens: "节省",
    send: "发送",
    sevenDayTrend: "7 日趋势",
    settingsSaved: "偏好已保存。",
    setup: "设置",
    statusIsActive: "已激活。",
    statusPlaceholder: "添加状态，例如 Poker",
    statusReminder: "状态提醒",
    statusSamples: "状态样本",
    statusSamplesMetric: "状态样本",
    statusUpdated: "状态已更新。",
    suggested: "建议",
    suggestedActions: "建议行动",
    switch: "切换",
    time: "时间",
    thinking: "思考模式",
    today: "今日",
    todayBrief: "今日",
    todayTokens: "今日 tokens",
    tokenUsage: "Token 使用",
    type: "类型",
    unknown: "未知",
    updateStatus: "更新状态",
    usage: "用量",
    useLocation: "使用位置",
    weather: "天气",
    weatherPlaceholder: "sunny / rain / unknown",
    workingMemoryEmpty: "还没有正在延续的记忆线。"
  }
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
  $("contextReceiptLine").textContent = `${status} · ${location} · ${weather} · ${time} · ${route?.label || "General"}`;
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
    ].join(" · ");
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
  if (!messages.length) {
    const starter = document.createElement("div");
    starter.className = "message assistant";
    starter.textContent = "Hi, I am Luma.";
    $("chatMessages").append(starter);
    renderProcessPanel();
    return;
  }

  for (const message of messages) {
    const bubble = document.createElement("div");
    bubble.className = `message ${message.role === "user" ? "user" : "assistant"}`;
    if (message.role === "assistant") renderRichMessage(bubble, message.content);
    else bubble.textContent = message.content;
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
    row.querySelector("span").textContent = step.state === "running" ? "..." : "✓";
    row.querySelector("strong").textContent = step.label;
    row.querySelector("small").textContent = step.detail || formatShortTime(step.timestamp);
    $("processList").append(row);
  }
}

function renderConversationArchive() {
  const route = activeRouteLabel || state.activeSession?.routeLabel || "general";
  const archived = archiveSessions(route);
  $("conversationArchiveCount").textContent = archived.length;
  $("conversationArchiveList").innerHTML = "";

  if (!archived.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = state.settings?.language === "zh" ? "暂无归档聊天。" : "No archived chat yet.";
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
    time.textContent = [formatShortTime(session.lastMessageAt || session.updatedAt), `${session.messageCount} messages`].filter(Boolean).join(" · ");
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

function archiveSessions(route) {
  const sessionMap = new Map();
  for (const session of state.sessions || []) {
    if (session.id !== state.activeSessionId && (session.routeLabel || "general") === route) {
      sessionMap.set(session.id, { ...session, messages: [], messageCount: session.messageCount || 0 });
    }
  }
  for (const message of state.conversations || []) {
    if (message.conversationId === state.activeSessionId) continue;
    if ((message.routeLabel || "general") !== route) continue;
    const existing = sessionMap.get(message.conversationId) || {
      id: message.conversationId,
      title: "",
      routeLabel: message.routeLabel || route,
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
  if (state.settings?.language === "zh") {
    if (hour < 12) return "早上好。";
    if (hour < 18) return "下午好。";
    return "晚上好。";
  }
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
  $("workingMemoryLine").textContent = bits.length ? bits.join(" · ") : t("workingMemoryEmpty");

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
    empty.textContent = state.settings?.language === "zh" ? "先在 Setup 里创建项目。" : "Create a project in Setup first.";
    $("projectList").append(empty);
  }
  for (const project of (state.projects || []).slice(-5).reverse()) {
    const row = document.createElement("div");
    row.className = "project-item";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.innerHTML = `<strong></strong><small></small>`;
    row.querySelector("strong").textContent = project.name;
    row.querySelector("small").textContent = [project.state, project.nextStep ? `next: ${project.nextStep}` : ""].filter(Boolean).join(" · ");
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
  $("usageMiniLine").textContent = `${usage.calls || 0} calls · $${Number(usage.cost || 0).toFixed(6)}`;

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
    button.querySelector("span").textContent = "→";
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
    row.querySelector("strong").textContent = `${item.provider} · ${item.model}`;
    row.querySelector("small").textContent = `${item.reason} · ${new Date(item.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    row.querySelector("span").textContent = `${item.totalTokens} tok · $${Number(item.estimatedCostUsd || 0).toFixed(6)}`;
    $("usageList").append(row);
  }

  renderCapabilities();
  renderMemoryIndex();
}

function renderRichMessage(node, content) {
  node.innerHTML = safeMarkdown(content);
}

function safeMarkdown(content) {
  const escaped = escapeHtml(String(content || ""));
  const lines = escaped.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  let code = [];

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
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
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (!line.trim()) continue;
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  if (inList) html.push("</ul>");
  if (inCode) html.push(`<pre><code>${code.join("\n")}</code></pre>`);
  return html.join("");
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
    row.querySelector("span").textContent = `${capability.state} · ${capability.adapter}`;
    $("capabilityList").append(row);
  }
}

function renderMemoryIndex() {
  const index = state.memoryIndex || {};
  $("memoryIndexState").textContent = index.state || "planned";
  $("memoryIndexList").innerHTML = "";
  const rules = index.rules || {};
  const rows = [
    ["Provider", index.provider || "scoped-rag"],
    ["Chunks", String(index.chunkCount || 0)],
    ["Default retrieve", rules.defaultRetrieve ? "enabled" : "disabled"],
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
    update_status: state.settings?.language === "zh" ? "更新状态" : "Update status",
    create_reminder: state.settings?.language === "zh" ? "创建提醒" : "Create reminder",
    create_deadline: state.settings?.language === "zh" ? "创建截止提醒" : "Create deadline",
    save_project_progress: state.settings?.language === "zh" ? "保存项目进度" : "Save project progress",
    create_continuation: state.settings?.language === "zh" ? "创建延续记忆" : "Create continuation",
    save_memory_note: state.settings?.language === "zh" ? "保存记忆" : "Save memory",
    suggest_next_action: state.settings?.language === "zh" ? "建议下一步" : "Suggest next action",
    review_memory: state.settings?.language === "zh" ? "回顾记忆" : "Review memory"
  }[tool] || tool;
}

function suggestedPrompt(suggestion) {
  if (suggestion.tool === "suggest_next_action") {
    return state.settings?.language === "zh" ? "基于最近记忆，建议我下一步做什么" : "Suggest my next action based on recent memory";
  }
  if (suggestion.tool === "review_memory") {
    return state.settings?.language === "zh" ? "回顾最近记忆" : "Review recent memory";
  }
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
  $("llmStatus").textContent = state.llm?.enabled ? `${state.llm.model} · on` : "local";
  $("deepseekKeyInput").value = "";
  $("deepseekModelInput").value = state.llm?.model || "deepseek-v4-flash";
  $("deepseekThinkingInput").value = state.llm?.thinking || "disabled";
  $("locationInput").value = state.context.locationTag === "unknown" ? "" : state.context.locationTag || "";
  $("weatherInput").value = state.context.weather === "unknown" ? "" : state.context.weather || "";
  const lat = finiteContextNumber(state.context.latitude);
  const lon = finiteContextNumber(state.context.longitude);
  $("coordinateLine").textContent =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `Coordinates saved · ${lat.toFixed(4)}, ${lon.toFixed(4)}`
      : t("locationNotCaptured");
  $("lanLine").textContent = state.lanUrls?.[0] ? `Phone / LAN: ${state.lanUrls[0]}` : "LAN address unavailable.";
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
  lastReceiptNote = `${t("statusUpdated")} ${label} ${t("statusIsActive")} ${result.receipt.location} · ${result.receipt.weather} · ${result.receipt.reminderCount} ${t("reminders")}`;
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
    body: JSON.stringify({ routeLabel })
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
    item.textContent = `${file.name} · ${formatBytes(file.size)}`;
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
    new Notification("Luma reminder", { body: `${alert.text} · ${alert.minutesBefore} min left` });
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
  return next ? `due ${due} · next alert ${next.minutesBefore}m before` : `due ${due}`;
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
  const thinking = document.createElement("div");
  thinking.className = "message assistant thinking-message";
  thinking.textContent = "Luma is thinking...";
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
        routeLabel: activeRouteLabel || state.activeSession?.routeLabel || "general"
      })
    });
    pendingProposal = result.proposal?.proposedActions?.length ? result.proposal : null;
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
  lastReceiptNote = state.settings?.language === "zh" ? "Luma 已执行并写入本地记忆。" : "Luma executed the action and wrote local memory.";
  await load(result.state);
});

$("cancelProposalButton").addEventListener("click", () => {
  pendingProposal = null;
  renderProposal();
});

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
