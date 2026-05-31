import { db } from '../db'
import { StorageProvider } from './providers/storage-provider.interface'
import { MegaProvider } from './providers/mega.provider'
import { PCloudProvider } from './providers/pcloud.provider'
import { ProviderType } from '@prisma/client'

export class StorageManager {
  private static providers: Record<ProviderType, StorageProvider> = {
    MEGA: new MegaProvider(),
    PCLOUD: new PCloudProvider(),
  }

  static getProvider(type: ProviderType): StorageProvider {
    const provider = this.providers[type]
    if (!provider) {
      throw new Error(`Unsupported storage provider type: ${type}`)
    }
    return provider
  }

  static async selectUploadNode(fileSizeMb: number = 0) {
    const activeNodes = await db.storageNode.findMany({
      where: { isActive: true },
    })

    if (activeNodes.length === 0) {
      throw new Error('No active storage nodes available for upload')
    }

    // Filter nodes that have enough remaining capacity for the file
    const eligibleNodes = activeNodes.filter((node) => {
      const remainingSpace = Number(node.totalSpaceMb) - Number(node.usedSpaceMb)
      return remainingSpace >= fileSizeMb
    })

    if (eligibleNodes.length === 0) {
      throw new Error('No active storage nodes have sufficient remaining capacity for the upload')
    }

    // Sort in-memory: find the node with the highest remaining space (totalSpaceMb - usedSpaceMb)
    eligibleNodes.sort((a, b) => {
      const remainingA = Number(a.totalSpaceMb) - Number(a.usedSpaceMb)
      const remainingB = Number(b.totalSpaceMb) - Number(b.usedSpaceMb)
      return remainingB - remainingA // DESC
    })

    return eligibleNodes[0]
  }
}
