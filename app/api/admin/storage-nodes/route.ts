import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../lib/db'
import { AuthService } from '../../../../lib/services/auth.service'
import { encrypt } from '../../../../lib/storage/encryption'
import { StorageManager } from '../../../../lib/storage/manager'
import { z } from 'zod'

const CreateNodeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.enum(['B2']),
  credentials: z.record(z.string(), z.any()),
})

// Helper middleware to check Admin status
async function verifyAdmin(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value
  if (!accessToken) return null

  const payload = AuthService.verifyAccessToken(accessToken)
  if (!payload || payload.role !== 'ADMIN') return null

  return payload
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  try {
    const nodes = await db.storageNode.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Map to exclude encrypted credentials JSON when returning lists
    const safeNodes = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      provider: node.provider,
      totalSpaceMb: node.totalSpaceMb.toString(),
      usedSpaceMb: node.usedSpaceMb.toString(),
      isActive: node.isActive,
      lastSyncAt: node.lastSyncAt,
    }))

    return NextResponse.json({ nodes: safeNodes })
  } catch (error) {
    console.error('Error fetching nodes:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const result = CreateNodeSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ errors: result.error.flatten().fieldErrors }, { status: 400 })
    }

    const { name, provider, credentials } = result.data
    const credentialsStr = JSON.stringify(credentials)

    // Test connection with adapter first
    const adapter = StorageManager.getProvider(provider)
    const testResult = await adapter.testConnection(credentialsStr)

    if (!testResult.success) {
      return NextResponse.json({ message: 'Connection test failed with provided credentials' }, { status: 400 })
    }

    // Encrypt credentials JSON
    const encryptedCredentials = encrypt(credentialsStr)

    // Get storage info stats (non-blocking — defaults to 0 if it fails)
    let totalSpaceMb = BigInt(0)
    let usedSpaceMb = BigInt(0)
    try {
      const stats = await adapter.getStorageInfo(credentialsStr)
      totalSpaceMb = BigInt(Math.max(0, stats.totalSpaceMb || 0))
      usedSpaceMb = BigInt(Math.max(0, stats.usedSpaceMb || 0))
    } catch (statsErr) {
      console.warn('Could not fetch storage stats (node will still be created):', statsErr)
    }

    const node = await db.storageNode.create({
      data: {
        name,
        provider,
        credentialsJson: encryptedCredentials,
        totalSpaceMb,
        usedSpaceMb,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      node: {
        id: node.id,
        name: node.name,
        provider: node.provider,
        totalSpaceMb: node.totalSpaceMb.toString(),
        usedSpaceMb: node.usedSpaceMb.toString(),
        isActive: node.isActive,
      },
    })
  } catch (error) {
    console.error('Error creating storage node:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
