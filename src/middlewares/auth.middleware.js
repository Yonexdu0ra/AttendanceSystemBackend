import jwt from "jsonwebtoken";
import {   sessionService   } from "../services/session.service.js";
import {   UnauthorizedError, ForbiddenError   } from "../utils/errors.js";

// ─── Xác thực JWT ─────────────────────────────────────────────────────────────
/**
 * Middleware xác thực Bearer token.
 * Gắn `req.user` = payload JWT và `req.session` = session record.
 */
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new UnauthorizedError("Thiếu token xác thực");
        }

        const token = authHeader.slice(7);
        let payload;

        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            throw new UnauthorizedError("Token không hợp lệ hoặc đã hết hạn");
        }

        // Kiểm tra session trong DB
        const session = await sessionService.verifySession(token);
        req.user = session.user;
        req.token = token;
        next();
    } catch (err) {
        next(err);
    }
};


// ─── Xác thực JWT cho Socket.IO ─────────────────────────────────────────────────────────────
/**
 * Middleware xác thực Bearer token.
 * Gắn `req.user` = payload JWT và `req.session` = session record.
 */


export const authenticateSocket = async (socket, next) => {
    try {
        const authHeader = socket.handshake.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next(new UnauthorizedError("Thiếu token xác thực"));
        }

        const token = authHeader.slice(7);
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return next(new UnauthorizedError("Token không hợp lệ hoặc đã hết hạn"));
        }

        // Kiểm tra session trong DB
        const session = await sessionService.verifySession(token);
        socket.user = session.user;
        socket.token = token;
        next();
    } catch (err) {
        next(err);
    }
}

// ─── Kiểm tra Role ────────────────────────────────────────────────────────────
/**
 * Middleware kiểm tra role. Dùng sau `authenticate`.
 *
 * @param {...string} roles - Các role được phép (EMPLOYEE | MANAGER | ADMIN | SUPER_ADMIN)
 * @example
 * router.delete("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), handler)
 */
export const authorize = (...roles) => (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
        return next(new ForbiddenError("Bạn không có quyền thực hiện hành động này"));
    }
    next();
};

