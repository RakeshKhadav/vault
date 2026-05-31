import { startBackupWorker } from './backup.worker'
import { startBackupRetryWorker } from './backup-retry.worker'
import { startStorageSyncWorker } from './storage-sync.worker'
import { startTrashCleanupWorker } from './trash-cleanup.worker'
import { startSessionCleanupWorker } from './session-cleanup.worker'

export function startWorkers() {
  // Guard to run only in Node.js server runtime, not during static builds
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    startBackupWorker()
    startBackupRetryWorker()
    startStorageSyncWorker()
    startTrashCleanupWorker()
    startSessionCleanupWorker()
  }
}
