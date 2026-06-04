import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/utils/auth-helper'

const UpdateNodeSchema = z.object({
  isActive: z.boolean(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const result = UpdateNodeSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ errors: result.error.flatten().fieldErrors }, { status: 400 })
    }

    const node = await db.storageNode.update({
      where: { id },
      data: { isActive: result.data.isActive },
    })

    return NextResponse.json({
      success: true,
      node: {
        id: node.id,
        isActive: node.isActive,
      },
    })
  } catch (error) {
    console.error('Error updating storage node:', error)
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
    // Cannot delete if active files are referencing this node
    const filesCount = await db.file.count({
      where: { storageNodeId: id, deletedAt: null },
    })

    if (filesCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete node. Active files are currently referencing it.' },
        { status: 409 }
      )
    }

    await db.storageNode.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting storage node:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
