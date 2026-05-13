export function learningProgress(db) {
  const statusCounts = {};
  const hourBuckets = new Set();
  const placeTags = new Set();

  for (const sample of db.history || []) {
    statusCounts[sample.selectedStatusId] = (statusCounts[sample.selectedStatusId] || 0) + 1;
    if (sample.features?.hourBucket) hourBuckets.add(sample.features.hourBucket);
    if (sample.features?.locationTag && sample.features.locationTag !== "unknown") {
      placeTags.add(sample.features.locationTag);
    }
  }

  const reminderSamples = db.reminders?.length || 0;
  const knownPlaces = db.places?.length || 0;
  return {
    targets: {
      statusSamples: 100,
      reminderSamples: 30,
      knownPlaces: 3,
      hourCoverage: 8
    },
    counts: {
      statusSamples: db.history?.length || 0,
      reminderSamples,
      knownPlaces,
      hourCoverage: hourBuckets.size
    },
    statusCounts,
    hourBuckets: [...hourBuckets].sort(),
    placeTags: [...placeTags].sort(),
    readyForTuning: (db.history?.length || 0) >= 100
  };
}
