import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "_site");

const requiredPages = [
  "index.html",
  "home.html",
  "onboard-new-insurer.html",
  "enable-a-product.html",
  "embedded-discovery-payments-journey.html",
  "executive-overview.html",
  "product-scope.html",
  "compliance-plane.html",
  "governance-plane.html",
  "tenancy-plane.html",
  "data-plane.html",
  "capabilities-plane.html",
  "foundational-capabilities-plane.html",
  "infra-core-plane.html",
  "adr-compendium.html",
  "platform-stack-overview.html",
  "bff-auth-trust-boundary.html",
  "event-driven-backbone.html",
  "payment-journey.html",
  "setup.html",
  "usage.html",
];

const forbiddenPatterns = [
  /^\.env$/,
  /^\.env\.(?!example$)/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^\.mcp\.json$/,
  /\.claude\//,
  /\.DS_Store/,
];

function isExternal(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkInternalLinks() {
  const files = await fs.readdir(outDir, { recursive: true });
  const htmlFiles = files.filter((f) => f.endsWith(".html"));
  const broken = [];

  for (const rel of htmlFiles) {
    const filePath = path.join(outDir, rel);
    const html = await fs.readFile(filePath, "utf8");
    const baseDir = path.dirname(filePath);

    const hrefs = [...html.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1]);
    const srcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);

    for (const raw of [...hrefs, ...srcs]) {
      if (isExternal(raw)) continue;
      const [target, hash] = raw.split("#");
      if (!target) continue;
      if (target.endsWith(".md")) {
        broken.push(`${rel}: links to markdown source ${raw}`);
        continue;
      }
      const resolved = path.resolve(baseDir, target);
      if (!resolved.startsWith(outDir)) {
        broken.push(`${rel}: link escapes output root ${raw}`);
        continue;
      }
      if (!(await exists(resolved))) {
        broken.push(`${rel}: broken link ${raw}`);
      }
    }
  }

  if (broken.length) {
    throw new Error(`Broken internal links found:\n${broken.join("\n")}`);
  }
  console.log(`  ✓ internal links OK (${htmlFiles.length} pages checked)`);
}

async function checkRequiredPages() {
  const missing = [];
  for (const p of requiredPages) {
    if (!(await exists(path.join(outDir, p)))) missing.push(p);
  }
  if (missing.length) {
    throw new Error(`Missing required pages: ${missing.join(", ")}`);
  }
  console.log(`  ✓ all ${requiredPages.length} required pages present`);
}

function checkForbiddenFiles() {
  let tracked;
  try {
    tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    console.log("  ⚠ not a git repository; skipping forbidden-file commit check");
    return;
  }
  const forbidden = tracked.filter((f) => forbiddenPatterns.some((pat) => pat.test(f)));
  if (forbidden.length) {
    throw new Error(`Forbidden files committed:\n${forbidden.join("\n")}`);
  }
  console.log(`  ✓ no forbidden files committed (${tracked.length} tracked files checked)`);
}

async function main() {
  console.log("Building site before verification...");
  execSync("npm run build", { cwd: root, stdio: "inherit" });

  console.log("\nVerifying documentation KB...");
  await checkRequiredPages();
  await checkInternalLinks();
  checkForbiddenFiles();
  console.log("\nDocumentation KB verified.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
