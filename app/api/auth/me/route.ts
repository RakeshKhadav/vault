import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const payload = AuthService.verifyAccessToken(accessToken)
  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 401 })
    }

    // Calculate personal storage usage (only active/non-deleted files)
    const aggregate = await db.file.aggregate({
      _sum: {
        fileSize: true,
      },
      where: {
        userId: payload.userId,
        deletedAt: null,
      },
    })

    const usedSpaceBytes = aggregate._sum.fileSize || BigInt(0)
    const limitBytes = BigInt(20) * BigInt(1024) * BigInt(1024) * BigInt(1024) // 20 GB
    
    // Percentage calculation (safe BigInt division, then convert to Number for decimal representation)
    const percentage = Number((usedSpaceBytes * BigInt(10000)) / limitBytes) / 100

    // Fetch storage nodes list - safe fields only, no credentials!
    const nodes = await db.storageNode.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const safeNodes = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      provider: node.provider,
      totalSpaceMb: node.totalSpaceMb.toString(),
      usedSpaceMb: node.usedSpaceMb.toString(),
      isActive: node.isActive,
      lastSyncAt: node.lastSyncAt,
    }))

    return NextResponse.json({
      user,
      storage: {
        usedSpaceBytes: usedSpaceBytes.toString(),
        limitBytes: limitBytes.toString(),
        percentage: percentage,
      },
      storageNodes: safeNodes,
    })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
