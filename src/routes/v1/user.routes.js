import {   Router   } from "express";
import * as userController from "../../controllers/user.controller.js";
import {   authenticate, authorize   } from "../../middlewares/index.js";
import {   validate   } from "../../middlewares/index.js";
import {   CreateUserDto, UpdateUserDto   } from "../../dtos/user.dto.js";

const router = Router();

// Tất cả route yêu cầu ADMIN hoặc SUPER_ADMIN
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản lý người dùng (Admin)
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [EMPLOYEE, MANAGER, ADMIN, SUPER_ADMIN] }
 *         description: Lọc theo role
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo email, phone hoặc mã nhân viên
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/User' } }
 *                 meta: { $ref: '#/components/schemas/OffsetMeta' }
 */
router.get("/", userController.list);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Lấy chi tiết người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/User' }
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:id", userController.getById);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Tạo người dùng mới
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone, code, password]
 *             properties:
 *               email:            { type: string, format: email }
 *               phone:            { type: string }
 *               code:             { type: string }
 *               password:         { type: string, minLength: 6 }
 *               role:             { type: string, enum: [EMPLOYEE, MANAGER, ADMIN, SUPER_ADMIN], default: EMPLOYEE }
 *               biometricEnabled: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *       409:
 *         description: Email, phone hoặc mã nhân viên đã tồn tại
 */
router.post("/", validate(CreateUserDto), userController.create);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Cập nhật người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:            { type: string }
 *               code:             { type: string }
 *               role:             { type: string, enum: [EMPLOYEE, MANAGER, ADMIN, SUPER_ADMIN] }
 *               biometricEnabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy
 *       409:
 *         description: Phone hoặc mã nhân viên đã tồn tại
 */
router.put("/:id", validate(UpdateUserDto), userController.update);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Xóa người dùng (soft delete)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy
 */
router.delete("/:id", userController.remove);

export default router;
