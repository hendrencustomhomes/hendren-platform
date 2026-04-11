# Schedule Module — R9 Deliverables

**Date:** 2026-04-11
**Branch:** `dev`
**Files changed:**
- `src/lib/schedule/operations.ts` (new)

---

## A. Full Contents of `src/lib/schedule/operations.ts`

```typescript
import type { DependencyWriteInput, DependencyNodeRef } from './dependencies'

export type InsertBetweenInput = {
  predecessor: DependencyNodeRef
  successor: DependencyNodeRef
  newNode: DependencyNodeRef
}

export type AttachAfterInput = {
  parent: DependencyNodeRef
  newNode: DependencyNodeRef
}

export type AttachBeforeInput = {
  newNode: DependencyNodeRef
  child: DependencyNodeRef
}

export type RemoveNodeReconnectInput = {
  nodeToRemove: DependencyNodeRef
  dependencies: DependencyWriteInput[]
}

function makeNodeKey(ref: DependencyNodeRef): string {
  return `${ref.type}:${ref.id}`
}

export function makeDefaultDependency(
  predecessor: DependencyNodeRef,
  successor: DependencyNodeRef
): DependencyWriteInput {
  return {
    predecessor,
    successor,
    referencePoint: 'end',
    offsetWorkingDays: 0,
  }
}

export function edgeTouchesNode(
  edge: DependencyWriteInput,
  node: DependencyNodeRef
): boolean {
  const key = makeNodeKey(node)
  return (
    makeNodeKey(edge.predecessor) === key || makeNodeKey(edge.successor) === key
  )
}

export function attachNodeAfter(input: AttachAfterInput): DependencyWriteInput[] {
  return [makeDefaultDependency(input.parent, input.newNode)]
}

export function attachNodeBefore(
  input: AttachBeforeInput
): DependencyWriteInput[] {
  return [makeDefaultDependency(input.newNode, input.child)]
}

export function insertNodeBetween(
  input: InsertBetweenInput,
  existingDependencies: DependencyWriteInput[]
): DependencyWriteInput[] {
  const predKey = makeNodeKey(input.predecessor)
  const succKey = makeNodeKey(input.successor)

  const isMatchingEdge = (dep: DependencyWriteInput): boolean =>
    makeNodeKey(dep.predecessor) === predKey &&
    makeNodeKey(dep.successor) === succKey

  const hasMatch = existingDependencies.some(isMatchingEdge)
  if (!hasMatch) {
    throw new Error(
      'Cannot insert between nodes that are not directly connected'
    )
  }

  const kept = existingDependencies.filter((dep) => !isMatchingEdge(dep))

  return [
    ...kept,
    makeDefaultDependency(input.predecessor, input.newNode),
    makeDefaultDependency(input.newNode, input.successor),
  ]
}

export function removeNodeAndReconnect(
  input: RemoveNodeReconnectInput
): DependencyWriteInput[] {
  const { nodeToRemove, dependencies } = input
  const removeKey = makeNodeKey(nodeToRemove)

  const parents: DependencyNodeRef[] = []
  const children: DependencyNodeRef[] = []

  for (const dep of dependencies) {
    if (makeNodeKey(dep.successor) === removeKey) {
      parents.push(dep.predecessor)
    } else if (makeNodeKey(dep.predecessor) === removeKey) {
      children.push(dep.successor)
    }
  }

  const kept = dependencies.filter((dep) => !edgeTouchesNode(dep, nodeToRemove))

  const reconnected: DependencyWriteInput[] = []
  for (const parent of parents) {
    for (const child of children) {
      if (makeNodeKey(parent) === makeNodeKey(child)) continue
      reconnected.push(makeDefaultDependency(parent, child))
    }
  }

  const all = [...kept, ...reconnected]

  const seen = new Set<string>()
  const deduped: DependencyWriteInput[] = []
  for (const edge of all) {
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

## B. Explanation of Each Operation Helper

### `makeDefaultDependency(predecessor, successor)`

The single source-of-truth for default edge semantics. All operation helpers that create new edges call this rather than constructing `DependencyWriteInput` literals. Returns `referencePoint: 'end', offsetWorkingDays: 0`. This ensures every graph edit made through this layer uses consistent defaults that can be changed in one place when the product evolves.

---

### `edgeTouchesNode(edge, node)`

Returns `true` if the given node appears as either the predecessor or successor of the edge. Used inside `removeNodeAndReconnect` to filter out all edges touching the removed node in a single pass. Exported so callers can use the same predicate when scanning dependency lists without re-implementing key comparison.

---

### `attachNodeAfter(input)`

Produces one edge: `parent → newNode` via `makeDefaultDependency`. Does not inspect or modify any existing dependency list — the caller owns the merge. The new node becomes a leaf unless the caller separately adds outgoing edges. No validation; pure.

---

### `attachNodeBefore(input)`

Produces one edge: `newNode → child` via `makeDefaultDependency`. Mirror image of `attachNodeAfter`. The new node becomes a root unless the caller separately adds incoming edges. No validation; pure.

---

### `insertNodeBetween(input, existingDependencies)`

Splices a new node into an existing direct connection between two nodes. Steps:

1. **Match** — identify all edges in `existingDependencies` where `predecessor` and `successor` match the input pair (by key, ignoring `referencePoint` and `offsetWorkingDays`).
2. **Guard** — if no match exists, throw `'Cannot insert between nodes that are not directly connected'`. The caller must verify connectivity before calling.
3. **Remove** — filter out all matching edges.
4. **Add** — append `predecessor → newNode` and `newNode → successor`, both via `makeDefaultDependency`.
5. **Return** — the full updated list: unrelated edges + two new edges.

The returned list is a replacement for `existingDependencies`, not a delta.

---

### `removeNodeAndReconnect(input)`

Removes a node from the graph and bridges the gap. Steps:

1. **Classify** — walk `dependencies` once. Edges where the node is the successor populate `parents`; edges where the node is the predecessor populate `children`.
2. **Filter** — remove all edges touching the node via `edgeTouchesNode`.
3. **Reconnect** — for every (parent, child) pair, emit `makeDefaultDependency(parent, child)`. Skip pairs where parent key === child key (self-loop guard).
4. **Merge** — concatenate kept edges and reconnection edges.
5. **Deduplicate** — by the four-field key (predecessor key, successor key, referencePoint, offsetWorkingDays). First occurrence wins.
6. **Return** — full updated list.

A node that is both a root (no parents) and a leaf (no children) produces zero reconnection edges and its removal simply drops its edges from the list. Nodes that were unrelated to the removed node are completely unaffected.

---

## C. `insertNodeBetween` Behavior When Multiple Matching Edges Exist

**What counts as a match:** two edges with the same predecessor node key and the same successor node key, regardless of `referencePoint` or `offsetWorkingDays`. For example:

```
A → B  (referencePoint: 'start', offsetWorkingDays: 3)
A → B  (referencePoint: 'end',   offsetWorkingDays: 0)
```

Both match an `insertNodeBetween` call with `predecessor = A, successor = B`.

**What happens:** all matching edges are removed by the `filter((dep) => !isMatchingEdge(dep))` call. Then exactly two new edges are added: `A → newNode` and `newNode → B`, both with default semantics.

**Why all matches are removed:** the insert operation replaces the direct connection with a two-hop path through the new node. Keeping any of the original A→B edges alongside the new path would mean A can still constrain B both directly (via the surviving original edge) and indirectly (via newNode). For v1, the intent is to fully sever the direct connection and route everything through the new node. Any custom offset or reference-point semantics on the original edges are lost; the product can encode them again on the new split edges if needed.

**If no match exists:** the function throws `'Cannot insert between nodes that are not directly connected'` rather than silently succeeding. Inserting between two nodes with no direct edge would produce a valid-looking graph but would not have removed anything, which is almost certainly a caller bug. Throwing makes the contract explicit.

---

## D. Assumptions Made

1. **All four helpers return complete dependency lists, not deltas.** `attachNodeAfter` and `attachNodeBefore` return only the new edge(s); the caller is responsible for merging with the existing list. `insertNodeBetween` and `removeNodeAndReconnect` accept the full existing list and return a full replacement. This asymmetry matches natural usage: attach operations are additive and the caller can just spread the result in; remove/insert operations require structural awareness of the existing list.

2. **`insertNodeBetween` matching ignores `referencePoint` and `offsetWorkingDays`.** Two edges are "the same direct connection" if they share predecessor and successor nodes, regardless of semantics. This is intentional: it would be confusing to have a "remove only the `'start'/3` variant but keep the `'end'/0` variant" insert behavior. The whole direct connection is replaced.

3. **`removeNodeAndReconnect` reconnection uses immediate neighbors only.** Parents and children come from a single scan of the provided `dependencies` list — not a transitive traversal. If a chain of excluded/removed nodes is being handled, multi-hop bridging must be done by calling this function multiple times or by using `compileDependenciesForIncludedNodes` from R8 instead.

4. **No self-loop guard on `attachNodeAfter` / `attachNodeBefore`.** These are intentionally minimal. If the caller passes `parent === newNode`, a self-loop edge is returned. The engine's topological sort (R5) will detect and throw on the resulting cycle. Validation is the caller's or the write path's (R7 `validateDependencyInput`) responsibility.

5. **No self-loop guard on `insertNodeBetween`.** If `newNode === predecessor` or `newNode === successor`, the function will produce a self-loop edge. Same reasoning as above — the write path validates node identity.

6. **`makeNodeKey` is private to this file.** It is byte-identical to the private `makeDependencyNodeKey` in `dependencies.ts` and the private `makeNodeKey` in `importCompiler.ts`. The three files intentionally do not share it via export to avoid creating a utility import chain across files that are each independently consumed.

7. **Deduplication key in `removeNodeAndReconnect` includes all four edge fields.** A kept edge with `referencePoint: 'start', offsetWorkingDays: 2` and a reconnection edge with `referencePoint: 'end', offsetWorkingDays: 0` for the same predecessor/successor pair are considered distinct and both survive. This is consistent with R8 behavior.

8. **`dependencies` passed to `removeNodeAndReconnect` is the full job dependency list, not a filtered subset.** The function walks the entire list to find parents and children. If the caller passes a filtered list (e.g., only edges within a subgraph), the reconnection will only see parents/children within that subgraph — which may be intentional for template compilation use cases.

---

## E. Edge Cases Intentionally Deferred

1. **Confirmed-item shift detection.** If a dependency-driven recalculation moves a confirmed labor item's dates after one of these graph edits is applied, the system will need to detect the shift and generate a PM task (`Call ${company_name}`). This belongs in a later impact-detection / persisted-apply phase, not in these pure graph helpers. Explicitly deferred per spec.

2. **Cycle detection.** None of these helpers check whether the resulting graph contains a cycle. `insertNodeBetween` and `removeNodeAndReconnect` both produce structurally valid-looking lists that may still form a cycle (e.g., inserting a node that already has a path back to `predecessor`). The resolver engine (R5 `topologicalSort`) is the point of cycle detection.

3. **Multi-hop reconnect in `removeNodeAndReconnect`.** If a chain of nodes is being removed one-by-one, intermediate calls will not bridge across more than one hop at a time. For bulk removal of a subgraph, `compileDependenciesForIncludedNodes` from R8 is the correct tool.

4. **`insertNodeBetween` with a `newNode` that already exists in the graph.** The function does not check whether `newNode` is already present in `existingDependencies`. If it is, the caller must ensure no existing edges from/to `newNode` conflict with the new insertion edges. No error is thrown; deduplication in the write path (R7) or the DB unique constraint handles exact duplicates.

5. **Multiple edges between the same pair with the same four-field key (true duplicates) in the input to `removeNodeAndReconnect`.** Such edges would both appear in `parents`/`children`, leading to duplicate reconnection candidates, which are then collapsed by deduplication. Result is correct but the input itself is malformed — the write path (R7) and DB constraints should have prevented true duplicates from existing.

6. **`attachNodeAfter` / `attachNodeBefore` merging with the existing list.** These return only the new edge(s). If the caller fails to merge with the existing dependency list before passing to `replaceScheduleDependenciesForJob`, all previous edges are lost. The narrow return type (just the new edge) is intentional — it keeps the helpers minimal and forces the caller to own list assembly.
