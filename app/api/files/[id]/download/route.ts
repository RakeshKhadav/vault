import { NextRequest } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageService } from '../../../../../lib/services/storage.service'
import { AuthService } from '../../../../../lib/services/auth.service'

async function verifyAuth(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
}

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

    const stream = user.role === 'ADMIN'
      ? await StorageService.getDownloadStreamAdmin(id)
      : await StorageService.getDownloadStream(id, user.userId)

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
    console.error('Error streaming download:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
