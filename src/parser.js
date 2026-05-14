export function parseChatInput(text, db) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  const actions = [];

  const status = matchStatus(input);
  if (status) {
    actions.push({
      tool: "update_status",
      args: { label: status },
      reason: `Set current status to ${status}`
    });
  }

  const progress = matchProgress(input);
  if (progress) {
    actions.push({
      tool: "save_project_progress",
      args: progress,
      reason: `Save progress for ${progress.project}`
    });
  }

  const deadline = matchDeadline(input);
  if (deadline) {
    actions.push({
      tool: "create_deadline",
      args: deadline,
      reason: "Create a deadline reminder"
    });
  }

  const reminder = matchReminder(input);
  if (reminder && !deadline) {
    actions.push({
      tool: "create_reminder",
      args: reminder,
      reason: "Create a reminder"
    });
  }

  const continuation = matchContinuation(input, progress?.project || db.workingMemory?.activeProject);
  if (continuation) {
    actions.push({
      tool: "create_continuation",
      args: continuation,
      reason: `Create a continuation note for ${continuation.project}`
    });
  }

  if (!actions.length && input) {
    if (isSmallTalk(input)) {
      return {
        input,
        confidence: 0.65,
        proposedActions: [],
        response: smallTalkResponse(input)
      };
    }

    actions.push({
      tool: "save_memory_note",
      args: { note: input },
      reason: "Save this as memory"
    });
  }

  return {
    input,
    confidence: actions.length ? 0.72 : 0.2,
    proposedActions: actions,
    response: buildResponse(actions)
  };
}

function matchStatus(input) {
  const patterns = [
    /我现在在(.+?)(?:。|，|,|$)/,
    /我正在(.+?)(?:。|，|,|$)/,
    /切换到(.+?)(?:。|，|,|$)/,
    /status[:：]\s*(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return null;
}

function matchProgress(input) {
  const patterns = [
    /(?:今天)?\s*([A-Za-z0-9\u4e00-\u9fa5_-]{2,})\s*(?:做到|完成到|进展到|写到)\s*(.+?)(?:，|。|,|$)/,
    /(?:记录|保存)\s*([A-Za-z0-9\u4e00-\u9fa5_-]{2,})\s*(?:进度)?[:：]\s*(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { project: clean(match[1]), progress: clean(match[2]) };
    }
  }
  return null;
}

function matchDeadline(input) {
  const time = extractTime(input);
  if (!time) return null;
  const match = input.match(/(?:前完成|完成|交|提交)\s*(.+?)(?:。|，|,|$)/) || input.match(/(.+?)(?:前完成|截止)/);
  const text = clean(match?.[1] || timedReminderText(input));
  return {
    text,
    dueAt: time.toISOString(),
    leadTimes: [30, 20, 10],
    statusIds: []
  };
}

function matchReminder(input) {
  const match = input.match(/提醒我\s*(.+?)(?:。|$)/) || input.match(/记得\s*(.+?)(?:。|$)/);
  if (!match?.[1]) return null;
  return {
    text: clean(match[1]),
    frequency: "once",
    statusIds: []
  };
}

function matchContinuation(input, project) {
  if (!project) return null;
  if (!/(明天继续|下次继续|之后继续|继续)/.test(input)) return null;
  return {
    project,
    text: `Continue ${project}`,
    when: /明天/.test(input) ? "tomorrow" : "next"
  };
}

function extractTime(input) {
  const now = new Date();
  const relative = input.match(/([0-9]+|一|二|两|三|四|五|六|七|八|九|十|十五|二十|三十|半)\s*(分钟|小时|个小时)(?:之后|后)/);
  if (relative) {
    const due = new Date(now);
    const amount = parseAmount(relative[1]);
    if (relative[2] === "分钟") due.setMinutes(now.getMinutes() + amount);
    else due.setHours(now.getHours() + amount);
    due.setSeconds(0, 0);
    return due;
  }
  const dayOffset = /明天/.test(input) ? 1 : 0;
  const match = input.match(/(?:下午|晚上|上午|早上)?\s*(\d{1,2})[:：点](\d{0,2})?/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if ((/下午|晚上/.test(input)) && hour < 12) hour += 12;
  const due = new Date(now);
  due.setDate(now.getDate() + dayOffset);
  due.setHours(hour, minute, 0, 0);
  return due;
}

function timedReminderText(input) {
  return clean(
    input
      .replace(/([0-9]+|一|二|两|三|四|五|六|七|八|九|十|十五|二十|三十|半)\s*(分钟|小时|个小时)(?:之后|后)/, "")
      .replace(/(?:明天|今天)?\s*(?:上午|早上|下午|晚上)?\s*\d{1,2}[:：点]\d{0,2}?/, "")
      .replace(/^(?:提醒我|叫我|记得|让我)/, "")
  ) || input;
}

function parseAmount(value) {
  if (/^[0-9]+$/.test(value)) return Number(value);
  return {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十五: 15,
    二十: 20,
    三十: 30,
    半: 0.5
  }[value] || 1;
}

function clean(value) {
  return String(value || "").trim().replace(/^[:：,，。]+|[:：,，。]+$/g, "");
}

function buildResponse(actions) {
  if (!actions.length) return "I can save this as memory.";
  const labels = actions.map((action) => action.tool.replaceAll("_", " ")).join(", ");
  return `I found ${actions.length} action${actions.length > 1 ? "s" : ""}: ${labels}.`;
}

function isSmallTalk(input) {
  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening|welcome|hi[,! ]|hello[,! ]|嗨|你好|早上好|下午好|晚上好|欢迎)/i.test(input.trim());
}

function smallTalkResponse(input) {
  if (/你好|嗨|早上好|下午好|晚上好|欢迎/.test(input)) return "你好，我在。云端和本地 brain 已经连上了，我们可以继续调 Luma。";
  if (/good morning/i.test(input)) return "Good morning. I am here, and Luma's cloud app is connected to the local brain.";
  return "Hi, I am here. Luma is connected and ready.";
}
