import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const root = resolve(process.argv.includes("--source") ? "." : "dist");
const port = Number(process.env.PORT || 4173);
const base = process.env.BASE_PATH || "/";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".xml": "application/xml", ".woff2": "font/woff2" };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
    const decoded = decodeURIComponent(url.pathname.slice(base.length));
    let path = resolve(root, decoded.replace(/^\/+/, ""));
    if (path !== root && !path.startsWith(root + sep)) throw new Error("Outside root");
    const info = await stat(path);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith("/")) { res.writeHead(301, { Location: url.pathname + "/" + url.search }); res.end(); return; }
      path = resolve(path, "index.html");
    }
    const data = await readFile(path);
    const headers = { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = Math.min(Number(range[2] || data.length - 1), data.length - 1);
      if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${data.length}` }); res.end(); return; }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": end - start + 1 });
      res.end(req.method === "HEAD" ? undefined : data.subarray(start, end + 1));
    } else {
      res.writeHead(200, { ...headers, "Content-Length": data.length });
      res.end(req.method === "HEAD" ? undefined : data);
    }
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    try { res.end(await readFile(resolve(root, "404.html"))); } catch { res.end("Not found"); }
  }
}).listen(port, "127.0.0.1", () => console.log(`Local: http://127.0.0.1:${port}${base} (serving ${root})`));
