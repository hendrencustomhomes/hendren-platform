'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import {
  LOCKED_BASELINE_VIEW_ROWS,
  normalizePermissionState,
  PERMISSION_ROW_LABELS,
  PERMISSION_ROW_KEYS,
  PERMISSION_TEMPLATE_LABELS,
  type PermissionMatrixCell,
  type PermissionRowKey,
  type PermissionTemplateKey,
} from '@/lib/access-control'
import {
  getPermissionTemplateManagerAction,
  savePermissionTemplateAction,
} from '../access-actions'

const sectionCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  overflow: 'hidden',
} as const

const sectionHeaderStyle = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
} as const

const sectionTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const

const ghostBtnStyle = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

const solidBtnStyle = {
  background: 'var(--text)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const

type CatalogOption = {
  id: string
  key: string
  label: string
}

type TemplatePermissionsMap = Record<string, PermissionMatrixCell[]>

function getEmptyMatrix() {
  return PERMISSION_ROW_KEYS.map((rowKey) => ({
    rowKey,
    ...normalizePermissionState(rowKey, { canView: false, canManage: false, canAssign: false }),
  }))
}

export default function PermissionTemplatesPage() {
  const [templates, setTemplates] = useState<CatalogOption[]>([])
  const [templatePermissions, setTemplatePermissions] = useState<TemplatePermissionsMap>({})
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<PermissionTemplateKey | ''>('')
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrixCell[]>(getEmptyMatrix())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')

    const res = await getPermissionTemplateManagerAction()
    if (res?.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    const nextTemplates = (res?.templates || []) as CatalogOption[]
    const nextTemplatePermissions = (res?.templatePermissions || {}) as TemplatePermissionsMap
    const initialTemplateKey = (nextTemplates[0]?.key || '') as PermissionTemplateKey | ''

    setTemplates(nextTemplates)
    setTemplatePermissions(nextTemplatePermissions)
    setSelectedTemplateKey(initialTemplateKey)
    setPermissionMatrix(initialTemplateKey ? (nextTemplatePermissions[initialTemplateKey] || getEmptyMatrix()) : getEmptyMatrix())
    setLoading(false)
  }

  function selectTemplate(templateKey: PermissionTemplateKey) {
    setSelectedTemplateKey(templateKey)
    setError('')
    setSuccess('')
    setPermissionMatrix(templatePermissions[templateKey] || getEmptyMatrix())
  }

  function updatePermission(rowKey: PermissionRowKey, field: 'canView' | 'canManage' | 'canAssign', checked: boolean) {
    setPermissionMatrix((current) =>
      current.map((row) => {
        if (row.rowKey !== rowKey) return row
        return {
          rowKey,
          ...normalizePermissionState(rowKey, {
            canView: field === 'canView' ? checked : row.canView,
            canManage: field === 'canManage' ? checked : row.canManage,
            canAssign: field === 'canAssign' ? checked : row.canAssign,
          }),
        }
      })
    )
  }

  async function handleSave() {
    if (!selectedTemplateKey) {
      setError('Select a template first.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const res = await savePermissionTemplateAction({
      templateKey: selectedTemplateKey,
      permissions: permissionMatrix,
    })

    setSaving(false)

    if (res?.error) {
      setError(res.error)
      return
    }

    setTemplatePermissions((current) => ({ ...current, [selectedTemplateKey]: permissionMatrix }))
    setSuccess('Template saved.')
  }

  if (loading) {
    return (
      <>
        <Nav title="Templates" />
        <div style={{ padding: 16, fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</div>
      </>
    )
  }

  return (
    <>
      <Nav title="Templates" />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/more/internal-users" style={{ ...ghostBtnStyle, textDecoration: 'none' }}>
            Back to Users
          </Link>
          {templates.map((template) => (
            <button key={template.id} type="button" onClick={() => selectTemplate(template.key as PermissionTemplateKey)} style={{ ...ghostBtnStyle, background: selectedTemplateKey === template.key ? 'var(--text)' : 'transparent', color: selectedTemplateKey === template.key ? 'var(--surface)' : 'var(--text)' }}>
              {template.label || PERMISSION_TEMPLATE_LABELS[template.key as PermissionTemplateKey]}
            </button>
          ))}
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Template Matrix</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedTemplateKey ? (PERMISSION_TEMPLATE_LABELS[selectedTemplateKey] || selectedTemplateKey) : 'None selected'}</span>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={{ color: '#fca5a5', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: '#86efac', fontSize: '13px' }}>{success}</div>}

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 560 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.5fr 0.7fr 0.7fr', gap: 8, paddingBottom: 8, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <div>Module</div>
                  <div style={{ textAlign: 'center' }}>View</div>
                  <div style={{ textAlign: 'center' }}>Manage</div>
                  <div style={{ textAlign: 'center' }}>Assign</div>
                </div>

                {permissionMatrix.map((row, index) => {
                  const isLockedView = LOCKED_BASELINE_VIEW_ROWS.includes(row.rowKey)
                  return (
                    <div key={row.rowKey} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.5fr 0.7fr 0.7fr', gap: 8, alignItems: 'center', padding: '10px 0', borderTop: index === 0 ? '1px solid var(--border)' : '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text)' }}>{PERMISSION_ROW_LABELS[row.rowKey] || row.rowKey}</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="checkbox" checked={row.canView} disabled={isLockedView} onChange={(e) => updatePermission(row.rowKey, 'canView', e.target.checked)} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="checkbox" checked={row.canManage} onChange={(e) => updatePermission(row.rowKey, 'canManage', e.target.checked)} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="checkbox" checked={row.canAssign} onChange={(e) => updatePermission(row.rowKey, 'canAssign', e.target.checked)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <button type="button" onClick={handleSave} style={solidBtnStyle} disabled={saving || !selectedTemplateKey}>
                {saving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
