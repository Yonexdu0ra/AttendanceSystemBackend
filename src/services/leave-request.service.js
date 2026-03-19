import {   leaveRequestRepository   } from "../repositories/index.js";
import {   notificationService   } from "./notification.service.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {  
    NotFoundError,
    ForbiddenError,
    BadRequestError,
    UnprocessableError,
  } from "../utils/errors.js";

// ─── Hằng số trạng thái cho phép thao tác ────────────────────────────────────
const PENDING = "PENDING";
const APPROVED = "APPROVED";
const REJECTED = "REJECTED";
const CANCELED = "CANCELED";

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy chi tiết đơn nghỉ ───────────────────────────────────────────────────
/**
 * Lấy chi tiết một đơn xin nghỉ theo ID.
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const getLeaveRequestById = async (id) => {
    const request = await leaveRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin nghỉ");
    return request;
};

// ─── Lấy đơn nghỉ của user (offset) ──────────────────────────────────────────
/**
 * Lấy danh sách đơn xin nghỉ của một người dùng (web).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getLeaveRequestsByUserId = async ({ userId, page = 1, limit = 20, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = { userId, ...(status ? { status } : {}) };

    const [data, total] = await Promise.all([
        leaveRequestRepository.findByUserId({ userId, skip, take, status }),
        leaveRequestRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy đơn nghỉ của user (cursor) ──────────────────────────────────────────
/**
 * Lấy danh sách đơn xin nghỉ của người dùng với cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getLeaveRequestsByUserIdCursor = async ({ userId, cursor, limit = 20, status } = {}) => {
    const raw = await leaveRequestRepository.findByUserIdCursor({ userId, cursor, take: limit, status });
    return parseCursorResult(raw, limit);
};

// ─── Lấy đơn nghỉ theo job (offset) ──────────────────────────────────────────
/**
 * Lấy danh sách đơn xin nghỉ trong một job (dành cho manager).
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getLeaveRequestsByJobId = async ({ jobId, page = 1, limit = 20, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = { jobId, ...(status ? { status } : {}) };

    const [data, total] = await Promise.all([
        leaveRequestRepository.findByJobId({ jobId, skip, take, status }),
        leaveRequestRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy đơn nghỉ theo job (cursor) ──────────────────────────────────────────
/**
 * Lấy danh sách đơn xin nghỉ trong một job với cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getLeaveRequestsByJobIdCursor = async ({ jobId, cursor, limit = 20, status } = {}) => {
    const raw = await leaveRequestRepository.findByJobIdCursor({ jobId, cursor, take: limit, status });
    return parseCursorResult(raw, limit);
};

// ─── Lấy tất cả đơn nghỉ (admin, offset) ─────────────────────────────────────
/**
 * Lấy tất cả đơn xin nghỉ toàn hệ thống với filter (admin).
 *
 * @param {object}  [params]
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @param {string}  [params.userId]
 * @param {string}  [params.jobId]
 * @param {string}  [params.leaveType]
 * @returns {Promise<object>}
 */
const getAllLeaveRequests = async ({ page = 1, limit = 20, status, userId, jobId, leaveType } = {}) => {
    const where = _buildWhere({ status, userId, jobId, leaveType });
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        leaveRequestRepository.findMany({ skip, take, where }),
        leaveRequestRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tạo đơn nghỉ ────────────────────────────────────────────────────────────
/**
 * Nhân viên tạo đơn xin nghỉ mới.
 *
 * @param {object} params
 * @param {string}  params.userId - ID người tạo đơn
 * @param {object}  params.dto    - CreateLeaveRequestDtoType
 * @returns {Promise<object>} Đơn vừa tạo
 * @throws {UnprocessableError} Nếu ngày bắt đầu đã qua
 */
const createLeaveRequest = async ({ userId, dto }) => {
    if (new Date(dto.startDate) < new Date()) {
        throw new UnprocessableError("Ngày bắt đầu không thể là ngày trong quá khứ");
    }

    return leaveRequestRepository.create({ userId, ...dto });
};

// ─── Cập nhật đơn nghỉ ───────────────────────────────────────────────────────
/**
 * Cập nhật đơn xin nghỉ. Chỉ được cập nhật khi đơn đang PENDING.
 *
 * @param {object} params
 * @param {string}  params.id     - ID đơn cần cập nhật
 * @param {string}  params.userId - ID người thực hiện (kiểm tra quyền)
 * @param {object}  params.dto    - UpdateLeaveRequestDtoType
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {ForbiddenError}  Nếu không phải đơn của mình
 * @throws {BadRequestError} Nếu đơn không còn ở trạng thái PENDING
 */
const updateLeaveRequest = async ({ id, userId, dto }) => {
    const request = await leaveRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin nghỉ");
    if (request.userId !== userId) throw new ForbiddenError("Bạn không có quyền chỉnh sửa đơn này");
    if (request.status !== PENDING) {
        throw new BadRequestError(`Không thể chỉnh sửa đơn đã ở trạng thái ${request.status}`);
    }

    // Tính lại endDate nếu startDate thay đổi mà endDate không đổi
    const startDate = dto.startDate ?? request.startDate;
    const endDate = dto.endDate ?? request.endDate;
    if (new Date(endDate) < new Date(startDate)) {
        throw new UnprocessableError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
    }

    return leaveRequestRepository.update(id, dto);
};

// ─── Hủy đơn nghỉ ────────────────────────────────────────────────────────────
/**
 * Nhân viên hủy đơn xin nghỉ của mình. Chỉ được hủy khi đơn đang PENDING.
 *
 * @param {object} params
 * @param {string}  params.id     - ID đơn
 * @param {string}  params.userId - ID người thực hiện
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {ForbiddenError}
 * @throws {BadRequestError} Nếu đơn không còn ở trạng thái PENDING
 */
const cancelLeaveRequest = async ({ id, userId }) => {
    const request = await leaveRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin nghỉ");
    if (request.userId !== userId) throw new ForbiddenError("Bạn không có quyền hủy đơn này");
    if (request.status !== PENDING) {
        throw new BadRequestError(`Không thể hủy đơn đã ở trạng thái ${request.status}`);
    }

    return leaveRequestRepository.update(id, { status: CANCELED });
};

// ─── Xóa đơn nghỉ (admin) ────────────────────────────────────────────────────
/**
 * Xóa hoàn toàn đơn xin nghỉ (admin).
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const deleteLeaveRequest = async (id) => {
    const request = await leaveRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin nghỉ");
    return leaveRequestRepository.remove(id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DUYỆT / TỪ CHỐI
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Duyệt hoặc từ chối đơn nghỉ ─────────────────────────────────────────────
/**
 * Manager / Admin duyệt hoặc từ chối đơn xin nghỉ.
 * Tự động gửi thông báo in-app đến người nộp đơn.
 *
 * @param {object} params
 * @param {string}  params.id         - ID đơn cần xử lý
 * @param {string}  params.approverId - ID người duyệt/từ chối
 * @param {string}  params.status     - "APPROVED" | "REJECTED"
 * @param {string}  [params.reply]    - Lý do hoặc ghi chú
 * @returns {Promise<object>} Đơn sau khi được xử lý
 * @throws {NotFoundError}
 * @throws {BadRequestError} Nếu đơn không còn ở trạng thái PENDING
 */
const reviewLeaveRequest = async ({ id, approverId, status, reply }) => {
    const request = await leaveRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin nghỉ");
    if (request.status !== PENDING) {
        throw new BadRequestError(`Đơn đã được xử lý với trạng thái ${request.status}`);
    }

    const updated = await leaveRequestRepository.review(id, {
        status,
        reply,
        approvedBy: approverId,
    });

    // Gửi thông báo in-app cho người nộp đơn (bất đồng bộ)
    notificationService.sendToUser(request.userId, {
        title: status === APPROVED ? "Đơn nghỉ được duyệt ✅" : "Đơn nghỉ bị từ chối ❌",
        content:
            status === APPROVED
                ? `Đơn xin nghỉ của bạn từ ${_formatDate(request.startDate)} đến ${_formatDate(request.endDate)} đã được duyệt.${reply ? ` Ghi chú: ${reply}` : ""}`
                : `Đơn xin nghỉ của bạn đã bị từ chối.${reply ? ` Lý do: ${reply}` : ""}`,
        type: "APPROVAL",
        refType: "LEAVE",
        refId: id,
    }).catch((err) => console.error("[Notification] Gửi thông báo thất bại:", err.message));

    return updated;
};

// ─── Private helpers ─────────────────────────────────────────────────────────
const _buildWhere = ({ status, userId, jobId, leaveType } = {}) => {
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (jobId) where.jobId = jobId;
    if (leaveType) where.leaveType = leaveType;
    return where;
};

const _formatDate = (date) =>
    new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

// ─── Export ───────────────────────────────────────────────────────────────────
export const leaveRequestService = {
    // Query
    getLeaveRequestById,
    getLeaveRequestsByUserId,
    getLeaveRequestsByUserIdCursor,
    getLeaveRequestsByJobId,
    getLeaveRequestsByJobIdCursor,
    getAllLeaveRequests,

    // CRUD
    createLeaveRequest,
    updateLeaveRequest,
    cancelLeaveRequest,
    deleteLeaveRequest,

    // Duyệt / Từ chối
    reviewLeaveRequest,
};

