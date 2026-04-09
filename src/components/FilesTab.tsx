'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type VisibilityScope =
  | 'internal_only'
  | 'tagged_external'
  | 'all_external_except_client'
  | 'all_external_including_client'

type EntityType = 'job' | 'schedule_item' | 'procurement_item' | 'task'

type JobFile = {
  id: string
  category: string
  filename: string
  display_name: string | null
  storage_path: string
  size_bytes: number | null
  mime_type: string | null
  visibility_scope?: VisibilityScope | null
  include_in_packet?: boolean | null
  entity_type?: EntityType | null
  created_at: string
  uploaded_by: string | null
  client_visible?: boolean | null
  companies_visible?: boolean | null
  company_scope?: 'all' | 'selected' | null
}

const CATEGORIES = ['plans', 'photos', 'admin', 'financial', 'other'] as const
type KnownCategory = (typeof CATEGORIES)[number]

const VISIBILITY_OPTIONS: { value: VisibilityScope; label: string; help: string }[] = [
  {
    value: 'internal_only',
    label: 'Internal Only',
    help: 'Never visible to clients or external companies.',
  },
  {
    value: 'tagged_external',
    label: 'Tagged External Only',
    help: 'Visible only to matching external audiences through trade tags / packet rules.',
  },
  {
    value: 'all_external_except_client',
    label: 'All External Except Client',
    help: 'Visible to external companies, hidden from client.',
  },
  {
    value: 'all_external_including_client',
    label: 'All External Including Client',
    help: 'Visible to all external users, including client.',
  },
]

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

function getVisibilitySummary(file: JobFile) {
  if (file.visibility_scope) {
    switch (file.visibility_scope) {
      case 'internal_only':
        return 'Internal Only'
      case 'tagged_external':
        return 'Tagged External'
      case 'all_external_except_client':
        return 'All External Except Client'
      case 'all_external_including_client':
        return 'All External Including Client'
    }
  }

  const clientPart = file.client_visible ? 'Client Visible' : 'Client Hidden'

  if (!file.companies_visible) {
    return `${clientPart} · Companies Hidden`
  }

  if (file.company_scope === 'selected') {
    return `${clientPart} · Selected Companies`
  }

  return `${clientPart} · All Invited Companies`
}

function sectionCardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
  }
}

function getSafeDefaultVisibility(category: string): VisibilityScope {
  if (category === 'plans' || category === 'photos') {
    return 'tagged_external'
  }

  return 'internal_only'
}

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
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>('internal_only')
  const [includeInPacket, setIncludeInPacket] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setVisibilityScope(getSafeDefaultVisibility(category))
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
        formData.append('visibility_scope', visibilityScope)
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
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
          Upload Files
        </div>
        <div
          style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginBottom: '14px',
            lineHeight: 1.5,
          }}
        >
          Upload files into the job file system using the permanent visibility model.
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
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                fontFamily: 'ui-monospace,monospace',
              }}
            >
              Category
            </label>
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
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  fontFamily: 'ui-monospace,monospace',
                }}
              >
                Display Name
              </label>
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

          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px',
              background: 'var(--bg)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              Visibility
            </div>

            <select
              value={visibilityScope}
              onChange={(e) => setVisibilityScope(e.target.value as VisibilityScope)}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                background: 'var(--surface)',
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {VISIBILITY_OPTIONS.find((option) => option.value === visibilityScope)?.help}
            </div>
          </div>

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
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>(
    file.visibility_scope ?? 'internal_only'
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

    try {
      const response = await fetch('/api/files/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: file.id,
          display_name: displayName,
          category,
          visibility_scope: visibilityScope,
          include_in_packet: includeInPacket,
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
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
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
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                fontFamily: 'ui-monospace,monospace',
              }}
            >
              Display Name
            </label>
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
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                fontFamily: 'ui-monospace,monospace',
              }}
            >
              Category
            </label>
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

          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px',
              background: 'var(--bg)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              Visibility
            </div>

            <select
              value={visibilityScope}
              onChange={(e) => setVisibilityScope(e.target.value as VisibilityScope)}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                background: 'var(--surface)',
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {VISIBILITY_OPTIONS.find((option) => option.value === visibilityScope)?.help}
            </div>
          </div>

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
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen() }}
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

          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
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
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            Job files using the permanent visibility model.
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
                {categoryFiles.map((file, index) => (
                  <div key={file.id}>
                    <FileRow
                      file={file}
                      onUpdated={(updated) =>
                        setFiles((previous) =>
                          previous.map((f) => (f.id === updated.id ? updated : f))
                        )
                      }
                    />
                    {index === categoryFiles.length - 1 && <div style={{ height: 0 }} />}
                  </div>
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