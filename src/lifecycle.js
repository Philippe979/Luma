export function withLifecycle(record, now = new Date().toISOString()) {
  return {
    state: "active",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    ...record
  };
}

export function isVisible(record) {
  return record?.state !== "deleted" && !record?.deletedAt;
}

export function softDeleteRecord(record, { deletedBy = "user", reason = "user_deleted" } = {}) {
  if (!record) throw new Error("Record not found.");
  const now = new Date().toISOString();
  record.state = "deleted";
  record.deletedAt = now;
  record.deletedBy = deletedBy;
  record.deleteReason = reason;
  record.updatedAt = now;
  return record;
}
