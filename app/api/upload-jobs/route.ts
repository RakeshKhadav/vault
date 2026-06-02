import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../lib/db'
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
