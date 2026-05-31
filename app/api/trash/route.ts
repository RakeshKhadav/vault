import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../lib/db'
import { AuthService } from '../../../lib/services/auth.service'

async function verifyAuth(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const files = await db.file.findMany({
      where: {
        userId: user.userId,
        deletedAt: { not: null },
        thumbnailOf: null,
      },
      orderBy: { deletedAt: 'desc' },
    })

    const formattedFiles = files.map((file) => ({
      ...file,
      fileSize: file.fileSize.toString(),
    }))

    return NextResponse.json({ files: formattedFiles })
  } catch (error) {
    console.error('Error fetching trash files:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
