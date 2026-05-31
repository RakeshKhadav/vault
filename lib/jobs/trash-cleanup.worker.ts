import { db } from '../db'
import { StorageService } from '../services/storage.service'

let isProcessing = false

export function startTrashCleanupWorker() {
  console.log('--- TRASH CLEANUP WORKER STARTED ---')

  setInterval(async () => {
    if (isProcessing) return
    isProcessing = true

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const filesToPurge = await db.file.findMany({
        where: {
          deletedAt: {
            not: null,
            lte: thirtyDaysAgo,
          },
        },
        select: {
          id: true,
          originalName: true,
        },
      })

      if (filesToPurge.length > 0) {
        console.log(`[Trash Cleanup Worker] Found ${filesToPurge.length} files to permanently purge from trash.`)

        for (const file of filesToPurge) {
          try {
            await StorageService.permanentlyDeleteFileAdmin(file.id)
            console.log(`[Trash Cleanup Worker] Permanently deleted "${file.originalName}" (${file.id}) from trash.`)
          } catch (deleteError) {
            console.error(`[Trash Cleanup Worker] Error deleting file ${file.id}:`, deleteError)
          }
        }
      }
    } catch (error) {
      console.error('[Trash Cleanup Worker] Error fetching expired trash files:', error)
    } finally {
      isProcessing = false
    }
  }, 24 * 60 * 60 * 1000) // Daily
}
