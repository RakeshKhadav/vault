import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'
import { StorageService } from '../../../../lib/services/storage.service'

const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_VIDEOS = ['video/mp4', 'video/quicktime', 'video/webm']

async function verifyAuth(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ message: 'No files uploaded' }, { status: 400 })
    }

    const jobIds: string[] = []

    for (const file of files) {
      const isImage = ALLOWED_IMAGES.includes(file.type)
      const isVideo = ALLOWED_VIDEOS.includes(file.type)

      if (!isImage && !isVideo) {
        return NextResponse.json({ message: `Unsupported file type: ${file.name}` }, { status: 415 })
      }

      if (isImage && file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ message: `Image too large (Max 20MB): ${file.name}` }, { status: 413 })
      }

      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        return NextResponse.json({ message: `Video too large (Max 2GB): ${file.name}` }, { status: 413 })
      }

      // Initialize upload job record
      const job = await db.uploadJob.create({
        data: {
          userId: user.userId,
          fileName: file.name,
          status: 'UPLOADING',
        },
      })
      jobIds.push(job.id)

      // Start upload process
      try {
        const fileBuffer = Buffer.from(await file.arrayBuffer())
        await StorageService.uploadFile(user.userId, fileBuffer, file.name, file.type)

        // Mark upload job as SUCCESS
        await db.uploadJob.update({
          where: { id: job.id },
          data: { status: 'SUCCESS' },
        })
      } catch (err: any) {
        console.error(`Upload error for job ${job.id}:`, err)
        await db.uploadJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'Storage upload failed',
          },
        })
      }
    }

    return NextResponse.json({ jobIds })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
