import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { AuthService } from '../../../../../lib/services/auth.service'
import { StorageManager } from '../../../../../lib/storage/manager'

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
    return new Response(null, { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.findFirst({
      where: { id, userId: user.userId, deletedAt: null },
      include: { 
        storageNode: true,
        thumbnail: true,
      },
    })

    if (!file || !file.thumbnail) {
      return new Response(null, { status: 404 })
    }

    const thumbnail = file.thumbnail

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const stream = await provider.download(file.storageNode.credentialsJson, thumbnail.providerFileId)

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
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving thumbnail:', error)
    return new Response(null, { status: 500 })
  }
}
