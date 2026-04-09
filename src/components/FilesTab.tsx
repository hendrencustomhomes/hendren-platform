'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Trades ──────────────────────────────────────────────────────────────────

const TRADES = [
  'Concrete/Foundation',
  'Framing',
  'Rough Electrical',
  'Rough Plumbing',
  'HVAC',
  'Insulation',
  'Drywall',
  'Finish Electrical',
  'Finish Plumbing',
  'Tile',
  'Flooring',
  'Cabinetry',
  'Trim/Millwork',
  'Paint',
  'Exterior/Roofing',
  'Landscaping',
  'Demo',
  'Other',
] as const

type Trade = (typeof TRADES)[number]

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType = 'job' | 'schedule_item' | 'procurement_item' | 'task'

// Legacy scope kept only for reading old records
type LegacyVisibilityScope =
  | 'internal_only'
  | 'tagged_external'
  | 'all_external_except_client'
  | 'all_external_including_client'

type JobFile = {
  id: string
  category: string
  filename: string
  display_name: string | null
  storage_path: string
  size_bytes: number | null
  mime_type: string | null
  // New-style granular fields (primary)
  client_visible?: boolean | null
  companies_visible?: boolean | null
  company_scope?: 'all' | 'selected' | null
  // Legacy field (for reading old records)
  visibility_scope?: LegacyVisibilityScope | null
  include_in_packet?: boolean | null
  entity_type?: EntityType | null
  created_at: string
  uploaded_by: string | null
}

// In-session permission state driven by the checkboxes.
// Internal is always on — not stored here, always assumed.
type VisibilityState = {
  client: boolean
  // Trade names that are checked; empty = no trade access
  selectedTrades: Trade[]
}

// ─── Permission helpers ───────────────────────────────────────────────────────

function defaultVisibilityState(): VisibilityState {
  return { client: false, selectedTrades: [] }
}

/**
 * Reconstruct checkbox state from a loaded file record.
 * Granular fields (client_visible, companies_visible, company_scope) are
 * the source of truth — always set by the API. Legacy visibility_scope is
 * only used as a fallback for records that predate the granular columns.
 *
 * Limitation: company_scope='selected' means "some trades" but the DB has
 * no per-file trade list, so individual trade selections cannot be restored
 * after save. The summary still shows "Some Trades".
 */
function deriveVisibilityState(file: JobFile): VisibilityState {
  const hasGranularFields =
    (file.client_visible !== undefined && file.client_visible !== null) ||
    (file.companies_visible !== undefined && file.companies_visible !== null)

  if (!hasGranularFields && file.visibility_scope) {
    switch (file.visibility_scope) {
      case 'internal_only':
        return { client: false, selectedTrades: [] }
      case 'tagged_external':
        return { client: true, selectedTrades: [] }
      case 'all_external_except_client':
        return { client: false, selectedTrades: [...TRADES] }
      case 'all_external_including_client':
        return { client: true, selectedTrades: [...TRADES] }
    }
  }

  const client = file.client_visible ?? false
  const selectedTrades: Trade[] =
    file.companies_visible && file.company_scope === 'all' ? [...TRADES] : []

  return { client, selectedTrades }
}

/**
 * Map checkbox state to DB columns.
 * Derives a legacy visibility_scope value for backward compat.
 */
function visibilityToPayload(state: VisibilityState) {
  const companiesVisible = state.selectedTrades.length > 0
  const allTradesChecked = state.selectedTrades.length === TRADES.length
  const companyScope: 'all' | 'selected' | null = companiesVisible
    ? allTradesChecked
      ? 'all'
      : 'selected'
    : null

  let visibilityScope: LegacyVisibilityScope
  if (!companiesVisible && !state.client) {
    visibilityScope = 'internal_only'
  } else if (companiesVisible && allTradesChecked && !state.client) {
    visibilityScope = 'all_external_except_client'
  } else if (companiesVisible && state.client) {
    visibilityScope = 'all_external_including_client'
  } else {
    visibilityScope = 'tagged_external'
  }

  return {
    client_visible: state.client,
    companies_visible: companiesVisible,
    company_scope: companyScope,
    visibility_scope: visibilityScope,
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function getVisibilitySummary(file: JobFile): string {
  const parts: string[] = ['Internal']

  if (file.client_visible) parts.push('Client')

  if (file.companies_visible) {
    parts.push(file.company_scope === 'all' ? 'All Trades' : 'Some Trades')
  } else if (
    file.visibility_scope === 'tagged_external' ||
    file.visibility_scope === 'all_external_except_client' ||
    file.visibility_scope === 'all_external_including_client'
  ) {
    // Fallback for legacy records without granular fields
    parts.push('Trades')
  }

  return parts.join(' · ')
}

const CATEGORIES = ['plans', 'photos', 'admin', 'financial', 'other'] as const
type KnownCategory = (typeof CATEGORIES)[number]

function formatBytes(value: number | null) {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function titleizeCategory(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getCategoryLabel(category: string) {
  return titleizeCategory(category)
}

function getSafeDefaultVisibility(category: string): VisibilityState {
  if (category === 'plans' || category === 'photos') {
    return { client: false, selectedTrades: [...TRADES] }
  }
  return defaultVisibilityState()
}

function sectionCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
  }
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    fontFamily: 'ui-monospace,monospace',
  }
}

// ─── VisibilityPicker ─────────────────────────────────────────────────────────

function VisibilityPicker({
  state,
  onChange,
}: {
  state: VisibilityState
  onChange: (next: VisibilityState) => void
}) {
  const [tradesOpen, setTradesOpen] = useState(false)

  const allTradesChecked = state.selectedTrades.length === TRADES.length
  const someTradesChecked = state.selectedTrades.length > 0 && !allTradesChecked

  function toggleAllTrades(checked: boolean) {
    onChange({ ...state, selectedTrades: checked ? [...TRADES] : [] })
  }

  function toggleTrade(trade: Trade, checked: boolean) {
    // If a trade is manually unchecked, only that trade is removed.
    // All Trades visually de-selects (indeterminate → unchecked)
    // but remaining trades stay selected.
    const next: Trade[] = checked
      ? ([...state.selectedTrades, trade] as Trade[])
      : state.selectedTrades.filter((t) => t !== trade)
    onChange({ ...state, selectedTrades: next })
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    fontSize: '14px',
    color: 'var(--text)',
  } as const

  const checkStyle = {
    width: '18px',
    height: '18px',
    flexShrink: 0,
    accentColor: 'var(--text)',
    cursor: 'pointer',
  } as const

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '12px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Visibility</div>

      {/* Internal — always on, not editable */}
      <div style={{ ...rowStyle, opacity: 0.55, cursor: 'default' }}>
        <input
          type="checkbox"
          checked
          readOnly
          style={{ ...checkStyle, cursor: 'not-allowed' }}
        />
        <span>
          <strong>Internal</strong>
          <span style={{ marginLeft: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            (always visible to your team)
          </span>
        </span>
      </div>

      {/* Client */}
      <label style={{ ...rowStyle, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={state.client}
          onChange={(e) => onChange({ ...state, client: e.target.checked })}
          style={checkStyle}
        />
        Client
      </label>

      <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />

      {/* All Trades — shows indeterminate when some (not all) trades are selected */}
      <label style={{ ...rowStyle, cursor: 'pointer' }}>
        <input
          type="checkbox"
          ref={(el) => {
            if (el) el.indeterminate = someTradesChecked
          }}
          checked={allTradesChecked}
          onChange={(e) => toggleAllTrades(e.target.checked)}
          style={checkStyle}
        />
        All Trades
      </label>

      {/* Toggle individual trades */}
      <button
        type="button"
        onClick={() => setTradesOpen((open) => !open)}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px 0 4px 28px',
          fontSize: '12px',
          color: 'var(--blue)',
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {tradesOpen ? '▲ Hide individual trades' : '▼ Select individual trades'}
        {someTradesChecked && (
          <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
            ({state.selectedTrades.length}/{TRADES.length})
          </span>
        )}
      </button>

      {tradesOpen && (
        <div
          style={{
            maxHeight: '180px',
            overflowY: 'auto',
            borderTop: '1px solid var(--border)',
            marginTop: '4px',
            paddingTop: '4px',
          }}
        >
          {TRADES.map((trade) => (
            <label
              key={trade}
              style={{ ...rowStyle, cursor: 'pointer', paddingLeft: '28px' }}
            >
              <input
                type="checkbox"
                checked={state.selectedTrades.includes(trade)}
                onChange={(e) => toggleTrade(trade, e.target.checked)}
                style={checkStyle}
              />
              {trade}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── UploadModal ──────────────────────────────────────────────────────────────

function UploadModal({
  jobId,
  onClose,
  onUploaded,
}: {
  jobId: string
  onClose: () => void
  onUploaded: (files: JobFile[]) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState<string>('other')
  const [displayName, setDisplayName] = useState('')
  const [visibility, setVisibility] = useState<VisibilityState>(defaultVisibilityState())
  const [includeInPacket, setIncludeInPacket] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setVisibility(getSafeDefaultVisibility(category))
    if (category !== 'plans' && category !== 'photos') {
      setIncludeInPacket(false)
    }
  }, [category])

  async function handleSubmit() {
    if (!files.length) {
      setError('Select at least one file first.')
      return
    }

    setUploading(true)
    setError(null)

    const payload = visibilityToPayload(visibility)

    try {
      const uploadedFiles: JobFile[] = []

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('job_id', jobId)
        formData.append('category', category)
        formData.append(
          'display_name',
          files.length === 1 ? displayName || file.name : file.name
        )
        formData.append('client_visible', String(payload.client_visible))
        formData.append('companies_visible', String(payload.companies_visible))
        formData.append('company_scope', payload.company_scope ?? '')
        formData.append('visibility_scope', payload.visibility_scope)
        formData.append('include_in_packet', String(includeInPacket))
        formData.append('entity_type', 'job')

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? 'Upload failed')
        }

        const { file: uploaded } = (await response.json()) as { file: JobFile }
        uploadedFiles.push(uploaded)
      }

      onUploaded(uploadedFiles)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const selectedFileLabel =
    files.length === 0
      ? 'Tap to select file(s)'
      : files.length === 1
        ? files[0].name
        : `${files.length} files selected`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.20)',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
          Upload Files
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? [])
                setFiles(selected)
                if (selected.length === 1 && !displayName) {
                  setDisplayName(selected[0].name)
                }
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                width: '100%',
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                padding: '22px 14px',
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {selectedFileLabel}
            </button>
          </div>

          <div>
            <label style={labelStyle()}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {getCategoryLabel(item)}
                </option>
              ))}
            </select>
          </div>

          {files.length <= 1 && (
            <div>
              <label style={labelStyle()}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={files[0]?.name ?? 'File label'}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '16px',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <VisibilityPicker state={visibility} onChange={setVisibility} />

          {(category === 'plans' || category === 'photos') && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                background: 'var(--bg)',
              }}
            >
              <input
                type="checkbox"
                checked={includeInPacket}
                onChange={(e) => setIncludeInPacket(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Include in job packet
            </label>
          )}

          {error && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--red)',
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading || files.length === 0}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                background: uploading || files.length === 0 ? 'var(--border)' : 'var(--text)',
                color: 'var(--bg)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: uploading || files.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? 'Uploading...' : files.length > 1 ? 'Upload Files' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── EditFileModal ────────────────────────────────────────────────────────────

function EditFileModal({
  file,
  onClose,
  onUpdated,
}: {
  file: JobFile
  onClose: () => void
  onUpdated: (file: JobFile) => void
}) {
  const [category, setCategory] = useState<string>(file.category)
  const [displayName, setDisplayName] = useState(file.display_name ?? '')
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    deriveVisibilityState(file)
  )
  const [includeInPacket, setIncludeInPacket] = useState(file.include_in_packet ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (category !== 'plans' && category !== 'photos') {
      setIncludeInPacket(false)
    }
  }, [category])

  async function handleSave() {
    setSaving(true)
    setError(null)

    const payload = visibilityToPayload(visibility)

    try {
      const response = await fetch('/api/files/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: file.id,
          display_name: displayName.trim() || file.filename,
          category,
          include_in_packet: includeInPacket,
          ...payload,
        }),
      })

      const body = await response.json().catch(() => ({} as { error?: string; file?: JobFile }))

      if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? 'Save failed')
      }

      onUpdated((body as { file: JobFile }).file)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.20)',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
          Edit File Info
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            marginBottom: '14px',
            wordBreak: 'break-word',
          }}
        >
          {file.filename}
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={labelStyle()}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={file.filename}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                background: 'var(--surface)',
                color: 'var(--text)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={labelStyle()}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {getCategoryLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <VisibilityPicker state={visibility} onChange={setVisibility} />

          {(category === 'plans' || category === 'photos') && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                background: 'var(--bg)',
              }}
            >
              <input
                type="checkbox"
                checked={includeInPacket}
                onChange={(e) => setIncludeInPacket(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Include in job packet
            </label>
          )}

          {error && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--red)',
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                background: saving ? 'var(--border)' : 'var(--text)',
                color: 'var(--bg)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FileRow ──────────────────────────────────────────────────────────────────

function FileRow({ file, onUpdated }: { file: JobFile; onUpdated: (file: JobFile) => void }) {
  const [opening, setOpening] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    const popup = window.open('about:blank', '_blank')

    if (!popup) {
      setError('Popup blocked. Allow popups for this site and try again.')
      return
    }

    try {
      popup.opener = null
    } catch {}

    setOpening(true)
    setError(null)

    try {
      const response = await fetch(`/api/files/signed-url?file_id=${file.id}`)
      const body = await response.json().catch(() => ({} as { error?: string; url?: string }))

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not open file')
      }

      if (!body.url) {
        throw new Error('Signed URL missing from response')
      }

      popup.location.href = body.url
    } catch (err) {
      popup.close()
      setError(err instanceof Error ? err.message : 'Could not open file')
    } finally {
      setOpening(false)
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleOpen()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          cursor: opening ? 'wait' : 'pointer',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '3px',
              wordBreak: 'break-word',
            }}
          >
            {file.display_name || file.filename}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {formatBytes(file.size_bytes)}
            {file.size_bytes ? ' · ' : ''}
            {formatDate(file.created_at)}
            {' · '}
            {getVisibilitySummary(file)}
            {file.include_in_packet ? ' · In Packet' : ''}
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>
              {error}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="File actions"
          onClick={(e) => {
            e.stopPropagation()
            setShowEdit(true)
          }}
          style={{
            flexShrink: 0,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-muted)',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ⋮
        </button>
      </div>

      {showEdit && (
        <EditFileModal
          file={file}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            onUpdated(updated)
            setShowEdit(false)
          }}
        />
      )}
    </>
  )
}

// ─── FilesTab ─────────────────────────────────────────────────────────────────

export default function FilesTab({ jobId }: { jobId: string }) {
  const [files, setFiles] = useState<JobFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/files/list?job_id=${jobId}`)
      .then((response) => response.json())
      .then((data: { files?: JobFile[]; error?: string }) => {
        if (!active) return
        if (data.error) throw new Error(data.error)
        setFiles(data.files ?? [])
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [jobId])

  const allCategories = useMemo(() => {
    const dynamicCategories = Array.from(new Set(files.map((file) => file.category))).filter(
      (category) => !CATEGORIES.includes(category as KnownCategory)
    )
    return [...CATEGORIES, ...dynamicCategories]
  }, [files])

  const grouped = useMemo(() => {
    return allCategories.reduce<Record<string, JobFile[]>>((acc, category) => {
      acc[category] = files.filter((file) => file.category === category)
      return acc
    }, {})
  }, [allCategories, files])

  return (
    <div style={{ padding: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Files</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Job files and visibility settings.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowUpload(true)}
          style={{
            background: 'var(--text)',
            color: 'var(--bg)',
            fontSize: '14px',
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + Upload
        </button>
      </div>

      {loading && (
        <div
          style={{
            ...sectionCardStyle(),
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          Loading files...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            ...sectionCardStyle(),
            padding: '16px',
            color: 'var(--red)',
            background: 'var(--red-bg)',
            border: '1px solid var(--red)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div
          style={{
            ...sectionCardStyle(),
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          No files yet.
        </div>
      )}

      {!loading &&
        !error &&
        files.length > 0 &&
        allCategories.map((category) => {
          const categoryFiles = grouped[category] || []
          if (!categoryFiles.length) return null

          return (
            <div key={category} style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  fontFamily: 'ui-monospace,monospace',
                }}
              >
                {getCategoryLabel(category)}
              </div>

              <div style={sectionCardStyle()}>
                {categoryFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onUpdated={(updated) =>
                      setFiles((previous) =>
                        previous.map((f) => (f.id === updated.id ? updated : f))
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )
        })}

      {showUpload && (
        <UploadModal
          jobId={jobId}
          onClose={() => setShowUpload(false)}
          onUploaded={(uploadedFiles) =>
            setFiles((previous) => [...uploadedFiles, ...previous])
          }
        />
      )}
    </div>
  )
}
