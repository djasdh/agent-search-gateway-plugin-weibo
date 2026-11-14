# agent-search-gateway-plugin-weibo

[agent-search-gateway](https://github.com/djasdh/agent_search_gateway) 的 **微博插件**（asg plugin）。

- 仓库 topic：**`asg-plugin`**
- 插件 id：`weibo`
- 能力：`fetch` + `search`
  - `fetch`：帖子、评论、用户资料、时间段微博、图片 CDN
  - `search`：`weibo`（帖子搜索）与 `weibo_hot`（热搜）两个文本源

## 安装

```bash
asg extensions install djasdh/agent-search-gateway-plugin-weibo@0.1.0
asg extensions list
```

运行依赖 **OpenCLI**（`opencli`）：

```bash
npm install -g @jackwener/opencli
opencli doctor
```

启用配置：

```yaml
weibo:
  enabled: true
  cli:
    command: opencli
    timeout_ms: 30000

search:
  weibo:
    enabled: true      # 启用 weibo / weibo_hot 搜索源
    category: weibo
    hot_category: weibo_hot
```

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

1. 同步修改 `asg-plugin.json` 与 `package.json` 的版本号。
2. `git tag v0.1.0 && git push origin v0.1.0`。
3. GitHub Actions 执行 `npm ci` / `npm run typecheck` / `npm test` / `npm run build`，
   生成 `SHA256SUMS` 并创建 Release（`index.mjs`、`asg-plugin.json`、`SHA256SUMS`）。

## 发现

请给仓库加 GitHub topic **`asg-plugin`**，否则 `asg extensions search` 搜不到。

## License

MIT
