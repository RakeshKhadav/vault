import { db } from '../db'

let isProcessing = false

export function startBackupRetryWorker() {
  console.log('--- BACKUP RETRY WORKER STARTED ---')

  setInterval(async () => {
    if (isProcessing) return
    isProcessing = true

    try {
      const result = await db.backup.updateMany({
        where: {
          status: 'FAILED',
        },
        data: {
          status: 'PENDING',
          attempts: 0,
          errorMessage: null,
        },
      })
      if (result.count > 0) {
        console.log(`[Backup Retry Worker] Reset ${result.count} failed backup jobs to PENDING.`)
      }
    } catch (error) {
      console.error('[Backup Retry Worker] Error resetting failed backups:', error)
    } finally {
      isProcessing = false
    }
  }, 15 * 60 * 1000) // Every 15 minutes
}
