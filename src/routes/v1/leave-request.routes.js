import {   Router   } from "express";
import * as leaveController from "../../controllers/leave-request.controller.js";
import {   authenticate, authorize   } from "../../middlewares/index.js";
import {   validate   } from "../../middlewares/index.js";
import {   CreateLeaveRequestDto, UpdateLeaveRequestDto, ReviewLeaveRequestDto   } from "../../dtos/leave-request.dto.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: LeaveRequests
 *   description: Quản lý đơn xin nghỉ
 */

/**
 * @swagger
 * /leave-requests:
 *   get:
 *     summary: Lấy danh sách đơn xin nghỉ của bản thân
 *     tags: [LeaveRequests]
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/LeaveRequest' } }
 */
router.get("/", authenticate, leaveController.list);

/**
 * @swagger
 * /leave-requests/admin:
 *   get:
 *     summary: Lấy tất cả đơn xin nghỉ (Admin)
 *     tags: [LeaveRequests]
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
 *       - in: query
 *         name: leaveType
 *         schema: { type: string, enum: [SICK, VACATION, PERSONAL, OTHER] }
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
router.get("/admin", authenticate, authorize("ADMIN", "SUPER_ADMIN"), leaveController.listAll);

/**
 * @swagger
 * /leave-requests/job/{jobId}:
 *   get:
 *     summary: Lấy đơn xin nghỉ theo job (Manager/Admin)
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/job/:jobId", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), leaveController.listByJob);

/**
 * @swagger
 * /leave-requests/{id}:
 *   get:
 *     summary: Lấy chi tiết đơn xin nghỉ
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:id", authenticate, leaveController.getById);

/**
 * @swagger
 * /leave-requests:
 *   post:
 *     summary: Tạo đơn xin nghỉ
 *     tags: [LeaveRequests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startDate, endDate]
 *             properties:
 *               jobId:     { type: string }
 *               startDate: { type: string, format: date }
 *               endDate:   { type: string, format: date }
 *               leaveType: { type: string, enum: [SICK, VACATION, PERSONAL, OTHER], default: OTHER }
 *               reason:    { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *       422:
 *         description: Dữ liệu không hợp lệ
 */
router.post("/", authenticate, validate(CreateLeaveRequestDto), leaveController.create);

/**
 * @swagger
 * /leave-requests/{id}:
 *   put:
 *     summary: Cập nhật đơn xin nghỉ (chỉ khi PENDING)
 *     tags: [LeaveRequests]
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
 *               startDate: { type: string, format: date }
 *               endDate:   { type: string, format: date }
 *               leaveType: { type: string, enum: [SICK, VACATION, PERSONAL, OTHER] }
 *               reason:    { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Không thể sửa khi không ở trạng thái PENDING
 */
router.put("/:id", authenticate, validate(UpdateLeaveRequestDto), leaveController.update);

/**
 * @swagger
 * /leave-requests/{id}/cancel:
 *   patch:
 *     summary: Hủy đơn xin nghỉ (chỉ khi PENDING)
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Hủy thành công
 */
router.patch("/:id/cancel", authenticate, leaveController.cancel);

/**
 * @swagger
 * /leave-requests/{id}/review:
 *   patch:
 *     summary: Duyệt hoặc từ chối đơn xin nghỉ (Manager/Admin)
 *     tags: [LeaveRequests]
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
router.patch("/:id/review", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(ReviewLeaveRequestDto), leaveController.review);

/**
 * @swagger
 * /leave-requests/{id}:
 *   delete:
 *     summary: Xóa đơn xin nghỉ (Admin)
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), leaveController.remove);

export default router;
