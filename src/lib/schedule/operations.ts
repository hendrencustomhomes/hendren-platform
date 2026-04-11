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
