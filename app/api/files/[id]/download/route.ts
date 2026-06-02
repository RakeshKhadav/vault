import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageService } from '../../../../../lib/services/storage.service'
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.findFirst({
      where: {
        id,
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
    })

    if (!file) {
      return new Response('File not found', { status: 404 })
    }

    const downloadUrl = user.role === 'ADMIN'
      ? await StorageService.getDownloadUrlAdmin(id)
      : await StorageService.getDownloadUrl(id, user.userId)

    return NextResponse.redirect(downloadUrl, 307)
  } catch (error) {
    console.error('Error getting download URL:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
