export function nowFeatures(db) {
  const now = new Date();
  const hour = now.getHours();
  const context = db?.context || {};
  return {
    hourBucket: `${String(hour).padStart(2, "0")}-${String((hour + 1) % 24).padStart(2, "0")}`,
    weekday: now.getDay(),
    weekdayLabel: now.toLocaleDateString(undefined, { weekday: "long" }),
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    locationTag: context.locationTag || "unknown",
    placeId: context.placeId || null,
    weather: context.weather || "unknown",
    temperature: context.temperature ?? null,
    date: now.toISOString().slice(0, 10),
    localTime: now.toLocaleString(),
    displayTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  };
}
