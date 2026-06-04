import '../load-env'
import { db } from '../lib/db'
import { AuthService } from '../lib/services/auth.service'

async function cleanDatabase() {
  console.log('--- STARTING DATABASE CLEANUP ---')

  // 1. Delete all backups
  const deletedBackups = await db.backup.deleteMany({})
  console.log(`Deleted ${deletedBackups.count} backups.`)

  // 2. Break self-referential links (thumbnailFileId, previewFileId) in File table before deletion
  await db.file.updateMany({
    data: {
      thumbnailFileId: null,
      previewFileId: null,
    }
  })

  // 3. Delete all files
  const deletedFiles = await db.file.deleteMany({})
  console.log(`Deleted ${deletedFiles.count} files.`)

  // 4. Delete all upload jobs
  const deletedUploadJobs = await db.uploadJob.deleteMany({})
  console.log(`Deleted ${deletedUploadJobs.count} upload jobs.`)

  // 5. Delete all user sessions
  const deletedSessions = await db.userSession.deleteMany({})
  console.log(`Deleted ${deletedSessions.count} sessions.`)

  // 6. Reset Storage Nodes used space counter to 0, but KEEP the nodes themselves
  const updatedNodes = await db.storageNode.updateMany({
    data: {
      usedSpaceMb: 0,
      lastSyncAt: null,
    }
  })
  console.log(`Reset storage utilization for ${updatedNodes.count} storage nodes.`)

  // 7. Delete all users except ADMIN
  const adminEmail = 'rakadmin@gmail.com'
  const adminPassword = 'rakadmin05'

  const deletedUsers = await db.user.deleteMany({
    where: {
      email: { not: adminEmail }
    }
  })
  console.log(`Deleted ${deletedUsers.count} non-admin users.`)

  // 8. Ensure admin user exists and has ADMIN role
  const existingAdmin = await db.user.findUnique({
    where: { email: adminEmail }
  })

  if (existingAdmin) {
    console.log(`Admin user ${adminEmail} already exists. Enforcing ADMIN role...`)
    await db.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' }
    })
  } else {
    console.log(`Creating fresh admin user ${adminEmail}...`)
    const passwordHash = await AuthService.hashPassword(adminPassword)
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN'
      }
    })
  }
  console.log('Admin user verified.')
  console.log('--- DATABASE CLEANUP COMPLETED ---')
}

cleanDatabase()
  .catch(console.error)
  .finally(() => {
    process.exit(0)
  })
