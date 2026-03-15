import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./configs/swagger.js";
import apiRoutes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middlewares/index.js";
import socketHandler from "./socket/index.js";

export const app = express();
export const httpServer = createServer(app);

// Websocket 

const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});


socketHandler(io)

// ─── Middleware cơ bản ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: "Attendance System API",
        customCss: `
          .swagger-ui .topbar { background-color: #1e293b; }
          .swagger-ui .topbar .download-url-wrapper { display: none; }
        `,
    })
);

// Expose swagger.json cho các tool bên ngoài
app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    });
});

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`✅  Server đang chạy tại   http://localhost:${PORT}`);
    console.log(`📚  Swagger UI khả dụng tại http://localhost:${PORT}/api-docs`);
});


