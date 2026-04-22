import { SectionHeader } from '@/components/layout/SectionHeader'
import { StatusPill } from '@/components/data-display/StatusPill'

type Props = {
  rowCount: number
  hasActiveCell: boolean
  isVirtualized: boolean
  saveCounts: {
    saving: number
    dirty: number
    error: number
  }
}

export function PricingWorksheetMetaBar({
  rowCount,
  hasActiveCell,
  isVirtualized,
  saveCounts,
}: Props) {
  return (
    <SectionHeader
      title="Worksheet"
      right={[
        <StatusPill
          key="rows"
          text={`${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`}
        />,
        ...(hasActiveCell ? [<StatusPill key="active-cell" text="active cell" tone="active" />] : []),
        ...(isVirtualized ? [<StatusPill key="virtualized" text="virtualized" tone="active" />] : []),
        ...(saveCounts.dirty > 0
          ? [<StatusPill key="dirty" text={`${saveCounts.dirty} queued`} tone="warning" />]
          : []),
        ...(saveCounts.saving > 0
          ? [<StatusPill key="saving" text={`${saveCounts.saving} saving`} />]
          : []),
        ...(saveCounts.error > 0
          ? [<StatusPill key="error" text={`${saveCounts.error} failed`} tone="danger" />]
          : []),
      ]}
    />
  )
}
