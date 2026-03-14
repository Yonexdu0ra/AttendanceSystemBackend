import {   Router   } from "express";
import * as overtimeController from "../../controllers/overtime-request.controller.js";
import {   authenticate, authorize   } from "../../middlewares/index.js";
import {   validate   } from "../../middlewares/index.js";
import {   CreateOvertimeRequestDto, UpdateOvertimeRequestDto, ReviewOvertimeRequestDto   } from "../../dtos/overtime-request.dto.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: OvertimeRequests
 *   description: Quản lý đơn làm thêm giờ
 */

/**
 * @swagger
 * /overtime-requests:
 *   get:
 *     summary: Lấy danh sách đơn OT của bản thân
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [offset, cursor], default: offset }
 *       - in: query
 *         name: cursor
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/OvertimeRequest' } }
 */
router.get("/", authenticate, overtimeController.list);

/**
 * @swagger
 * /overtime-requests/admin:
 *   get:
 *     summary: Lấy tất cả đơn OT (Admin)
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: jobId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/admin", authenticate, authorize("ADMIN", "SUPER_ADMIN"), overtimeController.listAll);

/**
 * @swagger
 * /overtime-requests/job/{jobId}:
 *   get:
 *     summary: Lấy đơn OT theo job (Manager/Admin)
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/job/:jobId", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), overtimeController.listByJob);

/**
 * @swagger
 * /overtime-requests/{id}:
 *   get:
 *     summary: Lấy chi tiết đơn OT
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/:id", authenticate, overtimeController.getById);

/**
 * @swagger
 * /overtime-requests:
 *   post:
 *     summary: Tạo đơn làm thêm giờ
 *     tags: [OvertimeRequests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, startTime, endTime]
 *             properties:
 *               jobId:     { type: string }
 *               date:      { type: string, format: date, description: Ngày làm OT }
 *               startTime: { type: string, format: date-time }
 *               endTime:   { type: string, format: date-time }
 *               reason:    { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *       422:
 *         description: Trùng giờ với đơn OT khác hoặc dữ liệu không hợp lệ
 */
router.post("/", authenticate, validate(CreateOvertimeRequestDto), overtimeController.create);

/**
 * @swagger
 * /overtime-requests/{id}:
 *   put:
 *     summary: Cập nhật đơn OT (chỉ khi PENDING)
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:      { type: string, format: date }
 *               startTime: { type: string, format: date-time }
 *               endTime:   { type: string, format: date-time }
 *               reason:    { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/:id", authenticate, validate(UpdateOvertimeRequestDto), overtimeController.update);

/**
 * @swagger
 * /overtime-requests/{id}/cancel:
 *   patch:
 *     summary: Hủy đơn OT (chỉ khi PENDING)
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Hủy thành công
 */
router.patch("/:id/cancel", authenticate, overtimeController.cancel);

/**
 * @swagger
 * /overtime-requests/{id}/review:
 *   patch:
 *     summary: Duyệt hoặc từ chối đơn OT (Manager/Admin)
 *     tags: [OvertimeRequests]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               reply:  { type: string }
 *     responses:
 *       200:
 *         description: Xử lý thành công
 */
router.patch("/:id/review", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(ReviewOvertimeRequestDto), overtimeController.review);

/**
 * @swagger
 * /overtime-requests/{id}:
 *   delete:
 *     summary: Xóa đơn OT (Admin)
 *     tags: [OvertimeRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), overtimeController.remove);

export default router;
