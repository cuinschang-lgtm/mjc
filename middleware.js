// Middleware: pass-through. The supabase.auth.getUser() call was removed
// because it caused MIDDLEWARE_INVOCATION_TIMEOUT when the Supabase project
// is paused or unreachable, and its return value was never used.
import { NextResponse } from 'next/server'

export async function middleware(request) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
