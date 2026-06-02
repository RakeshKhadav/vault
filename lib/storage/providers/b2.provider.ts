import { Readable } from 'stream'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import { StorageProvider, StorageInfo, UploadResult } from './storage-provider.interface'
import { db } from '../../db'
import { decrypt } from '../encryption'

export class B2Provider implements StorageProvider {
  private static clientCache = new Map<string, { client: S3Client; bucketName: string; bucketLimitGb: number }>()
  private static urlCache = new Map<string, { url: string; expiresAt: number }>()

  private getS3Client(credentialsJson: string): { client: S3Client; bucketName: string; bucketLimitGb: number } {
    const cached = B2Provider.clientCache.get(credentialsJson)
    if (cached) {
      return cached
    }

    try {
      const creds = JSON.parse(credentialsJson)
      if (!creds.endpoint || !creds.region || !creds.keyID || !creds.applicationKey || !creds.bucketName) {
        throw new Error('Missing required Backblaze B2 credentials')
      }

      const endpointUrl = creds.endpoint.startsWith('http') ? creds.endpoint : `https://${creds.endpoint}`

      const client = new S3Client({
        endpoint: endpointUrl,
        region: creds.region,
        credentials: {
          accessKeyId: creds.keyID,
          secretAccessKey: creds.applicationKey,
        },
      })

      const result = {
        client,
        bucketName: creds.bucketName,
        bucketLimitGb: creds.bucketLimitGb ? Number(creds.bucketLimitGb) : 10000, // 10TB fallback
      }

      B2Provider.clientCache.set(credentialsJson, result)
      return result
    } catch (err: any) {
      throw new Error(`Failed to parse Backblaze B2 credentials: ${err.message}`)
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'png': return 'image/png'
      case 'jpg':
      case 'jpeg': return 'image/jpeg'
      case 'gif': return 'image/gif'
      case 'webp': return 'image/webp'
      case 'mp4': return 'video/mp4'
      case 'webm': return 'video/webm'
      case 'mov': return 'video/quicktime'
      default: return 'application/octet-stream'
    }
  }

  async testConnection(credentialsJson: string): Promise<{ success: boolean }> {
    try {
      const { client, bucketName } = this.getS3Client(credentialsJson)
      
      const testKey = `test-connection-${Date.now()}.txt`
      
      // Perform write test
      await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: 'connection-test',
        ContentType: 'text/plain',
      }))
      
      // Perform delete test
      await client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      }))

      // Proactively configure/verify CORS to allow direct client-side browser uploads
      try {
        await client.send(new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600
              }
            ]
          }
        }))
      } catch (corsErr) {
        console.warn('[B2 Connection Test]: Successfully completed write/delete tests, but failed to write CORS config. B2 credentials key might lack CORS permissions.', corsErr)
      }
      
      return { success: true }
    } catch (err) {
      console.error('[B2 Connection Test Error]:', err)
      return { success: false }
    }
  }

  async upload(
    credentialsJson: string,
    fileBuffer: Buffer,
    fileName: string,
    thumbnailBuffer?: Buffer,
    thumbnailName?: string
  ): Promise<{ file: UploadResult; thumbnail?: UploadResult }> {
    const { client, bucketName } = this.getS3Client(credentialsJson)

    // Generate unique object key using random UUID to prevent collisions
    const fileKey = `${crypto.randomUUID()}-${fileName}`
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: this.getMimeType(fileName),
    }))

    const fileResult: UploadResult = {
      providerFileId: fileKey,
      size: fileBuffer.length,
    }

    let thumbnailResult: UploadResult | undefined
    if (thumbnailBuffer && thumbnailName) {
      const thumbKey = `thumb-${crypto.randomUUID()}-${thumbnailName}`
      await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: thumbKey,
        Body: thumbnailBuffer,
        ContentType: 'image/webp',
      }))
      thumbnailResult = {
        providerFileId: thumbKey,
        size: thumbnailBuffer.length,
      }
    }

    return {
      file: fileResult,
      thumbnail: thumbnailResult,
    }
  }

  async download(credentialsJson: string, providerFileId: string): Promise<Readable> {
    const { client, bucketName } = this.getS3Client(credentialsJson)

    const response = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: providerFileId,
    }))

    if (!response.Body) {
      throw new Error('Empty response body from B2 storage')
    }

    return response.Body as Readable
  }

  async delete(credentialsJson: string, providerFileId: string): Promise<{ success: boolean }> {
    try {
      const { client, bucketName } = this.getS3Client(credentialsJson)

      await client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: providerFileId,
      }))

      return { success: true }
    } catch (err) {
      console.error('[B2 Delete Error]:', err)
      return { success: false }
    }
  }

  private applyCloudflareProxy(urlStr: string, credentialsJson: string): string {
    let proxyUrl = process.env.CLOUDFLARE_PROXY_URL || process.env.NEXT_PUBLIC_CLOUDFLARE_PROXY_URL

    if (!proxyUrl) {
      try {
        const creds = JSON.parse(credentialsJson)
        if (creds.cloudflareProxyUrl) {
          proxyUrl = creds.cloudflareProxyUrl
        }
      } catch {
        // ignore
      }
    }

    if (!proxyUrl) {
      return urlStr
    }

    try {
      const url = new URL(urlStr)
      let normalizedProxy = proxyUrl.trim()
      if (!normalizedProxy.startsWith('http://') && !normalizedProxy.startsWith('https://')) {
        normalizedProxy = `https://${normalizedProxy}`
      }
      const proxyParsed = new URL(normalizedProxy)

      url.protocol = proxyParsed.protocol
      url.hostname = proxyParsed.hostname
      if (proxyParsed.port) {
        url.port = proxyParsed.port
      } else {
        url.port = ''
      }
      return url.toString()
    } catch (err) {
      console.error('Error applying Cloudflare proxy to URL:', err)
      return urlStr
    }
  }

  async generateViewUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    const cacheKey = `${providerFileId}`
    const cached = B2Provider.urlCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() + 15 * 60 * 1000) {
      return cached.url
    }

    const { client, bucketName } = this.getS3Client(credentialsJson)

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: providerFileId,
    })

    // URL valid for 1 hour (3600 seconds)
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
    const finalUrl = this.applyCloudflareProxy(signedUrl, credentialsJson)

    B2Provider.urlCache.set(cacheKey, { url: finalUrl, expiresAt: Date.now() + 3600 * 1000 })
    return finalUrl
  }

  async generateStreamUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    // S3 presigned URLs support Range headers natively
    return this.generateViewUrl(credentialsJson, providerFileId)
  }

  async generateDownloadUrl(credentialsJson: string, providerFileId: string): Promise<string> {
    const { client, bucketName } = this.getS3Client(credentialsJson)

    // Extract original filename to present it nicely to the client
    let downloadFileName = providerFileId
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i
    if (uuidPattern.test(providerFileId)) {
      downloadFileName = providerFileId.substring(37) // uuid is 36 chars + 1 hyphen
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: providerFileId,
      ResponseContentDisposition: `attachment; filename="${downloadFileName}"`,
    })

    // URL valid for 15 minutes (900 seconds)
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 })
    return this.applyCloudflareProxy(signedUrl, credentialsJson)
  }

  async getStorageInfo(credentialsJson: string): Promise<StorageInfo> {
    const { bucketLimitGb, bucketName } = this.getS3Client(credentialsJson)
    const totalSpaceMb = bucketLimitGb * 1024

    // Query database to sum file sizes associated with this B2 node
    // to avoid overwriting database-tracked storage metrics with 0.
    let usedSpaceBytes = 0
    try {
      const activeNodes = await db.storageNode.findMany({
        where: { provider: 'B2', isActive: true },
      })
      
      const node = activeNodes.find((n) => {
        try {
          const decrypted = decrypt(n.credentialsJson)
          const parsed = JSON.parse(decrypted)
          return parsed.bucketName === bucketName
        } catch {
          return false
        }
      })

      if (node) {
        const files = await db.file.findMany({
          where: { storageNodeId: node.id },
          select: { fileSize: true },
        })
        usedSpaceBytes = files.reduce((sum, file) => sum + Number(file.fileSize), 0)
      }
    } catch (err) {
      console.warn('Could not query database for B2 used storage size:', err)
    }

    return {
      totalSpaceMb,
      usedSpaceMb: Math.floor(usedSpaceBytes / (1024 * 1024)),
    }
  }

  async generateUploadUrl(credentialsJson: string, providerFileId: string, mimeType: string): Promise<string> {
    const { client, bucketName } = this.getS3Client(credentialsJson)

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: providerFileId,
      ContentType: mimeType,
    })

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 1800 })
    return this.applyCloudflareProxy(signedUrl, credentialsJson)
  }

  async verifyFileExists(credentialsJson: string, providerFileId: string): Promise<boolean> {
    try {
      const { client, bucketName } = this.getS3Client(credentialsJson)
      await client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: providerFileId,
      }))
      return true
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw err
    }
  }

  async uploadBuffer(credentialsJson: string, buffer: Buffer, fileKey: string, mimeType: string): Promise<void> {
    const { client, bucketName } = this.getS3Client(credentialsJson)
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }))
  }
}
