import type { CSSProperties } from 'react'

export const inputStyle: CSSProperties = {
  flex: 1,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '16px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export const labelStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  fontWeight: 700,
}

export const pageStackStyle: CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

export const searchRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
}

export const addButtonStyle: CSSProperties = {
  background: 'var(--text)',
  color: 'var(--surface)',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

export const panelHeaderStyle: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
}

export const panelGridStyle: CSSProperties = {
  padding: '14px 16px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
}

export const fullWidthGridItemStyle: CSSProperties = {
  gridColumn: '1 / -1',
}

export const errorTextStyle: CSSProperties = {
  fontSize: '13px',
  color: '#fca5a5',
  padding: '4px 0',
}

export const mutedMessageStyle: CSSProperties = {
  padding: '20px 16px',
  fontSize: '13px',
  color: 'var(--text-muted)',
}

export const footerCountStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  textAlign: 'center',
}

export function cardStyle(): CSSProperties {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    overflow: 'hidden',
  }
}

export function pillStyle(active: boolean): CSSProperties {
  return {
    background: active ? 'var(--text)' : 'transparent',
    color: active ? 'var(--surface)' : 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  }
}
