import {   AppError   } from "../utils/errors.js";

// ─── Global Error Handler Middleware ─────────────────────────────────────────
/**
 * Middleware xử lý lỗi toàn cục cho Express.
 * Đặt ở cuối cùng trong chuỗi middleware, sau tất cả routes.
 *
 * Hành vi:
 * - Nếu là AppError → trả về status + message từ error
 * - Nếu là lỗi Prisma (P2002) → 409 Conflict
 * - Nếu là lỗi Prisma (P2025) → 404 Not Found
 * - Nếu là lỗi Zod → 400 Bad Request kèm chi tiết lỗi validation
 * - Còn lại → 500 Internal Server Error
 *
 * @param {Error} err
 * @param {import("express").Request}  req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const errorHandler = (err, req, res, next) => {
    // ── AppError (lỗi do ứng dụng tự throw) ──────────────────────────────────
    if (err.isAppError) {
        return res.status(err.status).json({
            success: false,
            message: err.message,
            ...(err.details && { details: err.details }),
        });
    }

    // ── Lỗi Prisma ───────────────────────────────────────────────────────────
    if (err.code) {
        // Unique constraint violation
        if (err.code === "P2002") {
            const fields = err.meta?.target ?? [];
            return res.status(409).json({
                success: false,
                message: "Dữ liệu đã tồn tại",
                details: { fields },
            });
        }

        // Record not found (updateOne / deleteOne trên bản ghi không tồn tại)
        if (err.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: err.meta?.cause ?? "Không tìm thấy tài nguyên",
            });
        }

        // Foreign key constraint violation
        if (err.code === "P2003") {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu liên kết không tồn tại",
            });
        }
    }

    // ── Lỗi Zod (validation) ──────────────────────────────────────────────────
    if (err.name === "ZodError") {
        const details = err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
        }));
        return res.status(400).json({
            success: false,
            message: "Dữ liệu đầu vào không hợp lệ",
            details,
        });
    }

    // ── Lỗi không xác định ───────────────────────────────────────────────────
    console.error("[ERROR]", err);

    return res.status(500).json({
        success: false,
        message: "Đã xảy ra lỗi, vui lòng thử lại sau",
    });
};

// ─── 404 Not Found Handler ────────────────────────────────────────────────────
/**
 * Middleware bắt tất cả các route không tồn tại.
 * Đặt phía trên errorHandler, sau khi khai báo tất cả routes.
 *
 * @param {import("express").Request}  req
 * @param {import("express").Response} res
 */
export const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Không tìm thấy route: ${req.method} ${req.originalUrl}`,
    });
};

