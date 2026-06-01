import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'

async function verifyAdmin(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null

  const payload = AuthService.verifyAccessToken(accessToken)
  if (!payload || payload.role !== 'ADMIN') return null

  return payload
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || undefined
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const skip = (page - 1) * limit

    const whereClause: any = {}
    if (status) {
      if (status === 'BOTH') {
        whereClause.status = { in: ['SUCCESS', 'FAILED'] }
      } else {
        whereClause.status = status
      }
    }

    const totalCount = await db.backup.count({
      where: whereClause,
    })

    const backups = await db.backup.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        file: {
          select: {
            id: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            user: {
              select: {
                id: true,
                email: true,
              }
            }
          }
        }
      }
    })

    const formattedBackups = backups.map(backup => ({
      ...backup,
      file: backup.file ? {
        ...backup.file,
        fileSize: backup.file.fileSize.toString(),
      } : null,
    }))

    return NextResponse.json({
      backups: formattedBackups,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching admin backups:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
