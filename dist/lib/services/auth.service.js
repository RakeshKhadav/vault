"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || '';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '';
if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('[Security] Critical Configuration Error: JWT_ACCESS_SECRET or JWT_REFRESH_SECRET environment variable is missing!');
}
class AuthService {
    static async hashPassword(password) {
        return bcryptjs_1.default.hash(password, 10);
    }
    static async comparePassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    static generateAccessToken(payload) {
        return jsonwebtoken_1.default.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    }
    static generateRefreshToken(payload) {
        return jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '90d' });
    }
    static verifyAccessToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_ACCESS_SECRET);
        }
        catch {
            return null;
        }
    }
    static verifyRefreshToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
        }
        catch {
            return null;
        }
    }
    static async hashRefreshToken(token) {
        return bcryptjs_1.default.hash(token, 8);
    }
    static async createSession(userId, refreshToken, userAgent, deviceName) {
        const refreshTokenHash = await this.hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
        return db_1.db.userSession.create({
            data: {
                userId,
                refreshTokenHash,
                deviceName,
                userAgent,
                expiresAt
            }
        });
    }
    static setAuthCookies(response, accessToken, refreshToken) {
        // Access Token Cookie (15 mins)
        response.cookies.set('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60
        });
        // Refresh Token Cookie (90 days)
        response.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 90 * 24 * 60 * 60
        });
    }
    static clearAuthCookies(response) {
        response.cookies.set('accessToken', '', { path: '/', maxAge: 0 });
        response.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
    }
}
exports.AuthService = AuthService;
