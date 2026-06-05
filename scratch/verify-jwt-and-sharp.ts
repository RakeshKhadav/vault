import '../load-env'
import { AuthService } from '../lib/services/auth.service'
import { jwtVerify } from 'jose'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

async function testJWT() {
  console.log('--- TEST 1: Dynamic JWT Verification ---')
  const payload = { userId: 'test-user-id', role: 'USER' }
  const token = AuthService.generateAccessToken(payload)
  console.log('Generated Access Token:', token.substring(0, 50) + '...')

  // Dynamic verification logic as implemented in proxy.ts
  const secret = process.env.JWT_ACCESS_SECRET || 'fallback-access-secret'
  const encodedAccessKey = new TextEncoder().encode(secret)
  
  try {
    const { payload: verifiedPayload } = await jwtVerify(token, encodedAccessKey)
    console.log('Verification Success! Payload:', verifiedPayload)
    if (verifiedPayload.userId === payload.userId && verifiedPayload.role === payload.role) {
      console.log('✔ JWT verification test passed!')
    } else {
      throw new Error('Payload mismatch')
    }
  } catch (err: any) {
    console.error('JWT Verification failed:', err)
    throw err;
  }
}

async function testSharp() {
  console.log('--- TEST 2: Disk-Streaming Sharp Image Processing ---')
  
  // Create a dummy image buffer for testing
  const width = 800
  const height = 600
  const channels = 3
  const pixelCount = width * height * channels
  const dummyBuffer = Buffer.alloc(pixelCount, 128) // Gray image raw buffer
  
  // Write to a temporary PNG file first to act as our downloaded source
  const sourceImgPath = path.join(os.tmpdir(), `test-source-${crypto.randomUUID()}.png`)
  await sharp(dummyBuffer, { raw: { width, height, channels } })
    .png()
    .toFile(sourceImgPath)

  console.log('Created test source image on disk:', sourceImgPath)

  const tempImagePath = path.join(os.tmpdir(), `test-temp-${crypto.randomUUID()}.png`)
  
  try {
    // 1. Simulating streaming from a source to tempImagePath on disk
    console.log('Simulating streaming to temp file...')
    const readStream = fs.createReadStream(sourceImgPath)
    const writeStream = fs.createWriteStream(tempImagePath)
    
    await new Promise<void>((resolve, reject) => {
      readStream.pipe(writeStream)
      writeStream.on('finish', () => resolve())
      writeStream.on('error', (err) => reject(err))
      readStream.on('error', (err) => reject(err))
    })
    console.log('Stream finished. File written to temp disk location.')

    // 2. Process with sharp directly from path
    console.log('Processing with sharp directly from disk path...')
    const thumbBuffer = await sharp(tempImagePath)
      .resize({ width: 300, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
      
    console.log('Generated thumbnail buffer size:', thumbBuffer.length, 'bytes')
    
    const previewBuffer = await sharp(tempImagePath)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
      
    console.log('Generated preview buffer size:', previewBuffer.length, 'bytes')

    if (thumbBuffer.length > 0 && previewBuffer.length > 0) {
      console.log('✔ Sharp disk-streaming test passed successfully!')
    } else {
      throw new Error('Empty buffers generated')
    }
  } finally {
    // Cleanup files
    await fs.promises.unlink(sourceImgPath).catch(() => {})
    await fs.promises.unlink(tempImagePath).catch(() => {})
    console.log('Cleaned up temporary test files.')
  }
}

async function run() {
  await testJWT()
  console.log()
  await testSharp()
  console.log('\n--- ALL VERIFICATIONS PASSED ---')
}

run().catch(err => {
  console.error('Verification script failed:', err)
  process.exit(1)
})
