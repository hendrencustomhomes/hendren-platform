export type WorksheetCellKey = string

export type WorksheetActiveCell<CellKey extends string = string> = {
  rowId: string
  field: CellKey
}

export type WorksheetCellDraftValue = string | boolean | null

export type WorksheetVisibleRange<Row> = {
  rows: Row[]
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
}

export type WorksheetRowSaveState = 'idle' | 'dirty' | 'saving' | 'error'
