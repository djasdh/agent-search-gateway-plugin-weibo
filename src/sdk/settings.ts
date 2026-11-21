/** 插件可见的设置/密钥切片（与网关 `src/settings/*` 的 schema 结构一致）。 */

export interface FetchSettings {
  timeout_ms: number;
  max_bytes: number;
  user_agent: string;
}

export interface WeiboCliSettings {
  command: string;
  timeout_ms: number;
}

export interface WeiboDefaultsSettings {
  comments_limit: number;
  user_posts_limit: number;
}

export interface WeiboUserPostsSettings {
  default_days: number;
  max_days: number;
  max_items: number;
  max_calls: number;
  budget_ms: number;
  max_chars: number;
}

export interface WeiboImagesSettings {
  enabled: boolean;
  referer: string;
  max_bytes: number;
  timeout_ms: number;
  retry_tvax: boolean;
}

export interface WeiboSettings {
  enabled: boolean;
  cli: WeiboCliSettings;
  defaults: WeiboDefaultsSettings;
  user_posts: WeiboUserPostsSettings;
  images: WeiboImagesSettings;
  cache_ttl_ms: number;
}

/** 搜索源相关配置（`search.weibo` 段）。 */
export interface SearchWeiboSettings {
  enabled: boolean;
  category: string;
  hot_category: string;
  limit: number;
  timeout_ms: number;
  cache_ttl_ms: number;
  retry: number;
}

export interface FetchPluginSettings {
  fetch: FetchSettings;
  /** V1 宿主注入的平台配置；V2 宿主不提供，改用 `ctx.pluginConfig`。 */
  weibo?: WeiboSettings;
}

export interface FetchPluginSecrets {
  bilibili: { http: { token: string } };
}

/** 引擎 provider 拿到的原始配置切片（与 gateway.yaml 同形）。 */
export interface EngineProviderConfig {
  search?: { weibo?: Partial<SearchWeiboSettings> } & Record<string, unknown>;
  weibo?: { enabled?: boolean; cli?: { command?: string } } & Record<string, unknown>;
  [key: string]: unknown;
}
