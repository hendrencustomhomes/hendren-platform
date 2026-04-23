'use client'

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { ErrorMessage } from '@/components/feedback/ErrorMessage'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PricingWorksheetHeader } from './PricingWorksheetHeader'
import { PricingWorksheetMetaBar } from './PricingWorksheetMetaBar'
import { PricingWorksheetNewRowBar } from './PricingWorksheetNewRowBar'
import { PricingWorksheetMobileList } from './PricingWorksheetMobileList'
import { PricingWorksheetTableAdapter } from './PricingWorksheetTableAdapter'
import { usePricingWorksheetPersistence } from './_hooks/usePricingWorksheetPersistence'
import { usePricingWorksheetState } from './_hooks/usePricingWorksheetState'

export default function PricingWorksheetPageOrchestrator(props: any) {
  const { headerId, backHref, detailBasePath, navFallbackTitle, missingLabel, permissionRowKey } = props

  const persistence = usePricingWorksheetPersistence({ headerId, detailBasePath, missingLabel, permissionRowKey })
  const worksheet = usePricingWorksheetState({ initialRows: persistence.loadedRows, onPersistRow: persistence.persistRow })

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  function handleNewRowKeyDown(e: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>, onCommit?: () => void) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onCommit?.()
      return
    }
    if (e.key === 'Enter' && onCommit) {
      e.preventDefault()
      onCommit()
    }
  }

  async function handleCreateRow() {
    const created = await persistence.createRowRecord()
    if (created) worksheet.appendRow(created)
  }

  if (persistence.loading) return <LoadingState />
  if (persistence.error) return <ErrorMessage message={persistence.error} />
  if (!persistence.header) return <ErrorMessage message={`Missing ${missingLabel}.`} />

  const costCodeMap = new Map(persistence.costCodes.map((c) => [c.id, `${c.cost_code} · ${c.title}`]))

  return (
    <PageShell title={persistence.header.title || navFallbackTitle} backHref={backHref}>
      <PricingWorksheetHeader
        header={persistence.header}
        missingLabel={missingLabel}
        canManage={!!persistence.access?.canManage}
        savingHeader={persistence.savingHeader}
        creatingRevision={persistence.creatingRevision}
        title={persistence.headerTitle}
        status={persistence.headerStatus}
        effectiveDate={persistence.headerEffectiveDate}
        notes={persistence.headerNotes}
        isActive={persistence.headerIsActive}
        onTitleChange={persistence.setHeaderTitle}
        onStatusChange={persistence.setHeaderStatus}
        onEffectiveDateChange={persistence.setHeaderEffectiveDate}
        onNotesChange={persistence.setHeaderNotes}
        onIsActiveChange={persistence.setHeaderIsActive}
        onSaveHeader={persistence.saveHeader}
        onCreateRevision={persistence.createRevision}
      />

      <PricingWorksheetMetaBar
        rowCount={worksheet.localRows.length}
        hasActiveCell={!!worksheet.activeCell}
        isVirtualized={!isMobile && worksheet.localRows.length > 20}
        saveCounts={worksheet.saveCounts}
      />

      <PricingWorksheetNewRowBar
        canManage={!!persistence.access?.canManage}
        newCatalogSku=""
        newDescription={persistence.newDescription}
        newVendorSku={persistence.newVendorSku}
        newUnit={persistence.newUnit}
        newUnitPrice={persistence.newUnitPrice}
        newLeadDays={persistence.newLeadDays}
        newNotes={persistence.newNotes}
        creatingRow={persistence.creatingRow}
        onCatalogSkuChange={() => {}}
        onDescriptionChange={persistence.setNewDescription}
        onVendorSkuChange={persistence.setNewVendorSku}
        onUnitChange={persistence.setNewUnit}
        onUnitPriceChange={persistence.setNewUnitPrice}
        onLeadDaysChange={persistence.setNewLeadDays}
        onNotesChange={persistence.setNewNotes}
        onKeyDown={handleNewRowKeyDown}
        onCreateRow={handleCreateRow}
      />

      {isMobile ? (
        <PricingWorksheetMobileList rows={worksheet.localRows} rowSaveState={worksheet.rowSaveState} />
      ) : (
        <PricingWorksheetTableAdapter
          rows={worksheet.localRows}
          rowSaveState={worksheet.rowSaveState}
          activeCell={worksheet.activeCell}
          activeDraft={worksheet.activeDraft}
          setActiveCell={worksheet.setActiveCell}
          setActiveDraft={worksheet.setActiveDraft}
          commitCellValue={worksheet.commitCellValue}
          handleUndo={worksheet.handleUndo}
          canManage={!!persistence.access?.canManage}
          costCodeMap={costCodeMap}
        />
      )}
    </PageShell>
  )
}
