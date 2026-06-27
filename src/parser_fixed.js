import { parseContextIntent } from "./context_intent.js";

export function parseChatInput(text, db = {}) {
  const input = String(text || "").trim();
  const actions = [];
  const workingMemory = db?.workingMemory || {};

  const contextIntent = parseContextIntent(input);
  if (contextIntent?.contextPatch && Object.keys(contextIntent.contextPatch).length) {
    actions.push({
      tool: "update_context",
      args: contextIntent.contextPatch,
      reason: contextIntent.summary
    });
  }
  if (contextIntent?.statusLabel) {
    actions.push({
      tool: "update_status",
      args: { label: contextIntent.statusLabel },
      reason: `Set current status to ${contextIntent.statusLabel}`
    });
  }

  const status = matchStatus(input);
  if (status && !contextIntent?.statusLabel) {
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

  const continuation = matchContinuation(input, progress?.project || workingMemory.activeProject);
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

    if (explicitlyAsksForMemory(input)) {
      actions.push({
        tool: "save_memory_note",
        args: { note: input },
        reason: "Save this as memory"
      });
    }
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
    /\u6211\u73b0\u5728\u5728(.+?)(?:\u3002|\uff0c|,|$)/,
    /\u6211\u6b63\u5728(.+?)(?:\u3002|\uff0c|,|$)/,
    /\u5207\u6362\u5230(.+?)(?:\u3002|\uff0c|,|$)/,
    /status[:\uff1a]\s*(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return null;
}

function matchProgress(input) {
  const patterns = [
    /(?:\u4eca\u5929)?\s*([A-Za-z0-9\u4e00-\u9fa5_-]{2,})\s*(?:\u505a\u5230|\u5b8c\u6210\u5230|\u8fdb\u5c55\u5230|\u5199\u5230)\s*(.+?)(?:\uff0c|\u3002|,|$)/,
    /(?:\u8bb0\u5f55|\u4fdd\u5b58)\s*([A-Za-z0-9\u4e00-\u9fa5_-]{2,})\s*(?:\u8fdb\u5ea6)?[:\uff1a]\s*(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { project: cleanProjectName(match[1]), progress: clean(match[2]) };
    }
  }
  return null;
}

function matchDeadline(input) {
  const time = extractTime(input);
  if (!time) return null;
  const match =
    input.match(/(?:\u5b8c\u6210|\u63d0\u4ea4|\u4ea4)\s*(.+?)(?:\u3002|\uff0c|,|$)/) ||
    input.match(/(.+?)(?:\u524d\u5b8c\u6210|\u622a\u6b62)/);
  return {
    text: clean(match?.[1] || timedReminderText(input)),
    dueAt: time.toISOString(),
    leadTimes: [30, 20, 10],
    statusIds: []
  };
}

function matchReminder(input) {
  const match =
    input.match(/\u63d0\u9192\u6211\s*(.+?)(?:\u3002|$)/) ||
    input.match(/\u8bb0\u5f97\s*(.+?)(?:\u3002|$)/);
  if (!match?.[1]) return null;
  return {
    text: clean(match[1]),
    frequency: "once",
    statusIds: []
  };
}

function matchContinuation(input, project) {
  if (!project) return null;
  if (!/(\u660e\u5929\u7ee7\u7eed|\u4e0b\u6b21\u7ee7\u7eed|\u4e4b\u540e\u7ee7\u7eed|\u7ee7\u7eed)/.test(input)) return null;
  return {
    project,
    text: `Continue ${project}`,
    when: /\u660e\u5929/.test(input) ? "tomorrow" : "next"
  };
}

function extractTime(input) {
  const now = new Date();
  const relative = input.match(/([0-9]+|\u4e00|\u4e8c|\u4e24|\u4e09|\u56db|\u4e94|\u516d|\u4e03|\u516b|\u4e5d|\u5341|\u5341\u4e94|\u4e8c\u5341|\u4e09\u5341|\u534a)\s*(\u5206\u949f|\u5c0f\u65f6|\u4e2a\u5c0f\u65f6)(?:\u4e4b\u540e|\u540e)?/);
  if (relative) {
    const due = new Date(now);
    const amount = parseAmount(relative[1]);
    if (relative[2] === "\u5206\u949f") due.setMinutes(now.getMinutes() + amount);
    else due.setHours(now.getHours() + amount);
    due.setSeconds(0, 0);
    return due;
  }

  const dayOffset = /\u660e\u5929/.test(input) ? 1 : 0;
  const match = input.match(/(?:\u4e0b\u5348|\u665a\u4e0a|\u4e0a\u5348|\u65e9\u4e0a)?\s*(\d{1,2})[:\uff1a\u70b9](\d{0,2})?/);
  if (!match) {
    const vague = input.match(/(\u660e\u5929|\u4eca\u5929)?\s*(\u65e9\u4e0a|\u4e0a\u5348|\u4e0b\u5348|\u665a\u4e0a)/);
    if (!vague) return null;
    const due = new Date(now);
    due.setDate(now.getDate() + (/\u660e\u5929/.test(input) ? 1 : 0));
    const hour = /\u4e0b\u5348/.test(input) ? 14 : /\u665a\u4e0a/.test(input) ? 20 : 9;
    due.setHours(hour, 0, 0, 0);
    return due;
  }

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if ((/\u4e0b\u5348|\u665a\u4e0a/.test(input)) && hour < 12) hour += 12;
  const due = new Date(now);
  due.setDate(now.getDate() + dayOffset);
  due.setHours(hour, minute, 0, 0);
  return due;
}

function timedReminderText(input) {
  return clean(
    input
      .replace(/([0-9]+|\u4e00|\u4e8c|\u4e24|\u4e09|\u56db|\u4e94|\u516d|\u4e03|\u516b|\u4e5d|\u5341|\u5341\u4e94|\u4e8c\u5341|\u4e09\u5341|\u534a)\s*(\u5206\u949f|\u5c0f\u65f6|\u4e2a\u5c0f\u65f6)(?:\u4e4b\u540e|\u540e)?/, "")
      .replace(/(?:\u660e\u5929|\u4eca\u5929)?\s*(?:\u4e0a\u5348|\u65e9\u4e0a|\u4e0b\u5348|\u665a\u4e0a)?\s*\d{1,2}[:\uff1a\u70b9]\d{0,2}?/, "")
      .replace(/^(?:\u63d0\u9192\u6211|\u53eb\u6211|\u8bb0\u5f97|\u8ba9\u6211)/, "")
  ) || input;
}

function parseAmount(value) {
  if (/^[0-9]+$/.test(value)) return Number(value);
  return {
    "\u4e00": 1,
    "\u4e8c": 2,
    "\u4e24": 2,
    "\u4e09": 3,
    "\u56db": 4,
    "\u4e94": 5,
    "\u516d": 6,
    "\u4e03": 7,
    "\u516b": 8,
    "\u4e5d": 9,
    "\u5341": 10,
    "\u5341\u4e94": 15,
    "\u4e8c\u5341": 20,
    "\u4e09\u5341": 30,
    "\u534a": 0.5
  }[value] || 1;
}

function clean(value) {
  return String(value || "").trim().replace(/^[:\uff1a,\uff0c\u3002\s]+|[:\uff1a,\uff0c\u3002\s]+$/g, "");
}

function cleanProjectName(value) {
  return clean(value).replace(/\u8fdb\u5ea6$/u, "").trim();
}

function buildResponse(actions) {
  if (!actions.length) return "I am here. I will keep this chat separate unless you ask me to use memory.";
  const labels = actions.map((action) => action.tool.replaceAll("_", " ")).join(", ");
  return `I found ${actions.length} action${actions.length > 1 ? "s" : ""}: ${labels}.`;
}

function isSmallTalk(input) {
  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening|welcome|hi[,! ]|hello[,! ]|\u55e8|\u4f60\u597d|\u65e9\u4e0a\u597d|\u4e0b\u5348\u597d|\u665a\u4e0a\u597d|\u6b22\u8fce)/i.test(input.trim());
}

function explicitlyAsksForMemory(input) {
  return /(remember|record|save this|save as memory|keep this|note this|preference|project|progress|remind|deadline|\u8bb0\u4f4f|\u8bb0\u5f55|\u4fdd\u5b58|\u63d0\u9192|\u504f\u597d|\u9879\u76ee|\u8fdb\u5ea6)/i.test(input);
}

function smallTalkResponse(input) {
  if (/\u4f60\u597d|\u55e8|\u65e9\u4e0a\u597d|\u4e0b\u5348\u597d|\u665a\u4e0a\u597d|\u6b22\u8fce/.test(input)) {
    return "\u4f60\u597d\uff0c\u6211\u5728\u3002\u5982\u679c\u4f60\u9700\u8981\uff0c\u6211\u53ef\u4ee5\u76f4\u63a5\u56de\u7b54\u3001\u8bfb\u53d6\u6587\u4ef6\uff0c\u6216\u8005\u628a\u5185\u5bb9\u8bb0\u5230\u5f53\u524d\u4f1a\u8bdd\u91cc\u3002";
  }
  if (/good morning/i.test(input)) return "Good morning. I am here, and Luma is ready.";
  return "Hi, I am here. Luma is connected and ready.";
}
