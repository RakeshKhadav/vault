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
