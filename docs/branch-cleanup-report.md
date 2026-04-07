# Branch Cleanup Report

**Date:** 2026-04-07
**Performed by:** Claude Code
**Base branch:** dev

---

## Summary

A scan of all `claude/*` branches was performed to identify stale branches with zero unique commits relative to `dev`. No branches were deleted — all three branches found contain unique commits and require manual review.

---

## Branches Found

| Branch | Location | Unique Commits vs dev | Action |
|--------|----------|-----------------------|--------|
| `claude/audit-reconcile-dev-5piyN` | local only | 51 | KEEP — manual review |
| `claude/fix-create-flows-wSrjp` | remote only | 52 | KEEP — manual review |
| `claude/fix-jobs-address-schema-IAMTE` | remote only | 52 | KEEP — manual review |

---

## Deleted Branches

None. No branches were deleted.

---

## Kept Branches (Manual Review Required)

### `claude/audit-reconcile-dev-5piyN` (local only)
- **Unique commits:** 51
- **Reason kept:** Contains 51 commits not present in dev, including work on job info tabs, FilesTab, Supabase helpers, and foundational scaffolding.
- **Top unique commit:** `e0c3e3f feat: job info tab with read-only UI and scope editing`
- **Note:** Remote was already pruned (deleted from origin before this run). Local ref still exists.

### `claude/fix-create-flows-wSrjp` (remote only)
- **Unique commits:** 52
- **Reason kept:** Contains 52 commits not in dev, including `b7d5dbe Fix procurement/schedule create flows and add task create` plus all prior work.
- **Top unique commit:** `b7d5dbe Fix procurement/schedule create flows and add task create`

### `claude/fix-jobs-address-schema-IAMTE` (remote only)
- **Unique commits:** 52
- **Reason kept:** Contains 52 commits not in dev, including `bc7d989 fix: rename jobs.address to jobs.project_address throughout repo` plus all prior work.
- **Top unique commit:** `bc7d989 fix: rename jobs.address to jobs.project_address throughout repo`

---

## dev Branch Status

`dev` is confirmed as the current working branch and single source of truth. Its tip at time of this report:

```
f621a9c docs: add branch reconciliation report for 2026-04-07 audit
b06fbf7 chore: allow outbound network access to Supabase and Vercel in sandbox
f12bd6f chore: gitignore Claude local settings file
b2bb7e1 chore: verify repo connection write access
6ba5a6b Add launch execution plan phased from backlog
```

No branch switching occurred during this cleanup run.

---

## Recommended Next Steps

The three kept branches all diverge significantly from `dev` and appear to contain feature/fix work that was never merged. A human should review each branch and decide whether to:

1. **Merge** the work into `dev` (if still relevant)
2. **Cherry-pick** specific commits from each branch
3. **Delete** manually after confirming the work is superseded or unwanted
