import { describe, expect, it } from "vitest";
import {
  WEIBO_DEFAULTS,
  deepMerge,
  resolveEngineConfig,
  resolveWeiboConfig,
} from "../src/config.js";
import { makeWeibo } from "./helpers.js";

describe("deepMerge", () => {
  it("普通对象递归合并，数组与标量整体替换", () => {
    const merged = deepMerge(
      { a: { b: 1, c: 2 }, list: [1, 2, 3], keep: "x" },
      { a: { c: 9 }, list: [4] },
    );
    expect(merged).toEqual({ a: { b: 1, c: 9 }, list: [4], keep: "x" });
  });

  it("不修改入参", () => {
    const base = { a: { b: 1 } };
    deepMerge(base, { a: { b: 2 } });
    expect(base.a.b).toBe(1);
  });
});

describe("resolveWeiboConfig", () => {
  it("两份来源都为空时标记 empty，并回落到默认值", () => {
    const resolved = resolveWeiboConfig(undefined, undefined);
    expect(resolved.empty).toBe(true);
    expect(resolved.config.enabled).toBe(false);
    expect(resolved.config.cli).toEqual(WEIBO_DEFAULTS.cli);
  });

  it("只有 pluginConfig 时使用它", () => {
    const resolved = resolveWeiboConfig(undefined, {
      enabled: true,
      cli: { command: "/tmp/opencli" },
    });
    expect(resolved.empty).toBe(false);
    expect(resolved.config.enabled).toBe(true);
    expect(resolved.config.cli.command).toBe("/tmp/opencli");
    expect(resolved.config.cli.timeout_ms).toBe(30000);
    expect(resolved.config.images.enabled).toBe(true);
  });

  it("局部 pluginConfig 与完整 legacy 深合并后 cli/images 仍在", () => {
    const legacy = makeWeibo({ cli: { command: "/legacy/opencli", timeout_ms: 5000 } });
    const resolved = resolveWeiboConfig(legacy, { enabled: true });
    expect(resolved.config.enabled).toBe(true);
    expect(resolved.config.cli).toEqual({ command: "/legacy/opencli", timeout_ms: 5000 });
    expect(resolved.config.images).toEqual(legacy.images);
    expect(resolved.config.user_posts).toEqual(legacy.user_posts);
  });

  it("pluginConfig 优先于 legacy", () => {
    const legacy = makeWeibo({ cli: { command: "/legacy/opencli", timeout_ms: 5000 } });
    const resolved = resolveWeiboConfig(legacy, { cli: { command: "/v2/opencli" } });
    expect(resolved.config.cli).toEqual({ command: "/v2/opencli", timeout_ms: 5000 });
  });
});

describe("resolveEngineConfig", () => {
  it("V1 把 config.weibo 与 config.search.weibo 拼成一份配置", () => {
    const config = resolveEngineConfig({
      config: {
        weibo: { enabled: true, cli: { command: "/legacy/opencli" } },
        search: { weibo: { enabled: true, category: "weibo", hot_category: "hot" } },
      },
    });
    expect(config.enabled).toBe(true);
    expect(config.cli).toEqual({ command: "/legacy/opencli", timeout_ms: 30000 });
    expect(config.search).toMatchObject({
      enabled: true,
      category: "weibo",
      hot_category: "hot",
      timeout_ms: 30000,
    });
  });

  it("V2 pluginConfig 覆盖 V1 配置，并保留未覆盖字段", () => {
    const config = resolveEngineConfig({
      config: {
        weibo: { enabled: true, cli: { command: "/legacy/opencli" } },
        search: { weibo: { enabled: false } },
      },
      pluginConfig: { search: { enabled: true } },
    });
    expect(config.enabled).toBe(true);
    expect(config.cli).toMatchObject({ command: "/legacy/opencli" });
    expect(config.search).toMatchObject({ enabled: true, category: "weibo", hot_category: "weibo_hot" });
  });

  it("完全缺省时回落到默认值", () => {
    const config = resolveEngineConfig({ config: {} });
    expect(config.enabled).toBe(false);
    expect(config.cli).toMatchObject({ command: "opencli" });
    expect(config.search).toMatchObject({ enabled: false, category: "weibo", hot_category: "weibo_hot" });
  });
});
