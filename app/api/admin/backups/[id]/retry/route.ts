import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../../lib/db'
import { AuthService } from '../../../../../../lib/services/auth.service'

async function verifyAdmin(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null

  const payload = AuthService.verifyAccessToken(accessToken)
  if (!payload || payload.role !== 'ADMIN') return null

  return payload
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    const backup = await db.backup.findUnique({
      where: { id },
    })

    if (!backup) {
      return NextResponse.json({ message: 'Backup job not found' }, { status: 404 })
    }

    await db.backup.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts: 0,
        errorMessage: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error retrying admin backup:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
