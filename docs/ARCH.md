# Architecture

The Heph Documentation KB site is a static, GitHub Pages-hosted knowledge base that publishes the
platform's architecture and platform-stack documents as clean web pages.

## Repository layout

```
heph-documentation-kb/
├── .github/workflows/pages.yml   # GitHub Pages deploy pipeline
├── docs/                         # Repo-level docs (this file, USAGE, SETUP)
├── scripts/
│   ├── build.mjs                 # Static-site generator
│   └── verify-docs.mjs           # Pre-deploy checks
├── site/
│   ├── content/                  # Markdown page sources
│   └── assets/                   # CSS, diagrams, images
├── _site/                        # Generated static site (gitignored)
├── package.json
└── .env.example
```

## Build pipeline

1. `scripts/build.mjs` reads Markdown sources from `site/content/`.
2. Front matter (`title`, `subtitle`, `author`, `date`) is extracted for the page header.
3. Markdown is rendered with GitHub-flavoured Markdown tables and syntax support.
4. Diagram references are rewritten to `assets/images/{architecture,platform}/`.
5. A protected page template is applied (includes `assets/gate.js`).
6. `index.html` (login gate) and `home.html` (landing) are generated.
7. `site/assets/` is copied to `_site/assets/` and `.nojekyll` is written.

## Site structure

### Architecture planes

| Page | Plane |
|------|-------|
| Executive overview | Whole platform |
| Product scope & RM journey pillars | Journey ⇄ architecture handoff |
| Compliance plane | Regulatory + trust boundary |
| Governance plane | Change, catalogue, approvals |
| Tenancy plane | Multi-tenant identity & isolation |
| Data plane | Medallion pipeline & intelligence |
| Capabilities plane | Business capability services |
| Foundational capabilities plane | BFF, gateway, events, secrets |
| Infra-core plane | AWS, IaC, networking, observability |
| ADR compendium | Cross-cutting architecture decisions |

### Platform stack

| Page | Topic |
|------|-------|
| Platform stack overview | Runtime topology, principles, delivery |
| BFF auth trust boundary | Session custody, tenant resolution, mTLS |
| Event-driven backbone | Domain events, schema registry, idempotency |
| Payment journey | Mode A/B settlement and issuance coupling |

## Auth gate

The site is protected by a lightweight client-side gate on every page except the login page.
Credentials are injected at build time from environment variables and stored in session storage after
a successful sign-in. The default credentials are defined in `AGENTS.md` and configurable via `.env`.

## Trust boundary

- The browser holds only a session flag; no tokens or secrets are shipped in the static bundle except
  the gate credentials required for the docs gate.
- Source secrets are never committed; only `.env.example` is tracked.
- Deployment is performed by GitHub Actions with no manual production state.

## Diagrams

Architecture diagrams are copied from `product-definition/architecture-decisions/diagrams/` and
`product-definition/platform-stack/diagrams/` into `_site/assets/images/`. The originals remain the
source of truth; only rendered PNG/SVG assets are published.
