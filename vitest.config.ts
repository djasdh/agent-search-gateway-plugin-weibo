import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 只跑 TS 单测；构建产物冒烟测试由 `node --test test/build.test.mjs` 负责。
    include: ["test/**/*.test.ts"],
  },
});
