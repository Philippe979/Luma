export const seedStatuses = [
  { id: "wake", label: "Wake", builtin: true, group: "routine", attention: "normal" },
  { id: "leaving", label: "Leaving", builtin: true, group: "transition", attention: "normal" },
  { id: "class", label: "Class", builtin: true, group: "focus", attention: "silent" },
  { id: "study", label: "Study", builtin: true, group: "focus", attention: "normal" },
  { id: "work", label: "Work", builtin: true, group: "focus", attention: "normal" },
  { id: "game", label: "Game", builtin: true, group: "leisure", attention: "light" },
  { id: "rest", label: "Rest", builtin: true, group: "rest", attention: "light" },
  { id: "sleep", label: "Sleep", builtin: true, group: "rest", attention: "silent" }
];

export const defaultDb = {
  version: 1,
  activeStatusId: null,
  context: {
    locationTag: "unknown",
    latitude: null,
    longitude: null,
    weather: "unknown",
    temperature: null,
    lastUpdated: null
  },
  places: [],
  statuses: seedStatuses,
  reminders: [],
  history: [],
  sessions: [],
  activeSessionId: null,
  processTraces: [],
  memoryEvents: [],
  actionEvents: [],
  conversations: [],
  projects: [],
  usageEvents: [],
  brainEvents: [],
  trainingSamples: [],
  workingMemory: {
    activeProject: null,
    lastProgress: null,
    nextStep: null,
    updatedAt: null
  },
  modes: [],
  actionCards: [
    { id: "continue_project", label: "Continue Project", tool: "suggest_next_action", source: "seed" },
    { id: "review_memory", label: "Review Memory", tool: "review_memory", source: "seed" }
  ],
  alertLog: [],
  settings: {
    language: "en"
  }
};
