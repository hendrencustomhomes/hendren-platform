import type { DependencyWriteInput, DependencyNodeRef } from './dependencies'

export function makeDependencyNodeKey(ref: DependencyNodeRef): string {
  return `${ref.type}:${ref.id}`
}

export function dependencyNodeLabel(params: {
  type: 'schedule' | 'procurement'
  id: string
  scheduleItems: { id: string; trade: string }[]
  procurementItems: { id: string; description: string }[]
}): string {
  const { type, id, scheduleItems, procurementItems } = params

  if (type === 'schedule') {
    const row = scheduleItems.find((i) => i.id === id)
    return row ? row.trade : `Schedule ${id}`
  }

  const row = procurementItems.find((i) => i.id === id)
  return row ? row.description : `Procurement ${id}`
}

export function dependencySummaryLabel(
  dep: DependencyWriteInput,
  scheduleItems: { id: string; trade: string }[],
  procurementItems: { id: string; description: string }[]
): string {
  const pred = dependencyNodeLabel({
    type: dep.predecessor.type,
    id: dep.predecessor.id,
    scheduleItems,
    procurementItems,
  })

  const succ = dependencyNodeLabel({
    type: dep.successor.type,
    id: dep.successor.id,
    scheduleItems,
    procurementItems,
  })

  return `${pred} → ${succ}`
}