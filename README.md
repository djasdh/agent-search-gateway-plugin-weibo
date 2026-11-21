# agent-search-gateway-plugin-weibo

[agent-search-gateway](https://github.com/djasdh/agent_search_gateway) 的 **微博插件**（asg plugin）。

- 仓库 topic：**`asg-plugin`**
- 插件 id：`weibo`
- 能力：`fetch` + `search`
  - `fetch`：帖子、评论、用户资料、时间段微博、图片 CDN
  - `search`：`weibo`（帖子搜索）与 `weibo_hot`（热搜）两个文本源

## 安装

```bash
asg extensions install djasdh/agent-search-gateway-plugin-weibo@0.2.1
asg extensions list
```

Release 同时提供两份 manifest：

- `asg-extension.json`（`api_version: 2`）：agent-search-gateway **0.3.9+** 优先使用；
- `asg-plugin.json`（`api_version: 1`）：保留给 **0.3.8 及更早**版本。

运行依赖 **OpenCLI**（`opencli`）：

```bash
npm install -g @jackwener/opencli
opencli doctor
```

### 配置（0.3.9+，V2）

插件私有配置写在 `gateway.yaml` 的 `extensions.weibo.config`：

```yaml
extensions:
  weibo:
    config:
      enabled: true
      cli:
        command: opencli
        timeout_ms: 30000
      search:
        enabled: true      # 启用 weibo / weibo_hot 搜索源
        category: weibo
        hot_category: weibo_hot
```

也可以用 CLI 修改：

```bash
asg extensions config weibo --set enabled=true
asg extensions config weibo --set search.enabled=true
asg extensions config weibo --describe
```

### 启用搜索源

agent-search-gateway **0.4.0+** 已删除 `gateway.yaml` 的 `search.weibo` 段，搜索源开关
改由扩展私有配置承载。以下两种方式等价，都会写 `extensions.weibo.config.search.enabled`：

```bash
asg engines enable gateway.search:weibo
# 或直接改扩展配置
asg extensions config weibo --set search.enabled=true
```

插件在 `engine` 上同时声明：

| 字段 | 值 | 适用宿主 |
| --- | --- | --- |
| `requires` / `enabledPath` | `config:weibo.enabled` / `search.weibo.enabled` | 0.3.x |
| `requiresV2` / `enabledPathV2` | `config:extensions.weibo.config.search.enabled` / `extensions.weibo.config.search.enabled` | 0.4.0+（优先） |

**0.3.x** 继续使用顶层 `search.weibo.enabled`（见下文旧配置示例），`asg engines enable` 会写回该路径。

旧配置由 0.3.x 迁移脚本自动搬到新位置：

| 旧位置 | 新位置 |
| --- | --- |
| `weibo` | `extensions.weibo.config` |
| `search.weibo` | `extensions.weibo.config.search` |

0.3.8 及更早仍使用旧顶层段：

```yaml
weibo:
  enabled: true
  cli:
    command: opencli
    timeout_ms: 30000

search:
  weibo:
    enabled: true
    category: weibo
    hot_category: weibo_hot
```

插件在运行期把 `ctx.settings.weibo`（V1）与 `ctx.pluginConfig`（V2）深合并，`pluginConfig` 优先；
两份都为空时视为未配置，取件返回明确错误而不是回退到部分默认值。

## 取件能力（`fetch`）

| URL | 动作 |
| --- | --- |
| `weibo.com/{uid}/{mblogid}?weibo=post` | 帖子 Markdown（作者、正文、转发、图片、互动数） |
| `weibo.com/detail/{id}?weibo=post`、`m.weibo.cn/status/{id}` | 同上 |
| `...?weibo=comments&limit=N` | 评论 JSON（`mblogid` 会先换成数字 id） |
| `weibo.com/u/{uid}?weibo=user`、`weibo.com/n/{昵称}?weibo=user` | 用户资料 JSON |
| `...?weibo=user-posts&days=7` / `start=&end=` | 按日期二分抓取，输出按天分组的 Markdown |
| `*.sinaimg.cn/large/...` | 图片下载（带 Referer，`wx*` 失败回退 `tvax*`） |

普通页面必须带 `?weibo=` 才会被接管（`match` 是纯 URL 判断）；禁用后回退通用抓取。

## 搜索能力（`engine`）

`src/index.ts` 同时导出 `engine`：`EngineProvider`（`group: "gateway.search"`，`runtime.kind: "search"`）。

- `routing`：`category:weibo`、`category:weibo_hot`
- `plan`：命中 `weibo_hot` → `{ hot: true }`；只命中 `weibo` → `{ hot: false }`
- `search`：调用 `opencli weibo search|hot`，空结果自动重试，结果带缓存与排序分

## 开发

```bash
npm install
npm run build      # esbuild → 单文件 ESM index.mjs
npm test           # 构建 + vitest + node --test 冒烟测试
npm run typecheck  # tsc --noEmit
```

约束：

- 运行期只依赖 Node 内置模块，其余代码全部 bundle 进 `index.mjs`；
- 不 import `agent-search-gateway` 内部模块，也不依赖宿主 `node_modules`；
- `src/index.ts` 必须导出命名 `fetch`（以及 `engine`，因为 `provides` 含 `search`）。

## 发版

1. 同步修改 `asg-extension.json`、`asg-plugin.json` 与 `package.json` 的版本号。
2. `git tag v0.2.1 && git push origin v0.2.1`。
3. GitHub Actions 执行 `npm ci` / `npm run typecheck` / `npm test` / `npm run build`，
   生成 `SHA256SUMS` 并创建 Release（`index.mjs`、`asg-extension.json`、
   `asg-plugin.json`、`SHA256SUMS`）。

## 发现

请给仓库加 GitHub topic **`asg-plugin`**，否则 `asg extensions search` 搜不到。

## License

MIT
