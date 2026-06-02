import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import jwt from 'jsonwebtoken'

const JWT_SHARE_SECRET: string = process.env.JWT_SHARE_SECRET || process.env.JWT_ACCESS_SECRET || ''
if (!JWT_SHARE_SECRET) {
  throw new Error('JWT_SHARE_SECRET or JWT_ACCESS_SECRET environment variable must be configured')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.findFirst({
      where: {
        id,
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
    })

    if (!file) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    // Generate 15-minute share token
    const token = jwt.sign(
      { fileId: file.id, userId: file.userId },
      JWT_SHARE_SECRET,
      { expiresIn: '15m' }
    )

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const shareUrl = `${req.nextUrl.origin}/share/${token}`

    return NextResponse.json({
      url: shareUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Error generating share link:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
