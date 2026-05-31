import { db } from './lib/db'
import { AuthService } from './lib/services/auth.service'

async function createAdmin() {
  console.log('--- CREATING ADMIN USER ---')
  
  const email = 'rakadmin@gmail.com'
  const password = 'rakadmin05'

  const existingUser = await db.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    console.log(`User ${email} already exists. Updating role to ADMIN...`)
    await db.user.update({
      where: { email },
      data: { role: 'ADMIN' }
    })
    console.log('User role updated to ADMIN.')
    return
  }

  const passwordHash = await AuthService.hashPassword(password)
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN'
    }
  })

  console.log(`Created admin user successfully: ${user.email} (ID: ${user.id})`)
}

createAdmin().catch(console.error)
