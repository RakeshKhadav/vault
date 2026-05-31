import { NextRequest } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageManager } from '../../../../../lib/storage/manager'
import jwt from 'jsonwebtoken'

const JWT_SHARE_SECRET = process.env.JWT_SHARE_SECRET || process.env.JWT_ACCESS_SECRET || 'fallback-share-secret'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const payload = jwt.verify(token, JWT_SHARE_SECRET) as { fileId: string; userId: string }
    if (!payload || !payload.fileId) {
      return new Response('Invalid or expired token', { status: 401 })
    }

    const file = await db.file.findFirst({
      where: {
        id: payload.fileId,
        userId: payload.userId,
        deletedAt: null,
      },
      include: { storageNode: true },
    })

    if (!file) {
      return new Response('File not found', { status: 404 })
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const stream = await provider.download(file.storageNode.credentialsJson, file.providerFileId)

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
    return new Response('Invalid or expired share token', { status: 401 })
  }
}
