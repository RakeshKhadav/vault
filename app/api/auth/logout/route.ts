import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value

    if (refreshToken) {
      const payload = AuthService.verifyRefreshToken(refreshToken)
      
      if (payload) {
        // Find and delete the current session from DB
        const sessions = await db.userSession.findMany({
          where: { userId: payload.userId },
        })

        for (const session of sessions) {
          const match = await bcrypt.compare(refreshToken, session.refreshTokenHash)
          if (match) {
            await db.userSession.delete({
              where: { id: session.id },
            })
            break
          }
        }
      }
    }

    const response = NextResponse.json({ success: true })
    AuthService.clearAuthCookies(response)
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { message: 'An internal server error occurred' },
      { status: 500 }
    )
  }
}
