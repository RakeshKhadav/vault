import '../load-env'
import { db } from '../lib/db'

async function verify() {
  console.log('--- VERIFYING DATABASE STATE ---')
  const users = await db.user.findMany()
  console.log('Users in DB:')
  console.dir(users)

  const storageNodes = await db.storageNode.findMany()
  console.log('Storage Nodes in DB:')
  console.dir(storageNodes)

  const filesCount = await db.file.count()
  console.log(`Files count in DB: ${filesCount}`)

  const backupsCount = await db.backup.count()
  console.log(`Backups count in DB: ${backupsCount}`)

  const sessionsCount = await db.userSession.count()
  console.log(`Sessions count in DB: ${sessionsCount}`)

  const uploadJobsCount = await db.uploadJob.count()
  console.log(`Upload jobs count in DB: ${uploadJobsCount}`)
}

verify()
  .catch(console.error)
  .finally(() => {
    process.exit(0)
  })
