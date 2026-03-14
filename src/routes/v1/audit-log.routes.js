import {   Router   } from "express";
import * as auditController from "../../controllers/audit-log.controller.js";
import {   authenticate, authorize   } from "../../middlewares/index.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AuditLogs
 *   description: Lịch sử thao tác hệ thống (Admin only)
 */

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Lấy danh sách audit log (Admin)
 *     tags: [AuditLogs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [SUCCESS, FAIL] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/AuditLog' } }
 */
router.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), auditController.list);

/**
 * @swagger
 * /audit-logs/user/{userId}:
 *   get:
 *     summary: Lấy audit log theo user (Admin)
 *     tags: [AuditLogs]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/user/:userId", authenticate, authorize("ADMIN", "SUPER_ADMIN"), auditController.getByUserId);

/**
 * @swagger
 * /audit-logs/resource/{resource}/{resourceId}:
 *   get:
 *     summary: Lấy audit log theo resource (Admin)
 *     tags: [AuditLogs]
 *     parameters:
 *       - in: path
 *         name: resource
 *         required: true
 *         schema: { type: string }
 *         description: Loại tài nguyên (User, Attendance, LeaveRequest...)
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/resource/:resource/:resourceId", authenticate, authorize("ADMIN", "SUPER_ADMIN"), auditController.getByResource);

export default router;
