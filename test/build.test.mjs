import test from "node:test";
import assert from "node:assert/strict";

/** 构建产物冒烟测试：确认 index.mjs 可加载且 fetch / engine 都存在。 */
test("bundle 可加载并导出 fetch 与 engine", async () => {
  const mod = await import("../index.mjs");
  assert.equal(typeof mod.fetch, "object");
  assert.equal(mod.fetch.id, "weibo");
  assert.equal(typeof mod.fetch.match, "function");
  assert.equal(typeof mod.fetch.fetch, "function");
  assert.equal(mod.fetch.match(new URL("https://weibo.com/1/AbC?weibo=post")), true);
  assert.equal(mod.fetch.match(new URL("https://weibo.com/1/AbC")), false);

  assert.equal(typeof mod.engine, "object");
  assert.equal(mod.engine.group, "gateway.search");
  assert.equal(mod.engine.runtime.kind, "search");
});
