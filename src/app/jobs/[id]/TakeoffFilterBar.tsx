'use client'

import TakeoffSearchSelect, { type SearchSelectOption } from './TakeoffSearchSelect'

type TakeoffFilterBarProps = {
  isMobile: boolean
  textFilter: string
  onTextFilterChange: (value: string) => void
  tradeFilter: string
  onTradeFilterChange: (value: string) => void
  tradeOptions: SearchSelectOption[]
  costCodeFilter: string
  onCostCodeFilterChange: (value: string) => void
  costCodeOptions: SearchSelectOption[]
  showIncompleteOnly: boolean
  onShowIncompleteOnlyChange: (value: boolean) => void
  hasActiveFilters: boolean
  onReset: () => void
}

function cardStyle() {
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
    padding: '9px 10px',
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

export default function TakeoffFilterBar({
  isMobile,
  textFilter,
  onTextFilterChange,
  tradeFilter,
  onTradeFilterChange,
  tradeOptions,
  costCodeFilter,
  onCostCodeFilterChange,
  costCodeOptions,
  showIncompleteOnly,
  onShowIncompleteOnlyChange,
  hasActiveFilters,
  onReset,
}: TakeoffFilterBarProps) {
  const inp = inputStyle()

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
          Review Filters
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1.2fr auto',
          gap: '8px',
          alignItems: 'end',
        }}
      >
        <div>
          <div style={fieldLabelStyle()}>Text Search</div>
          <input
            value={textFilter}
            onChange={(e) => onTextFilterChange(e.target.value)}
            placeholder="Search description, trade, code, notes..."
            style={inp}
          />
        </div>

        <div>
          <div style={fieldLabelStyle()}>Trade Filter</div>
          <TakeoffSearchSelect
            value={tradeFilter}
            options={tradeOptions}
            onChange={onTradeFilterChange}
            placeholder="All trades"
            allowEmpty
            emptyLabel="All trades"
          />
        </div>

        <div>
          <div style={fieldLabelStyle()}>Cost Code Filter</div>
          <TakeoffSearchSelect
            value={costCodeFilter}
            options={costCodeOptions}
            onChange={onCostCodeFilterChange}
            placeholder="All cost codes"
            allowEmpty
            emptyLabel="All cost codes"
          />
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text)',
            cursor: 'pointer',
            paddingBottom: isMobile ? 0 : '10px',
          }}
        >
          <input
            type="checkbox"
            checked={showIncompleteOnly}
            onChange={(e) => onShowIncompleteOnlyChange(e.target.checked)}
            style={{ accentColor: 'var(--blue)', cursor: 'pointer' }}
          />
          Incomplete Only
        </label>
      </div>
    </div>
  )
}
