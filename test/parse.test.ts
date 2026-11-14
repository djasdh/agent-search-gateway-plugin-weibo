import { describe, expect, it } from "vitest";
import {
  addDays, isWeiboImageUrl, isWeiboUrl, parseWeiboRequest, todayInShanghai,
} from "../src/parse.js";
import { WeiboError } from "../src/types.js";
import { makeWeibo } from "./helpers.js";

const config = () => makeWeibo();

describe("parse", () => {
  it("主站帖子路径 → post", () => {
    const ref = parseWeiboRequest(new URL("https://weibo.com/1234567890/AbCdEf?weibo=post"), config());
    expect(ref).toMatchObject({ action: "post", uid: "1234567890", mblogid: "AbCdEf" });
  });

  it("detail/status 路径 → post + id", () => {
    expect(parseWeiboRequest(new URL("https://weibo.com/detail/AbCdEf?weibo=post"), config())).toMatchObject({
      action: "post",
      id: "AbCdEf",
    });
    expect(parseWeiboRequest(new URL("https://m.weibo.cn/status/5123456789?weibo=post"), config())).toMatchObject({
      action: "post",
      id: "5123456789",
    });
  });

  it("comments 带 limit，越界 clamp 到 50", () => {
    const ref = parseWeiboRequest(new URL("https://m.weibo.cn/detail/5123456789?weibo=comments&limit=999"), config());
    expect(ref).toMatchObject({ action: "comments", id: "5123456789", limit: 50 });
  });

  it("用户页支持 uid 与昵称", () => {
    expect(parseWeiboRequest(new URL("https://weibo.com/u/1234567890?weibo=user"), config())).toMatchObject({
      action: "user",
      uid: "1234567890",
    });
    expect(parseWeiboRequest(new URL("https://weibo.com/n/%E9%9B%B7%E5%86%9B?weibo=user"), config())).toMatchObject({
      action: "user",
      screenName: "雷军",
    });
  });

  it("user-posts 带日期与 limit", () => {
    const ref = parseWeiboRequest(
      new URL("https://weibo.com/1234567890?weibo=user-posts&limit=10&start=2026-01-01&end=2026-02-01"),
      config(),
    );
    expect(ref).toMatchObject({
      action: "user-posts",
      limit: 10,
      start: "2026-01-01",
      end: "2026-02-01",
    });
  });

  it("user-posts 默认最近 7 天", () => {
    const ref = parseWeiboRequest(new URL("https://weibo.com/u/1234567890?weibo=user-posts"), config());
    const today = todayInShanghai();
    expect(ref).toMatchObject({ start: addDays(today, -6), end: today, limit: 100 });
  });

  it("user-posts days=30 与只给 end", () => {
    const today = todayInShanghai();
    expect(parseWeiboRequest(new URL("https://weibo.com/u/1?weibo=user-posts&days=30"), config())).toMatchObject({
      start: addDays(today, -29),
      end: today,
      days: 30,
    });
    expect(
      parseWeiboRequest(new URL("https://weibo.com/u/1?weibo=user-posts&end=2026-02-10"), config()),
    ).toMatchObject({ start: "2026-02-04", end: "2026-02-10" });
  });

  it("user-posts days 与 start/end 互斥、跨度受限", () => {
    expect(() =>
      parseWeiboRequest(new URL("https://weibo.com/u/1?weibo=user-posts&days=7&start=2026-01-01"), config()),
    ).toThrow(/不能与 start\/end/);
    expect(() =>
      parseWeiboRequest(new URL("https://weibo.com/u/1?weibo=user-posts&days=0"), config()),
    ).toThrow(/days/);
    expect(() =>
      parseWeiboRequest(new URL("https://weibo.com/u/1?weibo=user-posts&start=2026-01-01&end=2026-06-01"), config()),
    ).toThrow(/跨度/);
  });

  it("user-posts max_items 被配置上限收敛", () => {
    const ref = parseWeiboRequest(new URL("https://weibo.com/u/1?weibo=user-posts&days=7&max_items=9999"), config());
    expect(ref.maxItems).toBe(500);
  });

  it("search/hot/image 本轮不支持", () => {
    expect(() => parseWeiboRequest(new URL("https://weibo.com/?weibo=search&q=x"), config())).toThrow(WeiboError);
    expect(() => parseWeiboRequest(new URL("https://weibo.com/?weibo=hot"), config())).toThrow(WeiboError);
    expect(() => parseWeiboRequest(new URL("https://weibo.com/?weibo=image"), config())).toThrow(WeiboError);
  });

  it("非法 start 报 WEIBO_INVALID", () => {
    expect(() =>
      parseWeiboRequest(new URL("https://weibo.com/1234567890?weibo=user-posts&start=2026/01/01"), config()),
    ).toThrow(/YYYY-MM-DD/);
  });
});

describe("image url", () => {
  it("sinaimg 图片路径命中", () => {
    expect(isWeiboImageUrl(new URL("https://wx1.sinaimg.cn/large/abc.jpg"))).toBe(true);
    expect(isWeiboImageUrl(new URL("https://tvax1.sinaimg.cn/crop.0.0.1080.1080.1024/abc.jpg"))).toBe(true);
  });

  it("同域非图片不命中", () => {
    expect(isWeiboImageUrl(new URL("https://wx1.sinaimg.cn/static/app.css"))).toBe(false);
    expect(isWeiboImageUrl(new URL("https://example.com/large/a.jpg"))).toBe(false);
  });

  it("isWeiboUrl 覆盖主站/m 站/t.cn", () => {
    expect(isWeiboUrl(new URL("https://weibo.com/1/AbC"))).toBe(true);
    expect(isWeiboUrl(new URL("https://m.weibo.cn/detail/1"))).toBe(true);
    expect(isWeiboUrl(new URL("https://t.cn/abc"))).toBe(true);
    expect(isWeiboUrl(new URL("https://example.com/1/AbC"))).toBe(false);
  });
});
