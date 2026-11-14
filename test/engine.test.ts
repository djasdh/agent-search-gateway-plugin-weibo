import { describe, expect, it } from "vitest";
import { engine } from "../src/index.js";
import { makeEngineContext } from "./helpers.js";

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
