'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import FilesTab from '@/components/FilesTab'
import { createClient } from '@/utils/supabase/client'

const REFERRAL_OPTIONS = [
  'Past Client',
  'Realtor',
  'Architect',
  'Designer',
  'Website',
  'Yard Sign',
  'Other',
]

type JobTabProps = {
  jobId: string
  job: any
  stageItems: Record<string, any[]>
  checkedMap: Record<string, boolean>
  stateMap: Record<string, string>
  issues: any[]
  logs: any[]

  // current naming
  scheduleItems?: any[]
  procurementItems?: any[]

  // backward-compatible aliases
  subs?: any[]
  orders?: any[]

  selections?: any[]
  takeoffItems?: any[]
  estimates?: any[]
  files?: any[]

  stages: string[]
  stageLabels: Record<string, string>
  stageIcons: Record<string, string>
  statusColors: Record<string, string>
  userId: string
  canEditInfo: boolean
  pmOptions: { id: string; full_name: string | null }[]
  estimatorOptions: { id: string; full_name: string | null }[]
  bookkeeperOptions: { id: string; full_name: string | null }[]
}

function surfaceCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
  }
}

function inputStyle() {
  return {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '16px',
    fontFamily: 'ui-monospace,monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  }
}

function getScheduleBadge(item: any) {
  if (item.status === 'confirmed') return { label: 'Confirmed', color: 'var(--green)' }
  if (item.is_released) return { label: 'Released', color: 'var(--blue)' }
  return { label: 'Draft', color: 'var(--text-muted)' }
}

function getProcurementSourceBadge(item: any) {
  if (item.is_client_supplied) return { label: 'Client Supplied', color: 'var(--amber)' }
  if (item.is_sub_supplied) return { label: 'Company Supplied', color: 'var(--blue)' }
  if (item.requires_tracking === false) return { label: 'No Tracking', color: 'var(--text-muted)' }
  return { label: 'Internal Procurement', color: 'var(--green)' }
}

function getStageState(idx: number, curIdx: number) {
  if (idx < curIdx) return { label: 'Complete', color: 'var(--green)' }
  if (idx === curIdx) return { label: 'Active', color: 'var(--blue)' }
  return { label: 'Upcoming', color: 'var(--text-muted)' }
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getRelatedProfile(value: any) {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

export default function JobTabs(props: JobTabProps) {
  const {
    jobId,
    job,
    stageItems,
    checkedMap: initialCheckedMap,
    stateMap: initialStateMap,
    issues: initialIssues,
    logs: initialLogs,
    stages,
    stageLabels,
    stageIcons,
    statusColors,
    userId,
    canEditInfo,
    pmOptions,
    estimatorOptions,
    bookkeeperOptions,
  } = props

  const router = useRouter()
  const supabase = createClient()

  const scheduleItems = useMemo(
    () => props.scheduleItems ?? props.subs ?? [],
    [props.scheduleItems, props.subs]
  )

  const procurementItems = useMemo(
    () => props.procurementItems ?? props.orders ?? [],
    [props.procurementItems, props.orders]
  )

  const [activeTab, setActiveTab] = useState('info')

  const [checked, setChecked] = useState<Record<string, boolean>>(initialCheckedMap)
  const [stageStateMap, setStageStateMap] = useState<Record<string, string>>(initialStateMap)

  const [issues, setIssues] = useState<any[]>(initialIssues || [])
  const [logs, setLogs] = useState<any[]>(initialLogs || [])
  const [schedule, setSchedule] = useState<any[]>(scheduleItems || [])
  const [actingScheduleId, setActingScheduleId] = useState<string | null>(null)

  const [logText, setLogText] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueSeverity, setIssueSeverity] = useState('Warning')
  const [issueDetail, setIssueDetail] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)

  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [infoDraft, setInfoDraft] = useState({
    job_name: '',
    project_address: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    sqft: '',
    lot_sqft: '',
    referral_source: '',
    contract_type: 'fixed_price',
    pm_id: '',
    estimator_profile_id: '',
    bookkeeper_profile_id: '',
    garage_code: '',
    lockbox_code: '',
    gate_code: '',
    parking_notes: '',
    neighborhood_requirements: '',
    scope_notes: '',
  })

  const curIdx = stages.indexOf(job.current_stage)
  const inp = inputStyle()

  const pmProfile = getRelatedProfile(job.profiles)
  const estimatorProfile = getRelatedProfile(job.estimator)
  const bookkeeperProfile = getRelatedProfile(job.bookkeeper)

  const openIssueCount = issues.filter((issue) => !issue.resolved).length
  const releasedScheduleCount = schedule.filter((item) => item.is_released).length
  const confirmedScheduleCount = schedule.filter((item) => item.status === 'confirmed').length
  const openProcurementCount = procurementItems.filter(
    (item) => !['Delivered', 'Confirmed'].includes(item.status)
  ).length

  const TABS = ['info', 'pipeline', 'log', 'issues', 'schedule', 'procurement', 'files']

  const TAB_LABELS: Record<string, string> = {
    info: 'Info',
    pipeline: 'Pipeline',
    log: 'Log',
    issues: openIssueCount ? `Issues (${openIssueCount})` : 'Issues',
    schedule: 'Schedule',
    procurement: 'Procurement',
    files: 'Files',
  }

  function beginInfoEdit() {
    setInfoDraft({
      job_name: job.job_name ?? '',
      project_address: job.project_address ?? '',
      client_name: job.client_name ?? '',
      client_email: job.client_email ?? '',
      client_phone: job.client_phone ?? '',
      sqft: job.sqft?.toString() ?? '',
      lot_sqft: job.lot_sqft?.toString() ?? '',
      referral_source: job.referral_source ?? '',
      contract_type: job.contract_type ?? 'fixed_price',
      pm_id: job.pm_id ?? '',
      estimator_profile_id: job.estimator_profile_id ?? '',
      bookkeeper_profile_id: job.bookkeeper_profile_id ?? '',
      garage_code: job.garage_code ?? '',
      lockbox_code: job.lockbox_code ?? '',
      gate_code: job.gate_code ?? '',
      parking_notes: job.parking_notes ?? '',
      neighborhood_requirements: job.neighborhood_requirements ?? '',
      scope_notes: job.scope_notes ?? '',
    })
    setInfoError(null)
    setIsEditingInfo(true)
  }

  function cancelInfoEdit() {
    setIsEditingInfo(false)
    setInfoError(null)
    setInfoDraft({
      job_name: '',
      project_address: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      sqft: '',
      lot_sqft: '',
      referral_source: '',
      contract_type: 'fixed_price',
      pm_id: '',
      estimator_profile_id: '',
      bookkeeper_profile_id: '',
      garage_code: '',
      lockbox_code: '',
      gate_code: '',
      parking_notes: '',
      neighborhood_requirements: '',
      scope_notes: '',
    })
  }

  function parseNumberOrNull(value: string) {
    if (!value.trim()) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function saveInfo() {
    setInfoSaving(true)
    setInfoError(null)

    const payload = {
      job_name: infoDraft.job_name.trim() || null,
      project_address: infoDraft.project_address.trim() || null,
      client_name: infoDraft.client_name.trim() || null,
      client_email: infoDraft.client_email.trim() || null,
      client_phone: infoDraft.client_phone.trim() || null,
      sqft: parseNumberOrNull(infoDraft.sqft),
      lot_sqft: parseNumberOrNull(infoDraft.lot_sqft),
      referral_source: infoDraft.referral_source || null,
      contract_type: infoDraft.contract_type,
      pm_id: infoDraft.pm_id || null,
      estimator_profile_id: infoDraft.estimator_profile_id || null,
      bookkeeper_profile_id: infoDraft.bookkeeper_profile_id || null,
      garage_code: infoDraft.garage_code.trim() || null,
      lockbox_code: infoDraft.lockbox_code.trim() || null,
      gate_code: infoDraft.gate_code.trim() || null,
      parking_notes: infoDraft.parking_notes.trim() || null,
      neighborhood_requirements: infoDraft.neighborhood_requirements.trim() || null,
      scope_notes: infoDraft.scope_notes.trim() || null,
    }

    const { error } = await supabase.from('jobs').update(payload).eq('id', job.id)

    setInfoSaving(false)

    if (error) {
      setInfoError('Failed to save job info')
      return
    }

    cancelInfoEdit()
    router.refresh()
  }

  async function toggleCheck(itemId: string, nextValue: boolean) {
    setChecked((current) => ({ ...current, [itemId]: nextValue }))

    const existingStateId = stageStateMap[itemId]

    if (existingStateId) {
      await supabase
        .from('job_checklist_state')
        .update({ is_checked: nextValue })
        .eq('id', existingStateId)
      return
    }

    const { data } = await supabase
      .from('job_checklist_state')
      .insert({
        job_id: jobId,
        checklist_item_id: itemId,
        is_checked: nextValue,
      })
      .select()
      .single()

    if (data) {
      setStageStateMap((current) => ({ ...current, [itemId]: data.id }))
    }
  }

  async function addLog() {
    if (!logText.trim()) return

    setLogSaving(true)

    const { data } = await supabase
      .from('job_logs')
      .insert({
        job_id: jobId,
        body: logText.trim(),
        author_id: userId,
      })
      .select('*, profiles(full_name)')
      .single()

    setLogSaving(false)

    if (data) {
      setLogs((current) => [data, ...current])
      setLogText('')
    }
  }

  async function addIssue() {
    if (!issueTitle.trim()) return

    setIssueSaving(true)

    const { data } = await supabase
      .from('issues')
      .insert({
        job_id: jobId,
        title: issueTitle.trim(),
        severity: issueSeverity,
        detail: issueDetail.trim() || null,
        stage: job.current_stage,
      })
      .select()
      .single()

    setIssueSaving(false)

    if (data) {
      setIssues((current) => [data, ...current])
      setIssueTitle('')
      setIssueDetail('')
      setIssueSeverity('Warning')
      setShowIssueForm(false)
    }
  }

  async function resolveIssue(issueId: string) {
    await supabase
      .from('issues')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', issueId)

    setIssues((current) =>
      current.map((issue) =>
        issue.id === issueId ? { ...issue, resolved: true } : issue
      )
    )
  }

  async function updateScheduleItem(id: string, patch: Record<string, any>) {
    setActingScheduleId(id)

    const { error } = await supabase
      .from('sub_schedule')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setActingScheduleId(null)

    if (error) {
      alert(error.message)
      return
    }

    setSchedule((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    )
  }

  async function releaseScheduleItem(item: any) {
    const today = new Date().toISOString().slice(0, 10)

    await updateScheduleItem(item.id, {
      is_released: true,
      release_date: item.release_date || today,
      status: item.status === 'tentative' ? 'scheduled' : item.status,
    })
  }

  async function unreleaseScheduleItem(item: any) {
    await updateScheduleItem(item.id, {
      is_released: false,
      release_date: null,
      status: item.status === 'confirmed' ? 'scheduled' : item.status,
      confirmed_date: null,
    })
  }

  async function confirmScheduleItem(item: any) {
    const now = new Date().toISOString()

    await updateScheduleItem(item.id, {
      is_released: true,
      release_date: item.release_date || now.slice(0, 10),
      status: 'confirmed',
      confirmed_date: now,
    })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '12px',
          overflowX: 'auto',
        }}
      >
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => {
              if (activeTab === 'info' && tabKey !== 'info' && isEditingInfo) {
                cancelInfoEdit()
              }
              setActiveTab(tabKey)
            }}
            style={{
              padding: '8px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              color: activeTab === tabKey ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === tabKey ? 'var(--text)' : 'transparent'}`,
              fontFamily: 'system-ui,-apple-system,sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isEditingInfo && infoError && (
            <div
              style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                color: 'var(--red)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
              }}
            >
              {infoError}
            </div>
          )}

          <div style={surfaceCardStyle()}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: '8px',
              }}
            >
              Job
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Job Name:</strong>{' '}
              {!isEditingInfo ? (
                job.job_name || '—'
              ) : (
                <input
                  value={infoDraft.job_name}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, job_name: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px' }}>
              <strong>Project Address:</strong>{' '}
              {!isEditingInfo ? (
                job.project_address || '—'
              ) : (
                <input
                  value={infoDraft.project_address}
                  onChange={(e) =>
                    setInfoDraft((current) => ({
                      ...current,
                      project_address: e.target.value,
                    }))
                  }
                  style={inp}
                />
              )}
            </div>
          </div>

          <div style={surfaceCardStyle()}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: '8px',
              }}
            >
              Client
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Client Name:</strong>{' '}
              {!isEditingInfo ? (
                job.client_name || '—'
              ) : (
                <input
                  value={infoDraft.client_name}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, client_name: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Email:</strong>{' '}
              {!isEditingInfo ? (
                job.client_email || '—'
              ) : (
                <input
                  type="email"
                  autoComplete="email"
                  value={infoDraft.client_email}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, client_email: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px' }}>
              <strong>Phone:</strong>{' '}
              {!isEditingInfo ? (
                job.client_phone || '—'
              ) : (
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={infoDraft.client_phone}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, client_phone: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>
          </div>

          <div style={surfaceCardStyle()}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: '8px',
              }}
            >
              Project
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Sq Ft:</strong>{' '}
              {!isEditingInfo ? (
                job.sqft || '—'
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={infoDraft.sqft}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, sqft: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Lot Sq Ft:</strong>{' '}
              {!isEditingInfo ? (
                job.lot_sqft || '—'
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={infoDraft.lot_sqft}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, lot_sqft: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Referral Source:</strong>{' '}
              {!isEditingInfo ? (
                job.referral_source || '—'
              ) : (
                <select
                  value={infoDraft.referral_source}
                  onChange={(e) =>
                    setInfoDraft((current) => ({
                      ...current,
                      referral_source: e.target.value,
                    }))
                  }
                  style={inp}
                >
                  <option value="">Select referral</option>
                  {REFERRAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize: '12px' }}>
              <strong>Contract Type:</strong>{' '}
              {!isEditingInfo ? (
                job.contract_type === 'cost_plus' ? 'Cost Plus' : 'Fixed Price'
              ) : (
                <select
                  value={infoDraft.contract_type}
                  onChange={(e) =>
                    setInfoDraft((current) => ({
                      ...current,
                      contract_type: e.target.value,
                    }))
                  }
                  style={inp}
                >
                  <option value="fixed_price">Fixed Price</option>
                  <option value="cost_plus">Cost Plus</option>
                </select>
              )}
            </div>
          </div>

          <div style={surfaceCardStyle()}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: '8px',
              }}
            >
              Staff
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>PM:</strong>{' '}
              {!isEditingInfo ? (
                pmProfile?.full_name || '—'
              ) : (
                <select
                  value={infoDraft.pm_id}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, pm_id: e.target.value }))
                  }
                  style={inp}
                >
                  <option value="">Select project manager</option>
                  {pmOptions.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.full_name || 'Unnamed User'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Estimator:</strong>{' '}
              {!isEditingInfo ? (
                estimatorProfile?.full_name || '—'
              ) : (
                <select
                  value={infoDraft.estimator_profile_id}
                  onChange={(e) =>
                    setInfoDraft((current) => ({
                      ...current,
                      estimator_profile_id: e.target.value,
                    }))
                  }
                  style={inp}
                >
                  <option value="">Select estimator</option>
                  {estimatorOptions.map((estimator) => (
                    <option key={estimator.id} value={estimator.id}>
                      {estimator.full_name || 'Unnamed User'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Bookkeeper:</strong>{' '}
              {!isEditingInfo ? (
                bookkeeperProfile?.full_name || '—'
              ) : (
                <select
                  value={infoDraft.bookkeeper_profile_id}
                  onChange={(e) =>
                    setInfoDraft((current) => ({
                      ...current,
                      bookkeeper_profile_id: e.target.value,
                    }))
                  }
                  style={inp}
                >
                  <option value="">Select bookkeeper</option>
                  {bookkeeperOptions.map((bookkeeper) => (
                    <option key={bookkeeper.id} value={bookkeeper.id}>
                      {bookkeeper.full_name || 'Unnamed User'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize: '12px' }}>
              <strong>Phone:</strong> {pmProfile?.phone || '—'}
            </div>
          </div>

          <div style={surfaceCardStyle()}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: '8px',
              }}
            >
              Access
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Garage Code:</strong>{' '}
              {!isEditingInfo ? (
                job.garage_code || '—'
              ) : (
                <input
                  value={infoDraft.garage_code}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, garage_code: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Lockbox Code:</strong>{' '}
              {!isEditingInfo ? (
                job.lockbox_code || '—'
              ) : (
                <input
                  value={infoDraft.lockbox_code}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, lockbox_code: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Gate Code:</strong>{' '}
              {!isEditingInfo ? (
                job.gate_code || '—'
              ) : (
                <input
                  value={infoDraft.gate_code}
                  onChange={(e) =>
                    setInfoDraft((current) => ({ ...current, gate_code: e.target.value }))
                  }
                  style={inp}
                />
              )}
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Parking:</strong>{' '}
              {!isEditingInfo ? (
                job.parking_notes || '—'
              ) : (
                <div style={{ marginTop: '6px' }}>
                  <textarea
                    value={infoDraft.parking_notes}
                    onChange={(e) =>
                      setInfoDraft((current) => ({
                        ...current,
                        parking_notes: e.target.value,
                      }))
                    }
                    style={{ ...inp, minHeight: '60px', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>

            <div style={{ fontSize: '12px' }}>
              <strong>Neighborhood Requirements:</strong>{' '}
              {!isEditingInfo ? (
                job.neighborhood_requirements || '—'
              ) : (
                <div style={{ marginTop: '6px' }}>
                  <textarea
                    value={infoDraft.neighborhood_requirements}
                    onChange={(e) =>
                      setInfoDraft((current) => ({
                        ...current,
                        neighborhood_requirements: e.target.value,
                      }))
                    }
                    style={{ ...inp, minHeight: '60px', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={surfaceCardStyle()}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: '8px',
              }}
            >
              Operational
            </div>

            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
              <strong>Pipeline Stage:</strong> {stageLabels[job.current_stage] || job.current_stage}
            </div>

            <div style={{ fontSize: '12px' }}>
              <strong>Scope Notes:</strong>{' '}
              {!isEditingInfo ? (
                job.scope_notes || '—'
              ) : (
                <div style={{ marginTop: '6px' }}>
                  <textarea
                    value={infoDraft.scope_notes}
                    onChange={(e) =>
                      setInfoDraft((current) => ({
                        ...current,
                        scope_notes: e.target.value,
                      }))
                    }
                    style={{ ...inp, minHeight: '60px', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>
          </div>

          {canEditInfo && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {!isEditingInfo ? (
                <button
                  onClick={beginInfoEdit}
                  style={{
                    padding: '7px 14px',
                    background: 'var(--text)',
                    color: 'var(--bg)',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={cancelInfoEdit}
                    disabled={infoSaving}
                    style={{
                      padding: '7px 14px',
                      border: '1px solid var(--border)',
                      background: 'none',
                      color: 'var(--text-muted)',
                      borderRadius: '7px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: infoSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveInfo}
                    disabled={infoSaving}
                    style={{
                      padding: '7px 14px',
                      background: infoSaving ? 'var(--border)' : 'var(--text)',
                      color: 'var(--bg)',
                      border: 'none',
                      borderRadius: '7px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: infoSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {infoSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            {[
              {
                label: 'Open Issues',
                value: openIssueCount,
                color: openIssueCount ? 'var(--red)' : 'var(--text)',
              },
              {
                label: 'Released Schedule',
                value: releasedScheduleCount,
                color: 'var(--blue)',
              },
              {
                label: 'Confirmed Schedule',
                value: confirmedScheduleCount,
                color: 'var(--green)',
              },
              {
                label: 'Open Procurement',
                value: openProcurementCount,
                color: openProcurementCount ? 'var(--amber)' : 'var(--text)',
              },
            ].map((stat) => (
              <div key={stat.label} style={surfaceCardStyle()}>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                    marginBottom: '4px',
                    fontFamily: 'ui-monospace,monospace',
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...surfaceCardStyle(), marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
              Pipeline
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The pipeline tracks business progression from intake through construction. It is
              not just a generic checklist. For beta, it still uses the existing checklist engine
              underneath, but the meaning here is process progression.
            </div>
          </div>

          {stages.map((stage, idx) => {
            const items = stageItems[stage] || []
            if (!items.length) return null

            const stageState = getStageState(idx, curIdx)
            const checkedCount = items.filter((item: any) => checked[item.id]).length
            const pct = items.length ? Math.round((checkedCount / items.length) * 100) : 0

            return (
              <div
                key={stage}
                style={{
                  ...surfaceCardStyle(),
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '.05em',
                        color: stageState.color,
                      }}
                    >
                      {stageIcons[stage]} {stageLabels[stage]}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        border: `1px solid ${stageState.color}`,
                        color: stageState.color,
                      }}
                    >
                      {stageState.label}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      fontFamily: 'ui-monospace,monospace',
                    }}
                  >
                    {checkedCount}/{items.length} · {pct}%
                  </div>
                </div>

                <div
                  style={{
                    height: '4px',
                    background: 'var(--border)',
                    borderRadius: '999px',
                    marginBottom: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: stageState.color,
                      borderRadius: '999px',
                    }}
                  />
                </div>

                {items.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '5px 4px',
                      borderRadius: '5px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={(e) => toggleCheck(item.id, e.target.checked)}
                      style={{
                        width: '14px',
                        height: '14px',
                        flexShrink: 0,
                        marginTop: '2px',
                        accentColor: 'var(--blue)',
                        cursor: 'pointer',
                      }}
                    />
                    <label
                      onClick={() => toggleCheck(item.id, !checked[item.id])}
                      style={{
                        fontSize: '12px',
                        flex: 1,
                        lineHeight: 1.45,
                        cursor: 'pointer',
                        color: checked[item.id] ? 'var(--text-faint)' : 'var(--text)',
                        textDecoration: checked[item.id] ? 'line-through' : 'none',
                      }}
                    >
                      {item.label}
                    </label>
                    {item.is_required && (
                      <span
                        style={{
                          fontSize: '9px',
                          color: 'var(--red)',
                          fontFamily: 'ui-monospace,monospace',
                          flexShrink: 0,
                          marginTop: '3px',
                        }}
                      >
                        req
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'log' && (
        <div>
          <div style={{ ...surfaceCardStyle(), marginBottom: '10px' }}>
            <textarea
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Add a log entry..."
              style={{ ...inp, minHeight: '70px', resize: 'vertical', marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={addLog}
                disabled={logSaving || !logText.trim()}
                style={{
                  padding: '7px 16px',
                  background: logSaving || !logText.trim() ? 'var(--border)' : 'var(--text)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: logSaving || !logText.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {logSaving ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </div>

          <div style={surfaceCardStyle()}>
            {!logs.length ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  padding: '20px 0',
                  fontSize: '12px',
                }}
              >
                No log entries yet
              </div>
            ) : (
              logs.map((log: any) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '3px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: '600' }}>
                      {log.profiles?.full_name || 'Unknown'}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontFamily: 'ui-monospace,monospace',
                      }}
                    >
                      {new Date(log.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>
                    {log.body}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'issues' && (
        <div>
          <div style={{ ...surfaceCardStyle(), marginBottom: '10px' }}>
            {!showIssueForm ? (
              <button
                onClick={() => setShowIssueForm(true)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg)',
                  border: '1px dashed var(--border)',
                  borderRadius: '7px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                + Log Issue
              </button>
            ) : (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        marginBottom: '3px',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        fontFamily: 'ui-monospace,monospace',
                      }}
                    >
                      Severity
                    </label>
                    <select
                      style={inp}
                      value={issueSeverity}
                      onChange={(e) => setIssueSeverity(e.target.value)}
                    >
                      {['Critical', 'Warning', 'Info'].map((severity) => (
                        <option key={severity}>{severity}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        marginBottom: '3px',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        fontFamily: 'ui-monospace,monospace',
                      }}
                    >
                      Title
                    </label>
                    <input
                      style={inp}
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      placeholder="Brief description"
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        marginBottom: '3px',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        fontFamily: 'ui-monospace,monospace',
                      }}
                    >
                      Detail
                    </label>
                    <textarea
                      style={{ ...inp, minHeight: '60px', resize: 'vertical' }}
                      value={issueDetail}
                      onChange={(e) => setIssueDetail(e.target.value)}
                      placeholder="What happened, what is blocked, what needs follow-up..."
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowIssueForm(false)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '7px',
                      fontSize: '12px',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addIssue}
                    disabled={issueSaving || !issueTitle.trim()}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      border: 'none',
                      borderRadius: '7px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {issueSaving ? 'Saving...' : 'Log Issue'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={surfaceCardStyle()}>
            {!issues.length ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  padding: '20px 0',
                  fontSize: '12px',
                }}
              >
                No issues ✓
              </div>
            ) : (
              issues.map((issue: any) => (
                <div
                  key={issue.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      flexShrink: 0,
                      background: `${statusColors[issue.severity] || 'var(--amber)'}22`,
                      color: statusColors[issue.severity] || 'var(--amber)',
                      border: `1px solid ${(statusColors[issue.severity] || 'var(--amber)')}44`,
                    }}
                  >
                    {issue.severity}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        textDecoration: issue.resolved ? 'line-through' : 'none',
                        color: issue.resolved ? 'var(--text-faint)' : 'var(--text)',
                      }}
                    >
                      {issue.title}
                    </div>

                    {issue.detail && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                        }}
                      >
                        {issue.detail}
                      </div>
                    )}
                  </div>

                  {!issue.resolved ? (
                    <button
                      onClick={() => resolveIssue(issue.id)}
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        background: 'var(--green-bg)',
                        color: 'var(--green)',
                        border: '1px solid var(--green)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Resolve
                    </button>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--green)', flexShrink: 0 }}>
                      ✓
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '700' }}>Schedule</span>
            <a
              href={`/schedule/sub/new?jobId=${jobId}`}
              style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '4px 10px',
                background: 'var(--text)',
                color: 'var(--bg)',
                borderRadius: '5px',
                textDecoration: 'none',
              }}
            >
              + Schedule Item
            </a>
          </div>

          {!schedule.length ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              No schedule items yet
            </div>
          ) : (
            schedule.map((item: any) => {
              const badge = getScheduleBadge(item)
              const isBusy = actingScheduleId === item.id

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <a
                    href={`/schedule/sub/${item.id}/edit`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{item.trade}</div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.sub_name || 'Company TBD'}
                      {item.trade_contact ? ` · ${item.trade_contact}` : ''}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        marginTop: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          background: `${statusColors[item.status] || 'var(--text-muted)'}22`,
                          color: statusColors[item.status] || 'var(--text-muted)',
                          border: `1px solid ${(statusColors[item.status] || 'var(--text-muted)')}44`,
                        }}
                      >
                        {item.status}
                      </span>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          border: `1px solid ${badge.color}`,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>

                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          fontFamily: 'ui-monospace,monospace',
                        }}
                      >
                        {formatShortDate(item.start_date)} → {formatShortDate(item.end_date)}
                      </span>
                    </div>
                  </a>

                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {!item.is_released ? (
                      <button
                        onClick={() => releaseScheduleItem(item)}
                        disabled={isBusy}
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--blue)',
                          background: 'var(--blue-bg)',
                          color: 'var(--blue)',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isBusy ? '...' : 'Release'}
                      </button>
                    ) : (
                      <button
                        onClick={() => unreleaseScheduleItem(item)}
                        disabled={isBusy}
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text-muted)',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isBusy ? '...' : 'Unrelease'}
                      </button>
                    )}

                    {item.status !== 'confirmed' && (
                      <button
                        onClick={() => confirmScheduleItem(item)}
                        disabled={isBusy}
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--green)',
                          background: 'var(--green-bg)',
                          color: 'var(--green)',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isBusy ? '...' : 'Confirm'}
                      </button>
                    )}

                    <a
                      href={`/schedule/sub/${item.id}/edit`}
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        textDecoration: 'none',
                      }}
                    >
                      Edit
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'procurement' && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '700' }}>Procurement</span>
            <a
              href={`/schedule/order/new?jobId=${jobId}`}
              style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '4px 10px',
                background: 'var(--text)',
                color: 'var(--bg)',
                borderRadius: '5px',
                textDecoration: 'none',
              }}
            >
              + Procurement Item
            </a>
          </div>

          {!procurementItems.length ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              No procurement items yet
            </div>
          ) : (
            procurementItems.map((item: any) => {
              const daysToOrderBy = item.order_by_date
                ? Math.round(
                    (new Date(item.order_by_date).getTime() - Date.now()) / 86400000
                  )
                : null

              const flag =
                daysToOrderBy !== null && item.status === 'Pending'
                  ? daysToOrderBy < 0
                    ? 'overdue'
                    : daysToOrderBy <= 7
                      ? 'soon'
                      : 'ok'
                  : 'none'

              const sourceBadge = getProcurementSourceBadge(item)

              return (
                <a
                  key={item.id}
                  href={`/schedule/order/${item.id}/edit`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{item.description}</div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.trade}
                      {item.vendor ? ` · ${item.vendor}` : ''}
                      {item.procurement_group ? ` · ${item.procurement_group}` : ''}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        marginTop: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          background: `${statusColors[item.status] || 'var(--text-muted)'}22`,
                          color: statusColors[item.status] || 'var(--text-muted)',
                          border: `1px solid ${(statusColors[item.status] || 'var(--text-muted)')}44`,
                        }}
                      >
                        {item.status}
                      </span>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          border: `1px solid ${sourceBadge.color}`,
                          color: sourceBadge.color,
                        }}
                      >
                        {sourceBadge.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {item.order_by_date && (
                      <div
                        style={{
                          fontSize: '10px',
                          marginTop: '2px',
                          fontFamily: 'ui-monospace,monospace',
                          color:
                            flag === 'overdue'
                              ? 'var(--red)'
                              : flag === 'soon'
                                ? 'var(--amber)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {flag === 'overdue' ? '🔴 ' : flag === 'soon' ? '⚠️ ' : ''}
                        Order by {formatShortDate(item.order_by_date)}
                      </div>
                    )}
                  </div>
                </a>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'files' && <FilesTab jobId={jobId} />}
    </div>
  )
}