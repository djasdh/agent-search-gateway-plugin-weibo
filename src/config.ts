/**
 * 运行期配置合并：V1 的 `ctx.settings.weibo` / `ctx.config` 与 V2 的 `ctx.pluginConfig`
 * 统一成一份普通对象，供取件与搜索共用。
 *
 * 规则：
 * - 两份来源都可能只给局部字段，必须按普通对象递归深合并；
 * - 数组与标量整体替换，`pluginConfig` 优先；
 * - 缺省字段回落到与旧 `weiboSchema` / `searchWeiboSchema` 一致的默认值。
 */

import type {
  SearchWeiboSettings,
  WeiboSettings,
} from "./sdk/settings.js";

/** 旧 `weiboSchema` 的默认值（与 `asg-extension.json` 的 config_schema 保持一致）。 */
export const WEIBO_DEFAULTS: WeiboSettings = {
  enabled: false,
  cli: { command: "opencli", timeout_ms: 30000 },
  defaults: { comments_limit: 20, user_posts_limit: 100 },
  user_posts: {
    default_days: 7,
    max_days: 90,
    max_items: 500,
    max_calls: 30,
    budget_ms: 120000,
    max_chars: 500,
  },
  images: {
    enabled: true,
    referer: "https://weibo.com/",
    max_bytes: 20971520,
    timeout_ms: 20000,
    retry_tvax: true,
  },
  cache_ttl_ms: 60000,
};

/** 旧 `searchWeiboSchema` 的默认值。 */
export const SEARCH_WEIBO_DEFAULTS: SearchWeiboSettings = {
  enabled: false,
  category: "weibo",
  hot_category: "weibo_hot",
  limit: 10,
  timeout_ms: 30000,
  cache_ttl_ms: 60000,
  retry: 1,
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 深合并普通对象；数组与标量整体替换，`override` 优先。
 * 不修改入参，返回新对象。
 */
export function deepMerge(base: unknown, override: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isPlainObject(base) ? { ...base } : {};
  if (!isPlainObject(override)) return out;

  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = isPlainObject(value) && isPlainObject(current)
      ? deepMerge(current, value)
      : value;
  }
  return out;
}

export interface ResolvedWeiboConfig {
  /** 两份来源都没有任何字段时为 true：插件视为未配置。 */
  empty: boolean;
  /** 合并并补齐默认值后的配置。 */
  config: WeiboSettings;
}

/**
 * 合并取件配置：`legacy`（V1 `settings.weibo`）在前，`pluginConfig`（V2）覆盖其后。
 *
 * 任一来源非空即视为已配置；完全为空时 `empty` 为 true，调用方应返回明确的禁用/不可用状态。
 */
export function resolveWeiboConfig(
  legacy: Partial<WeiboSettings> | undefined,
  pluginConfig: Readonly<Record<string, unknown>> | undefined,
): ResolvedWeiboConfig {
  const legacyConfig = isPlainObject(legacy) ? legacy : {};
  const pluginOverrides = isPlainObject(pluginConfig) ? pluginConfig : {};
  const empty =
    Object.keys(legacyConfig).length === 0 && Object.keys(pluginOverrides).length === 0;

  const merged = deepMerge(
    deepMerge(structuredClone(WEIBO_DEFAULTS), legacyConfig),
    pluginOverrides,
  );
  return { empty, config: merged as unknown as WeiboSettings };
}

/**
 * 合并搜索配置：V1 把 `config.weibo` 与 `config.search.weibo` 拼成
 * `{...weibo, search: weiboSearch}`，再让 `pluginConfig` 覆盖。
 *
 * V2 宿主只注入 `pluginConfig`（含 `search` 子段），`config` 里的旧平台段为空。
 */
export function resolveEngineConfig(ctx: {
  config?: Record<string, unknown>;
  pluginConfig?: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...structuredClone(WEIBO_DEFAULTS),
    search: structuredClone(SEARCH_WEIBO_DEFAULTS),
  };

  const legacyConfig = isPlainObject(ctx.config) ? ctx.config : {};
  const legacyWeibo = isPlainObject(legacyConfig.weibo) ? legacyConfig.weibo : {};
  const legacySearchRoot = isPlainObject(legacyConfig.search) ? legacyConfig.search : {};
  const legacySearch = isPlainObject(legacySearchRoot.weibo) ? legacySearchRoot.weibo : {};
  const legacy = { ...legacyWeibo, search: legacySearch };

  return deepMerge(deepMerge(base, legacy), ctx.pluginConfig);
}
