'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type {
  JobSubSchedule,
  ProcurementItem,
  ScheduleItemDependency,
} from '@/lib/db'
import { getOrderRiskLevel, getScheduleRiskLevel } from '@/lib/db'
import type { DependencyWriteInput, DependencyNodeRef } from '@/lib/schedule/dependencies'
import { replaceScheduleDependenciesForJob } from '@/lib/schedule/dependencies'
import {
  attachNodeAfter,
  attachNodeBefore,
  insertNodeBetween,
  removeNodeAndReconnect,
} from '@/lib/schedule/operations'
import { resolveScheduleGraph } from '@/lib/schedule/engine'
import { buildScheduleNodes } from '@/lib/schedule/nodes'
import { activateBaselineAction, saveScheduleDraftAction } from './actions'
import type { DraftScheduleItemUpdate } from './actions'
import {
  enterScheduleEditPresenceAction,
  exitScheduleEditPresenceAction,
  refreshScheduleEditPresenceAction,
} from './presenceActions'

type ScheduleDraftOverride = {
  start_date: string | null
  duration_working_days: number | null
  include_saturday: boolean
  include_sunday: boolean
  buffer_working_days: number
  shift_reason_type: string | null
  shift_reason_note: string | null
  shift_dependencies: boolean
  old_start_date: string | null
}

const SHIFT_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— No reason' },
  { value: 'weather', label: 'Weather' },
  { value: 'owner_change', label: 'Owner change' },
  { value: 'material_delay', label: 'Material delay' },
  { value: 'trade_availability', label: 'Trade availability' },
  { value: 'mis_entry', label: 'Mis-entry' },
  { value: 'other', label: 'Other' },
]

type Props = {
  jobId: string
  jobClientName: string | null
  jobColor: string | null
  scheduleItems: JobSubSchedule[]
  procurementItems: ProcurementItem[]
  dependencies: ScheduleItemDependency[]
  baselineStatus: boolean | null
}

const STATUS_COLORS: Record<string, string> = {
  tentative: '#b45309',
  scheduled: '#2563eb',
  confirmed: '#16a34a',
  on_site: '#2563eb',
  complete: '#888',
  cancelled: '#dc2626',
  Pending: '#b45309',
  Ordered: '#2563eb',
  Confirmed: '#16a34a',
  Delivered: '#888',
  'Will Call': '#7c3aed',
  Issue: '#dc2626',
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function pageCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    overflowX: 'auto' as const,
  }
}

function thStyle() {
  return {
    textAlign: 'left' as const,
    fontSize: '12px',
    color: 'var(--text-muted)',
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    fontFamily: 'ui-monospace,monospace',
  }
}

function tdStyle() {
  return {
    padding: '12px 8px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top' as const,
    fontSize: '14px',
  }
}

function badgeStyle(color?: string, muted = false) {
  return {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600 as const,
    whiteSpace: 'nowrap' as const,
    color: muted ? 'var(--text-muted)' : '#fff',
    background: muted ? 'var(--bg)' : color || '#666',
    border: muted ? '1px solid var(--border)' : 'none',
  }
}

function resolvedHint(storedDate: string | null, resolvedDate: string | null) {
  const changed = storedDate !== resolvedDate
  return (
    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
      Resolved: {fmtDate(resolvedDate)}
      {changed && (
        <span
          style={{
            marginLeft: '5px',
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(234, 88, 12, 0.1)',
            color: '#ea580c',
          }}
        >
          Shifted
        </span>
      )}
    </div>
  )
}

function getProcurementSource(item: ProcurementItem) {
  if (item.is_client_supplied) return 'Client'
  if (item.is_sub_supplied) return 'Company'
  if (item.requires_tracking === false) return 'No Tracking'
  return 'Internal'
}

function makeNodeKey(ref: DependencyNodeRef): string {
  return `${ref.type}:${ref.id}`
}

function makeDependencyEdgeKey(dep: DependencyWriteInput): string {
  return [
    makeNodeKey(dep.predecessor),
    makeNodeKey(dep.successor),
    dep.referencePoint,
    dep.offsetWorkingDays,
  ].join('|')
}

function makeDraftDependencies(
  dependencies: ScheduleItemDependency[]
): DependencyWriteInput[] {
  return dependencies.map((dep) => ({
    predecessor: {
      type: dep.predecessor_type,
      id: dep.predecessor_id,
    },
    successor: {
      type: dep.successor_type,
      id: dep.successor_id,
    },
    referencePoint: dep.reference_point,
    offsetWorkingDays: dep.offset_working_days,
  }))
}

function dedupeDependencies(inputs: DependencyWriteInput[]): DependencyWriteInput[] {
  const seen = new Set<string>()
  const deduped: DependencyWriteInput[] = []

  for (const input of inputs) {
    const key = makeDependencyEdgeKey(input)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(input)
    }
  }

  return deduped
}

export default function ScheduleEditClient({
  jobId,
  jobClientName,
  jobColor,
  scheduleItems,
  procurementItems,
  dependencies,
  baselineStatus,
}: Props) {
  const initialDependencyDrafts = useMemo(
    () => makeDraftDependencies(dependencies),
    [dependencies]
  )

  const [editMode, setEditMode] = useState(false)
  const [draftOverrides, setDraftOverrides] = useState<Record<string, ScheduleDraftOverride>>({})
  const [draftDependencies, setDraftDependencies] =
    useState<DependencyWriteInput[]>(initialDependencyDrafts)
  const [dependencyTargetByItem, setDependencyTargetByItem] = useState<Record<string, string>>({})
  const [insertTargetByEdge, setInsertTargetByEdge] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [baselinePending, startBaselineTransition] = useTransition()
  const [otherUsersEditing, setOtherUsersEditing] = useState<number>(0)
  const [presenceError, setPresenceError] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dependencyDirty =
    JSON.stringify(draftDependencies) !== JSON.stringify(initialDependencyDrafts)

  const isDirty = Object.keys(draftOverrides).length > 0 || dependencyDirty

  const previewDependencyRows = useMemo(
    () =>
      draftDependencies.map(
        (dep, index) =>
          ({
            id: `draft:${index}`,
            job_id: jobId,
            predecessor_type: dep.predecessor.type,
            predecessor_id: dep.predecessor.id,
            successor_type: dep.successor.type,
            successor_id: dep.successor.id,
            reference_point: dep.referencePoint,
            offset_working_days: dep.offsetWorkingDays,
          }) as ScheduleItemDependency
      ),
    [draftDependencies, jobId]
  )

  const effectiveScheduleItems = useMemo(
    () =>
      scheduleItems.map((item) => {
        const override = draftOverrides[item.id]
        if (!override) return item
        return { ...item, ...override }
      }),
    [scheduleItems, draftOverrides]
  )

  const previewNodes = useMemo(() => {
    try {
      const nodes = buildScheduleNodes({
        subSchedule: effectiveScheduleItems,
        procurementItems,
      })
      return resolveScheduleGraph({ nodes, dependencies: previewDependencyRows })
    } catch {
      const nodes = buildScheduleNodes({
        subSchedule: effectiveScheduleItems,
        procurementItems,
      })
      return nodes
    }
  }, [effectiveScheduleItems, procurementItems, previewDependencyRows])

  const confirmedShiftCount = useMemo(
    () =>
      scheduleItems.filter((item) => {
        if (item.status !== 'confirmed') return false
        const node = previewNodes[`schedule:${item.id}`]
        return node && node.start_date !== item.start_date
      }).length,
    [scheduleItems, previewNodes]
  )

  const dependencySummaryByScheduleId = useMemo(() => {
    const map = new Map<
      string,
      {
        dependsOn: { label: string; offset: number }[]
        blocks: { label: string; offset: number }[]
      }
    >()

    for (const item of scheduleItems) {
      map.set(item.id, { dependsOn: [], blocks: [] })
    }

    const getScheduleLabel = (scheduleId: string) =>
      scheduleItems.find((item) => item.id === scheduleId)?.trade || 'Unknown schedule item'

    for (const dep of previewDependencyRows) {
      if (
        dep.predecessor_type === 'schedule' &&
        dep.successor_type === 'schedule'
      ) {
        const predecessorEntry = map.get(dep.predecessor_id)
        if (predecessorEntry) {
          predecessorEntry.blocks.push({
            label: getScheduleLabel(dep.successor_id),
            offset: dep.offset_working_days,
          })
        }

        const successorEntry = map.get(dep.successor_id)
        if (successorEntry) {
          successorEntry.dependsOn.push({
            label: getScheduleLabel(dep.predecessor_id),
            offset: dep.offset_working_days,
          })
        }
      }
    }

    return map
  }, [previewDependencyRows, scheduleItems])

  useEffect(() => {
    if (!editMode) {
      setOtherUsersEditing(0)
      setPresenceError(null)
      return
    }

    let cancelled = false

    async function enterAndRefresh() {
      const result = await enterScheduleEditPresenceAction(jobId)
      if (!cancelled) {
        if (result.ok) {
          setOtherUsersEditing(result.otherUsersEditing ?? 0)
          setPresenceError(null)
        } else {
          setPresenceError(result.error ?? 'Presence unavailable')
        }
      }
    }

    void enterAndRefresh()

    refreshTimerRef.current = setInterval(async () => {
      const result = await refreshScheduleEditPresenceAction(jobId)
      if (!cancelled) {
        if (result.ok) {
          setOtherUsersEditing(result.otherUsersEditing ?? 0)
          setPresenceError(null)
        } else {
          setPresenceError(result.error ?? 'Presence unavailable')
        }
      }
    }, 15000)

    return () => {
      cancelled = true

      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }

      void exitScheduleEditPresenceAction(jobId)
    }
  }, [editMode, jobId])

  function setOverrideField<K extends keyof ScheduleDraftOverride>(
    itemId: string,
    field: K,
    value: ScheduleDraftOverride[K]
  ) {
    setDraftOverrides((prev) => {
      const original = scheduleItems.find((i) => i.id === itemId)
      if (!original) return prev
      const existing: ScheduleDraftOverride = prev[itemId] ?? {
        start_date: original.start_date,
        duration_working_days: original.duration_working_days ?? null,
        include_saturday: original.include_saturday,
        include_sunday: original.include_sunday,
        buffer_working_days: original.buffer_working_days,
        shift_reason_type: null,
        shift_reason_note: null,
        shift_dependencies: true,
        old_start_date: original.start_date,
      }
      return { ...prev, [itemId]: { ...existing, [field]: value } }
    })
  }

  function getNodeLabel(ref: DependencyNodeRef): string {
    if (ref.type === 'schedule') {
      return scheduleItems.find((item) => item.id === ref.id)?.trade || 'Unknown schedule item'
    }

    return (
      procurementItems.find((item) => item.id === ref.id)?.description ||
      'Unknown material item'
    )
  }

  function formatOffset(offset: number): string {
    return offset >= 0 ? `+${offset}d` : `${offset}d`
  }

  function handleAttachAfter(itemId: string) {
    const targetId = dependencyTargetByItem[itemId]
    if (!targetId) return

    setDraftDependencies((prev) =>
      dedupeDependencies([
        ...prev,
        ...attachNodeAfter({
          parent: { type: 'schedule', id: itemId },
          newNode: { type: 'schedule', id: targetId },
        }),
      ])
    )
  }

  function handleAttachBefore(itemId: string) {
    const targetId = dependencyTargetByItem[itemId]
    if (!targetId) return

    setDraftDependencies((prev) =>
      dedupeDependencies([
        ...prev,
        ...attachNodeBefore({
          newNode: { type: 'schedule', id: itemId },
          child: { type: 'schedule', id: targetId },
        }),
      ])
    )
  }

  function handleDisconnectReconnect(itemId: string) {
    setDraftDependencies((prev) =>
      removeNodeAndReconnect({
        nodeToRemove: { type: 'schedule', id: itemId },
        dependencies: prev,
      })
    )
  }

  function handleInsertBetween(dep: DependencyWriteInput) {
    const edgeKey = `${makeNodeKey(dep.predecessor)}->${makeNodeKey(dep.successor)}`
    const targetId = insertTargetByEdge[edgeKey]
    if (!targetId) return

    setDraftDependencies((prev) =>
      dedupeDependencies(
        insertNodeBetween(
          {
            predecessor: dep.predecessor,
            successor: dep.successor,
            newNode: { type: 'schedule', id: targetId },
          },
          prev
        )
      )
    )
  }

  function handleRemoveLink(index: number) {
    setDraftDependencies((prev) => prev.filter((_, candidateIndex) => candidateIndex !== index))
  }

  async function handleCancel() {
    setDraftOverrides({})
    setDraftDependencies(initialDependencyDrafts)
    setDependencyTargetByItem({})
    setInsertTargetByEdge({})
    setEditMode(false)
    setSaveError(null)
    setOtherUsersEditing(0)
    setPresenceError(null)
    await exitScheduleEditPresenceAction(jobId)
  }

  function handleSave() {
    const updates: DraftScheduleItemUpdate[] = scheduleItems
      .filter((item) => draftOverrides[item.id])
      .map((item) => {
        const override = draftOverrides[item.id]
        return {
          id: item.id,
          start_date: override.start_date,
          duration_working_days: override.duration_working_days,
          include_saturday: override.include_saturday,
          include_sunday: override.include_sunday,
          buffer_working_days: override.buffer_working_days,
          shift_reason_type: override.shift_reason_type,
          shift_reason_note: override.shift_reason_note,
          shift_dependencies: override.shift_dependencies,
          old_start_date: override.old_start_date,
        }
      })

    if (updates.length === 0 && !dependencyDirty) {
      setEditMode(false)
      return
    }

    setSaveError(null)
    startTransition(async () => {
      const result = await saveScheduleDraftAction(jobId, updates, draftDependencies)
      if (result.ok) {
        await exitScheduleEditPresenceAction(jobId)
        setDraftOverrides({})
        setDraftDependencies(initialDependencyDrafts)
        setDependencyTargetByItem({})
        setInsertTargetByEdge({})
        setEditMode(false)
        setOtherUsersEditing(0)
        setPresenceError(null)
      } else {
        setSaveError(result.error ?? 'Save failed')
      }
    })
  }

  const dotColor = jobColor || '#e5e7eb'

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        {baselineStatus === true ? (
          <>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                background: 'rgba(22, 163, 74, 0.1)',
                color: '#16a34a',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '10px' }}>●</span>
              Baseline Active
            </span>
            <Link
              href={`/schedule/baseline?job=${jobId}`}
              style={{
                fontSize: '13px',
                color: 'var(--blue)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              View Baseline
            </Link>
          </>
        ) : baselineStatus === false ? (
          <button
            onClick={() => {
              setBaselineError(null)
              startBaselineTransition(async () => {
                const result = await activateBaselineAction(jobId)
                if (!result.ok) {
                  setBaselineError(result.error ?? 'Baseline activation failed')
                }
              })
            }}
            disabled={baselinePending}
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '7px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: baselinePending ? 'not-allowed' : 'pointer',
              opacity: baselinePending ? 0.5 : 1,
            }}
          >
            {baselinePending ? 'Setting Baseline…' : 'Set Baseline'}
          </button>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'rgba(217, 119, 6, 0.08)',
              color: 'var(--amber, #b45309)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            Baseline unavailable
          </span>
        )}
        {baselineError && (
          <span style={{ fontSize: '13px', color: 'var(--red)' }}>{baselineError}</span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          padding: '12px 16px',
          background: editMode ? 'rgba(37, 99, 235, 0.06)' : 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}
      >
        {!editMode ? (
          <button
            onClick={() => {
              setPresenceError(null)
              setOtherUsersEditing(0)
              setEditMode(true)
            }}
            style={{
              background: 'var(--blue)',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Edit Schedule
          </button>
        ) : (
          <>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', flex: 1 }}>
              Edit mode —{' '}
              {isDirty
                ? `${Object.keys(draftOverrides).length} item(s) changed${
                    dependencyDirty ? ' + dependency edits' : ''
                  }`
                : 'no changes yet'}
            </span>
            {confirmedShiftCount > 0 && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ea580c',
                  background: 'rgba(234, 88, 12, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '999px',
                }}
              >
                {confirmedShiftCount} confirmed shift
                {confirmedShiftCount !== 1 ? 's' : ''} — call task
                {confirmedShiftCount !== 1 ? 's' : ''} will be created
              </span>
            )}
            <button
              onClick={handleCancel}
              disabled={isPending}
              style={{
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || !isDirty}
              style={{
                background: isDirty && !isPending ? 'var(--blue)' : 'var(--border)',
                color: isDirty && !isPending ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: isPending || !isDirty ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        )}
      </div>

      {editMode && otherUsersEditing > 0 && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            background: 'rgba(217, 119, 6, 0.08)',
            color: 'var(--amber, #b45309)',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          Another user is editing this schedule. Your changes may interfere.
        </div>
      )}

      {editMode && presenceError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            background: 'rgba(217, 119, 6, 0.08)',
            color: 'var(--amber, #b45309)',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          Edit presence unavailable: {presenceError}
        </div>
      )}

      {saveError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            background: 'rgba(220, 38, 38, 0.08)',
            color: 'var(--red)',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          Save failed: {saveError}
        </div>
      )}

      <section style={pageCardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Labor Schedule</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {scheduleItems.length} entries
            </div>
          </div>
        </div>

        {scheduleItems.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            <div style={{ marginBottom: '6px' }}>No schedule items yet</div>
            <div>Add schedule items from a job or click + Schedule Item above</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Job',
                  'Trade',
                  'Company',
                  'Status',
                  'Release',
                  'Start',
                  'End',
                  'Cost Code',
                  'Notes',
                  'Shift Reason',
                  '',
                ].map((heading) => (
                  <th key={heading} style={thStyle()}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleItems.map((item) => {
                const risk = getScheduleRiskLevel(item)
                const override = draftOverrides[item.id]
                const effective = override ? { ...item, ...override } : item
                const previewNode = previewNodes[`schedule:${item.id}`]
                const dependencySummary = dependencySummaryByScheduleId.get(item.id)

                return (
                  <tr key={item.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '999px',
                            background: jobColor || '#e5e7eb',
                            display: 'inline-block',
                          }}
                        />
                        <span>{jobClientName || '—'}</span>
                      </div>
                    </td>

                    <td style={tdStyle()}>{item.trade}</td>
                    <td style={tdStyle()}>{item.sub_name || '—'}</td>

                    <td style={tdStyle()}>
                      <span style={badgeStyle(STATUS_COLORS[item.status])}>{item.status}</span>
                    </td>

                    <td style={tdStyle()}>
                      <span style={badgeStyle(undefined, !item.is_released)}>
                        {item.is_released ? 'Released' : 'Draft'}
                      </span>
                    </td>

                    <td style={tdStyle()}>
                      {editMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="date"
                            value={effective.start_date ?? ''}
                            onChange={(e) =>
                              setOverrideField(item.id, 'start_date', e.target.value || null)
                            }
                            style={{
                              fontSize: '13px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min={1}
                              value={effective.duration_working_days ?? ''}
                              placeholder="Days"
                              onChange={(e) =>
                                setOverrideField(
                                  item.id,
                                  'duration_working_days',
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                              style={{
                                width: '64px',
                                fontSize: '13px',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                              }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              days
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input
                                type="checkbox"
                                checked={effective.include_saturday}
                                onChange={(e) =>
                                  setOverrideField(item.id, 'include_saturday', e.target.checked)
                                }
                              />
                              Sat
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input
                                type="checkbox"
                                checked={effective.include_sunday}
                                onChange={(e) =>
                                  setOverrideField(item.id, 'include_sunday', e.target.checked)
                                }
                              />
                              Sun
                            </label>
                          </div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '6px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={override?.shift_dependencies ?? true}
                              onChange={(e) =>
                                setOverrideField(item.id, 'shift_dependencies', e.target.checked)
                              }
                            />
                            Shift dependencies
                          </label>

                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: '1px dashed var(--border)',
                            }}
                          >
                            <select
                              value={dependencyTargetByItem[item.id] ?? ''}
                              onChange={(e) =>
                                setDependencyTargetByItem((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              style={{
                                fontSize: '12px',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                              }}
                            >
                              <option value="">Select schedule item…</option>
                              {scheduleItems
                                .filter((candidate) => candidate.id !== item.id)
                                .map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.trade}
                                  </option>
                                ))}
                            </select>

                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleAttachAfter(item.id)}
                                style={{
                                  background: 'transparent',
                                  color: 'var(--text)',
                                  border: '1px solid var(--border)',
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                Attach after
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAttachBefore(item.id)}
                                style={{
                                  background: 'transparent',
                                  color: 'var(--text)',
                                  border: '1px solid var(--border)',
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                Attach before
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDisconnectReconnect(item.id)}
                                style={{
                                  background: 'transparent',
                                  color: '#dc2626',
                                  border: '1px solid rgba(220, 38, 38, 0.25)',
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                Disconnect / reconnect
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {risk === 'overdue' && (
                            <span style={{ color: 'var(--red)', marginRight: '6px' }}>●</span>
                          )}
                          {risk === 'soon' && (
                            <span style={{ color: 'var(--amber)', marginRight: '6px' }}>⚠️</span>
                          )}
                          {fmtDate(item.start_date)}
                          {previewNode && resolvedHint(item.start_date, previewNode.start_date)}
                        </>
                      )}
                    </td>

                    <td style={tdStyle()}>
                      {editMode ? (
                        <div style={{ fontSize: '14px' }}>
                          {fmtDate(previewNode?.end_date ?? item.end_date)}
                          {previewNode && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              preview
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {fmtDate(item.end_date)}
                          {previewNode && resolvedHint(item.end_date, previewNode.end_date)}
                        </>
                      )}
                    </td>

                    <td style={tdStyle()}>{item.cost_code || '—'}</td>

                    <td style={tdStyle()}>
                      <div>{item.notes || '—'}</div>
                      {!editMode && dependencySummary && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div>
                            Depends on:{' '}
                            {dependencySummary.dependsOn.length > 0
                              ? dependencySummary.dependsOn
                                  .map((entry) => `${entry.label} (${formatOffset(entry.offset)})`)
                                  .join(', ')
                              : '—'}
                          </div>
                          <div>
                            Blocks:{' '}
                            {dependencySummary.blocks.length > 0
                              ? dependencySummary.blocks
                                  .map((entry) => `${entry.label} (${formatOffset(entry.offset)})`)
                                  .join(', ')
                              : '—'}
                          </div>
                        </div>
                      )}
                    </td>

                    <td style={tdStyle()}>
                      {editMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <select
                            value={override?.shift_reason_type ?? ''}
                            onChange={(e) =>
                              setOverrideField(
                                item.id,
                                'shift_reason_type',
                                e.target.value || null
                              )
                            }
                            style={{
                              fontSize: '13px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                            }}
                          >
                            {SHIFT_REASON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={override?.shift_reason_note ?? ''}
                            placeholder="Note (optional)"
                            onChange={(e) =>
                              setOverrideField(
                                item.id,
                                'shift_reason_note',
                                e.target.value || null
                              )
                            }
                            style={{
                              fontSize: '13px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              width: '140px',
                            }}
                          />
                        </div>
                      ) : null}
                    </td>

                    <td style={tdStyle()}>
                      <Link
                        href={`/schedule/sub/${item.id}/edit`}
                        style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={pageCardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Dependencies</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {draftDependencies.length} link{draftDependencies.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {draftDependencies.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            No dependencies yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {draftDependencies.map((dep, index) => {
              const edgeKey = `${makeNodeKey(dep.predecessor)}->${makeNodeKey(dep.successor)}`

              return (
                <div
                  key={`${edgeKey}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--surface)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: '14px' }}>
                    {getNodeLabel(dep.predecessor)} → {getNodeLabel(dep.successor)}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>
                      {dep.referencePoint}, offset {dep.offsetWorkingDays}
                    </span>
                  </div>

                  {editMode && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        value={insertTargetByEdge[edgeKey] ?? ''}
                        onChange={(e) =>
                          setInsertTargetByEdge((prev) => ({
                            ...prev,
                            [edgeKey]: e.target.value,
                          }))
                        }
                        style={{
                          fontSize: '12px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                        }}
                      >
                        <option value="">Insert item…</option>
                        {scheduleItems
                          .filter(
                            (candidate) =>
                              candidate.id !== dep.predecessor.id &&
                              candidate.id !== dep.successor.id
                          )
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.trade}
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleInsertBetween(dep)}
                        style={{
                          background: 'transparent',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Insert between
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveLink(index)}
                        style={{
                          background: 'transparent',
                          color: '#dc2626',
                          border: '1px solid rgba(220, 38, 38, 0.25)',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Remove link
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section style={pageCardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Material Schedule</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {procurementItems.length} items
            </div>
          </div>
        </div>

        {procurementItems.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            <div style={{ marginBottom: '6px' }}>No material items yet</div>
            <div>Add material items from a job or click + Material Item above</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Job',
                  'Trade',
                  'Item',
                  'Group',
                  'Company',
                  'Need By',
                  'Order By',
                  'Lead',
                  'Status',
                  'Source',
                  '',
                ].map((heading) => (
                  <th key={heading} style={thStyle()}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {procurementItems.map((item) => {
                const risk = getOrderRiskLevel(item)
                const source = getProcurementSource(item)
                const previewNode = previewNodes[`procurement:${item.id}`]

                return (
                  <tr key={item.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '999px',
                            background: jobColor || '#e5e7eb',
                            display: 'inline-block',
                          }}
                        />
                        <span>{jobClientName || '—'}</span>
                      </div>
                    </td>

                    <td style={tdStyle()}>{item.trade}</td>
                    <td style={tdStyle()}>{item.description}</td>
                    <td style={tdStyle()}>{item.procurement_group || '—'}</td>
                    <td style={tdStyle()}>{item.vendor || '—'}</td>
                    <td style={tdStyle()}>
                      {fmtDate(item.required_on_site_date)}
                      {previewNode &&
                        resolvedHint(item.required_on_site_date, previewNode.start_date)}
                    </td>

                    <td style={tdStyle()}>
                      {risk === 'overdue' && (
                        <span style={{ color: 'var(--red)', marginRight: '6px' }}>●</span>
                      )}
                      {risk === 'soon' && (
                        <span style={{ color: 'var(--amber)', marginRight: '6px' }}>⚠️</span>
                      )}
                      {fmtDate(item.order_by_date)}
                    </td>

                    <td style={tdStyle()}>{item.lead_days ?? 0}d</td>

                    <td style={tdStyle()}>
                      <span style={badgeStyle(STATUS_COLORS[item.status])}>{item.status}</span>
                    </td>

                    <td style={tdStyle()}>{source}</td>

                    <td style={tdStyle()}>
                      <Link
                        href={`/schedule/order/${item.id}/edit`}
                        style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}