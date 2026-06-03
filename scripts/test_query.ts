import fs from 'fs'
import path from 'path'

// Load .env manually
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const firstEquals = trimmed.indexOf('=')
        if (firstEquals !== -1) {
          const key = trimmed.substring(0, firstEquals).trim()
          let val = trimmed.substring(firstEquals + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1)
          }
          process.env[key] = val
        }
      }
    }
  }
} catch (e) {
  console.error('Failed to load .env file:', e)
}

async function main() {
  const { db } = await import('../lib/db')
  
  // Test query with thumbnailOf: null, previewOf: null
  const files = await db.file.findMany({
    where: {
      thumbnailOf: null,
      previewOf: null,
    },
    select: {
      id: true,
      fileName: true,
      thumbnailOf: { select: { id: true } },
      previewOf: { select: { id: true } },
    }
  })

  console.log('--- FILTERED FILES IN DB ---')
  console.dir(files, { depth: null })
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
