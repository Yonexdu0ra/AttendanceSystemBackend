import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {   userRepository   } from "../repositories/index.js";
import {   sessionService   } from "./session.service.js";
import {   auditLogService, AuditAction, AuditResource, AuditStatus   } from "./audit-log.service.js";
import {   UnauthorizedError   } from "../utils/errors.js";

// ─── Helper: Parse JWT expiresIn thành milliseconds ─────────────────────────
const parseExpiresIn = (expiresIn = "7d") => {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 ngày
    const value = parseInt(match[1], 10);
    const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
    return value * unit;
};

// ─── Đăng nhập ──────────────────────────────────────────────────────────────
/**
 * Xác thực email + password, tạo JWT và session mới.
 *
 * @param {object} params
 * @param {string}  params.email
 * @param {string}  params.password
 * @param {string}  params.ipAddress
 * @param {string}  [params.userAgent]
 * @param {object}  [params.device]
 * @returns {Promise<{ user: object, token: string, expiresAt: Date }>}
 */
const login = async ({ email, password, ipAddress, userAgent, device }) => {
    const user = await userRepository.findByEmail(email);

    if (!user) {
        auditLogService.logAsync({
            userId: null,
            action: AuditAction.LOGIN_FAIL,
            resource: AuditResource.SESSION,
            ipAddress,
            userAgent,
            status: AuditStatus.FAIL,
        });
        throw new UnauthorizedError("Email hoặc mật khẩu không chính xác");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        auditLogService.logAsync({
            userId: user.id,
            action: AuditAction.LOGIN_FAIL,
            resource: AuditResource.SESSION,
            ipAddress,
            userAgent,
            status: AuditStatus.FAIL,
        });
        throw new UnauthorizedError("Email hoặc mật khẩu không chính xác");
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn },
    );

    const expiresAt = new Date(Date.now() + parseExpiresIn(expiresIn));

    const { session } = await sessionService.createSession({
        userId: user.id,
        token,
        expiresAt,
        ipAddress,
        device,
    });

    auditLogService.logAsync({
        userId: user.id,
        action: AuditAction.LOGIN_SUCCESS,
        resource: AuditResource.SESSION,
        resourceId: session.id,
        ipAddress,
        userAgent,
    });

    // Loại bỏ password khỏi response
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token, expiresAt };
};

// ─── Đăng xuất session hiện tại ─────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}  params.token
 * @param {string}  params.userId
 * @param {string}  [params.deviceId]
 * @param {string}  [params.ipAddress]
 * @param {string}  [params.userAgent]
 */
const logout = async ({ token, userId, deviceId, ipAddress, userAgent }) => {
    await sessionService.logout({ token, userId, deviceId });

    auditLogService.logAsync({
        userId,
        action: AuditAction.LOGOUT,
        resource: AuditResource.SESSION,
        ipAddress,
        userAgent,
    });
};

// ─── Đăng xuất tất cả session ───────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}  params.userId
 * @param {string}  [params.ipAddress]
 * @param {string}  [params.userAgent]
 * @returns {Promise<{ deletedSessions: number }>}
 */
const logoutAll = async ({ userId, ipAddress, userAgent }) => {
    const result = await sessionService.logoutAll(userId);

    auditLogService.logAsync({
        userId,
        action: AuditAction.LOGOUT_ALL,
        resource: AuditResource.SESSION,
        ipAddress,
        userAgent,
    });

    return result;
};

// ─── Đổi mật khẩu ───────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}  params.userId
 * @param {string}  params.currentPassword
 * @param {string}  params.newPassword
 * @param {string}  [params.ipAddress]
 * @param {string}  [params.userAgent]
 * @returns {Promise<{ message: string }>}
 */
const changePassword = async ({ userId, currentPassword, newPassword, ipAddress, userAgent }) => {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
        throw new UnauthorizedError("Người dùng không tồn tại");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        throw new UnauthorizedError("Mật khẩu hiện tại không chính xác");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userId, { password: hashedPassword });

    auditLogService.logAsync({
        userId,
        action: AuditAction.CHANGE_PASSWORD,
        resource: AuditResource.USER,
        resourceId: userId,
        ipAddress,
        userAgent,
    });

    return { message: "Đổi mật khẩu thành công" };
};

// ─── Làm mới token ──────────────────────────────────────────────────────────
/**
 * Xóa session cũ và tạo JWT + session mới.
 *
 * @param {object} params
 * @param {string}  params.token    - Token hiện tại
 * @param {string}  params.userId
 * @param {string}  params.ipAddress
 * @param {object}  [params.device]
 * @returns {Promise<{ token: string, expiresAt: Date }>}
 */
const refreshSession = async ({ token, userId, ipAddress, device }) => {
    // Xóa session cũ
    await sessionService.logout({ token, userId });

    // Tạo JWT mới
    const user = await userRepository.findById(userId);
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const newToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn },
    );

    const expiresAt = new Date(Date.now() + parseExpiresIn(expiresIn));

    await sessionService.createSession({
        userId,
        token: newToken,
        expiresAt,
        ipAddress,
        device,
    });

    return { token: newToken, expiresAt };
};

// ─── Export ──────────────────────────────────────────────────────────────────
export const authService = {
    login,
    logout,
    logoutAll,
    changePassword,
    refreshSession,
};
