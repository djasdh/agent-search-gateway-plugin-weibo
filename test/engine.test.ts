import { describe, expect, it } from "vitest";
import { engine } from "../src/index.js";
import {
  FAKE_SEARCH_CLI,
  makeEngineConfig,
  makeEngineContext,
  makeV2EngineContext,
  writeCli,
} from "./helpers.js";

const runtime = engine.runtime;

if (!runtime || runtime.kind !== "search") throw new Error("weibo engine 必须是 search 运行时");

describe("engine 元数据", () => {
  it("routing 声明 weibo / weibo_hot 两个类别", () => {
    expect(engine.routing(makeEngineContext())).toEqual(["category:weibo", "category:weibo_hot"]);
  });

  it("requires 声明配置路径", () => {
    expect(engine.requires).toContain("config:weibo.enabled");
  });

  it("available 取决于 weibo.enabled 与 CLI 命令", () => {
    expect(engine.available(makeEngineContext())).toBe(true);
    expect(engine.available(makeEngineContext({ weiboEnabled: false }))).toBe(false);
    expect(engine.available(makeEngineContext({ command: "" }))).toBe(false);
  });

  it("enabled 只看 search.weibo.enabled", () => {
    expect(engine.enabled?.(makeEngineContext())).toBe(true);
    expect(engine.enabled?.(makeEngineContext({ searchWeiboEnabled: false }))).toBe(false);
  });
});

describe("runtime.plan", () => {
  it("weibo → 普通搜索；weibo_hot → 热搜", () => {
    const ctx = makeEngineContext();
    expect(runtime.plan("weibo", ctx)).toEqual({ hot: false });
    expect(runtime.plan("weibo_hot", ctx)).toEqual({ hot: true });
    expect(runtime.plan("weibo,weibo_hot", ctx)).toEqual({ hot: true });
  });

  it("类别不命中返回 undefined", () => {
    expect(runtime.plan("it", makeEngineContext())).toBeUndefined();
    expect(runtime.plan(undefined, makeEngineContext())).toBeUndefined();
  });
});

describe("V1 ctx.config", () => {
  it("只有旧 ctx.config 时 search 行为不变", async () => {
    const cli = writeCli(FAKE_SEARCH_CLI);
    const ctx = makeEngineContext({ command: cli });
    const result = await runtime.search("洛天依", { hot: false, limit: 2 }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0]?.engine).toBe("weibo");
    expect(result.results).toHaveLength(2);
  });
});

describe("V2 pluginConfig", () => {
  it("只有 pluginConfig 时 enabled/available/routing/plan/search 正常", async () => {
    const cli = writeCli(FAKE_SEARCH_CLI);
    const ctx = makeV2EngineContext(makeEngineConfig(cli));

    expect(engine.available(ctx)).toBe(true);
    expect(engine.enabled?.(ctx)).toBe(true);
    expect(engine.routing(ctx)).toEqual(["category:weibo", "category:weibo_hot"]);
    expect(runtime.plan("weibo", ctx)).toEqual({ hot: false });
    expect(runtime.plan("weibo_hot", ctx)).toEqual({ hot: true });

    const result = await runtime.search("洛天依", { hot: false, limit: 2 }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0]?.url).toBe("https://weibo.com/5146173015/R1");
  });

  it("pluginConfig 的 enabled / search.enabled / cli.command 控制开关", () => {
    const cli = writeCli(FAKE_SEARCH_CLI);
    expect(engine.available(makeV2EngineContext(makeEngineConfig(cli, { enabled: false })))).toBe(false);
    expect(engine.enabled?.(makeV2EngineContext(makeEngineConfig(cli, { searchEnabled: false })))).toBe(false);
    expect(
      engine.available(makeV2EngineContext({ ...makeEngineConfig(cli), cli: { command: "" } })),
    ).toBe(false);
  });

  it("局部 pluginConfig 与旧 config 深合并：pluginConfig 优先", async () => {
    const cli = writeCli(FAKE_SEARCH_CLI);
    const ctx = makeEngineContext({
      command: "/nonexistent-opencli",
      searchWeiboEnabled: false,
      pluginConfig: { cli: { command: cli }, search: { enabled: true } },
    });

    // cli.command 来自 pluginConfig；enabled 来自 legacy config.weibo。
    expect(engine.available(ctx)).toBe(true);
    expect(engine.enabled?.(ctx)).toBe(true);

    const result = await runtime.search("洛天依", { hot: false, limit: 1 }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results).toHaveLength(1);
  });
});
