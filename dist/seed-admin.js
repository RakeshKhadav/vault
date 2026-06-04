"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./load-env");
const db_1 = require("./lib/db");
const auth_service_1 = require("./lib/services/auth.service");
async function createAdmin() {
    console.log('--- CREATING ADMIN USER ---');
    const email = 'rakadmin@gmail.com';
    const password = 'rakadmin05';
    const existingUser = await db_1.db.user.findUnique({
        where: { email }
    });
    if (existingUser) {
        console.log(`User ${email} already exists. Updating role to ADMIN...`);
        await db_1.db.user.update({
            where: { email },
            data: { role: 'ADMIN' }
        });
        console.log('User role updated to ADMIN.');
        return;
    }
    const passwordHash = await auth_service_1.AuthService.hashPassword(password);
    const user = await db_1.db.user.create({
        data: {
            email,
            passwordHash,
            role: 'ADMIN'
        }
    });
    console.log(`Created admin user successfully: ${user.email} (ID: ${user.id})`);
}
createAdmin()
    .catch(console.error)
    .finally(() => {
    // Explicitly call process.exit to prevent pg pool handles from hanging the CLI
    process.exit(0);
});
