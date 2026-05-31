import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { StorageService } from '../../../../../lib/services/storage.service'
import { AuthService } from '../../../../../lib/services/auth.service'

async function verifyAdmin(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null

  const payload = AuthService.verifyAccessToken(accessToken)
  if (!payload || payload.role !== 'ADMIN') return null

  return payload
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    const file = await db.file.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          }
        },
        storageNode: true,
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
    console.error('Error fetching admin file details:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    await StorageService.permanentlyDeleteFileAdmin(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error admin deleting file:', error)
    if (error.message === 'File not found') {
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
