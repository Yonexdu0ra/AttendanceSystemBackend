import {   jobRepository, jobManagerRepository   } from "../repositories/index.js";
import {   notificationService   } from "./notification.service.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {   NotFoundError, ForbiddenError, ConflictError   } from "../utils/errors.js";

// ═══════════════════════════════════════════════════════════════════════════════
// JOB QUERY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy chi tiết job ────────────────────────────────────────────────────────
/**
 * Lấy chi tiết một job theo ID, kèm danh sách manager.
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const getJobById = async (id) => {
    const job = await jobRepository.findById(id);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");
    return job;
};

// ─── Lấy danh sách job (offset) ──────────────────────────────────────────────
/**
 * Lấy danh sách tất cả job với offset pagination (web / admin).
 *
 * @param {object}  [params]
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.search]  - Tìm theo tiêu đề (LIKE)
 * @returns {Promise<object>}
 */
const getJobs = async ({ page = 1, limit = 20, search } = {}) => {
    const where = search
        ? { title: { contains: search, mode: "insensitive" } }
        : {};
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        jobRepository.findMany({ skip, take, where }),
        jobRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy danh sách job (cursor) ──────────────────────────────────────────────
/**
 * Lấy danh sách job với cursor pagination (mobile).
 *
 * @param {object}  [params]
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.search]
 * @returns {Promise<object>}
 */
const getJobsCursor = async ({ cursor, limit = 20, search } = {}) => {
    const where = search
        ? { title: { contains: search, mode: "insensitive" } }
        : {};
    const raw = await jobRepository.findManyCursor({ cursor, take: limit, where });
    return parseCursorResult(raw, limit);
};

// ─── Lấy job mà user đang tham gia (APPROVED) ────────────────────────────────
/**
 * Lấy danh sách job mà một user đang tham gia với status APPROVED.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const getJobsByUserId = async (userId) => {
    return jobRepository.findByUserId(userId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOB CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tạo job mới ─────────────────────────────────────────────────────────────
/**
 * Tạo một job mới và tự động gán người tạo làm manager đầu tiên.
 *
 * @param {object} params
 * @param {string}  params.creatorId - ID người tạo (sẽ thành manager)
 * @param {object}  params.dto       - CreateJobDtoType
 * @returns {Promise<{ job: object, manager: object }>}
 */
const createJob = async ({ creatorId, dto }) => {
    // Chuyển đổi HH:mm → DateTime (dùng ngày hôm nay làm date base)
    const jobData = _parseJobTimes(dto);

    const job = await jobRepository.create(jobData);

    // Tự động gán người tạo làm manager
    const manager = await jobManagerRepository.createManager({
        userId: creatorId,
        jobId: job.id,
    });

    return { job, manager };
};

// ─── Cập nhật job ────────────────────────────────────────────────────────────
/**
 * Cập nhật thông tin job. Chỉ manager hoặc admin mới được phép.
 *
 * @param {object} params
 * @param {string}  params.id          - ID job cần cập nhật
 * @param {string}  params.requesterId - ID người thực hiện
 * @param {boolean} params.isAdmin     - Có phải admin không
 * @param {object}  params.dto         - UpdateJobDtoType
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {ForbiddenError} Nếu không phải manager hoặc admin
 */
const updateJob = async ({ id, requesterId, isAdmin = false, dto }) => {
    const job = await jobRepository.findById(id);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");

    if (!isAdmin) {
        const managerRecord = await jobManagerRepository.isManager(requesterId, id);
        if (!managerRecord) throw new ForbiddenError("Bạn không có quyền chỉnh sửa công việc này");
    }

    const updateData = _parseJobTimes(dto);
    return jobRepository.update(id, updateData);
};

// ─── Xóa job ─────────────────────────────────────────────────────────────────
/**
 * Xóa một job (admin only).
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const deleteJob = async (id) => {
    const job = await jobRepository.findById(id);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");
    return jobRepository.remove(id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy danh sách manager của job ───────────────────────────────────────────
/**
 * Lấy danh sách tất cả manager của một job.
 *
 * @param {object} params
 * @param {string}  params.jobId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<object>}
 */
const getManagersByJobId = async ({ jobId, page = 1, limit = 50 }) => {
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        jobManagerRepository.findManagersByJobId({ jobId, skip, take }),
        jobManagerRepository.countManagers(jobId),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy danh sách job mà user đang quản lý ──────────────────────────────────
/**
 * Lấy danh sách job mà một người dùng đang là manager.
 *
 * @param {object} params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @returns {Promise<object>}
 */
const getManagedJobs = async ({ userId, page = 1, limit = 20 }) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const data = await jobManagerRepository.findJobsByManagerId({ userId, skip, take });
    return data.map((jm) => jm.job);
};

// ─── Thêm manager vào job ─────────────────────────────────────────────────────
/**
 * Thêm một người dùng làm manager của job.
 * Kiểm tra người dùng chưa là manager trước khi thêm.
 *
 * @param {object} params
 * @param {string}  params.jobId    - ID job
 * @param {string}  params.userId   - ID người dùng cần thêm làm manager
 * @param {string}  params.addedBy  - ID người thực hiện (để kiểm tra quyền)
 * @param {boolean} params.isAdmin  - Có phải admin không
 * @returns {Promise<object>} JobManager vừa tạo
 * @throws {NotFoundError}
 * @throws {ForbiddenError}
 * @throws {ConflictError} Nếu đã là manager
 */
const addManager = async ({ jobId, userId, addedBy, isAdmin = false }) => {
    const job = await jobRepository.findById(jobId);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");

    if (!isAdmin) {
        const requesterIsManager = await jobManagerRepository.isManager(addedBy, jobId);
        if (!requesterIsManager) throw new ForbiddenError("Bạn không có quyền thêm manager cho công việc này");
    }

    const existing = await jobManagerRepository.isManager(userId, jobId);
    if (existing) throw new ConflictError("Người dùng đã là manager của công việc này");

    const manager = await jobManagerRepository.createManager({ userId, jobId });

    // Thông báo cho manager mới
    notificationService.sendToUser(userId, {
        title: "Bạn được thêm làm quản lý",
        content: `Bạn đã được thêm làm quản lý của công việc "${job.title}".`,
        type: "SYSTEM",
        refType: "JOB",
        refId: jobId,
    }).catch(() => { });

    return manager;
};

// ─── Xóa manager khỏi job ────────────────────────────────────────────────────
/**
 * Xóa một manager khỏi job.
 * Không được xóa manager duy nhất còn lại.
 *
 * @param {object} params
 * @param {string}  params.jobId      - ID job
 * @param {string}  params.managerId  - ID bản ghi JobManager cần xóa
 * @param {string}  params.removedBy  - ID người thực hiện
 * @param {boolean} params.isAdmin    - Có phải admin không
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {ForbiddenError}
 * @throws {BadRequestError} Nếu đây là manager cuối cùng
 */
const removeManager = async ({ jobId, managerId, removedBy, isAdmin = false }) => {
    const managerRecord = await jobManagerRepository.findManagerById(managerId);
    if (!managerRecord || managerRecord.jobId !== jobId) {
        throw new NotFoundError("Không tìm thấy manager trong công việc này");
    }

    if (!isAdmin) {
        const requesterIsManager = await jobManagerRepository.isManager(removedBy, jobId);
        if (!requesterIsManager) throw new ForbiddenError("Bạn không có quyền xóa manager của công việc này");
    }

    // Không cho xóa manager cuối cùng
    const total = await jobManagerRepository.countManagers(jobId);
    if (total <= 1) {
        const { BadRequestError } = await import("../utils/errors.js");
        throw new BadRequestError("Không thể xóa manager duy nhất của công việc. Hãy thêm manager khác trước.");
    }

    return jobManagerRepository.deleteManager(managerId);
};

// ─── Kiểm tra user có phải manager không ─────────────────────────────────────
/**
 * Kiểm tra xem một user có phải manager của job không.
 *
 * @param {string} userId
 * @param {string} jobId
 * @returns {Promise<boolean>}
 */
const isManager = async (userId, jobId) => {
    const record = await jobManagerRepository.isManager(userId, jobId);
    return !!record;
};

// ─── Private helper: parse HH:mm → DateTime ──────────────────────────────────
/**
 * Chuyển đổi trường workStartTime / workEndTime từ string "HH:mm"
 * sang Date object (dùng ngày 1970-01-01 làm base để lưu vào cột @db.Time).
 */
const _parseJobTimes = (dto) => {
    const result = { ...dto };

    if (dto.workStartTime) {
        const [h, m] = dto.workStartTime.split(":").map(Number);
        result.workStartTime = new Date(Date.UTC(1970, 0, 1, h, m, 0));
    }
    if (dto.workEndTime) {
        const [h, m] = dto.workEndTime.split(":").map(Number);
        result.workEndTime = new Date(Date.UTC(1970, 0, 1, h, m, 0));
    }

    return result;
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const jobService = {
    // Query
    getJobById,
    getJobs,
    getJobsCursor,
    getJobsByUserId,

    // CRUD
    createJob,
    updateJob,
    deleteJob,

    // Manager
    getManagersByJobId,
    getManagedJobs,
    addManager,
    removeManager,
    isManager,
};

