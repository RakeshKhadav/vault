import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'
import { z } from 'zod'

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = RegisterSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    const passwordHash = await AuthService.hashPassword(password)
    
    // Check if this is the first user registered in the system.
    // If it is, assign them the ADMIN role. Otherwise, USER.
    const userCount = await db.user.count()
    const role = userCount === 0 ? 'ADMIN' : 'USER'

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    })

    const payload = { userId: user.id, role: user.role }
    const accessToken = AuthService.generateAccessToken(payload)
    const refreshToken = AuthService.generateRefreshToken(payload)

    const userAgent = req.headers.get('user-agent') || undefined
    await AuthService.createSession(user.id, refreshToken, userAgent)

    const response = NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, role: user.role } },
      { status: 201 }
    )

    AuthService.setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { message: 'An internal server error occurred' },
      { status: 500 }
    )
  }
}
