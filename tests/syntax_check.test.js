const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { syntaxCheck, findUp } = require("../Tools/syntax_check.js");

let dir;
before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "clinn-syn-")); });
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });

test("syntaxCheck: valid .js returns null", () => {
  const p = path.join(dir, "ok.js");
  fs.writeFileSync(p, "const a = 1;\nmodule.exports = a;\n", "utf-8");
  assert.equal(syntaxCheck(p), null);
});

test("syntaxCheck: broken .js returns a message, does not throw", () => {
  const p = path.join(dir, "bad.js");
  fs.writeFileSync(p, "const = = broken {{{", "utf-8");
  const err = syntaxCheck(p);
  assert.ok(typeof err === "string" && err.length > 0, "expected an error string");
});

test("syntaxCheck: valid JSON returns null; invalid JSON returns message", () => {
  const good = path.join(dir, "ok.json");
  fs.writeFileSync(good, '{"a":1}', "utf-8");
  assert.equal(syntaxCheck(good), null);

  const bad = path.join(dir, "bad.json");
  fs.writeFileSync(bad, "{oops", "utf-8");
  const err = syntaxCheck(bad);
  assert.ok(typeof err === "string" && err.length > 0);
});

test("syntaxCheck: non-code extensions are skipped (null) by design", () => {
  const md = path.join(dir, "note.md");
  fs.writeFileSync(md, "this is **not** code", "utf-8");
  assert.equal(syntaxCheck(md), null);
});

test("findUp: locates a marker file in a parent directory", () => {
  const sub = path.join(dir, "a", "b");
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(dir, "marker.txt"), "x");
  const hit = findUp("marker.txt", sub);
  assert.equal(hit, path.join(dir, "marker.txt"));
  assert.equal(findUp("does-not-exist-xyz.txt", sub), null);
});
