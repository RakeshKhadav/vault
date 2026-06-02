import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../lib/db'
import { StorageManager } from '../../../lib/storage/manager'
import { decrypt } from '../../../lib/storage/encryption'

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

    const targetUserId = url.searchParams.get('userId')
    let userIdToQuery = user.userId

    if (targetUserId) {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
      userIdToQuery = targetUserId
    }

    // Construct filters
    const whereClause: any = {
      userId: userIdToQuery,
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

    // Fetch limit + 1 items with optimized select block to avoid fetching large records
    const files = await db.file.findMany({
      where: whereClause,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: [
        { uploadedAt: 'desc' },
        { id: 'desc' }
      ],
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        isFavorite: true,
        uploadedAt: true,
        providerFileId: true,
        thumbnailFileId: true,
        storageNode: {
          select: {
            id: true,
            provider: true,
            credentialsJson: true,
          }
        },
        thumbnail: {
          select: {
            id: true,
            providerFileId: true,
          }
        }
      }
    })

    const hasMore = files.length > limit
    const paginatedFiles = hasMore ? files.slice(0, limit) : files
    const nextCursor = hasMore ? paginatedFiles[paginatedFiles.length - 1].id : null

    // Map files and generate pre-signed direct URLs in parallel
    const formattedFiles = await Promise.all(paginatedFiles.map(async (file) => {
      let thumbnailUrl: string | null = null

      try {
        const provider = StorageManager.getProvider(file.storageNode.provider)
        const credentialsStr = decrypt(file.storageNode.credentialsJson)

        // Generate pre-signed URL for WebP thumbnail directly pointing to B2
        if (file.thumbnail) {
          thumbnailUrl = await provider.generateViewUrl(credentialsStr, file.thumbnail.providerFileId)
        }
      } catch (err) {
        console.error(`Failed to generate pre-signed URL for file ${file.id}:`, err)
      }

      return {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize.toString(),
        isFavorite: file.isFavorite,
        thumbnailFileId: file.thumbnailFileId,
        uploadedAt: file.uploadedAt.toISOString(),
        thumbnailUrl,
        viewUrl: null,
        streamUrl: null,
      }
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
