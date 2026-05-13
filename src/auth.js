import { config } from "./config.js";

const cookieName = "luma_access";

export function authRequired() {
  return Boolean(config.accessCode);
}

export function isAuthed(req) {
  if (!authRequired()) return true;
  const cookie = req.headers.cookie || "";
  return cookie.split(";").some((part) => part.trim() === `${cookieName}=${encodeURIComponent(config.accessCode)}`);
}

export function authState() {
  return { required: authRequired() };
}

export function handleLogin(reqBody, res) {
  if (!authRequired()) return true;
  if (String(reqBody.code || "") !== config.accessCode) return false;
  res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(config.accessCode)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  return true;
}

export function clearAuth(res) {
  res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
