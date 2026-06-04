import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../../lib/db'
import { StorageService } from '../../../../../../lib/services/storage.service'
import { verifyAdmin } from '@/lib/utils/auth-helper'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return new Response('Unauthorized', { status: 403 })
  }

  const { id } = await params

  try {
    const file = await db.file.findFirst({
      where: { id, deletedAt: null },
    })

    if (!file) {
      return new Response('File not found', { status: 404 })
    }

    const stream = await StorageService.getDownloadStreamAdmin(id)

    // Convert node Readable stream to Web Response stream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
    })

    return new Response(webStream, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      },
    })
  } catch (error) {
    console.error('Error admin streaming download:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
