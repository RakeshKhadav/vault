import { BackupService } from '../services/backup.service'

let isProcessing = false

export function startBackupWorker() {
  console.log('--- TELEGRAM BACKUP WORKER STARTED ---')

  setInterval(async () => {
    if (isProcessing) return
    isProcessing = true
    try {
      await BackupService.processPendingBackups()
    } catch (error) {
      console.error('Backup worker error in execution loop:', error)
    } finally {
      isProcessing = false
    }
  }, 10000) // run every 10 seconds
}
