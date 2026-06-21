import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const contentDir = path.join(root, "site", "content");
const assetsDir = path.join(root, "site", "assets");
const outDir = path.join(root, "_site");

marked.setOptions({
  gfm: true,
  headerIds: true,
});

const pages = [
  { slug: "executive-overview", label: "Executive Overview", group: "Architecture" },
  { slug: "product-scope", label: "Product Scope & RM Journey", group: "Architecture" },
  { slug: "compliance-plane", label: "Compliance Plane", group: "Architecture" },
  { slug: "governance-plane", label: "Governance Plane", group: "Architecture" },
  { slug: "tenancy-plane", label: "Tenancy Plane", group: "Architecture" },
  { slug: "data-plane", label: "Data Plane", group: "Architecture" },
  { slug: "capabilities-plane", label: "Capabilities Plane", group: "Architecture" },
  { slug: "foundational-capabilities-plane", label: "Foundational Capabilities", group: "Architecture" },
  { slug: "infra-core-plane", label: "Infra-Core Plane", group: "Architecture" },
  { slug: "adr-compendium", label: "ADR Compendium", group: "Architecture" },
  { slug: "platform-stack-overview", label: "Platform Stack Overview", group: "Platform Stack" },
  { slug: "bff-auth-trust-boundary", label: "BFF Auth Trust Boundary", group: "Platform Stack" },
  { slug: "event-driven-backbone", label: "Event-Driven Backbone", group: "Platform Stack" },
  { slug: "payment-journey", label: "Payment Journey", group: "Platform Stack" },
  { slug: "onboard-new-insurer", label: "How do I onboard a new insurer?", group: "How-To", description: "Register an insurer, run live contract tests against the sandbox, and approve." },
  { slug: "enable-a-product", label: "How do I enable a product?", group: "How-To", description: "Add a product to an insurer's catalogue and publish it to a tenant." },
  { slug: "embedded-discovery-payments-journey", label: "Embedded Discovery → Payments Journey", group: "How-To", description: "The RM-native discovery, quote, proposal, consent, payment and issuance flow." },
  { slug: "setup", label: "Setup", group: "Runbook" },
  { slug: "usage", label: "Usage", group: "Runbook" },
  { slug: "architecture", label: "Architecture", group: "Runbook" },
];

const groupOrder = ["How-To", "Architecture", "Platform Stack", "Runbook"];

const username = process.env.DOCS_AUTH_USERNAME || "fraiday-ai";
const password = process.env.DOCS_AUTH_PASSWORD || "fraiday2026";

function parseFrontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: source };
  const raw = match[1];
  const meta = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    meta[key] = value;
  }
  return { meta, body: source.slice(match[0].length).trim() };
}

function cleanMarkdown(body) {
  return body
    .replace(/\\newpage/g, "")
    .replace(/\{[^}]*\}/g, "");
}

function firstH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}

function renderNav(activeSlug) {
  const grouped = groupBy(pages, "group");
  const parts = [];
  for (const g of groupOrder) {
    const items = grouped[g];
    if (!items) continue;
    const list = items
      .map(
        (p) =>
          `<li><a class="${p.slug === activeSlug ? "active" : ""}" href="${p.slug}.html">${p.label}</a></li>`
      )
      .join("");
    parts.push(`<div class="nav-group"><div class="nav-group-title">${g}</div><ul class="nav-list">${list}</ul></div>`);
  }
  return parts.join("");
}

function pageTemplate({ title, subtitle, meta, content, activeSlug, protectedPage }) {
  const nav = renderNav(activeSlug);
  const gateScript = protectedPage ? '<script src="assets/gate.js"></script>' : "";
  const metaLine = meta.author && meta.date ? `<div class="page-meta">${meta.author} · ${meta.date}</div>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Heph Docs</title>
  <link rel="stylesheet" href="assets/style.css" />
  ${gateScript}
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="home.html"><span class="brand-mark"></span> Heph Documentation KB</a>
      <button class="nav-toggle" aria-label="Toggle navigation" onclick="document.querySelector('.sidebar').classList.toggle('open')">Menu</button>
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">${nav}</aside>
    <main>
      <article class="page">
        <header class="page-header">
          <h1>${title}</h1>
          ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
          ${metaLine}
        </header>
        <div class="content">${content}</div>
      </article>
    </main>
  </div>
  <footer class="site-footer">© 2026 Heph Platform · RM Native Digital embedded-insurance knowledge base</footer>
</body>
</html>`;
}

function rewriteImages(html, page) {
  const dir = page.group === "Platform Stack" ? "assets/images/platform" : "assets/images/architecture";
  return html.replace(/<img([^>]*)src="([^"]+)"([^>]*)>/g, (match, before, src, after) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("/")) return match;
    const fileName = path.basename(src);
    return `<img${before}src="${dir}/${fileName}"${after}>`;
  });
}

async function copyAssets() {
  await fs.mkdir(path.join(outDir, "assets"), { recursive: true });
  await fs.cp(assetsDir, path.join(outDir, "assets"), { recursive: true, force: true });
}

async function writeGateScript() {
  const script = `(function () {
  if (!sessionStorage.getItem("heph_auth")) {
    window.location.replace("index.html");
  }
})();`;
  await fs.writeFile(path.join(outDir, "assets", "gate.js"), script, "utf8");
}

function renderHome() {
  const grouped = groupBy(pages, "group");
  const sections = [];
  for (const g of groupOrder) {
    const items = grouped[g];
    if (!items) continue;
    const cards = items
      .map(
        (p) =>
          `<a class="card" href="${p.slug}.html"><h3>${p.label}</h3><p>${p.description || "Read the " + p.label + " documentation."}</p></a>`
      )
      .join("");
    sections.push(`<h2>${g}</h2><div class="card-grid">${cards}</div>`);
  }
  const content = `
    <section class="hero">
      <h1>RM Native Digital Knowledge Base</h1>
      <p>Canonical documentation for the Heph embedded-insurance platform — architecture, platform stack, and runbooks for engineers, product, and operations.</p>
    </section>
    ${sections.join("")}
  `;
  return pageTemplate({
    title: "Home",
    subtitle: "",
    meta: {},
    content,
    activeSlug: null,
    protectedPage: true,
  });
}

function renderLogin() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Heph Docs — Sign in</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body class="login-body">
  <div class="login-panel">
    <h1>Heph Documentation KB</h1>
    <p>Enter the credentials shared with your team to access the platform docs.</p>
    <form id="gate-form">
      <div class="field"><label for="username">Username</label><input id="username" type="text" autocomplete="username" required /></div>
      <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required /></div>
      <button class="btn" type="submit">Sign in</button>
      <div class="error" id="gate-error"></div>
    </form>
  </div>
  <script>
    (function () {
      var expectedUser = ${JSON.stringify(username)};
      var expectedPass = ${JSON.stringify(password)};
      document.getElementById("gate-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var u = document.getElementById("username").value.trim();
        var p = document.getElementById("password").value;
        if (u === expectedUser && p === expectedPass) {
          sessionStorage.setItem("heph_auth", "1");
          window.location.replace("home.html");
        } else {
          document.getElementById("gate-error").textContent = "Invalid credentials.";
        }
      });
    })();
  </script>
</body>
</html>`;
}

async function build() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await copyAssets();
  await writeGateScript();

  for (const page of pages) {
    const sourcePath = path.join(contentDir, `${page.slug}.md`);
    let source;
    try {
      source = await fs.readFile(sourcePath, "utf8");
    } catch (err) {
      throw new Error(`Missing source file for ${page.slug}: ${sourcePath}`);
    }
    const { meta, body } = parseFrontMatter(source);
    const cleaned = cleanMarkdown(body);
    let html = marked.parse(cleaned);
    html = rewriteImages(html, page);
    const title = meta.title || firstH1(html) || page.label;
    const subtitle = meta.subtitle || "";
    const pageHtml = pageTemplate({
      title,
      subtitle,
      meta,
      content: html,
      activeSlug: page.slug,
      protectedPage: true,
    });
    await fs.writeFile(path.join(outDir, `${page.slug}.html`), pageHtml, "utf8");
  }

  await fs.writeFile(path.join(outDir, "home.html"), renderHome(), "utf8");
  await fs.writeFile(path.join(outDir, "index.html"), renderLogin(), "utf8");
  await fs.writeFile(path.join(outDir, ".nojekyll"), "", "utf8");

  console.log(`Built site to ${outDir} (${pages.length + 2} pages)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
