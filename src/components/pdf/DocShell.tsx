import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function DocShell({ children }: Props) {
  return (
    <>
      <style>{`
        @media print {
          .doc-no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 1.5cm 1.5cm; size: letter; }
        }
      `}</style>
      <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {children}
        </div>
      </div>
    </>
  )
}
