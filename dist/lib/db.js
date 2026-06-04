"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const databaseUrl = process.env.DATABASE_URL || '';
const pool = new pg_1.Pool({
    connectionString: databaseUrl,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const globalForPrisma = global;
exports.db = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        adapter,
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.db;
