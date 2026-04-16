import type { ScopeContextItem } from './takeoffTypes'

type TakeoffScopeContextProps = {
  scopeItems: ScopeContextItem[]
}

const VISIBLE_SCOPE_TYPES = new Set([
  'job_type',
  'construction_type',
  'bedroom_count',
  'bathroom_count',
  'stories',
  'garage_stalls',
  'basement_type',
  'outdoor_living',
  'special_features',
  'scope_summary',
])

function cardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
  }
}

function normalizeConstructionType(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return '—'
  if (normalized.includes('ground')) return 'New Construction'
  if (normalized.includes('addition')) return 'Addition'
  return 'Remodel'
}

function renderScopeValue(item: ScopeContextItem) {
  if (item.scope_type === 'construction_type' && item.value_text?.trim()) {
    return normalizeConstructionType(item.value_text)
  }

  if (item.value_text?.trim()) return item.value_text
  if (item.value_number !== null && item.value_number !== undefined) return String(item.value_number)
  if (item.notes?.trim()) return item.notes
  return '—'
}

function getVisibleScopeItems(scopeItems: ScopeContextItem[]) {
  return [...scopeItems]
    .filter((item) => item.scope_type && VISIBLE_SCOPE_TYPES.has(item.scope_type))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export default function TakeoffScopeContext({ scopeItems }: TakeoffScopeContextProps) {
  const contextItems = getVisibleScopeItems(scopeItems)

  if (!contextItems.length) return null

  return (
    <div style={cardStyle()}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          marginBottom: '10px',
        }}
      >
        Scope Context
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '8px',
        }}
      >
        {contextItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
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
              {item.label}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>
              {renderScopeValue(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
