import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db'
import { NextResponse } from 'next/server'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback-access-secret'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret'

export interface JWTPayload {
  userId: string
  role: string
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' })
  }

  static generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '90d' })
  }

  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET) as JWTPayload
    } catch {
      return null
    }
  }

  static verifyRefreshToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload
    } catch {
      return null
    }
  }

  static async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, 8)
  }

  static async createSession(userId: string, refreshToken: string, userAgent?: string, deviceName?: string) {
    const refreshTokenHash = await this.hashRefreshToken(refreshToken)
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days

    return db.userSession.create({
      data: {
        userId,
        refreshTokenHash,
        deviceName,
        userAgent,
        expiresAt
      }
    })
  }

  static setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
    // Access Token Cookie (15 mins)
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60
    })

    // Refresh Token Cookie (90 days)
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 90 * 24 * 60 * 60
    })
  }

  static clearAuthCookies(response: NextResponse) {
    response.cookies.set('accessToken', '', { path: '/', maxAge: 0 })
    response.cookies.set('refreshToken', '', { path: '/', maxAge: 0 })
  }
}
