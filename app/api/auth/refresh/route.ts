import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json({ message: 'Refresh token missing' }, { status: 401 })
    }

    const payload = AuthService.verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid or expired refresh token' }, { status: 401 })
    }

    // Retrieve active sessions for this user to match hashes
    const sessions = await db.userSession.findMany({
      where: {
        userId: payload.userId,
        expiresAt: { gt: new Date() },
      },
    })

    let validSession = null
    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshTokenHash)
      if (match) {
        validSession = session
        break
      }
    }

    if (!validSession) {
      return NextResponse.json({ message: 'Session revoked or expired' }, { status: 401 })
    }

    // Generate a fresh access token
    const newAccessToken = AuthService.generateAccessToken({
      userId: payload.userId,
      role: payload.role,
    })

    const response = NextResponse.json({ success: true, accessToken: newAccessToken })
    
    // Update cookies
    AuthService.setAuthCookies(response, newAccessToken, refreshToken)

    // Update session active status
    await db.userSession.update({
      where: { id: validSession.id },
      data: { lastActiveAt: new Date() },
    })

    return response
  } catch (error) {
    console.error('Session refresh error:', error)
    return NextResponse.json(
      { message: 'An internal server error occurred' },
      { status: 500 }
    )
  }
}
