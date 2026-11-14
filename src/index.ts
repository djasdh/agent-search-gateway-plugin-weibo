/**
 * 插件入口：按 asg 运行期约定导出 `fetch` 与 `engine`。
 *
 * - `fetch`：微博帖子/评论/用户/时间段的取件实现；
 * - `engine`：`gateway.search` 文本源（帖子搜索 + 热搜）。
 */
import { weiboPlugin } from "./plugin.js";
import { weiboProvider } from "./engine.js";

export const fetch = weiboPlugin;
export const engine = weiboProvider;

export { weiboPlugin, weiboProvider };
export { mapWeiboHotRows, mapWeiboSearchRows, searchWeibo, searchWeiboHot, stripWeiboRefer } from "./search.js";
export {
  addDays, daysBetween, isWeiboImageUrl, isWeiboUrl, parseWeiboRequest, resolveShortLink,
  splitDateRange, todayInShanghai,
} from "./parse.js";
export type { WeiboPost, WeiboRef } from "./types.js";
