/** 微博引擎 provider：网关侧文本源（帖子搜索 + 热搜），不经过 searxng。 */

import type { EngineProvider, EngineProviderContext } from "./sdk/engine.js";
import { asObject, nonEmptyString, numberOr } from "./sdk/values.js";
import { hasCategory } from "./sdk/category.js";
import { resolveEngineConfig } from "./config.js";
import { searchWeibo, searchWeiboHot } from "./search.js";

const DEFAULT_COMMAND = "opencli";

/** V1 读 `config.weibo` / `config.search.weibo`，V2 读 `pluginConfig`；统一成一份合并配置。 */
function configOf(ctx: EngineProviderContext): Record<string, unknown> {
  return resolveEngineConfig(ctx);
}

function commandOf(config: Record<string, unknown>): string {
  const raw = asObject(config.cli).command;
  // 只有「缺省」才回落到 opencli；显式空串表示未配置可用命令。
  if (raw === undefined) return DEFAULT_COMMAND;
  return typeof raw === "string" ? raw.trim() : "";
}

function searchWeiboConfig(config: Record<string, unknown>): Record<string, unknown> {
  return asObject(config.search);
}

function categoriesOf(config: Record<string, unknown>): { category: string; hotCategory: string } {
  const weibo = searchWeiboConfig(config);
  return {
    category: nonEmptyString(weibo.category) ?? "weibo",
    hotCategory: nonEmptyString(weibo.hot_category) ?? "weibo_hot",
  };
}

export const weiboProvider: EngineProvider = {
  id: "gateway.search:weibo",
  group: "gateway.search",
  name: "weibo",
  kind: "gateway",
  displayName: "微博",
  authHint: "在 Chrome 登录 weibo.com 后重试。",
  // V1 元数据给 0.3.x 宿主（顶层 `weibo` / `search.weibo`）。
  requires: ["config:weibo.enabled"],
  enabledPath: ["search", "weibo", "enabled"],
  // V2：0.4.0+ 已删除 gateway.yaml 的 search.weibo，开关在 extensions.weibo.config。
  requiresV2: ["config:extensions.weibo.config.search.enabled"],
  enabledPathV2: ["extensions", "weibo", "config", "search", "enabled"],
  routing: (ctx) => {
    const { category, hotCategory } = categoriesOf(configOf(ctx));
    return [`category:${category}`, `category:${hotCategory}`];
  },
  available: (ctx) => {
    const config = configOf(ctx);
    if (config.enabled !== true) return false;
    return commandOf(config).length > 0;
  },
  enabled: (ctx) => searchWeiboConfig(configOf(ctx)).enabled === true,
  runtime: {
    kind: "search",
    plan(categories, ctx) {
      const config = configOf(ctx);
      const { category, hotCategory } = categoriesOf(config);
      const hot = hasCategory(categories, hotCategory);
      const only = !hot && hasCategory(categories, category);
      return hot || only ? { hot } : undefined;
    },
    search(query, options, ctx) {
      const config = configOf(ctx);
      const search = searchWeiboConfig(config);
      const opts = {
        limit: options.limit,
        timeoutMs: numberOr(search.timeout_ms, 30_000),
        retry: numberOr(search.retry, 1),
        cacheTtlMs: numberOr(search.cache_ttl_ms, 60_000),
      };
      const command = commandOf(config);
      return options.hot ? searchWeiboHot(opts, command) : searchWeibo(query, opts, command);
    },
  },
};
