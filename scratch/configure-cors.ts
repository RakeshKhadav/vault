import '../load-env'
import { db } from '../lib/db'
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { decrypt } from '../lib/storage/encryption'

async function run() {
  console.log('Fetching active B2 node credentials...')
  const node = await db.storageNode.findFirst({
    where: { provider: 'B2', isActive: true }
  })
  
  if (!node) {
    console.error('ERROR: No active B2 storage node found!')
    process.exit(1)
  }
  
  console.log(`Found active node: ${node.name}`)
  const creds = JSON.parse(decrypt(node.credentialsJson))
  
  const endpointUrl = creds.endpoint.startsWith('http') ? creds.endpoint : `https://${creds.endpoint}`
  
  const client = new S3Client({
    endpoint: endpointUrl,
    region: creds.region,
    credentials: {
      accessKeyId: creds.keyID,
      secretAccessKey: creds.applicationKey,
    },
  })
  
  console.log(`Applying CORS configuration to B2 bucket: ${creds.bucketName}`)
  
  try {
    const corsCommand = new PutBucketCorsCommand({
      Bucket: creds.bucketName,
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
    })
    
    await client.send(corsCommand)
    console.log('--- CORS POLICY APPLIED SUCCESSFULLY TO B2 BUCKET! ---')
  } catch (err: any) {
    console.error('Failed to apply CORS policy:', err)
    process.exit(1)
  }
}

run()
