import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const job = await db.uploadJob.findFirst({
      where: { id, userId: user.userId },
    })

    if (!job) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error fetching upload job status:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
