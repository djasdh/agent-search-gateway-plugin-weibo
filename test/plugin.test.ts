import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fetch as plugin } from "../src/index.js";
import type { FetchPluginContext } from "../src/sdk/fetch-plugin.js";
import { makeContext, makePluginContext, makeWeiboConfig, tmpDir, writeCli } from "./helpers.js";

afterEach(() => {
  delete process.env.FAKE_LOG;
});

describe("enabled", () => {
  it("配置关闭时由 enabled 统一过滤，保证回退 generic", () => {
    const ctx = makeContext(writeCli(), { enabled: false });
    expect(plugin.enabled?.(ctx)).toBe(false);
  });

  it("未启用 → WEIBO_UNAVAILABLE", async () => {
    const result = await plugin.fetch(new URL("https://weibo.com/1/AbC?weibo=post"), makeContext(writeCli(), { enabled: false }));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("WEIBO_UNAVAILABLE");
  });
});

describe("plugin fetch", () => {
  it("post 渲染 Markdown 并列出全部图片外链", async () => {
    const config = makeContext(writeCli());
    const result = await plugin.fetch(new URL("https://weibo.com/1/AbCdEf?weibo=post"), config);
    expect(result.ok).toBe(true);
    expect(result.contentType).toBe("text/markdown");
    const text = result.bytes?.toString("utf8") ?? "";
    expect(text).toContain("测试作者");
    expect(text).toContain("正文内容");
    expect(text).toContain("转发正文");
    expect(text).toContain("![](https://wx1.sinaimg.cn/large/a.jpg)");
    expect(text).toContain("![](https://wx2.sinaimg.cn/large/b.jpg)");
    expect(text).toContain("转发：3");
  });

  it("comments 的 mblogid 先 post 换 numeric id", async () => {
    const config = makeContext(writeCli());
    const log = join(tmpDir(), "calls.log");
    process.env.FAKE_LOG = log;
    const result = await plugin.fetch(new URL("https://weibo.com/1/AbCdEf?weibo=comments"), config);
    expect(result.ok).toBe(true);
    expect(result.contentType).toBe("application/json");
    expect(result.bytes?.toString("utf8")).toContain("评论1");
    expect(readFileSync(log, "utf8")).toBe("post AbCdEf\ncomments 5123456789\n");
  });

  it("user / user-posts 返回 JSON / Markdown", async () => {
    const config = makeContext(writeCli());
    const user = await plugin.fetch(new URL("https://weibo.com/u/1?weibo=user"), config);
    expect(user.bytes?.toString("utf8")).toContain("测试作者");
    const posts = await plugin.fetch(new URL("https://weibo.com/u/1?weibo=user-posts"), config);
    expect(posts.ok).toBe(true);
    expect(posts.contentType).toBe("text/markdown");
    expect(posts.bytes?.toString("utf8")).toContain("用户微博");
  });

  it("退出码 77 → WEIBO_AUTH_REQUIRED", async () => {
    const result = await plugin.fetch(new URL("https://weibo.com/detail/fail77?weibo=post"), makeContext(writeCli()));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("WEIBO_AUTH_REQUIRED");
  });

  it("缓存命中后不再调用 CLI", async () => {
    const config = makeContext(writeCli(), { cache_ttl_ms: 60000 });
    const log = join(tmpDir(), "calls.log");
    process.env.FAKE_LOG = log;
    const url = new URL("https://weibo.com/1/Cached?weibo=post");
    await plugin.fetch(url, config);
    await plugin.fetch(url, config);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(1);
  });
});

describe("V2 pluginConfig", () => {
  it("只有 pluginConfig、没有 settings.weibo 时 enabled/available/fetch 正常", async () => {
    const cli = writeCli();
    const ctx = makePluginContext(makeWeiboConfig(cli));
    expect(plugin.enabled?.(ctx)).toBe(true);
    expect(plugin.available?.(ctx)).toBe(true);

    const result = await plugin.fetch(new URL("https://weibo.com/1/V2Only?weibo=post"), ctx);
    expect(result.ok).toBe(true);
    expect(result.contentType).toBe("text/markdown");
    expect(result.bytes?.toString("utf8")).toContain("正文内容");
  });

  it("只有旧 settings.weibo 时行为不变", async () => {
    const ctx = makeContext(writeCli());
    expect(plugin.enabled?.(ctx)).toBe(true);
    expect(plugin.available?.(ctx)).toBe(true);
    expect(plugin.enabled?.(makeContext(writeCli(), { enabled: false }))).toBe(false);

    const result = await plugin.fetch(new URL("https://weibo.com/1/LegacyOnly?weibo=post"), ctx);
    expect(result.ok).toBe(true);
  });

  it("局部 pluginConfig 与完整 legacy settings 深合并：cli/images 仍在", async () => {
    const cli = writeCli();
    const ctx = makeContext(cli, {}, { enabled: true });
    // cli 完全来自 legacy settings；pluginConfig 只覆盖 enabled。
    expect(plugin.enabled?.(ctx)).toBe(true);
    expect(plugin.available?.(ctx)).toBe(true);

    const result = await plugin.fetch(new URL("https://weibo.com/1/Merged?weibo=post"), ctx);
    expect(result.ok).toBe(true);
    expect(result.bytes?.toString("utf8")).toContain("正文内容");
  });

  it("pluginConfig 优先于 legacy settings", async () => {
    const cli = writeCli();
    const ctx = makeContext("/nonexistent-opencli", {}, { enabled: true, cli: { command: cli } });
    expect(plugin.available?.(ctx)).toBe(true);

    const result = await plugin.fetch(new URL("https://weibo.com/1/Override?weibo=post"), ctx);
    expect(result.ok).toBe(true);
  });

  it("两份配置都为空时返回明确错误，不抛异常", async () => {
    const ctx: FetchPluginContext = {
      settings: { fetch: { timeout_ms: 15000, max_bytes: 1024 * 1024, user_agent: "" } },
      secrets: { bilibili: { http: { token: "" } } },
      getSecret: () => undefined,
    };
    expect(plugin.enabled?.(ctx)).toBe(false);
    expect(plugin.available?.(ctx)).toBe(false);

    const result = await plugin.fetch(new URL("https://weibo.com/1/Empty?weibo=post"), ctx);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("WEIBO_UNAVAILABLE");
    expect(result.errorMessage).toContain("未配置");
  });
});
