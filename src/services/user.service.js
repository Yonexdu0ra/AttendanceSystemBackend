import bcrypt from "bcrypt";
import {   userRepository   } from "../repositories/index.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {   NotFoundError, ConflictError   } from "../utils/errors.js";

// ─── Lấy danh sách user (offset pagination) ────────────────────────────────
/**
 * @param {object} options
 * @param {number}  [options.page=1]
 * @param {number}  [options.limit=20]
 * @param {string}  [options.role]    - Lọc theo role
 * @param {string}  [options.search]  - Tìm theo email / phone / code
 * @returns {Promise<object>}
 */
const getUsers = async ({ page = 1, limit = 20, role, search } = {}) => {
    const where = buildWhereClause({ role, search });
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        userRepository.findMany({ skip, take, where }),
        userRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy danh sách user (cursor pagination) ────────────────────────────────
/**
 * @param {object} options
 * @param {string}  [options.cursor]
 * @param {number}  [options.limit=20]
 * @param {string}  [options.role]
 * @param {string}  [options.search]
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: string | null }>}
 */
const getUsersCursor = async ({ cursor, limit = 20, role, search } = {}) => {
    const where = buildWhereClause({ role, search });

    const raw = await userRepository.findManyCursor({
        cursor,
        take: limit,
        where,
    });

    return parseCursorResult(raw, limit);
};

// ─── Lấy user theo ID ──────────────────────────────────────────────────────
/**
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const getUserById = async (id) => {
    const user = await userRepository.findById(id);
    if (!user) {
        throw new NotFoundError("Không tìm thấy người dùng");
    }
    return user;
};

// ─── Tạo user mới ──────────────────────────────────────────────────────────
/**
 * @param {object} dto - CreateUserDto
 * @returns {Promise<object>}
 * @throws {ConflictError}
 */
const createUser = async (dto) => {
    // Kiểm tra trùng lặp
    const [existingEmail, existingPhone, existingCode] = await Promise.all([
        userRepository.findByEmail(dto.email),
        userRepository.findByPhone(dto.phone),
        userRepository.findByCode(dto.code),
    ]);

    if (existingEmail) throw new ConflictError("Email đã được sử dụng");
    if (existingPhone) throw new ConflictError("Số điện thoại đã được sử dụng");
    if (existingCode) throw new ConflictError("Mã nhân viên đã được sử dụng");

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return userRepository.create({
        ...dto,
        password: hashedPassword,
    });
};

// ─── Cập nhật user ──────────────────────────────────────────────────────────
/**
 * @param {string} id
 * @param {object} dto - UpdateUserDto
 * @returns {Promise<object>}
 * @throws {NotFoundError|ConflictError}
 */
const updateUser = async (id, dto) => {
    const existing = await userRepository.findById(id);
    if (!existing) {
        throw new NotFoundError("Không tìm thấy người dùng");
    }

    // Kiểm tra trùng phone (nếu có thay đổi)
    if (dto.phone) {
        const samePhone = await userRepository.findByPhone(dto.phone);
        if (samePhone && samePhone.id !== id) {
            throw new ConflictError("Số điện thoại đã được sử dụng");
        }
    }

    // Kiểm tra trùng code (nếu có thay đổi)
    if (dto.code) {
        const sameCode = await userRepository.findByCode(dto.code);
        if (sameCode && sameCode.id !== id) {
            throw new ConflictError("Mã nhân viên đã được sử dụng");
        }
    }

    return userRepository.update(id, dto);
};

// ─── Soft delete user ───────────────────────────────────────────────────────
/**
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const deleteUser = async (id) => {
    const existing = await userRepository.findById(id);
    if (!existing) {
        throw new NotFoundError("Không tìm thấy người dùng");
    }

    return userRepository.softDelete(id);
};

// ─── Helper: Build where clause ──────────────────────────────────────────────
const buildWhereClause = ({ role, search } = {}) => {
    const where = {};

    if (role) where.role = role;

    if (search) {
        where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { code: { contains: search, mode: "insensitive" } },
        ];
    }

    return where;
};

// ─── Export ──────────────────────────────────────────────────────────────────
export const userService = {
    getUsers,
    getUsersCursor,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
};
