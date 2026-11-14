/** 抓取通道契约（与网关结构一致）与微博通道常量。 */

import type { Logger } from "./logger.js";
import type { FetchPluginSecrets, FetchPluginSettings } from "./settings.js";

export type FetchChannelKind = "cli" | "http" | "session";

export interface ChannelProbe {
  ok: boolean;
  version?: string;
  authenticated?: boolean;
  message?: string;
}

export interface ChannelContext {
  settings: FetchPluginSettings;
  secrets: FetchPluginSecrets;
  getSecret(path: string): string | undefined;
  logger?: Logger;
}

export interface FetchChannel {
  id: string;
  platform: string;
  channel: string;
  displayName: string;
  kind: FetchChannelKind;
  capabilities: readonly string[];
  aliases?: readonly string[];
  probe?(ctx: ChannelContext): Promise<ChannelProbe>;
  dispose?(): Promise<void>;
}

export interface CliRunOptions {
  timeoutMs: number;
  maxBuffer?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CliResult {
  failed: boolean;
  exitCode: number | null;
  timedOut: boolean;
  spawnError?: string;
  stdout: string;
  stderr: string;
}

export interface CliChannel extends FetchChannel {
  kind: "cli";
  readonly command: string;
  run(args: readonly string[], opts: CliRunOptions): Promise<CliResult>;
}

export const WEIBO_OPENCLI: FetchChannel = {
  id: "weibo:opencli",
  platform: "weibo",
  channel: "opencli",
  displayName: "OpenCLI",
  kind: "cli",
  capabilities: ["post", "comments", "user", "user-posts", "image"],
  aliases: ["opencli", "weibo"],
};
