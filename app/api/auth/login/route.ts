import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = LoginSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user || !(await AuthService.comparePassword(password, user.passwordHash))) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const payload = { userId: user.id, role: user.role }
    const accessToken = AuthService.generateAccessToken(payload)
    const refreshToken = AuthService.generateRefreshToken(payload)

    const userAgent = req.headers.get('user-agent') || undefined
    await AuthService.createSession(user.id, refreshToken, userAgent)

    const response = NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, role: user.role } },
      { status: 200 }
    )

    AuthService.setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'An internal server error occurred' },
      { status: 500 }
    )
  }
}
