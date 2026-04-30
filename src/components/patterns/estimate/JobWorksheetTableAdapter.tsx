'use client'

// PATCH: minimal safe fix

// IMPORTANT CHANGES ONLY:
// 1. explicit generics
// 2. no structural rewrite

const virt = useWorksheetVirtualization<JobWorksheetRow>({
  rows,
  rowHeight: 64,
  overscan: 8,
  threshold: 20,
  maxBodyHeight: 560
})

const interaction = useWorksheetInteraction<JobWorksheetRow, JobWorksheetEditableCellKey>({
  rows,
  getRowId: (row) => row.id,
  cellOrder: editableCellOrder,
  activeCell: props.activeCell,
  onActiveCellChange: props.setActiveCell,
  activeDraft: props.activeDraft,
  onActiveDraftChange: props.setActiveDraft,
  getCellValue: (row, field) => row[field] ?? '',
  commitCellValue: props.commitCellValue,
  handleUndo: props.handleUndo,
  onCreateRow: props.createDraftRowAfter,
  onDeleteRow: props.deleteRow,
  scrollContainerRef: virt.scrollContainerRef,
  shouldVirtualize: virt.shouldVirtualize,
  tableViewportHeight: virt.tableViewportHeight,
  onTableScrollTopChange: virt.setTableScrollTop,
  rowHeight: 64,
  tableScrollTop: virt.tableScrollTop
})

// KEEP EVERYTHING ELSE UNCHANGED
