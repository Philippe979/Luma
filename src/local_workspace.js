import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { withLifecycle } from "./lifecycle.js";

const allowedExtensions = new Set([".csv", ".docx", ".xlsx", ".pptx"]);

export function workspaceState(db) {
  const workspace = normalizeWorkspace(db);
  return {
    enabled: workspace.enabled,
    root: workspace.root,
    allowedExtensions: [...allowedExtensions],
    requireConfirmBeforeWrite: workspace.requireConfirmBeforeWrite,
    operationLog: workspace.operationLog.slice(-30)
  };
}

export async function updateWorkspaceSettings(db, body = {}) {
  db.localWorkspace = normalizeWorkspace(db);
  if (body.root !== undefined) db.localWorkspace.root = String(body.root || "").trim();
  if (body.enabled !== undefined) db.localWorkspace.enabled = Boolean(body.enabled);
  if (body.requireConfirmBeforeWrite !== undefined) db.localWorkspace.requireConfirmBeforeWrite = Boolean(body.requireConfirmBeforeWrite);
  if (db.localWorkspace.enabled) await ensureWorkspaceRoot(db.localWorkspace);
  return workspaceState(db);
}

export async function listWorkspaceFiles(db, relativeDir = "") {
  const workspace = await requireWorkspace(db);
  const dir = resolveInsideWorkspace(workspace.root, relativeDir || ".");
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relativePath = normalizeRelative(workspace.root, absolute);
    if (entry.isDirectory()) {
      files.push({ name: entry.name, path: relativePath, kind: "folder" });
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(ext)) continue;
    const info = await stat(absolute);
    files.push({
      name: entry.name,
      path: relativePath,
      kind: ext.slice(1),
      size: info.size,
      updatedAt: info.mtime.toISOString()
    });
  }
  return files.sort((a, b) => String(a.kind).localeCompare(String(b.kind)) || a.name.localeCompare(b.name));
}

export async function readWorkspaceFile(db, relativePath) {
  const workspace = await requireWorkspace(db);
  const filePath = resolveAllowedFile(workspace.root, relativePath);
  const buffer = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const payload = await extractWorkspaceFile(buffer, ext, filePath);
  const operation = logWorkspaceOperation(db, {
    action: "read",
    path: normalizeRelative(workspace.root, filePath),
    fileType: ext.slice(1),
    status: "completed",
    summary: payload.summary
  });
  return { ...payload, path: operation.path, operation };
}

export async function writeWorkspaceFile(db, body = {}) {
  const workspace = await requireWorkspace(db);
  const filePath = resolveAllowedFile(workspace.root, body.path);
  const ext = path.extname(filePath).toLowerCase();
  const operation = String(body.operation || "replace").trim();
  const createBackup = body.createBackup !== false;
  const before = existsSync(filePath) ? await readFile(filePath) : null;
  if (before && createBackup) {
    const backupPath = `${filePath}.${timestampSlug()}.bak`;
    await writeFile(backupPath, before);
  }

  let summary = "";
  if (ext === ".csv") {
    summary = await writeCsv(filePath, body);
  } else if (ext === ".xlsx") {
    summary = await writeXlsx(filePath, body);
  } else if (ext === ".docx") {
    summary = await writeDocxVersion(filePath, body);
  } else if (ext === ".pptx") {
    summary = await writePptxVersion(filePath, body);
  } else {
    throw new Error(`Unsupported workspace file type: ${ext}`);
  }

  const logged = logWorkspaceOperation(db, {
    action: operation,
    path: normalizeRelative(workspace.root, filePath),
    fileType: ext.slice(1),
    status: "completed",
    summary,
    backupCreated: Boolean(before && createBackup)
  });
  return { ok: true, operation: logged, summary };
}

async function extractWorkspaceFile(buffer, ext, filePath) {
  if (ext === ".csv") {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const table = parseCsv(text);
    return {
      fileType: "csv",
      title: path.basename(filePath),
      text,
      summary: `${table.rows.length} rows, ${table.headers.length} columns`,
      preview: table.rows.slice(0, 20),
      metadata: { headers: table.headers, rows: table.rows.length }
    };
  }
  if (ext === ".docx") return readDocx(buffer, filePath);
  if (ext === ".xlsx") return readXlsx(buffer, filePath);
  if (ext === ".pptx") return readPptx(buffer, filePath);
  throw new Error(`Unsupported workspace file type: ${ext}`);
}

async function readDocx(buffer, filePath) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = String(result.value || "").trim();
    return {
      fileType: "docx",
      title: path.basename(filePath),
      text,
      summary: text ? `${text.length} readable characters` : "No readable text extracted",
      metadata: { messages: result.messages || [] }
    };
  } catch (error) {
    throw new Error(`DOCX workspace reader needs npm install: ${error.message}`);
  }
}

async function readXlsx(buffer, filePath) {
  try {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheets = workbook.SheetNames.map((name) => {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false });
      return { name, rows: rows.slice(0, 50), rowCount: rows.length };
    });
    return {
      fileType: "xlsx",
      title: path.basename(filePath),
      text: sheets.map((sheet) => `${sheet.name}: ${sheet.rowCount} rows`).join("\n"),
      summary: `${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`,
      metadata: { sheets }
    };
  } catch (error) {
    throw new Error(`Excel workspace reader needs npm install: ${error.message}`);
  }
}

async function readPptx(buffer, filePath) {
  try {
    const jszip = await import("jszip");
    const Zip = jszip.default || jszip;
    const zip = await Zip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide[0-9]+\.xml$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const slides = [];
    for (const name of slideFiles) {
      const xml = await zip.files[name].async("string");
      const text = extractXmlText(xml);
      slides.push({ name, text });
    }
    const text = slides.map((slide, index) => `Slide ${index + 1}: ${slide.text}`).join("\n").trim();
    return {
      fileType: "pptx",
      title: path.basename(filePath),
      text,
      summary: text ? `${text.length} readable characters` : "No readable slide text extracted",
      metadata: { slides }
    };
  } catch (error) {
    throw new Error(`PPT workspace reader needs npm install: ${error.message}`);
  }
}

async function writeCsv(filePath, body) {
  if (body.operation === "update_cell") {
    const current = existsSync(filePath) ? (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "") : "";
    const table = parseCsv(current);
    const rowIndex = Number(body.rowIndex);
    const column = String(body.column || "");
    const colIndex = table.headers.indexOf(column);
    if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new Error("CSV update_cell needs rowIndex >= 0.");
    if (colIndex < 0) throw new Error(`CSV column not found: ${column}`);
    table.rows[rowIndex] = table.rows[rowIndex] || [];
    table.rows[rowIndex][colIndex] = String(body.value ?? "");
    await writeFile(filePath, stringifyCsv([table.headers, ...table.rows]));
    return `Updated ${column} at row ${rowIndex + 1}`;
  }
  if (body.operation === "append_row") {
    const current = existsSync(filePath) ? (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "") : "";
    const table = parseCsv(current);
    const values = Array.isArray(body.values) ? body.values : [];
    await writeFile(filePath, stringifyCsv([table.headers, ...table.rows, values]));
    return "Appended one CSV row";
  }
  const text = String(body.text ?? "");
  await writeFile(filePath, text);
  return "Replaced CSV content";
}

async function writeXlsx(filePath, body) {
  try {
    const xlsx = await import("xlsx");
    const workbook = existsSync(filePath) ? xlsx.read(await readFile(filePath), { type: "buffer" }) : xlsx.utils.book_new();
    const sheetName = body.sheetName || workbook.SheetNames[0] || "Sheet1";
    let sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      sheet = xlsx.utils.aoa_to_sheet([]);
      xlsx.utils.book_append_sheet(workbook, sheet, sheetName);
    }
    if (body.operation === "update_cell") {
      const cell = String(body.cell || "");
      if (!/^[A-Z]+[0-9]+$/i.test(cell)) throw new Error("Excel update_cell needs an A1 cell address.");
      sheet[cell.toUpperCase()] = { t: "s", v: String(body.value ?? "") };
      const range = xlsx.utils.decode_range(sheet["!ref"] || "A1:A1");
      const addr = xlsx.utils.decode_cell(cell.toUpperCase());
      range.e.r = Math.max(range.e.r, addr.r);
      range.e.c = Math.max(range.e.c, addr.c);
      sheet["!ref"] = xlsx.utils.encode_range(range);
    } else if (Array.isArray(body.rows)) {
      workbook.Sheets[sheetName] = xlsx.utils.aoa_to_sheet(body.rows);
    } else {
      throw new Error("Excel write needs update_cell or rows.");
    }
    await writeFile(filePath, xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }));
    return `Updated Excel sheet ${sheetName}`;
  } catch (error) {
    throw new Error(`Excel writer needs npm install: ${error.message}`);
  }
}

async function writeDocxVersion(filePath, body) {
  try {
    const docx = await import("docx");
    const { Document, Packer, Paragraph, TextRun } = docx;
    const lines = String(body.text || "").split(/\r?\n/);
    const document = new Document({
      sections: [{ children: lines.map((line) => new Paragraph({ children: [new TextRun(line || " ")] })) }]
    });
    await writeFile(filePath, await Packer.toBuffer(document));
    return "Wrote DOCX plain-text version";
  } catch (error) {
    throw new Error(`DOCX writer needs npm install: ${error.message}`);
  }
}

async function writePptxVersion(filePath, body) {
  try {
    const pptxgen = await import("pptxgenjs");
    const PptxGenJS = pptxgen.default || pptxgen;
    const pptx = new PptxGenJS();
    const slides = Array.isArray(body.slides) && body.slides.length ? body.slides : [{ title: "Luma slide", body: String(body.text || "") }];
    for (const item of slides) {
      const slide = pptx.addSlide();
      slide.addText(String(item.title || "Slide"), { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 24, bold: true });
      slide.addText(String(item.body || ""), { x: 0.5, y: 1.1, w: 9, h: 4.8, fontSize: 16, breakLine: false });
    }
    await writeFile(filePath, await pptx.write({ outputType: "nodebuffer" }));
    return "Wrote PPTX generated version";
  } catch (error) {
    throw new Error(`PPT writer needs npm install: ${error.message}`);
  }
}

function normalizeWorkspace(db) {
  db.localWorkspace = db.localWorkspace || {};
  return {
    enabled: Boolean(db.localWorkspace.enabled),
    root: db.localWorkspace.root || config.localWorkspaceRoot || path.join(config.dataDir, "workspace"),
    allowedExtensions: [...allowedExtensions],
    requireConfirmBeforeWrite: db.localWorkspace.requireConfirmBeforeWrite !== false,
    operationLog: Array.isArray(db.localWorkspace.operationLog) ? db.localWorkspace.operationLog : []
  };
}

async function requireWorkspace(db) {
  db.localWorkspace = normalizeWorkspace(db);
  if (!db.localWorkspace.enabled) throw new Error("Local workspace is disabled.");
  await ensureWorkspaceRoot(db.localWorkspace);
  return db.localWorkspace;
}

async function ensureWorkspaceRoot(workspace) {
  const root = path.resolve(workspace.root || path.join(config.dataDir, "workspace"));
  workspace.root = root;
  await mkdir(root, { recursive: true });
}

function resolveAllowedFile(root, relativePath) {
  const resolved = resolveInsideWorkspace(root, relativePath);
  const ext = path.extname(resolved).toLowerCase();
  if (!allowedExtensions.has(ext)) throw new Error(`Unsupported file type: ${ext || "none"}`);
  return resolved;
}

function resolveInsideWorkspace(root, relativePath) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relativePath || "."));
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new Error("Path is outside the local workspace.");
  }
  return target;
}

function normalizeRelative(root, absolute) {
  return path.relative(path.resolve(root), path.resolve(absolute)).replaceAll(path.sep, "/");
}

function logWorkspaceOperation(db, operation) {
  db.localWorkspace = normalizeWorkspace(db);
  const now = new Date().toISOString();
  const record = withLifecycle({
    id: crypto.randomUUID(),
    timestamp: now,
    ...operation
  }, now);
  db.localWorkspace.operationLog.push(record);
  db.localWorkspace.operationLog = db.localWorkspace.operationLog.slice(-120);
  return record;
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

function stringifyCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function extractXmlText(xml) {
  return String(xml || "")
    .replace(/<a:br\/>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
