# Hendren Platform

Internal field operations platform for Hendren Custom Homes. Covers job management, scheduling, takeoff, pricing, and procurement. Currently in internal testing.

## Stack

Next.js 16 · Supabase (Postgres + Auth + Storage) · Vercel · TypeScript

Full stack decisions and team context: [`docs/decisions.md`](docs/decisions.md)

## Running locally

1. Copy required environment variables — see [`docs/env_vars.md`](docs/env_vars.md)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

App runs at `http://localhost:3000`.

## Repo structure

```
src/app/        route files
src/components/ shared UI
src/lib/        shared domain logic
docs/           project and module documentation
```

Full file tree: [`docs/design/repo_tree`](docs/design/repo_tree)  
Module structure standard: [`docs/design/module_structure`](docs/design/module_structure)

## Branch workflow

- `dev` is the canonical branch — all work lands here
- `main` reflects production; merged from dev at release
- Never push directly to `main`
