<<<<<<< HEAD

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const missingEnv = !supabaseUrl || !supabaseAnonKey

const missingEnvError = () => new Error('Missing Supabase environment variables')

const makeQuery = () => {
  const err = missingEnvError()
  const res = { data: null, error: err, count: null }

  const q = {
    select: () => q,
    eq: () => q,
    is: () => q,
    in: () => q,
    order: () => q,
    range: () => q,
    limit: () => q,
    update: () => q,
    delete: () => q,
    upsert: async () => res,
    insert: async () => res,
    maybeSingle: async () => res,
    single: async () => res,
    then: (onFulfilled, onRejected) => Promise.resolve(res).then(onFulfilled, onRejected),
  }

  return q
}

const makeStorage = () => {
  const err = missingEnvError()
  return {
    from: () => ({
      upload: async () => ({ data: null, error: err }),
      remove: async () => ({ data: null, error: err }),
      download: async () => ({ data: null, error: err }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  }
}

const stubSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: missingEnvError() }),
    getUser: async () => ({ data: { user: null }, error: missingEnvError() }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: missingEnvError() }),
    signUp: async () => ({ data: null, error: missingEnvError() }),
    signOut: async () => ({ error: missingEnvError() }),
  },
  from: () => makeQuery(),
  storage: makeStorage(),
}

export const supabase = missingEnv ? stubSupabase : createClient(supabaseUrl, supabaseAnonKey)
=======

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
>>>>>>> 887dea10 (feat: 拾音/Pickup 准备上线)
