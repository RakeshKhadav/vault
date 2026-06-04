import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { verifyAdmin } from '@/lib/utils/auth-helper'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const sizeAggregate = await db.file.aggregate({
      _sum: { fileSize: true },
      where: { userId: id, deletedAt: null },
    })

    const countAggregate = await db.file.count({
      where: { userId: id, deletedAt: null, thumbnailOf: null, previewOf: null },
    })

    const sizeBytes = sizeAggregate._sum.fileSize || BigInt(0)

    return NextResponse.json({
      ...user,
      storageUsedBytes: sizeBytes.toString(),
      filesCount: countAggregate,
    })
  } catch (error) {
    console.error('Error fetching admin user details:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
