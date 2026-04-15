import type { TakeoffItem } from './takeoffTypes'
import { formatCurrency, getExtendedCost, hasIncompleteTakeoffCore } from './takeoffUtils'

type TakeoffOverviewStripProps = {
  allItems: TakeoffItem[]
  visibleItems: TakeoffItem[]
  tradeSubtotals: [string, number][]
  hasActiveFilters: boolean
}

function cardStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
  }
}

function fieldLabelStyle() {
  return {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
    fontFamily: 'ui-monospace,monospace',
  }
}

function metricCardStyle() {
  return {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '8px 10px',
  }
}

export default function TakeoffOverviewStrip({
  allItems,
  visibleItems,
  tradeSubtotals,
  hasActiveFilters,
}: TakeoffOverviewStripProps) {
  const totalCost = allItems.reduce((sum, item) => sum + (getExtendedCost(item) ?? 0), 0)
  const visibleTotalCost = visibleItems.reduce((sum, item) => sum + (getExtendedCost(item) ?? 0), 0)
  const incompleteCount = allItems.filter(hasIncompleteTakeoffCore).length
  const visibleIncompleteCount = visibleItems.filter(hasIncompleteTakeoffCore).length

  return (
    <div style={cardStyle()}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
          }}
        >
          Takeoff Overview
        </div>
        {hasActiveFilters && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Showing filtered review set</div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '8px',
          marginBottom: tradeSubtotals.length ? '10px' : 0,
        }}
      >
        <div style={metricCardStyle()}>
          <div style={fieldLabelStyle()}>All Rows</div>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>{allItems.length}</div>
        </div>
        <div style={metricCardStyle()}>
          <div style={fieldLabelStyle()}>Visible Rows</div>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>{visibleItems.length}</div>
        </div>
        <div style={metricCardStyle()}>
          <div style={fieldLabelStyle()}>Visible Incomplete</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: visibleIncompleteCount ? 'var(--amber)' : 'var(--text)' }}>
            {visibleIncompleteCount}
            <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}> / {incompleteCount}</span>
          </div>
        </div>
        <div style={metricCardStyle()}>
          <div style={fieldLabelStyle()}>All Total</div>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatCurrency(totalCost)}</div>
        </div>
        <div style={metricCardStyle()}>
          <div style={fieldLabelStyle()}>Visible Total</div>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatCurrency(visibleTotalCost)}</div>
        </div>
      </div>

      {!!tradeSubtotals.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
          {tradeSubtotals.map(([tradeName, subtotal]) => (
            <div
              key={tradeName}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={fieldLabelStyle()}>{tradeName}</div>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatCurrency(subtotal)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
