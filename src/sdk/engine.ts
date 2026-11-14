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
  /** 与 gateway.yaml 同形的配置切片。 */
  config: Record<string, unknown>;
  /** 与 secrets.yaml 同形的密钥切片。 */
  secrets: Record<string, unknown>;
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
  requires?: string[];
  /** 前置条件是否满足（密钥 / 上游能力开关）；不包含引擎自身的 enabled。 */
  available(ctx: EngineProviderContext): boolean;
  /** 引擎自身的启用状态；缺省视为 true。 */
  enabled?(ctx: EngineProviderContext): boolean;
  /** gateway.search 源的启用布尔值在 gateway.yaml 中的路径。 */
  enabledPath?: readonly string[];
  runtime?: EngineRuntime;
  /** auth 错误时追加的提示。 */
  authHint?: string;
}
