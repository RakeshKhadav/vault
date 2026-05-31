import { NextRequest, NextResponse } from 'next/server'
import { StorageService } from '../../../../lib/services/storage.service'
import { AuthService } from '../../../../lib/services/auth.service'

async function verifyAuth(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null
  return AuthService.verifyAccessToken(accessToken)
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
    await StorageService.softDeleteFile(id, user.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error soft-deleting file:', error)
    if (error.message === 'File not found') {
      return new Response('File not found', { status: 404 })
    }
    return new Response('Internal server error', { status: 500 })
  }
}
