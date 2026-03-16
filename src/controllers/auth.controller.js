import {   authService   } from "../services/index.js";

// ─── POST /auth/login ────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
    try {
        const { email, password, device } = req.body;
        const result = await authService.login({
            email,
            password,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            device,
        });
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

// ─── POST /auth/logout ──────────────────────────────────────────────────────
export const logout = async (req, res, next) => {
    try {
        const { deviceId } = req.body;
        await authService.logout({
            token: req.token,
            userId: req.user.id,
            deviceId,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
        res.json({ success: true, message: "Đăng xuất thành công" });
    } catch (err) { next(err); }
};

// ─── POST /auth/logout-all ──────────────────────────────────────────────────
export const logoutAll = async (req, res, next) => {
    try {
        const result = await authService.logoutAll({
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
};

// ─── POST /auth/change-password ─────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await authService.changePassword({
            userId: req.user.id,
            currentPassword,
            newPassword,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
};

// ─── POST /auth/refresh ─────────────────────────────────────────────────────
export const refreshSession = async (req, res, next) => {
    try {
        const { device } = req.body;
        const result = await authService.refreshSession({
            token: req.token,
            userId: req.user.id,
            ipAddress: req.ip,
            device,
        });
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};
