import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../lib/db'
import { AuthService } from '../../../lib/services/auth.service'

async function verifyAuth(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const jobs = await db.uploadJob.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching upload jobs:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
