import crypto from "node:crypto";

const pricesPerMillion = {
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-v4-pro": { input: 1.74, output: 3.48 }
};

export function addUsageEvent(db, event) {
  const inputTokens = Number(event.inputTokens || 0);
  const outputTokens = Number(event.outputTokens || 0);
  const model = event.model || "unknown";
  const pricing = pricesPerMillion[model] || { input: 0, output: 0 };
  const estimatedCost =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  const record = {
    id: crypto.randomUUID(),
    provider: event.provider || "local",
    model,
    reason: event.reason || "chat",
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: Number(estimatedCost.toFixed(8)),
    parser: event.parser || event.provider || "local",
    optimized: Boolean(event.optimized),
    savedTokens: Number(event.savedTokens || 0),
    timestamp: new Date().toISOString()
  };
  db.usageEvents.push(record);
  return record;
}

export function usageSummary(db) {
  const events = db.usageEvents || [];
  const todayKey = dayKey(new Date());
  const today = events.filter((event) => dayKey(new Date(event.timestamp)) === todayKey);
  const days = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = dayKey(date);
    const dayEvents = events.filter((event) => dayKey(new Date(event.timestamp)) === key);
    return {
      date: key,
      label: date.toLocaleDateString([], { weekday: "short" }),
      inputTokens: sum(dayEvents, "inputTokens"),
      outputTokens: sum(dayEvents, "outputTokens"),
      totalTokens: sum(dayEvents, "totalTokens"),
      cost: Number(sum(dayEvents, "estimatedCostUsd").toFixed(6))
    };
  });

  return {
    today: {
      calls: today.length,
      inputTokens: sum(today, "inputTokens"),
      outputTokens: sum(today, "outputTokens"),
      totalTokens: sum(today, "totalTokens"),
      cost: Number(sum(today, "estimatedCostUsd").toFixed(6)),
      savedTokens: sum(today, "savedTokens")
    },
    days,
    recent: [...events].slice(-12).reverse()
  };
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
