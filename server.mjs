import "dotenv/config";
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig, readContract } from "./lib/botchain.mjs";
const root = fileURLToPath(new URL(".", import.meta.url));
const dist = resolve(root, "dist");
const revision =
  process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const headers = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://rpc.bohr.life; base-uri 'self'; frame-ancestors 'none'",
};
function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    ...headers,
    "content-type": type,
    "cache-control": "no-store",
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/healthz")
      return send(res, 200, { ok: true, revision });
    if (req.method === "GET" && url.pathname === "/api/config") {
      const c = getConfig();
      return send(res, 200, {
        chainId: c.chainId,
        contractAddress: c.contractAddress,
        deploymentTx: c.deploymentTx,
        deploymentBlock: c.deploymentBlock,
        revision,
      });
    }
    if (req.method === "GET" && url.pathname === "/api/snapshot")
      return send(res, 200, await readContract());
    if (req.method === "GET") {
      let path = decodeURIComponent(url.pathname);
      if (path === "/" || !extname(path)) path = "/index.html";
      const file = resolve(dist, `.${path}`);
      if (!file.startsWith(dist + sep) && file !== resolve(dist, "index.html"))
        return send(res, 404, { error: "Not found" });
      if (existsSync(file))
        return createReadStream(file)
          .on("error", () => send(res, 500, { error: "Asset read failed" }))
          .pipe(res);
      if (extname(path)) return send(res, 404, { error: "Asset not found" });
      const fallback = resolve(dist, "index.html");
      if (existsSync(fallback)) return createReadStream(fallback).pipe(res);
      return send(res, 503, {
        error: "Build the app with npm run build first.",
      });
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return send(res, 503, {
      error: e instanceof Error ? e.message : "Upstream read failed",
    });
  }
});
const port = Number(process.env.PORT || 4324);
server.listen(port, "0.0.0.0", () =>
  process.stdout.write(
    `Thread listening on http://0.0.0.0:${port} (${revision})\n`,
  ),
);
