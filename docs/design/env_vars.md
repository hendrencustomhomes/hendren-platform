# Environment Variable Inventory
# Audited: 2026-04-18

## Required Variables

| Variable | Side | Used In |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | `src/utils/supabase/client.ts`, `middleware.ts`, `server.ts`, `admin.ts`; `src/lib/supabase/server.ts`, `admin.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + Server | `src/utils/supabase/client.ts`, `middleware.ts`, `server.ts`; `src/lib/supabase/server.ts` |
| `SUPABASE_SECRET_KEY` | Server only | `src/utils/supabase/admin.ts`, `src/lib/supabase/admin.ts` — admin client for user management |
| `NEXT_PUBLIC_SITE_URL` | Server only | `src/app/login/actions.ts` — builds `redirectTo` URL for auth email links; falls back to `https://hendren-platform.vercel.app` if unset |

## Stale Staging References

Deleted staging project `bduokhmbblxgxgzppluf` — not found in any source file. Clean.

Production project ref `oiyujpkqfbqmjyxefwbj` appears only in `decisions.md` as documentation. No action needed.

## Auth Redirect URLs — Manual Action Required

`src/app/login/actions.ts` builds this URL at runtime:

```
${NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password
```

### Supabase Dashboard → Authentication → URL Configuration

- **Site URL**: `https://hendren-platform.vercel.app`
- **Redirect allow list**: `https://hendren-platform.vercel.app/auth/confirm`

### Vercel Dashboard — Environment Variables

All three required vars must be set for Production environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

`NEXT_PUBLIC_SITE_URL` is optional for Production (hardcoded fallback matches) but required for Preview deployments to avoid broken auth redirect URLs.

## No GitHub Secrets Needed

No GitHub Actions workflows reference Supabase. The deleted `SUPABASE_STAGING_PROJECT_ID` and `SUPABASE_STAGING_DB_PASSWORD` secrets can be removed from GitHub → Settings → Secrets if still present.
