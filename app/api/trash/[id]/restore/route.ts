import { verifyAuth } from '@/lib/utils/auth-helper'
import { NextRequest, NextResponse } from 'next/server'
import { StorageService } from '../../../../../lib/services/storage.service'
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
    await StorageService.restoreFile(id, user.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error restoring file:', error)
    if (error.message === 'File not found') {
      return new Response('File not found', { status: 404 })
    }
    return new Response('Internal server error', { status: 500 })
  }
}
