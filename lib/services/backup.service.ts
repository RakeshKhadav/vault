import { db } from '../db'
import { StorageManager } from '../storage/manager'
import { TelegramProvider } from '../storage/providers/telegram.provider'
import { decrypt } from '../storage/encryption'

export class BackupService {
  static async createBackupJob(fileId: string) {
    return db.backup.create({
      data: {
        fileId,
        backupProvider: 'TELEGRAM',
        status: 'PENDING',
        attempts: 0,
      },
    })
  }

  static async processPendingBackups() {
    const pendingJobs = await db.backup.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: 3 },
      },
      orderBy: { createdAt: 'asc' },
      take: 10, // process in small batches
    })

    for (const job of pendingJobs) {
      await this.processBackupJob(job.id).catch((err) => {
        console.error(`Error processing backup job ${job.id}:`, err)
      })
    }
  }

  static async processBackupJob(backupId: string) {
    const job = await db.backup.findUnique({
      where: { id: backupId },
      include: {
        file: {
          include: { storageNode: true },
        },
      },
    })

    if (!job || !job.file) {
      throw new Error(`Backup job ${backupId} or associated file not found`)
    }

    // Increment attempts
    const currentAttempts = job.attempts + 1
    await db.backup.update({
      where: { id: backupId },
      data: { attempts: currentAttempts },
    })

    try {
      const file = job.file
      const provider = StorageManager.getProvider(file.storageNode.provider)
      const credentialsStr = decrypt(file.storageNode.credentialsJson)
      
      // Download the file stream from primary storage
      const stream = await provider.download(credentialsStr, file.providerFileId)
      
      // Convert Node readable stream to Buffer
      const chunks: any[] = []
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      // Upload buffer to Telegram
      const uploadResult = await TelegramProvider.uploadFile(
        buffer,
        file.originalName,
        file.mimeType
      )

      if (uploadResult.success && uploadResult.telegramFileId) {
        // Success: update status
        await db.backup.update({
          where: { id: backupId },
          data: {
            status: 'SUCCESS',
            backupFileId: uploadResult.telegramFileId,
            errorMessage: null,
          },
        })
      } else {
        throw new Error(uploadResult.error || 'Upload failed without explicit error message')
      }
    } catch (err: any) {
      const errMsg = err.message || String(err)
      
      // If we reached the max attempts limit (3), mark as permanently FAILED
      const finalStatus = currentAttempts >= 3 ? 'FAILED' : 'PENDING'

      await db.backup.update({
        where: { id: backupId },
        data: {
          status: finalStatus,
          errorMessage: errMsg,
        },
      })
      
      throw err
    }
  }
}
