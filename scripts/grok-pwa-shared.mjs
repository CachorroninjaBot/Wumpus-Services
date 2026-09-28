/**
 * Shared helpers used by the Vite PWA plugin. Kept dependency-free so the
 * production build can load vite.config without the rest of the preview chrome.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_APP_NAME = "Wumpus";

export function escapeHtml(value) {
  const entity = (name) => "&" + name + ";";
  return String(value)
    .replaceAll("&", entity("amp"))
    .replaceAll("<", entity("lt"))
    .replaceAll(">", entity("gt"))
    .replaceAll('"', entity("quot"))
    .replaceAll("'", entity("#39"));
}

export function appNameFromHost() {
  return DEFAULT_APP_NAME;
}

export function acceptsHtml(accept) {
  const value = String(accept ?? "");
  return value === "" || value.includes("text/html") || value.includes("*/*");
}

export function isInstallQuery(url) {
  const query = String(url ?? "").split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  const install = params.get("install");
  const platform = (params.get("platform") ?? "").toLowerCase();
  return (install === "1" || install === "true") && platform === "ios";
}

export function isDocumentPath(pathname) {
  const path = String(pathname ?? "");
  return (
    !path.startsWith("/__grok/") &&
    !path.startsWith("/api/") &&
    !path.startsWith("/@") &&
    !path.startsWith("/node_modules") &&
    !/\.[a-z0-9]+$/i.test(path)
  );
}

export function stripInstallParams(url) {
  const [path = "/", query = ""] = String(url ?? "/").split("?", 2);
  const params = new URLSearchParams(query);
  params.delete("install");
  params.delete("platform");
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

export function renderInstallPageHtml(template, { url } = {}) {
  return String(template)
    .replaceAll("{{APP_NAME}}", escapeHtml(DEFAULT_APP_NAME))
    .replaceAll("{{APP_URL}}", escapeHtml(stripInstallParams(url)));
}

export function renderWebManifest() {
  return JSON.stringify(
    {
      name: DEFAULT_APP_NAME,
      short_name: DEFAULT_APP_NAME,
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#000000",
      theme_color: "#000000",
    },
    null,
    2,
  );
}

export function readOgSite(cwd = process.cwd()) {
  try {
    const raw = readFileSync(join(cwd, "src/lib/og/site.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function snapshotOgIdentity(cwd = process.cwd()) {
  const site = { ...readOgSite(cwd) };
  if (existsSync(join(cwd, "public/og.jpg"))) {
    site.card = "custom";
    site.image = "/og.jpg";
  }
  return { site };
}

export function injectGrokPwaHead(html) {
  return html;
}

export function createHeadInjector() {
  return {
    push(chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ""));
      return [buf];
    },
    flush() {
      return [];
    },
  };
}
