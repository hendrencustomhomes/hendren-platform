'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/utils/supabase/client'
import { getCompanies, companyTypeTags, type Company } from '@/lib/companies'

type Filter = 'all' | 'sub' | 'vendor' | 'service'

export default function CompaniesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)

  async function loadPage() {
    setLoading(true)
    setError(null)

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id

    const [companiesResult, adminResult] = await Promise.all([
      getCompanies(supabase).catch((e) => {
        setError('Failed to load companies')
        console.error(e)
        return []
      }),
      userId
        ? supabase
            .from('internal_access')
            .select('is_admin, is_active')
            .eq('profile_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    setCompanies(companiesResult)
    if ('data' in adminResult) {
      const d = adminResult.data as { is_admin: boolean; is_active: boolean } | null
      setIsAdmin(Boolean(d?.is_admin && d?.is_active))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    let list = companies
    if (filter === 'sub') list = list.filter((c) => c.is_subcontractor)
    else if (filter === 'vendor') list = list.filter((c) => c.is_vendor)
    else if (filter === 'service') list = list.filter((c) => c.is_service_company)

    const q = search.trim().toLowerCase()
    if (q) list = list.filter((c) => c.company_name.toLowerCase().includes(q))

    return list
  }, [companies, filter, search])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sub', label: 'Subs' },
    { key: 'vendor', label: 'Vendors' },
    { key: 'service', label: 'Service' },
  ]

  return (
    <>
      <Nav title="Companies" />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search + Add */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: '16px',
              outline: 'none',
            }}
          />
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push('/more/companies/new')}
              style={{
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
              }}
            >
              Add
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? 'var(--text)' : 'transparent',
                color: filter === f.key ? 'var(--surface)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#fca5a5', padding: '4px 0' }}>{error}</div>
        )}

        {/* List */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {search || filter !== 'all' ? 'No companies match.' : 'No companies yet.'}
            </div>
          ) : (
            filtered.map((company, index) => {
              const tags = companyTypeTags(company)
              const subtitle = company.phone || company.email || null

              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => router.push(`/more/companies/${company.id}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: company.is_active ? 'var(--text)' : 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {company.company_name}
                        {!company.is_active && (
                          <span
                            style={{
                              marginLeft: '6px',
                              fontSize: '11px',
                              color: '#fbbf24',
                              fontWeight: 500,
                            }}
                          >
                            Inactive
                          </span>
                        )}
                      </div>
                      {subtitle && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {subtitle}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0,
                      }}
                    >
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            background: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '2px 6px',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      <span
                        style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}
                      >
                        ›
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {!loading && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
          </div>
        )}
      </div>
    </>
  )
}
