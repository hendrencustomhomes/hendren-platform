'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchSelectOption = {
  value: string
  label: string
  keywords?: string[]
}

type TakeoffSearchSelectProps = {
  value: string
  options: SearchSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
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

function optionButtonStyle(active: boolean) {
  return {
    width: '100%',
    textAlign: 'left' as const,
    padding: '9px 10px',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: active ? 'var(--bg)' : 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'system-ui,-apple-system,sans-serif',
  }
}

function findSelectedLabel(options: SearchSelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? ''
}

export default function TakeoffSearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Search...',
  disabled = false,
  allowEmpty = false,
  emptyLabel = 'None',
}: TakeoffSearchSelectProps) {
  const inp = inputStyle()
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState(findSelectedLabel(options, value))
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      setQuery(findSelectedLabel(options, value))
    }
  }, [value, options, open])

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
    }
  }, [])

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const base = allowEmpty
      ? [{ value: '', label: emptyLabel } as SearchSelectOption, ...options]
      : options

    if (!trimmed) return base

    return base.filter((option) => {
      const haystack = [option.label, option.value, ...(option.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [allowEmpty, emptyLabel, options, query])

  function commitByIndex(index: number) {
    const next = filteredOptions[index]
    if (!next) return
    onChange(next.value)
    setQuery(next.label)
    setOpen(false)
    setHighlightedIndex(0)
  }

  function resetToCurrentValue() {
    setQuery(findSelectedLabel(options, value))
    setHighlightedIndex(0)
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => {
      setOpen(false)
      const trimmed = query.trim()

      if (!trimmed) {
        if (allowEmpty) {
          onChange('')
          setQuery('')
        } else {
          resetToCurrentValue()
        }
        return
      }

      const exact = filteredOptions.find((option) => {
        const lower = trimmed.toLowerCase()
        return option.label.toLowerCase() === lower || option.value.toLowerCase() === lower
      })

      if (exact) {
        onChange(exact.value)
        setQuery(exact.label)
        return
      }

      resetToCurrentValue()
    }, 120)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        style={inp}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current)
          setOpen(true)
          setHighlightedIndex(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlightedIndex(0)
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)))
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex((current) => Math.max(current - 1, 0))
          }

          if (e.key === 'Enter') {
            if (open && filteredOptions.length > 0) {
              e.preventDefault()
              commitByIndex(highlightedIndex)
            }
          }

          if (e.key === 'Escape') {
            setOpen(false)
            resetToCurrentValue()
          }
        }}
      />

      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 40,
            maxHeight: '220px',
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--surface)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
          }}
        >
          {filteredOptions.length === 0 ? (
            <div
              style={{
                padding: '10px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontFamily: 'ui-monospace,monospace',
              }}
            >
              No results
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitByIndex(index)
                }}
                style={optionButtonStyle(index === highlightedIndex)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
