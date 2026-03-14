import {   Router   } from "express";
import * as notifController from "../../controllers/notification.controller.js";
import {   authenticate   } from "../../middlewares/index.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Quản lý thông báo
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Lấy danh sách thông báo
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *         description: Lọc thông báo đã đọc / chưa đọc
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [offset, cursor], default: offset }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Cursor cho chế độ cursor pagination
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Notification' } }
 */
router.get("/", authenticate, notifController.list);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Đếm số thông báo chưa đọc
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer }
 */
router.get("/unread-count", authenticate, notifController.countUnread);

/**
 * @swagger
 * /notifications/mark-read:
 *   patch:
 *     summary: Đánh dấu các thông báo là đã đọc
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [notificationIds]
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.patch("/mark-read", authenticate, notifController.markAsRead);

/**
 * @swagger
 * /notifications/mark-all-read:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo là đã đọc
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch("/mark-all-read", authenticate, notifController.markAllAsRead);

/**
 * @swagger
 * /notifications/read:
 *   delete:
 *     summary: Xóa tất cả thông báo đã đọc
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.delete("/read", authenticate, notifController.removeAllRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Xóa một thông báo
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       403:
 *         description: Không có quyền
 */
router.delete("/:id", authenticate, notifController.remove);

export default router;
