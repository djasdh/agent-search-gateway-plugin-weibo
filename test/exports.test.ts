import { describe, expect, it } from "vitest";
import { engine, fetch as plugin } from "../src/index.js";

describe("导出形状", () => {
  it("导出 fetch 插件对象", () => {
    expect(plugin).toBeTypeOf("object");
    expect(plugin.id).toBe("weibo");
    expect(plugin.platform).toBe("weibo");
    expect(typeof plugin.match).toBe("function");
    expect(typeof plugin.fetch).toBe("function");
    expect(typeof plugin.enabled).toBe("function");
    expect(plugin.capabilities).toContain("post");
  });

  it("导出 engine provider（gateway.search 文本源）", () => {
    expect(engine).toBeTypeOf("object");
    expect(engine.group).toBe("gateway.search");
    expect(engine.runtime?.kind).toBe("search");
    expect(engine.id).toBe("gateway.search:weibo");
    expect(engine.enabledPath).toEqual(["search", "weibo", "enabled"]);
  });
});

describe("match", () => {
  it("普通页面必须带 ?weibo=，图片 URL 自动命中", () => {
    expect(plugin.match(new URL("https://weibo.com/1/AbC?weibo=post"))).toBe(true);
    expect(plugin.match(new URL("https://weibo.com/1/AbC"))).toBe(false);
    expect(plugin.match(new URL("https://wx1.sinaimg.cn/large/a.jpg"))).toBe(true);
    expect(plugin.match(new URL("https://example.com/1/AbC?weibo=post"))).toBe(false);
  });
});
