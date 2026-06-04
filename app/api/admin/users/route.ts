import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/utils/auth-helper'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    const sizeAggregates = await db.file.groupBy({
      by: ['userId'],
      _sum: {
        fileSize: true,
      },
      where: {
        deletedAt: null,
      },
    })

    const countAggregates = await db.file.groupBy({
      by: ['userId'],
      _count: {
        _all: true,
      },
      where: {
        deletedAt: null,
        thumbnailOf: null,
        previewOf: null,
      },
    })

    const sizeMap = new Map(
      sizeAggregates.map((agg) => [agg.userId, agg._sum.fileSize || BigInt(0)])
    )

    const countMap = new Map(
      countAggregates.map((agg) => [agg.userId, agg._count._all])
    )

    const safeUsers = users.map((user) => {
      const sizeBytes = sizeMap.get(user.id) || BigInt(0)
      const count = countMap.get(user.id) || 0
      return {
        ...user,
        storageUsedBytes: sizeBytes.toString(),
        filesCount: count,
      }
    })

    return NextResponse.json({ users: safeUsers })
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
