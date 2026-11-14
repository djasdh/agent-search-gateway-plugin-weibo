/**
 * 取件插件契约（与网关 `src/fetch/plugins/types.ts` 的结构一致）。
 *
 * 插件自管 headers / cookies / 会话与逐跳重定向，网关不干预；
 * 产物一律走 "bytes + contentType"（或 html）返回。
 */
import type { ChannelContext, FetchChannel } from "./channels.js";

export interface FetchPluginContext extends ChannelContext {
  /** 外部插件的自定义配置（内置插件通常不用）。 */
  pluginConfig?: unknown;
}

export interface FetchPluginResult {
  ok: boolean;
  status?: number;
  contentType?: string;
  finalUrl?: string;
  /** 二进制/文本产物；与 html 二选一。 */
  bytes?: Buffer;
  /** 插件自行产出的 HTML（由宿主渲染成 Markdown）。 */
  html?: string;
  errorMessage?: string;
  /** 插件自定义错误码（透传到错误文本前缀）。 */
  errorCode?: string;
}

/** 插件的能力声明（维护面使用，不影响 match）。 */
export type FetchPluginRequirement =
  | { type: "config"; path: string; optional?: boolean }
  | { type: "secret"; path: string; optional?: boolean }
  | { type: "backend"; anyOf: readonly string[]; optional?: boolean }
  | { type: "command"; path: string; default?: string; optional?: boolean };

export interface FetchPlugin {
  /** 规范平台 ID。 */
  id: string;
  /** 与 id 相同，保留给按平台分组的调用方。 */
  platform: string;
  /** 插件名，兼容旧日志/结果标注。 */
  name: string;
  displayName: string;
  aliases?: readonly string[];
  /** 对应设置段（如 `bilibili`）。 */
  settingsKey?: string;
  capabilities: readonly string[];
  requires?: readonly FetchPluginRequirement[];
  /** 该平台可用的通道（静态元数据）。 */
  channels?: readonly FetchChannel[];

  /** 是否接管该 URL：纯 URL 判断，不读配置、不抛错。 */
  match(url: URL): boolean;
  /** 统一开关；返回 false 时宿主跳过该插件，回退通用抓取。 */
  enabled?(ctx: FetchPluginContext): boolean;
  /** 维护面可用性（健康检查 / 列表），不参与 URL 匹配。 */
  available?(ctx: FetchPluginContext): boolean;
  fetch(url: URL, ctx: FetchPluginContext): Promise<FetchPluginResult>;
}

/** 文本成功结果。 */
export function textResult(body: string, contentType: string, finalUrl?: string): FetchPluginResult {
  return { ok: true, status: 200, contentType, finalUrl, bytes: Buffer.from(body, "utf8") };
}

/** HTML 成功结果。 */
export function htmlResult(html: string, finalUrl?: string): FetchPluginResult {
  return { ok: true, status: 200, contentType: "text/html", finalUrl, html };
}

/** 二进制成功结果。 */
export function bytesResult(bytes: Buffer, contentType: string, finalUrl?: string): FetchPluginResult {
  return { ok: true, status: 200, contentType, finalUrl, bytes };
}

/** 失败结果；有 hint 时追加「处理：<hint>」。 */
export function errorResult(
  code: string | undefined,
  message: string,
  extra?: { status?: number; finalUrl?: string; hint?: string },
): FetchPluginResult {
  const hint = extra?.hint ? `\n处理：${extra.hint}` : "";
  return {
    ok: false,
    status: extra?.status,
    finalUrl: extra?.finalUrl,
    errorCode: code,
    errorMessage: message + hint,
  };
}
