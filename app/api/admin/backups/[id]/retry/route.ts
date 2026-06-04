import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../../lib/db'
import { verifyAdmin } from '@/lib/utils/auth-helper'
import { BackupService } from '../../../../../../lib/services/backup.service'

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
        backupFileId: null,
      },
    })

    // Process synchronously so UI receives updated state immediately
    try {
      await BackupService.processBackupJob(id)
    } catch (err) {
      console.error('Error in synchronous backup processing:', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error retrying admin backup:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
