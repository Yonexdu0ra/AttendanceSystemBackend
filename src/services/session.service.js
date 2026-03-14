import {   sessionRepository   } from "../repositories/index.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   NotFoundError, UnauthorizedError   } from "../utils/errors.js";
import {   userDeviceService   } from "./user-device.service.js";

// ─── Tạo session mới (sau khi đăng nhập thành công) ──────────────────────────
/**
 * Tạo một phiên đăng nhập mới cho người dùng.
 * Đồng thời upsert thông tin thiết bị vào bảng UserDevice.
 *
 * @param {object} params
 * @param {string}   params.userId    - ID người dùng
 * @param {string}   params.token     - JWT / refresh token
 * @param {Date}     params.expiresAt - Thời điểm hết hạn của token
 * @param {string}   params.ipAddress - Địa chỉ IP của client
 * @param {object}   [params.device]  - Thông tin thiết bị (nếu có)
 * @param {string}     params.device.deviceId   - ID thiết bị
 * @param {string}     params.device.platform   - Nền tảng (iOS / Android / Web)
 * @param {string}     [params.device.deviceName]
 * @param {string}     [params.device.fcmToken]
 * @returns {Promise<{ session: object, device: object | null }>}
 */
const createSession = async ({ userId, token, expiresAt, ipAddress, device }) => {
    const session = await sessionRepository.create({
        userId,
        token,
        expiresAt,
        ipAddress,
    });

    // Upsert thiết bị nếu có thông tin
    let deviceRecord = null;
    if (device?.deviceId) {
        deviceRecord = await userDeviceService.registerDevice({
            userId,
            deviceId: device.deviceId,
            platform: device.platform,
            deviceName: device.deviceName,
            fcmToken: device.fcmToken,
            ipAddress,
        });
    }

    return { session, device: deviceRecord };
};

// ─── Xác thực session theo token ──────────────────────────────────────────────
/**
 * Tìm và kiểm tra tính hợp lệ của một session theo token.
 * Trả về session kèm thông tin user.
 *
 * @param {string} token - Token cần xác thực
 * @returns {Promise<object>} Session kèm user
 * @throws {UnauthorizedError} Nếu token không tồn tại hoặc đã hết hạn
 */
const verifySession = async (token) => {
    const session = await sessionRepository.findByToken(token);

    if (!session) {
        throw new UnauthorizedError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }

    if (new Date(session.expiresAt) < new Date()) {
        // Tự động xóa session đã hết hạn
        await sessionRepository.deleteByToken(token).catch(() => { });
        throw new UnauthorizedError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
    }

    return session;
};

// ─── Lấy danh sách phiên của user (offset pagination) ────────────────────────
/**
 * Lấy danh sách tất cả phiên đăng nhập của một người dùng.
 *
 * @param {object} params
 * @param {string}  params.userId - ID người dùng
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @returns {Promise<object>} Danh sách session kèm metadata phân trang
 */
const getSessionsByUserId = async ({ userId, page = 1, limit = 20 }) => {
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        sessionRepository.findByUserId({ userId, skip, take }),
        sessionRepository.countByUserId(userId),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Đăng xuất thiết bị hiện tại ─────────────────────────────────────────────
/**
 * Đăng xuất khỏi thiết bị hiện tại bằng cách xóa session theo token.
 * Đồng thời xóa FCM token của thiết bị để ngừng nhận push notification.
 *
 * @param {object} params
 * @param {string}  params.token      - Token của session cần xóa
 * @param {string}  params.userId     - ID người dùng (để clear FCM token)
 * @param {string}  [params.deviceId] - ID thiết bị (nếu có để xóa FCM token)
 * @returns {Promise<void>}
 * @throws {NotFoundError} Nếu token không tồn tại
 */
const logout = async ({ token, userId, deviceId }) => {
    const session = await sessionRepository.findByToken(token);
    if (!session) {
        throw new NotFoundError("Phiên đăng nhập không tồn tại");
    }

    await Promise.all([
        sessionRepository.deleteByToken(token),
        deviceId ? userDeviceService.clearFcmToken(userId, deviceId) : Promise.resolve(),
    ]);
};

// ─── Đăng xuất tất cả thiết bị ───────────────────────────────────────────────
/**
 * Đăng xuất khỏi tất cả thiết bị của người dùng.
 * Xóa toàn bộ session và FCM token của tất cả thiết bị.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<{ deletedSessions: number }>}
 */
const logoutAll = async (userId) => {
    const [deleted] = await Promise.all([
        sessionRepository.deleteAllByUserId(userId),
        userDeviceService.clearAllFcmTokens(userId),
    ]);

    return { deletedSessions: deleted.count };
};

// ─── Xóa session đã hết hạn (cleanup / cron job) ─────────────────────────────
/**
 * Dọn dẹp tất cả session đã hết hạn trong database.
 * Thường được gọi bởi cron job định kỳ.
 *
 * @returns {Promise<{ deletedCount: number }>}
 */
const cleanupExpiredSessions = async () => {
    const result = await sessionRepository.deleteExpired();
    return { deletedCount: result.count };
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const sessionService = {
    createSession,
    verifySession,
    getSessionsByUserId,
    logout,
    logoutAll,
    cleanupExpiredSessions,
};

