# Schedule Module — R8 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/importCompiler.ts` (new)

---

## A. Full Contents of `src/lib/schedule/importCompiler.ts`

```typescript
import type { DependencyWriteInput, DependencyNodeRef } from './dependencies'

export type DependencyGraphInput = {
  nodes: DependencyNodeRef[]
  dependencies: DependencyWriteInput[]
}

export type CompileDependenciesInput = {
  nodes: DependencyNodeRef[]
  dependencies: DependencyWriteInput[]
  includedNodeKeys: string[]
}

function makeNodeKey(ref: DependencyNodeRef): string {
  return `${ref.type}:${ref.id}`
}

export function filterIncludedNodes(
  nodes: DependencyNodeRef[],
  includedNodeKeys: string[]
): DependencyNodeRef[] {
  const includedSet = new Set(includedNodeKeys)
  return nodes.filter((node) => includedSet.has(makeNodeKey(node)))
}

export function compileDependenciesForIncludedNodes(
  input: CompileDependenciesInput
): DependencyWriteInput[] {
  const { nodes, dependencies, includedNodeKeys } = input

  // Step A — Build included set
  const includedSet = new Set(includedNodeKeys)

  // Step C — Build parent/child maps from original dependencies
  // parents[key]: deps where this node is the successor (i.e. its incoming edges)
  // children[key]: deps where this node is the predecessor (i.e. its outgoing edges)
  const parents: Record<string, DependencyWriteInput[]> = {}
  const children: Record<string, DependencyWriteInput[]> = {}

  for (const node of nodes) {
    const key = makeNodeKey(node)
    parents[key] = []
    children[key] = []
  }

  for (const dep of dependencies) {
    const predKey = makeNodeKey(dep.predecessor)
    const succKey = makeNodeKey(dep.successor)
    if (children[predKey]) children[predKey].push(dep)
    if (parents[succKey]) parents[succKey].push(dep)
  }

  const resultEdges: DependencyWriteInput[] = []

  // Step F — Preserve original included-to-included edges as-is
  for (const dep of dependencies) {
    const predKey = makeNodeKey(dep.predecessor)
    const succKey = makeNodeKey(dep.successor)
    if (includedSet.has(predKey) && includedSet.has(succKey)) {
      resultEdges.push(dep)
    }
  }

  // Steps D + E — For each excluded node, reconnect its parents to its children.
  // Only emit the reconnection edge when both the parent and child are included.
  for (const node of nodes) {
    const key = makeNodeKey(node)
    if (includedSet.has(key)) continue

    const nodePredecessors = (parents[key] ?? []).map((dep) => dep.predecessor)
    const nodeSuccessors = (children[key] ?? []).map((dep) => dep.successor)

    for (const pred of nodePredecessors) {
      for (const succ of nodeSuccessors) {
        const predKey = makeNodeKey(pred)
        const succKey = makeNodeKey(succ)

        if (predKey === succKey) continue
        if (!includedSet.has(predKey) || !includedSet.has(succKey)) continue

        resultEdges.push({
          predecessor: pred,
          successor: succ,
          referencePoint: 'end',
          offsetWorkingDays: 0,
        })
      }
    }
  }

  // Step G — Deduplicate by all four edge fields
  const seen = new Set<string>()
  const deduped: DependencyWriteInput[] = []

  for (const edge of resultEdges) {
    const edgeKey = [
      makeNodeKey(edge.predecessor),
      makeNodeKey(edge.successor),
      edge.referencePoint,
      edge.offsetWorkingDays,
    ].join('|')

    if (!seen.has(edgeKey)) {
      seen.add(edgeKey)
      deduped.push(edge)
    }
  }

  return deduped
}
```

---

## B. Explanation of Reconnection Logic

The compiler uses a single-pass, immediate-neighbor reconnection strategy — not transitive closure.

**Graph maps built first.** Before any reconnection, two maps are built from the original dependency list:
- `parents[key]` — all `DependencyWriteInput` entries where `key` is the successor (incoming edges)
- `children[key]` — all `DependencyWriteInput` entries where `key` is the predecessor (outgoing edges)

These are keyed on `${type}:${id}` strings matching the node key format from `dependencies.ts`.

**Reconnection per excluded node.** For each node not in `includedSet`:
1. Collect its immediate predecessors: `parents[key].map(dep => dep.predecessor)`
2. Collect its immediate successors: `children[key].map(dep => dep.successor)`
3. Emit a new edge for every (predecessor, successor) pair

**Guard conditions on each emitted reconnection edge:**
- `predKey !== succKey` — prevents self-loops when a node is its own grandparent through the excluded node
- Both `predKey` and `succKey` must be in `includedSet` — a reconnection edge that still touches an excluded node is dropped immediately rather than accumulated for a second pass

**New edge semantics are fixed at `referencePoint: 'end', offsetWorkingDays: 0`.** The original edge semantics are not propagated through the removed node because combining two half-hops (predecessor→removed, removed→successor) into a single semantically correct edge requires merging reference points and offsets, which is explicitly deferred to a future round.

**Original included-to-included edges are preserved verbatim.** Their `referencePoint` and `offsetWorkingDays` are not altered. Reconnection edges are additive — they can coexist with original edges between the same pair of nodes (both survive deduplication if they differ in any of the four key fields).

**Deduplication uses all four fields**: predecessor key, successor key, referencePoint, and offsetWorkingDays. This means an original edge `A→C` with `referencePoint: 'start', offset: 2` and a reconnection edge `A→C` with `referencePoint: 'end', offset: 0` both survive — they are semantically distinct constraints.

---

## C. Example: Removed Middle Node

### Setup

```
Nodes: A, B, C
Edges: A → B (referencePoint: 'end', offsetWorkingDays: 1)
       B → C (referencePoint: 'start', offsetWorkingDays: 0)
Excluded: B
Included: A, C
```

### Walk-through

**Step F — preserve original included→included edges:**
- `A→B`: B is excluded → skip
- `B→C`: B is excluded → skip
- Nothing preserved from originals.

**Step D/E — process excluded node B:**
- `parents['schedule:B']` = [A→B dep] → predecessors = [A]
- `children['schedule:B']` = [B→C dep] → successors = [C]
- Emit A→C with `referencePoint: 'end', offsetWorkingDays: 0`
- Both A and C are included → edge kept

**Step G — deduplicate:**
- One unique edge: A→C

**Result:**
```
A → C  (referencePoint: 'end', offsetWorkingDays: 0)
```

The original offset of 1 day and the original reference point of B→C (`'start'`) are both discarded. C starts at A's end with no offset. The offset semantics cannot be correctly forwarded through the hop without a product decision on how to combine them.

---

### Diamond example (two paths through one excluded node)

```
Nodes: A, B, C, D
Edges: A→B, A→C, B→D, C→D
Excluded: B, C
Included: A, D
```

Processing B: parents={A}, children={D} → emit A→D
Processing C: parents={A}, children={D} → emit A→D (duplicate)

After dedup: one edge A→D.

**Result:** `A → D (end, 0)` — both paths collapse to a single edge.

---

### Chain removal (multi-hop limitation)

```
Nodes: A, B, C, D
Edges: A→B, B→C, C→D
Excluded: B, C
Included: A, D
```

Processing B: parents={A} (included), children={C} (excluded) → emits A→C but C is excluded → dropped
Processing C: parents={B} (excluded), children={D} (included) → emits B→D but B is excluded → dropped

**Result:** empty — A and D are not connected.

This is the single-hop limitation. Multi-hop chain bridging (finding the full included ancestors/descendants through transitive traversal) is deferred per spec.

---

## D. Assumptions Made

1. **Reconnection edges use `referencePoint: 'end', offsetWorkingDays: 0` unconditionally.** The original edges on either side of the removed node may have had different reference points and non-zero offsets. These are not combined or forwarded. This is the stated R8 simplification.

2. **Reconnection is single-pass, not transitive.** For each excluded node, only its immediate predecessors and immediate successors (from the original graph) are considered. If both a node and its neighbor are excluded, the bridge between the remaining included nodes may be lost (the chain removal case above). Transitive closure — finding the nearest included ancestors and descendants through chains of excluded nodes — is deferred.

3. **`nodes` list is the source of truth for graph map initialization.** The `parents` and `children` maps are seeded from `nodes`, not from the dependency list. A dependency referencing a node key not present in `nodes` is silently skipped when building the maps (the `if (children[predKey])` / `if (parents[succKey])` guards). This is consistent with the engine's dangling-edge behavior from R5.

4. **Node order in `nodes` determines reconnection iteration order.** For each excluded node, reconnection edges are generated in the order the node appears in `nodes`. The first-seen order is also what the deduplication preserves (first occurrence wins). No sort by key or type is applied.

5. **`filterIncludedNodes` returns `DependencyNodeRef` objects from the original `nodes` array.** It does not reconstruct refs from `includedNodeKeys`. If a key appears in `includedNodeKeys` but not in `nodes`, it is silently absent from the result — no error.

6. **No cycle detection.** The input dependencies may form a cycle and the compiler will still run. Reconnection around an excluded node in a cycle will produce a new edge that may or may not itself form a cycle. Cycle detection is the resolver engine's responsibility (R5), not this compiler's.

7. **Deduplication key includes `offsetWorkingDays`.** If the same predecessor→successor pair appears twice with different offsets (e.g., one from an original edge at offset 2, one from reconnection at offset 0), both survive deduplication. The caller or the resolver will see both constraints; MAX semantics in the engine mean the later-start wins.

---

## E. Edge Cases Intentionally Deferred

1. **Multi-hop chain bridging.** When two or more consecutive nodes are excluded, the bridge from the first included ancestor to the first included descendant is lost. Implementing this correctly requires a BFS/DFS through excluded nodes to find the nearest included endpoints at each end of the excluded subgraph.

2. **Offset forwarding through removed nodes.** If A→B has `offset: 2` and B→C has `offset: 1`, removing B and generating A→C with `offset: 0` changes the semantics. Correct forwarding would require summing offsets and resolving reference-point compatibility (`'start'` vs `'end'`), which requires product input on intended behavior.

3. **Multiple reconnection edges between the same pair with mixed semantics.** The dedup key includes `referencePoint` and `offsetWorkingDays`, so a pair can have two surviving edges if they differ in those fields (e.g., one original `start/2` and one reconnection `end/0`). The engine's MAX behavior treats them as independent constraints. Whether this is correct for the product is unverified.

4. **Excluded nodes with no edges.** Isolated excluded nodes (no parents, no children) produce no reconnection edges. This is correct behavior — the `for (pred of nodePredecessors)` loop body is never entered when `nodePredecessors` is empty.

5. **Nodes present in `includedNodeKeys` but absent from `nodes`.** `filterIncludedNodes` silently omits them. `compileDependenciesForIncludedNodes` never encounters them because the included set is only tested against keys derived from `nodes` and `dependencies`. No error or warning is produced.

6. **Self-loops in the original dependency list.** A dep where `predecessor === successor` would add to both `parents[key]` and `children[key]` for the same excluded node, making the node appear in its own predecessor and successor lists. The `predKey !== succKey` guard would catch it and skip the reconnection edge. However, if the node is included, the original self-loop edge would survive Step F unchanged. The resolver engine is responsible for handling self-loops (it throws on cycles).
