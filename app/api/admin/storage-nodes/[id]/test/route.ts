import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../../lib/db'
import { AuthService } from '../../../../../../lib/services/auth.service'
import { decrypt } from '../../../../../../lib/storage/encryption'
import { StorageManager } from '../../../../../../lib/storage/manager'

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
    const node = await db.storageNode.findUnique({
      where: { id },
    })

    if (!node) {
      return NextResponse.json({ message: 'Storage node not found' }, { status: 404 })
    }

    // Decrypt credentials
    const credentialsStr = decrypt(node.credentialsJson)

    // Call adapter connection test
    const adapter = StorageManager.getProvider(node.provider)
    const testResult = await adapter.testConnection(credentialsStr)

    if (!testResult.success) {
      return NextResponse.json({ success: false, message: 'Connection check failed' })
    }

    // Update capacity stats during check
    const stats = await adapter.getStorageInfo(credentialsStr)
    await db.storageNode.update({
      where: { id },
      data: {
        totalSpaceMb: stats.totalSpaceMb,
        usedSpaceMb: stats.usedSpaceMb,
        lastSyncAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error testing storage node connection:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
