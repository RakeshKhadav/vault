import sharp from 'sharp'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

export class MediaProcessor {
  static async generateImageThumbnail(fileBuffer: Buffer): Promise<Buffer> {
    return sharp(fileBuffer)
      .resize({ width: 300, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  }

  static async generateImagePreview(fileBuffer: Buffer): Promise<Buffer> {
    return sharp(fileBuffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  }

  static async generateImageThumbnailFromStream(stream: import('stream').Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const resizePipeline = sharp()
        .resize({ width: 300, withoutEnlargement: true })
        .webp({ quality: 80 })

      const chunks: Buffer[] = []
      resizePipeline.on('data', (chunk) => chunks.push(chunk))
      resizePipeline.on('end', () => resolve(Buffer.concat(chunks)))
      resizePipeline.on('error', (err) => reject(err))

      stream.on('error', (err) => reject(err))
      stream.pipe(resizePipeline)
    })
  }

  static async generateImagePreviewFromStream(stream: import('stream').Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const resizePipeline = sharp()
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 80 })

      const chunks: Buffer[] = []
      resizePipeline.on('data', (chunk) => chunks.push(chunk))
      resizePipeline.on('end', () => resolve(Buffer.concat(chunks)))
      resizePipeline.on('error', (err) => reject(err))

      stream.on('error', (err) => reject(err))
      stream.pipe(resizePipeline)
    })
  }

  static async generateVideoThumbnail(fileBuffer: Buffer, fileName: string): Promise<Buffer> {
    const tempDir = os.tmpdir()
    const tempVideoPath = path.join(tempDir, `video-${Date.now()}-${fileName}`)
    const tempFramePath = path.join(tempDir, `frame-${Date.now()}-${fileName}.jpg`)

    await fs.promises.writeFile(tempVideoPath, fileBuffer)

    return new Promise((resolve, reject) => {
      // ffmpeg -ss 00:00:01 -i input.mp4 -vframes 1 -q:v 2 output.jpg -y
      const ffmpeg = spawn('ffmpeg', [
        '-ss', '00:00:01',
        '-i', tempVideoPath,
        '-vframes', '1',
        '-q:v', '2',
        tempFramePath,
        '-y'
      ])

      ffmpeg.on('close', async (code) => {
        try {
          if (code === 0 && fs.existsSync(tempFramePath)) {
            const frameBuffer = await fs.promises.readFile(tempFramePath)
            const thumbnail = await sharp(frameBuffer)
              .resize({ width: 300, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()

            // Cleanup temp files
            await Promise.all([
              fs.promises.unlink(tempVideoPath).catch(() => {}),
              fs.promises.unlink(tempFramePath).catch(() => {})
            ])

            resolve(thumbnail)
          } else {
            await fs.promises.unlink(tempVideoPath).catch(() => {})
            reject(new Error(`FFmpeg failed to extract video frame with code ${code}`))
          }
        } catch (err) {
          reject(err)
        }
      })

      ffmpeg.on('error', (err) => {
        fs.promises.unlink(tempVideoPath).catch(() => {})
        reject(err)
      })
    })
  }

  static async generateVideoThumbnailFromUrl(presignedUrl: string, fileName: string): Promise<Buffer> {
    const tempDir = os.tmpdir()
    const tempFramePath = path.join(tempDir, `frame-${Date.now()}-${fileName}.jpg`)

    return new Promise((resolve, reject) => {
      let finished = false
      const ffmpeg = spawn('ffmpeg', [
        '-ss', '00:00:01',
        '-i', presignedUrl,
        '-vframes', '1',
        '-q:v', '2',
        tempFramePath,
        '-y'
      ])

      const timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true
          ffmpeg.kill('SIGKILL')
          fs.promises.unlink(tempFramePath).catch(() => {})
          reject(new Error('FFmpeg thumbnail extraction timed out after 20 seconds'))
        }
      }, 20000)

      ffmpeg.on('close', async (code) => {
        clearTimeout(timeoutId)
        if (finished) return
        finished = true
        try {
          if (code === 0 && fs.existsSync(tempFramePath)) {
            const frameBuffer = await fs.promises.readFile(tempFramePath)
            const thumbnail = await sharp(frameBuffer)
              .resize({ width: 300, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()

            await fs.promises.unlink(tempFramePath).catch(() => {})
            resolve(thumbnail)
          } else {
            reject(new Error(`FFmpeg failed to extract video frame with code ${code}`))
          }
        } catch (err) {
          reject(err)
        }
      })

      ffmpeg.on('error', (err) => {
        clearTimeout(timeoutId)
        if (finished) return
        finished = true
        reject(err)
      })
    })
  }
}
