import { NextRequest } from 'next/server'
import { AuthService, JWTPayload } from '../services/auth.service'

/**
 * Common authentication verification helper for NextJS API routes.
 * Decodes accessToken cookie and returns verified JWTPayload or null.
 */
export async function verifyAuth(req: NextRequest): Promise<JWTPayload | null> {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
}

/**
 * Common admin authorization verification helper for NextJS API routes.
 * Decodes accessToken cookie, verifies signature, and checks role is ADMIN.
 */
export async function verifyAdmin(req: NextRequest): Promise<JWTPayload | null> {
  const payload = await verifyAuth(req)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}
