import {
    attendanceRepository,
    jobRepository,
    userJoinedJobRepository,
} from "../repositories/index.js";
import { notificationService } from "./notification.service.js";
import { buildOffsetClause, parseOffsetResult } from "../utils/offset-pagination.js";
import { parseCursorResult } from "../utils/cursor-pagination.js";
import {
    NotFoundError,
    ForbiddenError,
    BadRequestError,
    ConflictError,
    UnprocessableError,
} from "../utils/errors.js";
import { encryptAES, decryptAES } from "../utils/aes.js";

// ─── Hằng số ──────────────────────────────────────────────────────────────────
const PENDING = "PENDING";
const APPROVED = "APPROVED";
const REJECTED = "REJECTED";

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tính khoảng cách giữa hai toạ độ GPS (công thức Haversine).
 * @returns {number} Khoảng cách tính bằng mét
 */
const _haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6_371_000; // bán kính Trái Đất (mét)
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * So sánh hai thời điểm chỉ theo giờ/phút (bỏ qua phần ngày).
 * @returns {number} Số phút chênh lệch (dương = after > scheduled)
 */
const _minutesDiff = (actual, scheduled) => {
    const a = actual.getHours() * 60 + actual.getMinutes();
    const s = scheduled.getHours() * 60 + scheduled.getMinutes();
    return a - s;
};

/**
 * Lấy thông tin job và kiểm tra sự tồn tại.
 * @throws {NotFoundError}
 */
const _requireJob = async (jobId) => {
    const job = await jobRepository.findById(jobId);
    if (!job) throw new NotFoundError("Không tìm thấy công việc");
    return job;
};

/**
 * Kiểm tra user đã được duyệt tham gia job chưa.
 * @throws {ForbiddenError}
 */
const _requireApprovedParticipant = async (userId, jobId) => {
    const join = await userJoinedJobRepository.findJoin(userId, jobId);
    if (!join || join.status !== APPROVED) {
        throw new ForbiddenError("Bạn chưa được duyệt tham gia công việc này");
    }
    return join;
};

/**
 * Xác định AttendanceType dựa trên thời điểm check-in so với lịch làm việc.
 */
const _resolveCheckInType = (now, job) => {
    const diff = _minutesDiff(now, job.workStartTime);
    if (diff > job.lateCheckInMinutes) return "LATE";
    return "PRESENT";
};

/**
 * Xác định AttendanceType dựa trên thời điểm check-out so với lịch làm việc.
 * Nếu check-out sớm hơn cho phép → EARLY_LEAVE.
 */
const _resolveCheckOutType = (checkOutAt, checkInType, job) => {
    const diff = _minutesDiff(checkOutAt, job.workEndTime);
    if (diff < -job.earlyCheckOutMinutes) return "EARLY_LEAVE";
    // Giữ nguyên type đã tính lúc check-in (PRESENT / LATE)
    return checkInType;
};

const _formatDate = (date) =>
    new Date(date).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lấy chi tiết một bản ghi chấm công.
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const getAttendanceById = async (id) => {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError("Không tìm thấy bản ghi chấm công");
    return record;
};

/**
 * Lấy lịch sử chấm công của một user – offset pagination (web).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.type]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getAttendancesByUserId = async ({ userId, page = 1, limit = 20, type, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = {
        userId,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
        attendanceRepository.findByUserId({ userId, skip, take, type, status }),
        attendanceRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

/**
 * Lấy lịch sử chấm công của một user – cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.type]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getAttendancesByUserIdCursor = async ({ userId, cursor, limit = 20, type, status } = {}) => {
    const raw = await attendanceRepository.findByUserIdCursor({ userId, cursor, take: limit, type, status });
    return parseCursorResult(raw, limit);
};

/**
 * Lấy danh sách chấm công của một job – offset pagination (manager/admin).
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.type]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getAttendancesByJobId = async ({ jobId, page = 1, limit = 20, type, status } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = {
        jobId,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
        attendanceRepository.findByJobId({ jobId, skip, take, type, status }),
        attendanceRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

/**
 * Lấy danh sách chấm công của một job – cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.jobId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {string}  [params.type]
 * @param {string}  [params.status]
 * @returns {Promise<object>}
 */
const getAttendancesByJobIdCursor = async ({ jobId, cursor, limit = 20, type, status } = {}) => {
    const raw = await attendanceRepository.findByJobIdCursor({ jobId, cursor, take: limit, type, status });
    return parseCursorResult(raw, limit);
};

/**
 * Lấy chấm công theo khoảng ngày (admin/manager).
 *
 * @param {object}  params
 * @param {string}  [params.userId]
 * @param {string}  [params.jobId]
 * @param {string}  params.startDate - ISO date string
 * @param {string}  params.endDate   - ISO date string
 * @param {string}  [params.type]
 * @param {string}  [params.status]
 * @returns {Promise<object[]>}
 */
const getAttendancesByDateRange = async ({ userId, jobId, startDate, endDate, type, status } = {}) => {
    if (!startDate || !endDate) {
        throw new BadRequestError("Cần cung cấp startDate và endDate");
    }
    if (new Date(endDate) < new Date(startDate)) {
        throw new UnprocessableError("endDate phải sau hoặc bằng startDate");
    }

    return attendanceRepository.findByDateRange({ userId, jobId, startDate, endDate, type, status });
};

/**
 * Lấy danh sách bản ghi nghi ngờ gian lận (manager/admin).
 *
 * @param {object}  [params]
 * @param {string}  [params.jobId]
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @returns {Promise<object>}
 */
const getFraudulentAttendances = async ({ jobId, page = 1, limit = 20 } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);
    const where = { isFraud: true, ...(jobId ? { jobId } : {}) };

    const [data, total] = await Promise.all([
        attendanceRepository.findFraudulent({ jobId, skip, take }),
        attendanceRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS – QR / GPS / META
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Xác thực và giải mã QR Code.
 * @throws {BadRequestError}
 */
const _verifyQRCode = (qrCode, expectedJobId, now) => {
    const decryptedStr = decryptAES(qrCode);
    if (!decryptedStr) {
        throw new BadRequestError("Mã QR không hợp lệ hoặc đã bị thay đổi (giải mã AES thất bại).");
    }
    let qrData;
    try {
        qrData = JSON.parse(decryptedStr);
    } catch {
        throw new BadRequestError("Mã QR sai định dạng nội dung bên trong.");
    }

    if (expectedJobId && qrData.jobId !== expectedJobId) {
        throw new BadRequestError("Mã QR không thuộc về công việc này.");
    }
    if (now.getTime() > qrData.exp) {
        throw new BadRequestError("Mã QR đã hết hạn. Vui lòng quét lại.");
    }
    return qrData;
};

/**
 * Kiểm tra khoảng cách GPS và phát hiện gian lận.
 */
const _checkGPSFraud = (latitude, longitude, job, action, existingFraud = false, existingReason = null) => {
    let isFraud = existingFraud;
    let fraudReason = existingReason;
    let distance = null;

    if (job && job.latitude != null && job.longitude != null) {
        distance = _haversineDistance(latitude, longitude, job.latitude, job.longitude);
        if (distance > job.radius) {
            isFraud = true;
            const msg = `${action} ngoài vùng cho phép: ${Math.round(distance)}m (tối đa ${job.radius}m)`;
            fraudReason = existingReason ? [existingReason, msg].filter(Boolean).join("; ") : msg;
        }
    }

    return { isFraud, fraudReason, distance };
};

/**
 * Tạo metadata vị trí/thiết bị.
 */
const _buildMeta = ({ latitude, longitude, distance, ipAddress, deviceId, qrCode }) => ({
    latitude,
    longitude,
    ...(distance !== null ? { distance: Math.round(distance) } : {}),
    ...(ipAddress ? { ipAddress } : {}),
    ...(deviceId ? { deviceId } : {}),
    ...(qrCode ? { qrCode } : {}),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK-IN / CHECK-OUT (gộp thành 1 endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Nhân viên thực hiện check-in hoặc check-out (tự động xác định).
 *
 * Luồng:
 * - Chưa có bản ghi hôm nay → **CHECK-IN**
 *   1. Xác minh user tham gia job (nếu có jobId).
 *   2. Tính GPS, phát hiện gian lận.
 *   3. Xác định AttendanceType (PRESENT / LATE).
 *   4. Lưu bản ghi PENDING, gửi notification cho manager.
 *
 * - Đã check-in, chưa check-out → **CHECK-OUT**
 *   1. Kiểm tra GPS, phát hiện gian lận.
 *   2. Xác định lại type (EARLY_LEAVE nếu ra sớm).
 *   3. Cập nhật checkOutAt, checkOutMeta.
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {object}  params.dto    - { jobId?, latitude, longitude, deviceId?, qrCode? }
 * @param {string}  [params.ipAddress]
 * @returns {Promise<{ action: "CHECK_IN"|"CHECK_OUT", data: object }>}
 */
const checkInOut = async ({ userId, dto, ipAddress }) => {
    const { jobId, latitude, longitude, deviceId, qrCode } = dto;
    const now = new Date();

    // ── Tìm bản ghi hôm nay để quyết định check-in hay check-out ────────────
    const existing = await attendanceRepository.findByUserAndDate(userId, now);

    if (existing && existing.checkOutAt) {
        throw new ConflictError("Bạn đã check-in và check-out hôm nay rồi");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // CHECK-OUT
    // ═════════════════════════════════════════════════════════════════════════════
    if (existing) {
        if (qrCode) _verifyQRCode(qrCode, existing.jobId, now);

        const job = existing.job;
        const { isFraud, fraudReason, distance } = _checkGPSFraud(
            latitude, longitude, job, "Check-out", existing.isFraud, existing.fraudReason
        );

        let type = existing.type;
        if (job) type = _resolveCheckOutType(now, existing.type, job);

        const checkOutMeta = _buildMeta({ latitude, longitude, distance, ipAddress, deviceId, qrCode });

        const data = await attendanceRepository.update(existing.id, {
            checkOutAt: now,
            checkOutMeta,
            type,
            isFraud,
            ...(fraudReason ? { fraudReason } : {}),
        });

        return { action: "CHECK_OUT", data };
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // CHECK-IN
    // ═════════════════════════════════════════════════════════════════════════════
    let job = null;
    if (jobId) {
        job = await _requireJob(jobId);
        await _requireApprovedParticipant(userId, jobId);
    }

    if (qrCode) _verifyQRCode(qrCode, jobId, now);

    const { isFraud, fraudReason, distance } = _checkGPSFraud(latitude, longitude, job, "Check-in");

    // Xác định loại chấm công
    let type = "PRESENT";
    if (job) {
        const diffMinutes = _minutesDiff(now, job.workStartTime);
        if (diffMinutes < -job.earlyCheckInMinutes) {
            throw new UnprocessableError(
                `Chưa đến giờ check-in. Vui lòng check-in sau ${job.earlyCheckInMinutes} phút trước giờ làm`
            );
        }
        if (diffMinutes > job.lateCheckInMinutes) type = "LATE";
    }

    const checkInMeta = _buildMeta({ latitude, longitude, distance, ipAddress, deviceId, qrCode });

    const record = await attendanceRepository.create({
        userId,
        ...(jobId ? { jobId } : {}),
        date: now,
        type,
        status: PENDING,
        checkInAt: now,
        checkInMeta,
        isFraud,
        ...(fraudReason ? { fraudReason } : {}),
    });

    // Thông báo manager (bất đồng bộ)
    if (job) {
        notificationService
            .sendToJobManagers?.({
                jobId,
                title: isFraud ? "⚠️ Cảnh báo gian lận chấm công" : "📍 Nhân viên vừa check-in",
                content: isFraud
                    ? `Phát hiện check-in bất thường của nhân viên lúc ${_formatDate(now)}. Lý do: ${fraudReason}`
                    : `Một nhân viên vừa check-in công việc lúc ${now.toLocaleTimeString("vi-VN")}.`,
                type: "SYSTEM",
                refType: "ATTENDANCE",
                refId: record.id,
            })
            .catch((err) => console.error("[Notification] Gửi thông báo check-in thất bại:", err.message));
    }

    return { action: "CHECK_IN", data: record };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN / MANAGER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Admin tạo bản ghi chấm công thủ công cho nhân viên.
 *
 * @param {object} dto - CreateAttendanceDtoType
 * @returns {Promise<object>}
 * @throws {ConflictError} Nếu ngày đó đã có bản ghi
 */
const createAttendanceManual = async (dto) => {
    const existing = await attendanceRepository.findByUserAndDate(dto.userId, dto.date);
    if (existing) {
        throw new ConflictError("Đã tồn tại bản ghi chấm công cho ngày này");
    }

    return attendanceRepository.create(dto);
};

/**
 * Admin / Manager chỉnh sửa thủ công một bản ghi chấm công.
 *
 * @param {object} params
 * @param {string}  params.id  - ID bản ghi
 * @param {object}  params.dto - UpdateAttendanceDtoType
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const updateAttendance = async ({ id, dto }) => {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError("Không tìm thấy bản ghi chấm công");

    return attendanceRepository.update(id, dto);
};

/**
 * Manager / Admin duyệt hoặc từ chối bản ghi chấm công.
 * Tự động gửi thông báo in-app đến nhân viên.6
 *
 * @param {object}  params
 * @param {string}  params.id     - ID bản ghi
 * @param {string}  params.status - "APPROVED" | "REJECTED"
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 * @throws {BadRequestError} Nếu không ở trạng thái PENDING
 */
const reviewAttendance = async ({ id, status }) => {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError("Không tìm thấy bản ghi chấm công");
    if (record.status !== PENDING) {
        throw new BadRequestError(`Bản ghi đã được xử lý với trạng thái ${record.status}`);
    }

    const updated = await attendanceRepository.updateStatus(id, status);

    // Thông báo nhân viên (bất đồng bộ)
    notificationService
        .send({
            userId: record.userId,
            title:
                status === APPROVED
                    ? "Chấm công được duyệt ✅"
                    : "Chấm công bị từ chối ❌",
            content:
                status === APPROVED
                    ? `Bản ghi chấm công ngày ${_formatDate(record.date)} của bạn đã được xác nhận.`
                    : `Bản ghi chấm công ngày ${_formatDate(record.date)} của bạn không được chấp nhận.`,
            type: "APPROVAL",
            refType: "ATTENDANCE",
            refId: id,
        })
        .catch((err) =>
            console.error("[Notification] Gửi thông báo duyệt chấm công thất bại:", err.message)
        );

    return updated;
};

/**
 * Đánh dấu (hoặc bỏ đánh dấu) gian lận cho một bản ghi chấm công.
 *
 * @param {object}  params
 * @param {string}  params.id           - ID bản ghi
 * @param {boolean} params.isFraud
 * @param {string}  [params.fraudReason]
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const markFraud = async ({ id, isFraud, fraudReason }) => {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError("Không tìm thấy bản ghi chấm công");

    return attendanceRepository.markFraud(id, isFraud, fraudReason ?? null);
};

/**
 * Xóa một bản ghi chấm công (admin).
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
const deleteAttendance = async (id) => {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError("Không tìm thấy bản ghi chấm công");
    return attendanceRepository.remove(id);
};

/**
 * Tạo/Rotate mã QR cho một công việc.
 *
 * @param {string} jobId
 * @param {number} [expiresInMs=5000] - Thời gian hết hạn QR (ms), mặc định 5 giây
 * @returns {Promise<object>}
 */
const generateJobQRCode = async (jobId, expiresInMs = 5000) => {
    await _requireJob(jobId);

    const iat = Date.now();
    const exp = iat + expiresInMs;

    const payload = JSON.stringify({ jobId, iat, exp });
    const qrCode = encryptAES(payload);

    return { jobId, qrCode, iat, exp };
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const attendanceService = {
    // Query
    getAttendanceById,
    generateJobQRCode,
    getAttendancesByUserId,
    getAttendancesByUserIdCursor,
    getAttendancesByJobId,
    getAttendancesByJobIdCursor,
    getAttendancesByDateRange,
    getFraudulentAttendances,

    // Check-in / Check-out
    checkInOut,

    // Admin / Manager
    createAttendanceManual,
    updateAttendance,
    reviewAttendance,
    markFraud,
    deleteAttendance,
};
