const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  read_file, write_file, delete_file, move_file, copy_file, list_dir,
} = require("../Tools/file_tools.js");

let dir;
before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "clinn-file-")); });
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });

test("file: write then read round-trip, auto-creating parent dirs", async () => {
  const p = path.join(dir, "sub", "nested.txt");
  const w = await write_file.execute({ filePath: p, content: "hello file" });
  assert.ok(w.startsWith("[OK]"));
  assert.equal(fs.readFileSync(p, "utf-8"), "hello file");
  const r = await read_file.execute({ filePath: p });
  assert.equal(r, "hello file");
});

test("file: read missing file returns marker", async () => {
  const r = await read_file.execute({ filePath: path.join(dir, "missing.txt") });
  assert.ok(r.startsWith("[不存在]"));
});

test("file: copy and move", async () => {
  const src = path.join(dir, "c.txt");
  fs.writeFileSync(src, "copyme");
  const dst = path.join(dir, "c_copy.txt");
  await copy_file.execute({ source: src, target: dst });
  assert.equal(fs.readFileSync(dst, "utf-8"), "copyme");

  const moved = path.join(dir, "c_moved.txt");
  await move_file.execute({ source: dst, target: moved });
  assert.ok(!fs.existsSync(dst));
  assert.equal(fs.readFileSync(moved, "utf-8"), "copyme");
});

test("file: delete file ok; non-empty dir refused; empty dir removed", async () => {
  const leaf = path.join(dir, "del_me.txt");
  fs.writeFileSync(leaf, "x");
  const dr = await delete_file.execute({ filePath: leaf });
  assert.ok(dr.startsWith("[OK]"));
  assert.ok(!fs.existsSync(leaf));

  const nonEmpty = path.join(dir, "nonempty");
  fs.mkdirSync(nonEmpty, { recursive: true });
  fs.writeFileSync(path.join(nonEmpty, "child.txt"), "z");
  const dn = await delete_file.execute({ filePath: nonEmpty });
  assert.ok(dn.startsWith("[失败] 目录非空"));
  assert.ok(fs.existsSync(nonEmpty));

  const empty = path.join(dir, "emptydir");
  fs.mkdirSync(empty);
  const de = await delete_file.execute({ filePath: empty });
  assert.ok(de.startsWith("[OK] 已删除空目录"));
});

test("file: list_dir marks DIR/FILE", async () => {
  const out = await list_dir.execute({ dirPath: dir });
  assert.ok(out.includes("[DIR]"));
  assert.ok(out.includes("del_me.txt") || out.includes("[FILE]"));
});

test("file: missing dir listing returns marker", async () => {
  const out = await list_dir.execute({ dirPath: path.join(dir, "nope") });
  assert.ok(out.startsWith("[不存在]"));
});

// INJECTION / untrusted-input pipeline: write_file runs a syntax check on JS.
// Broken JS must surface a warning rather than being silently accepted as clean.
test("injection: write_file flags malformed JS instead of trusting input silently", async () => {
  const bad = path.join(dir, "broken.js");
  const res = await write_file.execute({ filePath: bad, content: "const = = not javascript ;;" });
  assert.ok(res.startsWith("[OK]"), "file is still written");
  assert.ok(res.includes("[⚠ 语法警告]"), "broken JS must produce a syntax warning, got: " + res);
  // the file is on disk regardless (tool behavior), but the warning is surfaced
  assert.ok(fs.existsSync(bad));

  const good = path.join(dir, "good.js");
  const okRes = await write_file.execute({ filePath: good, content: "const a = 1;\nmodule.exports = a;\n" });
  assert.ok(okRes.includes("语法通过"), "valid JS should pass, got: " + okRes);
});
