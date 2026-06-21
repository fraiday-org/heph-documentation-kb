# Usage

## Local preview

```bash
cd /Users/rishabharya/Desktop/heph-workspace/github/heph-documentation-kb
cp .env.example .env   # optional
npm install
npm run build
```

Then open `_site/index.html` in a browser. Sign in with the credentials configured in `.env`
(`DOCS_AUTH_USERNAME` / `DOCS_AUTH_PASSWORD`), or the defaults documented in `AGENTS.md`.

## Running verification

```bash
npm test
```

`scripts/verify-docs.mjs` will:

1. Run `npm run build`.
2. Check that all required pages exist in `_site/`.
3. Crawl every generated HTML page for broken internal links and images.
4. Ensure no forbidden files (`.env`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `.claude/`, `.DS_Store`) are
   committed in Git.

## Updating content

1. Edit the relevant Markdown file under `site/content/`.
2. Add or replace diagrams under `site/assets/images/` if needed.
3. Run `npm test` to verify.
4. Commit with a clean message: `feat : update compliance plane docs`.

## Deploying

Push to `main`. `.github/workflows/pages.yml` builds `_site/` and deploys it to GitHub Pages.

```bash
git add .
git commit -m "feat : refresh architecture knowledge base"
git push origin main
```

## Auth credentials

For local builds the gate reads from `.env`. For CI builds the workflow reads from repository secrets:

- `DOCS_AUTH_USERNAME`
- `DOCS_AUTH_PASSWORD`

If the secrets are absent, the build falls back to the default credentials so the site still renders.
