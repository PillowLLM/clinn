const { test } = require("node:test");
const assert = require("node:assert/strict");
const { use_template } = require("../Tools/template_engine.js");

test("template: list returns known templates grouped", async () => {
  const out = await use_template.execute({ action: "list" });
  assert.ok(out.includes("可用模版"));
  assert.ok(out.includes("express-api"), "express-api template should be listed");
});

test("template: generate express-api with params embeds port and routes", async () => {
  const out = await use_template.execute({
    action: "generate", name: "express-api",
    params: '{"name":"myApp","port":8080,"routes":"users,posts"}',
  });
  assert.ok(out.includes("[模版: express-api]"));
  assert.ok(out.includes("8080"), "port should be embedded");
  assert.ok(out.includes("/api/users"), "routes should be embedded");
});

test("template: unknown name returns available list", async () => {
  const out = await use_template.execute({ action: "generate", name: "does-not-exist" });
  assert.ok(out.startsWith("[不存在] 模版"));
  assert.ok(out.includes("express-api"));
});

// INJECTION: malformed payload (bad JSON) rejected, not parsed leniently.
test("injection: malformed params JSON is rejected", async () => {
  const out = await use_template.execute({ action: "generate", name: "express-api", params: "{not json!!" });
  assert.ok(out.startsWith("[失败] params 不是合法 JSON"));
});

// INJECTION: template name with path traversal must NOT resolve to a file on disk —
// names are in-memory keys, so ../ stays a literal key and is denied.
test("injection: path-traversal template name is treated as opaque key, not a file path", async () => {
  const out = await use_template.execute({ action: "generate", name: "../../../../etc/passwd" });
  assert.ok(out.startsWith("[不存在] 模版"), "traversal name must not escape templates dir, got: " + out);
});

test("template: generate without name / unknown action are handled", async () => {
  const noName = await use_template.execute({ action: "generate" });
  assert.ok(noName.includes("请指定模版名"));
  const badAction = await use_template.execute({ action: "teleport" });
  assert.ok(badAction.startsWith("[错误] 未知 action"));
});
