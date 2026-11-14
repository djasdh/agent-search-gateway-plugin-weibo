/** 宿主 logger 的结构化类型（只依赖方法签名）。 */
export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  close?(): void;
}
