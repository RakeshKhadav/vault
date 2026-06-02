import '../load-env'
import { db } from '../lib/db'
import { StorageManager } from '../lib/storage/manager'
import { decrypt } from '../lib/storage/encryption'

async function run() {
  console.log('1. Starting B2 Integration verification test...')
  
  // Find an active B2 storage node
  const node = await db.storageNode.findFirst({
    where: { provider: 'B2', isActive: true }
  })
  
  if (!node) {
    console.error('ERROR: No active B2 storage node found in database!')
    process.exit(1)
  }
  
  console.log(`Found active storage node: ${node.name} (ID: ${node.id})`)
  
  const credentialsStr = decrypt(node.credentialsJson)
  const provider = StorageManager.getProvider('B2')
  
  const testFileName = `test-verify-${Date.now()}.txt`
  const providerFileId = `test-folder/${testFileName}`
  
  console.log(`2. Generating presigned PUT URL for: ${providerFileId}`)
  const uploadUrl = await provider.generateUploadUrl(credentialsStr, providerFileId, 'text/plain')
  console.log(`Upload URL generated successfully: ${uploadUrl.substring(0, 120)}...`)
  
  console.log(`3. Verification before upload: Checking if file exists (expected: false)`)
  const existsBefore = await provider.verifyFileExists(credentialsStr, providerFileId)
  console.log(`Exists before: ${existsBefore}`)
  if (existsBefore) {
    throw new Error('File already exists before upload!')
  }
  
  console.log(`4. Simulating direct client-side upload to B2 PUT URL`)
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: 'B2 integration verification content',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Upload failed with status ${response.status}: ${errorText}`)
  }
  console.log(`Upload successful (Status ${response.status})`)
  
  console.log(`5. Verification after upload: Checking if file exists (expected: true)`)
  const existsAfter = await provider.verifyFileExists(credentialsStr, providerFileId)
  console.log(`Exists after: ${existsAfter}`)
  if (!existsAfter) {
    throw new Error('File does not exist after upload!')
  }
  
  console.log(`6. Testing download URL generation (307 redirect target)`)
  const downloadUrl = await provider.generateDownloadUrl(credentialsStr, providerFileId)
  console.log(`Download URL generated: ${downloadUrl.substring(0, 120)}...`)
  
  console.log(`7. Downloading file from generated URL`)
  const downloadResponse = await fetch(downloadUrl)
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download file from presigned URL. Status: ${downloadResponse.status}`)
  }
  const content = await downloadResponse.text()
  console.log(`Downloaded content: "${content}"`)
  if (content !== 'B2 integration verification content') {
    throw new Error(`Content mismatch! Expected 'B2 integration verification content', got '${content}'`)
  }
  console.log(`Download content verified!`)

  console.log(`8. Cleaning up: Deleting test file from B2`)
  const deleteResult = await provider.delete(credentialsStr, providerFileId)
  console.log(`Delete success: ${deleteResult.success}`)
  
  const existsFinal = await provider.verifyFileExists(credentialsStr, providerFileId)
  console.log(`Exists after delete: ${existsFinal}`)
  if (existsFinal) {
    throw new Error('File still exists after deletion!')
  }
  
  console.log('--- ALL B2 INTEGRATION TESTS PASSED SUCCESSFULLY! ---')
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Verification failed with error:', err)
    process.exit(1)
  })
