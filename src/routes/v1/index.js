import {   Router   } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import holidayRoutes from "./holiday.routes.js";
import meRoutes from "./me.routes.js";
import notificationRoutes from "./notification.routes.js";
import leaveRequestRoutes from "./leave-request.routes.js";
import overtimeRoutes from "./overtime-request.routes.js";
import jobRoutes from "./job.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import auditLogRoutes from "./audit-log.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/holidays", holidayRoutes);
router.use("/me", meRoutes);
router.use("/notifications", notificationRoutes);
router.use("/leave-requests", leaveRequestRoutes);
router.use("/overtime-requests", overtimeRoutes);
router.use("/jobs", jobRoutes);
router.use("/attendances", attendanceRoutes);
router.use("/audit-logs", auditLogRoutes);

export default router;
