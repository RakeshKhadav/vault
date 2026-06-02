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

    // Verify files belong to this user and are not deleted
    const files = await db.file.findMany({
      where: {
        id: { in: fileIds },
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
      select: { id: true },
    })

    const validatedIds = files.map((f) => f.id)
    const downloads = validatedIds.map((id) => ({
      fileId: id,
      url: `/api/files/${id}/download`,
    }))

    return NextResponse.json({ downloads })
  } catch (error) {
    console.error('Error generating bulk downloads:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
