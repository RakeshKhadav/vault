import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../lib/db'
import { StorageManager } from '../../../lib/storage/manager'
import { decrypt } from '../../../lib/storage/encryption'
import { StorageService } from '../../../lib/services/storage.service'

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') || undefined
    const limit = parseInt(url.searchParams.get('limit') || '24', 10)

    const files = await db.file.findMany({
      where: {
        userId: user.userId,
        deletedAt: { not: null },
        thumbnailOf: null,
        previewOf: null,
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: [
        { deletedAt: 'desc' },
        { id: 'desc' }
      ],
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        deletedAt: true,
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

    const decryptedCredentialsCache = new Map<string, string>()
    const formattedFiles = await Promise.all(paginatedFiles.map(async (file) => {
      let thumbnailUrl: string | null = null

      try {
        const provider = StorageManager.getProvider(file.storageNode.provider)
        let credentialsStr = decryptedCredentialsCache.get(file.storageNode.id)
        if (!credentialsStr) {
          credentialsStr = decrypt(file.storageNode.credentialsJson)
          decryptedCredentialsCache.set(file.storageNode.id, credentialsStr)
        }

        if (file.thumbnail) {
          thumbnailUrl = await provider.generateViewUrl(credentialsStr, file.thumbnail.providerFileId)
        }
      } catch (err) {
        console.error(`Failed to generate signed thumbnail URL for trashed file ${file.id}:`, err)
      }

      return {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize.toString(),
        deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
        thumbnailFileId: file.thumbnailFileId,
        thumbnailUrl,
      }
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
    console.error('Error fetching trash files:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { fileIds } = await req.json()
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
    }

    const deletePromises = fileIds.map((id) =>
      StorageService.permanentlyDeleteFile(id, user.userId).catch((err) => {
        console.error(`Failed to permanently delete file ${id}:`, err)
        return { success: false, id, error: err.message }
      })
    )

    const results = await Promise.all(deletePromises)
    const failures = results.filter((r) => r && 'success' in r && !r.success)

    return NextResponse.json({
      success: true,
      count: fileIds.length - failures.length,
      failures,
    })
  } catch (error) {
    console.error('Error in bulk permanent delete:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

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

    const restorePromises = fileIds.map((id) =>
      StorageService.restoreFile(id, user.userId).catch((err) => {
        console.error(`Failed to restore file ${id}:`, err)
        return { success: false, id, error: err.message }
      })
    )

    const results = await Promise.all(restorePromises)
    const failures = results.filter((r) => r && 'success' in r && !r.success)

    return NextResponse.json({
      success: true,
      count: fileIds.length - failures.length,
      failures,
    })
  } catch (error) {
    console.error('Error in bulk restore:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
