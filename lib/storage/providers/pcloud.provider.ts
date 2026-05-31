import { Readable } from 'stream'
import { StorageProvider, StorageInfo, UploadResult } from './storage-provider.interface'

export class PCloudProvider implements StorageProvider {
  private getAuthToken(credentialsJson: string): string {
    try {
      const creds = JSON.parse(credentialsJson)
      if (!creds.token) {
        throw new Error('pCloud token is missing in credentials')
      }
      return creds.token
    } catch (err: any) {
      throw new Error(`Failed to parse pCloud credentials: ${err.message}`)
    }
  }

  async testConnection(credentialsJson: string): Promise<{ success: boolean }> {
    try {
      const token = this.getAuthToken(credentialsJson)
      const res = await fetch(`https://api.pcloud.com/userinfo?auth=${token}`)
      if (!res.ok) return { success: false }

      const data = await res.json()
      return { success: data.result === 0 }
    } catch {
      return { success: false }
    }
  }

  async upload(credentialsJson: string, fileBuffer: Buffer, fileName: string): Promise<UploadResult> {
    const token = this.getAuthToken(credentialsJson)

    // Construct form data for pCloud upload API
    const formData = new FormData()
    formData.append('folderid', '0') // Upload to root folder
    formData.append('nopartial', '1') // Ensure atomic full upload

    // Cast Node Buffer to standard Uint8Array inside a Blob
    const blob = new Blob([new Uint8Array(fileBuffer)])
    formData.append('file', blob, fileName)

    const res = await fetch(`https://api.pcloud.com/uploadfile?auth=${token}`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      throw new Error(`pCloud upload failed: HTTP error ${res.status}`)
    }

    const data = await res.json()
    if (data.result !== 0) {
      throw new Error(`pCloud upload failed: ${data.error || 'Unknown error'}`)
    }

    if (!data.metadata || data.metadata.length === 0) {
      throw new Error('pCloud upload returned empty file metadata')
    }

    const fileMetadata = data.metadata[0]
    return {
      providerFileId: fileMetadata.fileid.toString(),
      size: fileMetadata.size,
    }
  }

  async download(credentialsJson: string, providerFileId: string): Promise<Readable> {
    const token = this.getAuthToken(credentialsJson)
    const downloadUrl = await this.resolveDownloadUrl(token, providerFileId)

    const fileRes = await fetch(downloadUrl)
    if (!fileRes.ok || !fileRes.body) {
      throw new Error(`Failed to stream download from pCloud: ${fileRes.statusText}`)
    }

    return Readable.fromWeb(fileRes.body as import('stream/web').ReadableStream)
  }

  async delete(credentialsJson: string, providerFileId: string): Promise<{ success: boolean }> {
    try {
      const token = this.getAuthToken(credentialsJson)
      const res = await fetch(`https://api.pcloud.com/deletefile?fileid=${providerFileId}&auth=${token}`)
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)

      const data = await res.json()
      return { success: data.result === 0 }
    } catch (err: any) {
      console.error('[pCloud delete error]:', err)
      return { success: false }
    }
  }

  async generateViewUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    const token = this.getAuthToken(credentialsJson)
    return this.resolveDownloadUrl(token, providerFileId)
  }

  async generateStreamUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    const token = this.getAuthToken(credentialsJson)
    return this.resolveDownloadUrl(token, providerFileId)
  }

  async generateDownloadUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    const token = this.getAuthToken(credentialsJson)
    return this.resolveDownloadUrl(token, providerFileId)
  }

  async getStorageInfo(credentialsJson: string): Promise<StorageInfo> {
    const token = this.getAuthToken(credentialsJson)
    const res = await fetch(`https://api.pcloud.com/userinfo?auth=${token}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch storage info: HTTP error ${res.status}`)
    }

    const data = await res.json()
    if (data.result !== 0) {
      throw new Error(data.error || 'Failed to fetch storage info')
    }

    // Convert bytes to MB (quota and usedquota are in bytes)
    const totalBytes = Number(data.quota)
    const usedBytes = Number(data.usedquota)

    return {
      totalSpaceMb: Math.floor(totalBytes / (1024 * 1024)),
      usedSpaceMb: Math.floor(usedBytes / (1024 * 1024)),
    }
  }

  private async resolveDownloadUrl(token: string, fileId: string): Promise<string> {
    const res = await fetch(`https://api.pcloud.com/getfilelink?fileid=${fileId}&auth=${token}`)
    if (!res.ok) {
      throw new Error(`Failed to resolve file link: HTTP error ${res.status}`)
    }

    const data = await res.json()
    if (data.result !== 0) {
      throw new Error(data.error || 'Failed to resolve file link')
    }

    if (!data.hosts || data.hosts.length === 0) {
      throw new Error('pCloud API returned empty download hosts list')
    }

    return `https://${data.hosts[0]}${data.path}`
  }
}
