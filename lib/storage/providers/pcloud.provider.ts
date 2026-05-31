import { Readable } from 'stream'
import { StorageProvider, StorageInfo, UploadResult } from './storage-provider.interface'

export class PCloudProvider implements StorageProvider {
  async testConnection(credentialsJson: string): Promise<{ success: boolean }> {
    try {
      const creds = JSON.parse(credentialsJson)
      if (!creds.token) {
        return { success: false }
      }
      return { success: true }
    } catch {
      return { success: false }
    }
  }

  async upload(credentialsJson: string, fileBuffer: Buffer, fileName: string): Promise<UploadResult> {
    const providerFileId = `pcloud-file-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    return {
      providerFileId,
      size: fileBuffer.length,
    }
  }

  async download(credentialsJson: string, providerFileId: string): Promise<Readable> {
    const s = new Readable()
    s.push('mock-pcloud-file-data')
    s.push(null)
    return s
  }

  async delete(credentialsJson: string, providerFileId: string): Promise<{ success: boolean }> {
    return { success: true }
  }

  async generateViewUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    return `https://my.pcloud.com/mock-view-url/${providerFileId}`
  }

  async generateStreamUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    return `https://my.pcloud.com/mock-stream-url/${providerFileId}`
  }

  async generateDownloadUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    return `https://my.pcloud.com/mock-download-url/${providerFileId}`
  }

  async getStorageInfo(credentialsJson: string): Promise<StorageInfo> {
    return {
      totalSpaceMb: 10240, // 10GB
      usedSpaceMb: 512,    // 512MB
    }
  }
}
