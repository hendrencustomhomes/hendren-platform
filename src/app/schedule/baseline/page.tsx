import Link from 'next/link'
import { redirect } from 'next/navigation'

import Nav from '@/components/Nav'
import { getJobBaseline } from '@/lib/schedule/baseline'
import { workingDayDiff } from '@/lib/schedule/engine'
import type { WeekendFlags } from '@/lib/schedule/engine'
import { createClient } from '@/utils/supabase/server'

type BaselineRow = {
  id: string
  status: string
  trade: string
  sub_name: string | null
  start_date: string | null
  end_date: string | null
  baseline_start_date: string | null
  baseline_end_date: string | null
  include_saturday: boolean
  include_sunday: boolean
  jobs?: { client_name: string | null; color: string | null }[] | null
}

// Describes the comparability of a single baseline/current date pair.
//
// On a job with an active baseline, a DB trigger auto-populates baseline_start_date
// and baseline_end_date for every newly inserted sub_schedule row from its initial
// dates. Therefore:
//   - 'ok'           — both dates present; variance can be computed
//   - 'no-current'   — current date is null; item has no scheduled dates yet
//   - 'no-baseline'  — baseline date is null but current date is set; this is an
//                      incomplete-baseline-data anomaly (trigger did not fire or
//                      row was inserted before trigger existed)
//   - 'no-dates'     — both dates are null; no comparison possible
//
// 'no-baseline' is NOT a normal "added after baseline" state. Items added after
// baseline activation should have baseline dates auto-populated equal to their
// initial dates (0-day variance).
type DatePairState = 'ok' | 'no-current' | 'no-baseline' | 'no-dates'

function classifyDatePair(
  baselineDate: string | null,
  currentDate: string | null
): DatePairState {
  if (baselineDate && currentDate) return 'ok'
  if (!baselineDate && currentDate) return 'no-baseline'
  if (baselineDate && !currentDate) return 'no-current'
  return 'no-dates'
}

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function workingDayVariance(
  baseline: string,
  current: string,
  flags: WeekendFlags
): number {
  const b = parseDateLocal(baseline)
  const c = parseDateLocal(current)
  if (b.getTime() === c.getTime()) return 0
  const [earlier, later] = b < c ? [b, c] : [c, b]
  const sign = b < c ? 1 : -1
  return sign * (workingDayDiff(earlier, later, flags) - 1)
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function fmtVariance(v: number): string {
  if (v === 0) return '0 days'
  return v > 0 ? `+${v} days` : `${v} days`
}

function varianceColor(v: number): string {
  if (v === 0) return 'var(--text-muted)'
  return v > 0 ? '#dc2626' : '#16a34a'
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

export default async function BaselinePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { job: jobId } = await searchParams

  if (!jobId) {
    return (
      <>
        <Nav title="Baseline" />
        <main
          style={{
            padding: '16px',
            maxWidth: '1400px',
            margin: '0 auto',
            color: 'var(--text)',
          }}
        >
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '15px',
            }}
          >
            Select a job to view its baseline.
          </div>
        </main>
      </>
    )
  }

  const baseline = await getJobBaseline(supabase, jobId).catch(() => null)

  if (!baseline) {
    return (
      <>
        <Nav title="Baseline" />
        <main
          style={{
            padding: '16px',
            maxWidth: '1400px',
            margin: '0 auto',
            color: 'var(--text)',
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <Link
              href={`/schedule?job=${jobId}`}
              style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: '14px' }}
            >
              ← Schedule
            </Link>
          </div>
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '15px',
            }}
          >
            No baseline has been set for this job.
          </div>
        </main>
      </>
    )
  }

  const { data: scheduleData, error: scheduleError } = await supabase
    .from('sub_schedule')
    .select(
      'id, status, trade, sub_name, start_date, end_date, baseline_start_date, baseline_end_date, include_saturday, include_sunday, jobs(client_name, color)'
    )
    .eq('job_id', jobId)
    .order('start_date', { ascending: true, nullsFirst: false })

  if (scheduleError) {
    return (
      <>
        <Nav title="Baseline" />
        <main
          style={{
            padding: '16px',
            maxWidth: '1400px',
            margin: '0 auto',
            color: 'var(--text)',
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <Link
              href={`/schedule?job=${jobId}`}
              style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: '14px' }}
            >
              ← Schedule
            </Link>
          </div>
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--red)',
              fontSize: '14px',
            }}
          >
            Failed to load schedule data.
          </div>
        </main>
      </>
    )
  }

  const rows = ((scheduleData ?? []) as unknown) as BaselineRow[]
  const jobClientName = rows[0]?.jobs?.[0]?.client_name ?? null

  const baselineCreatedAt = new Date(baseline.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <>
      <Nav title="Baseline" />
      <main
        style={{
          padding: '16px',
          maxWidth: '1400px',
          margin: '0 auto',
          background: 'var(--bg)',
          minHeight: '100vh',
          color: 'var(--text)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Link
              href={`/schedule?job=${jobId}`}
              style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: '14px' }}
            >
              ← Schedule
            </Link>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '22px' }}>
              {jobClientName ? `${jobClientName} — Baseline` : 'Baseline'}
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'rgba(22, 163, 74, 0.1)',
                color: '#16a34a',
                border: '1px solid rgba(22, 163, 74, 0.2)',
              }}
            >
              <span style={{ fontSize: '9px' }}>●</span>
              Baseline Active
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Set {baselineCreatedAt}
            </span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            overflowX: 'auto',
          }}
        >
          {rows.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '12px 0' }}>
              No labor schedule items for this job.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[
                      'Trade',
                      'Company',
                      'Baseline Start',
                      'Current Start',
                      'Start Variance',
                      'Baseline End',
                      'Current End',
                      'End Variance',
                    ].map((h) => (
                      <th key={h} style={thStyle()}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const flags: WeekendFlags = {
                      includeSaturday: row.include_saturday,
                      includeSunday: row.include_sunday,
                    }

                    const startState = classifyDatePair(
                      row.baseline_start_date,
                      row.start_date
                    )
                    const endState = classifyDatePair(
                      row.baseline_end_date,
                      row.end_date
                    )

                    const startVariance =
                      startState === 'ok'
                        ? workingDayVariance(
                            row.baseline_start_date!,
                            row.start_date!,
                            flags
                          )
                        : null

                    const endVariance =
                      endState === 'ok'
                        ? workingDayVariance(
                            row.baseline_end_date!,
                            row.end_date!,
                            flags
                          )
                        : null

                    return (
                      <tr key={row.id}>
                        <td style={tdStyle()}>{row.trade}</td>
                        <td style={tdStyle()}>{row.sub_name || '—'}</td>

                        <td style={tdStyle()}>
                          {fmtDate(row.baseline_start_date)}
                          {startState === 'no-baseline' && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              Incomplete
                            </div>
                          )}
                        </td>
                        <td style={tdStyle()}>{fmtDate(row.start_date)}</td>
                        <td
                          style={{
                            ...tdStyle(),
                            fontWeight: 600,
                            color:
                              startVariance !== null
                                ? varianceColor(startVariance)
                                : 'var(--text-muted)',
                          }}
                        >
                          {startVariance !== null ? fmtVariance(startVariance) : '—'}
                        </td>

                        <td style={tdStyle()}>
                          {fmtDate(row.baseline_end_date)}
                          {endState === 'no-baseline' && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              Incomplete
                            </div>
                          )}
                        </td>
                        <td style={tdStyle()}>{fmtDate(row.end_date)}</td>
                        <td
                          style={{
                            ...tdStyle(),
                            fontWeight: 600,
                            color:
                              endVariance !== null
                                ? varianceColor(endVariance)
                                : 'var(--text-muted)',
                          }}
                        >
                          {endVariance !== null ? fmtVariance(endVariance) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '12px',
                  paddingLeft: '2px',
                }}
              >
                — Comparison unavailable (dates not set or incomplete baseline data)
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
