import { redisSub } from "../configs/redisClient.js";
import { authenticateSocket } from "../middlewares/auth.middleware.js";
import { jobService } from '../services/job.service.js'
function socketHandler(io) {
    console.log('Websocket running...');

    io.use(authenticateSocket)

    io.on("connection", async (socket) => {
        try {
            // mỗi socket sẽ join vào một room có tên là userId để dễ dàng gửi tin nhắn riêng cho từng user
            socket.join(socket.user._id.toString());

            // đưa các quản lý của ca làm việc vòa 1 room để nhận chung thông báo về ca làm việc đó
            if (socket.user.role === "MANAGER" || socket.user.role === "ADMIN") {
                const managedJobs = await jobService.getManagersByJobId(socket.user.id);
                for (const job of managedJobs) {
                    socket.join(`job_${job._id.toString()}`);
                }
            }

            socket.on("disconnect", () => {
                socket.leave(socket.user._id.toString());
            });
        } catch (error) {
            console.error('[Socket] connection setup error:', error.message);
            return
        }
    })

    io.on("error", (err) => {
        console.error("Socket.IO error:", err);
    });



    const handleRedisMessage = (message, channel) => {
        try {
            const parsedMessage = JSON.parse(message);
            const { room, event, data } = parsedMessage;
            
            if (room) {
                // Gửi tới 1 room cụ thể (vd: userId hoặc jobId)
                io.to(room.toString()).emit(event, data);
            } else {
                // Broadcast cho tất cả client
                io.emit(event, data);
            }
        } catch (error) {
             console.error(`Error parsing message from channel ${channel}:`, error);
        }
    };

    redisSub.pSubscribe("attendance:*", handleRedisMessage)

    redisSub.pSubscribe("notification:*", handleRedisMessage)

    redisSub.pSubscribe("user:*", handleRedisMessage)

    redisSub.pSubscribe("leave:*", handleRedisMessage)

    redisSub.pSubscribe("overtime:*", handleRedisMessage)

    // ─── Redis pub/sub → Socket.io ────────────────────────────────────────────
    // Khi một service publish lên Redis, handler dưới sẽ forward tin nhắn
    // tới đúng room/user qua Socket.io.

    /**
     * Đăng ký nhận một channel pattern từ Redis và forward payload tới room
     * Socket.io tương ứng.
     *
     * @param {string}   pattern   - Redis channel pattern, ví dụ: "notification:*"
     * @param {string}   event     - Tên sự kiện Socket.io sẽ emit
     * @param {function} getRoom   - Nhận channel name, trả về tên room Socket.io
     */
    const _subscribe = (pattern, event, getRoom) => {
        redisSub.pSubscribe(pattern, (message, channel) => {
            try {
                const payload = JSON.parse(message);
                io.to(getRoom(channel)).emit(event, payload);
            } catch (err) {
                console.error(`[Socket] ${pattern} pub/sub error:`, err.message);
            }
        });
    };

    _subscribe("notification:*", "notification", (ch) => ch.split(':')[1]);
    _subscribe("attendance:*",   "attendance",   (ch) => `job_${ch.split(':')[1]}`);
    _subscribe("user:*",         "user",         (ch) => ch.split(':')[1]);
    _subscribe("leave:*",        "leave",        (ch) => ch.split(':')[1]);
    _subscribe("overtime:*",     "overtime",     (ch) => ch.split(':')[1]);

}

export default socketHandler;