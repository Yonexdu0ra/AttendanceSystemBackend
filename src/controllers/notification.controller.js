import {   notificationService   } from "../services/index.js";

export const list = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isRead, cursor, mode = "offset" } = req.query;
        if (mode === "cursor") {
            const result = await notificationService.listByUserCursor(req.user.id, {
                cursor,
                limit: Number(limit),
                isRead: isRead !== undefined ? isRead === "true" : undefined,
            });
            return res.json({ success: true, ...result });
        }
        const result = await notificationService.listByUser(req.user.id, {
            page: Number(page),
            limit: Number(limit),
            isRead: isRead !== undefined ? isRead === "true" : undefined,
        });
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
};

export const countUnread = async (req, res, next) => {
    try {
        const count = await notificationService.countUnreadByUser(req.user.id);
        res.json({ success: true, data: { count } });
    } catch (err) { next(err); }
};

export const markAsRead = async (req, res, next) => {
    try {
        const { notificationIds } = req.body;
        const results = await Promise.all(
            notificationIds.map((id) => notificationService.markRead(id, req.user.id))
        );
        res.json({ success: true, data: { count: results.length } });
    } catch (err) { next(err); }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        const result = await notificationService.markAllReadByUser(req.user.id);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
    try {
        await notificationService.removeById(req.params.id, req.user.id);
        res.json({ success: true, message: "Đã xóa thông báo" });
    } catch (err) { next(err); }
};

export const removeAllRead = async (req, res, next) => {
    try {
        const result = await notificationService.removeByUser(req.user.id);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

