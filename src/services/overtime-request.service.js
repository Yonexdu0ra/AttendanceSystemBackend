import {   overtimeRequestRepository   } from "../repositories/index.js";
import {   notificationService   } from "./notification.service.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {  
    NotFoundError,
    ForbiddenError,
    BadRequestError,
    UnprocessableError,
  } from "../utils/errors.js";

// ─── Hằng số trạng thái ───────────────────────────────────────────────────────
const PENDING = "PENDING";
const APPROVED = "APPROVED";
const REJECTED = "REJECTED";
const CANCELED = "CANCELED";

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy chi tiết đơn OT ─────────────────────────────────────────────────────
/**
 * Lấy chi tiết một đơn xin làm thêm giờ theo ID.
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const getOvertimeRequestById = async (id) => {
    const request = await overtimeRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin làm thêm giờ");
    return request;
};

// ─── Lấy đơn OT của user (offset) ────────────────────────────────────────────
/**
 * Lấy danh sách đơn làm thêm giờ của một người dùng (web).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getOvertimeRequestsByUserId = async ({ userId, page = 1, limit = 20, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = { userId, ...(status ? { status } : {}) };

    const [data, total] = await Promise.all([
        overtimeRequestRepository.findByUserId({ userId, skip, take, status }),
        overtimeRequestRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy đơn OT của user (cursor) ────────────────────────────────────────────
/**
 * Lấy danh sách đơn làm thêm giờ với cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getOvertimeRequestsByUserIdCursor = async ({ userId, cursor, limit = 20, status } = {}) => {
    const raw = await overtimeRequestRepository.findByUserIdCursor({ userId, cursor, take: limit, status });
    return parseCursorResult(raw, limit);
};

// ─── Lấy đơn OT theo job (offset) ────────────────────────────────────────────
/**
 * Lấy danh sách đơn làm thêm giờ trong một job (dành cho manager).
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getOvertimeRequestsByJobId = async ({ jobId, page = 1, limit = 20, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = { jobId, ...(status ? { status } : {}) };

    const [data, total] = await Promise.all([
        overtimeRequestRepository.findByJobId({ jobId, skip, take, status }),
        overtimeRequestRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy đơn OT theo job (cursor) ────────────────────────────────────────────
/**
 * Lấy danh sách đơn làm thêm giờ trong một job với cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getOvertimeRequestsByJobIdCursor = async ({ jobId, cursor, limit = 20, status } = {}) => {
    const raw = await overtimeRequestRepository.findByJobIdCursor({ jobId, cursor, take: limit, status });
    return parseCursorResult(raw, limit);
};

// ─── Lấy đơn OT theo ngày ────────────────────────────────────────────────────
/**
 * Lấy tất cả đơn làm thêm giờ trong một ngày cụ thể.
 * Dùng để kiểm tra xung đột khi tạo đơn mới.
 *
 * @param {string | Date} date   - Ngày cần kiểm tra
 * @param {object}        [where] - Điều kiện bổ sung (VD: { userId, jobId })
 * @returns {Promise<object[]>}
 */
const getOvertimeRequestsByDate = async (date, where = {}) => {
    return overtimeRequestRepository.findByDate(date, where);
};

// ─── Lấy tất cả đơn OT (admin, offset) ───────────────────────────────────────
/**
 * Lấy tất cả đơn làm thêm giờ toàn hệ thống với filter (admin).
 *
 * @param {object}  [params]
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status]
 * @param {string}  [params.userId]
 * @param {string}  [params.jobId]
 * @returns {Promise<object>}
 */
const getAllOvertimeRequests = async ({ page = 1, limit = 20, status, userId, jobId } = {}) => {
    const where = _buildWhere({ status, userId, jobId });
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        overtimeRequestRepository.findMany({ skip, take, where }),
        overtimeRequestRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tạo đơn OT ──────────────────────────────────────────────────────────────
/**
 * Nhân viên tạo đơn xin làm thêm giờ.
 * Kiểm tra xung đột với các đơn OT đã có trong cùng ngày và khoảng giờ.
 *
 * @param {object} params
 * @param {string}  params.userId - ID người tạo đơn
 * @param {object}  params.dto    - CreateOvertimeRequestDtoType (đã có minutes sau transform)
 * @returns {Promise<object>} Đơn vừa tạo
 * @throws {UnprocessableError} Nếu thời gian bắt đầu đã qua
 * @throws {ConflictError}      Nếu bị trùng với đơn OT khác
 */
const createOvertimeRequest = async ({ userId, dto }) => {
    if (new Date(dto.startTime) < new Date()) {
        throw new UnprocessableError("Thời gian bắt đầu không thể là thời điểm trong quá khứ");
    }

    // Kiểm tra xung đột thời gian với các đơn OT PENDING/APPROVED cùng ngày
    const existingRequests = await overtimeRequestRepository.findByDate(dto.date, { userId });
    const hasConflict = existingRequests
        .filter((r) => r.status === PENDING || r.status === APPROVED)
        .some((r) => _isTimeOverlap(dto.startTime, dto.endTime, r.startTime, r.endTime));

    if (hasConflict) {
        throw new UnprocessableError("Thời gian làm thêm giờ bị trùng với đơn OT khác của bạn");
    }

    return overtimeRequestRepository.create({ userId, ...dto });
};

// ─── Cập nhật đơn OT ─────────────────────────────────────────────────────────
/**
 * Cập nhật đơn xin làm thêm giờ. Chỉ được cập nhật khi đơn đang PENDING.
 * Tự động tính lại số phút OT nếu thời gian thay đổi.
 *
 * @param {object} params
 * @param {string}  params.id     - ID đơn cần cập nhật
 * @param {string}  params.userId - ID người thực hiện
 * @param {object}  params.dto    - UpdateOvertimeRequestDtoType
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {ForbiddenError}
 * @throws {BadRequestError}
 */
const updateOvertimeRequest = async ({ id, userId, dto }) => {
    const request = await overtimeRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin làm thêm giờ");
    if (request.userId !== userId) throw new ForbiddenError("Bạn không có quyền chỉnh sửa đơn này");
    if (request.status !== PENDING) {
        throw new BadRequestError(`Không thể chỉnh sửa đơn đã ở trạng thái ${request.status}`);
    }

    // Tính lại minutes nếu thời gian thay đổi
    const startTime = dto.startTime ?? request.startTime;
    const endTime = dto.endTime ?? request.endTime;

    if (new Date(endTime) <= new Date(startTime)) {
        throw new UnprocessableError("Thời gian kết thúc phải sau thời gian bắt đầu");
    }

    const minutes = Math.round(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    );

    return overtimeRequestRepository.update(id, { ...dto, minutes });
};

// ─── Hủy đơn OT ──────────────────────────────────────────────────────────────
/**
 * Nhân viên hủy đơn xin làm thêm giờ của mình. Chỉ hủy được khi PENDING.
 *
 * @param {object} params
 * @param {string}  params.id     - ID đơn
 * @param {string}  params.userId - ID người thực hiện
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {ForbiddenError}
 * @throws {BadRequestError}
 */
const cancelOvertimeRequest = async ({ id, userId }) => {
    const request = await overtimeRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin làm thêm giờ");
    if (request.userId !== userId) throw new ForbiddenError("Bạn không có quyền hủy đơn này");
    if (request.status !== PENDING) {
        throw new BadRequestError(`Không thể hủy đơn đã ở trạng thái ${request.status}`);
    }

    return overtimeRequestRepository.update(id, { status: CANCELED });
};

// ─── Xóa đơn OT (admin) ──────────────────────────────────────────────────────
/**
 * Xóa hoàn toàn đơn làm thêm giờ (admin).
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const deleteOvertimeRequest = async (id) => {
    const request = await overtimeRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin làm thêm giờ");
    return overtimeRequestRepository.remove(id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DUYỆT / TỪ CHỐI
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Duyệt hoặc từ chối đơn OT ───────────────────────────────────────────────
/**
 * Manager / Admin duyệt hoặc từ chối đơn xin làm thêm giờ.
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
const reviewOvertimeRequest = async ({ id, approverId, status, reply }) => {
    const request = await overtimeRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Không tìm thấy đơn xin làm thêm giờ");
    if (request.status !== PENDING) {
        throw new BadRequestError(`Đơn đã được xử lý với trạng thái ${request.status}`);
    }

    const updated = await overtimeRequestRepository.review(id, {
        status,
        reply,
        approvedBy: approverId,
    });

    // Gửi thông báo in-app (bất đồng bộ)
    notificationService.sendToUser(request.userId, {
        title: status === APPROVED ? "Đơn OT được duyệt ✅" : "Đơn OT bị từ chối ❌",
        content:
            status === APPROVED
                ? `Đơn làm thêm giờ ngày ${_formatDate(request.date)} (${request.minutes} phút) của bạn đã được duyệt.${reply ? ` Ghi chú: ${reply}` : ""}`
                : `Đơn làm thêm giờ ngày ${_formatDate(request.date)} của bạn đã bị từ chối.${reply ? ` Lý do: ${reply}` : ""}`,
        type: "APPROVAL",
        refType: "OVERTIME",
        refId: id,
    }).catch((err) => console.error("[Notification] Gửi thông báo thất bại:", err.message));

    return updated;
};

// ─── Private helpers ─────────────────────────────────────────────────────────
const _buildWhere = ({ status, userId, jobId } = {}) => {
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (jobId) where.jobId = jobId;
    return where;
};

/**
 * Kiểm tra xem 2 khoảng thời gian có chồng nhau không.
 */
const _isTimeOverlap = (start1, end1, start2, end2) => {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();
    return s1 < e2 && e1 > s2;
};

const _formatDate = (date) =>
    new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

// ─── Export ───────────────────────────────────────────────────────────────────
export const overtimeRequestService = {
    // Query
    getOvertimeRequestById,
    getOvertimeRequestsByUserId,
    getOvertimeRequestsByUserIdCursor,
    getOvertimeRequestsByJobId,
    getOvertimeRequestsByJobIdCursor,
    getOvertimeRequestsByDate,
    getAllOvertimeRequests,

    // CRUD
    createOvertimeRequest,
    updateOvertimeRequest,
    cancelOvertimeRequest,
    deleteOvertimeRequest,

    // Duyệt / Từ chối
    reviewOvertimeRequest,
};

