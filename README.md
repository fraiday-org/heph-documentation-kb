# Heph Documentation KB

Central GitHub Pages documentation gateway for the Heph RM Native Digital embedded-insurance platform.

## What is here

This repository builds a clean, static documentation site from the product-definition architecture and
platform-stack docs. It is the canonical knowledge base for the platform: every architecture plane, the
RM journey, the ADRs, and the runtime platform-stack deep dives are published as web pages.

## Published site

- URL: `https://<org>.github.io/heph-documentation-kb/`
- Branch: `main`
- Auth gate: username `fraiday-ai`, password `fraiday2026` (configure via `.env` / GitHub Secrets)

## Local development

```bash
cp .env.example .env          # optional; defaults are provided for local dev
npm install
npm run build                 # generates _site/
npm test                      # builds, checks required pages, links, and forbidden files
```

Open `_site/index.html` in a browser and sign in with the credentials above.

## Site structure

| Page | Source |
|------|--------|
| Executive overview | `site/content/executive-overview.md` |
| Product scope & RM journey pillars | `site/content/product-scope.md` |
| Compliance plane | `site/content/compliance-plane.md` |
| Governance plane | `site/content/governance-plane.md` |
| Tenancy plane | `site/content/tenancy-plane.md` |
| Data plane | `site/content/data-plane.md` |
| Capabilities plane | `site/content/capabilities-plane.md` |
| Foundational capabilities plane | `site/content/foundational-capabilities-plane.md` |
| Infra-core plane | `site/content/infra-core-plane.md` |
| ADR compendium | `site/content/adr-compendium.md` |
| Platform stack overview | `site/content/platform-stack-overview.md` |
| BFF auth trust boundary | `site/content/bff-auth-trust-boundary.md` |
| Event-driven backbone | `site/content/event-driven-backbone.md` |
| Payment journey | `site/content/payment-journey.md` |
| Setup / Usage | `site/content/setup.md`, `site/content/usage.md` |

Static assets (styles, diagrams) live in `site/assets/` and are copied into `_site/assets/` at build time.

## Build & verification

- `npm run build` — Node-based static-site generator (`scripts/build.mjs`)
- `npm test` — `scripts/verify-docs.mjs` checks that required pages exist, internal links are not broken,
  and no forbidden files (`.env`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `.claude/`, etc.) are committed.

## Deployment

`.github/workflows/pages.yml` builds and deploys `_site/` to GitHub Pages on every push to `main`.

## Secret safety

Use `.env` locally. Never commit credentials, local agent files, or MCP configuration. Only `.env.example`
is kept in the repo. The auth credentials used by the client-side gate are injected at build time from
`DOCS_AUTH_USERNAME` / `DOCS_AUTH_PASSWORD`; for CI they should be set as repository secrets.

## Branching & commits

- Default/production branch: `main`
- Commit format: `feat|fix|patch : message`
