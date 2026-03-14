import {   userJoinedJobRepository, jobRepository   } from "../repositories/index.js";
import {   notificationService   } from "./notification.service.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {   NotFoundError, ForbiddenError, ConflictError, BadRequestError   } from "../utils/errors.js";

// ─── Hằng số trạng thái ───────────────────────────────────────────────────────
const PENDING = "PENDING";
const APPROVED = "APPROVED";
const REJECTED = "REJECTED";
const CANCELED = "CANCELED";

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy danh sách participants của job (offset) ──────────────────────────────
/**
 * Lấy danh sách người tham gia một job với offset pagination.
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status] - Lọc theo trạng thái
 * @returns {Promise<object>}
 */
const getParticipantsByJobId = async ({ jobId, page = 1, limit = 20, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        userJoinedJobRepository.findParticipantsByJobId({ jobId, skip, take, status }),
        userJoinedJobRepository.countParticipants(jobId, status),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy danh sách job của user (offset) ─────────────────────────────────────
/**
 * Lấy danh sách job mà một user đã/đang tham gia (offset pagination).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.status] - Lọc theo trạng thái
 * @returns {Promise<object>}
 */
const getJobsByUserId = async ({ userId, page = 1, limit = 20, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const data = await userJoinedJobRepository.findJobsByUserId({ userId, skip, take, status });
    const total = await userJoinedJobRepository.countParticipants(undefined, status);
    return parseOffsetResult(data.map((r) => r.job), total, page, limit);
};

// ─── Lấy danh sách job của user (cursor) ─────────────────────────────────────
/**
 * Kiểm tra trạng thái tham gia của user trong job.
 *
 * @param {string} userId
 * @param {string} jobId
 * @returns {Promise<object | null>} Bản ghi UserJoinedJob hoặc null
 */
const getParticipation = async (userId, jobId) => {
    return userJoinedJobRepository.findJoin(userId, jobId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// THAM GIA / XIN THAM GIA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── User xin tham gia job ────────────────────────────────────────────────────
/**
 * Người dùng gửi yêu cầu tham gia một job (status = PENDING).
 * Tự động thông báo đến các manager của job.
 *
 * @param {object} params
 * @param {string}  params.userId - ID người xin tham gia
 * @param {string}  params.jobId  - ID job muốn tham gia
 * @returns {Promise<object>} Bản ghi UserJoinedJob vừa tạo
 * @throws {NotFoundError}
 * @throws {ConflictError} Nếu đã có yêu cầu tham gia trước đó
 */
const requestJoinJob = async ({ userId, jobId }) => {
    const job = await jobRepository.findById(jobId);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");

    const existing = await userJoinedJobRepository.findJoin(userId, jobId);
    if (existing) {
        if (existing.status === APPROVED) {
            throw new ConflictError("Bạn đã là thành viên của công việc này");
        }
        if (existing.status === PENDING) {
            throw new ConflictError("Yêu cầu tham gia của bạn đang chờ xét duyệt");
        }
        // REJECTED hoặc CANCELED → cho phép xin lại bằng cách cập nhật về PENDING
        return userJoinedJobRepository.updateJoinStatus(userId, jobId, PENDING);
    }

    const record = await userJoinedJobRepository.createJoin({ userId, jobId, status: PENDING });

    // Gửi thông báo đến tất cả manager (bất đồng bộ)
    if (job.manager?.length) {
        const managerUserIds = job.manager.map((m) => m.userId).filter(Boolean);
        notificationService.broadcast({
            userIds: managerUserIds,
            title: "Yêu cầu tham gia mới 📌",
            content: `Có người dùng xin tham gia công việc "${job.title}".`,
            type: "SYSTEM",
            refType: "JOB",
            refId: jobId,
        }).catch(() => { });
    }

    return record;
};

// ─── Manager thêm trực tiếp user vào job (không cần duyệt) ───────────────────
/**
 * Manager / Admin thêm trực tiếp một user vào job với status APPROVED.
 *
 * @param {object} params
 * @param {string}  params.userId   - ID người dùng cần thêm
 * @param {string}  params.jobId    - ID job
 * @param {string}  params.addedBy  - ID người thực hiện (để kiểm tra quyền nếu cần)
 * @returns {Promise<object>} Bản ghi UserJoinedJob
 * @throws {NotFoundError}
 * @throws {ConflictError}
 */
const addParticipant = async ({ userId, jobId, addedBy }) => {
    const job = await jobRepository.findById(jobId);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");

    const existing = await userJoinedJobRepository.findJoin(userId, jobId);
    if (existing?.status === APPROVED) {
        throw new ConflictError("Người dùng đã là thành viên của công việc này");
    }

    let record;
    if (existing) {
        record = await userJoinedJobRepository.updateJoinStatus(userId, jobId, APPROVED);
    } else {
        record = await userJoinedJobRepository.createJoin({ userId, jobId, status: APPROVED });
    }

    // Thông báo cho user được thêm
    notificationService.send({
        userId,
        title: "Bạn được thêm vào công việc ✅",
        content: `Bạn đã được thêm vào công việc "${job.title}".`,
        type: "SYSTEM",
        refType: "JOB",
        refId: jobId,
    }).catch(() => { });

    return record;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DUYỆT / TỪ CHỐI / CẬP NHẬT TRẠNG THÁI
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Duyệt hoặc từ chối yêu cầu tham gia ─────────────────────────────────────
/**
 * Manager duyệt hoặc từ chối yêu cầu tham gia job từ một user.
 * Tự động gửi thông báo đến người dùng.
 *
 * @param {object} params
 * @param {string}  params.userId   - ID người dùng cần xét
 * @param {string}  params.jobId    - ID job
 * @param {string}  params.status   - "APPROVED" | "REJECTED"
 * @param {string}  params.reviewedBy - ID manager thực hiện
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {BadRequestError} Nếu không ở trạng thái PENDING
 */
const reviewParticipation = async ({ userId, jobId, status, reviewedBy }) => {
    const existing = await userJoinedJobRepository.findJoin(userId, jobId);
    if (!existing) throw new NotFoundError("Không tìm thấy yêu cầu tham gia");
    if (existing.status !== PENDING) {
        throw new BadRequestError(`Yêu cầu đã ở trạng thái ${existing.status}`);
    }

    const job = await jobRepository.findById(jobId);
    const updated = await userJoinedJobRepository.updateJoinStatus(userId, jobId, status);

    // Gửi thông báo cho user
    notificationService.send({
        userId,
        title: status === APPROVED ? "Yêu cầu tham gia được chấp nhận ✅" : "Yêu cầu tham gia bị từ chối ❌",
        content:
            status === APPROVED
                ? `Yêu cầu tham gia công việc "${job?.title}" của bạn đã được phê duyệt.`
                : `Yêu cầu tham gia công việc "${job?.title}" của bạn đã bị từ chối.`,
        type: "APPROVAL",
        refType: "JOB",
        refId: jobId,
    }).catch(() => { });

    return updated;
};

// ─── User rời khỏi job ────────────────────────────────────────────────────────
/**
 * Người dùng tự rời khỏi job mà họ đang tham gia.
 *
 * @param {object} params
 * @param {string}  params.userId - ID người rời
 * @param {string}  params.jobId  - ID job
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {BadRequestError} Nếu chưa tham gia job
 */
const leaveJob = async ({ userId, jobId }) => {
    const existing = await userJoinedJobRepository.findJoin(userId, jobId);
    if (!existing) throw new NotFoundError("Bạn chưa tham gia công việc này");
    if (existing.status !== APPROVED) {
        throw new BadRequestError("Bạn chưa được phê duyệt vào công việc này");
    }

    return userJoinedJobRepository.deleteJoin(userId, jobId);
};

// ─── Manager/Admin xóa user khỏi job ─────────────────────────────────────────
/**
 * Manager hoặc Admin xóa một user khỏi job (kick).
 * Gửi thông báo đến user bị xóa.
 *
 * @param {object} params
 * @param {string}  params.userId    - ID user cần xóa khỏi job
 * @param {string}  params.jobId     - ID job
 * @param {string}  params.removedBy - ID người thực hiện
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const removeParticipant = async ({ userId, jobId, removedBy }) => {
    const existing = await userJoinedJobRepository.findJoin(userId, jobId);
    if (!existing) throw new NotFoundError("Người dùng không thuộc công việc này");

    const job = await jobRepository.findById(jobId);
    const removed = await userJoinedJobRepository.deleteJoin(userId, jobId);

    // Thông báo user bị xóa
    if (userId !== removedBy) {
        notificationService.send({
            userId,
            title: "Bạn đã bị xóa khỏi công việc",
            content: `Bạn đã bị xóa khỏi công việc "${job?.title}".`,
            type: "SYSTEM",
            refType: "JOB",
            refId: jobId,
        }).catch(() => { });
    }

    return removed;
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const jobParticipantService = {
    // Query
    getParticipantsByJobId,
    getJobsByUserId,
    getParticipation,

    // Tham gia
    requestJoinJob,
    addParticipant,

    // Duyệt / Từ chối
    reviewParticipation,

    // Rời / Xóa
    leaveJob,
    removeParticipant,
};

