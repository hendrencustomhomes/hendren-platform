import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // TODO: replace with real dashboard once built
  return (
    <div style={{ fontFamily: 'system-ui', padding: '40px', background: '#f7f6f3', minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
          Hendren Custom Homes
        </h1>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
          Signed in as {user.email}
        </p>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" style={{
            padding: '8px 16px', background: '#1a1a18', color: '#fff',
            border: 'none', borderRadius: '7px', fontSize: '12px',
            fontWeight: '600', cursor: 'pointer',
          }}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
