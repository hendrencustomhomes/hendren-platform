import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/layout/SectionHeader'
import { StatusPill } from '@/components/data-display/StatusPill'
import type { PricingHeader } from '@/lib/pricing-sources-types'

type Props = {
  header: PricingHeader
  missingLabel: string
  companyName?: string
  tradeName?: string
  costCodeLabel?: string
  canManage: boolean
  savingHeader: boolean
  creatingRevision: boolean
  title: string
  status: string
  effectiveDate: string
  notes: string
  isActive: boolean
  onTitleChange: (value: string) => void
  onStatusChange: (value: string) => void
  onEffectiveDateChange: (value: string) => void
  onNotesChange: (value: string) => void
  onIsActiveChange: (value: boolean) => void
  onSaveHeader: () => void
  onCreateRevision: () => void
}

const inputStyle = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
} as const

const fieldsetResetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0,
} as const

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

export function PricingWorksheetHeader({
  header,
  missingLabel,
  companyName,
  tradeName,
  costCodeLabel,
  canManage,
  savingHeader,
  creatingRevision,
  title,
  status,
  effectiveDate,
  notes,
  isActive,
  onTitleChange,
  onStatusChange,
  onEffectiveDateChange,
  onNotesChange,
  onIsActiveChange,
  onSaveHeader,
  onCreateRevision,
}: Props) {
  return (
    <Card>
      <SectionHeader
        title="Header"
        right={[
          <StatusPill key="revision" text={`rev ${header.revision}`} />,
          <StatusPill key="status" text={header.status} />,
          <StatusPill
            key="active"
            text={header.is_active ? 'active' : 'inactive'}
            tone={header.is_active ? 'active' : 'warning'}
          />,
        ]}
      />

      <fieldset disabled={!canManage} style={fieldsetResetStyle}>
        <div
          style={{
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
          }}
        >
          <div style={{ gridColumn: '1 / -1' }}>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              Title
            </div>
            <input value={title} onChange={(e) => onTitleChange(e.target.value)} style={inputStyle} />
          </div>

          <Field label="Company" value={companyName} />
          <Field label="Trade" value={tradeName} />
          <Field label="Cost Code" value={costCodeLabel} />

          <div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              Status
            </div>
            <select value={status} onChange={(e) => onStatusChange(e.target.value)} style={inputStyle}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="superseded">superseded</option>
              <option value="archived">archived</option>
              <option value="received">received</option>
            </select>
          </div>

          <div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              Effective Date
            </div>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => onEffectiveDateChange(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => onIsActiveChange(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Active
            </label>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              Notes
            </div>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
            />
          </div>

          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Saving here edits the current {missingLabel.toLowerCase()}. Creating a new revision makes a separate updated {missingLabel.toLowerCase()} record.
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={onCreateRevision}
                disabled={creatingRevision}
                style={{
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: creatingRevision ? 'not-allowed' : 'pointer',
                  opacity: creatingRevision ? 0.7 : 1,
                }}
              >
                {creatingRevision ? 'Creating New Revision…' : 'Create New Revision'}
              </button>
              <button
                type="button"
                onClick={onSaveHeader}
                disabled={savingHeader}
                style={{
                  background: 'var(--text)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: savingHeader ? 'not-allowed' : 'pointer',
                  opacity: savingHeader ? 0.7 : 1,
                }}
              >
                {savingHeader ? 'Saving Current Sheet…' : 'Save Current Sheet'}
              </button>
            </div>
          </div>
        </div>
      </fieldset>
    </Card>
  )
}
