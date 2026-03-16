import {   Router   } from "express";
import * as authController from "../../controllers/auth.controller.js";
import {   authenticate   } from "../../middlewares/index.js";
import {   validate   } from "../../middlewares/index.js";
import {   LoginDto, ChangePasswordDto   } from "../../dtos/auth.dto.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Xác thực và quản lý phiên đăng nhập
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *               device:
 *                 type: object
 *                 properties:
 *                   deviceId:   { type: string }
 *                   platform:   { type: string }
 *                   deviceName: { type: string }
 *                   fcmToken:   { type: string }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:      { type: object }
 *                     token:     { type: string }
 *                     expiresAt: { type: string, format: date-time }
 *       401:
 *         description: Email hoặc mật khẩu không chính xác
 */
router.post("/login", validate(LoginDto), authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất session hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId: { type: string }
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Đăng xuất tất cả thiết bị
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất tất cả thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:         { type: boolean }
 *                 deletedSessions: { type: integer }
 */
router.post("/logout-all", authenticate, authController.logoutAll);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 6 }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       401:
 *         description: Mật khẩu hiện tại không chính xác
 */
router.post("/change-password", authenticate, validate(ChangePasswordDto), authController.changePassword);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Làm mới token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               device:
 *                 type: object
 *                 properties:
 *                   deviceId:   { type: string }
 *                   platform:   { type: string }
 *                   deviceName: { type: string }
 *                   fcmToken:   { type: string }
 *     responses:
 *       200:
 *         description: Làm mới token thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:     { type: string }
 *                     expiresAt: { type: string, format: date-time }
 */
router.post("/refresh", authenticate, authController.refreshSession);

export default router;
