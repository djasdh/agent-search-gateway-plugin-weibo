/**
 * 引擎 provider 协议（与网关 `src/engines/provider.ts` 的结构一致）。
 *
 * `export const engine` 需满足 `EngineProvider`：
 * - `group: "gateway.search"` + `runtime.kind: "search"`：文本源（帖子搜索/热搜）
 * - `group: "gateway.reverse_image"` + `runtime.kind: "reverse_image"`：以图搜图源
 */
import type { Logger } from "./logger.js";
import type { SearxngResult } from "./searxng.js";

export type EngineKind = "searxng" | "gateway";
export type EngineGroup = "searxng" | "gateway.reverse_image" | "gateway.search";

export interface EngineProviderContext {
  /** 与 gateway.yaml 同形的配置切片（V1 宿主）。 */
  config: Record<string, unknown>;
  /** 与 secrets.yaml 同形的密钥切片。 */
  secrets: Record<string, unknown>;
  /** 第三方 search 插件的私有配置（V2 `extensions.<id>.config`，已补默认值）。 */
  pluginConfig?: Readonly<Record<string, unknown>>;
  /** 第三方 search 插件密钥（V2 `extensions.<id>.<name>`，空值不注入）。 */
  pluginSecrets?: Record<string, string>;
  logger?: Logger;
}

export interface GatewaySearchPlan {
  /** true = 热搜/热榜类查询，不需要关键词。 */
  hot: boolean;
}

export interface GatewaySearchOptions {
  hot: boolean;
  limit: number;
}

export interface GatewaySearchError {
  kind: "timeout" | "network" | "api" | "auth" | "invalid";
  message: string;
}

export type GatewaySearchResult =
  | { ok: true; results: SearxngResult[]; latencyMs: number }
  | { ok: false; error: GatewaySearchError; latencyMs: number };

/** 以图搜图源的输入与返回（结构对齐网关 `src/search/sources.ts`）。 */
export type ImageInput =
  | { kind: "url"; url: string }
  | { kind: "bytes"; bytes: Uint8Array; filename: string; mime: string };

export interface SourceError {
  kind: "timeout" | "http" | "network" | "invalid_json" | "api";
  status?: number;
  message: string;
}

export type SourceCall =
  | { ok: true; results: SearxngResult[]; latencyMs: number; [key: string]: unknown }
  | { ok: false; error: SourceError };

export interface ReverseImageRuntime {
  kind: "reverse_image";
  search(input: ImageInput, ctx: EngineProviderContext): Promise<SourceCall>;
}

export interface GatewaySearchRuntime {
  kind: "search";
  /** 类别命中时返回计划；不命中返回 undefined。 */
  plan(categories: string | undefined, ctx: EngineProviderContext): GatewaySearchPlan | undefined;
  search(
    query: string,
    options: GatewaySearchOptions,
    ctx: EngineProviderContext,
  ): Promise<GatewaySearchResult>;
}

export type EngineRuntime = ReverseImageRuntime | GatewaySearchRuntime;

export interface EngineProvider {
  /** `${group}:${name}` */
  id: string;
  group: EngineGroup;
  name: string;
  kind: EngineKind;
  displayName: string;
  routing(ctx: EngineProviderContext): string[];
  /**
   * V1 前置条件（`gateway.yaml` 顶层段，如 `config:weibo.enabled`）。
   * 0.3.x 宿主使用；0.4.0+ 优先读 `requiresV2`。
   */
  requires?: string[];
  /** V2 前置条件（`extensions.<id>.config` 下的路径），0.4.0+ 宿主优先使用。 */
  requiresV2?: string[];
  /** 前置条件是否满足（密钥 / 上游能力开关）；不包含引擎自身的 enabled。 */
  available(ctx: EngineProviderContext): boolean;
  /** 引擎自身的启用状态；缺省视为 true。 */
  enabled?(ctx: EngineProviderContext): boolean;
  /**
   * V1 `gateway.search` 源启用布尔值在 `gateway.yaml` 中的路径
   * （如 `search.weibo.enabled`）。
   * 0.3.x 宿主使用；0.4.0+ 优先读 `enabledPathV2`。
   */
  enabledPath?: readonly string[];
  /**
   * V2 `gateway.search` 源启用布尔值的路径（相对 `extensions.<id>.config`），
   * 如 `extensions.weibo.config.search.enabled` 对应
   * `["extensions", "weibo", "config", "search", "enabled"]`。
   * 0.4.0+ 宿主优先使用；旧宿主可忽略。
   */
  enabledPathV2?: readonly string[];
  runtime?: EngineRuntime;
  /** auth 错误时追加的提示。 */
  authHint?: string;
}
