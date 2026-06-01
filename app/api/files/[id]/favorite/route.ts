import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { AuthService } from '../../../../../lib/services/auth.service'

async function verifyAuth(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.updateMany({
      where: {
        id,
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
      data: { isFavorite: true },
    })

    if (file.count === 0) {
      return new Response('File not found', { status: 404 })
    }

    return NextResponse.json({ favorite: true })
  } catch (error) {
    console.error('Error favoriting file:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  try {
    const file = await db.file.updateMany({
      where: {
        id,
        userId: user.role === 'ADMIN' ? undefined : user.userId,
        deletedAt: null,
      },
      data: { isFavorite: false },
    })

    if (file.count === 0) {
      return new Response('File not found', { status: 404 })
    }

    return NextResponse.json({ favorite: false })
  } catch (error) {
    console.error('Error unfavoriting file:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
