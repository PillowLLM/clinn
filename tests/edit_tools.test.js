const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { edit_lines, read_lines, search_in_range } = require("../Tools/edit_tools.js");

let dir, f;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "clinn-edit-"));
  f = path.join(dir, "sample.txt");
});
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });

async function writeBase() {
  fs.writeFileSync(f, ["one", "two", "three", "four"].join("\n"), "utf-8");
}

test("edit: insert_before inserts at correct 1-based line", async () => {
  await writeBase();
  const r = await edit_lines.execute({ filePath: f, operation: "insert_before", lineNumber: 2, content: "NEW" });
  assert.ok(r.startsWith("[OK]"));
  assert.deepEqual(fs.readFileSync(f, "utf-8").split("\n"), ["one", "NEW", "two", "three", "four"]);
});

test("edit: insert_after and replace and delete", async () => {
  await writeBase();
  await edit_lines.execute({ filePath: f, operation: "insert_after", lineNumber: 1, content: "AFTER1" });
  assert.deepEqual(fs.readFileSync(f, "utf-8").split("\n"), ["one", "AFTER1", "two", "three", "four"]);

  await edit_lines.execute({ filePath: f, operation: "replace", lineNumber: 2, content: "REPLACED" });
  assert.deepEqual(fs.readFileSync(f, "utf-8").split("\n"), ["one", "REPLACED", "two", "three", "four"]);

  await edit_lines.execute({ filePath: f, operation: "delete", lineNumber: 2, count: 1 });
  assert.deepEqual(fs.readFileSync(f, "utf-8").split("\n"), ["one", "two", "three", "four"]);
});

test("edit: out-of-bounds line number rejected", async () => {
  await writeBase();
  const r1 = await edit_lines.execute({ filePath: f, operation: "replace", lineNumber: 99, content: "x" });
  assert.ok(r1.startsWith("[越界]"));
  const r0 = await edit_lines.execute({ filePath: f, operation: "replace", lineNumber: 0, content: "x" });
  assert.ok(r0.startsWith("[越界]"));
});

test("edit: unknown operation rejected", async () => {
  await writeBase();
  const r = await edit_lines.execute({ filePath: f, operation: "teleport", lineNumber: 1 });
  assert.ok(r.startsWith("[错误] 未知操作"));
});

test("edit: nonexistent file returns marker", async () => {
  const r = await edit_lines.execute({ filePath: path.join(dir, "nope.txt"), operation: "replace", lineNumber: 1 });
  assert.ok(r.startsWith("[不存在]"));
});

test("read_lines: numbered range and beyond-end rejection", async () => {
  await writeBase();
  const out = await read_lines.execute({ filePath: f, startLine: 2, endLine: 3 });
  assert.ok(out.includes("2| two"));
  assert.ok(out.includes("3| three"));
  const oob = await read_lines.execute({ filePath: f, startLine: 99 });
  assert.ok(oob.startsWith("[越界]"));
});

test("search_in_range: case-insensitive match with column, truncation, no-match", async () => {
  fs.writeFileSync(f, ["apple", "Banana", "apple pie", "APPLE core"].join("\n"), "utf-8");
  const out = await search_in_range.execute({ filePath: f, pattern: "apple" });
  assert.ok(out.startsWith("[3 处匹配") || out.includes("处匹配"));
  assert.ok(out.includes("1:1| apple"));

  // maxResults truncation
  const limited = await search_in_range.execute({ filePath: f, pattern: "apple", maxResults: 1 });
  assert.ok(limited.split("\n").length <= 2);

  // explicit case-sensitive
  const cs = await search_in_range.execute({ filePath: f, pattern: "apple", ignoreCase: false });
  assert.ok(cs.includes("1:1| apple") && !cs.includes("Banana"));

  const none = await search_in_range.execute({ filePath: f, pattern: "zzz_no_match" });
  assert.ok(none.startsWith("[无匹配]"));
});
