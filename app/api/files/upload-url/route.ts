import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { StorageManager } from '../../../../lib/storage/manager'
import { decrypt } from '../../../../lib/storage/encryption'
import crypto from 'crypto'

const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_VIDEOS = ['video/mp4', 'video/quicktime', 'video/webm']

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { fileName, mimeType, fileSize } = await req.json()

    if (!fileName || !mimeType || typeof fileSize !== 'number') {
      return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 })
    }

    const isImage = ALLOWED_IMAGES.includes(mimeType)
    const isVideo = ALLOWED_VIDEOS.includes(mimeType)

    if (!isImage && !isVideo) {
      return NextResponse.json({ message: `Unsupported file type: ${fileName}` }, { status: 415 })
    }

    if (isImage && fileSize > MAX_IMAGE_SIZE) {
      return NextResponse.json({ message: `Image too large (Max 20MB): ${fileName}` }, { status: 413 })
    }

    if (isVideo && fileSize > MAX_VIDEO_SIZE) {
      return NextResponse.json({ message: `Video too large (Max 2GB): ${fileName}` }, { status: 413 })
    }

    const fileSizeMb = fileSize / (1024 * 1024)
    const node = await StorageManager.selectUploadNode(fileSizeMb)
    const provider = StorageManager.getProvider(node.provider)
    const credentialsStr = decrypt(node.credentialsJson)

    const providerFileId = `${crypto.randomUUID()}-${fileName}`
    const uploadUrl = await provider.generateUploadUrl(credentialsStr, providerFileId, mimeType)

    const job = await db.uploadJob.create({
      data: {
        userId: user.userId,
        fileName: fileName,
        status: 'UPLOADING',
      },
    })

    return NextResponse.json({
      uploadUrl,
      providerFileId,
      storageNodeId: node.id,
      jobId: job.id,
    })
  } catch (error: any) {
    console.error('Error generating upload URL:', error)
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
