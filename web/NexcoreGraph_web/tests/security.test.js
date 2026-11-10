const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("browser AI client never downloads dotenv files", () => {
  const source = fs.readFileSync(path.join(ROOT, "js", "agnes.js"), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(\s*["']\.env["']/);
  assert.doesNotMatch(source, /AGNES_API_KEY/);
});

test("web launchers use the hardened static server", () => {
  const bat = fs.readFileSync(path.join(ROOT, "start.bat"), "utf8");
  const sh = fs.readFileSync(path.join(ROOT, "start.sh"), "utf8");
  assert.match(bat, /serve_web\.py/);
  assert.match(sh, /serve_web\.py/);
});
