import sharp from 'sharp'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

export class MediaProcessor {
  static async generateImageThumbnail(fileBuffer: Buffer): Promise<Buffer> {
    return sharp(fileBuffer)
      .resize({ width: 300, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
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
              .jpeg({ quality: 80 })
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
}
