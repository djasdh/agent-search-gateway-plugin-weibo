/** 测试用配置工厂：直接构造插件可见的设置切片，不依赖宿主 settings loader。 */
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EngineProviderContext } from "../src/sdk/engine.js";
import type { FetchPluginContext } from "../src/sdk/fetch-plugin.js";
import type { WeiboSettings } from "../src/sdk/settings.js";

/** 假 OpenCLI：按 `weibo <cmd> <id>` 返回固定 JSON，并把调用写入 FAKE_LOG。 */
export const FAKE_CLI = `#!/usr/bin/env bash
set -e
cmd="$2"
id="$3"
[ -n "$FAKE_LOG" ] && echo "$cmd $id" >> "$FAKE_LOG"
case "$cmd" in
  post)
    if [ "$id" = "fail77" ]; then echo "not logged in" >&2; exit 77; fi
    cat <<'JSON'
[{"field":"id","value":"5123456789"},{"field":"mblogid","value":"AbCdEf"},{"field":"author","value":"测试作者"},{"field":"text","value":"正文内容"},{"field":"pic_count","value":"2"},{"field":"pic_urls","value":"[{\\"url\\":\\"https://wx1.sinaimg.cn/large/a.jpg\\"},{\\"url\\":\\"https://wx2.sinaimg.cn/large/b.jpg\\"}]"},{"field":"retweeted_text","value":"转发正文"},{"field":"reposts","value":"3"},{"field":"comments","value":"4"},{"field":"likes","value":"5"},{"field":"url","value":"https://weibo.com/1/AbCdEf"}]
JSON
    ;;
  comments)
    printf '[{"author":"c1","text":"评论1"}]\\n'
    ;;
  user)
    printf '{"screen_name":"测试作者","uid":"1"}\\n'
    ;;
  user-posts)
    printf '[{"id":"AbCdEf","text":"用户微博"}]\\n'
    ;;
  *)
    echo "unknown command: $cmd" >&2
    exit 1
    ;;
esac
`;

/** 假 OpenCLI（搜索/热搜版）：按 `weibo search|hot` 返回固定行。 */
export const FAKE_SEARCH_CLI = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const cmd = args[1];
if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, args.join(" ") + "\\n");
const searchRows = [
  { rank: 1, id: "R1", title: "洛天依演唱会", author: "Vsinger_洛天依", time: "今天 12:00", url: "https://weibo.com/5146173015/R1?refer_flag=1001030103_" },
  { rank: 2, id: "R2", title: "第二条微博", author: "测试用户", time: "昨天 09:00", url: "https://weibo.com/1/R2" },
];
const hotRows = [
  { rank: 1, word: "测试话题", hot_value: 123456, category: "文娱", label: "热", url: "https://s.weibo.com/weibo?q=%23%E6%B5%8B%E8%AF%95%E8%AF%9D%E9%A2%98%23" },
];
if (cmd === "search") {
  const mode = process.env.FAKE_MODE || "ok";
  if (mode === "retry") {
    const file = process.env.FAKE_COUNTER;
    const n = file && fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0;
    if (file) fs.writeFileSync(file, String(n + 1));
    if (n === 0) { console.error("No Weibo search results found"); process.exit(66); }
  }
  process.stdout.write(JSON.stringify(searchRows));
  process.exit(0);
}
if (cmd === "hot") {
  process.stdout.write(JSON.stringify(hotRows));
  process.exit(0);
}
console.error("unknown command: " + cmd);
process.exit(1);
`;

export function tmpDir(prefix = "asg-weibo-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeCli(source = FAKE_CLI): string {
  const dir = tmpDir();
  const cli = join(dir, "fake-opencli.js");
  writeFileSync(cli, source);
  chmodSync(cli, 0o755);
  return cli;
}

export function makeWeibo(overrides: Partial<WeiboSettings> = {}): WeiboSettings {
  return {
    enabled: true,
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
    cache_ttl_ms: 0,
    ...overrides,
  };
}

export function makeContext(
  cli: string,
  overrides: Partial<WeiboSettings> = {},
  pluginConfig?: Record<string, unknown>,
): FetchPluginContext {
  return {
    settings: {
      fetch: { timeout_ms: 15000, max_bytes: 5 * 1024 * 1024, user_agent: "" },
      weibo: makeWeibo({
        ...overrides,
        cli: { command: cli, timeout_ms: overrides.cli?.timeout_ms ?? 5000 },
      }),
    },
    secrets: { bilibili: { http: { token: "" } } },
    getSecret: () => undefined,
    ...(pluginConfig ? { pluginConfig } : {}),
  };
}

/** V2 宿主：只有 `pluginConfig`，没有 `settings.weibo`。 */
export function makePluginContext(
  pluginConfig: Record<string, unknown>,
  options: { userAgent?: string } = {},
): FetchPluginContext {
  return {
    settings: {
      fetch: {
        timeout_ms: 15000,
        max_bytes: 5 * 1024 * 1024,
        user_agent: options.userAgent ?? "",
      },
    },
    secrets: { bilibili: { http: { token: "" } } },
    getSecret: () => undefined,
    pluginConfig,
  };
}

/** V2 `extensions.weibo.config` 的完整形态（与 config_schema 默认值一致）。 */
export function makeWeiboConfig(
  cli: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...makeWeibo({ cli: { command: cli, timeout_ms: 5000 } }),
    ...overrides,
  };
}

/** V2 `extensions.weibo.config`：取件 + 搜索完整配置。 */
export function makeEngineConfig(
  command: string,
  overrides: {
    enabled?: boolean;
    searchEnabled?: boolean;
    search?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  return {
    enabled: overrides.enabled ?? true,
    cli: { command, timeout_ms: 5000 },
    search: {
      enabled: overrides.searchEnabled ?? true,
      category: "weibo",
      hot_category: "weibo_hot",
      timeout_ms: 5000,
      cache_ttl_ms: 0,
      retry: 0,
      ...overrides.search,
    },
  };
}

/** 引擎 provider 的测试上下文（config 与 gateway.yaml 同形）。 */
export function makeEngineContext(overrides: {
  searchWeiboEnabled?: boolean;
  weiboEnabled?: boolean;
  command?: string;
  pluginConfig?: Record<string, unknown>;
} = {}): EngineProviderContext {
  return {
    config: {
      search: {
        weibo: {
          enabled: overrides.searchWeiboEnabled ?? true,
          category: "weibo",
          hot_category: "weibo_hot",
          timeout_ms: 5000,
          cache_ttl_ms: 0,
          retry: 0,
        },
      },
      weibo: {
        enabled: overrides.weiboEnabled ?? true,
        cli: { command: overrides.command ?? "opencli" },
      },
    },
    secrets: {},
    ...(overrides.pluginConfig ? { pluginConfig: overrides.pluginConfig } : {}),
  };
}

/** V2 宿主：只有 `pluginConfig`，没有旧 `config.weibo` / `config.search.weibo`。 */
export function makeV2EngineContext(pluginConfig: Record<string, unknown>): EngineProviderContext {
  return { config: {}, secrets: {}, pluginConfig };
}
