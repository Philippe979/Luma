const weatherWords = [
  "sunny",
  "clear",
  "cloudy",
  "rainy",
  "rain",
  "storm",
  "windy",
  "snow",
  "fog",
  "hot",
  "cold"
];

const statusAliases = {
  academic: "Academic",
  study: "Study",
  studying: "Study",
  class: "Class",
  work: "Work",
  working: "Work",
  planning: "Planning",
  plan: "Planning",
  game: "Game",
  rest: "Rest",
  sleep: "Sleep"
};

export function parseContextIntent(text) {
  const input = String(text || "").trim();
  if (!input) return null;

  const patch = {};
  const status = matchStatusLabel(input);
  const location = matchLocation(input);
  const weather = matchWeather(input);

  if (location) patch.locationTag = location;
  if (weather) patch.weather = weather;

  if (!status && !Object.keys(patch).length) return null;

  return {
    statusLabel: status,
    contextPatch: patch,
    summary: summarize({ status, patch })
  };
}

function matchStatusLabel(input) {
  const patterns = [
    /\b(?:status|state|mode)\s*(?:is|to|=|:)\s*([A-Za-z][A-Za-z ]{1,30})/i,
    /\b(?:switch|change|set)\s+(?:status|state|mode)\s+(?:to\s+)?([A-Za-z][A-Za-z ]{1,30})/i,
    /(?:状态|模式)(?:是|为|改成|切到|切换到)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z ]{0,20})/,
    /(?:我现在|现在|开始)(?:在|进入|切到|切换到)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z ]{0,20})(?:状态|模式)?/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    const value = cleanStatus(match?.[1]);
    if (value) return statusAliases[value.toLowerCase()] || value;
  }

  for (const [alias, label] of Object.entries(statusAliases)) {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(input)) return label;
  }
  return null;
}

function matchLocation(input) {
  const patterns = [
    /\b(?:location|place)\s*(?:is|=|:)\s*([A-Za-z0-9][A-Za-z0-9 '\-_]{1,48})/i,
    /\b(?:i am|i'm|im)\s+(?:at|in)\s+([A-Za-z0-9][A-Za-z0-9 '\-_]{1,48})/i,
    /(?:位置|地点)(?:是|为|改成|在)\s*([\u4e00-\u9fa5A-Za-z0-9 '\-_]{1,48})/,
    /(?:我现在|现在)(?:在|到)\s*([\u4e00-\u9fa5A-Za-z0-9 '\-_]{1,48})/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    const value = cleanLocation(match?.[1]);
    if (value && !looksLikeStatus(value)) return value;
  }
  return null;
}

function matchWeather(input) {
  const patterns = [
    /\bweather\s*(?:is|=|:)\s*([A-Za-z]{2,20})/i,
    /(?:天气)(?:是|为|改成)?\s*([\u4e00-\u9fa5A-Za-z]{1,20})/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    const value = normalizeWeather(match?.[1]);
    if (value) return value;
  }

  for (const word of weatherWords) {
    if (new RegExp(`\\b${word}\\b`, "i").test(input)) return normalizeWeather(word);
  }
  return null;
}

function normalizeWeather(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  const zh = {
    晴: "sunny",
    晴天: "sunny",
    多云: "cloudy",
    阴天: "cloudy",
    下雨: "rainy",
    雨: "rainy",
    雨天: "rainy",
    雷雨: "storm",
    大风: "windy",
    下雪: "snow",
    雪: "snow",
    雾: "fog",
    热: "hot",
    冷: "cold"
  };
  if (zh[text]) return zh[text];
  if (text === "rain") return "rainy";
  return weatherWords.includes(text) ? text : null;
}

function cleanStatus(value) {
  return String(value || "")
    .trim()
    .replace(/[。.,，;；].*$/, "")
    .replace(/(?:状态|模式)$/u, "")
    .trim();
}

function cleanLocation(value) {
  return String(value || "")
    .trim()
    .replace(/[。.,，;；].*$/, "")
    .replace(/\s+(?:weather|status|state|mode)\b.*$/i, "")
    .replace(/\s*(?:天气|状态|模式).*$/u, "")
    .trim();
}

function looksLikeStatus(value) {
  return Boolean(statusAliases[String(value || "").trim().toLowerCase()]);
}

function summarize({ status, patch }) {
  const parts = [];
  if (status) parts.push(`status=${status}`);
  if (patch.locationTag) parts.push(`location=${patch.locationTag}`);
  if (patch.weather) parts.push(`weather=${patch.weather}`);
  return `Context updated: ${parts.join(", ")}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
