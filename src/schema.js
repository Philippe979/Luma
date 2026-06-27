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
  fileMemories: [],
  usageEvents: [],
  brainEvents: [],
  trainingSamples: [],
  profileMemory: {
    provider: "profile-memory-v0",
    enabled: true,
    promptEnabled: true,
    items: [
      {
        id: "profile_style_direct",
        type: "communication_style",
        statement: "User prefers warm, natural, direct communication instead of customer-service-like transition phrases.",
        evidenceSummary: "User repeatedly corrected Luma for overusing transition phrases and wanted direct results.",
        confidence: 0.86,
        sourceIds: [],
        scope: "global",
        state: "active",
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
        archivedAt: null,
        deletedAt: null
      },
      {
        id: "profile_style_structured",
        type: "format_preference",
        statement: "User likes structured discussion for architecture, deployment, debugging, and version planning.",
        evidenceSummary: "Most Luma development discussions use versioned plans, audits, and implementation boundaries.",
        confidence: 0.82,
        sourceIds: [],
        scope: "global",
        state: "active",
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
        archivedAt: null,
        deletedAt: null
      }
    ],
    rules: {
      injectActive: true,
      minPromptConfidence: 0.75,
      rawMemoryOptIn: true
    },
    updatedAt: null
  },
  workflowRecords: [],
  workflowClusters: [],
  environmentClusters: [],
  memoryExtractionRuns: [],
  memoryIndex: {
    provider: "cluster-router",
    state: "planned",
    lastIndexedAt: null,
    chunkCount: 0,
    rules: {
      defaultRetrieve: false,
      excludeDeleted: true,
      requireSessionOrProjectScope: true
    }
  },
  localWorkspace: {
    enabled: false,
    root: "",
    allowedExtensions: [".csv", ".docx", ".xlsx", ".pptx"],
    requireConfirmBeforeWrite: true,
    operationLog: []
  },
  modelRouting: {
    mode: "manual",
    selectedProviderId: "deepseek",
    compareProviderIds: ["deepseek"],
    reviewProviderIds: [],
    callLog: []
  },
  modelPreferences: {
    feedbackLog: [],
    stablePreferences: []
  },
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
