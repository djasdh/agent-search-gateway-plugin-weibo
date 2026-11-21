import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (name) =>
  JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));

/** V2 manifest 冒烟：字段、版本与 search_engines 前缀。 */
test("asg-extension.json 是有效的 V2 manifest", () => {
  const manifest = readJson("asg-extension.json");
  const pkg = readJson("package.json");

  assert.equal(manifest.id, "weibo");
  assert.equal(manifest.api_version, 2);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.version, "0.2.2");
  assert.equal(manifest.entry, "index.mjs");
  assert.ok(manifest.provides.includes("fetch"));
  assert.ok(manifest.provides.includes("search"));

  assert.ok(Array.isArray(manifest.fetch_channels));
  assert.ok(manifest.fetch_channels.length > 0);
  for (const channel of manifest.fetch_channels) {
    assert.match(channel.id, /^weibo:/);
  }

  assert.ok(Array.isArray(manifest.search_engines));
  assert.ok(manifest.search_engines.some((engine) => engine.id === "gateway.search:weibo"));

  // 依赖用户自装的 opencli，不声明 backends（因而也不需要 setup）。
  assert.equal(manifest.backends, undefined);
  assert.equal(typeof manifest.config_schema, "object");
  assert.equal(manifest.config_schema.type, "object");
});

/** V1 manifest 过渡保留：0.3.8 及更早只认 asg-plugin.json。 */
test("asg-plugin.json 保留 V1 且版本一致", () => {
  const legacy = readJson("asg-plugin.json");
  assert.equal(legacy.id, "weibo");
  assert.equal(legacy.api_version, 1);
  assert.equal(legacy.version, readJson("package.json").version);
  assert.equal(legacy.version, "0.2.2");
});

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
  assert.equal(mod.engine.id, "gateway.search:weibo");
  assert.equal(mod.engine.group, "gateway.search");
  assert.equal(mod.engine.runtime.kind, "search");

  // V2 宿主只注入 pluginConfig。
  const ctx = {
    settings: { fetch: { timeout_ms: 15000, max_bytes: 1024, user_agent: "" } },
    pluginConfig: { enabled: true, cli: { command: "opencli" } },
  };
  assert.equal(mod.fetch.enabled(ctx), true);
  assert.equal(mod.fetch.available(ctx), true);
});
