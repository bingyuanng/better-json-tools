import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function writeJson(p, obj) {
  await ensureDir(path.dirname(p));
  await writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function main() {
  // Clean extension-only folders inside dist (keep Vite assets/viewer.html).
  await rm(path.join(dist, "background"), { recursive: true, force: true });
  await rm(path.join(dist, "content"), { recursive: true, force: true });
  await rm(path.join(dist, "sandbox"), { recursive: true, force: true });
  await rm(path.join(dist, "assets"), { recursive: false, force: false }).catch(() => {});

  // Copy background/content (current JS versions) into dist.
  await ensureDir(path.join(dist, "background"));
  await ensureDir(path.join(dist, "content"));
  await ensureDir(path.join(dist, "sandbox"));
  await copyFile(path.join(root, "background", "serviceWorker.js"), path.join(dist, "background", "serviceWorker.js"));
  await copyFile(path.join(root, "content", "contentScript.js"), path.join(dist, "content", "contentScript.js"));
  await copyFile(path.join(root, "sandbox", "repl.html"), path.join(dist, "sandbox", "repl.html"));
  await copyFile(path.join(root, "sandbox", "repl.js"), path.join(dist, "sandbox", "repl.js"));

  // Manifest points to dist output files.
  const manifest = {
    manifest_version: 3,
    name: "Better JSON Tools",
    description: "Prettify JSON responses in the browser with a searchable, collapsible viewer.",
    version: "0.2.0",
    action: { default_title: "Better JSON Tools" },
    background: { service_worker: "background/serviceWorker.js" },
    permissions: [],
    host_permissions: ["<all_urls>"],
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content/contentScript.js"],
        run_at: "document_end",
      },
    ],
    web_accessible_resources: [
      {
        resources: ["assets/viewer.js", "assets/viewer.css", "viewer.html", "sandbox/repl.html", "sandbox/repl.js"],
        matches: ["<all_urls>"],
      },
    ],
    sandbox: {
      pages: ["sandbox/repl.html"],
    },
    content_security_policy: {
      sandbox: "sandbox allow-scripts; script-src 'self' 'unsafe-eval';",
    },
  };

  await writeJson(path.join(dist, "manifest.json"), manifest);
}

await main();

