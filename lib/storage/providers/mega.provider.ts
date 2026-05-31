import { Readable } from 'stream'
import { StorageProvider, StorageInfo, UploadResult } from './storage-provider.interface'
// @ts-ignore
import { Storage } from 'megajs'

export class MegaProvider implements StorageProvider {
  private async getStorageInstance(credentialsJson: string): Promise<any> {
    try {
      const creds = JSON.parse(credentialsJson)
      if (!creds.email || !creds.password) {
        throw new Error('MEGA email or password missing in credentials')
      }

      const storage = new Storage({
        email: creds.email,
        password: creds.password,
        keepalive: false, // Turn off keepalive to prevent sockets from hanging the Next.js worker processes
      })

      // Wait for login handshake and folder structure sync
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MEGA connection timeout'))
        }, 15000)

        storage.ready.then(() => {
          clearTimeout(timeout)
          resolve()
        }).catch((err: any) => {
          clearTimeout(timeout)
          reject(err)
        })
      })

      return storage
    } catch (err: any) {
      throw new Error(`Failed to initialize MEGA storage: ${err.message}`)
    }
  }

  async testConnection(credentialsJson: string): Promise<{ success: boolean }> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)
      return { success: true }
    } catch {
      return { success: false }
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }

  async upload(credentialsJson: string, fileBuffer: Buffer, fileName: string): Promise<UploadResult> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)

      const uploadStream = storage.upload({
        name: fileName,
        size: fileBuffer.length,
      })

      // Write data chunk and end stream
      uploadStream.write(fileBuffer)
      uploadStream.end()

      const fileNode = await uploadStream.complete

      return {
        providerFileId: fileNode.downloadId || fileNode.nodeId,
        size: fileBuffer.length,
      }
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }

  async download(credentialsJson: string, providerFileId: string): Promise<Readable> {
    const storage = await this.getStorageInstance(credentialsJson)
    const fileNode = storage.find(providerFileId)

    if (!fileNode) {
      storage.close()
      throw new Error('File not found on MEGA storage')
    }

    const downloadStream = fileNode.download()

    // Ensure the MEGA storage session connection is closed once streaming completes
    downloadStream.on('end', () => {
      try {
        storage.close()
      } catch {}
    })
    downloadStream.on('error', () => {
      try {
        storage.close()
      } catch {}
    })

    return downloadStream
  }

  async delete(credentialsJson: string, providerFileId: string): Promise<{ success: boolean }> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)
      const fileNode = storage.find(providerFileId)

      if (fileNode) {
        await fileNode.delete()
      }

      return { success: true }
    } catch (err: any) {
      console.error('[MEGA delete error]:', err)
      return { success: false }
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }

  async generateViewUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)
      const fileNode = storage.find(providerFileId)
      if (!fileNode) throw new Error('File not found')

      return await fileNode.link()
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }

  async generateStreamUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)
      const fileNode = storage.find(providerFileId)
      if (!fileNode) throw new Error('File not found')

      return await fileNode.link()
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }

  async generateDownloadUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)
      const fileNode = storage.find(providerFileId)
      if (!fileNode) throw new Error('File not found')

      return await fileNode.link()
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }

  async getStorageInfo(credentialsJson: string): Promise<StorageInfo> {
    let storage: any = null
    try {
      storage = await this.getStorageInstance(credentialsJson)
      const info = await storage.getAccountInfo()

      const totalBytes = Number(info.spaceTotal) || 0
      const usedBytes = Number(info.spaceUsed) || 0

      return {
        totalSpaceMb: Math.floor(totalBytes / (1024 * 1024)),
        usedSpaceMb: Math.floor(usedBytes / (1024 * 1024)),
      }
    } finally {
      if (storage) {
        try {
          storage.close()
        } catch {}
      }
    }
  }
}
