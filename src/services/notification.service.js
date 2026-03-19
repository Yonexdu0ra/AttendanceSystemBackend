import {   notificationRepository   } from "../repositories/index.js";
import {   userDeviceService   } from "./user-device.service.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {   NotFoundError, ForbiddenError   } from "../utils/errors.js";
import {   client as redisClient, redisPub   } from "../configs/redisClient.js";

// ═══════════════════════════════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lấy chi tiết một thông báo theo ID.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 * @throws {NotFoundError} Nếu không tìm thấy
 */
const getById = async (id) => {
    const notification = await notificationRepository.findById(id);
    if (!notification) throw new NotFoundError("Không tìm thấy thông báo");
    return notification;
};

/**
 * Lấy danh sách tất cả thông báo (dành cho admin/manager).
 * Hỗ trợ lọc, phân trang offset.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
const list = async (params) => {};

/**
 * Lấy danh sách thông báo của một người dùng với offset pagination (web).
 *
 * @param {string}  userId
 * @param {object}  params
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=20]
 * @param {boolean} [params.isRead]   - Lọc theo trạng thái đã đọc / chưa đọc
 * @returns {Promise<object>} Danh sách thông báo kèm metadata phân trang
 */
const listByUser = async (userId, params = {}) => {
    const { page = 1, limit = 20, isRead } = params;
    const { skip, take } = buildOffsetClause(page, limit);

    const where = { userId, ...(isRead !== undefined ? { isRead } : {}) };

    const [data, total] = await Promise.all([
        notificationRepository.findByUserId({ userId, skip, take, isRead }),
        notificationRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

/**
 * Lấy danh sách thông báo của người dùng với cursor pagination (mobile).
 *
 * @param {string}  userId
 * @param {object}  params
 * @param {string}  [params.cursor]
 * @param {number}  [params.limit=20]
 * @param {boolean} [params.isRead]
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: string | null }>}
 */
const listByUserCursor = async (userId, params = {}) => {
    const { cursor, limit = 20, isRead } = params;
    const raw = await notificationRepository.findByUserIdCursor({
        userId,
        cursor,
        take: limit,
        isRead,
    });
    return parseCursorResult(raw, limit);
};

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Đếm tổng số thông báo theo bộ lọc (dành cho admin/manager).
 *
 * @param {object} filter - Prisma where clause
 * @returns {Promise<number>}
 */
const count = async (filter) => {};

/**
 * Đếm số thông báo của một người dùng theo bộ lọc.
 *
 * @param {string} userId
 * @param {object} filter - Bộ lọc bổ sung (VD: { isRead: false })
 * @returns {Promise<number>}
 */
const countByUser = async (userId, filter) => {};

/**
 * Trả về số lượng thông báo chưa đọc của người dùng.
 * Kết quả được cache trong Redis 60 giây.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
const countUnreadByUser = async (userId) => {
    const cacheKey = `notif:unread:${userId}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached !== null) return parseInt(cached, 10);
    } catch (_) { /* Redis không bắt buộc */ }

    const total = await notificationRepository.countUnread(userId);

    try {
        await redisClient.setEx(cacheKey, 60, String(total));
    } catch (_) { }

    return total;
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cập nhật thông báo theo ID (dành cho admin/manager).
 *
 * @param {string} id
 * @param {object} data - Dữ liệu cần cập nhật
 * @returns {Promise<object>}
 */
const updateById = async (id, data) => {};

/**
 * Cập nhật hàng loạt thông báo theo userId (dành cho admin/manager).
 *
 * @param {string} userId
 * @param {object} data - Dữ liệu cần cập nhật
 * @returns {Promise<{ count: number }>}
 */
const updateByUser = async (userId, data) => {};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION (business logic)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Đánh dấu một thông báo là đã đọc theo ID.
 * Tránh IDOR bằng cách kiểm tra quyền sở hữu.
 *
 * @param {string} id       - ID thông báo cần đánh dấu
 * @param {string} [userId] - ID người dùng thực hiện (kiểm tra quyền)
 * @returns {Promise<{ count: number }>}
 * @throws {NotFoundError}  Nếu không tìm thấy
 * @throws {ForbiddenError} Nếu thông báo không thuộc về userId
 */
const markRead = async (id, userId) => {
    const notification = await notificationRepository.findById(id);
    if (!notification) throw new NotFoundError("Không tìm thấy thông báo");
    if (userId && notification.userId !== userId) {
        throw new ForbiddenError("Bạn không có quyền thực hiện thao tác này");
    }
    const result = await notificationRepository.markManyAsRead([id], notification.userId);
    _invalidateUnreadCache(notification.userId);
    return result;
};

/**
 * Đánh dấu tất cả thông báo chưa đọc của người dùng là đã đọc.
 *
 * @param {string} userId
 * @returns {Promise<{ count: number }>} Số bản ghi được cập nhật
 */
const markAllReadByUser = async (userId) => {
    const result = await notificationRepository.markAllAsRead(userId);
    _invalidateUnreadCache(userId);
    return result;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Xóa một thông báo theo ID.
 * Tránh IDOR bằng cách kiểm tra quyền sở hữu.
 *
 * @param {string} id       - ID thông báo cần xóa
 * @param {string} [userId] - ID người dùng thực hiện (kiểm tra quyền, bỏ qua nếu admin)
 * @returns {Promise<object>} Thông báo vừa bị xóa
 * @throws {NotFoundError}  Nếu không tìm thấy
 * @throws {ForbiddenError} Nếu thông báo không thuộc về userId
 */
const removeById = async (id, userId) => {
    const notification = await notificationRepository.findById(id);
    if (!notification) throw new NotFoundError("Không tìm thấy thông báo");
    if (userId && notification.userId !== userId) {
        throw new ForbiddenError("Bạn không có quyền xóa thông báo này");
    }
    _invalidateUnreadCache(notification.userId);
    return notificationRepository.remove(id);
};

/**
 * Xóa toàn bộ thông báo đã đọc của người dùng.
 *
 * @param {string} userId
 * @returns {Promise<{ count: number }>} Số thông báo đã xóa
 */
const removeByUser = async (userId) => {
    return notificationRepository.removeAllRead(userId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN ACTION (quan trọng nhất)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tạo thông báo in-app cho một người dùng và tùy chọn gửi push notification.
 *
 * @param {string}  userId
 * @param {object}  payload
 * @param {string}  payload.title     - Tiêu đề
 * @param {string}  payload.content   - Nội dung
 * @param {string}  payload.type      - NotificationType
 * @param {string}  [payload.refType] - Loại đối tượng liên kết (redirect)
 * @param {string}  [payload.refId]   - ID đối tượng liên kết
 * @param {boolean} [payload.push=true] - Có gửi push notification không
 * @returns {Promise<object>} Thông báo vừa được tạo
 */
const sendToUser = async (userId, payload = {}) => {
    const { title, content, type, refType, refId, push = true } = payload;

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

/**
 * Tạo và gửi thông báo in-app cho nhiều người dùng cùng lúc.
 * Tùy chọn gửi kèm push notification.
 *
 * @param {string[]} userIds   - Danh sách người nhận
 * @param {object}   payload
 * @param {string}   payload.title
 * @param {string}   payload.content
 * @param {string}   payload.type      - NotificationType
 * @param {string}   [payload.refType]
 * @param {string}   [payload.refId]
 * @param {boolean}  [payload.push=true]
 * @returns {Promise<{ count: number }>} Số thông báo đã tạo
 */
const sendToUsers = async (userIds, payload = {}) => {
    const { title, content, type, refType, refId, push = true } = payload;

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
    // Read
    getById,
    list,
    listByUser,
    listByUserCursor,

    // Count
    count,
    countByUser,
    countUnreadByUser,

    // Update
    updateById,
    updateByUser,

    // Action
    markRead,
    markAllReadByUser,

    // Delete
    removeById,
    removeByUser,

    // Domain Action
    sendToUser,
    sendToUsers,
};

