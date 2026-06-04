import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { verifyAdmin } from '@/lib/utils/auth-helper'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') || undefined
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const type = url.searchParams.get('type')
    const search = url.searchParams.get('search')
    const userId = url.searchParams.get('userId')

    // Construct filters
    const whereClause: any = {
      deletedAt: null,
      thumbnailOf: null, // Exclude files that are thumbnails
      previewOf: null,   // Exclude files that are previews
    }

    if (userId) {
      whereClause.userId = userId
    }

    if (type === 'image') {
      whereClause.mimeType = { startsWith: 'image/' }
    } else if (type === 'video') {
      whereClause.mimeType = { startsWith: 'video/' }
    }

    if (search) {
      whereClause.originalName = { contains: search, mode: 'insensitive' }
    }

    // Fetch limit + 1 items to see if there is a next page
    const files = await db.file.findMany({
      where: whereClause,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: [
        { uploadedAt: 'desc' },
        { id: 'desc' }
      ],
      include: {
        user: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    })

    const hasMore = files.length > limit
    const paginatedFiles = hasMore ? files.slice(0, limit) : files
    const nextCursor = hasMore ? paginatedFiles[paginatedFiles.length - 1].id : null

    // Format BigInt values to string for JSON serialization
    const formattedFiles = paginatedFiles.map(file => ({
      ...file,
      fileSize: file.fileSize.toString(),
    }))

    return NextResponse.json({
      files: formattedFiles,
      nextCursor
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  } catch (error) {
    console.error('Error fetching admin files:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
