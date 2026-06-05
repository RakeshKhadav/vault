import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageManager } from '../../../../../lib/storage/manager'
import jwt from 'jsonwebtoken'
import { decrypt } from '../../../../../lib/storage/encryption'

const JWT_SHARE_SECRET = (process.env.JWT_SHARE_SECRET || process.env.JWT_ACCESS_SECRET) as string
if (!JWT_SHARE_SECRET && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('JWT_SHARE_SECRET or JWT_ACCESS_SECRET environment variable must be configured')
}

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
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    const viewUrl = await provider.generateViewUrl(credentialsStr, file.providerFileId)

    return NextResponse.redirect(viewUrl, 307)
  } catch (error) {
    return new Response('Invalid or expired share token', { status: 401 })
  }
}
