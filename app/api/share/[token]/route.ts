import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
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
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 })
    }

    const file = await db.file.findFirst({
      where: {
        id: payload.fileId,
        userId: payload.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        uploadedAt: true,
      }
    })

    if (!file) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...file,
      fileSize: file.fileSize.toString(),
    })
  } catch (error) {
    return NextResponse.json({ message: 'Invalid or expired share token' }, { status: 401 })
  }
}
