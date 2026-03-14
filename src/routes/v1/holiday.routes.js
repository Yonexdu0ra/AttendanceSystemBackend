import {   Router   } from "express";
import * as holidayController from "../../controllers/holiday.controller.js";
import {   authenticate, authorize   } from "../../middlewares/index.js";
import {   validate   } from "../../middlewares/index.js";
import {   CreateHolidayDto, UpdateHolidayDto   } from "../../dtos/holiday.dto.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Holidays
 *   description: Quản lý ngày nghỉ lễ
 */

/**
 * @swagger
 * /holidays:
 *   get:
 *     summary: Lấy danh sách ngày nghỉ lễ
 *     tags: [Holidays]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Lọc theo năm
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Holiday' } }
 *                 meta: { $ref: '#/components/schemas/OffsetMeta' }
 */
router.get("/", holidayController.list);

/**
 * @swagger
 * /holidays/check:
 *   get:
 *     summary: Kiểm tra ngày có phải ngày nghỉ lễ không
 *     tags: [Holidays]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Ngày cần kiểm tra (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Kết quả kiểm tra
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     isHoliday: { type: boolean }
 */
router.get("/check", holidayController.checkDate);

/**
 * @swagger
 * /holidays/{id}:
 *   get:
 *     summary: Lấy chi tiết ngày nghỉ lễ
 *     tags: [Holidays]
 *     security: []
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
 *                 data: { $ref: '#/components/schemas/Holiday' }
 *       404:
 *         description: Không tìm thấy
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get("/:id", holidayController.getById);

/**
 * @swagger
 * /holidays:
 *   post:
 *     summary: Tạo ngày nghỉ lễ mới
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, date]
 *             properties:
 *               name:        { type: string }
 *               date:        { type: string, format: date }
 *               isPaid:      { type: boolean, default: true }
 *               type:        { type: string, enum: [NATIONAL, RELIGIOUS, CULTURAL, COMPANY, OTHER] }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *       409:
 *         description: Ngày đã tồn tại
 */
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), validate(CreateHolidayDto), holidayController.create);

/**
 * @swagger
 * /holidays/{id}:
 *   put:
 *     summary: Cập nhật ngày nghỉ lễ
 *     tags: [Holidays]
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
 *               name:        { type: string }
 *               date:        { type: string, format: date }
 *               isPaid:      { type: boolean }
 *               type:        { type: string, enum: [NATIONAL, RELIGIOUS, CULTURAL, COMPANY, OTHER] }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), validate(UpdateHolidayDto), holidayController.update);

/**
 * @swagger
 * /holidays/{id}:
 *   delete:
 *     summary: Xóa ngày nghỉ lễ
 *     tags: [Holidays]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), holidayController.remove);

export default router;
