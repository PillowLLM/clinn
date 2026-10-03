const { test } = require("node:test");
const assert = require("node:assert/strict");
const tokenizer = require("../Tools/tokenizer.js");

test("segment: empty / falsy input returns empty array", () => {
  assert.deepEqual(tokenizer.segment(""), []);
  assert.deepEqual(tokenizer.segment(undefined), []);
  assert.deepEqual(tokenizer.segment(null), []);
});

test("segment: English text splits on whitespace and punctuation", () => {
  assert.deepEqual(tokenizer.segment("hello world foo"), ["hello", "world", "foo"]);
  assert.deepEqual(tokenizer.segment("a,b.c!"), ["a", "b", "c"]);
  assert.deepEqual(tokenizer.segment("one-two/three"), ["one", "two", "three"]);
});

test("segment: pure Chinese consumes every character (no dropped chars)", () => {
  const out = tokenizer.segment("你好世界");
  assert.ok(Array.isArray(out));
  assert.equal(out.join(""), "你好世界");
  assert.ok(out.length >= 1);
});

test("segment: mixed Chinese + English boundary", () => {
  const out = tokenizer.segment("hello世界");
  // English run tokenizes to words; Chinese run tokenizes to chars
  assert.ok(out.includes("hello"));
  assert.equal(out.filter((t) => /[\u4e00-\u9fa5]/.test(t)).join(""), "世界");
});

test("buildDictFromKeywords: known keyword becomes a merged word", () => {
  tokenizer.buildDictFromKeywords([["你好"]]);
  const out = tokenizer.segment("你好世界");
  assert.equal(out[0], "你好");
  assert.equal(out.join(""), "你好世界");
});

test("segment: single ASCII char", () => {
  assert.deepEqual(tokenizer.segment("x"), ["x"]);
});

test("segment: very long English string does not throw", () => {
  const long = Array.from({ length: 200 }, (_, i) => "word" + (i % 5)).join(" ");
  const out = tokenizer.segment(long);
  assert.ok(out.length > 50);
});
