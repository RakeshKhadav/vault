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
    const cursor = url.searchParams.get('cursor') || undefined
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const type = url.searchParams.get('type')
    const favorite = url.searchParams.get('favorite')
    const search = url.searchParams.get('search')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Construct filters
    const whereClause: any = {
      userId: user.userId,
      deletedAt: null,
      thumbnailOf: null, // Exclude files that are thumbnails of other files
    }

    if (type === 'image') {
      whereClause.mimeType = { startsWith: 'image/' }
    } else if (type === 'video') {
      whereClause.mimeType = { startsWith: 'video/' }
    }

    if (favorite === 'true') {
      whereClause.isFavorite = true
    }

    if (search) {
      whereClause.originalName = { contains: search, mode: 'insensitive' }
    }

    if (startDate || endDate) {
      whereClause.uploadedAt = {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      }
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
      ]
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
    })
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
