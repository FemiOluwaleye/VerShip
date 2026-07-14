/*
 * Static prerender for the VerShip SPA.
 *
 * Runs AFTER `vite build`. Serves ./dist, loads each public route in headless
 * Chromium, lets the app + react-helmet-async render, then writes the fully
 * rendered HTML back to dist/<route>/index.html. Crawlers (and no-JS clients)
 * then receive real content + per-page <title>/meta/canonical instead of an
 * empty shell. Real users still hydrate/interact via the normal JS bundle.
 *
 * This is intentionally SEPARATE from `npm run build` so a broken/absent browser
 * can never block a normal build/deploy. Run it where Chromium can launch
 * (CI / the Render build image) via `npm run prerender`.
 *
 * Requires system libs for Chromium (libglib etc.). It will NOT run in a bare
 * sandbox that lacks them — that's expected; run it in the build/CI image.
 */
import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PRERENDER_PORT || 4183);

// Public, indexable routes (auth/transactional routes are excluded — see robots.txt).
const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/help",
  "/faqs",
  "/terms",
  "/privacy",
  "/cookie-policy",
  "/freight-content",
  "/refund-policy",
  "/forwarders",
  "/prepacked-barrel",
];

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".map": "application/json", ".txt": "text/plain", ".xml": "application/xml",
};

// Minimal static server for dist with SPA fallback to index.html.
function serveDist() {
  return http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(DIST, urlPath);
      if (existsSync(filePath) && (await stat(filePath)).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!existsSync(filePath)) {
        // asset miss -> 404; route miss -> SPA fallback
        if (path.extname(urlPath)) { res.statusCode = 404; return res.end("Not found"); }
        filePath = path.join(DIST, "index.html");
      }
      const body = await readFile(filePath);
      res.setHeader("Content-Type", MIME[path.extname(filePath)] || "application/octet-stream");
      res.end(body);
    } catch (e) {
      res.statusCode = 500;
      res.end("Server error");
    }
  });
}

async function main() {
  if (!existsSync(path.join(DIST, "index.html"))) {
    console.error("[prerender] dist/index.html not found. Run `npm run build` first.");
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    console.error("[prerender] puppeteer is not installed. `npm i -D puppeteer`.");
    process.exit(1);
  }

  const server = serveDist();
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://localhost:${PORT}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      // Allow pointing at a system/Nix-provided Chromium that has its shared libs.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (e) {
    console.error("\n[prerender] Could not launch Chromium in this environment:");
    console.error("  " + e.message.split("\n")[0]);
    console.error("[prerender] Run this step in a Chromium-capable build image (CI / Render). Skipping.\n");
    server.close();
    process.exit(1);
  }

  let ok = 0;
  for (const route of ROUTES) {
    const page = await browser.newPage();
    try {
      await page.goto(base + route, { waitUntil: "networkidle0", timeout: 45000 });
      // Give react-helmet-async a tick to flush <title>/meta into <head>.
      await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
      const html = "<!doctype html>\n" + (await page.content()).replace(/^<!doctype html>/i, "").trimStart();

      const outDir = route === "/" ? DIST : path.join(DIST, route);
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, "index.html"), html, "utf8");
      const title = await page.title();
      console.log(`[prerender] ${route.padEnd(20)} -> ${path.relative(DIST, path.join(outDir, "index.html"))}  (title: ${title})`);
      ok++;
    } catch (e) {
      console.error(`[prerender] FAILED ${route}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();
  console.log(`\n[prerender] Done. ${ok}/${ROUTES.length} routes prerendered into dist/.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
