import {   auditLogRepository   } from "../repositories/index.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";

// ─── Hằng số hành động ────────────────────────────────────────────────────────
/**
 * Danh sách các hành động chuẩn trong hệ thống.
 * Dùng để đảm bảo tên action nhất quán khi ghi log.
 */
export const AuditAction = Object.freeze({
    // Auth
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    LOGIN_FAIL: "LOGIN_FAIL",
    LOGOUT: "LOGOUT",
    LOGOUT_ALL: "LOGOUT_ALL",

    // User
    CREATE_USER: "CREATE_USER",
    UPDATE_USER: "UPDATE_USER",
    DELETE_USER: "DELETE_USER",
    CHANGE_PASSWORD: "CHANGE_PASSWORD",
    CHANGE_ROLE: "CHANGE_ROLE",

    // Profile
    UPDATE_PROFILE: "UPDATE_PROFILE",

    // Job
    CREATE_JOB: "CREATE_JOB",
    UPDATE_JOB: "UPDATE_JOB",
    DELETE_JOB: "DELETE_JOB",
    JOIN_JOB: "JOIN_JOB",
    LEAVE_JOB: "LEAVE_JOB",

    // Attendance
    CHECK_IN: "CHECK_IN",
    CHECK_OUT: "CHECK_OUT",
    UPDATE_ATTENDANCE: "UPDATE_ATTENDANCE",

    // Leave Request
    CREATE_LEAVE: "CREATE_LEAVE",
    APPROVE_LEAVE: "APPROVE_LEAVE",
    REJECT_LEAVE: "REJECT_LEAVE",
    CANCEL_LEAVE: "CANCEL_LEAVE",

    // Overtime
    CREATE_OVERTIME: "CREATE_OVERTIME",
    APPROVE_OVERTIME: "APPROVE_OVERTIME",
    REJECT_OVERTIME: "REJECT_OVERTIME",
    CANCEL_OVERTIME: "CANCEL_OVERTIME",

    // Holiday
    CREATE_HOLIDAY: "CREATE_HOLIDAY",
    UPDATE_HOLIDAY: "UPDATE_HOLIDAY",
    DELETE_HOLIDAY: "DELETE_HOLIDAY",
});

// ─── Hằng số resource ─────────────────────────────────────────────────────────
export const AuditResource = Object.freeze({
    USER: "User",
    PROFILE: "Profile",
    SESSION: "Session",
    JOB: "Job",
    ATTENDANCE: "Attendance",
    LEAVE_REQUEST: "LeaveRequest",
    OVERTIME_REQUEST: "OvertimeRequest",
    HOLIDAY: "Holiday",
    NOTIFICATION: "Notification",
});

// ─── Hằng số trạng thái ───────────────────────────────────────────────────────
export const AuditStatus = Object.freeze({
    SUCCESS: "SUCCESS",
    FAIL: "FAIL",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Ghi log ──────────────────────────────────────────────────────────────────
/**
 * Ghi một bản ghi audit log.
 * Hàm chính — các helper bên dưới đều gọi vào đây.
 *
 * @param {object} params
 * @param {string|null}  params.userId     - ID người thực hiện (null nếu là system)
 * @param {string}       params.action     - Hành động (dùng AuditAction enum)
 * @param {string}       params.resource   - Đối tượng bị tác động (dùng AuditResource enum)
 * @param {string|null}  [params.resourceId] - ID bản ghi bị tác động
 * @param {object|null}  [params.oldValue]   - Dữ liệu trước khi thay đổi
 * @param {object|null}  [params.newValue]   - Dữ liệu sau khi thay đổi
 * @param {string|null}  [params.ipAddress]  - IP người thao tác
 * @param {string|null}  [params.userAgent]  - Trình duyệt / app
 * @param {string}       [params.status]     - "SUCCESS" | "FAIL"
 * @returns {Promise<object>} AuditLog vừa được tạo
 */
const log = ({
    userId = null,
    action,
    resource,
    resourceId = null,
    oldValue = null,
    newValue = null,
    ipAddress = null,
    userAgent = null,
    status = AuditStatus.SUCCESS,
}) => auditLogRepository.create({
    userId,
    action,
    resource,
    resourceId,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
    status,
});

// ─── Ghi log thành công ───────────────────────────────────────────────────────
/**
 * Shorthand ghi audit log với status = SUCCESS.
 *
 * @param {object} params - Các tham số (không cần truyền status)
 * @returns {Promise<object>}
 *
 * @example
 * await auditLogService.logSuccess({
 *   userId: req.user.id,
 *   action: AuditAction.CHECK_IN,
 *   resource: AuditResource.ATTENDANCE,
 *   resourceId: attendance.id,
 *   newValue: attendance,
 *   ipAddress: req.ip,
 * });
 */
const logSuccess = (params) => log({ ...params, status: AuditStatus.SUCCESS });

// ─── Ghi log thất bại ────────────────────────────────────────────────────────
/**
 * Shorthand ghi audit log với status = FAIL.
 *
 * @param {object} params - Các tham số (không cần truyền status)
 * @returns {Promise<object>}
 *
 * @example
 * await auditLogService.logFail({
 *   userId: null,
 *   action: AuditAction.LOGIN_FAIL,
 *   resource: AuditResource.USER,
 *   ipAddress: req.ip,
 *   userAgent: req.headers["user-agent"],
 * });
 */
const logFail = (params) => log({ ...params, status: AuditStatus.FAIL });

// ─── Ghi log không đồng bộ (fire-and-forget) ──────────────────────────────────
/**
 * Ghi audit log mà không chờ kết quả — không block luồng chính.
 * Dùng khi việc ghi log không ảnh hưởng đến response.
 *
 * @param {object} params - Tham số giống với `log()`
 * @returns {void}
 */
const logAsync = (params) => {
    log(params).catch((err) =>
        console.error("[AuditLog] Ghi log thất bại:", err.message)
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy danh sách log (offset pagination) ────────────────────────────────────
/**
 * Lấy danh sách audit log với offset pagination (dùng cho web / admin).
 *
 * @param {object}  [params]
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @param {string}  [params.userId]     - Lọc theo người thực hiện
 * @param {string}  [params.action]     - Lọc theo hành động
 * @param {string}  [params.resource]   - Lọc theo loại đối tượng
 * @param {string}  [params.resourceId] - Lọc theo ID đối tượng
 * @param {string}  [params.status]     - Lọc theo trạng thái (SUCCESS / FAIL)
 * @param {string}  [params.startDate]  - Lọc từ ngày
 * @param {string}  [params.endDate]    - Lọc đến ngày
 * @returns {Promise<object>} Danh sách log kèm metadata phân trang
 */
const getLogs = async ({
    page = 1,
    limit = 50,
    userId,
    action,
    resource,
    resourceId,
    status,
    startDate,
    endDate,
} = {}) => {
    const where = buildWhereClause({ userId, action, resource, resourceId, status, startDate, endDate });
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        auditLogRepository.findMany({ skip, take, where }),
        auditLogRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy log của user (offset pagination) ────────────────────────────────────
/**
 * Lấy lịch sử thao tác của một người dùng (offset pagination).
 *
 * @param {object} params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<object>}
 */
const getLogsByUserId = async ({ userId, page = 1, limit = 50 }) => {
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        auditLogRepository.findByUserId({ userId, skip, take }),
        auditLogRepository.count({ userId }),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy log của user (cursor pagination) ────────────────────────────────────
/**
 * Lấy lịch sử thao tác của một người dùng với cursor pagination (mobile).
 *
 * @param {object} params
 * @param {string}  params.userId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=50]
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: string | null }>}
 */
const getLogsByUserIdCursor = async ({ userId, cursor, limit = 50 }) => {
    const raw = await auditLogRepository.findByUserIdCursor({ userId, cursor, take: limit });
    return parseCursorResult(raw, limit);
};

// ─── Lấy log toàn hệ thống (cursor pagination, admin) ────────────────────────
/**
 * Lấy toàn bộ audit log với cursor pagination (dùng cho admin / mobile).
 *
 * @param {object}  [params]
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=50]
 * @param {string}  [params.userId]
 * @param {string}  [params.action]
 * @param {string}  [params.resource]
 * @param {string}  [params.status]
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: string | null }>}
 */
const getLogsCursor = async ({ cursor, limit = 50, userId, action, resource, status } = {}) => {
    const where = buildWhereClause({ userId, action, resource, status });
    const raw = await auditLogRepository.findManyCursor({ cursor, take: limit, where });
    return parseCursorResult(raw, limit);
};

// ─── Lấy log theo resource ────────────────────────────────────────────────────
/**
 * Lấy lịch sử thao tác trên một bản ghi cụ thể.
 * Dùng để xem ai đã làm gì với một tài nguyên.
 *
 * @param {string}  resource   - Loại tài nguyên (dùng AuditResource enum)
 * @param {string}  [resourceId] - ID bản ghi (nếu không truyền → lấy tất cả theo resource)
 * @returns {Promise<object[]>}
 */
const getLogsByResource = async (resource, resourceId) => {
    return auditLogRepository.findByResource(resource, resourceId);
};

// ─── Helper: Build where clause ───────────────────────────────────────────────
const buildWhereClause = ({ userId, action, resource, resourceId, status, startDate, endDate } = {}) => {
    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (status) where.status = status;

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return where;
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const auditLogService = {
    // Ghi log
    log,
    logSuccess,
    logFail,
    logAsync,

    // Query
    getLogs,
    getLogsByUserId,
    getLogsByUserIdCursor,
    getLogsCursor,
    getLogsByResource,
};

