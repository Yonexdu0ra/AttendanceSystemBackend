import { Router } from "express";
import * as attendanceController from "../../controllers/attendance.controller.js";
import { authenticate, authorize, validate } from "../../middlewares/index.js";
import {
    CheckInDto,
    CreateAttendanceDto,
    UpdateAttendanceDto,
    ReviewAttendanceDto,
    MarkFraudDto,
} from "../../dtos/attendance.dto.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Attendances
 *   description: Quản lý chấm công
 */

// ═══════════════════════════════════════════════════════════════════════════════
// NHÂN VIÊN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /attendances/my:
 *   get:
 *     summary: Lấy lịch sử chấm công của bản thân
 *     tags: [Attendances]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Cursor cho phân trang (mobile)
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PENDING, PRESENT, ABSENT, LATE, EARLY_LEAVE, AUTO_CHECKOUT, MISSING_CHECKIN, MISSING_CHECKOUT] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Attendance' } }
 *                 meta: { $ref: '#/components/schemas/OffsetMeta' }
 */
router.get("/my", authenticate, attendanceController.getMyAttendances);

/**
 * @swagger
 * /attendances/check:
 *   post:
 *     summary: Check-in hoặc Check-out (tự động xác định)
 *     description: |
 *       Endpoint gộp check-in và check-out. Hệ thống tự động xác định:
 *       - Chưa có bản ghi hôm nay → **CHECK-IN** (trả 201)
 *       - Đã check-in, chưa check-out → **CHECK-OUT** (trả 200)
 *       - Đã check-out → trả lỗi 409
 *     tags: [Attendances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               jobId:      { type: string, format: uuid }
 *               latitude:   { type: number, minimum: -90, maximum: 90 }
 *               longitude:  { type: number, minimum: -180, maximum: 180 }
 *               deviceId:   { type: string }
 *               ipAddress:  { type: string }
 *               qrCode:     { type: string, description: Mã QR đã mã hóa AES }
 *     responses:
 *       201:
 *         description: Check-in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 action:  { type: string, enum: [CHECK_IN, CHECK_OUT] }
 *                 data:    { $ref: '#/components/schemas/Attendance' }
 *       200:
 *         description: Check-out thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 action:  { type: string, enum: [CHECK_IN, CHECK_OUT] }
 *                 data:    { $ref: '#/components/schemas/Attendance' }
 *       409:
 *         description: Đã check-in và check-out hôm nay rồi
 *       422:
 *         description: Chưa đến giờ check-in
 */
router.post("/check", authenticate, validate(CheckInDto), attendanceController.checkInOut);

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER / ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /attendances/job/{jobId}:
 *   get:
 *     summary: Lấy danh sách chấm công theo công việc
 *     tags: [Attendances]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PENDING, PRESENT, ABSENT, LATE, EARLY_LEAVE, AUTO_CHECKOUT, MISSING_CHECKIN, MISSING_CHECKOUT] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Attendance' } }
 *                 meta: { $ref: '#/components/schemas/OffsetMeta' }
 */
router.get("/job/:jobId", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), attendanceController.getByJobId);

/**
 * @swagger
 * /attendances/date-range:
 *   get:
 *     summary: Lấy chấm công theo khoảng ngày
 *     tags: [Attendances]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: jobId
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PENDING, PRESENT, ABSENT, LATE, EARLY_LEAVE, AUTO_CHECKOUT, MISSING_CHECKIN, MISSING_CHECKOUT] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Attendance' } }
 *       400:
 *         description: Thiếu startDate hoặc endDate
 */
router.get("/date-range", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), attendanceController.getByDateRange);

/**
 * @swagger
 * /attendances/fraudulent:
 *   get:
 *     summary: Lấy danh sách bản ghi nghi ngờ gian lận
 *     tags: [Attendances]
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Attendance' } }
 *                 meta: { $ref: '#/components/schemas/OffsetMeta' }
 */
router.get("/fraudulent", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), attendanceController.getFraudulent);

/**
 * @swagger
 * /attendances/qr-code/{jobId}:
 *   post:
 *     summary: Tạo mã QR cho công việc
 *     tags: [Attendances]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresInMs:
 *                 type: integer
 *                 default: 5000
 *                 description: Thời gian hết hạn QR tính bằng ms (mặc định 5000 = 5 giây)
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:  { type: string }
 *                     qrCode: { type: string }
 *                     iat:    { type: integer }
 *                     exp:    { type: integer }
 *       404:
 *         description: Không tìm thấy công việc
 */
router.post("/qr-code/:jobId", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), attendanceController.generateQRCode);

/**
 * @swagger
 * /attendances:
 *   post:
 *     summary: Admin tạo bản ghi chấm công thủ công
 *     tags: [Attendances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date, type]
 *             properties:
 *               userId:       { type: string, format: uuid }
 *               jobId:        { type: string, format: uuid }
 *               date:         { type: string, format: date-time }
 *               type:         { type: string, enum: [PENDING, PRESENT, ABSENT, LATE, EARLY_LEAVE, AUTO_CHECKOUT, MISSING_CHECKIN, MISSING_CHECKOUT] }
 *               status:       { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED], default: PENDING }
 *               checkInAt:    { type: string, format: date-time }
 *               checkOutAt:   { type: string, format: date-time }
 *               isFraud:      { type: boolean, default: false }
 *               fraudReason:  { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *       409:
 *         description: Đã tồn tại bản ghi cho ngày này
 */
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), validate(CreateAttendanceDto), attendanceController.create);

/**
 * @swagger
 * /attendances/{id}:
 *   get:
 *     summary: Lấy chi tiết bản ghi chấm công
 *     tags: [Attendances]
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
 *                 data: { $ref: '#/components/schemas/Attendance' }
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:id", authenticate, attendanceController.getById);

/**
 * @swagger
 * /attendances/{id}:
 *   put:
 *     summary: Admin/Manager chỉnh sửa bản ghi chấm công
 *     tags: [Attendances]
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
 *               date:         { type: string, format: date-time }
 *               type:         { type: string, enum: [PENDING, PRESENT, ABSENT, LATE, EARLY_LEAVE, AUTO_CHECKOUT, MISSING_CHECKIN, MISSING_CHECKOUT] }
 *               status:       { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELED] }
 *               checkInAt:    { type: string, format: date-time }
 *               checkOutAt:   { type: string, format: date-time }
 *               isFraud:      { type: boolean }
 *               fraudReason:  { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy
 */
router.put("/:id", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(UpdateAttendanceDto), attendanceController.update);

/**
 * @swagger
 * /attendances/{id}/review:
 *   patch:
 *     summary: Duyệt hoặc từ chối bản ghi chấm công
 *     tags: [Attendances]
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
 *     responses:
 *       200:
 *         description: Duyệt thành công
 *       400:
 *         description: Bản ghi đã được xử lý
 *       404:
 *         description: Không tìm thấy
 */
router.patch("/:id/review", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(ReviewAttendanceDto), attendanceController.review);

/**
 * @swagger
 * /attendances/{id}/fraud:
 *   patch:
 *     summary: Đánh dấu / bỏ đánh dấu gian lận
 *     tags: [Attendances]
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
 *             required: [isFraud]
 *             properties:
 *               isFraud:     { type: boolean }
 *               fraudReason: { type: string, description: Bắt buộc khi isFraud=true }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy
 */
router.patch("/:id/fraud", authenticate, authorize("MANAGER", "ADMIN", "SUPER_ADMIN"), validate(MarkFraudDto), attendanceController.markFraud);

/**
 * @swagger
 * /attendances/{id}:
 *   delete:
 *     summary: Xóa bản ghi chấm công
 *     tags: [Attendances]
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
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), attendanceController.remove);

export default router;
