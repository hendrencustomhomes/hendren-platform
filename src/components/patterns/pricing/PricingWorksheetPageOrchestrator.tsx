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

type Props = {
  headerId: string
  backHref: string
  detailBasePath: string
  navFallbackTitle: string
  missingLabel: string
  permissionRowKey: 'pricing_sources' | 'bids'
}

export default function PricingWorksheetPageOrchestrator({
  headerId,
  backHref,
  detailBasePath,
  navFallbackTitle,
  missingLabel,
  permissionRowKey,
}: Props) {
  const persistence = usePricingWorksheetPersistence({
    headerId,
    detailBasePath,
    missingLabel,
    permissionRowKey,
  })
  const worksheet = usePricingWorksheetState({
    initialRows: persistence.loadedRows,
    onPersistRow: persistence.persistRow,
  })

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const companyName = useMemo(() => {
    const map = new Map(persistence.companies.map((company) => [company.id, company.company_name]))
    return persistence.header ? map.get(persistence.header.company_id) : undefined
  }, [persistence.companies, persistence.header])

  const tradeName = useMemo(() => {
    const map = new Map(persistence.trades.map((trade) => [trade.id, trade.name]))
    return persistence.header ? map.get(persistence.header.trade_id) : undefined
  }, [persistence.trades, persistence.header])

  const costCodeLabel = useMemo(() => {
    const map = new Map(
      persistence.costCodes.map((costCode) => [costCode.id, `${costCode.cost_code} · ${costCode.title}`])
    )
    return persistence.header ? map.get(persistence.header.cost_code_id) : undefined
  }, [persistence.costCodes, persistence.header])

  const costCodeMap = useMemo(
    () => new Map(persistence.costCodes.map((costCode) => [costCode.id, `${costCode.cost_code} · ${costCode.title}`])),
    [persistence.costCodes]
  )

  function getRowStatusLabel(rowId: string) {
    const state = worksheet.rowSaveState[rowId] ?? 'idle'
    if (state === 'saving') return { text: 'Saving…', tone: 'default' as const }
    if (state === 'dirty') return { text: 'Queued', tone: 'warning' as const }
    if (state === 'error') return { text: 'Failed', tone: 'danger' as const }
    return { text: 'Ready', tone: 'active' as const }
  }

  function handleNewRowKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    onCommit?: () => void
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      onCommit?.()
      return
    }
    if (event.key === 'Enter' && onCommit) {
      event.preventDefault()
      onCommit()
    }
  }

  async function handleCreateRow() {
    const created = await persistence.createRowRecord()
    if (created) {
      worksheet.appendRow(created)
      if (!isMobile) {
        worksheet.setActiveCell({ rowId: created.id, field: 'description_snapshot' })
        worksheet.setActiveDraft(created.description_snapshot)
      }
    }
  }

  if (persistence.loading) return <LoadingState />
  if (persistence.error) return <ErrorMessage error={persistence.error} />
  if (!persistence.header) return <ErrorMessage error={`Missing ${missingLabel}.`} />

  return (
    <PageShell title={persistence.header.title || navFallbackTitle} back={backHref}>
      <PricingWorksheetHeader
        header={persistence.header}
        missingLabel={missingLabel}
        companyName={companyName}
        tradeName={tradeName}
        costCodeLabel={costCodeLabel}
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
        catalogItems={persistence.catalogItems}
        newCatalogSku={persistence.newCatalogSku}
        newDescription={persistence.newDescription}
        newVendorSku={persistence.newVendorSku}
        newUnit={persistence.newUnit}
        newUnitPrice={persistence.newUnitPrice}
        newLeadDays={persistence.newLeadDays}
        newNotes={persistence.newNotes}
        creatingRow={persistence.creatingRow}
        onCatalogSkuChange={persistence.applyCatalogDefaults}
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
        <PricingWorksheetMobileList rows={worksheet.localRows} getRowStatusLabel={getRowStatusLabel} />
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
          onCreateRow={handleCreateRow}
          canManage={!!persistence.access?.canManage}
          costCodeMap={costCodeMap}
        />
      )}
    </PageShell>
  )
}
