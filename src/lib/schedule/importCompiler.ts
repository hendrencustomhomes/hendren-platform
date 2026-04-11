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
