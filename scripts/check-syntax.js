import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["server.js", "src", "public/app.js", "scripts/check-syntax.js"];
const files = roots.flatMap((entry) => collectJs(entry));
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
console.log(`Checked ${files.length} JavaScript files.`);

function collectJs(entry) {
  const stat = statSync(entry);
  if (stat.isFile()) return entry.endsWith(".js") ? [entry] : [];

  const found = [];
  for (const child of readdirSync(entry)) {
    found.push(...collectJs(join(entry, child)));
  }
  return found;
}
