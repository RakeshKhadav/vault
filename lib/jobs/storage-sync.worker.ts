import { db } from '../db'
import { decrypt } from '../storage/encryption'
import { StorageManager } from '../storage/manager'

let isProcessing = false

export function startStorageSyncWorker() {
  console.log('--- STORAGE NODE SYNC WORKER STARTED ---')

  setInterval(async () => {
    if (isProcessing) return
    isProcessing = true

    try {
      const activeNodes = await db.storageNode.findMany({
        where: { isActive: true },
      })

      for (const node of activeNodes) {
        try {
          const credentialsStr = decrypt(node.credentialsJson)
          const provider = StorageManager.getProvider(node.provider)
          const stats = await provider.getStorageInfo(credentialsStr)

          await db.storageNode.update({
            where: { id: node.id },
            data: {
              totalSpaceMb: BigInt(Math.max(0, stats.totalSpaceMb || 0)),
              usedSpaceMb: BigInt(Math.max(0, stats.usedSpaceMb || 0)),
              lastSyncAt: new Date(),
            },
          })

          console.log(`[Storage Sync Worker] Synced storage metrics for node "${node.name}" (${node.provider}).`)
        } catch (nodeError) {
          console.error(`[Storage Sync Worker] Failed to sync node ${node.id} (${node.name}):`, nodeError)
        }
      }
    } catch (error) {
      console.error('[Storage Sync Worker] Error fetching active storage nodes:', error)
    } finally {
      isProcessing = false
    }
  }, 6 * 60 * 60 * 1000) // Every 6 hours
}
