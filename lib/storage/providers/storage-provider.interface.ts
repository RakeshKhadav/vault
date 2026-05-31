import { Readable } from 'stream'

export interface StorageInfo {
  totalSpaceMb: number
  usedSpaceMb: number
}

export interface UploadResult {
  providerFileId: string
  size: number
}

export interface StorageProvider {
  testConnection(credentialsJson: string): Promise<{ success: boolean }>
  upload(credentialsJson: string, fileBuffer: Buffer, fileName: string): Promise<UploadResult>
  download(credentialsJson: string, providerFileId: string): Promise<Readable>
  delete(credentialsJson: string, providerFileId: string): Promise<{ success: boolean }>
  generateViewUrl(credentialsJson: string, providerFileId: string): Promise<string>
  generateStreamUrl(credentialsJson: string, providerFileId: string): Promise<string>
  generateDownloadUrl(credentialsJson: string, providerFileId: string): Promise<string>
  getStorageInfo(credentialsJson: string): Promise<StorageInfo>
}
