import {   z   } from "zod";

// ─── Login DTO ──────────────────────────────────────────────────────────────
export const LoginDto = z.object({
    email: z
        .email({ message: "Email không hợp lệ" })
        .max(255, "Email tối đa 255 ký tự"),

    password: z
        .string()
        .min(1, "Mật khẩu không được để trống"),

    device: z.object({
        deviceId: z.string().min(1, "Thiếu device ID"),
        platform: z.string().min(1, "Thiếu platform"),
        deviceName: z.string().optional(),
        fcmToken: z.string().optional(),
    }).optional(),
});

// ─── Change Password DTO ────────────────────────────────────────────────────
export const ChangePasswordDto = z.object({
    currentPassword: z.string().min(1, "Mật khẩu hiện tại không được để trống"),

    newPassword: z
        .string()
        .min(6, "Mật khẩu mới tối thiểu 6 ký tự"),

    confirmPassword: z.string().min(1, "Xác nhận mật khẩu không được để trống"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
});

/**
 * @typedef {z.infer<typeof LoginDto>} LoginDtoType
 * @typedef {z.infer<typeof ChangePasswordDto>} ChangePasswordDtoType
 */
