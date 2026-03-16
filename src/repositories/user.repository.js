import prisma from "../configs/prismaClient.js";
import {   buildCursorClause   } from "../utils/cursor-pagination.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Trả về câu lệnh where để lọc bỏ bản ghi đã bị soft-delete
 */
const notDeleted = { deletedAt: null };

// ─── Select mặc định (bỏ password ra ngoài) ───────────────────────────────────
const defaultSelect = {
    id: true,
    email: true,
    phone: true,
    code: true,
    biometricEnabled: true,
    role: true,
    deletedAt: true,
    createdAt: true,
    updatedAt: true,
    profile: true,
};

// ─── Tìm theo ID ──────────────────────────────────────────────────────────────
const findById = (id) =>
    prisma.user.findUnique({
        where: { id, ...notDeleted },
        select: defaultSelect,
    });

// ─── Tìm theo ID (có password, dùng cho auth) ────────────────────────────────
const findByIdWithPassword = (id) =>
    prisma.user.findUnique({
        where: { id, ...notDeleted },
    }); // trả về full record (có password) dùng cho change-password

// ─── Tìm theo Email ───────────────────────────────────────────────────────────
const findByEmail = (email) =>
    prisma.user.findUnique({
        where: { email, ...notDeleted },
    }); // trả về full record (có password) dùng cho auth

// ─── Tìm theo Phone ───────────────────────────────────────────────────────────
const findByPhone = (phone) =>
    prisma.user.findUnique({
        where: { phone, ...notDeleted },
    });

// ─── Tìm theo Code (mã nhân viên) ────────────────────────────────────────────
const findByCode = (code) =>
    prisma.user.findUnique({
        where: { code, ...notDeleted },
        select: defaultSelect,
    });

// ─── Lấy danh sách (offset pagination) ───────────────────────────────────────
const findMany = ({ skip = 0, take = 20, where = {}, orderBy = { createdAt: "desc" } } = {}) =>
    prisma.user.findMany({
        where: { ...notDeleted, ...where },
        select: defaultSelect,
        skip,
        take,
        orderBy,
    });

// ─── Cursor-based pagination (dùng cho mobile) ───────────────────────────────
const findManyCursor = ({ cursor, take = 20, where = {}, orderBy = { createdAt: "desc" } } = {}) =>
    prisma.user.findMany({
        where: { ...notDeleted, ...where },
        select: defaultSelect,
        take: take + 1,
        ...buildCursorClause(cursor),
        orderBy,
    });

// ─── Tổng số bản ghi ──────────────────────────────────────────────────────────
const count = (where = {}) =>
    prisma.user.count({ where: { ...notDeleted, ...where } });

// ─── Tạo mới ─────────────────────────────────────────────────────────────────
const create = (data) =>
    prisma.user.create({
        data,
        select: defaultSelect,
    });

// ─── Cập nhật ─────────────────────────────────────────────────────────────────
const update = (id, data) =>
    prisma.user.update({
        where: { id },
        data,
        select: defaultSelect,
    });

// ─── Soft delete ──────────────────────────────────────────────────────────────
const softDelete = (id) =>
    prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true },
    });

// ─── Hard delete (chỉ dùng nội bộ / test) ────────────────────────────────────
const hardDelete = (id) =>
    prisma.user.delete({ where: { id } });

export const userRepository = {
    findById,
    findByIdWithPassword,
    findByEmail,
    findByPhone,
    findByCode,
    findMany,
    findManyCursor,
    count,
    create,
    update,
    softDelete,
    hardDelete,
};

