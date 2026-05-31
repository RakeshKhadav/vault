import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = AuthService.verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    // Revoke all sessions for this user
    await db.userSession.deleteMany({
      where: { userId: payload.userId },
    })

    const response = NextResponse.json({ success: true })
    AuthService.clearAuthCookies(response)
    return response
  } catch (error) {
    console.error('Logout all error:', error)
    return NextResponse.json(
      { message: 'An internal server error occurred' },
      { status: 500 }
    )
  }
}
