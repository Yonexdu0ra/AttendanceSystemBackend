import {   Router   } from "express";
import * as jobController from "../../controllers/job.controller.js";
import {   authenticate, authorize   } from "../../middlewares/index.js";
import {   validate   } from "../../middlewares/index.js";
import {   CreateJobDto, UpdateJobDto   } from "../../dtos/job.dto.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Quản lý công việc và thành viên
 */

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: Lấy danh sách công việc
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm kiếm theo tiêu đề
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/Job' } }
 */
router.get("/", authenticate, jobController.list);

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Lấy chi tiết công việc
 *     tags: [Jobs]
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
router.get("/:id", authenticate, jobController.getById);

/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Tạo công việc mới
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, workStartTime, workEndTime, latitude, longitude]
 *             properties:
 *               title:               { type: string }
 *               description:         { type: string }
 *               address:             { type: string }
 *               workStartTime:       { type: string, example: "08:00" }
 *               workEndTime:         { type: string, example: "17:00" }
 *               earlyCheckInMinutes: { type: integer, default: 15 }
 *               lateCheckInMinutes:  { type: integer, default: 15 }
 *               earlyCheckOutMinutes: { type: integer, default: 15 }
 *               lateCheckOutMinutes: { type: integer, default: 15 }
 *               latitude:            { type: number }
 *               longitude:           { type: number }
 *               radius:              { type: number, default: 50 }
 *     responses:
 *       201:
 *         description: Tạo thành công, người tạo tự động thành manager
 */
router.post("/", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(CreateJobDto), jobController.create);

/**
 * @swagger
 * /jobs/{id}:
 *   put:
 *     summary: Cập nhật công việc (Manager/Admin)
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/:id", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(UpdateJobDto), jobController.update);

/**
 * @swagger
 * /jobs/{id}:
 *   delete:
 *     summary: Xóa công việc (Admin)
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), jobController.remove);

// ─── Manager ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /jobs/{id}/managers:
 *   get:
 *     summary: Lấy danh sách manager của job
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/:id/managers", authenticate, jobController.getManagers);

/**
 * @swagger
 * /jobs/{id}/managers:
 *   post:
 *     summary: Thêm manager vào job
 *     tags: [Jobs]
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
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *     responses:
 *       201:
 *         description: Thêm manager thành công
 *       409:
 *         description: Đã là manager
 */
router.post("/:id/managers", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), jobController.addManager);

/**
 * @swagger
 * /jobs/{id}/managers/{managerId}:
 *   delete:
 *     summary: Xóa manager khỏi job
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: managerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: Không thể xóa manager duy nhất
 */
router.delete("/:id/managers/:managerId", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), jobController.removeManager);

// ─── Participant ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /jobs/{id}/participants:
 *   get:
 *     summary: Lấy danh sách thành viên của job
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/:id/participants", authenticate, jobController.getParticipants);

/**
 * @swagger
 * /jobs/{id}/join:
 *   post:
 *     summary: Gửi yêu cầu tham gia job
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Đã gửi yêu cầu tham gia
 *       409:
 *         description: Đã tham gia hoặc đang chờ duyệt
 */
router.post("/:id/join", authenticate, jobController.requestJoin);

/**
 * @swagger
 * /jobs/{id}/leave:
 *   delete:
 *     summary: Rời khỏi job
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Đã rời job
 */
router.delete("/:id/leave", authenticate, jobController.leaveJob);

/**
 * @swagger
 * /jobs/{id}/participants:
 *   post:
 *     summary: Thêm trực tiếp thành viên vào job (Manager/Admin)
 *     tags: [Jobs]
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
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *     responses:
 *       201:
 *         description: Thêm thành công
 */
router.post("/:id/participants", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), jobController.addParticipant);

/**
 * @swagger
 * /jobs/{id}/participants/review:
 *   patch:
 *     summary: Duyệt hoặc từ chối yêu cầu tham gia (Manager/Admin)
 *     tags: [Jobs]
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
 *             required: [userId, status]
 *             properties:
 *               userId: { type: string }
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: Xử lý thành công
 */
router.patch("/:id/participants/review", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), jobController.reviewParticipation);

/**
 * @swagger
 * /jobs/{id}/participants/{userId}:
 *   delete:
 *     summary: Xóa thành viên khỏi job (Manager/Admin)
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete("/:id/participants/:userId", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), jobController.removeParticipant);

export default router;
