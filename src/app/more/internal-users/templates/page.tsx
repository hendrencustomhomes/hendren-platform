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
  borderRadius: '14px',
  overflow: 'hidden',
} as const

const sectionHeaderStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
} as const

const sectionTitleStyle = {
  fontSize: '12px',
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
  padding: '6px 9px',
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: 1.2,
  cursor: 'pointer',
} as const

const solidBtnStyle = {
  background: 'var(--text)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: '8px',
  padding: '7px 11px',
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: 1.2,
  cursor: 'pointer',
} as const

const stickyActionBarStyle = {
  position: 'sticky' as const,
  bottom: 0,
  background: 'var(--surface)',
  borderTop: '1px solid var(--border)',
  padding: '10px 12px',
  display: 'flex',
  justifyContent: 'flex-end',
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
    if ('error' in res) {
      setError(res.error ?? '')
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

    if ('error' in res) {
      setError(res.error ?? '')
      return
    }

    setTemplatePermissions((current) => ({ ...current, [selectedTemplateKey]: permissionMatrix }))
    setSuccess('Template saved.')
  }

  if (loading) {
    return (
      <>
        <Nav title="Templates" />
        <div style={{ padding: 12, fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</div>
      </>
    )
  }

  return (
    <>
      <Nav title="Templates" />

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedTemplateKey ? (PERMISSION_TEMPLATE_LABELS[selectedTemplateKey] || selectedTemplateKey) : 'None selected'}</span>
          </div>

          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {error && <div style={{ color: '#fca5a5', fontSize: '12px' }}>{error}</div>}
            {success && <div style={{ color: '#86efac', fontSize: '12px' }}>{success}</div>}

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 420 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(136px,1.6fr) 46px 58px 54px', gap: 4, paddingBottom: 5, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div>Module</div>
                  <div style={{ textAlign: 'center' }}>View</div>
                  <div style={{ textAlign: 'center' }}>Manage</div>
                  <div style={{ textAlign: 'center' }}>Assign</div>
                </div>

                {permissionMatrix.map((row, index) => {
                  const isLockedView = LOCKED_BASELINE_VIEW_ROWS.includes(row.rowKey)
                  return (
                    <div key={row.rowKey} style={{ display: 'grid', gridTemplateColumns: 'minmax(136px,1.6fr) 46px 58px 54px', gap: 4, alignItems: 'center', padding: '7px 0', borderTop: index === 0 ? '1px solid var(--border)' : '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.2 }}>{PERMISSION_ROW_LABELS[row.rowKey] || row.rowKey}</div>
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
          </div>

          <div style={stickyActionBarStyle}>
            <button type="button" onClick={handleSave} style={solidBtnStyle} disabled={saving || !selectedTemplateKey}>
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
