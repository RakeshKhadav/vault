import { db } from '../db'

let isProcessing = false

export function startSessionCleanupWorker() {
  console.log('--- SESSION CLEANUP WORKER STARTED ---')

  setInterval(async () => {
    if (isProcessing) return
    isProcessing = true

    try {
      const result = await db.userSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })
      if (result.count > 0) {
        console.log(`[Session Cleanup Worker] Cleaned up ${result.count} expired user sessions.`)
      }
    } catch (error) {
      console.error('[Session Cleanup Worker] Error deleting expired user sessions:', error)
    } finally {
      isProcessing = false
    }
  }, 24 * 60 * 60 * 1000) // Daily
}
