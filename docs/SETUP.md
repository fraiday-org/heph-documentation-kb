# Setup

## Prerequisites

- Node.js 22+
- npm 10+
- Git
- `gh` CLI configured for `arya-dev-rishabh`

## Environment

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env
```

Editable variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `DOCS_AUTH_USERNAME` | Docs gate username | `fraiday-ai` |
| `DOCS_AUTH_PASSWORD` | Docs gate password | `fraiday2026` |
| `NODE_ENV` | Node environment | `development` |

## Install dependencies

```bash
npm install
```

## Build and verify

```bash
npm run build   # outputs _site/
npm test        # builds + runs all checks
```

## Git conventions

- Default/production branch: `main`
- Commit format: `feat|fix|patch : message`
- Never commit `.env`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, or `.claude/`.

## GitHub Pages enablement

1. In the repository settings, set **Pages** source to **GitHub Actions**.
2. Add `DOCS_AUTH_USERNAME` and `DOCS_AUTH_PASSWORD` as repository secrets if you want CI to inject
   non-default credentials.
3. Push to `main`; the workflow in `.github/workflows/pages.yml` deploys the site.

## Troubleshooting

- **Broken internal links** — verify the source Markdown uses relative links or filenames that exist in
  `_site/assets/images/`.
- **Forbidden files committed** — run `git rm --cached <file>` and update `.gitignore` if needed.
- **Build outputs are huge** — ensure `_site/`, `node_modules/`, and `dist/` are listed in `.gitignore`.
