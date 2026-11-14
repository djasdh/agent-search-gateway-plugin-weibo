/** searxng 结果形状（引擎 provider 的返回类型；只复制结构与微博源相关的字段）。 */
export interface SearxngResult {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  engines?: string[];
  category?: string;
  publishedDate?: string | null;
  score?: number;
  img_src?: string;
  thumbnail_src?: string;
  resolution?: string;
  img_format?: string;
  source?: string;
  [key: string]: unknown;
}
