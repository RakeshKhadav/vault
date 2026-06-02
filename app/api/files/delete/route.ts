import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { fileIds } = await req.json()
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
    }

    // Soft-delete the files belonging to the user
    const updateResult = await db.file.updateMany({
      where: {
        id: { in: fileIds },
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, count: updateResult.count })
  } catch (error) {
    console.error('Error in bulk delete:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
