import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  mapWeiboHotRows, mapWeiboSearchRows, searchWeibo, stripWeiboRefer,
} from "../src/search.js";
import { FAKE_SEARCH_CLI, tmpDir, writeCli } from "./helpers.js";

afterEach(() => {
  delete process.env.FAKE_LOG;
  delete process.env.FAKE_MODE;
  delete process.env.FAKE_COUNTER;
});

describe("映射", () => {
  it("帖子：去 refer、标题带作者、engine=weibo", () => {
    const results = mapWeiboSearchRows(
      [
        {
          rank: 1,
          title: "洛天依演唱会",
          author: "Vsinger_洛天依",
          time: "今天 12:00",
          url: "https://weibo.com/5146173015/R1?refer_flag=1001030103_",
        },
      ],
      10,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      url: "https://weibo.com/5146173015/R1",
      title: "@Vsinger_洛天依：洛天依演唱会",
      engine: "weibo",
    });
    expect(results[0]?.content).toContain("作者：Vsinger_洛天依");
  });

  it("热搜：标题含排名/热度，engine=weibo_hot", () => {
    const results = mapWeiboHotRows(
      [{ rank: 2, word: "测试话题", hot_value: 123456, category: "文娱", label: "热", url: "https://s.weibo.com/weibo?q=x" }],
      10,
    );
    expect(results[0]).toMatchObject({
      title: "#2 测试话题（热度 123456）",
      content: "文娱｜热",
      engine: "weibo_hot",
    });
  });

  it("stripWeiboRefer 只删跟踪参数", () => {
    expect(stripWeiboRefer("https://weibo.com/1/R1?refer_flag=x&a=1")).toBe("https://weibo.com/1/R1?a=1");
    expect(stripWeiboRefer("not a url")).toBe("not a url");
  });
});

describe("搜索源", () => {
  it("空结果重试一次后成功", async () => {
    const cli = writeCli(FAKE_SEARCH_CLI);
    const counter = join(tmpDir(), "counter");
    process.env.FAKE_MODE = "retry";
    process.env.FAKE_COUNTER = counter;
    const result = await searchWeibo("洛天依", { limit: 5, timeoutMs: 5000, retry: 1, cacheTtlMs: 0 }, cli);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.results).toHaveLength(2);
    expect(readFileSync(counter, "utf8")).toBe("2");
  });

  it("缓存命中后不再调用 CLI", async () => {
    const cli = writeCli(FAKE_SEARCH_CLI);
    const log = join(tmpDir(), "calls.log");
    process.env.FAKE_LOG = log;
    const opts = { limit: 5, timeoutMs: 5000, retry: 0, cacheTtlMs: 60000 };
    await searchWeibo("缓存测试", opts, cli);
    await searchWeibo("缓存测试", opts, cli);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(1);
  });
});
