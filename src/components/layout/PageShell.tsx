'use client'

import Nav from '@/components/Nav'

type Props = {
  title: string
  back?: string
  jobId?: string
  children: React.ReactNode
  padding?: string
  gap?: string
}

export function PageShell({ title, back, jobId, children, padding = '16px', gap = '12px' }: Props) {
  return (
    <>
      <Nav title={title} back={back} jobId={jobId} />
      <div style={{ padding, display: 'flex', flexDirection: 'column', gap }}>{children}</div>
    </>
  )
}
