import { StorageManager } from '../storage/manager'
import { db } from '../db'
import { Readable } from 'stream'
import { MediaProcessor } from '../storage/media'
import { BackupService } from './backup.service'
import { decrypt } from '../storage/encryption'
import crypto from 'crypto'

export class StorageService {
  static async uploadFile(userId: string, fileBuffer: Buffer, fileName: string, mimeType: string) {
    const sizeInMb = fileBuffer.length / (1024 * 1024)
    // 1. Select the storage node using allocation strategy with size check
    const node = await StorageManager.selectUploadNode(sizeInMb)
    const provider = StorageManager.getProvider(node.provider)
    const credentialsStr = decrypt(node.credentialsJson)

    // 2. Generate thumbnail and preview buffers beforehand
    let thumbnailBuffer: Buffer | null = null
    let previewBuffer: Buffer | null = null
    const isImage = mimeType.startsWith('image/')
    const isVideo = mimeType.startsWith('video/')
    const thumbName = `thumb-${fileName}.webp`
    const previewName = `preview-${fileName}.webp`

    try {
      if (isImage) {
        thumbnailBuffer = await MediaProcessor.generateImageThumbnail(fileBuffer)
        previewBuffer = await MediaProcessor.generateImagePreview(fileBuffer)
      } else if (isVideo) {
        thumbnailBuffer = await MediaProcessor.generateVideoThumbnail(fileBuffer, fileName)
      }
    } catch (err) {
      console.error('Thumbnail/Preview generation skipped/failed:', err)
    }

    // 3. Perform upload via provider adapter (uploading both files in one go!)
    const uploadResult = await provider.upload(
      credentialsStr,
      fileBuffer,
      fileName,
      thumbnailBuffer || undefined,
      thumbnailBuffer ? thumbName : undefined
    )

    // 3.5. Upload preview image if generated
    let previewResult: { providerFileId: string; size: number } | undefined
    if (previewBuffer) {
      try {
        const previewKey = `preview-${crypto.randomUUID()}-${previewName}`
        await provider.uploadBuffer(credentialsStr, previewBuffer, previewKey, 'image/webp')
        previewResult = {
          providerFileId: previewKey,
          size: previewBuffer.length,
        }
      } catch (uploadErr) {
        console.error('Preview upload failed:', uploadErr)
      }
    }

    // 4. Save original file metadata in database
    const file = await db.file.create({
      data: {
        userId,
        storageNodeId: node.id,
        fileName,
        originalName: fileName,
        providerFileId: uploadResult.file.providerFileId,
        mimeType,
        fileSize: uploadResult.file.size,
      },
    })

    let finalFile = file

    // 5. Save thumbnail metadata and link if uploaded
    if (uploadResult.thumbnail) {
      try {
        const thumbFile = await db.file.create({
          data: {
            userId,
            storageNodeId: node.id,
            fileName: thumbName,
            originalName: thumbName,
            providerFileId: uploadResult.thumbnail.providerFileId,
            mimeType: 'image/webp',
            fileSize: uploadResult.thumbnail.size,
          },
        })

        // Link original file to thumbnail
        finalFile = await db.file.update({
          where: { id: finalFile.id },
          data: { thumbnailFileId: thumbFile.id },
        })
      } catch (dbErr) {
        console.error('Failed to save thumbnail metadata to DB:', dbErr)
      }
    }

    // 5.5. Save preview metadata and link if uploaded
    if (previewResult) {
      try {
        const prevFile = await db.file.create({
          data: {
            userId,
            storageNodeId: node.id,
            fileName: previewName,
            originalName: previewName,
            providerFileId: previewResult.providerFileId,
            mimeType: 'image/webp',
            fileSize: BigInt(previewResult.size),
          },
        })

        // Link original file to preview
        finalFile = await db.file.update({
          where: { id: finalFile.id },
          data: { previewFileId: prevFile.id },
        })
      } catch (dbErr) {
        console.error('Failed to save preview metadata to DB:', dbErr)
      }
    }

    // 6. Update the storage node's used space (including thumbnail/preview size if uploaded)
    const totalUploadedSizeMb = (fileBuffer.length + (thumbnailBuffer?.length || 0) + (previewBuffer?.length || 0)) / (1024 * 1024)
    await db.storageNode.update({
      where: { id: node.id },
      data: {
        usedSpaceMb: {
          increment: Math.ceil(totalUploadedSizeMb),
        },
      },
    })

    // 7. Queue background backup job if file is an image or video under 1GB
    const oneGb = 1024 * 1024 * 1024
    if (isImage || (isVideo && fileBuffer.length <= oneGb)) {
      await BackupService.createBackupJob(finalFile.id).catch((err) => {
        console.error('Failed to create backup job:', err)
      })
    }

    return finalFile
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
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    return provider.download(credentialsStr, file.providerFileId)
  }

  static async getDownloadUrl(fileId: string, userId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
      include: { storageNode: true },
    })

    if (!file) {
      throw new Error('File not found')
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    return provider.generateDownloadUrl(credentialsStr, file.providerFileId)
  }

  static async softDeleteFile(fileId: string, userId: string, userRole?: string) {
    const file = await db.file.findFirst({
      where: {
        id: fileId,
        userId: userRole === 'ADMIN' ? undefined : userId,
        deletedAt: null,
      },
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
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    await provider.delete(credentialsStr, file.providerFileId)

    // Check if thumbnail exists and delete it as well
    if (file.thumbnailFileId) {
      const thumb = await db.file.findFirst({
        where: { id: file.thumbnailFileId },
      })
      if (thumb) {
        await provider.delete(credentialsStr, thumb.providerFileId).catch(() => {})
        await db.file.delete({
          where: { id: thumb.id },
        }).catch(() => {})
      }
    }

    // Check if preview exists and delete it as well
    if (file.previewFileId) {
      const prev = await db.file.findFirst({
        where: { id: file.previewFileId },
      })
      if (prev) {
        await provider.delete(credentialsStr, prev.providerFileId).catch(() => {})
        await db.file.delete({
          where: { id: prev.id },
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

  static async getDownloadStreamAdmin(fileId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, deletedAt: null },
      include: { storageNode: true },
    })

    if (!file) {
      throw new Error('File not found')
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    return provider.download(credentialsStr, file.providerFileId)
  }

  static async getDownloadUrlAdmin(fileId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, deletedAt: null },
      include: { storageNode: true },
    })

    if (!file) {
      throw new Error('File not found')
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    return provider.generateDownloadUrl(credentialsStr, file.providerFileId)
  }

  static async permanentlyDeleteFileAdmin(fileId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId },
      include: { storageNode: true },
    })

    if (!file) {
      throw new Error('File not found')
    }

    const provider = StorageManager.getProvider(file.storageNode.provider)
    const credentialsStr = decrypt(file.storageNode.credentialsJson)
    await provider.delete(credentialsStr, file.providerFileId)

    // Check if thumbnail exists and delete it as well
    if (file.thumbnailFileId) {
      const thumb = await db.file.findFirst({
        where: { id: file.thumbnailFileId },
      })
      if (thumb) {
        await provider.delete(credentialsStr, thumb.providerFileId).catch(() => {})
        await db.file.delete({
          where: { id: thumb.id },
        }).catch(() => {})
      }
    }

    // Check if preview exists and delete it as well
    if (file.previewFileId) {
      const prev = await db.file.findFirst({
        where: { id: file.previewFileId },
      })
      if (prev) {
        await provider.delete(credentialsStr, prev.providerFileId).catch(() => {})
        await db.file.delete({
          where: { id: prev.id },
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

  static async confirmDirectUpload(
    userId: string,
    jobId: string,
    nodeId: string,
    providerFileId: string,
    fileName: string,
    mimeType: string,
    fileSize: number
  ) {
    const node = await db.storageNode.findFirst({
      where: { id: nodeId, isActive: true },
    })

    if (!node) {
      throw new Error('Storage node not found or inactive')
    }

    const provider = StorageManager.getProvider(node.provider)
    const credentialsStr = decrypt(node.credentialsJson)

    const exists = await provider.verifyFileExists(credentialsStr, providerFileId)
    if (!exists) {
      throw new Error('File does not exist on storage provider')
    }

    let thumbnailBuffer: Buffer | null = null
    let previewBuffer: Buffer | null = null
    const isImage = mimeType.startsWith('image/')
    const isVideo = mimeType.startsWith('video/')
    const thumbName = `thumb-${fileName}.webp`
    const previewName = `preview-${fileName}.webp`
    let thumbnailResult: { providerFileId: string; size: number } | undefined
    let previewResult: { providerFileId: string; size: number } | undefined

    try {
      if (isImage) {
        const stream = await provider.download(credentialsStr, providerFileId)
        // Convert stream to Buffer once so we can process it for both thumbnail and preview
        const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = []
          stream.on('data', (chunk) => chunks.push(chunk))
          stream.on('end', () => resolve(Buffer.concat(chunks)))
          stream.on('error', (err) => reject(err))
        })
        thumbnailBuffer = await MediaProcessor.generateImageThumbnail(fileBuffer)
        previewBuffer = await MediaProcessor.generateImagePreview(fileBuffer)
      } else if (isVideo) {
        const presignedUrl = await provider.generateViewUrl(credentialsStr, providerFileId)
        thumbnailBuffer = await MediaProcessor.generateVideoThumbnailFromUrl(presignedUrl, fileName)
      }

      if (thumbnailBuffer) {
        const thumbKey = `thumb-${crypto.randomUUID()}-${thumbName}`
        await provider.uploadBuffer(credentialsStr, thumbnailBuffer, thumbKey, 'image/webp')
        thumbnailResult = {
          providerFileId: thumbKey,
          size: thumbnailBuffer.length,
        }
      }

      if (previewBuffer) {
        const previewKey = `preview-${crypto.randomUUID()}-${previewName}`
        await provider.uploadBuffer(credentialsStr, previewBuffer, previewKey, 'image/webp')
        previewResult = {
          providerFileId: previewKey,
          size: previewBuffer.length,
        }
      }
    } catch (err) {
      console.error('Thumbnail/Preview generation/upload failed:', err)
    }

    const file = await db.file.create({
      data: {
        userId,
        storageNodeId: node.id,
        fileName,
        originalName: fileName,
        providerFileId,
        mimeType,
        fileSize: BigInt(fileSize),
      },
    })

    let finalFile = file

    if (thumbnailResult) {
      try {
        const thumbFile = await db.file.create({
          data: {
            userId,
            storageNodeId: node.id,
            fileName: thumbName,
            originalName: thumbName,
            providerFileId: thumbnailResult.providerFileId,
            mimeType: 'image/webp',
            fileSize: BigInt(thumbnailResult.size),
          },
        })

        finalFile = await db.file.update({
          where: { id: finalFile.id },
          data: { thumbnailFileId: thumbFile.id },
        })
      } catch (dbErr) {
        console.error('Failed to save thumbnail metadata to DB:', dbErr)
      }
    }

    if (previewResult) {
      try {
        const prevFile = await db.file.create({
          data: {
            userId,
            storageNodeId: node.id,
            fileName: previewName,
            originalName: previewName,
            providerFileId: previewResult.providerFileId,
            mimeType: 'image/webp',
            fileSize: BigInt(previewResult.size),
          },
        })

        finalFile = await db.file.update({
          where: { id: finalFile.id },
          data: { previewFileId: prevFile.id },
        })
      } catch (dbErr) {
        console.error('Failed to save preview metadata to DB:', dbErr)
      }
    }

    const totalUploadedSizeMb = (fileSize + (thumbnailBuffer?.length || 0) + (previewBuffer?.length || 0)) / (1024 * 1024)
    await db.storageNode.update({
      where: { id: node.id },
      data: {
        usedSpaceMb: {
          increment: Math.ceil(totalUploadedSizeMb),
        },
      },
    })

    const oneGb = 1024 * 1024 * 1024
    if (isImage || (isVideo && fileSize <= oneGb)) {
      await BackupService.createBackupJob(finalFile.id).catch((err) => {
        console.error('Failed to create backup job:', err)
      })
    }

    return finalFile
  }
}
