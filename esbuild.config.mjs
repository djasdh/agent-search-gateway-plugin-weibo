/**
 * 把 src/index.ts 打成单文件 ESM（index.mjs）。
 *
 * Release 同时上传 index.mjs、asg-extension.json（V2）、asg-plugin.json（V1 兼容）
 * 与 SHA256SUMS；因此关闭代码分割，只把 Node 内置模块保留为 external。
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "index.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["node:*"],
  sourcemap: false,
  minify: false,
  logLevel: "info",
});
