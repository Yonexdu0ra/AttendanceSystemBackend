import {   Router   } from "express";
import * as sessionController from "../../controllers/session.controller.js";
import * as deviceController from "../../controllers/user-device.controller.js";
import * as profileController from "../../controllers/profile.controller.js";
import {   authenticate   } from "../../middlewares/index.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Profile
 *     description: Hồ sơ người dùng
 *   - name: Sessions
 *     description: Quản lý phiên đăng nhập
 *   - name: Devices
 *     description: Quản lý thiết bị
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /me/profile:
 *   get:
 *     summary: Lấy hồ sơ cá nhân
 *     tags: [Profile]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Profile' }
 */
router.get("/profile", authenticate, profileController.getMyProfile);

/**
 * @swagger
 * /me/profile:
 *   put:
 *     summary: Cập nhật hồ sơ cá nhân
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               address:  { type: string }
 *               bio:      { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/profile", authenticate, profileController.update);

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /me/sessions:
 *   get:
 *     summary: Lấy danh sách phiên đăng nhập
 *     tags: [Sessions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/sessions", authenticate, sessionController.list);

/**
 * @swagger
 * /me/sessions/logout:
 *   delete:
 *     summary: Đăng xuất khỏi thiết bị hiện tại
 *     tags: [Sessions]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId: { type: string, description: ID thiết bị để xóa FCM token }
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.delete("/sessions/logout", authenticate, sessionController.logout);

/**
 * @swagger
 * /me/sessions/logout-all:
 *   delete:
 *     summary: Đăng xuất khỏi tất cả thiết bị
 *     tags: [Sessions]
 *     responses:
 *       200:
 *         description: Đăng xuất tất cả thành công
 */
router.delete("/sessions/logout-all", authenticate, sessionController.logoutAll);

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /me/devices:
 *   get:
 *     summary: Lấy danh sách thiết bị đã đăng ký
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/devices", authenticate, deviceController.list);

/**
 * @swagger
 * /me/devices/{deviceId}/fcm-token:
 *   put:
 *     summary: Cập nhật FCM token của thiết bị
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/devices/:deviceId/fcm-token", authenticate, deviceController.updateFcmToken);

/**
 * @swagger
 * /me/devices/{deviceId}:
 *   delete:
 *     summary: Xóa một thiết bị
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete("/devices/:deviceId", authenticate, deviceController.remove);

export default router;
