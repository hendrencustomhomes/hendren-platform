'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type JobFile = {
  id: string
  category: string
  filename: string
  display_name: string | null
  storage_path: string
  size_bytes: number | null
  mime_type: string | null
  client_visible: boolean
  companies_visible?: boolean | null
  company_scope?: 'all' | 'selected' | null
  created_at: string
  uploaded_by: string | null
}

const CATEGORIES = [
  'contracts',
  'plans',
  'photos',
  'selections',
  'permits',
  'lien-waivers',
  'change-orders',
  'other',
  'coi',
  'w9',
  'general-contract',
  'admin',
] as const

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

function getVisibilitySummary(file: JobFile) {
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

function UploadModal({
  jobId,
  onClose,
  onUploaded,
}: {
  jobId: string
  onClose: () => void
  onUploaded: (file: JobFile) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<string>('other')
  const [displayName, setDisplayName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientVisible, setClientVisible] = useState(false)
  const [companiesVisible, setCompaniesVisible] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!file) {
      setError('Select a file first.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('job_id', jobId)
      formData.append('category', category)
      formData.append('display_name', displayName || file.name)
      formData.append('client_visible', String(clientVisible))
      formData.append('companies_visible', String(companiesVisible))

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Upload failed')
      }

      const { file: uploaded } = (await response.json()) as { file: JobFile }
      onUploaded(uploaded)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
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
          Upload File
        </div>
        <div
          style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginBottom: '14px',
            lineHeight: 1.5,
          }}
        >
          Upload into the job file system and set who should be able to see it.
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null
                setFile(selected)
                if (selected && !displayName) {
                  setDisplayName(selected.name)
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
              {file ? file.name : 'Tap to select a file'}
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
              placeholder={file?.name ?? 'File label'}
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

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                marginBottom: '10px',
                color: 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={clientVisible}
                onChange={(e) => setClientVisible(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Client visible
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={companiesVisible}
                onChange={(e) => setCompaniesVisible(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Visible to companies
            </label>
          </div>

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
              disabled={uploading || !file}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                background: uploading || !file ? 'var(--border)' : 'var(--text)',
                color: 'var(--bg)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: uploading || !file ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FileRow({ file }: { file: JobFile }) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    setOpening(true)
    setError(null)

    try {
      const response = await fetch(`/api/files/signed-url?file_id=${file.id}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Could not open file')
      }

      const { url } = (await response.json()) as { url: string }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open file')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
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
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>
            {error}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        style={{
          flexShrink: 0,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--blue)',
          borderRadius: '10px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: opening ? 'not-allowed' : 'pointer',
        }}
      >
        {opening ? '...' : 'Open'}
      </button>
    </div>
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
            Job files with client and company visibility controls
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
                    <FileRow file={file} />
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
          onUploaded={(file) => setFiles((previous) => [file, ...previous])}
        />
      )}
    </div>
  )
}