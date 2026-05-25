import crypto from "node:crypto";
import { addMemoryEvent } from "./memory.js";
import { addSessionMessage } from "./conversation.js";
import { addProcessStep, finishProcessTrace, startProcessTrace } from "./process_trace.js";
import { withLifecycle } from "./lifecycle.js";

const textExtensions = new Set([".txt", ".md", ".markdown", ".json", ".html", ".css", ".js", ".ts", ".jsx", ".tsx", ".py", ".sql", ".yml", ".yaml"]);

export async function readUploadedFile(db, body) {
  const fileName = safeFileName(body.fileName || "uploaded-file");
  const mimeType = String(body.mimeType || "").toLowerCase();
  const sessionId = body.sessionId || db.activeSessionId || "default";
  const routeLabel = body.routeLabel || "general";
  const projectId = body.projectId || null;
  const buffer = decodePayload(body);
  if (!buffer.length) throw new Error("Uploaded file is empty.");
  if (buffer.length > 3 * 1024 * 1024) throw new Error("File is too large for V2.2 read mode. Please keep files under 3MB.");

  const trace = startProcessTrace(db, { sessionId, routeLabel });
  addProcessStep(trace, `File detected: ${fileName}`, "done", mimeType || "unknown type");
  const kind = detectKind(fileName, mimeType);
  addProcessStep(trace, `Capability selected: ${kind.capability}`, "done", kind.reason);

  const extracted = await extractFile(buffer, { fileName, mimeType, kind });
  addProcessStep(trace, "File content extracted", "done", `${extracted.text.length} characters`);

  const now = new Date().toISOString();
  const fileMemory = withLifecycle({
    id: crypto.randomUUID(),
    fileName,
    mimeType,
    kind: kind.kind,
    capability: kind.capability,
    sessionId,
    projectId,
    title: titleForFile(fileName),
    summary: summarizeText(extracted.text),
    text: extracted.text,
    metadata: extracted.metadata || {},
    createdAt: now,
    updatedAt: now
  }, now);
  db.fileMemories = db.fileMemories || [];
  db.fileMemories.push(fileMemory);

  addMemoryEvent(db, {
    type: "file_memory",
    summary: fileMemory.title,
    source: "file_upload",
    userText: fileName,
    metadata: {
      memoryType: "file",
      title: fileMemory.title,
      fileMemoryId: fileMemory.id,
      fileName,
      mimeType,
      kind: kind.kind,
      capability: kind.capability,
      sessionId,
      projectId,
      summary: fileMemory.summary
    }
  });

  addSessionMessage(db, {
    role: "assistant",
    content: `**File read:** ${fileName}\n\n${fileMemory.summary || "I extracted the file content and attached it to this session."}`,
    source: "file_upload",
    sessionId,
    routeLabel,
    projectId
  });

  addProcessStep(trace, "File memory saved", "done", "Bound to current session");
  finishProcessTrace(trace);
  return fileMemory;
}

function decodePayload(body) {
  if (body.base64) return Buffer.from(String(body.base64), "base64");
  if (body.dataUrl) {
    const data = String(body.dataUrl);
    const index = data.indexOf(",");
    if (index !== -1) return Buffer.from(data.slice(index + 1), "base64");
  }
  if (body.text !== undefined) return Buffer.from(String(body.text), "utf8");
  return Buffer.alloc(0);
}

function detectKind(fileName, mimeType) {
  const ext = extensionOf(fileName);
  if (mimeType.includes("pdf") || ext === ".pdf") return { kind: "pdf", capability: "file.read_pdf", reason: "PDF document" };
  if (mimeType.includes("wordprocessingml") || ext === ".docx") return { kind: "docx", capability: "file.read_docx", reason: "Word document" };
  if (mimeType.includes("csv") || ext === ".csv") return { kind: "csv", capability: "file.read_csv", reason: "CSV table" };
  if (isCodeExtension(ext)) return { kind: "code", capability: "code.read_file", reason: `${ext.slice(1).toUpperCase()} source file` };
  if (mimeType.startsWith("text/") || textExtensions.has(ext)) return { kind: "text", capability: "file.read_text", reason: "Text file" };
  throw new Error(`Unsupported file type for V2.2 read mode: ${mimeType || ext || "unknown"}`);
}

async function extractFile(buffer, { fileName, mimeType, kind }) {
  if (kind.kind === "text" || kind.kind === "code") {
    return { text: normalizeText(buffer.toString("utf8")), metadata: { fileName, mimeType } };
  }
  if (kind.kind === "csv") {
    const text = normalizeText(buffer.toString("utf8"));
    const table = parseCsv(text);
    return {
      text,
      metadata: {
        fileName,
        mimeType,
        rows: table.rows.length,
        columns: table.headers.length,
        headers: table.headers
      }
    };
  }
  if (kind.kind === "docx") return extractDocx(buffer);
  if (kind.kind === "pdf") return extractPdf(buffer);
  throw new Error(`Unsupported file kind: ${kind.kind}`);
}

async function extractDocx(buffer) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalizeText(result.value || ""), metadata: { messages: result.messages || [] } };
  } catch (error) {
    throw new Error(`DOCX reader is not installed or failed: ${error.message}`);
  }
}

async function extractPdf(buffer) {
  try {
    const module = await import("pdf-parse");
    const parse = module.default || module;
    const result = await parse(buffer);
    return { text: normalizeText(result.text || ""), metadata: { pages: result.numpages || 0, info: result.info || {} } };
  } catch (error) {
    throw new Error(`PDF reader is not installed or failed: ${error.message}`);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return { headers: rows[0] || [], rows: rows.slice(1) };
}

function summarizeText(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) return "No readable text was extracted.";
  return cleaned.length > 700 ? `${cleaned.slice(0, 700)}...` : cleaned;
}

function normalizeText(text) {
  return String(text || "").replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

function titleForFile(fileName) {
  return `File: ${fileName}`.slice(0, 90);
}

function safeFileName(name) {
  return String(name || "uploaded-file").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 160);
}

function extensionOf(fileName) {
  const match = String(fileName || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] || "";
}

function isCodeExtension(ext) {
  return [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".c", ".cpp", ".cs", ".go", ".rs", ".rb", ".php", ".html", ".css", ".json", ".sql"].includes(ext);
}
