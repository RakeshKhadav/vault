import { StorageManager } from '../storage/manager'
import { db } from '../db'
import { Readable } from 'stream'
import { MediaProcessor } from '../storage/media'

export class StorageService {
  static async uploadFile(userId: string, fileBuffer: Buffer, fileName: string, mimeType: string) {
    const sizeInMb = fileBuffer.length / (1024 * 1024)
    // 1. Select the storage node using allocation strategy with size check
    const node = await StorageManager.selectUploadNode(sizeInMb)
    const provider = StorageManager.getProvider(node.provider)

    // 2. Perform upload via provider adapter
    const uploadResult = await provider.upload(node.credentialsJson, fileBuffer, fileName)

    // 3. Save original file metadata in database
    const file = await db.file.create({
      data: {
        userId,
        storageNodeId: node.id,
        fileName,
        originalName: fileName,
        providerFileId: uploadResult.providerFileId,
        mimeType,
        fileSize: uploadResult.size,
      },
    })

    // 4. Generate & upload thumbnail
    try {
      let thumbnailBuffer: Buffer | null = null
      const isImage = mimeType.startsWith('image/')
      const isVideo = mimeType.startsWith('video/')

      if (isImage) {
        thumbnailBuffer = await MediaProcessor.generateImageThumbnail(fileBuffer)
      } else if (isVideo) {
        thumbnailBuffer = await MediaProcessor.generateVideoThumbnail(fileBuffer, fileName)
      }

      if (thumbnailBuffer) {
        const thumbName = `thumb-${fileName}.jpg`
        const thumbUpload = await provider.upload(node.credentialsJson, thumbnailBuffer, thumbName)

        // Save thumbnail as a file record
        const thumbFile = await db.file.create({
          data: {
            userId,
            storageNodeId: node.id,
            fileName: thumbName,
            originalName: thumbName,
            providerFileId: thumbUpload.providerFileId,
            mimeType: 'image/jpeg',
            fileSize: thumbUpload.size,
          },
        })

        // Link original file to thumbnail
        await db.file.update({
          where: { id: file.id },
          data: { thumbnailFileId: thumbFile.id },
        })
      }
    } catch (err) {
      console.error('Thumbnail generation skipped/failed:', err)
    }

    // 5. Update the storage node's used space
    await db.storageNode.update({
      where: { id: node.id },
      data: {
        usedSpaceMb: {
          increment: Math.ceil(sizeInMb),
        },
      },
    })

    return file
  }

  static async getDownloadStream(fileId: string, userId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
      include: { storageNode: true },
    })

    if (!file) {
      throw new Error('File not found')
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    return provider.download(file.storageNode.credentialsJson, file.providerFileId)
  }

  static async softDeleteFile(fileId: string, userId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    })

    if (!file) {
      throw new Error('File not found')
    }

    await db.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    })

    return { success: true }
  }

  static async restoreFile(fileId: string, userId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, userId, deletedAt: { not: null } },
    })

    if (!file) {
      throw new Error('File not found')
    }

    await db.file.update({
      where: { id: fileId },
      data: { deletedAt: null },
    })

    return { success: true }
  }

  static async permanentlyDeleteFile(fileId: string, userId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, userId },
      include: { storageNode: true },
    })

    if (!file) {
      throw new Error('File not found')
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    await provider.delete(file.storageNode.credentialsJson, file.providerFileId)

    // Check if thumbnail exists and delete it as well
    if (file.thumbnailFileId) {
      const thumb = await db.file.findFirst({
        where: { id: file.thumbnailFileId },
      })
      if (thumb) {
        await provider.delete(file.storageNode.credentialsJson, thumb.providerFileId).catch(() => {})
        await db.file.delete({
          where: { id: thumb.id },
        }).catch(() => {})
      }
    }

    // Delete file metadata permanently
    await db.file.delete({
      where: { id: fileId },
    })

    // Reduce storage node allocation
    const sizeInMb = Number(file.fileSize) / (1024 * 1024)
    await db.storageNode.update({
      where: { id: file.storageNodeId },
      data: {
        usedSpaceMb: {
          decrement: Math.max(1, Math.ceil(sizeInMb)),
        },
      },
    })

    return { success: true }
  }

  static async deleteFile(fileId: string, userId: string) {
    return this.permanentlyDeleteFile(fileId, userId)
  }
}
