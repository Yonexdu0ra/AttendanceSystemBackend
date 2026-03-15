import {   notificationRepository   } from "../repositories/index.js";
import {   userDeviceService   } from "./user-device.service.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {   NotFoundError, ForbiddenError   } from "../utils/errors.js";
import {   client as redisClient, redisPub   } from "../configs/redisClient.js";

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lấy thông báo của user (offset pagination) ───────────────────────────────
/**
 * Lấy danh sách thông báo của một người dùng với offset pagination (web).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {boolean} [params.isRead]   - Lọc theo trạng thái đã đọc / chưa đọc
 * @returns {Promise<object>} Danh sách thông báo kèm metadata phân trang
 */
const getNotifications = async ({ userId, page = 1, limit = 20, isRead } = {}) => {
    const { skip, take } = buildOffsetClause(page, limit);

    const where = { userId, ...(isRead !== undefined ? { isRead } : {}) };

    const [data, total] = await Promise.all([
        notificationRepository.findByUserId({ userId, skip, take, isRead }),
        notificationRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy thông báo của user (cursor pagination) ───────────────────────────────
/**
 * Lấy danh sách thông báo với cursor pagination (mobile).
 *
 * @param {object}  params
 * @param {string}  params.userId
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {boolean} [params.isRead]
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: string | null }>}
 */
const getNotificationsCursor = async ({ userId, cursor, limit = 20, isRead } = {}) => {
    const raw = await notificationRepository.findByUserIdCursor({
        userId,
        cursor,
        take: limit,
        isRead,
    });
    return parseCursorResult(raw, limit);
};

// ─── Đếm số thông báo chưa đọc ───────────────────────────────────────────────
/**
 * Trả về số lượng thông báo chưa đọc của người dùng.
 * Kết quả được cache trong Redis 60 giây.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
const countUnread = async (userId) => {
    const cacheKey = `notif:unread:${userId}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached !== null) return parseInt(cached, 10);
    } catch (_) { /* Redis không bắt buộc */ }

    const count = await notificationRepository.countUnread(userId);

    try {
        await redisClient.setEx(cacheKey, 60, String(count));
    } catch (_) { }

    return count;
};

// ═══════════════════════════════════════════════════════════════════════════════
// GỬI THÔNG BÁO
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Gửi thông báo cho 1 người ────────────────────────────────────────────────
/**
 * Tạo thông báo in-app cho một người dùng và tùy chọn gửi push notification.
 *
 * @param {object}  dto
 * @param {string}  dto.userId    - Người nhận
 * @param {string}  dto.title     - Tiêu đề
 * @param {string}  dto.content   - Nội dung
 * @param {string}  dto.type      - NotificationType
 * @param {string}  [dto.refType] - Loại đối tượng liên kết (redirect)
 * @param {string}  [dto.refId]   - ID đối tượng liên kết
 * @param {boolean} [dto.push=true] - Có gửi push notification không
 * @returns {Promise<object>} Thông báo vừa được tạo
 */
const send = async ({ userId, title, content, type, refType, refId, push = true }) => {
    const notification = await notificationRepository.create({
        userId,
        title,
        content,
        type,
        refType,
        refId,
    });

    // Xóa cache unread count
    _invalidateUnreadCache(userId);

    // Gửi real-time qua WebSocket thông qua Redis pub/sub
    _publishToRedis(`notification:${userId}`, notification).catch(() => { });

    // Gửi push notification (bất đồng bộ, không block)
    if (push) {
        _sendPush([userId], { title, content, refType, refId }).catch((err) =>
            console.error("[Push] Gửi push notification thất bại:", err.message)
        );
    }

    return notification;
};

// ─── Gửi thông báo cho nhiều người (broadcast) ───────────────────────────────
/**
 * Tạo và gửi thông báo in-app cho nhiều người dùng cùng lúc.
 * Tùy chọn gửi kèm push notification.
 *
 * @param {object}    dto
 * @param {string[]}  dto.userIds   - Danh sách người nhận
 * @param {string}    dto.title
 * @param {string}    dto.content
 * @param {string}    dto.type      - NotificationType
 * @param {string}    [dto.refType]
 * @param {string}    [dto.refId]
 * @param {boolean}   [dto.push=true]
 * @returns {Promise<{ count: number }>} Số thông báo đã tạo
 */
const broadcast = async ({ userIds, title, content, type, refType, refId, push = true }) => {
    const records = userIds.map((userId) => ({
        userId,
        title,
        content,
        type,
        ...(refType && { refType }),
        ...(refId && { refId }),
    }));

    const result = await notificationRepository.createMany(records);

    // Xóa cache unread của tất cả người nhận (bất đồng bộ)
    userIds.forEach((uid) => _invalidateUnreadCache(uid));

    // Gửi real-time qua WebSocket thông qua Redis pub/sub (bất đồng bộ)
    // Lấy từng bản ghi thông báo riêng lẻ không khả thi qua createMany,
    // nên publish payload chung cho mỗi user.
    userIds.forEach((uid) => {
        const record = { userId: uid, title, content, type, refType, refId };
        _publishToRedis(`notification:${uid}`, record).catch(() => { });
    });

    // Gửi push notification (bất đồng bộ)
    if (push) {
        _sendPush(userIds, { title, content, refType, refId }).catch((err) =>
            console.error("[Push] Broadcast push thất bại:", err.message)
        );
    }

    return result;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ĐỌC / XÓA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Đánh dấu nhiều thông báo là đã đọc ──────────────────────────────────────
/**
 * Đánh dấu các thông báo được chỉ định là đã đọc.
 * Chỉ cập nhật những thông báo thuộc về userId (tránh IDOR).
 *
 * @param {string}   userId          - ID người dùng thực hiện
 * @param {string[]} notificationIds - Danh sách ID thông báo cần đánh dấu
 * @returns {Promise<{ count: number }>} Số bản ghi được cập nhật
 */
const markAsRead = async (userId, notificationIds) => {
    const result = await notificationRepository.markManyAsRead(notificationIds, userId);
    _invalidateUnreadCache(userId);
    return result;
};

// ─── Đánh dấu tất cả là đã đọc ───────────────────────────────────────────────
/**
 * Đánh dấu tất cả thông báo chưa đọc của người dùng là đã đọc.
 *
 * @param {string} userId
 * @returns {Promise<{ count: number }>} Số bản ghi được cập nhật
 */
const markAllAsRead = async (userId) => {
    const result = await notificationRepository.markAllAsRead(userId);
    _invalidateUnreadCache(userId);
    return result;
};

// ─── Xóa 1 thông báo ─────────────────────────────────────────────────────────
/**
 * Xóa một thông báo. Kiểm tra quyền sở hữu trước khi xóa.
 *
 * @param {string} userId         - ID người dùng thực hiện (kiểm tra quyền)
 * @param {string} notificationId - ID thông báo cần xóa
 * @returns {Promise<object>} Thông báo vừa bị xóa
 * @throws {NotFoundError}  Nếu không tìm thấy
 * @throws {ForbiddenError} Nếu thông báo không thuộc về userId
 */
const remove = async (userId, notificationId) => {
    const notification = await notificationRepository.findById(notificationId);
    if (!notification) {
        throw new NotFoundError("Không tìm thấy thông báo");
    }
    if (notification.userId !== userId) {
        throw new ForbiddenError("Bạn không có quyền xóa thông báo này");
    }

    _invalidateUnreadCache(userId);
    return notificationRepository.remove(notificationId);
};

// ─── Xóa tất cả thông báo đã đọc ────────────────────────────────────────────
/**
 * Xóa toàn bộ thông báo đã đọc của người dùng.
 *
 * @param {string} userId
 * @returns {Promise<{ count: number }>} Số thông báo đã xóa
 */
const removeAllRead = async (userId) => {
    return notificationRepository.removeAllRead(userId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Xóa cache unread count của user trong Redis.
 * Bất đồng bộ, không throw nếu Redis lỗi.
 */
const _invalidateUnreadCache = (userId) => {
    redisClient.del(`notif:unread:${userId}`).catch(() => { });
};

/**
 * Publish một sự kiện thông báo lên Redis pub/sub để Socket.io
 * forward tới client đang kết nối.
 *
 * @param {string} channel  - Tên channel Redis, ví dụ: `notification:${userId}`
 * @param {object} payload  - Dữ liệu cần gửi (sẽ được JSON.stringify)
 * @returns {Promise<void>}
 */
const _publishToRedis = (channel, payload) => {
    return redisPub.publish(channel, JSON.stringify(payload));
};

/**
 * Gửi push notification tới danh sách userIds qua FCM.
 * Không throw — lỗi được log ra console.
 *
 * @param {string[]} userIds
 * @param {{ title: string, content: string, refType?: string, refId?: string }} payload
 */
const _sendPush = async (userIds, { title, content, refType, refId }) => {
    const tokens = await userDeviceService.getFcmTokensByUserIds(userIds);
    if (!tokens.length) return;

    // Gửi từng token thông qua Firebase Admin SDK
    // (Firebase Admin phải được khởi tạo trong configs)
    const { default: admin } = await import("firebase-admin").catch(() => ({ default: null }));
    if (!admin?.messaging) {
        console.warn("[Push] Firebase Admin chưa được khởi tạo — bỏ qua push notification");
        return;
    }

    const messages = tokens.map(({ fcmToken, platform }) => ({
        token: fcmToken,
        notification: { title, body: content },
        data: {
            ...(refType && { refType }),
            ...(refId && { refId }),
        },
        // Cấu hình riêng theo platform
        ...(platform === "iOS" && {
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
        }),
        ...(platform === "Android" && {
            android: { priority: "high" },
        }),
    }));

    const response = await admin.messaging().sendEach(messages);
    const failed = response.responses.filter((r) => !r.success).length;
    if (failed > 0) {
        console.warn(`[Push] ${failed}/${messages.length} push notification gửi thất bại`);
    }
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const notificationService = {
    // Query
    getNotifications,
    getNotificationsCursor,
    countUnread,

    // Gửi
    send,
    broadcast,

    // Đọc / Xóa
    markAsRead,
    markAllAsRead,
    remove,
    removeAllRead,
};

