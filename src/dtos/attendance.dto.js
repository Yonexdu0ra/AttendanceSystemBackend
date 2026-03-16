import {   z   } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const AttendanceTypeEnum = z.enum([
    "PENDING",
    "PRESENT",
    "ABSENT",
    "LATE",
    "EARLY_LEAVE",
    "AUTO_CHECKOUT",
    "MISSING_CHECKIN",
    "MISSING_CHECKOUT",
]);

export const AttendanceStatusEnum = z.enum([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELED",
]);

// ─── CheckIn Meta Schema ──────────────────────────────────────────────────────
// Cấu trúc JSON lưu thông tin thiết bị/vị trí khi check-in
const CheckInMetaSchema = z.object({
    // Tọa độ GPS khi check-in/check-out
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    // Khoảng cách đến địa điểm làm việc (mét)
    distance: z.number().min(0).optional(),
    // Địa chỉ IP của thiết bị
    ipAddress: z.string().optional(),
    // Thông tin thiết bị
    deviceId: z.string().optional(),
    platform: z.string().optional(),
    // Mã QR được quét khi check-in (nếu dùng chức năng quét QR)
    qrCode: z.string().optional(),
}).optional();

// ─── Create Attendance DTO (check-in) ────────────────────────────────────────
// Dùng khi nhân viên check-in hoặc hệ thống tự tạo bản ghi chấm công
export const CreateAttendanceDto = z.object({
    userId: z.uuid({ message: "userId không hợp lệ" }),

    jobId: z.uuid({ message: "jobId không hợp lệ" }).optional(),

    // Ngày chấm công (ISO date string hoặc Date)
    date: z.coerce.date({ message: "Ngày chấm công không hợp lệ" }),

    type: AttendanceTypeEnum,

    status: AttendanceStatusEnum.optional().default("PENDING"),

    // Thời điểm check-in (có thể null nếu là bản ghi ABSENT)
    checkInAt: z.coerce.date({ message: "Thời gian check-in không hợp lệ" }).optional(),

    checkOutAt: z.coerce.date({ message: "Thời gian check-out không hợp lệ" }).optional(),

    // Metadata thu thập khi check-in (vị trí GPS, thiết bị, ảnh)
    checkInMeta: CheckInMetaSchema,

    checkOutMeta: CheckInMetaSchema,

    isFraud: z.boolean().optional().default(false),

    fraudReason: z.string().optional(),
}).refine(
    (data) => {
        // Nếu có cả checkInAt và checkOutAt thì checkOut phải sau checkIn
        if (data.checkInAt && data.checkOutAt) {
            return data.checkOutAt > data.checkInAt;
        }
        return true;
    },
    {
        message: "Thời gian check-out phải sau thời gian check-in",
        path: ["checkOutAt"],
    }
);

// ─── Check-In DTO ─────────────────────────────────────────────────────────────
// Dùng khi nhân viên bấm check-in qua app
export const CheckInDto = z.object({
    jobId: z.uuid({ message: "jobId không hợp lệ" }).optional(),

    // Vị trí GPS khi check-in
    latitude: z
        .number()
        .min(-90, "Vĩ độ phải trong khoảng -90 đến 90")
        .max(90, "Vĩ độ phải trong khoảng -90 đến 90"),

    longitude: z
        .number()
        .min(-180, "Kinh độ phải trong khoảng -180 đến 180")
        .max(180, "Kinh độ phải trong khoảng -180 đến 180"),

    // Thông tin thiết bị
    deviceId: z.string().optional(),

    // Địa chỉ IP của thiết bị (server có thể tự lấy từ request, field này dự phòng)
    ipAddress: z.union([z.ipv4(), z.ipv6()], { message: "IP không hợp lệ" }).optional(),

    // Mã QR được quét (token mã hóa xác thực vị trí/ca làm)
    qrCode: z.string().min(1, "Mã QR không được để trống").optional(),
});


// ─── Check-Out DTO ────────────────────────────────────────────────────────────
// Dùng khi nhân viên bấm check-out qua app
export const CheckOutDto = z.object({
    // Vị trí GPS khi check-out
    latitude: z
        .number()
        .min(-90, "Vĩ độ phải trong khoảng -90 đến 90")
        .max(90, "Vĩ độ phải trong khoảng -90 đến 90"),

    longitude: z
        .number()
        .min(-180, "Kinh độ phải trong khoảng -180 đến 180")
        .max(180, "Kinh độ phải trong khoảng -180 đến 180"),

    // Thông tin thiết bị
    deviceId: z.string().optional(),

    // Địa chỉ IP của thiết bị
    ipAddress: z.union([z.ipv4(), z.ipv6()], { message: "IP không hợp lệ" }).optional(),

    // Mã QR được quét khi check-out
    qrCode: z.string().min(1, "Mã QR không được để trống").optional(),
});

// ─── Update Attendance DTO (admin/manager chỉnh sửa thủ công) ────────────────
export const UpdateAttendanceDto = z
    .object({
        date: z.coerce.date({ message: "Ngày chấm công không hợp lệ" }).optional(),

        type: AttendanceTypeEnum.optional(),

        status: AttendanceStatusEnum.optional(),

        checkInAt: z.coerce.date({ message: "Thời gian check-in không hợp lệ" }).optional(),

        checkOutAt: z.coerce.date({ message: "Thời gian check-out không hợp lệ" }).optional(),

        checkInMeta: CheckInMetaSchema,

        checkOutMeta: CheckInMetaSchema,

        isFraud: z.boolean().optional(),

        fraudReason: z.string().optional(),
    })
    .refine(
        (data) => {
            if (data.checkInAt && data.checkOutAt) {
                return data.checkOutAt > data.checkInAt;
            }
            return true;
        },
        {
            message: "Thời gian check-out phải sau thời gian check-in",
            path: ["checkOutAt"],
        }
    );

// ─── Review Attendance DTO (duyệt/từ chối chấm công) ─────────────────────────
export const ReviewAttendanceDto = z.object({
    status: z.enum(["APPROVED", "REJECTED"], {
        message: "Trạng thái phải là APPROVED hoặc REJECTED",
    }),
});

// ─── Mark Fraud DTO ───────────────────────────────────────────────────────────
export const MarkFraudDto = z.object({
    isFraud: z.boolean(),
    fraudReason: z.string().optional(),
}).refine(
    (data) => {
        // Nếu đánh dấu là gian lận thì cần có lý do
        if (data.isFraud && !data.fraudReason) {
            return false;
        }
        return true;
    },
    {
        message: "Cần cung cấp lý do khi đánh dấu gian lận",
        path: ["fraudReason"],
    }
);

// ─── Query Attendance DTO (filter danh sách) ──────────────────────────────────
export const QueryAttendanceDto = z.object({
    userId: z.uuid({ message: "userId không hợp lệ" }).optional(),

    jobId: z.uuid({ message: "jobId không hợp lệ" }).optional(),

    type: AttendanceTypeEnum.optional(),

    status: AttendanceStatusEnum.optional(),

    // Lọc theo khoảng ngày
    startDate: z.coerce.date().optional(),

    endDate: z.coerce.date().optional(),

    isFraud: z
        .string()
        .optional()
        .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

/**
 * @typedef {z.infer<typeof CreateAttendanceDto>} CreateAttendanceDtoType
 * @typedef {z.infer<typeof CheckInDto>} CheckInDtoType
 * @typedef {z.infer<typeof CheckOutDto>} CheckOutDtoType
 * @typedef {z.infer<typeof UpdateAttendanceDto>} UpdateAttendanceDtoType
 * @typedef {z.infer<typeof ReviewAttendanceDto>} ReviewAttendanceDtoType
 * @typedef {z.infer<typeof MarkFraudDto>} MarkFraudDtoType
 * @typedef {z.infer<typeof QueryAttendanceDto>} QueryAttendanceDtoType
 */

