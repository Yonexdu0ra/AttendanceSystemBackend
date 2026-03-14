import swaggerJsdoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Attendance System API",
            version: "1.0.0",
            description: "API tài liệu cho hệ thống quản lý chấm công",
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3000}/api/v1`,
                description: "Development server",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                // ─── Pagination ─────────────────────────────────────────────
                OffsetMeta: {
                    type: "object",
                    properties: {
                        total: { type: "integer" },
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        totalPages: { type: "integer" },
                        hasNext: { type: "boolean" },
                        hasPrev: { type: "boolean" },
                    },
                },
                CursorMeta: {
                    type: "object",
                    properties: {
                        hasMore: { type: "boolean" },
                        nextCursor: { type: "string", nullable: true },
                    },
                },
                // ─── Error ──────────────────────────────────────────────────
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string" },
                        details: { type: "array", items: { type: "object" }, nullable: true },
                    },
                },
                // ─── Holiday ────────────────────────────────────────────────
                Holiday: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        date: { type: "string", format: "date-time" },
                        isPaid: { type: "boolean" },
                        type: { type: "string", enum: ["NATIONAL", "RELIGIOUS", "CULTURAL", "COMPANY", "OTHER"] },
                        description: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                // ─── Profile ────────────────────────────────────────────────
                Profile: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        userId: { type: "string" },
                        fullName: { type: "string" },
                        address: { type: "string" },
                        bio: { type: "string", nullable: true },
                    },
                },
                // ─── Notification ────────────────────────────────────────────
                Notification: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        userId: { type: "string" },
                        title: { type: "string" },
                        content: { type: "string" },
                        type: { type: "string", enum: ["SYSTEM", "OVERTIME", "LEAVE", "APPROVAL"] },
                        isRead: { type: "boolean" },
                        refType: { type: "string", nullable: true },
                        refId: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        readAt: { type: "string", format: "date-time", nullable: true },
                    },
                },
                // ─── Leave Request ───────────────────────────────────────────
                LeaveRequest: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        userId: { type: "string" },
                        jobId: { type: "string", nullable: true },
                        startDate: { type: "string", format: "date-time" },
                        endDate: { type: "string", format: "date-time" },
                        leaveType: { type: "string", enum: ["SICK", "VACATION", "PERSONAL", "OTHER"] },
                        reason: { type: "string", nullable: true },
                        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELED"] },
                        reply: { type: "string", nullable: true },
                        approvedBy: { type: "string", nullable: true },
                        approverAt: { type: "string", format: "date-time", nullable: true },
                    },
                },
                // ─── Overtime Request ─────────────────────────────────────────
                OvertimeRequest: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        userId: { type: "string" },
                        jobId: { type: "string", nullable: true },
                        date: { type: "string", format: "date-time" },
                        startTime: { type: "string", format: "date-time" },
                        endTime: { type: "string", format: "date-time" },
                        minutes: { type: "integer" },
                        reason: { type: "string", nullable: true },
                        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELED"] },
                        reply: { type: "string", nullable: true },
                    },
                },
                // ─── Job ─────────────────────────────────────────────────────
                Job: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string", nullable: true },
                        address: { type: "string", nullable: true },
                        workStartTime: { type: "string" },
                        workEndTime: { type: "string" },
                        earlyCheckInMinutes: { type: "integer" },
                        lateCheckInMinutes: { type: "integer" },
                        earlyCheckOutMinutes: { type: "integer" },
                        lateCheckOutMinutes: { type: "integer" },
                        latitude: { type: "number" },
                        longitude: { type: "number" },
                        radius: { type: "number" },
                    },
                },
                // ─── AuditLog ────────────────────────────────────────────────
                AuditLog: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        userId: { type: "string", nullable: true },
                        action: { type: "string" },
                        resource: { type: "string" },
                        resourceId: { type: "string", nullable: true },
                        status: { type: "string", enum: ["SUCCESS", "FAIL"] },
                        ipAddress: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ["./src/routes/v1/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);

