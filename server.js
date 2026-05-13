import http from "node:http";
import { config } from "./src/config.js";
import { ensureDb } from "./src/storage.js";
import { createRouter } from "./src/routes.js";
import { clientIpList, sendJson, serveStatic } from "./src/http.js";
import { authRequired, clearAuth, handleLogin, isAuthed } from "./src/auth.js";
import { readJson } from "./src/http.js";

const router = createRouter();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        name: "Luma",
        storage: config.databaseUrl ? "postgres" : "file",
        brain: {
          provider: config.brainProvider,
          enabled: Boolean(config.brainEndpoint),
          model: config.brainModel,
          mode: config.brainMode
        }
      });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/state") {
      return sendJson(res, 200, { required: authRequired(), authed: isAuthed(req) });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const ok = handleLogin(await readJson(req), res);
      return sendJson(res, ok ? 200 : 401, { ok });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      clearAuth(res);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname.startsWith("/api/")) {
      if (!isAuthed(req)) return sendJson(res, 401, { error: "Luma access code required." });
      return await router(req, res, url);
    }
    return await serveStatic(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

await ensureDb();
server.listen(config.port, "0.0.0.0", () => {
  console.log(`Luma is running at http://localhost:${config.port}`);
  for (const ip of clientIpList()) console.log(`LAN access: http://${ip}:${config.port}`);
});
