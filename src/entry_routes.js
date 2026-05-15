export const entryRoutes = [
  {
    id: "general",
    label: "General",
    tone: "balanced, conversational, and context-aware",
    memoryPriority: ["working", "recent", "long_term"]
  },
  {
    id: "academic",
    label: "Academic",
    tone: "structured, analytical, research-oriented",
    memoryPriority: ["project", "working", "recent"]
  },
  {
    id: "planning",
    label: "Planning",
    tone: "task-driven, concise, schedule-aware",
    memoryPriority: ["reminders", "projects", "working"]
  },
  {
    id: "xiaoyang-pan",
    label: "Xiaoyang Pan",
    tone: "preference-aware and personal",
    memoryPriority: ["long_term", "recent", "working"]
  },
  {
    id: "shen-huang",
    label: "Shen Huang",
    tone: "preference-aware and personal",
    memoryPriority: ["long_term", "recent", "working"]
  },
  {
    id: "shixin-liu",
    label: "Shixin Liu",
    tone: "preference-aware and personal",
    memoryPriority: ["long_term", "recent", "working"]
  }
];

export function normalizeRouteLabel(value) {
  const id = slug(value || "general");
  return entryRoutes.some((route) => route.id === id) ? id : "general";
}

export function routeProfile(value) {
  const id = normalizeRouteLabel(value);
  return entryRoutes.find((route) => route.id === id) || entryRoutes[0];
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
