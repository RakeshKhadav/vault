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
    const files = await db.file.findMany({
      where: {
        userId: user.userId,
        deletedAt: { not: null },
        thumbnailOf: null,
        previewOf: null,
      },
      orderBy: { deletedAt: 'desc' },
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

    const formattedFiles = await Promise.all(files.map(async (file) => {
      let thumbnailUrl: string | null = null

      try {
        const provider = StorageManager.getProvider(file.storageNode.provider)
        const credentialsStr = decrypt(file.storageNode.credentialsJson)

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

    return NextResponse.json({ files: formattedFiles }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  } catch (error) {
    console.error('Error fetching trash files:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
