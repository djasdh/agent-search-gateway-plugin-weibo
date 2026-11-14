import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { downloadWeiboImage } from "../src/images.js";
import { makeWeibo } from "./helpers.js";

const servers: Server[] = [];

async function startServer(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe("image download", () => {
  it("带 Referer 下载图片", async () => {
    let referer = "";
    const base = await startServer((req, res) => {
      referer = String(req.headers.referer ?? "");
      res.writeHead(200, { "content-type": "image/png" });
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });
    const result = await downloadWeiboImage(new URL(`${base}/large/a.png`), makeWeibo());
    expect(result.contentType).toBe("image/png");
    expect(result.bytes.length).toBe(4);
    expect(referer).toBe("https://weibo.com/");
  });

  it("非图片类型报 WEIBO_IMAGE_FAIL", async () => {
    const base = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("nope");
    });
    await expect(downloadWeiboImage(new URL(`${base}/large/a.jpg`), makeWeibo())).rejects.toMatchObject({
      code: "WEIBO_IMAGE_FAIL",
    });
  });

  it("超过大小上限报 WEIBO_IMAGE_FAIL", async () => {
    const base = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(Buffer.alloc(64, 1));
    });
    await expect(
      downloadWeiboImage(new URL(`${base}/large/a.png`), makeWeibo({
        images: { ...makeWeibo().images, max_bytes: 10 },
      })),
    ).rejects.toMatchObject({ code: "WEIBO_IMAGE_FAIL" });
  });
});
