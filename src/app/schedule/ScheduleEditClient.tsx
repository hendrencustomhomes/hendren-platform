'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type {
  JobSubSchedule,
  ProcurementItem,
  ScheduleItemDependency,
} from '@/lib/db'
import { getOrderRiskLevel, getScheduleRiskLevel } from '@/lib/db'
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

export default function ScheduleEditClient({
  jobId,
  jobClientName,
  jobColor,
  scheduleItems,
  procurementItems,
  dependencies,
  baselineStatus,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [draftOverrides, setDraftOverrides] = useState<Record<string, ScheduleDraftOverride>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [baselinePending, startBaselineTransition] = useTransition()
  const [otherUsersEditing, setOtherUsersEditing] = useState<number>(0)
  const [presenceError, setPresenceError] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isDirty = Object.keys(draftOverrides).length > 0

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
      return resolveScheduleGraph({ nodes, dependencies })
    } catch {
      const nodes = buildScheduleNodes({
        subSchedule: effectiveScheduleItems,
        procurementItems,
      })
      return nodes
    }
  }, [effectiveScheduleItems, procurementItems, dependencies])

  const confirmedShiftCount = useMemo(
    () =>
      scheduleItems.filter((item) => {
        if (item.status !== 'confirmed') return false
        const node = previewNodes[`schedule:${item.id}`]
        return node && node.start_date !== item.start_date
      }).length,
    [scheduleItems, previewNodes]
  )

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

  async function handleCancel() {
    setDraftOverrides({})
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

    if (updates.length === 0) {
      setEditMode(false)
      return
    }

    setSaveError(null)
    startTransition(async () => {
      const result = await saveScheduleDraftAction(jobId, updates)
      if (result.ok) {
        await exitScheduleEditPresenceAction(jobId)
        setDraftOverrides({})
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
      {/* Baseline toolbar */}
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

      {/* Edit mode toolbar */}
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
                ? `${Object.keys(draftOverrides).length} item(s) changed`
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

      {/* Labor Schedule */}
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
                {['Job', 'Trade', 'Company', 'Status', 'Release', 'Start', 'End', 'Cost Code', 'Notes', 'Shift Reason', ''].map(
                  (heading) => (
                    <th key={heading} style={thStyle()}>
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {scheduleItems.map((item) => {
                const risk = getScheduleRiskLevel(item)
                const override = draftOverrides[item.id]
                const effective = override ? { ...item, ...override } : item
                const previewNode = previewNodes[`schedule:${item.id}`]

                return (
                  <tr key={item.id}>
                    <td style={tdStyle()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '999px',
                            background: dotColor,
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
                    <td style={tdStyle()}>{item.notes || '—'}</td>

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

      {/* Material Schedule */}
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
            <div style={{ marginBottom: '6px' }}>No procurement items yet</div>
            <div>Add procurement items from a job or click + Procurement Item above</div>
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
                            background: dotColor,
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