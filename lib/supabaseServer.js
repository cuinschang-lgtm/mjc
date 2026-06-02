import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createSupabaseServerClient(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getBearerToken(request) {
  const h = request.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

