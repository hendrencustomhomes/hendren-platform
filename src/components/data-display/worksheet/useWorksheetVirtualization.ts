'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetVisibleRange } from './worksheetTypes'

type Options<Row> = {
  rows: Row[]
  rowHeight: number
  overscan: number
  threshold: number
  maxBodyHeight: number
}

export function useWorksheetVirtualization<Row>({
  rows,
  rowHeight,
  overscan,
  threshold,
  maxBodyHeight,
}: Options<Row>) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [tableScrollTop, setTableScrollTop] = useState(0)
  const [tableViewportHeight, setTableViewportHeight] = useState(maxBodyHeight)

  const shouldVirtualize = rows.length > threshold

  const visibleRange = useMemo((): WorksheetVisibleRange<Row> => {
    if (!shouldVirtualize) {
      return {
        rows,
        startIndex: 0,
        endIndex: Math.max(0, rows.length - 1),
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      }
    }

    const viewportHeight = Math.max(tableViewportHeight, rowHeight)
    const startIndex = Math.max(0, Math.floor(tableScrollTop / rowHeight) - overscan)
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2
    const endIndex = Math.min(rows.length - 1, startIndex + visibleCount - 1)

    return {
      rows: rows.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * rowHeight,
      bottomSpacerHeight: Math.max(0, (rows.length - endIndex - 1) * rowHeight),
    }
  }, [rows, shouldVirtualize, tableScrollTop, tableViewportHeight, rowHeight, overscan])

  useEffect(() => {
    const node = scrollContainerRef.current
    if (!node) return

    const updateViewportHeight = () => {
      setTableViewportHeight(node.clientHeight || maxBodyHeight)
    }

    updateViewportHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      updateViewportHeight()
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [rows.length, shouldVirtualize, maxBodyHeight])

  useEffect(() => {
    if (!shouldVirtualize) {
      setTableScrollTop(0)
    }
  }, [shouldVirtualize])

  return {
    scrollContainerRef,
    shouldVirtualize,
    visibleRange,
    tableScrollTop,
    setTableScrollTop,
    tableViewportHeight,
  }
}
