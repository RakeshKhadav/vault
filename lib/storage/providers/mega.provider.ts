import { Readable } from 'stream'
import { StorageProvider, StorageInfo, UploadResult } from './storage-provider.interface'

export class MegaProvider implements StorageProvider {
  async testConnection(credentialsJson: string): Promise<{ success: boolean }> {
    try {
      const creds = JSON.parse(credentialsJson)
      if (!creds.email || !creds.password) {
        return { success: false }
      }
      return { success: true }
    } catch {
      return { success: false }
    }
  }

  async upload(credentialsJson: string, fileBuffer: Buffer, fileName: string): Promise<UploadResult> {
    // For V1/Phase 4, mock actual upload process
    const providerFileId = `mega-file-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    return {
      providerFileId,
      size: fileBuffer.length,
    }
  }

  async download(credentialsJson: string, providerFileId: string): Promise<Readable> {
    const s = new Readable()
    s.push('mock-mega-file-data')
    s.push(null)
    return s
  }

  async delete(credentialsJson: string, providerFileId: string): Promise<{ success: boolean }> {
    return { success: true }
  }

  async generateViewUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    return `https://mega.nz/mock-view-url/${providerFileId}`
  }

  async generateStreamUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    return `https://mega.nz/mock-stream-url/${providerFileId}`
  }

  async generateDownloadUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    return `https://mega.nz/mock-download-url/${providerFileId}`
  }

  async getStorageInfo(credentialsJson: string): Promise<StorageInfo> {
    return {
      totalSpaceMb: 20480, // 20GB
      usedSpaceMb: 1024,   // 1GB
    }
  }
}
