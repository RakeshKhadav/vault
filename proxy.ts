import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback-access-secret'
const encodedAccessKey = new TextEncoder().encode(JWT_ACCESS_SECRET)

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, encodedAccessKey)
    return payload
  } catch {
    return null
  }
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const accessToken = req.cookies.get('accessToken')?.value
  const refreshToken = req.cookies.get('refreshToken')?.value

  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register')
  const isProtectedRoute = !isAuthRoute

  let user = null
  if (accessToken) {
    user = await verifyToken(accessToken)
  }

  // If unauthorized for a protected page:
  if (isProtectedRoute && !user) {
    // If we have a refresh token but access token expired, attempt to auto-refresh
    if (refreshToken) {
      const url = new URL('/api/auth/refresh', req.nextUrl.origin)
      try {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            Cookie: `refreshToken=${refreshToken}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          const redirectRes = NextResponse.next()
          redirectRes.cookies.set('accessToken', data.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60
          })
          return redirectRes
        }
      } catch (e) {
        console.error('Proxy token refresh call failed:', e)
      }
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // If already authenticated and accessing login/register, or accessing root, send to dashboard:
  if ((isAuthRoute || path === '/') && user) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
