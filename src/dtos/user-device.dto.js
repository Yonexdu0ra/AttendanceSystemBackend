import {   z   } from "zod";

// ─── Create UserDevice DTO ────────────────────────────────────────────────────
export const CreateUserDeviceDto = z.object({
    deviceId: z
        .string()
        .min(1, "deviceId không được để trống")
        .max(255, "deviceId tối đa 255 ký tự"),

    platform: z
        .string()
        .min(1, "Platform không được để trống")
        .max(50, "Platform tối đa 50 ký tự"),

    deviceName: z
        .string()
        .max(255, "Tên thiết bị tối đa 255 ký tự")
        .optional()
        .default("Unknown Device"),

    fcmToken: z.string().optional(),

    ipAddress: z.union([z.ipv4(), z.ipv6()], { message: "Địa chỉ IP không hợp lệ" }),
});

// ─── Update UserDevice DTO ────────────────────────────────────────────────────
export const UpdateUserDeviceDto = z.object({
    deviceName: z
        .string()
        .max(255, "Tên thiết bị tối đa 255 ký tự")
        .optional(),

    fcmToken: z.string().optional(),

    ipAddress: z.union([z.ipv4(), z.ipv6()], { message: "Địa chỉ IP không hợp lệ" }).optional(),
});

/**
 * @typedef {z.infer<typeof CreateUserDeviceDto>} CreateUserDeviceDtoType
 * @typedef {z.infer<typeof UpdateUserDeviceDto>} UpdateUserDeviceDtoType
 */

