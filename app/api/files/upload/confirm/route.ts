import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageService } from '../../../../../lib/services/storage.service'

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { jobId, providerFileId, storageNodeId, fileName, mimeType, fileSize } = await req.json()

    if (!jobId || !providerFileId || !storageNodeId || !fileName || !mimeType || typeof fileSize !== 'number') {
      return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 })
    }

    const job = await db.uploadJob.findFirst({
      where: { id: jobId, userId: user.userId },
    })

    if (!job) {
      return NextResponse.json({ message: 'Upload job not found' }, { status: 404 })
    }

    // Process confirmation in the background so client is not blocked
    StorageService.confirmDirectUpload(
      user.userId,
      jobId,
      storageNodeId,
      providerFileId,
      fileName,
      mimeType,
      fileSize
    )
      .then(async () => {
        await db.uploadJob.update({
          where: { id: jobId },
          data: { status: 'SUCCESS' },
        })
      })
      .catch(async (err: any) => {
        console.error(`Direct upload confirmation failed for job ${jobId}:`, err)
        await db.uploadJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'Direct upload confirmation failed',
          },
        })
      })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error confirming direct upload:', error)
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
