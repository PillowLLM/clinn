const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const reg = require("../Tools/index.js");

// Probe names used for register/unregister hooks (in-memory only, not persisted).
const PROBE = "__test_probe__";
const DANGER = "__test_danger__";

afterEach(() => {
  try { reg.unregisterTool(PROBE); } catch (_) {}
  try { reg.unregisterTool(DANGER); } catch (_) {}
  reg.setPermissionCallback(null);
  reg.setTrusted([]);
});

// ---------- hook / plugin registration & dispatch ----------

test("registry: built-in tools are present and look-up by name works", () => {
  assert.ok(reg.getTool("read_file"), "read_file should be registered");
  equal(typeof reg.getTool("read_file").execute, "function");
  assert.equal(reg.getTool("__definitely_not_a_tool__"), null);
});

function equal(a, b) { assert.equal(a, b); }

test("hook: register -> dispatch passes args through -> unregister removes", async () => {
  let received = null;
  reg.registerTool(PROBE, {
    name: PROBE,
    description: "test probe",
    parameters: { input: { type: "string" } },
    dangerous: false,
    execute: async (args) => { received = args; return "PROBE_OK"; },
  });
  assert.ok(reg.getTool(PROBE), "registered tool visible");
  const out = await reg.executeTool(PROBE, { input: "hi" });
  assert.equal(out, "PROBE_OK");
  assert.deepEqual(received, { input: "hi" });

  reg.unregisterTool(PROBE);
  assert.equal(reg.getTool(PROBE), null);
});

test("hook: unregistered tool dispatch is rejected", async () => {
  await assert.rejects(() => reg.executeTool("__nope_unregistered__", {}), /unknown tool/);
});

test("hook: failure isolation — one throwing tool does not break the registry", async () => {
  reg.registerTool(PROBE, {
    name: PROBE,
    description: "throws",
    parameters: {},
    dangerous: false,
    execute: async () => { throw new Error("boom"); },
  });
  await assert.rejects(() => reg.executeTool(PROBE, {}), /boom/);
  // registry still healthy: built-in still resolvable
  assert.ok(reg.getTool("read_file"));
});

test("hook: dangerous tool blocked by default, allowed by permission callback, bypassed when trusted", async () => {
  reg.registerTool(DANGER, {
    name: DANGER,
    description: "dangerous probe",
    parameters: {},
    dangerous: true,
    execute: async () => "DID_RUN",
  });

  // (1) not trusted, no callback -> denied
  await assert.rejects(() => reg.executeTool(DANGER, {}), /permission denied/);

  // (2) permission callback approves -> runs; callback receives (name, args)
  let cbArgs = null;
  reg.setPermissionCallback((name, args) => { cbArgs = { name, args }; return true; });
  const out = await reg.executeTool(DANGER, { a: 1 });
  assert.equal(out, "DID_RUN");
  assert.equal(cbArgs.name, DANGER);
  assert.deepEqual(cbArgs.args, { a: 1 });

  // (3) callback denies -> isolated rejection, tool still registered
  reg.setPermissionCallback(() => false);
  await assert.rejects(() => reg.executeTool(DANGER, {}), /permission denied/);
});

test("hook: trusted names bypass permission callback", async () => {
  reg.registerTool(DANGER, {
    name: DANGER, description: "dangerous", parameters: {}, dangerous: true,
    execute: async () => "RAN",
  });
  reg.addTrusted(DANGER);
  const out = await reg.executeTool(DANGER, {});
  assert.equal(out, "RAN");
  reg.removeTrusted(DANGER);
});

test("hook: checkPermission default is false for unknown name", async () => {
  assert.equal(await reg.checkPermission("whatever", {}), false);
});

test("hook: searchToolRegistry matches by name and description", () => {
  const res = reg.searchToolRegistry("file");
  assert.ok(res.length > 0);
  assert.ok(res.some((r) => r.name === "read_file"));
});

test("hook: toFunctionDeclarations emits valid OpenAI-style function schemas", () => {
  const decls = reg.toFunctionDeclarations();
  assert.ok(Array.isArray(decls) && decls.length > 0);
  const read = decls.find((d) => d.function.name === "read_file");
  assert.ok(read);
  assert.equal(read.type, "function");
  assert.ok(read.function.parameters.required.includes("filePath"));
});

test("hook: filterToolDeclarations returns all on empty prompt or 'show all'", () => {
  const all = reg.showAllToolDeclarations();
  assert.equal(reg.filterToolDeclarations("").length, all.length);
  assert.equal(reg.filterToolDeclarations("show all tools").length, all.length);
});

// ---------- INJECTION: persisted tool name validation / path containment ----------

test("injection: tool names with path traversal or shell metachars are rejected before writeback", () => {
  const evil = ["../evil", "a;rm -rf /", "foo bar", "a/b", ".\\..\\win", "name$()"];
  for (const n of evil) {
    const res = reg.saveToolToFile(n, "module.exports={};");
    assert.ok(typeof res === "string" && res.startsWith("[失败] 工具名不合法"),
      `expected rejection for ${n}, got: ${res}`);
  }
});

test("injection: empty / oversized persisted code rejected", () => {
  assert.ok(reg.saveToolToFile("__ok_name__", "   ").startsWith("[失败] 代码不能为空"));
  const huge = "x".repeat(50001);
  assert.ok(reg.saveToolToFile("__ok_name__", huge).startsWith("[失败] 代码过长"));
});
