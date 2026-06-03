import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageManager } from '../../../../../lib/storage/manager'
import { decrypt } from '../../../../../lib/storage/encryption'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.findFirst({
      where: {
        id,
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
      include: {
        storageNode: true,
        preview: true,
      },
    })

    if (!file) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const credentialsStr = decrypt(file.storageNode.credentialsJson)

    let viewUrl: string | null = null
    let previewUrl: string | null = null
    let streamUrl: string | null = null

    if (file.mimeType.startsWith('video/')) {
      streamUrl = await provider.generateStreamUrl(credentialsStr, file.providerFileId)
    } else if (file.mimeType.startsWith('image/')) {
      viewUrl = await provider.generateViewUrl(credentialsStr, file.providerFileId)
      if (file.preview) {
        previewUrl = await provider.generateViewUrl(credentialsStr, file.preview.providerFileId)
      }
    }

    return NextResponse.json({
      viewUrl,
      previewUrl,
      streamUrl,
    })
  } catch (error) {
    console.error(`Error resolving lazy URL for file ${id}:`, error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
