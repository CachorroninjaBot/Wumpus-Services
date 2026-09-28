import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dest = join(root, ".output", "public", "assets");
mkdirSync(dest, { recursive: true });

const sources = [
  join(root, "node_modules", ".nitro", "vite", "services", "ssr", "assets"),
  join(root, ".output", "public", "assets"),
];

const cssFiles = [];
for (const dir of sources) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".css")) continue;
    const from = join(dir, name);
    const to = join(dest, name);
    if (from !== to) cpSync(from, to);
    cssFiles.push(name);
    console.log("[sync-public] css", name);
  }
}

const publicDir = join(root, ".output", "public");
const manifestSrc = join(root, "public", "manifest.json");
const manifestDest = join(publicDir, "manifest.json");
if (existsSync(manifestSrc)) {
  mkdirSync(publicDir, { recursive: true });
  cpSync(manifestSrc, manifestDest);
  console.log("[sync-public] manifest.json");
}

if (cssFiles.length) {
  const primary = join(dest, cssFiles[0]);
  for (const alias of ["styles.css", "styles-DAs-E03q.css"]) {
    cpSync(primary, join(dest, alias));
  }
}
