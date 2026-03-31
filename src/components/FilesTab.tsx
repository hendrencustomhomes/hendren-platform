'use client'

import { useEffect, useState, useRef } from 'react'

type JobFile = {
  id: string; category: string; filename: string; display_name: string | null
  storage_path: string; size_bytes: number | null; mime_type: string | null
  client_visible: boolean; created_at: string; uploaded_by: string | null
}
const CATEGORIES = ['plans', 'photos', 'admin', 'other'] as const
type Category = (typeof CATEGORIES)[number]

function formatBytes(n: number | null) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function UploadModal({ jobId, onClose, onUploaded }: { jobId: string; onClose: () => void; onUploaded: (f: JobFile) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<Category>('other')
  const [displayName, setDisplayName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!file) { setError('Select a file first.'); return }
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('job_id', jobId)
      fd.append('category', category); fd.append('display_name', displayName || file.name)
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as { error?: string }).error ?? 'Upload failed')
      }
      const { file: uploaded } = await res.json() as { file: JobFile }
      onUploaded(uploaded); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Upload File</h2>
        <div>
          <input ref={inputRef} type="file" className="hidden"
            onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !displayName) setDisplayName(f.name) }} />
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-sm text-gray-500 hover:border-blue-400">
            {file ? file.name : 'Tap to select a file'}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as Category)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder={file?.name ?? 'File label'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={uploading}
            className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={uploading || !file}
            className="flex-1 bg-blue-600 disabled:bg-blue-300 rounded-xl py-2.5 text-sm font-medium text-white">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FileRow({ file }: { file: JobFile }) {
  const [opening, setOpening] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleOpen() {
    setOpening(true); setErr(null)
    try {
      const res = await fetch('/api/files/signed-url?file_id=' + file.id)
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as { error?: string }).error ?? 'Error')
      }
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not open') }
    finally { setOpening(false) }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{file.display_name || file.filename}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatBytes(file.size_bytes)}{file.size_bytes ? ' · ' : ''}{formatDate(file.created_at)}
        </p>
        {err && <p className="text-xs text-red-500 mt-0.5">{err}</p>}
      </div>
      <button type="button" onClick={handleOpen} disabled={opening}
        className="shrink-0 text-xs font-medium text-blue-600 disabled:text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-50">
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
    let active = true; setLoading(true)
    fetch('/api/files/list?job_id=' + jobId)
      .then(r => r.json())
      .then((d: { files?: JobFile[]; error?: string }) => {
        if (!active) return
        if (d.error) throw new Error(d.error)
        setFiles(d.files ?? [])
      })
      .catch((e: Error) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [jobId])

  const grouped = CATEGORIES.reduce<Record<Category, JobFile[]>>(
    (acc, cat) => { acc[cat] = files.filter(f => f.category === cat); return acc },
    { plans: [], photos: [], admin: [], other: [] }
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Files</h2>
        <button type="button" onClick={() => setShowUpload(true)}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700">
          + Upload
        </button>
      </div>
      {loading && <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>}
      {!loading && error && <p className="text-sm text-red-500 py-4">{error}</p>}
      {!loading && !error && files.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No files yet.</p>}
      {!loading && !error && files.length > 0 && CATEGORIES.map(cat => grouped[cat].length > 0 && (
        <div key={cat} className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
            {grouped[cat].map(f => <FileRow key={f.id} file={f} />)}
          </div>
        </div>
      ))}
      {showUpload && <UploadModal jobId={jobId} onClose={() => setShowUpload(false)} onUploaded={f => setFiles(p => [f, ...p])} />}
    </div>
  )
}
