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
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.findFirst({
      where: { id, userId: user.userId, deletedAt: null },
      include: { storageNode: true },
    })

    if (!file) {
      return new Response('File not found', { status: 404 })
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const viewUrl = await provider.generateViewUrl(file.storageNode.credentialsJson, file.providerFileId)

    return NextResponse.redirect(viewUrl, 307)
  } catch (error) {
    console.error('Error generating view URL:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
