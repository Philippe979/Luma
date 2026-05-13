import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { config } from "./config.js";

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

export function sendText(res, status, payload, type = "text/plain") {
  res.writeHead(status, { "Content-Type": type });
  res.end(payload);
}

export async function serveStatic(res, urlPath) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(config.publicDir, safePath));
  if (!filePath.startsWith(config.publicDir)) return sendText(res, 403, "Forbidden");
  const ext = path.extname(filePath);
  const type = ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : ext === ".json" ? "application/json" : "text/html";
  try {
    return sendText(res, 200, await readFile(filePath, "utf8"), type);
  } catch {
    return sendText(res, 404, "Not found");
  }
}

export function clientIpList() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}
